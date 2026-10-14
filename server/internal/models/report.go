package models

import "time"

// BlockedUser is one row of the caller's blocked list (DP-021).
type BlockedUser struct {
	UserID      string    `json:"userId"`
	Username    string    `json:"username"`
	DisplayName *string   `json:"displayName,omitempty"`
	HasAvatar   bool      `json:"hasAvatar"`
	BlockedAt   time.Time `json:"blockedAt"`
}

// ClubReport is a report as a Community's owner/admins see it (DP-021).
type ClubReport struct {
	ID                  string         `json:"id"`
	ReporterID          string         `json:"reporterId"`
	ReporterUsername    string         `json:"reporterUsername"`
	ReporterDisplayName *string        `json:"reporterDisplayName,omitempty"`
	ReportedUserID      string         `json:"reportedUserId"`
	ReportedUsername    string         `json:"reportedUsername"`
	ReportedDisplayName *string        `json:"reportedDisplayName,omitempty"`
	Reason              string         `json:"reason"`
	CreatedAt           time.Time      `json:"createdAt"`
	Message             *ReportMessage `json:"message,omitempty"`
}

// ReportMessage is the reported message as it was when reported.
type ReportMessage struct {
	ID               *string `json:"id,omitempty"`
	Body             string  `json:"body"`
	HasImage         bool    `json:"hasImage"`
	ConversationKind string  `json:"conversationKind"`
	SessionID        *string `json:"sessionId,omitempty"`
	SessionName      *string `json:"sessionName,omitempty"`
	Removed          bool    `json:"removed"`
	// This Community's organizers may remove it: it was posted in one of
	// this Community's Session conversations, and is still there.
	CanRemove bool `json:"canRemove"`
}
