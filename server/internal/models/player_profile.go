package models

import "time"

// PlayerProfile (DP-019) is what organizers see of a player who asked to
// join — deliberately only this: no email, towns, or anything else private.
type PlayerProfile struct {
	ID          string           `json:"id"`
	Username    string           `json:"username"`
	DisplayName *string          `json:"displayName,omitempty"`
	HasAvatar   bool             `json:"hasAvatar"`
	IsOnline    bool             `json:"isOnline"`
	JoinedAt    time.Time        `json:"joinedAt"`
	SkillLevels []UserSkillLevel `json:"skillLevels"`
}
