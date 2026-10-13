package db

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/models"
	"github.com/yogisofiharja/aksi-server/internal/sports"
)

// resolveLifecycleStatus computes DP-001's derived Session state.
// draft/in_progress/completed/cancelled pass through Status unchanged —
// only 'open' has a derived sub-state (recruiting/ready/full), resolved
// from JoinedCount/MaxParticipants plus the Sport Module's minimum-
// participants rule. Never persisted — call after JoinedCount is set.
func resolveLifecycleStatus(s models.Session) string {
	switch s.Status {
	case "draft", "in_progress", "completed", "cancelled":
		return s.Status
	}
	if s.MaxParticipants != nil && s.JoinedCount >= *s.MaxParticipants {
		return "full"
	}
	if s.JoinedCount >= sports.MinParticipantsToStart(s.Sport) {
		return "ready"
	}
	return "recruiting"
}

const sessionColumns = "id, club_id, sport, name, location, court_count, status, max_participants, default_match_format, created_by, created_at, updated_at, starts_at, recurring_schedule_id, skill_level_min_id, skill_level_max_id, skill_level_enforcement, duration_minutes, activity_type, description, host_playing, price_model, price_per_person, total_price, default_single_deuce"

// sessionScanTargets lists Scan destinations in sessionColumns' order —
// shared so a query selecting sessionColumns plus extra columns can append
// its own targets instead of repeating this list.
func sessionScanTargets(s *models.Session) []any {
	return []any{&s.ID, &s.ClubID, &s.Sport, &s.Name, &s.Location, &s.CourtCount, &s.Status, &s.MaxParticipants, &s.DefaultMatchFormat, &s.CreatedBy, &s.CreatedAt, &s.UpdatedAt, &s.StartsAt, &s.RecurringScheduleID, &s.SkillLevelMinID, &s.SkillLevelMaxID, &s.SkillLevelEnforcement, &s.DurationMinutes, &s.ActivityType, &s.Description, &s.HostPlaying, &s.PriceModel, &s.PricePerPerson, &s.TotalPrice, &s.DefaultSingleDeuce}
}

func scanSession(row pgx.CollectableRow) (models.Session, error) {
	var s models.Session
	err := row.(pgx.Rows).Scan(sessionScanTargets(&s)...)
	return s, err
}

// CreateSessionParams groups the optional, DP-003/DP-004 fields alongside
// the original required ones, rather than growing CreateSession's
// positional-argument list further.
type CreateSessionParams struct {
	ClubID             string
	Sport              string
	Name               *string
	Location           *string
	Description        *string
	CourtCount         int
	MaxParticipants    *int
	DefaultMatchFormat []byte
	// DefaultSingleDeuce is Match Setup's other half, alongside
	// DefaultMatchFormat. Validated/defaulted by the caller (handler)
	// before reaching here, same as PriceModel.
	DefaultSingleDeuce *bool
	ActivityType       *string
	CreatedBy          string
	StartsAt           *time.Time
	DurationMinutes    *int
	// RecurringScheduleID and Status are only set by the generation path
	// (internal/scheduling) — ad-hoc creation leaves both nil/zero, which
	// keeps the existing 'draft' default and no schedule reference.
	RecurringScheduleID *string
	// Status overrides the column's 'draft' default. Generation passes
	// "open" so generated Sessions auto-publish immediately (DP-007).
	Status *string
	// Skill Level requirement (DP-008). Validated by the caller (handler)
	// before reaching here — both IDs set together, belonging to Sport,
	// with Enforcement required whenever they are.
	SkillLevelMinID       *string
	SkillLevelMaxID       *string
	SkillLevelEnforcement *string
	// HostPlaying is mandatory — validated by the caller (handler) before
	// reaching here, same as Name/Location.
	HostPlaying bool
	// Price (Payments). PriceModel defaults to "free" at the column level
	// if left as the zero value "" — validated/normalized by the caller
	// (handler) before reaching here, same as Skill Level.
	PriceModel     string
	PricePerPerson *int
	TotalPrice     *int
}

