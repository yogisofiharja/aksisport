package httpapi

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/authjwt"
	dbpkg "github.com/yogisofiharja/aksi-server/internal/db"
)

const attendanceListLimit = 50

// RegisterAttendanceRoutes: DP-029.
func RegisterAttendanceRoutes(rg *gin.RouterGroup, pool *pgxpool.Pool, verifier *authjwt.Verifier) {
	authed := rg.Group("")
	authed.Use(authjwt.RequireAuth(verifier))
	authed.Use(authjwt.RequireProfile(pool))

	// A player's own record: every Community, every Session.
	authed.GET("/me/attendance", func(c *gin.Context) {
		a, err := dbpkg.GetAttendance(c.Request.Context(), pool, authjwt.CurrentUser(c).ID, "", attendanceListLimit)
		if err != nil {
			respondInternal(c, err)
			return
		}
		c.JSON(http.StatusOK, a)
	})

	// An organizer looking at someone connected to their Community: counts
	// from every Community, Sessions from this one only.
	authed.GET("/clubs/:clubId/people/:userId/attendance", func(c *gin.Context) {
		clubID, targetID := c.Param("clubId"), c.Param("userId")
		if !requireOwnerOrAdmin(c, pool, clubID) {
			return
		}
		ok, err := dbpkg.CanSeeAttendance(c.Request.Context(), pool, clubID, targetID)
		if err != nil {
			respondInternal(c, err)
			return
		}
		if !ok {
			respondError(c, http.StatusNotFound, "not someone in this club")
			return
		}
		a, err := dbpkg.GetAttendance(c.Request.Context(), pool, targetID, clubID, attendanceListLimit)
		if err != nil {
			respondInternal(c, err)
			return
		}
		c.JSON(http.StatusOK, a)
	})

	// Correct attended / no-show on a completed Session, within 7 days of
	// its end. Body: {"attended": true|false}.
	authed.POST("/sessions/:id/participants/:userId/attendance", func(c *gin.Context) {
		sessionID, participantID := c.Param("id"), c.Param("userId")
		_, role, ok := requireSessionAccess(c, pool, sessionID)
		if !ok {
			return
		}
		if !isOwnerOrAdmin(role) {
			respondError(c, http.StatusForbidden, "only an owner or admin can correct attendance")
			return
		}
		var body struct {
			Attended *bool `json:"attended"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.Attended == nil {
			respondError(c, http.StatusBadRequest, "attended is required")
			return
		}
		p, err := dbpkg.CorrectAttendance(c.Request.Context(), pool, sessionID, participantID, *body.Attended, authjwt.CurrentUser(c).ID)
		if errors.Is(err, dbpkg.ErrNotFound) {
			respondError(c, http.StatusNotFound, "participant not found")
			return
		}
		if errors.Is(err, dbpkg.ErrConflict) {
			respondError(c, http.StatusConflict, "attendance can only be corrected for 7 days after a completed session")
			return
		}
		if err != nil {
			respondInternal(c, err)
			return
		}
		c.JSON(http.StatusOK, p)
	})
}
