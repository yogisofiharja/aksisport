// Package firebaseadmin is where the server acts on Firebase with admin
// rights, through a service account: setting a new password for an account
// whose owner proved themselves with an emailed code (DP-015), and moving a
// live match's copy in the Realtime Database to a new umpire (DP-023).
// Everything else in the server only *verifies* Firebase tokens.
//
// It talks to Google's REST APIs directly rather than pulling in the
// Firebase Admin SDK for a couple of calls.
package firebaseadmin

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
)

// PasswordSetter changes Firebase account passwords by Firebase UID.
type PasswordSetter struct {
	*serviceClient
}

// NewPasswordSetterFromFile loads a service account key file (the JSON
// downloaded from Firebase console > Project settings > Service accounts).
func NewPasswordSetterFromFile(path string) (*PasswordSetter, error) {
	c, err := newServiceClientFromFile(path)
	if err != nil {
		return nil, err
	}
	return &PasswordSetter{c}, nil
}

const identityScope = "https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/cloud-platform"

// SetPassword replaces the password of the Firebase account with this UID.
func (p *PasswordSetter) SetPassword(ctx context.Context, firebaseUID, newPassword string) error {
	token, err := p.token(ctx, identityScope)
	if err != nil {
		return err
	}
	payload, _ := json.Marshal(map[string]string{"localId": firebaseUID, "password": newPassword})
	endpoint := fmt.Sprintf("https://identitytoolkit.googleapis.com/v1/projects/%s/accounts:update", url.PathEscape(p.account.ProjectID))
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	resp, err := p.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<16))
		return fmt.Errorf("identity toolkit returned %d: %s", resp.StatusCode, body)
	}
	return nil
}
