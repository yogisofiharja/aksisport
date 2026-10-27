package models

import "time"

type Club struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
	// CityCode (DP-017) is the city or regency the Club is in, picked from
	// the reference list (internal/db/locations.go). CityName is its
	// display form, "Kota Bandung, Jawa Barat", resolved at read time. Both
	// nil only for Clubs created before a city was required.
	CityCode *string `json:"cityCode,omitempty"`
	CityName *string `json:"cityName,omitempty"`
	// Visibility (DP-017): "public" (anyone joins instantly) or "private"
	// (joining creates a request an owner/admin approves).
	Visibility string `json:"visibility"`
	InviteCode string `json:"inviteCode"`
	// HasAvatar is computed (avatar_image_data IS NOT NULL) — same pattern
	// as SessionParticipant.HasReceipt. Owner-only to set, visible to any
	// member.
	HasAvatar bool      `json:"hasAvatar"`
	CreatedBy string    `json:"createdBy"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
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

// ClubPreview (DP-017) is what anyone signed in may see of a Club they
// are not necessarily in — search results and the page behind a shared
// link. Deliberately not a Club: no invite code, nothing member-only.
// ViewerRole and ViewerRequestPending describe the *caller's* relation to
// it, so one response is enough to decide between "open", "join",
// "request" and "request pending".
type ClubPreview struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
	CityCode    *string `json:"cityCode,omitempty"`
	CityName    *string `json:"cityName,omitempty"`
	Visibility  string  `json:"visibility"`
	HasAvatar   bool    `json:"hasAvatar"`
	MemberCount int     `json:"memberCount"`
	// ViewerRole is the caller's role if they are a member, else nil.
	ViewerRole *string `json:"viewerRole,omitempty"`
	// ViewerRequestPending: the caller has asked to join and is waiting.
	ViewerRequestPending bool `json:"viewerRequestPending"`
	// Invite is the caller's invitation to this Community (DP-028), for a
	// non-member; set by GET /clubs/:clubId/preview only.
	Invite *ClubInvite `json:"invite,omitempty"`
}

// ClubInvite: who invited the viewer, their role there now (owner, admin,
// member, or "" if they left), and whether it lets the viewer straight in.
type ClubInvite struct {
	FromName   string `json:"fromName"`
	FromRole   string `json:"fromRole"`
	StraightIn bool   `json:"straightIn"`
}

// ClubJoinRequest is a pending request as an owner/admin sees it.
type ClubJoinRequest struct {
	ID          string    `json:"id"`
	ClubID      string    `json:"clubId"`
	UserID      string    `json:"userId"`
	Username    string    `json:"username"`
	DisplayName *string   `json:"displayName,omitempty"`
	HasAvatar   bool      `json:"hasAvatar"`
	CreatedAt   time.Time `json:"createdAt"`
}

// ClubWithRole is a Club plus the requesting user's role in it — the shape
// returned by "list my clubs".
type ClubWithRole struct {
	Club
	Role string `json:"role"`
}

// InviteLink is a shareable invite to a Community or Session (DP-028).
type InviteLink struct {
	Token      string     `json:"token"`
	TargetType string     `json:"targetType"`
	TargetID   string     `json:"targetId"`
	ClubID     string     `json:"clubId"`
	CreatedBy  string     `json:"createdBy"`
	CreatedAt  time.Time  `json:"createdAt"`
	RevokedAt  *time.Time `json:"revokedAt,omitempty"`
}

// Invitation: someone invited to a Community or Session, in the app or by
// opening a link (DP-028).
type Invitation struct {
	ID          string     `json:"id"`
	FromUserID  string     `json:"fromUserId"`
	FromName    string     `json:"fromName"`
	ToUserID    string     `json:"toUserId"`
	TargetType  string     `json:"targetType"`
	TargetID    string     `json:"targetId"`
	ClubID      string     `json:"clubId"`
	Via         string     `json:"via"`
	LinkToken   *string    `json:"-"`
	CreatedAt   time.Time  `json:"createdAt"`
	RespondedAt *time.Time `json:"respondedAt,omitempty"`
	Response    *string    `json:"response,omitempty"`
}

// InviteCandidate is a search result in Invite friends: State is "invite",
// "invited" (a pending in-app invite) or "in" (already a member / already
// playing).
type InviteCandidate struct {
	ID          string  `json:"id"`
	Username    string  `json:"username"`
	DisplayName *string `json:"displayName,omitempty"`
	HasAvatar   bool    `json:"hasAvatar"`
	State       string  `json:"state"`
}

// InvitationCard is one of Home's "Invited" cards.
type InvitationCard struct {
	ID              string     `json:"id"`
	FromUserID      string     `json:"fromUserId"`
	FromName        string     `json:"fromName"`
	TargetType      string     `json:"targetType"`
	TargetID        string     `json:"targetId"`
	ClubID          string     `json:"clubId"`
	ClubName        string     `json:"clubName"`
	CreatedAt       time.Time  `json:"createdAt"`
	SessionName     *string    `json:"sessionName,omitempty"`
	StartsAt        *time.Time `json:"startsAt,omitempty"`
	DurationMinutes *int       `json:"durationMinutes,omitempty"`
	Location        *string    `json:"location,omitempty"`
	PriceModel      string     `json:"priceModel,omitempty"`
	PricePerPerson  *int       `json:"pricePerPerson,omitempty"`
	TotalPrice      *int       `json:"totalPrice,omitempty"`
}
