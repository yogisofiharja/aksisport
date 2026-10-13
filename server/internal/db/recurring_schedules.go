package db

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/models"
)

const recurringScheduleColumns = "id, club_id, sport, name, location, court_count, max_participants, default_match_format, recurrence_rule, generation_lead_days, generation_time, status, end_date, created_by, created_at, updated_at, skill_level_min_id, skill_level_max_id, skill_level_enforcement, activity_type, description, host_playing, price_model, price_per_person, total_price, default_single_deuce"

func scanRecurringSchedule(row pgx.CollectableRow) (models.RecurringSchedule, error) {
	var s models.RecurringSchedule
	err := row.(pgx.Rows).Scan(
		&s.ID, &s.ClubID, &s.Sport, &s.Name, &s.Location, &s.CourtCount, &s.MaxParticipants, &s.DefaultMatchFormat,
		&s.RecurrenceRule, &s.GenerationLeadDays, &s.GenerationTime, &s.Status, &s.EndDate, &s.CreatedBy, &s.CreatedAt, &s.UpdatedAt,
		&s.SkillLevelMinID, &s.SkillLevelMaxID, &s.SkillLevelEnforcement, &s.ActivityType, &s.Description, &s.HostPlaying,
		&s.PriceModel, &s.PricePerPerson, &s.TotalPrice, &s.DefaultSingleDeuce,
	)
	return s, err
}

type CreateRecurringScheduleParams struct {
	ClubID             string
	Sport              string
	Name               *string
	Location           *string
	Description        *string
	CourtCount         int
	MaxParticipants    *int
	DefaultMatchFormat []byte
	DefaultSingleDeuce *bool
	ActivityType       *string
	RecurrenceRule     []byte
	GenerationLeadDays int
	GenerationTime     *string
	EndDate            *time.Time
	CreatedBy          string
	// Skill Level requirement (DP-008), copied onto each generated Session.
	SkillLevelMinID       *string
	SkillLevelMaxID       *string
	SkillLevelEnforcement *string
	// HostPlaying is mandatory — validated by the caller before reaching here.
	HostPlaying bool
	// Price (Payments), same convention as CreateSessionParams.
	PriceModel     string
	PricePerPerson *int
	TotalPrice     *int
}

func CreateRecurringSchedule(ctx context.Context, pool *pgxpool.Pool, p CreateRecurringScheduleParams) (models.RecurringSchedule, error) {
	courtCount := p.CourtCount
	if courtCount <= 0 {
		courtCount = 1
	}
	rows, err := pool.Query(ctx,
		`INSERT INTO recurring_schedules
			(club_id, sport, name, location, court_count, max_participants, default_match_format, recurrence_rule, generation_lead_days, generation_time, end_date, created_by, skill_level_min_id, skill_level_max_id, skill_level_enforcement, activity_type, description, host_playing, price_model, price_per_person, total_price, default_single_deuce)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, COALESCE(NULLIF($19, ''), 'free'), $20, $21, $22) RETURNING `+recurringScheduleColumns,
		p.ClubID, p.Sport, p.Name, p.Location, courtCount, p.MaxParticipants, p.DefaultMatchFormat,
		p.RecurrenceRule, p.GenerationLeadDays, p.GenerationTime, p.EndDate, p.CreatedBy,
		p.SkillLevelMinID, p.SkillLevelMaxID, p.SkillLevelEnforcement, p.ActivityType, p.Description, p.HostPlaying,
		p.PriceModel, p.PricePerPerson, p.TotalPrice, p.DefaultSingleDeuce,
	)
	if err != nil {
		return models.RecurringSchedule{}, err
	}
	defer rows.Close()
	return pgx.CollectOneRow(rows, scanRecurringSchedule)
}

func GetRecurringSchedule(ctx context.Context, pool *pgxpool.Pool, id string) (models.RecurringSchedule, error) {
	rows, err := pool.Query(ctx, "SELECT "+recurringScheduleColumns+" FROM recurring_schedules WHERE id = $1", id)
	if err != nil {
		return models.RecurringSchedule{}, err
	}
	defer rows.Close()
	s, err := pgx.CollectOneRow(rows, scanRecurringSchedule)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.RecurringSchedule{}, ErrNotFound
	}
	return s, err
}

