package db

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/models"
)

const activityColumns = "id, session_id, sport, activity_type, status, scorer_user_id, config, result, point_log, created_by, queue_position, started_at, completed_at, created_at"

func scanActivity(row pgx.CollectableRow) (models.Activity, error) {
	var a models.Activity
	err := row.(pgx.Rows).Scan(
		&a.ID, &a.SessionID, &a.Sport, &a.ActivityType, &a.Status, &a.ScorerUserID,
		&a.Config, &a.Result, &a.PointLog, &a.CreatedBy, &a.QueuePosition,
		&a.StartedAt, &a.CompletedAt, &a.CreatedAt,
	)
	return a, err
}

const activityParticipantSelect = `SELECT ap.id, ap.activity_id, ap.user_id, ap.guest_name, u.username, u.display_name, ap.team, ap.slot_order
	 FROM activity_participants ap LEFT JOIN users u ON u.id = ap.user_id`

func scanActivityParticipant(row pgx.CollectableRow) (models.ActivityParticipant, error) {
	var p models.ActivityParticipant
	err := row.(pgx.Rows).Scan(&p.ID, &p.ActivityID, &p.UserID, &p.GuestName, &p.Username, &p.DisplayName, &p.Team, &p.SlotOrder)
	return p, err
}

// ActivityParticipantInput is one entry of the participant list supplied
// when creating an activity — exactly one of UserID/GuestName is set.
type ActivityParticipantInput struct {
	UserID    *string
	GuestName *string
	Team      *string
}

// CreateActivity inserts a new 'queued' activity with its participants in
// a single transaction and returns the assembled detail.
func CreateActivity(ctx context.Context, pool *pgxpool.Pool, sessionID, sport string, config json.RawMessage, participants []ActivityParticipantInput, createdBy string) (models.ActivityDetail, error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return models.ActivityDetail{}, err
	}
	defer tx.Rollback(ctx)

	var activityID string
	if err := tx.QueryRow(ctx,
		`INSERT INTO activities (session_id, sport, config, created_by)
		 VALUES ($1, $2, $3, $4) RETURNING id`,
		sessionID, sport, config, createdBy,
	).Scan(&activityID); err != nil {
		return models.ActivityDetail{}, err
	}

	for i, p := range participants {
		if _, err := tx.Exec(ctx,
			`INSERT INTO activity_participants (activity_id, user_id, guest_name, team, slot_order)
			 VALUES ($1, $2, $3, $4, $5)`,
			activityID, p.UserID, p.GuestName, p.Team, i,
		); err != nil {
			return models.ActivityDetail{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return models.ActivityDetail{}, err
	}
	return GetActivityDetail(ctx, pool, activityID)
}

func GetActivity(ctx context.Context, pool *pgxpool.Pool, activityID string) (models.Activity, error) {
	rows, err := pool.Query(ctx, "SELECT "+activityColumns+" FROM activities WHERE id = $1", activityID)
	if err != nil {
		return models.Activity{}, err
	}
	defer rows.Close()
	a, err := pgx.CollectOneRow(rows, scanActivity)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Activity{}, ErrNotFound
	}
	return a, err
}

