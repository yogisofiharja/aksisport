package models

import "time"

type SessionParticipant struct {
	ID           string     `json:"id"`
	SessionID    string     `json:"sessionId"`
	UserID       *string    `json:"userId,omitempty"`
	GuestName    *string    `json:"guestName,omitempty"`
	Username     *string    `json:"username,omitempty"`
	DisplayName  *string    `json:"displayName,omitempty"`
	Status       string     `json:"status"`
	CheckedInAt  *time.Time `json:"checkedInAt,omitempty"`
	CheckedOutAt *time.Time `json:"checkedOutAt,omitempty"`
	JoinedAt     time.Time  `json:"joinedAt"`
}