func ListRecurringSchedulesForClub(ctx context.Context, pool *pgxpool.Pool, clubID string) ([]models.RecurringSchedule, error) {
	rows, err := pool.Query(ctx, "SELECT "+recurringScheduleColumns+" FROM recurring_schedules WHERE club_id = $1 ORDER BY created_at DESC", clubID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []models.RecurringSchedule{}
	for rows.Next() {
		s, err := scanRecurringSchedule(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, s)
	}
	return result, rows.Err()
}

// ListActiveRecurringSchedules returns every Schedule the generation ticker
// should consider: Active status and not past its optional end date.
func ListActiveRecurringSchedules(ctx context.Context, pool *pgxpool.Pool) ([]models.RecurringSchedule, error) {
	rows, err := pool.Query(ctx,
		"SELECT "+recurringScheduleColumns+" FROM recurring_schedules WHERE status = 'active' AND (end_date IS NULL OR end_date >= CURRENT_DATE)",
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []models.RecurringSchedule{}
	for rows.Next() {
		s, err := scanRecurringSchedule(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, s)
	}
	return result, rows.Err()
}

// RecurringScheduleUpdate covers Template/Recurrence Rule/Generation
// Policy/end-date fields only. It never touches already-generated
// Sessions — pushing the Template to those is a separate, organizer-
// confirmed step (SyncGeneratedSessions below, DP-007).
type RecurringScheduleUpdate struct {
	Name                  *string
	Location              *string
	Description           *string
	CourtCount            *int
	MaxParticipants       *int
	DefaultMatchFormat    []byte
	DefaultSingleDeuce    *bool
	ActivityType          *string
	RecurrenceRule        []byte
	GenerationLeadDays    *int
	GenerationTime        *string
	EndDate               *time.Time
	SkillLevelMinID       *string
	SkillLevelMaxID       *string
	SkillLevelEnforcement *string
	HostPlaying           *bool
	// Price (Payments) — same COALESCE-can't-clear limitation as Session's
	// own SessionUpdate.
	PriceModel     *string
	PricePerPerson *int
	TotalPrice     *int
}

func UpdateRecurringSchedule(ctx context.Context, pool *pgxpool.Pool, id string, u RecurringScheduleUpdate) (models.RecurringSchedule, error) {
	rows, err := pool.Query(ctx,
		`UPDATE recurring_schedules SET
			name = COALESCE($2, name),
			location = COALESCE($3, location),
			court_count = COALESCE($4, court_count),
			max_participants = COALESCE($5, max_participants),
			default_match_format = COALESCE($6, default_match_format),
			recurrence_rule = COALESCE($7, recurrence_rule),
			generation_lead_days = COALESCE($8, generation_lead_days),
			generation_time = COALESCE($9, generation_time),
			end_date = COALESCE($10, end_date),
			skill_level_min_id = COALESCE($11, skill_level_min_id),
			skill_level_max_id = COALESCE($12, skill_level_max_id),
			skill_level_enforcement = COALESCE($13, skill_level_enforcement),
			activity_type = COALESCE($14, activity_type),
			description = COALESCE($15, description),
			host_playing = COALESCE($16, host_playing),
			price_model = COALESCE($17, price_model),
			price_per_person = COALESCE($18, price_per_person),
			total_price = COALESCE($19, total_price),
			default_single_deuce = COALESCE($20, default_single_deuce),
			updated_at = now()
		WHERE id = $1
		RETURNING `+recurringScheduleColumns,
		id, u.Name, u.Location, u.CourtCount, u.MaxParticipants, u.DefaultMatchFormat,
		u.RecurrenceRule, u.GenerationLeadDays, u.GenerationTime, u.EndDate,
		u.SkillLevelMinID, u.SkillLevelMaxID, u.SkillLevelEnforcement, u.ActivityType, u.Description, u.HostPlaying,
		u.PriceModel, u.PricePerPerson, u.TotalPrice, u.DefaultSingleDeuce,
	)
	if err != nil {
		return models.RecurringSchedule{}, err
	}
	defer rows.Close()
	s, err := pgx.CollectOneRow(rows, scanRecurringSchedule)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.RecurringSchedule{}, ErrNotFound
	}
	return s, err
}

func SetRecurringScheduleStatus(ctx context.Context, pool *pgxpool.Pool, id, status string) (models.RecurringSchedule, error) {
	rows, err := pool.Query(ctx,
		"UPDATE recurring_schedules SET status = $2, updated_at = now() WHERE id = $1 RETURNING "+recurringScheduleColumns,
		id, status,
	)
	if err != nil {
		return models.RecurringSchedule{}, err
	}
	defer rows.Close()
	s, err := pgx.CollectOneRow(rows, scanRecurringSchedule)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.RecurringSchedule{}, ErrNotFound
	}
	return s, err
}

