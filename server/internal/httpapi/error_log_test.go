package httpapi

import (
	"bytes"
	"errors"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

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
