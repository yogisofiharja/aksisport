// Package firebaseadmin is the one place the server acts on Firebase Auth
// with admin rights: setting a new password for an account whose owner
// proved themselves with an emailed code (DP-015). Everything else in the
// server only *verifies* Firebase tokens and needs no credentials.
//
// It talks to the Identity Toolkit REST API directly with a service
// account, rather than pulling in the Firebase Admin SDK for one call.
package firebaseadmin

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type serviceAccount struct {
	ProjectID   string `json:"project_id"`
	ClientEmail string `json:"client_email"`
	PrivateKey  string `json:"private_key"`
	TokenURI    string `json:"token_uri"`
}

// PasswordSetter changes Firebase account passwords by Firebase UID.
type PasswordSetter struct {
	account serviceAccount
	client  *http.Client

	mu          sync.Mutex
	accessToken string
	expiresAt   time.Time
}

// NewPasswordSetterFromFile loads a service account key file (the JSON
// downloaded from Firebase console > Project settings > Service accounts).
func NewPasswordSetterFromFile(path string) (*PasswordSetter, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var sa serviceAccount
	if err := json.Unmarshal(raw, &sa); err != nil {
		return nil, fmt.Errorf("parsing service account file: %w", err)
	}
	if sa.ProjectID == "" || sa.ClientEmail == "" || sa.PrivateKey == "" {
		return nil, fmt.Errorf("service account file is missing project_id, client_email or private_key")
	}
	if sa.TokenURI == "" {
		sa.TokenURI = "https://oauth2.googleapis.com/token"
	}
	return &PasswordSetter{account: sa, client: &http.Client{Timeout: 15 * time.Second}}, nil
}

// token returns a cached OAuth access token, minting a new one (a signed
// JWT exchanged at Google's token endpoint) when the cached one is close
// to expiring.
func (p *PasswordSetter) token(ctx context.Context) (string, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.accessToken != "" && time.Until(p.expiresAt) > time.Minute {
		return p.accessToken, nil
	}

	key, err := jwt.ParseRSAPrivateKeyFromPEM([]byte(p.account.PrivateKey))
	if err != nil {
		return "", fmt.Errorf("parsing service account private key: %w", err)
	}
	now := time.Now()
	assertion, err := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
		"iss":   p.account.ClientEmail,
		"scope": "https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/cloud-platform",
		"aud":   p.account.TokenURI,
		"iat":   now.Unix(),
		"exp":   now.Add(time.Hour).Unix(),
	}).SignedString(key)
	if err != nil {
		return "", err
	}

	form := url.Values{
		"grant_type": {"urn:ietf:params:oauth:grant-type:jwt-bearer"},
		"assertion":  {assertion},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.account.TokenURI, strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := p.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<16))
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("token endpoint returned %d: %s", resp.StatusCode, body)
	}
	var parsed struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil || parsed.AccessToken == "" {
		return "", fmt.Errorf("unexpected token endpoint response")
	}
	p.accessToken = parsed.AccessToken
	p.expiresAt = now.Add(time.Duration(parsed.ExpiresIn) * time.Second)
	return p.accessToken, nil
}

// SetPassword replaces the password of the Firebase account with this UID.
func (p *PasswordSetter) SetPassword(ctx context.Context, firebaseUID, newPassword string) error {
	token, err := p.token(ctx)
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
