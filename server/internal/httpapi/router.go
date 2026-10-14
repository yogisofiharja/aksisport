package httpapi

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/authjwt"
	"github.com/yogisofiharja/aksi-server/internal/live"
	"github.com/yogisofiharja/aksi-server/internal/mail"
	"github.com/yogisofiharja/aksi-server/internal/notify"
)

// Deps is everything the HTTP layer needs from the outside world.
type Deps struct {
	Pool           *pgxpool.Pool
	Verifier       *authjwt.Verifier
	AllowedOrigins string
	// Mailer sends account email (DP-015).
	Mailer mail.Mailer
	// Passwords may be nil — password recovery then reports itself
	// unavailable.
	Passwords PasswordSetter
	// ClientIP identifies callers for rate limiting the public routes.
	ClientIP ClientIPResolver
	// Notifier records and pushes notifications (DP-018).
	Notifier *notify.Service
	// Hub is the live connection (DP-021). Nil disables live events.
	Hub *live.Hub
}

func NewRouter(d Deps) *gin.Engine {
	pool, verifier := d.Pool, d.Verifier
	r := gin.New()
	// Client addresses come from ClientIPResolver, never from gin's own
	// guess, which would believe any X-Forwarded-For.
	_ = r.SetTrustedProxies(nil)
	// /v1/live carries the sign-in token in its query string (WebSockets
	// can't send headers from a browser) — never write it to the log.
	r.Use(gin.LoggerWithConfig(gin.LoggerConfig{SkipPaths: []string{"/v1/live"}}), gin.Recovery(), corsMiddleware(d.AllowedOrigins))

	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	v1 := r.Group("/v1")
	hub := d.Hub
	if hub == nil {
		hub = live.NewHub()
	}
	msgs := &messenger{pool: pool, hub: hub, notifier: d.Notifier}
	RegisterUserRoutes(v1, pool, verifier, d.Mailer, d.ClientIP)
	RegisterAccountEmailRoutes(v1, pool, verifier, d.Mailer, d.Passwords, d.ClientIP)
	RegisterClubRoutes(v1, pool, verifier, d.Notifier)
	RegisterNotificationRoutes(v1, pool, verifier, d.Notifier)
	RegisterDirectMessageRoutes(v1, pool, verifier, msgs)
	RegisterMessagingRoutes(v1, pool, verifier, hub, d.AllowedOrigins)
	RegisterPlayerActivityRoutes(v1, pool, verifier)
	RegisterLocationRoutes(v1, pool, verifier)
	RegisterSessionRoutes(v1, pool, verifier, msgs)
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
