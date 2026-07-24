package models

import (
	"encoding/json"
	"time"
)

type Session struct {
	ID                 string          `json:"id"`
	ClubID             string          `json:"clubId"`
	Sport              string          `json:"sport"`
	Name               *string         `json:"name,omitempty"`
	Location           *string         `json:"location,omitempty"`
	CourtCount         int             `json:"courtCount"`
	Status             string          `json:"status"`
	MaxParticipants    *int            `json:"maxParticipants,omitempty"`
	DefaultMatchFormat json.RawMessage `json:"defaultMatchFormat,omitempty"`
	CreatedBy          string          `json:"createdBy"`
	CreatedAt          time.Time       `json:"createdAt"`
	UpdatedAt          time.Time       `json:"updatedAt"`
}
