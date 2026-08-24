package models

import "time"

type User struct {
	ID          string    `json:"id"`
	FirebaseUID string    `json:"-"`
	Username    string    `json:"username"`
	DisplayName *string   `json:"displayName,omitempty"`
	Email       *string   `json:"email,omitempty"`
	PhoneNumber *string   `json:"phoneNumber,omitempty"`
	AvatarURL   *string   `json:"avatarUrl,omitempty"`
	// HasAvatar is computed (avatar_image_data IS NOT NULL), same pattern
	// as SessionParticipant.HasReceipt — the actual bytes are never
	// embedded here, only served through their own endpoint.
	HasAvatar bool      `json:"hasAvatar"`
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
}
