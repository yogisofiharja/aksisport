package httpapi

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/authjwt"
	dbpkg "github.com/yogisofiharja/aksi-server/internal/db"
)

// requireSessionAccess loads the session and the caller's role in its
// parent club. ok=false means a response has already been sent.
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
	return dbSession{ID: sess.ID, ClubID: sess.ClubID, Sport: sess.Sport}, m.Role, true
}

// dbSession is a tiny local alias to avoid importing models directly here
// for a value only used to pass a couple of fields around this file.
type dbSession struct {
	ID     string
	ClubID string
	Sport  string
}

func isOwnerOrAdmin(role string) bool {
	return role == "owner" || role == "admin"
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
			Sport      string  `json:"sport"`
			Name       *string `json:"name"`
			Location   *string `json:"location"`
			CourtCount int     `json:"courtCount"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.Sport == "" {
			respondError(c, http.StatusBadRequest, "sport is required")
			return
		}
		session, err := dbpkg.CreateSession(c.Request.Context(), pool, clubID, body.Sport, body.Name, body.Location, body.CourtCount, user.ID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusCreated, session)
	})

	authed.GET("/clubs/:clubId/sessions", func(c *gin.Context) {
		clubID := c.Param("clubId")
		if _, _, ok := requireMember(c, pool, clubID); !ok {
			return
		}
		sessions, err := dbpkg.ListSessionsForClub(c.Request.Context(), pool, clubID)
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
		_, role, ok := requireSessionAccess(c, pool, sessionID)
		if !ok {
			return
		}
		if !isOwnerOrAdmin(role) {
			respondError(c, http.StatusForbidden, "only owner/admin can update this session")
			return
		}
		var body struct {
			Name     *string `json:"name"`
			Location *string `json:"location"`
			Status   *string `json:"status"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			respondError(c, http.StatusBadRequest, "invalid body")
			return
		}
		if body.Status != nil && *body.Status != "open" && *body.Status != "in_progress" && *body.Status != "completed" {
			respondError(c, http.StatusBadRequest, "invalid status")
			return
		}
		session, err := dbpkg.UpdateSession(c.Request.Context(), pool, sessionID, dbpkg.SessionUpdate{
			Name: body.Name, Location: body.Location, Status: body.Status,
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
