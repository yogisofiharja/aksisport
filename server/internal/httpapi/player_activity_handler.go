package httpapi

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/authjwt"
	dbpkg "github.com/yogisofiharja/aksi-server/internal/db"
	"github.com/yogisofiharja/aksi-server/internal/sports"
)

// DP-019: a player's history in one sport, across every Community. Same
// visibility as the profile it is opened from (yourself, people you share
// a Community with, organizers of a Community you asked to join).
func RegisterPlayerActivityRoutes(rg *gin.RouterGroup, pool *pgxpool.Pool, verifier *authjwt.Verifier) {
	profiled := rg.Group("")
	profiled.Use(authjwt.RequireAuth(verifier))
	profiled.Use(authjwt.RequireProfile(pool))

	profiled.GET("/users/:userId/sports/:sport/activity", func(c *gin.Context) {
		viewer := authjwt.CurrentUser(c)
		targetID := c.Param("userId")
		sport := c.Param("sport")
		if !sports.IsKnown(sport) {
			respondError(c, http.StatusNotFound, "unknown sport")
			return
		}
		ctx := c.Request.Context()
		allowed, err := dbpkg.CanViewPlayerProfile(ctx, pool, viewer.ID, targetID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		if !allowed {
			respondError(c, http.StatusNotFound, "player not found")
			return
		}
		activity, err := dbpkg.GetPlayerSportActivity(ctx, pool, targetID, sport)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, activity)
	})
}
