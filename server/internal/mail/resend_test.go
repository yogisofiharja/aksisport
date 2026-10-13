package mail

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestResendMailerSendsExpectedRequest(t *testing.T) {
	var gotAuth, gotContentType string
	var gotBody map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		gotContentType = r.Header.Get("Content-Type")
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"id":"abc"}`))
	}))
	defer srv.Close()

	m := NewResendMailer("test-key", "Aksi <no-reply@example.com>")
	m.endpoint = srv.URL
	if err := m.Send(context.Background(), VerificationMessage("player@example.com", "123456")); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if gotAuth != "Bearer test-key" {
		t.Errorf("Authorization: got %q", gotAuth)
	}
	if gotContentType != "application/json" {
		t.Errorf("Content-Type: got %q", gotContentType)
	}
	if gotBody["from"] != "Aksi <no-reply@example.com>" {
		t.Errorf("from: got %v", gotBody["from"])
	}
	to, _ := gotBody["to"].([]any)
	if len(to) != 1 || to[0] != "player@example.com" {
		t.Errorf("to: got %v", gotBody["to"])
	}
	if subject, _ := gotBody["subject"].(string); !strings.Contains(subject, "123456") {
		t.Errorf("subject should carry the code, got %q", subject)
	}
	if text, _ := gotBody["text"].(string); !strings.Contains(text, "123456") {
		t.Errorf("text should carry the code, got %q", text)
	}
}

func TestResendMailerReportsProviderErrorWithoutTheKey(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		_, _ = w.Write([]byte(`{"message":"The example.com domain is not verified."}`))
	}))
	defer srv.Close()

	m := NewResendMailer("secret-key", "")
	m.endpoint = srv.URL
	err := m.Send(context.Background(), Message{To: "a@b.co", Subject: "s", Body: "b"})
	if err == nil {
		t.Fatal("expected an error for a 403 response")
	}
	if !strings.Contains(err.Error(), "403") || !strings.Contains(err.Error(), "not verified") {
		t.Errorf("error should include status and provider message, got %q", err)
	}
	if strings.Contains(err.Error(), "secret-key") {
		t.Error("error must not contain the API key")
	}
}

func TestResendMailerFallsBackToTestSender(t *testing.T) {
	if got := NewResendMailer("k", "").from; got != ResendFallbackFrom {
		t.Errorf("from: got %q", got)
	}
}
