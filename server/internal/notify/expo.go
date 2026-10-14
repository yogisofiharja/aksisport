package notify

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const expoPushEndpoint = "https://exp.host/--/api/v2/push/send"

// ExpoPush delivers to the iOS and Android apps through Expo's push
// service, which forwards to Apple and Google. Devices register an Expo
// push token from expo-notifications.
type ExpoPush struct {
	endpoint string
	// accessToken is optional — only needed if the Expo project enables
	// "enhanced push security".
	accessToken string
	client      *http.Client
}

func NewExpoPush(accessToken string) *ExpoPush {
	return &ExpoPush{endpoint: expoPushEndpoint, accessToken: accessToken, client: &http.Client{Timeout: 15 * time.Second}}
}

type expoMessage struct {
	To    string            `json:"to"`
	Title string            `json:"title"`
	Body  string            `json:"body"`
	Sound string            `json:"sound,omitempty"`
	Data  map[string]string `json:"data,omitempty"`
}

// Send pushes a batch (Expo accepts up to 100 per request). It returns the
// indexes of messages whose device is no longer registered, so the caller
// can forget those tokens.
func (e *ExpoPush) Send(ctx context.Context, messages []expoMessage) (gone []int, err error) {
	for start := 0; start < len(messages); start += 100 {
		end := start + 100
		if end > len(messages) {
			end = len(messages)
		}
		batchGone, err := e.sendBatch(ctx, messages[start:end])
		for _, i := range batchGone {
			gone = append(gone, start+i)
		}
		if err != nil {
			return gone, err
		}
	}
	return gone, nil
}

func (e *ExpoPush) sendBatch(ctx context.Context, messages []expoMessage) ([]int, error) {
	payload, err := json.Marshal(messages)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, e.endpoint, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	if e.accessToken != "" {
		req.Header.Set("Authorization", "Bearer "+e.accessToken)
	}
	resp, err := e.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("expo push returned %d: %s", resp.StatusCode, bytes.TrimSpace(body))
	}
	var parsed struct {
		Data []struct {
			Status  string `json:"status"`
			Details struct {
				Error string `json:"error"`
			} `json:"details"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, fmt.Errorf("unexpected expo push response: %w", err)
	}
	var gone []int
	for i, ticket := range parsed.Data {
		if ticket.Status == "error" && ticket.Details.Error == "DeviceNotRegistered" {
			gone = append(gone, i)
		}
	}
	return gone, nil
}
