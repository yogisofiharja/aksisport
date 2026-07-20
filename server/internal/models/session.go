package models

import "time"

type Session struct {
	ID         string    `json:"id"`
	ClubID     string    `json:"clubId"`
	Sport      string    `json:"sport"`
	Name       *string   `json:"name,omitempty"`
	Location   *string   `json:"location,omitempty"`
	CourtCount int       `json:"courtCount"`
	Status     string    `json:"status"`
	CreatedBy  string    `json:"createdBy"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}
