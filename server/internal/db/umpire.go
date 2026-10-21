package db

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// SetSessionUmpire makes userID the Session's umpire (DP-023) and hands
// every live match of the Session to them, so scoring carries on from
// the new umpire's device. Returns the ids of those live matches — the
// caller moves their live copies in Firebase too.
func SetSessionUmpire(ctx context.Context, pool *pgxpool.Pool, sessionID, userID string) (liveActivityIDs []string, err error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx, "UPDATE sessions SET umpire_user_id = $2, updated_at = now() WHERE id = $1", sessionID, userID)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	rows, err := tx.Query(ctx,
		"UPDATE activities SET scorer_user_id = $2 WHERE session_id = $1 AND status = 'live' RETURNING id",
		sessionID, userID,
	)
	if err != nil {
		return nil, err
	}
	liveActivityIDs, err = pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		return nil, err
	}
	return liveActivityIDs, tx.Commit(ctx)
}

// FirebaseUID is the Firebase account behind a user — what the live
// copies in Firebase name as their scorer.
func FirebaseUID(ctx context.Context, pool *pgxpool.Pool, userID string) (string, error) {
	var uid string
	err := pool.QueryRow(ctx, "SELECT firebase_uid FROM users WHERE id = $1", userID).Scan(&uid)
	if err == pgx.ErrNoRows {
		return "", ErrNotFound
	}
	return uid, err
}
