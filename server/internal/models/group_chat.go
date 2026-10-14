package models

import "time"

// DP-021 step 3.

const (
	// ConversationKindGroup: a named group of up to 50 players.
	ConversationKindGroup = "group"
	// ConversationKindClub: one chat for all of a Community's members.
	ConversationKindClub = "club"
)

type GroupMember struct {
	UserID      string  `json:"userId"`
	Username    string  `json:"username"`
	DisplayName *string `json:"displayName,omitempty"`
	HasAvatar   bool    `json:"hasAvatar"`
}

// GroupChat is a group with who is in it. CreatedBy manages it: rename,
// add and remove people.
type GroupChat struct {
	ID        string        `json:"id"`
	Title     string        `json:"title"`
	CreatedBy *string       `json:"createdBy,omitempty"`
	CreatedAt time.Time     `json:"createdAt"`
	Members   []GroupMember `json:"members"`
}

// GroupThread is one group in Inbox.
type GroupThread struct {
	ConversationID               string    `json:"conversationId"`
	Title                        string    `json:"title"`
	MemberCount                  int       `json:"memberCount"`
	LastMessageBody              string    `json:"lastMessageBody"`
	LastMessageHasImage          bool      `json:"lastMessageHasImage"`
	LastMessageDeleted           bool      `json:"lastMessageDeleted"`
	LastMessageSenderID          *string   `json:"lastMessageSenderId,omitempty"`
	LastMessageSenderUsername    *string   `json:"lastMessageSenderUsername,omitempty"`
	LastMessageSenderDisplayName *string   `json:"lastMessageSenderDisplayName,omitempty"`
	LastActivityAt               time.Time `json:"lastActivityAt"`
	UnreadCount                  int       `json:"unreadCount"`
}

// UserSummaryLite is a person to pick when starting a conversation.
type UserSummaryLite struct {
	UserID      string  `json:"userId"`
	Username    string  `json:"username"`
	DisplayName *string `json:"displayName,omitempty"`
	HasAvatar   bool    `json:"hasAvatar"`
}
