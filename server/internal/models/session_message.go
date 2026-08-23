package models

import "time"

// SessionMessage is DP-011 Session Chat's shape — plain text, an optional
// single image, no editing/deleting. Username/DisplayName are denormalized
// from a join at read time (same convention as ActivityParticipant), not
// stored on the row itself.
//
// The image itself (ImageData, raw bytes) is deliberately never part of
// this struct's JSON — HasImage is a bool computed by the list/create
// queries (`image_data IS NOT NULL`), and the actual bytes are only ever
// served one at a time via GET .../messages/:messageId/image. Embedding
// bytes here would mean every 5-second chat poll re-transfers every
// image in the conversation.
type SessionMessage struct {
	ID          string    `json:"id"`
	SessionID   string    `json:"sessionId"`
	UserID      string    `json:"userId"`
	Username    string    `json:"username"`
	DisplayName *string   `json:"displayName,omitempty"`
	Body        string    `json:"body"`
	HasImage    bool      `json:"hasImage"`
	CreatedAt   time.Time `json:"createdAt"`
}

// SessionMessageImage is the byte-serving shape — fetched by id, never
// listed. ContentType is one of a fixed whitelist (see
// validateImageContentType in httpapi), validated at write time.
type SessionMessageImage struct {
	Data        []byte
	ContentType string
}
