package models

import "time"

// SkillLevel is one rung of a Sport's Level Scale (DP-008). Owned by the
// Sport Module (DP-ARCH-002) — scoped per Sport, not shared globally.
// Data, not a fixed enum: renaming/reordering/extending a sport's scale is
// a row change here, never a schema migration.
type SkillLevel struct {
	ID        string    `json:"id"`
	Sport     string    `json:"sport"`
	Slug      string    `json:"slug"`
	Name      string    `json:"name"`
	Rank      int       `json:"rank"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// UserSkillLevel is a player's self-reported level for one Sport — exactly
// one per (user, sport). Skill*/Slug/Name/Rank are denormalized via JOIN
// on read, same pattern ClubMember uses for user display fields, so the
// client never needs a second lookup to render "Tennis: Intermediate".
type UserSkillLevel struct {
	UserID         string    `json:"userId"`
	Sport          string    `json:"sport"`
	SkillLevelID   string    `json:"skillLevelId"`
	SkillLevelSlug string    `json:"skillLevelSlug"`
	SkillLevelName string    `json:"skillLevelName"`
	SkillLevelRank int       `json:"skillLevelRank"`
	UpdatedAt      time.Time `json:"updatedAt"`
}
