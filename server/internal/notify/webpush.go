package notify

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"time"

	webpush "github.com/SherClockHolmes/webpush-go"
)

// WebPush delivers to browsers with the standard Web Push protocol. No
// outside account is involved: messages are signed with the server's own
// VAPID key pair (kept in server_keys) and sent to whatever push service
// the browser's subscription endpoint names.
type WebPush struct {
	publicKey  string
	privateKey string
	// subject identifies the sender to push services: a mailto: or https:
	// URL they can contact about abuse.
	subject string
	client  *http.Client
}

func NewWebPush(publicKey, privateKey, subject string) *WebPush {
	return &WebPush{publicKey: publicKey, privateKey: privateKey, subject: subject, client: &http.Client{Timeout: 15 * time.Second}}
}

// GenerateVAPIDKeys makes a new key pair (public, private).
func GenerateVAPIDKeys() (string, string, error) {
	private, public, err := webpush.GenerateVAPIDKeys()
	return public, private, err
}

func (w *WebPush) PublicKey() string { return w.publicKey }

// Send pushes one encrypted message. gone reports that the subscription no
// longer exists (404/410) and should be forgotten.
func (w *WebPush) Send(ctx context.Context, endpoint, p256dh, auth string, payload []byte) (gone bool, err error) {
	resp, err := webpush.SendNotificationWithContext(ctx, payload, &webpush.Subscription{
		Endpoint: endpoint,
		Keys:     webpush.Keys{P256dh: p256dh, Auth: auth},
	}, &webpush.Options{
		HTTPClient:      w.client,
		Subscriber:      w.subject,
		VAPIDPublicKey:  w.publicKey,
		VAPIDPrivateKey: w.privateKey,
		TTL:             24 * 60 * 60,
		Urgency:         webpush.UrgencyNormal,
	})
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()
	switch {
	case resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusGone:
		return true, nil
	case resp.StatusCode >= 300:
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return false, fmt.Errorf("push service returned %d: %s", resp.StatusCode, bytes.TrimSpace(body))
	}
	return false, nil
}
