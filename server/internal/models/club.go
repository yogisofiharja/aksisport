package models

import "time"

type Club struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description *string   `json:"description,omitempty"`
	InviteCode  string    `json:"inviteCode"`
	CreatedBy   string    `json:"createdBy"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// ClubWithRole is a Club plus the requesting user's role in it — the shape
// returned by "list my clubs".
type ClubWithRole struct {
	Club
	Role string `json:"role"`
}
