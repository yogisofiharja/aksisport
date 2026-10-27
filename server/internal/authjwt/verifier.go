package authjwt

import (
	"context"
	"fmt"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/golang-jwt/jwt/v5"
)

const firebaseJWKSURL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"

// Verifier verifies Firebase Auth ID tokens (standard RS256 JWTs) directly
// against Google's published JWKS, without pulling in the Firebase Admin SDK.
type Verifier struct {
	kf        keyfunc.Keyfunc
	projectID string
	// static maps fixed tokens to Firebase UIDs, for tests only
	// (NewStaticVerifier); nil in a real Verifier.
	static map[string]string
}

// NewStaticVerifier accepts exactly the given tokens, each standing for a
// Firebase UID. For tests that drive the HTTP routes as different users;
// never used by the server itself.
func NewStaticVerifier(tokens map[string]string) *Verifier {
	return &Verifier{static: tokens}
}

func NewVerifier(ctx context.Context, projectID string) (*Verifier, error) {
	kf, err := keyfunc.NewDefaultCtx(ctx, []string{firebaseJWKSURL})
	if err != nil {
		return nil, fmt.Errorf("keyfunc.NewDefaultCtx: %w", err)
	}
	return &Verifier{kf: kf, projectID: projectID}, nil
}

// VerifyIDToken validates a Firebase ID token and returns the Firebase UID
// (the token's `sub` claim) on success.
func (v *Verifier) VerifyIDToken(tokenString string) (string, error) {
	if v.static != nil {
		if uid, ok := v.static[tokenString]; ok {
			return uid, nil
		}
		return "", fmt.Errorf("unknown token")
	}
	claims := jwt.RegisteredClaims{}
	token, err := jwt.ParseWithClaims(
		tokenString,
		&claims,
		v.kf.Keyfunc,
		jwt.WithValidMethods([]string{"RS256"}),
		jwt.WithIssuer("https://securetoken.google.com/"+v.projectID),
		jwt.WithAudience(v.projectID),
		jwt.WithExpirationRequired(),
	)
	if err != nil {
		return "", fmt.Errorf("parse token: %w", err)
	}
	if !token.Valid {
		return "", fmt.Errorf("invalid token")
	}
	if claims.Subject == "" {
		return "", fmt.Errorf("token missing sub claim")
	}
	return claims.Subject, nil
}
