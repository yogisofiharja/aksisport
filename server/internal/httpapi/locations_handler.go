package httpapi

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/authjwt"
	dbpkg "github.com/yogisofiharja/aksi-server/internal/db"
)

func RegisterLocationRoutes(rg *gin.RouterGroup, pool *pgxpool.Pool, verifier *authjwt.Verifier) {
	authed := rg.Group("")
	authed.Use(authjwt.RequireAuth(verifier))
	authed.Use(authjwt.RequireProfile(pool))

	// The whole reference list in one response (38 provinces, 514
	// cities — a few tens of kilobytes): the city picker filters it on the
	// device, so choosing a city never waits on the network. It only
	// changes with a migration, hence the day-long cache.
	authed.GET("/locations", func(c *gin.Context) {
		ctx := c.Request.Context()
		provinces, err := dbpkg.ListProvinces(ctx, pool)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		cities, err := dbpkg.ListCities(ctx, pool)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.Header("Cache-Control", "private, max-age=86400")
		c.JSON(http.StatusOK, gin.H{"provinces": provinces, "cities": cities})
	})
}
