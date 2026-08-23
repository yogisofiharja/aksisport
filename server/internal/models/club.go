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

// ClubBankAccount (Milestone 5, Session Finance) — a Club can list more
// than one (e.g. a BCA and a Mandiri account), set by the owner, shown on
// every priced Session's Payment tab so members know where to send money.
// Plain display fields, no payment processor integration.
type ClubBankAccount struct {
	ID            string    `json:"id"`
	ClubID        string    `json:"clubId"`
	BankName      string    `json:"bankName"`
	AccountNumber string    `json:"accountNumber"`
	AccountName   string    `json:"accountName"`
	CreatedAt     time.Time `json:"createdAt"`
}

// ClubWithRole is a Club plus the requesting user's role in it — the shape
// returned by "list my clubs".
type ClubWithRole struct {
	Club
	Role string `json:"role"`
}
