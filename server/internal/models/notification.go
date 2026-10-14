package models

import "time"

// Notification (DP-018) as its recipient reads it on the Notifications
// page. Its text is not stored: the client renders Type + Params in the
// reader's language. Path is the app address it opens.
type Notification struct {
	ID        string            `json:"id"`
	Type      string            `json:"type"`
	Params    map[string]string `json:"params"`
	Path      string            `json:"path"`
	CreatedAt time.Time         `json:"createdAt"`
	ReadAt    *time.Time        `json:"readAt,omitempty"`
}
