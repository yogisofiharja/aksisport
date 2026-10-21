package db

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

// CompleteElapsedSession moves an In Progress Session whose time is up to
// Completed and its queued matches to Not played (DP-027), together. Live
// matches are left alone: the umpire may still finish them during the
// grace period. Returns how many matches became Not played.
func CompleteElapsedSession(ctx context.Context, pool *pgxpool.Pool, sessionID string) (notPlayed int64, err error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)
	tag, err := tx.Exec(ctx, "UPDATE sessions SET status = 'completed', updated_at = now() WHERE id = $1", sessionID)
	if err != nil {
		return 0, err
	}
	if tag.RowsAffected() == 0 {
		return 0, ErrNotFound
	}
	tag, err = tx.Exec(ctx, "UPDATE activities SET status = 'not_played' WHERE session_id = $1 AND status = 'queued'", sessionID)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), tx.Commit(ctx)
}
