package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/authjwt"
	dbpkg "github.com/yogisofiharja/aksi-server/internal/db"
)

// requireSessionAccess loads the session and the caller's role in its
// parent club. ok=false means a response has already been sent.
//
// DP-001: a 'draft' session is invisible to members who aren't owner/admin
// — treated as not-found rather than forbidden, so its existence isn't
// leaked to members it shouldn't be visible to at all.
func requireSessionAccess(c *gin.Context, pool *pgxpool.Pool, sessionID string) (session dbSession, role string, ok bool) {
	sess, err := dbpkg.GetSession(c.Request.Context(), pool, sessionID)
	if errors.Is(err, dbpkg.ErrNotFound) {
		respondError(c, http.StatusNotFound, "session not found")
		return dbSession{}, "", false
	}
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal error")
		return dbSession{}, "", false
	}

	user := authjwt.CurrentUser(c)
	m, err := dbpkg.GetMembership(c.Request.Context(), pool, sess.ClubID, user.ID)
	if errors.Is(err, dbpkg.ErrNotFound) {
		respondError(c, http.StatusForbidden, "not a member of this club")
		return dbSession{}, "", false
	}
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal error")
		return dbSession{}, "", false
	}
	if sess.Status == "draft" && !isOwnerOrAdmin(m.Role) {
		respondError(c, http.StatusNotFound, "session not found")
		return dbSession{}, "", false
	}
	return dbSession{ID: sess.ID, ClubID: sess.ClubID, Sport: sess.Sport, Status: sess.Status}, m.Role, true
}

// dbSession is a tiny local alias to avoid importing models directly here
// for a value only used to pass a couple of fields around this file.
type dbSession struct {
	ID     string
	ClubID string
	Sport  string
	Status string
}

func isOwnerOrAdmin(role string) bool {
	return role == "owner" || role == "admin"
}

// sessionStatusTransitions: DP-001's explicit states (Draft, Cancelled,
// Completed) plus the two mechanically-explicit ones (In Progress is
// reached by an explicit "organizer starts session" action, per the
// approved model, even though it's conceptually a "transition state"
// rather than a milestone the organizer lingers in). Recruiting/Ready/Full
// are not here — never stored, see ListSessionsForClub's comment and
// docs/engineering/architecture.md.
var sessionStatusTransitions = map[string][]string{
	"draft":       {"open", "cancelled"},
	"open":        {"in_progress", "cancelled"},
	"in_progress": {"completed", "cancelled"},
	"completed":   {},
	"cancelled":   {},
}

func isValidSessionTransition(from, to string) bool {
	for _, allowed := range sessionStatusTransitions[from] {
		if allowed == to {
			return true
		}
	}
	return false
}

