package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func requestFrom(remoteAddr, cfConnectingIP string) *http.Request {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.RemoteAddr = remoteAddr
	if cfConnectingIP != "" {
		r.Header.Set("CF-Connecting-IP", cfConnectingIP)
	}
	return r
}

func TestClientIPBelievesTheHeaderOnlyFromATrustedProxy(t *testing.T) {
	resolver := ClientIPResolver{Header: "CF-Connecting-IP", TrustedProxies: ParseTrustedProxies("127.0.0.1, ::1, not-an-ip")}

	if got := resolver.ClientIP(requestFrom("127.0.0.1:51234", "203.0.113.9")); got != "203.0.113.9" {
		t.Errorf("via Caddy: got %q, want the forwarded address", got)
	}
	if got := resolver.ClientIP(requestFrom("[::1]:51234", "203.0.113.9")); got != "203.0.113.9" {
		t.Errorf("via Caddy over IPv6: got %q", got)
	}
	if got := resolver.ClientIP(requestFrom("198.51.100.7:40000", "203.0.113.9")); got != "198.51.100.7" {
		t.Errorf("direct connection must not be able to choose its own address, got %q", got)
	}
	if got := resolver.ClientIP(requestFrom("127.0.0.1:51234", "garbage")); got != "127.0.0.1" {
		t.Errorf("an unparseable header falls back to the peer, got %q", got)
	}
}

func TestClientIPWithoutHeaderUsesThePeer(t *testing.T) {
	resolver := ClientIPResolver{}
	if got := resolver.ClientIP(requestFrom("192.168.1.20:5555", "203.0.113.9")); got != "192.168.1.20" {
		t.Errorf("got %q", got)
	}
}

func TestRateLimitedAnswers429WithRetryAfter(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/", rateLimited(ClientIPResolver{}, 2, time.Minute), func(c *gin.Context) { c.Status(http.StatusNoContent) })

	for i := 0; i < 2; i++ {
		w := httptest.NewRecorder()
		r.ServeHTTP(w, requestFrom("10.0.0.1:1", ""))
		if w.Code != http.StatusNoContent {
			t.Fatalf("request %d: got %d", i+1, w.Code)
		}
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, requestFrom("10.0.0.1:1", ""))
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("3rd request: got %d, want 429", w.Code)
	}
	if w.Header().Get("Retry-After") == "" {
		t.Error("429 must carry Retry-After")
	}
	w = httptest.NewRecorder()
	r.ServeHTTP(w, requestFrom("10.0.0.2:1", ""))
	if w.Code != http.StatusNoContent {
		t.Errorf("another client must not be limited, got %d", w.Code)
	}
}