func CreateSession(ctx context.Context, pool *pgxpool.Pool, p CreateSessionParams) (models.Session, error) {
	// Name/Location are mandatory as of this round — both callers
	// (POST /sessions, Recurring Schedule generation) validate/guarantee
	// non-empty values before reaching here, so no server-side fallback.
	courtCount := p.CourtCount
	if courtCount <= 0 {
		courtCount = 1
	}
	rows, err := pool.Query(ctx,
		`INSERT INTO sessions (club_id, sport, name, location, court_count, max_participants, default_match_format, created_by, starts_at, recurring_schedule_id, status, skill_level_min_id, skill_level_max_id, skill_level_enforcement, duration_minutes, activity_type, description, host_playing, price_model, price_per_person, total_price, default_single_deuce)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, 'draft'), $12, $13, $14, $15, $16, $17, $18, COALESCE(NULLIF($19, ''), 'free'), $20, $21, $22) RETURNING `+sessionColumns,
		p.ClubID, p.Sport, p.Name, p.Location, courtCount, p.MaxParticipants, p.DefaultMatchFormat, p.CreatedBy, p.StartsAt, p.RecurringScheduleID, p.Status,
		p.SkillLevelMinID, p.SkillLevelMaxID, p.SkillLevelEnforcement, p.DurationMinutes, p.ActivityType, p.Description, p.HostPlaying,
		p.PriceModel, p.PricePerPerson, p.TotalPrice, p.DefaultSingleDeuce,
	)
	if err != nil {
		return models.Session{}, err
	}
	defer rows.Close()
	s, err := pgx.CollectOneRow(rows, scanSession)
	if err != nil {
		return models.Session{}, err
	}
	// JoinedCount is correctly zero — a brand-new Session has no
	// participants yet, no query needed to confirm that.
	s.LifecycleStatus = resolveLifecycleStatus(s)
	return s, nil
}

func GetSession(ctx context.Context, pool *pgxpool.Pool, sessionID string) (models.Session, error) {
	rows, err := pool.Query(ctx, "SELECT "+sessionColumns+" FROM sessions WHERE id = $1", sessionID)
	if err != nil {
		return models.Session{}, err
	}
	defer rows.Close()
	s, err := pgx.CollectOneRow(rows, scanSession)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Session{}, ErrNotFound
	}
	if err != nil {
		return models.Session{}, err
	}
	counts, err := CountJoinedParticipants(ctx, pool, []string{s.ID})
	if err != nil {
		return models.Session{}, err
	}
	s.JoinedCount = counts[s.ID]
	s.LifecycleStatus = resolveLifecycleStatus(s)
	return s, nil
}

