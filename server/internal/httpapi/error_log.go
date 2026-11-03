package httpapi

import (
	"log"

	"github.com/gin-gonic/gin"

	"github.com/yogisofiharja/aksi-server/internal/authjwt"
)

// errorLogMiddleware writes one line per 5xx response: method, route,
// the signed-in user (if any) and the errors handlers attached through
// respondInternal. The path is logged without its query string —
// /v1/live carries the sign-in token there. Panics are logged, with a
// stack trace, by gin.Recovery.
//
// This is the single place server errors surface; an alerting channel
// (e.g. Telegram) would hook in here.
func errorLogMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
		status := c.Writer.Status()
		if status < 500 {
			return
		}
		route := c.FullPath()
		if route == "" {
			route = c.Request.URL.Path
		}
		userID := authjwt.CurrentUser(c).ID
		if userID == "" {
			userID = "-"
		}
		detail := c.Errors.String()
		if detail == "" {
			detail = "(no error attached)"
		}
		log.Printf("ERROR %d %s %s user=%s: %s", status, c.Request.Method, route, userID, detail)
	}
}
