package httpapi

import (
	"fmt"
	"log"
	"runtime/debug"

	"github.com/gin-gonic/gin"

	"github.com/yogisofiharja/aksi-server/internal/alert"
	"github.com/yogisofiharja/aksi-server/internal/authjwt"
)

// errorLogMiddleware writes one line per 5xx response: method, route,
// the signed-in user (if any) and the errors handlers attached through
// respondInternal. The path is logged without its query string —
// /v1/live carries the sign-in token there. Panics are logged, with a
// stack trace by recoveryMiddleware.
//
// Each line also goes to the alert reporter (Telegram, when configured),
// grouped by status and route so one failing endpoint is one alert.
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
		alert.Report(fmt.Sprintf("http %d %s %s", status, c.Request.Method, route),
			fmt.Sprintf("%d %s %s\nuser=%s\n%s", status, c.Request.Method, route, userID, detail))
	}
}

// recoveryMiddleware is gin.Recovery — the panic and its stack are logged
// by Gin, the client gets a bare 500 — plus an alert carrying the stack.
// A panic skips errorLogMiddleware's own reporting, so it is reported once.
func recoveryMiddleware() gin.HandlerFunc {
	return gin.CustomRecovery(func(c *gin.Context, recovered any) {
		route := c.FullPath()
		if route == "" {
			route = c.Request.URL.Path
		}
		alert.Report("panic "+c.Request.Method+" "+route,
			fmt.Sprintf("PANIC %s %s\nuser=%s\n%v\n\n%s", c.Request.Method, route,
				authjwt.CurrentUser(c).ID, recovered, debug.Stack()))
		c.AbortWithStatus(500)
	})
}
