package httpapi

import (
	"bytes"
	"errors"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/yogisofiharja/aksi-server/internal/alert"
)

type alertRecorder struct{ keys, texts []string }

func (r *alertRecorder) Report(key, text string) {
	r.keys = append(r.keys, key)
	r.texts = append(r.texts, text)
}

func TestServerErrorsAreAlerted(t *testing.T) {
	gin.SetMode(gin.TestMode)
	log.SetOutput(io.Discard)
	gin.DefaultErrorWriter = io.Discard
	t.Cleanup(func() { log.SetOutput(os.Stderr); gin.DefaultErrorWriter = os.Stderr })
	rec := &alertRecorder{}
	alert.SetReporter(rec)
	t.Cleanup(func() { alert.SetReporter(nil) })

	r := gin.New()
	r.Use(recoveryMiddleware(), errorLogMiddleware())
	r.GET("/things/:id", func(c *gin.Context) { respondInternal(c, errors.New("db exploded")) })
	r.GET("/panic", func(c *gin.Context) { panic("nil map") })
	r.GET("/fine", func(c *gin.Context) { respondError(c, http.StatusNotFound, "nope") })

	r.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/things/1?token=secret", nil))
	r.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/things/2", nil))
	r.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/fine", nil))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/panic", nil))
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("panic answered %d", w.Code)
	}

	if len(rec.keys) != 3 {
		t.Fatalf("alerts %q, want two 500s and one panic (no 4xx)", rec.texts)
	}
	if rec.keys[0] != rec.keys[1] || rec.keys[0] != "http 500 GET /things/:id" {
		t.Fatalf("500s on one route should share a key: %q", rec.keys)
	}
	if !strings.Contains(rec.texts[0], "db exploded") || strings.Contains(rec.texts[0], "secret") {
		t.Fatalf("500 alert %q", rec.texts[0])
	}
	if !strings.HasPrefix(rec.texts[2], "PANIC GET /panic") || !strings.Contains(rec.texts[2], "nil map") || !strings.Contains(rec.texts[2], "goroutine") {
		t.Fatalf("panic alert %q", rec.texts[2])
	}
}

func TestErrorLogMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)
	var buf bytes.Buffer
	log.SetOutput(&buf)
	t.Cleanup(func() { log.SetOutput(os.Stderr) })

	r := gin.New()
	r.Use(errorLogMiddleware())
	r.GET("/things/:id", func(c *gin.Context) {
		respondInternal(c, errors.New("db exploded"))
	})
	r.GET("/fine", func(c *gin.Context) {
		respondError(c, http.StatusNotFound, "nope")
	})

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/things/42?token=secret", nil))
	if w.Code != http.StatusInternalServerError || !strings.Contains(w.Body.String(), `"internal error"`) {
		t.Fatalf("response %d %s, want 500 internal error", w.Code, w.Body.String())
	}
	if strings.Contains(w.Body.String(), "db exploded") {
		t.Fatal("the cause must not reach the client")
	}
	got := buf.String()
	for _, want := range []string{"ERROR 500 GET /things/:id", "user=-", "db exploded"} {
		if !strings.Contains(got, want) {
			t.Fatalf("log %q missing %q", got, want)
		}
	}
	if strings.Contains(got, "secret") {
		t.Fatal("query strings must not be logged")
	}

	buf.Reset()
	r.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/fine", nil))
	if buf.Len() != 0 {
		t.Fatalf("4xx should not be logged, got %q", buf.String())
	}
}
