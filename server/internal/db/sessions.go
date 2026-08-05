package db

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/models"
)

const sessionColumns = "id, club_id, sport, name, location, court_count, status, max_participants, default_match_format, created_by, created_at, updated_at, starts_at, recurring_schedule_id, skill_level_min_id, skill_level_max_id, skill_level_enforcement, duration_minutes, activity_type, description, host_playing"

func scanSession(row pgx.CollectableRow) (models.Session, error) {
	var s models.Session
	err := row.(pgx.Rows).Scan(&s.ID, &s.ClubID, &s.Sport, &s.Name, &s.Location, &s.CourtCount, &s.Status, &s.MaxParticipants, &s.DefaultMatchFormat, &s.CreatedBy, &s.CreatedAt, &s.UpdatedAt, &s.StartsAt, &s.RecurringScheduleID, &s.SkillLevelMinID, &s.SkillLevelMaxID, &s.SkillLevelEnforcement, &s.DurationMinutes, &s.ActivityType, &s.Description, &s.HostPlaying)
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
		`INSERT INTO sessions (club_id, sport, name, location, court_count, max_participants, default_match_format, created_by, starts_at, recurring_schedule_id, status, skill_level_min_id, skill_level_max_id, skill_level_enforcement, duration_minutes, activity_type, description, host_playing)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, 'draft'), $12, $13, $14, $15, $16, $17, $18) RETURNING `+sessionColumns,
		p.ClubID, p.Sport, p.Name, p.Location, courtCount, p.MaxParticipants, p.DefaultMatchFormat, p.CreatedBy, p.StartsAt, p.RecurringScheduleID, p.Status,
		p.SkillLevelMinID, p.SkillLevelMaxID, p.SkillLevelEnforcement, p.DurationMinutes, p.ActivityType, p.Description, p.HostPlaying,
	)
	if err != nil {
		return models.Session{}, err
	}
	defer rows.Close()
	return pgx.CollectOneRow(rows, scanSession)
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
			updated_at = now()
		WHERE id = $1
		RETURNING `+sessionColumns,
		sessionID, u.Name, u.Location, u.Status, u.MaxParticipants, u.DefaultMatchFormat, u.StartsAt,
		u.SkillLevelMinID, u.SkillLevelMaxID, u.SkillLevelEnforcement, u.DurationMinutes, u.ActivityType, u.Description, u.HostPlaying,
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
