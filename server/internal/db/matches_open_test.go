package db

import (
	"testing"
	"time"

	"github.com/yogisofiharja/aksi-server/internal/models"
)

func TestMatchesOpen(t *testing.T) {
	start := time.Date(2026, 10, 15, 19, 0, 0, 0, time.UTC)
	MatchEarlyStart = 10 * time.Minute
	cases := []struct {
		name   string
		status string
		starts *time.Time
		now    time.Time
		want   bool
	}{
		{"in progress", "in_progress", &start, start.Add(-3 * time.Hour), true},
		{"open, 11 min before", "open", &start, start.Add(-11 * time.Minute), false},
		{"open, exactly 10 min before", "open", &start, start.Add(-10 * time.Minute), true},
		{"open, 5 min before", "open", &start, start.Add(-5 * time.Minute), true},
		{"open, no start time", "open", nil, start, false},
		{"draft", "draft", &start, start, false},
		{"completed", "completed", &start, start, false},
	}
	for _, c := range cases {
		if got := MatchesOpen(models.Session{Status: c.status, StartsAt: c.starts}, c.now); got != c.want {
			t.Errorf("%s: MatchesOpen = %v, want %v", c.name, got, c.want)
		}
	}

	s := models.Session{StartsAt: &start}
	deriveSessionFields(&s)
	if s.MatchesOpenAt == nil || !s.MatchesOpenAt.Equal(start.Add(-10*time.Minute)) {
		t.Errorf("MatchesOpenAt = %v, want 10 minutes before the start", s.MatchesOpenAt)
	}
}
