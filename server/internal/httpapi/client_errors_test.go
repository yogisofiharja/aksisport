package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/yogisofiharja/aksi-server/internal/alert"
)

func TestClientErrorReport(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rec := &alertRecorder{}
	alert.SetReporter(rec)
	t.Cleanup(func() { alert.SetReporter(nil) })

	r := gin.New()
	RegisterClientErrorRoutes(r.Group("/v1"), nil, nil, ClientIPResolver{})
	post := func(body string) int {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/v1/client-errors", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		r.ServeHTTP(w, req)
		return w.Code
	}

	if code := post(`{"kind":"render","message":"Cannot read properties of undefined (reading 'name')\nmore","stack":"at PlayersTab","platform":"web","appVersion":"1.0.0","screen":"SessionDetail"}`); code != http.StatusNoContent {
		t.Fatalf("report answered %d", code)
	}
	if len(rec.texts) != 1 {
		t.Fatalf("alerts %q", rec.texts)
	}
	text := rec.texts[0]
	for _, want := range []string{"APP CRASH (render, web 1.0.0)", "user: signed out", "screen: SessionDetail", "reading 'name'", "at PlayersTab"} {
		if !strings.Contains(text, want) {
			t.Fatalf("alert %q missing %q", text, want)
		}
	}
	if rec.keys[0] != "client render Cannot read properties of undefined (reading 'name')" {
		t.Fatalf("key %q", rec.keys[0])
	}

	if code := post(`{"message":"  "}`); code != http.StatusBadRequest {
		t.Fatalf("empty message answered %d", code)
	}

	// Oversized fields are cut; newlines can't forge extra header lines.
	post(`{"message":"` + strings.Repeat("x", 5000) + `","stack":"` + strings.Repeat("y", 9000) + `","screen":"A\nuser: @admin"}`)
	last := rec.texts[len(rec.texts)-1]
	if len(last) > 4000 {
		t.Fatalf("alert length %d", len(last))
	}
	if strings.Contains(last, "\nuser: @admin") {
		t.Fatal("screen field injected a line")
	}

	// Rate limited per address: 10 a minute.
	codes := map[int]int{}
	for i := 0; i < 12; i++ {
		codes[post(`{"message":"spam"}`)]++
	}
	if codes[http.StatusTooManyRequests] == 0 {
		t.Fatalf("no rate limit: %v", codes)
	}
}
