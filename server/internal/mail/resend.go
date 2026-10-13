package mail

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const resendEndpoint = "https://api.resend.com/emails"

// ResendFallbackFrom is Resend's shared test sender. It needs no domain
// setup, but Resend only delivers from it to the address that owns the
// Resend account — enough to try the flow, useless for real users. Set
// MAIL_FROM to an address on a domain verified in Resend for anything
// else.
const ResendFallbackFrom = "Aksi <onboarding@resend.dev>"

// ResendMailer sends through Resend's HTTP API (https://resend.com) —
// one POST per message, no SDK.
type ResendMailer struct {
	apiKey   string
	from     string
	endpoint string
	client   *http.Client
}

func NewResendMailer(apiKey, from string) *ResendMailer {
	if from == "" {
		from = ResendFallbackFrom
	}
	return &ResendMailer{
		apiKey:   apiKey,
		from:     from,
		endpoint: resendEndpoint,
		client:   &http.Client{Timeout: 15 * time.Second},
	}
}

func (m *ResendMailer) Send(ctx context.Context, msg Message) error {
	payload, err := json.Marshal(map[string]any{
		"from":    m.from,
		"to":      []string{msg.To},
		"subject": msg.Subject,
		"text":    msg.Body,
	})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, m.endpoint, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+m.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := m.client.Do(req)
	if err != nil {
		return fmt.Errorf("resend: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		// Resend's error body says why (unverified domain, bad key,
		// recipient not allowed on the test sender) — worth having in the
		// log. It never contains the API key.
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("resend: status %d: %s", resp.StatusCode, bytes.TrimSpace(body))
	}
	return nil
}
