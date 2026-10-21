package httpapi

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/authjwt"
	dbpkg "github.com/yogisofiharja/aksi-server/internal/db"
)

// requireActivityAccess loads the activity and the caller's role in its
// session's parent club. ok=false means a response has already been sent.
func requireActivityAccess(c *gin.Context, pool *pgxpool.Pool, activityID string) (activityID_ string, sessionID string, role string, ok bool) {
	activity, err := dbpkg.GetActivity(c.Request.Context(), pool, activityID)
	if errors.Is(err, dbpkg.ErrNotFound) {
		respondError(c, http.StatusNotFound, "activity not found")
		return "", "", "", false
	}
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal error")
		return "", "", "", false
	}
	_, role, ok = requireSessionAccess(c, pool, activity.SessionID)
	if !ok {
		return "", "", "", false
	}
	return activity.ID, activity.SessionID, role, true
}

func RegisterActivityRoutes(rg *gin.RouterGroup, pool *pgxpool.Pool, verifier *authjwt.Verifier) {
	authed := rg.Group("")
	authed.Use(authjwt.RequireAuth(verifier))
	authed.Use(authjwt.RequireProfile(pool))

	authed.POST("/sessions/:id/activities", func(c *gin.Context) {
		sessionID := c.Param("id")
		session, role, ok := requireSessionAccess(c, pool, sessionID)
		if !ok {
			return
		}
		if !isOwnerOrAdmin(role) {
			respondError(c, http.StatusForbidden, "only owner/admin can add a match")
			return
		}

		var body struct {
			Config       json.RawMessage `json:"config"`
			Participants []struct {
				UserID    *string `json:"userId"`
				GuestName *string `json:"guestName"`
				Team      *string `json:"team"`
			} `json:"participants"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || len(body.Config) == 0 || len(body.Participants) == 0 {
			respondError(c, http.StatusBadRequest, "config and participants are required")
			return
		}
		participants := make([]dbpkg.ActivityParticipantInput, 0, len(body.Participants))
		for _, p := range body.Participants {
			if (p.UserID == nil) == (p.GuestName == nil) {
				respondError(c, http.StatusBadRequest, "each participant needs exactly one of userId or guestName")
				return
			}
			if p.Team != nil && *p.Team != "A" && *p.Team != "B" {
				respondError(c, http.StatusBadRequest, "team must be 'A' or 'B'")
				return
			}
			participants = append(participants, dbpkg.ActivityParticipantInput{UserID: p.UserID, GuestName: p.GuestName, Team: p.Team})
		}

		user := authjwt.CurrentUser(c)
		activity, err := dbpkg.CreateActivity(c.Request.Context(), pool, sessionID, session.Sport, body.Config, participants, user.ID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusCreated, activity)
	})

	authed.GET("/sessions/:id/activities", func(c *gin.Context) {
		sessionID := c.Param("id")
		if _, _, ok := requireSessionAccess(c, pool, sessionID); !ok {
			return
		}
		activities, err := dbpkg.ListActivitiesForSession(c.Request.Context(), pool, sessionID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, activities)
	})

	authed.GET("/activities/:id", func(c *gin.Context) {
		activityID := c.Param("id")
		if _, _, _, ok := requireActivityAccess(c, pool, activityID); !ok {
			return
		}
		detail, err := dbpkg.GetActivityDetail(c.Request.Context(), pool, activityID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, detail)
	})

	// Regenerate-matches support: the client deletes every currently
	// queued activity before generating a fresh fair round. Only queued
	// matches can be deleted — db.DeleteActivity enforces that.
	authed.DELETE("/activities/:id", func(c *gin.Context) {
		activityID := c.Param("id")
		_, _, role, ok := requireActivityAccess(c, pool, activityID)
		if !ok {
			return
		}
		if !isOwnerOrAdmin(role) {
			respondError(c, http.StatusForbidden, "only owner/admin can delete a match")
			return
		}
		err := dbpkg.DeleteActivity(c.Request.Context(), pool, activityID)
		if errors.Is(err, dbpkg.ErrNotFound) {
			respondError(c, http.StatusNotFound, "activity not found")
			return
		}
		if errors.Is(err, dbpkg.ErrConflict) {
			respondError(c, http.StatusConflict, "only a queued match can be deleted")
			return
		}
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.Status(http.StatusNoContent)
	})

	authed.POST("/activities/:id/start", func(c *gin.Context) {
		activityID := c.Param("id")
		_, sessionID, _, ok := requireActivityAccess(c, pool, activityID)
		if !ok {
			return
		}
		// DP-022: matches may start once the Session is In Progress, or from
		// MatchEarlyStart before its start time (10 minutes in live use).
		sess, err := dbpkg.GetSession(c.Request.Context(), pool, sessionID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		if !dbpkg.MatchesOpen(sess, time.Now()) {
			respondError(c, http.StatusConflict, "the session hasn't started yet")
			return
		}
		user := authjwt.CurrentUser(c)
		// DP-023: only the Session's umpire starts matches, and scores them.
		if !isSessionUmpire(sess.UmpireUserID, user.ID) {
			respondError(c, http.StatusForbidden, "only the session's umpire can start a match")
			return
		}
		activity, err := dbpkg.StartActivity(c.Request.Context(), pool, activityID, user.ID)
		if errors.Is(err, dbpkg.ErrConflict) {
			respondError(c, http.StatusConflict, "match is not queued")
			return
		}
		if errors.Is(err, dbpkg.ErrNotFound) {
			respondError(c, http.StatusNotFound, "activity not found")
			return
		}
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		// A match started before the start time means the Session is under
		// way: it becomes In Progress now (DP-022).
		if sess.Status == "open" {
			if err := dbpkg.StartSessionEarly(c.Request.Context(), pool, sessionID); err != nil {
				log.Printf("session %s: early start: %v", sessionID, err)
			}
		}
		c.JSON(http.StatusOK, activity)
	})

	authed.POST("/activities/:id/complete", func(c *gin.Context) {
		activityID := c.Param("id")
		_, sessionID, _, ok := requireActivityAccess(c, pool, activityID)
		if !ok {
			return
		}
		if !requireUmpire(c, pool, sessionID, "only the session's umpire can complete a match") {
			return
		}

		var body struct {
			Result   json.RawMessage `json:"result"`
			PointLog json.RawMessage `json:"pointLog"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || len(body.Result) == 0 {
			respondError(c, http.StatusBadRequest, "result is required")
			return
		}
		updated, err := dbpkg.CompleteActivity(c.Request.Context(), pool, activityID, body.Result, body.PointLog)
		if errors.Is(err, dbpkg.ErrConflict) {
			respondError(c, http.StatusConflict, "match is not live")
			return
		}
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, updated)
	})

	// DP-025 End match early: the umpire stops a live match; it is saved
	// as Unfinished with the score so far, neither a win nor a loss.
	authed.POST("/activities/:id/end-early", func(c *gin.Context) {
		activityID := c.Param("id")
		_, sessionID, _, ok := requireActivityAccess(c, pool, activityID)
		if !ok {
			return
		}
		if !requireUmpire(c, pool, sessionID, "only the session's umpire can end a match") {
			return
		}
		var body struct {
			Result   json.RawMessage `json:"result"`
			PointLog json.RawMessage `json:"pointLog"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || len(body.Result) == 0 {
			respondError(c, http.StatusBadRequest, "result is required")
			return
		}
		updated, err := dbpkg.EndActivityEarly(c.Request.Context(), pool, activityID, body.Result, body.PointLog)
		if errors.Is(err, dbpkg.ErrConflict) {
			respondError(c, http.StatusConflict, "match is not live")
			return
		}
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, updated)
	})
}

// requireUmpire sends 403 with msg unless the caller is the Session's
// current umpire (DP-023). ok=false means a response has been sent.
func requireUmpire(c *gin.Context, pool *pgxpool.Pool, sessionID, msg string) bool {
	sess, err := dbpkg.GetSession(c.Request.Context(), pool, sessionID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal error")
		return false
	}
	if !isSessionUmpire(sess.UmpireUserID, authjwt.CurrentUser(c).ID) {
		respondError(c, http.StatusForbidden, msg)
		return false
	}
	// DP-027: on a Completed Session, scoring closes an hour after its end;
	// the match is then saved as Unfinished by the scheduler.
	if !dbpkg.ScoringOpen(sess, time.Now()) {
		respondError(c, http.StatusConflict, "scoring closed an hour after the session ended; the match is saved as unfinished")
		return false
	}
	return true
}
