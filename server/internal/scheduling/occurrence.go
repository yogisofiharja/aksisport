// Package scheduling computes Recurring Schedule occurrences (DP-007) and
// ties them to Session generation. Occurrence tracking is explicitly not a
// first-class domain object per the product decision — everything here is
// an internal implementation detail of the generation process.
package scheduling

import (
	"encoding/json"
	"fmt"
	"time"

	// Embeds the IANA timezone database into the binary so
	// time.LoadLocation works regardless of whether the deployment host has
	// tzdata installed (no Dockerfile/base-image is pinned in this repo, so
	// this can't be assumed).
	_ "time/tzdata"
)

// RecurrenceRuleJSON is the MVP shape stored in recurring_schedules.recurrence_rule.
// Weekly-only, not product-specified — an engineering default (DP-ARCH-004).
type RecurrenceRuleJSON struct {
	Weekday         int    `json:"weekday"` // 0=Sunday .. 6=Saturday, matches time.Weekday
	Time            string `json:"time"`    // "HH:MM"
	DurationMinutes int    `json:"durationMinutes"`
	Timezone        string `json:"timezone"` // IANA name, e.g. "Asia/Jakarta"
}

func ParseRecurrenceRule(raw []byte) (RecurrenceRuleJSON, error) {
	var r RecurrenceRuleJSON
	if err := json.Unmarshal(raw, &r); err != nil {
		return RecurrenceRuleJSON{}, fmt.Errorf("parsing recurrence rule: %w", err)
	}
	if r.Weekday < 0 || r.Weekday > 6 {
		return RecurrenceRuleJSON{}, fmt.Errorf("recurrence rule weekday out of range: %d", r.Weekday)
	}
	if _, _, err := parseHHMM(r.Time); err != nil {
		return RecurrenceRuleJSON{}, fmt.Errorf("recurrence rule time: %w", err)
	}
	// DP-009: Duration is mandatory as of v0.5.1 — every generated Session
	// needs one, same as an ad-hoc Session does. As of v0.6.0, the range is
	// 1-24 hours in hourly increments (no tournament-length Sessions yet),
	// same bounds enforced on ad-hoc Session creation in httpapi.
	if r.DurationMinutes < 60 || r.DurationMinutes > 1440 || r.DurationMinutes%60 != 0 {
		return RecurrenceRuleJSON{}, fmt.Errorf("recurrence rule durationMinutes must be a multiple of 60 between 60 and 1440")
	}
	if r.Timezone == "" {
		r.Timezone = "UTC"
	}
	if _, err := time.LoadLocation(r.Timezone); err != nil {
		return RecurrenceRuleJSON{}, fmt.Errorf("recurrence rule timezone: %w", err)
	}
	return r, nil
}

func parseHHMM(s string) (hour, minute int, err error) {
	t, err := time.Parse("15:04", s)
	if err != nil {
		return 0, 0, fmt.Errorf("expected HH:MM, got %q", s)
	}
	return t.Hour(), t.Minute(), nil
}

// GenerationPolicy is DP-007's Generation Policy: how far ahead of an
// occurrence to generate it, and at what time of day.
type GenerationPolicy struct {
	LeadDays int
	// GenerationTime is "HH:MM"; nil means the occurrence's own time-of-day
	// is used (DP-007: "If generation time is omitted, the Session start
	// time is used").
	GenerationTime *string
}

// DueOccurrences returns, in ascending order, every occurrence start time
// whose generation moment (occurrence time minus LeadDays, at
// GenerationTime or the occurrence's own time-of-day) is on or before now.
//
// This is what makes catch-up/eventually-consistent generation (DP-007)
// fall out for free: both the occurrence time and its generation moment
// strictly increase with each weekly step, so the loop naturally stops at
// the first occurrence that isn't due yet — no separate "how far back do we
// look" window is needed, and a caller that hasn't run in a while simply
// gets every occurrence it missed back to the Schedule's creation time.
func DueOccurrences(rule RecurrenceRuleJSON, policy GenerationPolicy, createdAt time.Time, endDate *time.Time, now time.Time) ([]time.Time, error) {
	loc, err := time.LoadLocation(rule.Timezone)
	if err != nil {
		return nil, fmt.Errorf("loading recurrence rule timezone: %w", err)
	}
	hour, minute, err := parseHHMM(rule.Time)
	if err != nil {
		return nil, err
	}

	genHour, genMinute := hour, minute
	if policy.GenerationTime != nil {
		genHour, genMinute, err = parseHHMM(*policy.GenerationTime)
		if err != nil {
			return nil, fmt.Errorf("generation policy time: %w", err)
		}
	}

	occ := firstOccurrenceOnOrAfter(createdAt.In(loc), time.Weekday(rule.Weekday), hour, minute, loc)

	var due []time.Time
	for {
		if endDate != nil && occ.After(endOfDay(*endDate, loc)) {
			break
		}
		genMoment := time.Date(occ.Year(), occ.Month(), occ.Day()-policy.LeadDays, genHour, genMinute, 0, 0, loc)
		if genMoment.After(now) {
			break
		}
		due = append(due, occ)
		occ = occ.AddDate(0, 0, 7)
	}
	return due, nil
}

// OccurrencesInRange returns every occurrence between from and to
// (inclusive), regardless of generation due-status. Used to preview
// upcoming occurrences for the organizer (e.g. "the next 8 Saturdays"),
// not for generation itself — see DueOccurrences for that.
func OccurrencesInRange(rule RecurrenceRuleJSON, createdAt time.Time, endDate *time.Time, from, to time.Time) ([]time.Time, error) {
	loc, err := time.LoadLocation(rule.Timezone)
	if err != nil {
		return nil, fmt.Errorf("loading recurrence rule timezone: %w", err)
	}
	hour, minute, err := parseHHMM(rule.Time)
	if err != nil {
		return nil, err
	}

	start := from
	if createdAt.After(start) {
		start = createdAt
	}
	occ := firstOccurrenceOnOrAfter(start.In(loc), time.Weekday(rule.Weekday), hour, minute, loc)

	var result []time.Time
	for !occ.After(to) {
		if endDate != nil && occ.After(endOfDay(*endDate, loc)) {
			break
		}
		result = append(result, occ)
		occ = occ.AddDate(0, 0, 7)
	}
	return result, nil
}

func firstOccurrenceOnOrAfter(from time.Time, weekday time.Weekday, hour, minute int, loc *time.Location) time.Time {
	candidate := time.Date(from.Year(), from.Month(), from.Day(), hour, minute, 0, 0, loc)
	for candidate.Weekday() != weekday || candidate.Before(from) {
		candidate = candidate.AddDate(0, 0, 1)
	}
	return candidate
}

func endOfDay(d time.Time, loc *time.Location) time.Time {
	return time.Date(d.Year(), d.Month(), d.Day(), 23, 59, 59, 0, loc)
}
