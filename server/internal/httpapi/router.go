package httpapi

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/authjwt"
)

func NewRouter(pool *pgxpool.Pool, verifier *authjwt.Verifier, allowedOrigins string) *gin.Engine {
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery(), corsMiddleware(allowedOrigins))

	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	v1 := r.Group("/v1")
	RegisterUserRoutes(v1, pool, verifier)
	RegisterClubRoutes(v1, pool, verifier)
	RegisterSessionRoutes(v1, pool, verifier)
	RegisterActivityRoutes(v1, pool, verifier)
	RegisterRecurringScheduleRoutes(v1, pool, verifier)
	RegisterSkillLevelRoutes(v1, pool, verifier)

	return r
}

func corsMiddleware(allowedOrigins string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", allowedOrigins)
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