// ListSessionsForClub excludes 'draft' sessions unless includeDrafts is
// true — DP-001: a draft session "should not be visible or joinable by
// club members," only its owner/admin creators.
func ListSessionsForClub(ctx context.Context, pool *pgxpool.Pool, clubID string, includeDrafts bool) ([]models.Session, error) {
	query := "SELECT " + sessionColumns + " FROM sessions WHERE club_id = $1"
	if !includeDrafts {
		query += " AND status != 'draft'"
	}
	query += " ORDER BY created_at DESC"
	rows, err := pool.Query(ctx, query, clubID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []models.Session{}
	for rows.Next() {
		s, err := scanSession(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, s)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	ids := make([]string, len(result))
	for i, s := range result {
		ids[i] = s.ID
	}
	counts, err := CountJoinedParticipants(ctx, pool, ids)
	if err != nil {
		return nil, err
	}
	for i := range result {
		result[i].JoinedCount = counts[result[i].ID]
		result[i].LifecycleStatus = resolveLifecycleStatus(result[i])
	}
	return result, nil
}

// ListJoinedSessionsForUser backs a Player's own cross-Club Session
// History (DP-009): every published Session the user has joined, in any
// Club, newest first. "Joined" is DP-002's headcount definition, same as
// CountJoinedParticipants — a request still awaiting approval, a
// cancellation, or a no-show isn't a Session they joined. Limited to
// Clubs the user still belongs to, since opening a Session requires
// membership (requireSessionAccess). Not filtered to past dates here:
// "past" is judged against the viewer's local calendar day, same as the
// Club-scoped history, so the client applies it.
func ListJoinedSessionsForUser(ctx context.Context, pool *pgxpool.Pool, userID string) ([]models.JoinedSession, error) {
	rows, err := pool.Query(ctx,
		`SELECT `+sessionColumns+`, (SELECT name FROM clubs WHERE clubs.id = sessions.club_id)
		 FROM sessions
		 WHERE status != 'draft'
		   AND id IN (SELECT session_id FROM session_participants
		              WHERE user_id = $1 AND status IN ('registered', 'checked_in', 'checked_out'))
		   AND club_id IN (SELECT club_id FROM club_members WHERE user_id = $1)
		 ORDER BY starts_at DESC NULLS LAST`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []models.JoinedSession{}
	for rows.Next() {
		var js models.JoinedSession
		if err := rows.Scan(append(sessionScanTargets(&js.Session), &js.ClubName)...); err != nil {
			return nil, err
		}
		result = append(result, js)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	ids := make([]string, len(result))
	for i, js := range result {
		ids[i] = js.ID
	}
	counts, err := CountJoinedParticipants(ctx, pool, ids)
	if err != nil {
		return nil, err
	}
	for i := range result {
		result[i].JoinedCount = counts[result[i].ID]
		result[i].LifecycleStatus = resolveLifecycleStatus(result[i].Session)
	}
	return result, nil
}

type SessionUpdate struct {
	Name                  *string
	Location              *string
	Description           *string
	Status                *string
	MaxParticipants       *int
	DefaultMatchFormat    []byte
	ActivityType          *string
	StartsAt              *time.Time
	DurationMinutes       *int
	SkillLevelMinID       *string
	SkillLevelMaxID       *string
	SkillLevelEnforcement *string
	HostPlaying           *bool
	// Price (Payments). Known limitation, same as Skill Level above:
	// COALESCE can't distinguish "field omitted" from "explicitly clear
	// this field," so switching PriceModel to "free" doesn't null out a
	// stale PricePerPerson/TotalPrice from a prior model — harmless, since
	// display/calculation logic always branches on PriceModel first, but
	// not solved here.
	PriceModel     *string
	PricePerPerson *int
	TotalPrice     *int
	// DefaultSingleDeuce, same COALESCE-partial-update convention as the
	// rest of this struct.
	DefaultSingleDeuce *bool
}

// TouchesTemplate reports whether this update changes any field a
// Recurring Schedule's Template owns (DP-004 Organizer Preferences). A
// status transition or a reschedule (StartsAt/DurationMinutes — core
// Session properties, never synced) doesn't count. UpdateSession uses it
// to mark a generated Session as edited by hand, which excludes it from
// DP-007 Session Synchronization.
func (u SessionUpdate) TouchesTemplate() bool {
	return u.Name != nil || u.Location != nil || u.Description != nil ||
		u.MaxParticipants != nil || len(u.DefaultMatchFormat) > 0 || u.DefaultSingleDeuce != nil ||
		u.ActivityType != nil ||
		u.SkillLevelMinID != nil || u.SkillLevelMaxID != nil || u.SkillLevelEnforcement != nil ||
		u.HostPlaying != nil ||
		u.PriceModel != nil || u.PricePerPerson != nil || u.TotalPrice != nil
}

func UpdateSession(ctx context.Context, pool *pgxpool.Pool, sessionID string, u SessionUpdate) (models.Session, error) {
	rows, err := pool.Query(ctx,
		`UPDATE sessions SET
			name = COALESCE($2, name),
			location = COALESCE($3, location),
			status = COALESCE($4, status),
			max_participants = COALESCE($5, max_participants),
			default_match_format = COALESCE($6, default_match_format),
			starts_at = COALESCE($7, starts_at),
			skill_level_min_id = COALESCE($8, skill_level_min_id),
			skill_level_max_id = COALESCE($9, skill_level_max_id),
			skill_level_enforcement = COALESCE($10, skill_level_enforcement),
			duration_minutes = COALESCE($11, duration_minutes),
			activity_type = COALESCE($12, activity_type),
			description = COALESCE($13, description),
			host_playing = COALESCE($14, host_playing),
			price_model = COALESCE($15, price_model),
			price_per_person = COALESCE($16, price_per_person),
			total_price = COALESCE($17, total_price),
			default_single_deuce = COALESCE($18, default_single_deuce),
			edited_after_generation = edited_after_generation OR ($19 AND recurring_schedule_id IS NOT NULL),
			updated_at = now()
		WHERE id = $1
		RETURNING `+sessionColumns,
		sessionID, u.Name, u.Location, u.Status, u.MaxParticipants, u.DefaultMatchFormat, u.StartsAt,
		u.SkillLevelMinID, u.SkillLevelMaxID, u.SkillLevelEnforcement, u.DurationMinutes, u.ActivityType, u.Description, u.HostPlaying,
		u.PriceModel, u.PricePerPerson, u.TotalPrice, u.DefaultSingleDeuce, u.TouchesTemplate(),
	)
	if err != nil {
		return models.Session{}, err
	}
	defer rows.Close()
	s, err := pgx.CollectOneRow(rows, scanSession)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Session{}, ErrNotFound
	}
	if err != nil {
		return models.Session{}, err
	}
	// Pre-existing gap, fixed here: the UPDATE...RETURNING above only
	// scans raw columns, so JoinedCount would otherwise be left at its
	// zero value regardless of actual participant count — wrong for any
	// Session that already has participants when PATCHed (e.g.
	// publishing a Session an organizer already checked guests into).
	// Needed for LifecycleStatus below to be correct on this path, which
	// Start/Complete Session now call constantly.
	counts, err := CountJoinedParticipants(ctx, pool, []string{s.ID})
	if err != nil {
		return models.Session{}, err
	}
	s.JoinedCount = counts[s.ID]
	s.LifecycleStatus = resolveLifecycleStatus(s)
	return s, nil
}

// DeleteSession hard-deletes a Session — Milestone 2's "Discard" action,
// Draft-only (enforced here too, defense in depth beyond the handler's
// own check). Unlike every other terminal path (Cancel, Complete), this
// is a real DELETE, not a status write: appropriate for a Draft nobody
// but the organizer has ever seen (DP-001: drafts are invisible to non-
// owner/admin members), unlike a published Session others may already
// have joined, where Cancel's visible record is the right terminal
// action instead. Participants/Activities cascade via FK (ON DELETE
// CASCADE, migrations/0001_init.up.sql) — no separate cleanup needed.
// Returns ErrConflict if the Session exists but isn't a draft,
// ErrNotFound if it doesn't exist at all.
func DeleteSession(ctx context.Context, pool *pgxpool.Pool, sessionID string) error {
	tag, err := pool.Exec(ctx, "DELETE FROM sessions WHERE id = $1 AND status = 'draft'", sessionID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		if _, gerr := GetSession(ctx, pool, sessionID); errors.Is(gerr, ErrNotFound) {
			return ErrNotFound
		}
		return ErrConflict
	}
	return nil
}

// ListElapsedSessions returns every Session whose starts_at+duration_minutes
// has passed but whose status is not yet terminal (DP-009) — the candidate
// set the auto-transition job acts on. Both starts_at and duration_minutes
// must be set; Sessions missing either (created before DP-009 made them
// mandatory) are simply never eligible, not an error.
func ListElapsedSessions(ctx context.Context, pool *pgxpool.Pool) ([]models.Session, error) {
	rows, err := pool.Query(ctx,
		`SELECT `+sessionColumns+` FROM sessions
		 WHERE starts_at IS NOT NULL AND duration_minutes IS NOT NULL
		   AND starts_at + (duration_minutes || ' minutes')::interval <= now()
		   AND status NOT IN ('completed', 'cancelled')`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []models.Session{}
	for rows.Next() {
		s, err := scanSession(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, s)
	}
	return result, rows.Err()
}

// ListDueToStartSessions returns every 'open' Session whose starts_at has
// arrived — the candidate set for auto-start (Milestone 2, revised: no
// manual "Start Session" organizer action anymore, the Session starts
// itself once its scheduled time comes). Deliberately status = 'open'
// only — a Draft Session's starts_at passing doesn't auto-start it (it
// was never published, nobody could have joined); that case is instead
// caught by ListElapsedSessions once its full window (starts_at+duration)
// passes, same as before, auto-cancelling it.
func ListDueToStartSessions(ctx context.Context, pool *pgxpool.Pool) ([]models.Session, error) {
	rows, err := pool.Query(ctx,
		`SELECT `+sessionColumns+` FROM sessions
		 WHERE starts_at IS NOT NULL AND status = 'open' AND starts_at <= now()`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []models.Session{}
	for rows.Next() {
		s, err := scanSession(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, s)
	}
	return result, rows.Err()
}

// SetSessionStatus writes a Session's status directly, bypassing the HTTP
// layer's organizer-initiated sessionStatusTransitions guard — used only by
// the DP-009 auto-transition job, an internal process, not an organizer
// action subject to that guard.
func SetSessionStatus(ctx context.Context, pool *pgxpool.Pool, sessionID, status string) error {
	tag, err := pool.Exec(ctx, "UPDATE sessions SET status = $2, updated_at = now() WHERE id = $1", sessionID, status)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// GetGeneratedSession looks up the Session generated by recurringScheduleID
// for one specific occurrence, if any — used to make manual generation
// (a "Generate now" organizer action) idempotent when the occurrence was
// already generated.
func GetGeneratedSession(ctx context.Context, pool *pgxpool.Pool, recurringScheduleID string, occurrenceStartsAt time.Time) (models.Session, error) {
	rows, err := pool.Query(ctx,
		"SELECT "+sessionColumns+" FROM sessions WHERE recurring_schedule_id = $1 AND starts_at = $2",
		recurringScheduleID, occurrenceStartsAt,
	)
	if err != nil {
		return models.Session{}, err
	}
	defer rows.Close()
	s, err := pgx.CollectOneRow(rows, scanSession)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Session{}, ErrNotFound
	}
	return s, err
}

// DeleteGeneratedSession removes a Session that was generated by
// recurringScheduleID for the given occurrence, if one exists. It never
// touches ad-hoc Sessions (scoped by recurring_schedule_id) and returns
// ErrNotFound if no matching generated Session exists — the caller (the
// skip-occurrence flow) treats that as fine, since the point is only to
// ensure no Session exists for that occurrence going forward.
func DeleteGeneratedSession(ctx context.Context, pool *pgxpool.Pool, recurringScheduleID string, occurrenceStartsAt time.Time) error {
	tag, err := pool.Exec(ctx,
		"DELETE FROM sessions WHERE recurring_schedule_id = $1 AND starts_at = $2",
		recurringScheduleID, occurrenceStartsAt,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
