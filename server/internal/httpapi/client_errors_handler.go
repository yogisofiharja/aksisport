package httpapi

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/alert"
	"github.com/yogisofiharja/aksi-server/internal/authjwt"
	"github.com/yogisofiharja/aksi-server/internal/db"
)

// Size caps on what a client may send. A crash report is read by a
// person in a chat; anything longer is noise, or abuse.
const (
	clientErrMessageMax = 500
	clientErrStackMax   = 3000
	clientErrShortMax   = 100
)

type clientErrorReport struct {
	// render (a React error boundary), uncaught, or unhandledRejection.
	Kind       string `json:"kind"`
	Message    string `json:"message"`
	Stack      string `json:"stack"`
	Platform   string `json:"platform"`
	AppVersion string `json:"appVersion"`
	Screen     string `json:"screen"`
}

// RegisterClientErrorRoutes: POST /v1/client-errors takes a crash report
// from the app and forwards it to the alert channel. Open without
// signing in (an app can crash on the sign-in screen), rate limited per
// address, and answers 204 whatever happens to the report, so a client
// never retries. A valid sign-in token names the user in the alert.
func RegisterClientErrorRoutes(rg *gin.RouterGroup, pool *pgxpool.Pool, verifier *authjwt.Verifier, ips ClientIPResolver) {
	rg.POST("/client-errors", rateLimited(ips, 10, time.Minute), func(c *gin.Context) {
		var r clientErrorReport
		if err := c.ShouldBindJSON(&r); err != nil || strings.TrimSpace(r.Message) == "" {
			respondError(c, http.StatusBadRequest, "message is required")
			return
		}
		key, text := formatClientError(r, reporterName(c, pool, verifier))
		alert.Report(key, text)
		c.Status(http.StatusNoContent)
	})
}

// reporterName is "@username" for a valid sign-in token, "signed out"
// otherwise. A bad token is not an error here — the report still counts.
func reporterName(c *gin.Context, pool *pgxpool.Pool, verifier *authjwt.Verifier) string {
	header := c.GetHeader("Authorization")
	if !strings.HasPrefix(header, "Bearer ") || verifier == nil {
		return "signed out"
	}
	uid, err := verifier.VerifyIDToken(strings.TrimPrefix(header, "Bearer "))
	if err != nil {
		return "signed out"
	}
	user, err := db.GetUserByFirebaseUID(c.Request.Context(), pool, uid)
	if err != nil {
		return "signed in, no profile"
	}
	return "@" + user.Username
}

// formatClientError builds the alert. Reports are grouped by kind and
// the message's first line, so one bug hitting many players is one alert
// with a count.
func formatClientError(r clientErrorReport, who string) (key, text string) {
	message := clip(strings.TrimSpace(r.Message), clientErrMessageMax)
	firstLine, _, _ := strings.Cut(message, "\n")
	kind := clip(oneLine(r.Kind), clientErrShortMax)
	if kind == "" {
		kind = "uncaught"
	}
	key = "client " + kind + " " + clip(firstLine, 200)

	var b strings.Builder
	fmt.Fprintf(&b, "APP CRASH (%s", kind)
	if p := clip(oneLine(r.Platform), clientErrShortMax); p != "" {
		fmt.Fprintf(&b, ", %s", p)
	}
	if v := clip(oneLine(r.AppVersion), clientErrShortMax); v != "" {
		fmt.Fprintf(&b, " %s", v)
	}
	fmt.Fprintf(&b, ")\nuser: %s", who)
	if s := clip(oneLine(r.Screen), clientErrShortMax); s != "" {
		fmt.Fprintf(&b, "\nscreen: %s", s)
	}
	fmt.Fprintf(&b, "\n%s", message)
	if s := clip(strings.TrimSpace(r.Stack), clientErrStackMax); s != "" {
		fmt.Fprintf(&b, "\n\n%s", s)
	}
	return key, b.String()
}

func oneLine(s string) string {
	return strings.Join(strings.Fields(s), " ")
}

func clip(s string, max int) string {
	r := []rune(s)
	if len(r) <= max {
		return s
	}
	return string(r[:max]) + "…"
}
