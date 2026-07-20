package models

import (
	"encoding/json"
	"time"
)

type Activity struct {
	ID            string          `json:"id"`
	SessionID     string          `json:"sessionId"`
	Sport         string          `json:"sport"`
	ActivityType  string          `json:"activityType"`
	Status        string          `json:"status"`
	ScorerUserID  *string         `json:"scorerUserId,omitempty"`
	Config        json.RawMessage `json:"config"`
	Result        json.RawMessage `json:"result,omitempty"`
	PointLog      json.RawMessage `json:"pointLog"`
	CreatedBy     string          `json:"createdBy"`
	QueuePosition *int            `json:"queuePosition,omitempty"`
	StartedAt     *time.Time      `json:"startedAt,omitempty"`
	CompletedAt   *time.Time      `json:"completedAt,omitempty"`
	CreatedAt     time.Time       `json:"createdAt"`
}

// ActivityDetail is an Activity plus its participants — the shape returned
// by the single-activity and list-activities endpoints.
type ActivityDetail struct {
	Activity
	Participants []ActivityParticipant `json:"participants"`
}
