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
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// UserSummary is the lean, public-safe shape returned by user search — a
// full User includes email/phoneNumber, which searching users shouldn't
// expose to whoever is searching.
type UserSummary struct {
	ID          string  `json:"id"`
	Username    string  `json:"username"`
	DisplayName *string `json:"displayName,omitempty"`
}
