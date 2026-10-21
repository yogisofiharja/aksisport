package models

import (
	"encoding/json"
	"time"
)

// PlayerSportActivity (DP-019) is a player's history in one sport, across
// every Community: what an organizer sees on the sport page of a
// requester's profile, and what a player sees of themselves.
type PlayerSportActivity struct {
	Sport    string                 `json:"sport"`
	Summary  PlayerSportSummary     `json:"summary"`
	Sessions []PlayerSessionHistory `json:"sessions"`
	Matches  []PlayerMatchHistory   `json:"matches"`
}

type PlayerSportSummary struct {
	SessionsAttended int `json:"sessionsAttended"`
	NoShows          int `json:"noShows"`
	// MatchesPlayed: completed matches, draws included; Unfinished and
	// Not played matches never count (DP-025, DP-027).
	MatchesPlayed int `json:"matchesPlayed"`
	Wins          int `json:"wins"`
	// Losses: completed matches the other team won. Win rate is
	// Wins / (Wins + Losses) — a draw is neither.
	Losses int `json:"losses"`
}

// PlayerSessionHistory: a Session the player took part in — checked in
// (and possibly out), or marked a no-show.
type PlayerSessionHistory struct {
	SessionID   string     `json:"sessionId"`
	SessionName *string    `json:"sessionName,omitempty"`
	ClubName    string     `json:"clubName"`
	StartsAt    *time.Time `json:"startsAt,omitempty"`
	// "attended" or "no_show".
	Outcome string `json:"outcome"`
}

// PlayerMatchHistory: a completed match the player was on a team in.
// Result is the sport's own stored end state (tennis: winner, sets,
// games), interpreted by the client's sport module.
type PlayerMatchHistory struct {
	ActivityID  string                   `json:"activityId"`
	SessionName *string                  `json:"sessionName,omitempty"`
	ClubName    string                   `json:"clubName"`
	CompletedAt *time.Time               `json:"completedAt,omitempty"`
	Team        string                   `json:"team"`
	Won         *bool                    `json:"won,omitempty"`
	Result      json.RawMessage          `json:"result,omitempty"`
	Players     []PlayerMatchParticipant `json:"players"`
}

type PlayerMatchParticipant struct {
	Name string `json:"name"`
	Team string `json:"team"`
}
