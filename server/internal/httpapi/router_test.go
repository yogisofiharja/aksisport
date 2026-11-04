package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/yogisofiharja/aksi-server/internal/mail"
)

// Route registration panics at startup, not at compile time, when two
// patterns conflict (e.g. a static segment added beside a ":param" one).
// Building the router here turns that into a test failure.
func TestRouterRegistersWithoutConflicts(t *testing.T) {
	router := NewRouter(Deps{AllowedOrigins: "*", Mailer: mail.LogMailer{}})
	if len(router.Routes()) == 0 {
		t.Fatal("expected routes to be registered")
	}
}

// A preflight is answered from the middleware, with a cache lifetime so a
// browser doesn't repeat it before every authed request.
func TestCORSPreflightIsCacheable(t *testing.T) {
	router := NewRouter(Deps{AllowedOrigins: "*", Mailer: mail.LogMailer{}})
	req := httptest.NewRequest(http.MethodOptions, "/v1/me", nil)
	req.Header.Set("Origin", "http://localhost:8081")
	req.Header.Set("Access-Control-Request-Headers", "authorization")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusNoContent {
		t.Fatalf("preflight = %d, want 204", w.Code)
	}
	if got := w.Header().Get("Access-Control-Max-Age"); got != "86400" {
		t.Errorf("Access-Control-Max-Age = %q, want 86400", got)
	}
}
