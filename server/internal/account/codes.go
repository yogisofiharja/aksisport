// Package account holds the pure rules behind DP-015 (Account Email &
// Password Recovery): what a valid email looks like, how confirmation
// codes are generated and hashed, and the limits on using them. No I/O —
// storage lives in internal/db, sending in internal/mail.
package account

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math/big"
	"regexp"
	"strings"
	"time"
)

const (
	PurposeVerifyEmail   = "verify_email"
	PurposeResetPassword = "reset_password"

	CodeTTL = 15 * time.Minute
	// MaxAttempts wrong guesses lock a code; with 10^6 possibilities that
	// caps a guesser at a 1-in-200,000 chance per code.
	MaxAttempts = 5
	// ResendCooldown is the minimum gap between two codes for the same
	// user and purpose.
	ResendCooldown = time.Minute

	MinPasswordLength = 6

	// MaxDisplayNameLength (DP-016), counted in characters, not bytes.
	MaxDisplayNameLength = 40

	// SyntheticEmailDomain mirrors src/core/auth/firebaseAuth.ts: every
	// account's Firebase identity is "<username>@" + this, never the
	// User's real email.
	SyntheticEmailDomain = "accounts.aksi.app"
)

// Deliberately loose: one "@", something on both sides, a dot in the
// domain, no spaces. The emailed code is the real proof an address works.
var emailPattern = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

// NormalizeEmail trims and lowercases, so the same address typed two ways
// is one address everywhere (uniqueness, lookup, login).
func NormalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func ValidEmail(email string) bool {
	return len(email) <= 254 && emailPattern.MatchString(email)
}

// GenerateCode returns a uniformly random 6-digit code, zero-padded.
func GenerateCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

// HashCode is what gets stored instead of the code. Bound to the user and
// purpose so a stored hash is useless for any other account or flow.
func HashCode(userID, purpose, code string) string {
	sum := sha256.Sum256([]byte(userID + ":" + purpose + ":" + strings.TrimSpace(code)))
	return hex.EncodeToString(sum[:])
}

// LoginEmailForUsername is the Firebase sign-in identity for a username.
func LoginEmailForUsername(username string) string {
	return strings.ToLower(username) + "@" + SyntheticEmailDomain
}

// DecoyLoginEmail is returned for an email no account has confirmed: a
// well-formed sign-in identity that cannot exist (real usernames are at
// most 20 characters), derived from the input so the same email always
// gets the same answer. Signing in with it fails exactly like a wrong
// password, so the lookup never reveals whether an email is registered.
func DecoyLoginEmail(email string) string {
	sum := sha256.Sum256([]byte("decoy:" + email))
	return "x" + hex.EncodeToString(sum[:])[:31] + "@" + SyntheticEmailDomain
}
