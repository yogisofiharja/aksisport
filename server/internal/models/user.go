package models

import "time"

type User struct {
	ID          string    `json:"id"`
	FirebaseUID string    `json:"-"`
	Username    string    `json:"username"`
	DisplayName *string   `json:"displayName,omitempty"`
	// Email is the User's *confirmed* address (DP-015) — only ever set by
	// a successful code verification. PendingEmail is an address still
	// awaiting its code. EmailRequired marks accounts created under
	// DP-015, which must confirm an email before using the app; older
	// accounts are only reminded. All three are private to the User:
	// this struct is only ever returned to its own owner.
	Email         *string `json:"email,omitempty"`
	PendingEmail  *string `json:"pendingEmail,omitempty"`
	EmailRequired bool    `json:"emailRequired"`
	PhoneNumber *string   `json:"phoneNumber,omitempty"`
	AvatarURL   *string   `json:"avatarUrl,omitempty"`
	// HasAvatar is computed (avatar_image_data IS NOT NULL), same pattern
	// as SessionParticipant.HasReceipt — the actual bytes are never
	// embedded here, only served through their own endpoint.
	HasAvatar bool `json:"hasAvatar"`
	// IsOnline is computed from last_active_at (see isOnlineExpr in
	// internal/db/users.go) — this app has no push/websocket presence, so
	// it's derived from recent request activity rather than a stored
	// boolean.
	IsOnline  bool      `json:"isOnline"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// UserSummary is the lean, public-safe shape returned by user search — a
// full User includes email/phoneNumber, which searching users shouldn't
// expose to whoever is searching.
type UserSummary struct {
	ID          string  `json:"id"`
	Username    string  `json:"username"`
	DisplayName *string `json:"displayName,omitempty"`
	HasAvatar   bool    `json:"hasAvatar"`
	IsOnline    bool    `json:"isOnline"`
}
