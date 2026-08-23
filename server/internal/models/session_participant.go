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
	// HasReceipt (Milestone 5) is a bool computed by the read queries
	// (receipt_image_data IS NOT NULL) — the image bytes themselves are
	// never part of this struct's JSON, only ever fetched one at a time
	// via GET .../participants/:id/receipt, and only by the uploading
	// participant or an owner/admin (narrower than every other read in
	// this domain, which any club member can see).
	HasReceipt bool `json:"hasReceipt"`
}

// ParticipantReceiptImage is the byte-serving shape for a payment
// receipt — fetched by participant id, never listed.
type ParticipantReceiptImage struct {
	Data        []byte
	ContentType string
}
