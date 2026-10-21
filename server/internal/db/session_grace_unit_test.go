package db

import (
	"testing"
	"time"

	"github.com/yogisofiharja/aksi-server/internal/models"
)

func TestScoringOpen(t *testing.T) {
	start := time.Date(2026, 10, 21, 19, 0, 0, 0, time.UTC)
	hours := 120
	s := func(status string) models.Session {
		return models.Session{Status: status, StartsAt: &start, DurationMinutes: &hours}
	}
	end := start.Add(2 * time.Hour)
	cases := []struct {
		name string
		s    models.Session
		now  time.Time
		want bool
	}{
		{"in progress", s("in_progress"), end.Add(-time.Minute), true},
		{"completed, inside the grace hour", s("completed"), end.Add(59 * time.Minute), true},
		{"completed, grace hour over", s("completed"), end.Add(time.Hour), false},
		{"completed, long after", s("completed"), end.Add(5 * time.Hour), false},
		{"cancelled", s("cancelled"), end.Add(-time.Hour), false},
		{"completed, no times", models.Session{Status: "completed"}, end, false},
	}
	for _, c := range cases {
		if got := ScoringOpen(c.s, c.now); got != c.want {
			t.Errorf("%s: ScoringOpen = %v, want %v", c.name, got, c.want)
		}
	}
	if at := ScoringClosesAt(s("completed")); at == nil || !at.Equal(end.Add(time.Hour)) {
		t.Errorf("ScoringClosesAt = %v, want %v", at, end.Add(time.Hour))
	}
}