// DeleteRecurringSchedule stops future generation and preserves all
// generated Sessions (DP-007) — sessions.recurring_schedule_id is ON DELETE
// SET NULL, so this only removes the schedule and its skip tombstones
// (ON DELETE CASCADE), never touches session rows.
func DeleteRecurringSchedule(ctx context.Context, pool *pgxpool.Pool, id string) error {
	tag, err := pool.Exec(ctx, "DELETE FROM recurring_schedules WHERE id = $1", id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// SkipOccurrence records that an occurrence must never generate a Session
// (DP-007) — idempotent tombstone insert. Deleting a matching
// already-generated Session (if one exists) is the caller's job via
// DeleteGeneratedSession; this only writes the tombstone.
func SkipOccurrence(ctx context.Context, pool *pgxpool.Pool, recurringScheduleID string, occurrenceStartsAt time.Time) error {
	_, err := pool.Exec(ctx,
		`INSERT INTO recurring_schedule_skips (recurring_schedule_id, occurrence_starts_at)
		 VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		recurringScheduleID, occurrenceStartsAt,
	)
	return err
}

// HandledOccurrences returns, out of the given candidate occurrence
// timestamps for one Schedule, which ones already have either a generated
// Session or a skip tombstone — i.e. which the generator must not act on
// again. Keyed by Unix() to sidestep time.Time equality/location subtleties.
func HandledOccurrences(ctx context.Context, pool *pgxpool.Pool, recurringScheduleID string, occurrences []time.Time) (map[int64]bool, error) {
	handled := map[int64]bool{}
	if len(occurrences) == 0 {
		return handled, nil
	}
	rows, err := pool.Query(ctx,
		`SELECT starts_at FROM sessions WHERE recurring_schedule_id = $1 AND starts_at = ANY($2::timestamptz[])
		 UNION
		 SELECT occurrence_starts_at FROM recurring_schedule_skips WHERE recurring_schedule_id = $1 AND occurrence_starts_at = ANY($2::timestamptz[])`,
		recurringScheduleID, occurrences,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var t time.Time
		if err := rows.Scan(&t); err != nil {
			return nil, err
		}
		handled[t.Unix()] = true
	}
	return handled, rows.Err()
}

// OccurrenceStatuses is HandledOccurrences' richer sibling, used only by the
// occurrences-preview endpoint: distinguishes "generated" from "skipped"
// instead of collapsing both into a single bool.
func OccurrenceStatuses(ctx context.Context, pool *pgxpool.Pool, recurringScheduleID string, occurrences []time.Time) (map[int64]string, error) {
	statuses := map[int64]string{}
	if len(occurrences) == 0 {
		return statuses, nil
	}
	rows, err := pool.Query(ctx,
		`SELECT starts_at, 'generated' FROM sessions WHERE recurring_schedule_id = $1 AND starts_at = ANY($2::timestamptz[])
		 UNION ALL
		 SELECT occurrence_starts_at, 'skipped' FROM recurring_schedule_skips WHERE recurring_schedule_id = $1 AND occurrence_starts_at = ANY($2::timestamptz[])`,
		recurringScheduleID, occurrences,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var t time.Time
		var status string
		if err := rows.Scan(&t, &status); err != nil {
			return nil, err
		}
		if _, exists := statuses[t.Unix()]; !exists {
			statuses[t.Unix()] = status
		}
	}
	return statuses, rows.Err()
}

// syncEligibleSessions is DP-007's definition of "upcoming" for Session
// Synchronization: generated by this Schedule, not started yet, and not
// cancelled. 'in_progress'/'completed'/'cancelled' Sessions are never
// touched, whatever their starts_at says.
const syncEligibleSessions = `recurring_schedule_id = $1 AND starts_at > now() AND status IN ('draft', 'open')`

// SessionSyncCounts is what a sync would do (preview) or did (result):
// Updated Sessions take the Template's values, SkippedEdited ones were
// edited by hand after generation and keep their own.
type SessionSyncCounts struct {
	Updated       int `json:"updated"`
	SkippedEdited int `json:"skippedEdited"`
}

// PreviewSessionSync counts what SyncGeneratedSessions would do right now,
// without changing anything — feeds the organizer's confirmation prompt.
func PreviewSessionSync(ctx context.Context, pool *pgxpool.Pool, recurringScheduleID string) (SessionSyncCounts, error) {
	var counts SessionSyncCounts
	err := pool.QueryRow(ctx,
		`SELECT count(*) FILTER (WHERE NOT edited_after_generation),
		        count(*) FILTER (WHERE edited_after_generation)
		 FROM sessions WHERE `+syncEligibleSessions,
		recurringScheduleID,
	).Scan(&counts.Updated, &counts.SkippedEdited)
	return counts, err
}

// SyncGeneratedSessions pushes the Schedule's current Template onto every
// upcoming Session it generated (DP-007 Session Synchronization), except
// those edited by hand. Every Template field is overwritten as-is,
// including NULLs — the Session ends up exactly as if it had just been
// generated. starts_at and duration_minutes are deliberately absent: they
// come from the Recurrence Rule, not the Template, and a sync never moves
// a Session in time. Like PATCH /sessions/:id, a host_playing change
// doesn't add or remove the host as a participant.
func SyncGeneratedSessions(ctx context.Context, pool *pgxpool.Pool, recurringScheduleID string) (SessionSyncCounts, error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return SessionSyncCounts{}, err
	}
	defer tx.Rollback(ctx)

	var counts SessionSyncCounts
	if err := tx.QueryRow(ctx,
		`SELECT count(*) FROM sessions WHERE `+syncEligibleSessions+` AND edited_after_generation`,
		recurringScheduleID,
	).Scan(&counts.SkippedEdited); err != nil {
		return SessionSyncCounts{}, err
	}
	tag, err := tx.Exec(ctx,
		`UPDATE sessions s SET
			name = r.name,
			location = r.location,
			description = r.description,
			court_count = r.court_count,
			max_participants = r.max_participants,
			default_match_format = r.default_match_format,
			default_single_deuce = r.default_single_deuce,
			activity_type = r.activity_type,
			skill_level_min_id = r.skill_level_min_id,
			skill_level_max_id = r.skill_level_max_id,
			skill_level_enforcement = r.skill_level_enforcement,
			host_playing = r.host_playing,
			price_model = r.price_model,
			price_per_person = r.price_per_person,
			total_price = r.total_price,
			updated_at = now()
		 FROM recurring_schedules r
		 WHERE r.id = $1 AND s.recurring_schedule_id = $1 AND s.starts_at > now()
		   AND s.status IN ('draft', 'open') AND NOT s.edited_after_generation`,
		recurringScheduleID,
	)
	if err != nil {
		return SessionSyncCounts{}, err
	}
	counts.Updated = int(tag.RowsAffected())
	return counts, tx.Commit(ctx)
}
