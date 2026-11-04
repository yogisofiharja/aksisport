package models

import "time"

// AttendanceCounts (DP-029) over completed Sessions.
type AttendanceCounts struct {
	Attended    int `json:"attended"`
	NoShows     int `json:"noShows"`
	LateCancels int `json:"lateCancels"`
}

// Attendance is one player's record. All covers every Community; Here
// covers the Community it was asked for (zero when none was).
type Attendance struct {
	All      AttendanceCounts  `json:"all"`
	Here     AttendanceCounts  `json:"here"`
	Sessions []AttendanceEntry `json:"sessions"`
}

type AttendanceEntry struct {
	SessionID   string     `json:"sessionId"`
	SessionName *string    `json:"sessionName,omitempty"`
	StartsAt    *time.Time `json:"startsAt,omitempty"`
	ClubID      string     `json:"clubId"`
	ClubName    string     `json:"clubName"`
	// attended, no_show or late_cancel.
	Outcome   string `json:"outcome"`
	Corrected bool   `json:"corrected"`
}
