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
	// ReceiptVersion changes with every upload — clients add it to the
	// receipt URL (?v=) so a replaced receipt never shows a cached copy.
	ReceiptVersion *int64 `json:"receiptVersion,omitempty"`
	// LateCancel (DP-029): left a confirmed spot within 3 hours of the
	// start. Only meaningful while Status is 'cancelled'.
	LateCancel bool `json:"lateCancel,omitempty"`
	// AttendanceCorrected: an organizer changed attended / no-show after
	// the Session ended.
	AttendanceCorrected bool `json:"attendanceCorrected,omitempty"`
	// Paid (DP-032): an organizer confirmed this player's payment. Kept
	// apart from Status, since some players get their place first and pay
	// after. Only meaningful on a priced Session, for a player with an
	// account.
	Paid bool `json:"paid"`
}

// ParticipantReceiptImage is the byte-serving shape for a payment
// receipt — fetched by participant id, never listed.
type ParticipantReceiptImage struct {
	Data        []byte
	ContentType string
}

// UnpaidSession is one of Home's "You haven't paid" reminders (DP-032).
// HasReceipt: they sent a receipt and are waiting for an organizer.
type UnpaidSession struct {
	SessionID   string    `json:"sessionId"`
	ClubID      string    `json:"clubId"`
	ClubName    string    `json:"clubName"`
	SessionName *string   `json:"sessionName,omitempty"`
	StartsAt    time.Time `json:"startsAt"`
	HasReceipt  bool      `json:"hasReceipt"`
	Amount      *int      `json:"amount,omitempty"`
}
