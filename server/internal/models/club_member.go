package models

import "time"

type ClubMember struct {
	ClubID        string    `json:"clubId"`
	UserID        string    `json:"userId"`
	Username      string    `json:"username"`
	DisplayName   *string   `json:"displayName,omitempty"`
	AvatarURL     *string   `json:"avatarUrl,omitempty"`
	HasAvatar     bool      `json:"hasAvatar"`
	AvatarVersion *int64    `json:"avatarVersion,omitempty"`
	IsOnline      bool      `json:"isOnline"`
	Role          string    `json:"role"`
	// Reguler (DP-032): the built-in tag — joins Sessions without
	// approval, and pays after playing when the Community allows it.
	Reguler bool `json:"reguler"`
	JoinedAt      time.Time `json:"joinedAt"`
}
