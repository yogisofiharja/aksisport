package scheduling

import (
	"context"
	"errors"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/db"
	"github.com/yogisofiharja/aksi-server/internal/models"
)

// openStatus is passed explicitly so generated Sessions skip the 'draft'
// default and auto-publish immediately (DP-007).
const openStatus = "open"

// ErrNotAnOccurrence: the requested timestamp doesn't match the Schedule's
// Recurrence Rule at all (wrong weekday/time, or past the end date).
var ErrNotAnOccurrence = errors.New("not a valid occurrence of this recurring schedule")

// ErrOccurrenceSkipped: the occurrence was already skipped — generating it
// now would violate DP-007's "a skipped occurrence must never generate a
// Session" invariant.
var ErrOccurrenceSkipped = errors.New("occurrence was skipped")

// GenerateDueSessions is the entire background job (DP-007): for every
// active, non-ended Recurring Schedule, compute due occurrences and create
// a Session for each one that doesn't already have a generated Session or a
// skip tombstone. Safe to call on any interval, including concurrently or
// after a long gap — DueOccurrences' catch-up behavior plus the DB's unique
// index (recurring_schedule_id, starts_at) make this idempotent by
// construction, so a missed run needs no special recovery path.
func GenerateDueSessions(ctx context.Context, pool *pgxpool.Pool) error {
	schedules, err := db.ListActiveRecurringSchedules(ctx, pool)
	if err != nil {
		return err
	}

	now := time.Now().UTC()
	for _, sched := range schedules {
		if err := generateForSchedule(ctx, pool, sched, now); err != nil {
			// One bad Schedule (e.g. an unparseable recurrence rule) must
			// not stop generation for every other Schedule.
			log.Printf("recurring schedule %s: generation failed: %v", sched.ID, err)
		}
	}
	return nil
}

func generateForSchedule(ctx context.Context, pool *pgxpool.Pool, sched models.RecurringSchedule, now time.Time) error {
	rule, err := ParseRecurrenceRule(sched.RecurrenceRule)
	if err != nil {
		return err
	}
	due, err := DueOccurrences(rule, GenerationPolicy{
		LeadDays:       sched.GenerationLeadDays,
		GenerationTime: sched.GenerationTime,
	}, sched.CreatedAt, sched.EndDate, now)
	if err != nil {
		return err
	}
	if len(due) == 0 {
		return nil
	}

	handled, err := db.HandledOccurrences(ctx, pool, sched.ID, due)
	if err != nil {
		return err
	}

	for _, occ := range due {
		if handled[occ.Unix()] {
			continue
		}
		if _, err := createGeneratedSession(ctx, pool, sched, occ, rule.DurationMinutes); err != nil {
			// A concurrent generation run racing on the same occurrence
			// hits the unique index and lands here — not fatal, the other
			// run already generated it.
			log.Printf("recurring schedule %s: generating occurrence %v failed: %v", sched.ID, occ, err)
			continue
		}
	}
	return nil
}

func createGeneratedSession(ctx context.Context, pool *pgxpool.Pool, sched models.RecurringSchedule, occ time.Time, durationMinutes int) (models.Session, error) {
	scheduleID := sched.ID
	session, err := db.CreateSession(ctx, pool, db.CreateSessionParams{
		ClubID:              sched.ClubID,
		Sport:               sched.Sport,
		Name:                sched.Name,
		Location:            sched.Location,
		Description:         sched.Description,
		CourtCount:          sched.CourtCount,
		MaxParticipants:     sched.MaxParticipants,
		DefaultMatchFormat:  sched.DefaultMatchFormat,
		ActivityType:        sched.ActivityType,
		CreatedBy:           sched.CreatedBy,
		StartsAt:            &occ,
		DurationMinutes:     &durationMinutes,
		RecurringScheduleID: &scheduleID,
		Status:              statusPtr(openStatus),
		// DP-008: Skill Level requirement is part of the Template, copied
		// onto each generated Session same as every other Template field.
		SkillLevelMinID:       sched.SkillLevelMinID,
		SkillLevelMaxID:       sched.SkillLevelMaxID,
		SkillLevelEnforcement: sched.SkillLevelEnforcement,
		HostPlaying:           sched.HostPlaying,
	})
	if err != nil {
		return models.Session{}, err
	}
	// Host Playing (part of the Template): register the host as a
	// participant on every generated Session, same as ad-hoc creation —
	// see sessions_handler.go. Lands at 'registered', not 'checked_in' —
	// the host still checks in for real once the Check-In Window opens
	// and they're actually there.
	if sched.HostPlaying {
		if _, err := db.AddRegisteredParticipant(ctx, pool, session.ID, sched.CreatedBy); err != nil {
			return models.Session{}, err
		}
	}
	return session, nil
}

func statusPtr(s string) *string { return &s }

// GenerateOccurrenceNow forces generation for one specific occurrence,
// bypassing the Generation Policy's lead-time gate — an explicit organizer
// action (a manual "Generate" button on a not-yet-due occurrence), not the
// automatic background tick. Still enforces the same invariants as
// automatic generation: occurrenceStartsAt must be a real occurrence of the
// Schedule's Recurrence Rule, must not already be skipped, and is
// idempotent if it was already generated.
func GenerateOccurrenceNow(ctx context.Context, pool *pgxpool.Pool, scheduleID string, occurrenceStartsAt time.Time) (models.Session, error) {
	sched, err := db.GetRecurringSchedule(ctx, pool, scheduleID)
	if err != nil {
		return models.Session{}, err
	}
	rule, err := ParseRecurrenceRule(sched.RecurrenceRule)
	if err != nil {
		return models.Session{}, err
	}
	// A degenerate [t, t] range returns t itself only if t is genuinely one
	// of the rule's occurrences — reuses the same enumeration logic the
	// preview endpoint uses, rather than a separate validity check.
	valid, err := OccurrencesInRange(rule, sched.CreatedAt, sched.EndDate, occurrenceStartsAt, occurrenceStartsAt)
	if err != nil {
		return models.Session{}, err
	}
	if len(valid) != 1 {
		return models.Session{}, ErrNotAnOccurrence
	}

	statuses, err := db.OccurrenceStatuses(ctx, pool, scheduleID, []time.Time{occurrenceStartsAt})
	if err != nil {
		return models.Session{}, err
	}
	switch statuses[occurrenceStartsAt.Unix()] {
	case "skipped":
		return models.Session{}, ErrOccurrenceSkipped
	case "generated":
		return db.GetGeneratedSession(ctx, pool, scheduleID, occurrenceStartsAt)
	}

	return createGeneratedSession(ctx, pool, sched, occurrenceStartsAt, rule.DurationMinutes)
}
