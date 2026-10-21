package scheduling

import (
	"context"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/db"
)

// AutoStartDueSessions is Milestone 2's revision of DP-009: a published
// ('open') Session starts itself once its scheduled starts_at arrives —
// there is no manual "Start Session" organizer action anymore. Draft
// Sessions are untouched here (never published, nobody could have
// joined); a Draft whose time passes is instead caught by
// AutoTransitionElapsedSessions below once its full window elapses,
// auto-cancelling it same as before.
func AutoStartDueSessions(ctx context.Context, pool *pgxpool.Pool) error {
	sessions, err := db.ListDueToStartSessions(ctx, pool)
	if err != nil {
		return err
	}
	for _, sess := range sessions {
		if err := db.SetSessionStatus(ctx, pool, sess.ID, "in_progress"); err != nil {
			log.Printf("session %s: auto-start failed: %v", sess.ID, err)
		}
	}
	return nil
}

// AutoTransitionElapsedSessions is DP-009's backend-driven lifecycle
// resolution: once a Session's starts_at+duration has passed, it no longer
// waits on an organizer action. In Progress becomes Completed (it actually
// happened), and its queued matches become Not played (DP-027); any other
// non-terminal state becomes Cancelled (it never started, so there's
// nothing to "complete").
func AutoTransitionElapsedSessions(ctx context.Context, pool *pgxpool.Pool) error {
	sessions, err := db.ListElapsedSessions(ctx, pool)
	if err != nil {
		return err
	}
	for _, sess := range sessions {
		if sess.Status == "in_progress" {
			// DP-027: its queued matches become Not played with it.
			if _, err := db.CompleteElapsedSession(ctx, pool, sess.ID); err != nil {
				log.Printf("session %s: auto-transition to completed failed: %v", sess.ID, err)
			}
			continue
		}
		if err := db.SetSessionStatus(ctx, pool, sess.ID, "cancelled"); err != nil {
			log.Printf("session %s: auto-transition to cancelled failed: %v", sess.ID, err)
		}
	}
	return nil
}