func RegisterSessionRoutes(rg *gin.RouterGroup, pool *pgxpool.Pool, verifier *authjwt.Verifier) {
	authed := rg.Group("")
	authed.Use(authjwt.RequireAuth(verifier))
	authed.Use(authjwt.RequireProfile(pool))

	authed.POST("/clubs/:clubId/sessions", func(c *gin.Context) {
		clubID := c.Param("clubId")
		user := authjwt.CurrentUser(c)
		m, err := dbpkg.GetMembership(c.Request.Context(), pool, clubID, user.ID)
		if errors.Is(err, dbpkg.ErrNotFound) {
			respondError(c, http.StatusForbidden, "not a member of this club")
			return
		}
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		if !isOwnerOrAdmin(m.Role) {
			respondError(c, http.StatusForbidden, "only owner/admin can create sessions")
			return
		}

		var body struct {
			Sport              string          `json:"sport"`
			Name               *string         `json:"name"`
			Location           *string         `json:"location"`
			CourtCount         int             `json:"courtCount"`
			MaxParticipants    *int            `json:"maxParticipants"`
			DefaultMatchFormat json.RawMessage `json:"defaultMatchFormat"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.Sport == "" {
			respondError(c, http.StatusBadRequest, "sport is required")
			return
		}
		session, err := dbpkg.CreateSession(c.Request.Context(), pool, dbpkg.CreateSessionParams{
			ClubID: clubID, Sport: body.Sport, Name: body.Name, Location: body.Location,
			CourtCount: body.CourtCount, MaxParticipants: body.MaxParticipants,
			DefaultMatchFormat: body.DefaultMatchFormat, CreatedBy: user.ID,
		})
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusCreated, session)
	})

	authed.GET("/clubs/:clubId/sessions", func(c *gin.Context) {
		clubID := c.Param("clubId")
		user := authjwt.CurrentUser(c)
		m, err := dbpkg.GetMembership(c.Request.Context(), pool, clubID, user.ID)
		if errors.Is(err, dbpkg.ErrNotFound) {
			respondError(c, http.StatusForbidden, "not a member of this club")
			return
		}
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		// DP-001: only owner/admin see draft sessions in the list —
		// requireMember only distinguishes owner, not admin, so this
		// fetches membership directly rather than widening that shared
		// helper's signature for every one of its other call sites.
		sessions, err := dbpkg.ListSessionsForClub(c.Request.Context(), pool, clubID, isOwnerOrAdmin(m.Role))
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, sessions)
	})

	authed.GET("/sessions/:id", func(c *gin.Context) {
		sessionID := c.Param("id")
		if _, _, ok := requireSessionAccess(c, pool, sessionID); !ok {
			return
		}
		session, err := dbpkg.GetSession(c.Request.Context(), pool, sessionID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, session)
	})

	authed.PATCH("/sessions/:id", func(c *gin.Context) {
		sessionID := c.Param("id")
		sess, role, ok := requireSessionAccess(c, pool, sessionID)
		if !ok {
			return
		}
		if !isOwnerOrAdmin(role) {
			respondError(c, http.StatusForbidden, "only owner/admin can update this session")
			return
		}
		var body struct {
			Name               *string         `json:"name"`
			Location           *string         `json:"location"`
			Status             *string         `json:"status"`
			MaxParticipants    *int            `json:"maxParticipants"`
			DefaultMatchFormat json.RawMessage `json:"defaultMatchFormat"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			respondError(c, http.StatusBadRequest, "invalid body")
			return
		}
		// DP-001: status is now a guarded transition (draft->open->in_progress
		// ->completed, cancelled reachable from any non-terminal state), not
		// a free-form set-to-anything write — see sessionStatusTransitions.
		if body.Status != nil {
			if _, known := sessionStatusTransitions[*body.Status]; !known {
				respondError(c, http.StatusBadRequest, "invalid status")
				return
			}
			if !isValidSessionTransition(sess.Status, *body.Status) {
				respondError(c, http.StatusConflict, "cannot transition session from "+sess.Status+" to "+*body.Status)
				return
			}
		}
		session, err := dbpkg.UpdateSession(c.Request.Context(), pool, sessionID, dbpkg.SessionUpdate{
			Name: body.Name, Location: body.Location, Status: body.Status,
			MaxParticipants: body.MaxParticipants, DefaultMatchFormat: body.DefaultMatchFormat,
		})
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, session)
	})

	authed.GET("/sessions/:id/participants", func(c *gin.Context) {
		sessionID := c.Param("id")
		if _, _, ok := requireSessionAccess(c, pool, sessionID); !ok {
			return
		}
		participants, err := dbpkg.ListParticipants(c.Request.Context(), pool, sessionID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, participants)
	})

	authed.POST("/sessions/:id/register", func(c *gin.Context) {
		sessionID := c.Param("id")
		if _, _, ok := requireSessionAccess(c, pool, sessionID); !ok {
			return
		}
		user := authjwt.CurrentUser(c)
		p, err := dbpkg.RegisterParticipant(c.Request.Context(), pool, sessionID, user.ID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, p)
	})

	authed.POST("/sessions/:id/checkin", func(c *gin.Context) {
		sessionID := c.Param("id")
		if _, _, ok := requireSessionAccess(c, pool, sessionID); !ok {
			return
		}
		user := authjwt.CurrentUser(c)
		p, err := dbpkg.CheckIn(c.Request.Context(), pool, sessionID, user.ID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, p)
	})

	// DP-002: self-service, mirrors /checkin's existing shape exactly (acts
	// on the caller, no userId in the path). Owner/admin managing another
	// participant's checkout/cancellation on their behalf is not built here
	// — deferred until a screen actually needs it (DP-006).
	authed.POST("/sessions/:id/checkout", func(c *gin.Context) {
		sessionID := c.Param("id")
		if _, _, ok := requireSessionAccess(c, pool, sessionID); !ok {
			return
		}
		user := authjwt.CurrentUser(c)
		p, err := dbpkg.CheckOut(c.Request.Context(), pool, sessionID, user.ID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, p)
	})

	authed.POST("/sessions/:id/cancel", func(c *gin.Context) {
		sessionID := c.Param("id")
		if _, _, ok := requireSessionAccess(c, pool, sessionID); !ok {
			return
		}
		user := authjwt.CurrentUser(c)
		p, err := dbpkg.CancelParticipant(c.Request.Context(), pool, sessionID, user.ID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, p)
	})

	// DP-002: marking someone else absent is inherently an organizer
	// action, not self-service — owner/admin only, unlike checkout/cancel.
	authed.POST("/sessions/:id/participants/:userId/no-show", func(c *gin.Context) {
		sessionID := c.Param("id")
		targetUserID := c.Param("userId")
		_, role, ok := requireSessionAccess(c, pool, sessionID)
		if !ok {
			return
		}
		if !isOwnerOrAdmin(role) {
			respondError(c, http.StatusForbidden, "only owner/admin can mark a participant as no-show")
			return
		}
		p, err := dbpkg.MarkNoShow(c.Request.Context(), pool, sessionID, targetUserID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, p)
	})

	authed.POST("/sessions/:id/participants", func(c *gin.Context) {
		sessionID := c.Param("id")
		_, role, ok := requireSessionAccess(c, pool, sessionID)
		if !ok {
			return
		}
		if !isOwnerOrAdmin(role) {
			respondError(c, http.StatusForbidden, "only owner/admin can add a guest")
			return
		}
		var body struct {
			GuestName string `json:"guestName"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.GuestName == "" {
			respondError(c, http.StatusBadRequest, "guestName is required")
			return
		}
		p, err := dbpkg.AddGuestParticipant(c.Request.Context(), pool, sessionID, body.GuestName)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusCreated, p)
	})
}
