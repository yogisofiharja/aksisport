package scheduling

import (
	"context"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/db"
)

// AutoTransitionElapsedSessions is DP-009's backend-driven lifecycle
// resolution: once a Session's starts_at+duration has passed, it no longer
// waits on an organizer action. In Progress becomes Completed (it actually
// happened); any other non-terminal state becomes Cancelled (it never
// started, so there's nothing to "complete").
func AutoTransitionElapsedSessions(ctx context.Context, pool *pgxpool.Pool) error {
	sessions, err := db.ListElapsedSessions(ctx, pool)
	if err != nil {
		return err
	}
	for _, sess := range sessions {
		next := "cancelled"
		if sess.Status == "in_progress" {
			next = "completed"
		}
		if err := db.SetSessionStatus(ctx, pool, sess.ID, next); err != nil {
			log.Printf("session %s: auto-transition to %s failed: %v", sess.ID, next, err)
		}
	}
	return nil
}
