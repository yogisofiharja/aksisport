package firebaseadmin

import (
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

// serviceClient holds a service account and its OAuth access tokens, one
// per scope.
type serviceClient struct {
	account serviceAccount
	client  *http.Client

	mu     sync.Mutex
	tokens map[string]cachedToken
}

type cachedToken struct {
	value     string
	expiresAt time.Time
}

func newServiceClientFromFile(path string) (*serviceClient, error) {
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
	return &serviceClient{account: sa, client: &http.Client{Timeout: 15 * time.Second}, tokens: map[string]cachedToken{}}, nil
}

// token returns a cached OAuth access token, minting a new one (a signed
// JWT exchanged at Google's token endpoint) when the cached one is close
// to expiring.
func (p *serviceClient) token(ctx context.Context, scope string) (string, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if t := p.tokens[scope]; t.value != "" && time.Until(t.expiresAt) > time.Minute {
		return t.value, nil
	}

	key, err := jwt.ParseRSAPrivateKeyFromPEM([]byte(p.account.PrivateKey))
	if err != nil {
		return "", fmt.Errorf("parsing service account private key: %w", err)
	}
	now := time.Now()
	assertion, err := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
		"iss":   p.account.ClientEmail,
		"scope": scope,
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
	p.tokens[scope] = cachedToken{value: parsed.AccessToken, expiresAt: now.Add(time.Duration(parsed.ExpiresIn) * time.Second)}
	return parsed.AccessToken, nil
}
