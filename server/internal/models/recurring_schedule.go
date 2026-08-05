package models

import (
	"encoding/json"
	"time"
)

// RecurringSchedule generates Sessions on a recurrence pattern (DP-007).
// Its Template fields mirror DP-004's Organizer Preferences — sport, name,
// location, court count, max participants, default match format — and
// deliberately exclude a start time, since that's a core Session property
// produced per-occurrence from RecurrenceRule, not part of the Template.
type RecurringSchedule struct {
	ID                 string          `json:"id"`
	ClubID             string          `json:"clubId"`
	Sport              string          `json:"sport"`
	Name               *string         `json:"name,omitempty"`
	Location           *string         `json:"location,omitempty"`
	Description        *string         `json:"description,omitempty"`
	CourtCount         int             `json:"courtCount"`
	MaxParticipants    *int            `json:"maxParticipants,omitempty"`
	DefaultMatchFormat json.RawMessage `json:"defaultMatchFormat,omitempty"`
	// ActivityType, same as Session's own field — copied onto each generated Session.
	ActivityType *string `json:"activityType,omitempty"`
	// RecurrenceRule is opaque JSONB, same convention as DefaultMatchFormat —
	// MVP shape (weekly-only, not product-specified) is parsed only by
	// internal/scheduling: {"weekday":0-6,"time":"HH:MM","durationMinutes":n,"timezone":"..."}.
	RecurrenceRule     json.RawMessage `json:"recurrenceRule"`
	GenerationLeadDays int             `json:"generationLeadDays"`
	// GenerationTime is "HH:MM"; nil means the occurrence's own time-of-day is used.
	GenerationTime *string    `json:"generationTime,omitempty"`
	Status         string     `json:"status"`
	EndDate        *time.Time `json:"endDate,omitempty"`
	CreatedBy      string     `json:"createdBy"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"updatedAt"`
	// Skill Level requirement (DP-008), copied onto each generated Session.
	SkillLevelMinID       *string `json:"skillLevelMinId,omitempty"`
	SkillLevelMaxID       *string `json:"skillLevelMaxId,omitempty"`
	SkillLevelEnforcement *string `json:"skillLevelEnforcement,omitempty"`
	// HostPlaying, same as Session's own field — copied onto each generated
	// Session, and used to auto-check-in the host on each generated Session.
	HostPlaying bool `json:"hostPlaying"`
}
