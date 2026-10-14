package httpapi

import (
	"fmt"
	"math"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/yogisofiharja/aksi-server/internal/ratelimit"
)

// rateLimited allows each client IP at most `limit` calls of the route it
// guards per `per`, answering 429 RATE_LIMITED with Retry-After beyond
// that. One limiter per call, so every guarded route counts on its own.
// Used on the routes reachable without signing in.
func rateLimited(ips ClientIPResolver, limit int, per time.Duration) gin.HandlerFunc {
	limiter := ratelimit.New(limit, per)
	return func(c *gin.Context) {
		ok, retryAfter := limiter.Allow(ips.ClientIP(c.Request))
		if ok {
			c.Next()
			return
		}
		seconds := int(math.Ceil(retryAfter.Seconds()))
		c.Header("Retry-After", fmt.Sprint(seconds))
		c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
			"error":             tooManyAttemptsMessage(seconds),
			"code":              "RATE_LIMITED",
			"retryAfterSeconds": seconds,
		})
	}
}

func tooManyAttemptsMessage(seconds int) string {
	if seconds <= 60 {
		return "too many attempts — try again in a minute"
	}
	return fmt.Sprintf("too many attempts — try again in %d minutes", int(math.Ceil(float64(seconds)/60)))
}
