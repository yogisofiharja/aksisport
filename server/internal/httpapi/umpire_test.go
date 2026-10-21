package httpapi

import (
	"net/http"
	"testing"
)

func TestUmpireAssignmentProblem(t *testing.T) {
	cases := []struct {
		name                                  string
		status, role, caller, target, tStatus string
		want                                  int
	}{
		{"owner assigns a checked-in player", "in_progress", "owner", "o", "p", "checked_in", 0},
		{"admin assigns a checked-in player", "open", "admin", "a", "p", "checked_in", 0},
		{"owner reclaims without checking in", "in_progress", "owner", "o", "o", "", 0},
		{"admin reclaims while registered", "in_progress", "admin", "a", "a", "registered", 0},
		{"a member can't assign", "in_progress", "member", "m", "p", "checked_in", http.StatusForbidden},
		{"a member can't take it for themselves", "in_progress", "member", "m", "m", "checked_in", http.StatusForbidden},
		{"a registered player can't be umpire", "in_progress", "owner", "o", "p", "registered", http.StatusBadRequest},
		{"a non-participant can't be umpire", "in_progress", "owner", "o", "p", "", http.StatusBadRequest},
		{"a checked-out player can't be umpire", "in_progress", "owner", "o", "p", "checked_out", http.StatusBadRequest},
		{"not on a completed session", "completed", "owner", "o", "p", "checked_in", http.StatusConflict},
		{"not on a cancelled session", "cancelled", "owner", "o", "o", "", http.StatusConflict},
	}
	for _, c := range cases {
		got, _ := umpireAssignmentProblem(c.status, c.role, c.caller, c.target, c.tStatus)
		if got != c.want {
			t.Errorf("%s: got %d, want %d", c.name, got, c.want)
		}
	}
}

func TestIsSessionUmpire(t *testing.T) {
	if !isSessionUmpire("u", "u") {
		t.Error("the umpire must be able to start and complete")
	}
	// The match's own players and the Community's owners/admins are just
	// other users here: no role bypass.
	for _, other := range []string{"player", "owner", ""} {
		if isSessionUmpire("u", other) {
			t.Errorf("%q must not start or complete", other)
		}
	}
	if isSessionUmpire("", "") {
		t.Error("no umpire means nobody")
	}
}
