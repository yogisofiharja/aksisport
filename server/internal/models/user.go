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
