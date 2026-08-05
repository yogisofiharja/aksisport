package scheduling

import (
	"testing"
	"time"
)

func mustUTC(t *testing.T, s string) time.Time {
	t.Helper()
	parsed, err := time.Parse("2006-01-02 15:04", s)
	if err != nil {
		t.Fatalf("parsing %q: %v", s, err)
	}
	return parsed.UTC()
}

// Weekly Saturday 08:00 UTC, 6-day lead. 2024-01-01 is a Monday, so the
// first occurrence on/after that Monday is Saturday 2024-01-06.
func weeklySaturdayRule() RecurrenceRuleJSON {
	return RecurrenceRuleJSON{Weekday: int(time.Saturday), Time: "08:00", DurationMinutes: 120, Timezone: "UTC"}
}

func TestDueOccurrences_NotYetDue(t *testing.T) {
	rule := weeklySaturdayRule()
	createdAt := mustUTC(t, "2024-01-01 00:00")
	policy := GenerationPolicy{LeadDays: 6}

	// First occurrence's generation moment is 2023-12-31 08:00 (6 days
	// before 2024-01-06 08:00). One minute before that, nothing is due.
	now := mustUTC(t, "2023-12-31 07:59")
	due, err := DueOccurrences(rule, policy, createdAt, nil, now)
	if err != nil {
		t.Fatalf("DueOccurrences: %v", err)
	}
	if len(due) != 0 {
		t.Fatalf("expected no due occurrences, got %v", due)
	}
}

func TestDueOccurrences_FirstOccurrenceDue(t *testing.T) {
	rule := weeklySaturdayRule()
	createdAt := mustUTC(t, "2024-01-01 00:00")
	policy := GenerationPolicy{LeadDays: 6}

	now := mustUTC(t, "2023-12-31 08:00")
	due, err := DueOccurrences(rule, policy, createdAt, nil, now)
	if err != nil {
		t.Fatalf("DueOccurrences: %v", err)
	}
	want := mustUTC(t, "2024-01-06 08:00")
	if len(due) != 1 || !due[0].Equal(want) {
		t.Fatalf("expected [%v], got %v", want, due)
	}
}

// Simulates a generator that missed several ticks: "now" lands after the
// generation moments of two occurrences but before the third. Catch-up
// falls out of the same loop with no special-cased recovery logic.
func TestDueOccurrences_CatchUpAfterDowntime(t *testing.T) {
	rule := weeklySaturdayRule()
	createdAt := mustUTC(t, "2024-01-01 00:00")
	policy := GenerationPolicy{LeadDays: 6}

	// Occurrences: Jan 6, Jan 13, Jan 20 ... generation moments: Dec 31,
	// Jan 7, Jan 14 ... "now" = Jan 10 is past Jan 7 but before Jan 14.
	now := mustUTC(t, "2024-01-10 08:00")
	due, err := DueOccurrences(rule, policy, createdAt, nil, now)
	if err != nil {
		t.Fatalf("DueOccurrences: %v", err)
	}
	want := []time.Time{mustUTC(t, "2024-01-06 08:00"), mustUTC(t, "2024-01-13 08:00")}
	if len(due) != len(want) {
		t.Fatalf("expected %v, got %v", want, due)
	}
	for i := range want {
		if !due[i].Equal(want[i]) {
			t.Fatalf("expected %v, got %v", want, due)
		}
	}
}

func TestDueOccurrences_StopsAtEndDate(t *testing.T) {
	rule := weeklySaturdayRule()
	createdAt := mustUTC(t, "2024-01-01 00:00")
	policy := GenerationPolicy{LeadDays: 6}
	endDate := mustUTC(t, "2024-01-10 00:00") // before the Jan 13 occurrence

	// Far-future "now" would otherwise pick up many occurrences.
	now := mustUTC(t, "2024-03-01 00:00")
	due, err := DueOccurrences(rule, policy, createdAt, &endDate, now)
	if err != nil {
		t.Fatalf("DueOccurrences: %v", err)
	}
	want := mustUTC(t, "2024-01-06 08:00")
	if len(due) != 1 || !due[0].Equal(want) {
		t.Fatalf("expected [%v] (stopping at end date), got %v", want, due)
	}
}

func TestDueOccurrences_ExplicitGenerationTime(t *testing.T) {
	rule := weeklySaturdayRule() // occurrence itself is 08:00
	createdAt := mustUTC(t, "2024-01-01 00:00")
	genTime := "18:00"
	policy := GenerationPolicy{LeadDays: 6, GenerationTime: &genTime}

	// Generation moment is now Dec 31 18:00, not 08:00 — 08:00 is too early.
	tooEarly := mustUTC(t, "2023-12-31 08:00")
	due, err := DueOccurrences(rule, policy, createdAt, nil, tooEarly)
	if err != nil {
		t.Fatalf("DueOccurrences: %v", err)
	}
	if len(due) != 0 {
		t.Fatalf("expected no due occurrences before explicit generation time, got %v", due)
	}

	onTime := mustUTC(t, "2023-12-31 18:00")
	due, err = DueOccurrences(rule, policy, createdAt, nil, onTime)
	if err != nil {
		t.Fatalf("DueOccurrences: %v", err)
	}
	if len(due) != 1 {
		t.Fatalf("expected one due occurrence at explicit generation time, got %v", due)
	}
}

func TestParseRecurrenceRule_Errors(t *testing.T) {
	cases := map[string][]byte{
		"bad weekday":          []byte(`{"weekday":7,"time":"08:00","durationMinutes":120}`),
		"bad time":             []byte(`{"weekday":6,"time":"8am","durationMinutes":120}`),
		"bad timezone":         []byte(`{"weekday":6,"time":"08:00","durationMinutes":120,"timezone":"Not/AZone"}`),
		"missing duration":     []byte(`{"weekday":6,"time":"08:00"}`),
		"zero duration":        []byte(`{"weekday":6,"time":"08:00","durationMinutes":0}`),
		"non-hourly duration":  []byte(`{"weekday":6,"time":"08:00","durationMinutes":90}`),
		"duration over 24h":    []byte(`{"weekday":6,"time":"08:00","durationMinutes":1500}`),
		"duration under 1h":    []byte(`{"weekday":6,"time":"08:00","durationMinutes":30}`),
	}
	for name, raw := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := ParseRecurrenceRule(raw); err == nil {
				t.Fatalf("expected an error for %s", name)
			}
		})
	}
}

func TestParseRecurrenceRule_DefaultsTimezoneToUTC(t *testing.T) {
	r, err := ParseRecurrenceRule([]byte(`{"weekday":6,"time":"08:00","durationMinutes":120}`))
	if err != nil {
		t.Fatalf("ParseRecurrenceRule: %v", err)
	}
	if r.Timezone != "UTC" {
		t.Fatalf("expected default timezone UTC, got %q", r.Timezone)
	}
}
