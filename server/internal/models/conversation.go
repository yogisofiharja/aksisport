package models

import "time"

// Conversation is the unified messaging engine shared by DP-011 Session
// Chat and DP-013 Contact Organizer — the only real differences between
// the two are who the participants are and whether a posting window
// applies, so both ride this same container, distinguished by Kind.
// Participants are never stored on this row; they're resolved from
// context at request time (requireSessionAccess + isOwnerOrAdmin).
type Conversation struct {
	ID           string
	Kind         string // "session_chat" | "session_contact"
	SessionID    string
	MemberUserID *string // set only for "session_contact"
	CreatedAt    time.Time
}

const (
	ConversationKindSessionChat    = "session_chat"
	ConversationKindSessionContact = "session_contact"
)

// ConversationMessage is one message — the same shape regardless of Kind.
// SenderUsername/SenderDisplayName are denormalized from a join at read
// time. HasImage is computed (image_data IS NOT NULL); the bytes
// themselves are only ever served one at a time via GET .../image, so
// polling a conversation never re-transfers images already on screen.
type ConversationMessage struct {
	ID                string    `json:"id"`
	SessionID         string    `json:"sessionId"`
	SenderID          string    `json:"senderId"`
	SenderUsername    string    `json:"senderUsername"`
	SenderDisplayName *string   `json:"senderDisplayName,omitempty"`
	Body              string    `json:"body"`
	HasImage          bool      `json:"hasImage"`
	CreatedAt         time.Time `json:"createdAt"`
}

// ConversationMessageImage is the byte-serving shape — fetched by
// message id, never listed.
type ConversationMessageImage struct {
	Data        []byte
	ContentType string
}

// SessionContactThread is one row in a Contact Organizer thread listing —
// the organizer's per-Session view, or the cross-Session Inbox — never
// full message history, only the most recent message as a preview.
// NeedsReply is computed relative to whoever asked for the listing: true
// when the last message was sent by "the other side" of this thread.
type SessionContactThread struct {
	SessionID           string    `json:"sessionId"`
	SessionName         *string   `json:"sessionName,omitempty"`
	ClubID              string    `json:"clubId"`
	ClubName            string    `json:"clubName"`
	MemberUserID        string    `json:"memberUserId"`
	MemberUsername      string    `json:"memberUsername"`
	MemberDisplayName   *string   `json:"memberDisplayName,omitempty"`
	LastMessageBody     string    `json:"lastMessageBody"`
	LastMessageSenderID string    `json:"lastMessageSenderId"`
	LastMessageAt       time.Time `json:"lastMessageAt"`
	NeedsReply          bool      `json:"needsReply"`
}
