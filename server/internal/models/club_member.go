package models

import "time"

type ClubMember struct {
	ClubID      string    `json:"clubId"`
	UserID      string    `json:"userId"`
	Username    string    `json:"username"`
	DisplayName *string   `json:"displayName,omitempty"`
	AvatarURL   *string   `json:"avatarUrl,omitempty"`
	HasAvatar   bool      `json:"hasAvatar"`
	IsOnline    bool      `json:"isOnline"`
	Role        string    `json:"role"`
	JoinedAt    time.Time `json:"joinedAt"`
}
