package httpapi

import (
	"context"
	"errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/authjwt"
	dbpkg "github.com/yogisofiharja/aksi-server/internal/db"
)

// umpireAssignmentProblem is DP-023's rule for who may make whom the
// Session's umpire: an owner/admin, on a Session that isn't over, picks a
// checked-in participant (playing or not) or themselves (reclaim, even
// when not checked in). targetStatus is the target's participant status,
// "" when they have none. Returns 0 when the assignment is allowed.
func umpireAssignmentProblem(sessionStatus, callerRole, callerID, targetID, targetStatus string) (int, string) {
	if !isOwnerOrAdmin(callerRole) {
		return http.StatusForbidden, "only an owner or admin can change the umpire"
	}
	if sessionStatus == "completed" || sessionStatus == "cancelled" {
		return http.StatusConflict, "the umpire can't be changed on a completed or cancelled session"
	}
	if targetID != callerID && targetStatus != "checked_in" {
		return http.StatusBadRequest, "the umpire must be checked in to this session"
	}
	return 0, ""
}

// isSessionUmpire: only the Session's umpire starts, scores and completes
// its matches (DP-023) — not the match's players, not owners or admins.
func isSessionUmpire(umpireUserID, userID string) bool {
	return umpireUserID != "" && umpireUserID == userID
}

// LiveMatches moves a match's live copy in Firebase to a new scorer
// (firebaseadmin.LiveMatches).
type LiveMatches interface {
	SetScorer(ctx context.Context, activityID, firebaseUID string) error
}

func RegisterUmpireRoutes(rg *gin.RouterGroup, pool *pgxpool.Pool, verifier *authjwt.Verifier, liveMatches LiveMatches) {
	authed := rg.Group("")
	authed.Use(authjwt.RequireAuth(verifier))
	authed.Use(authjwt.RequireProfile(pool))

	authed.PUT("/sessions/:id/umpire", func(c *gin.Context) {
		sessionID := c.Param("id")
		sess, role, ok := requireSessionAccess(c, pool, sessionID)
		if !ok {
			return
		}
		var body struct {
			UserID string `json:"userId"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.UserID == "" {
			respondError(c, http.StatusBadRequest, "userId is required")
			return
		}
		ctx := c.Request.Context()
		user := authjwt.CurrentUser(c)
		targetStatus, err := dbpkg.GetParticipantStatus(ctx, pool, sessionID, body.UserID)
		if err != nil && !errors.Is(err, dbpkg.ErrNotFound) {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		if code, msg := umpireAssignmentProblem(sess.Status, role, user.ID, body.UserID, targetStatus); code != 0 {
			respondError(c, code, msg)
			return
		}
		if body.UserID != sess.UmpireUserID {
			liveIDs, err := dbpkg.SetSessionUmpire(ctx, pool, sessionID, body.UserID)
			if err != nil {
				respondError(c, http.StatusInternalServerError, "internal error")
				return
			}
			handOverLiveMatches(ctx, pool, liveMatches, liveIDs, body.UserID)
		}
		updated, err := dbpkg.GetSession(ctx, pool, sessionID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, updated)
	})
}

// handOverLiveMatches lets the new umpire's device write to each live
// match's copy in Firebase, from its current score (DP-023). Best effort:
// a failure is logged, and the database already names the new umpire.
func handOverLiveMatches(ctx context.Context, pool *pgxpool.Pool, liveMatches LiveMatches, activityIDs []string, userID string) {
	if liveMatches == nil || len(activityIDs) == 0 {
		return
	}
	uid, err := dbpkg.FirebaseUID(ctx, pool, userID)
	if err != nil {
		log.Printf("umpire handover: firebase uid of %s: %v", userID, err)
		return
	}
	for _, id := range activityIDs {
		if err := liveMatches.SetScorer(ctx, id, uid); err != nil {
			log.Printf("umpire handover: live match %s: %v", id, err)
		}
	}
}
