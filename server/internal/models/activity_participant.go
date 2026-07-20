package models

type ActivityParticipant struct {
	ID          string  `json:"id"`
	ActivityID  string  `json:"activityId"`
	UserID      *string `json:"userId,omitempty"`
	GuestName   *string `json:"guestName,omitempty"`
	Username    *string `json:"username,omitempty"`
	DisplayName *string `json:"displayName,omitempty"`
	Team        *string `json:"team,omitempty"`
	SlotOrder   int     `json:"slotOrder"`
}
