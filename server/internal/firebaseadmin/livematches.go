package firebaseadmin

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

// LiveMatches edits the live copies of matches in the Realtime Database
// (sessions/<activityId>, see src/sessionSync.ts). Its security rules let
// only the copy's scorerUid write to it; the admin token here bypasses
// them, so the rules stay as they are.
type LiveMatches struct {
	*serviceClient
	databaseURL string
}

const databaseScope = "https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email"

// NewLiveMatchesFromFile uses a service account key file and the
// database's URL (e.g. https://<project>-default-rtdb.<region>.firebasedatabase.app).
func NewLiveMatchesFromFile(path, databaseURL string) (*LiveMatches, error) {
	if databaseURL == "" {
		return nil, fmt.Errorf("no database URL")
	}
	c, err := newServiceClientFromFile(path)
	if err != nil {
		return nil, err
	}
	return &LiveMatches{serviceClient: c, databaseURL: strings.TrimRight(databaseURL, "/")}, nil
}

// SetScorer makes firebaseUID the scorer of a match's live copy, so a new
// umpire's device can carry on writing to it (DP-023). A match with no
// live copy yet (nothing scored) is left alone: the new umpire's device
// creates it.
func (l *LiveMatches) SetScorer(ctx context.Context, activityID, firebaseUID string) error {
	token, err := l.token(ctx, databaseScope)
	if err != nil {
		return err
	}
	endpoint := fmt.Sprintf("%s/sessions/%s/scorerUid.json", l.databaseURL, url.PathEscape(activityID))

	var current *string
	if err := l.do(ctx, http.MethodGet, endpoint, token, nil, &current); err != nil {
		return err
	}
	if current == nil {
		return nil
	}
	payload, _ := json.Marshal(firebaseUID)
	return l.do(ctx, http.MethodPut, endpoint, token, payload, nil)
}

func (l *LiveMatches) do(ctx context.Context, method, endpoint, token string, payload []byte, into any) error {
	req, err := http.NewRequestWithContext(ctx, method, endpoint, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := l.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<16))
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("realtime database returned %d: %s", resp.StatusCode, body)
	}
	if into != nil {
		return json.Unmarshal(body, into)
	}
	return nil
}