func ListActivityParticipants(ctx context.Context, pool *pgxpool.Pool, activityID string) ([]models.ActivityParticipant, error) {
	rows, err := pool.Query(ctx, activityParticipantSelect+" WHERE ap.activity_id = $1 ORDER BY ap.slot_order ASC", activityID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []models.ActivityParticipant{}
	for rows.Next() {
		p, err := scanActivityParticipant(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, p)
	}
	return result, rows.Err()
}

func GetActivityDetail(ctx context.Context, pool *pgxpool.Pool, activityID string) (models.ActivityDetail, error) {
	activity, err := GetActivity(ctx, pool, activityID)
	if err != nil {
		return models.ActivityDetail{}, err
	}
	participants, err := ListActivityParticipants(ctx, pool, activityID)
	if err != nil {
		return models.ActivityDetail{}, err
	}
	return models.ActivityDetail{Activity: activity, Participants: participants}, nil
}

// ListActivitiesForSession returns queued/live activities before completed
// ones (the order a queue view wants), each with its participants.
func ListActivitiesForSession(ctx context.Context, pool *pgxpool.Pool, sessionID string) ([]models.ActivityDetail, error) {
	rows, err := pool.Query(ctx,
		`SELECT `+activityColumns+` FROM activities WHERE session_id = $1
		 ORDER BY CASE status WHEN 'live' THEN 0 WHEN 'queued' THEN 1 ELSE 2 END, created_at ASC`,
		sessionID,
	)
	if err != nil {
		return nil, err
	}
	var activities []models.Activity
	for rows.Next() {
		a, err := scanActivity(rows)
		if err != nil {
			rows.Close()
			return nil, err
		}
		activities = append(activities, a)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	result := make([]models.ActivityDetail, 0, len(activities))
	for _, a := range activities {
		participants, err := ListActivityParticipants(ctx, pool, a.ID)
		if err != nil {
			return nil, err
		}
		result = append(result, models.ActivityDetail{Activity: a, Participants: participants})
	}
	return result, nil
}

// DeleteActivity removes a 'queued' activity (and its participants, via
// ON DELETE CASCADE). Returns ErrConflict if the activity isn't queued —
// a live or completed match must never be silently removed, only a
// not-yet-started one. Used by the Regenerate-matches flow, which deletes
// every currently queued activity before generating a fresh fair round.
func DeleteActivity(ctx context.Context, pool *pgxpool.Pool, activityID string) error {
	tag, err := pool.Exec(ctx, "DELETE FROM activities WHERE id = $1 AND status = 'queued'", activityID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() > 0 {
		return nil
	}
	if _, err := GetActivity(ctx, pool, activityID); errors.Is(err, ErrNotFound) {
		return ErrNotFound
	}
	return ErrConflict
}

// StartActivity transitions a 'queued' activity to 'live', assigning the
// caller as scorer. Returns ErrConflict if the activity isn't queued.
func StartActivity(ctx context.Context, pool *pgxpool.Pool, activityID, scorerUserID string) (models.Activity, error) {
	rows, err := pool.Query(ctx,
		`UPDATE activities SET status = 'live', scorer_user_id = $2, started_at = now()
		 WHERE id = $1 AND status = 'queued' RETURNING `+activityColumns,
		activityID, scorerUserID,
	)
	if err != nil {
		return models.Activity{}, err
	}
	a, err := pgx.CollectOneRow(rows, scanActivity)
	rows.Close()
	if errors.Is(err, pgx.ErrNoRows) {
		if _, gerr := GetActivity(ctx, pool, activityID); errors.Is(gerr, ErrNotFound) {
			return models.Activity{}, ErrNotFound
		}
		return models.Activity{}, ErrConflict
	}
	return a, err
}

// CompleteActivity transitions a 'live' activity to 'completed', storing
// the final result and point log. Returns ErrConflict if not live.
func CompleteActivity(ctx context.Context, pool *pgxpool.Pool, activityID string, result, pointLog json.RawMessage) (models.Activity, error) {
	rows, err := pool.Query(ctx,
		`UPDATE activities SET status = 'completed', result = $2, point_log = COALESCE($3, point_log), completed_at = now()
		 WHERE id = $1 AND status = 'live' RETURNING `+activityColumns,
		activityID, result, pointLog,
	)
	if err != nil {
		return models.Activity{}, err
	}
	a, err := pgx.CollectOneRow(rows, scanActivity)
	rows.Close()
	if errors.Is(err, pgx.ErrNoRows) {
		if _, gerr := GetActivity(ctx, pool, activityID); errors.Is(gerr, ErrNotFound) {
			return models.Activity{}, ErrNotFound
		}
		return models.Activity{}, ErrConflict
	}
	return a, err
}
