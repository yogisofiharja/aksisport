package scheduling

import (
	"context"
	"encoding/json"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/db"
)

// LiveScores reads a match's last live score (firebaseadmin.LiveMatches).
type LiveScores interface {
	LastScore(ctx context.Context, activityID string) (matchState, history json.RawMessage, found bool, err error)
}

// UnfinishOverdueMatches is DP-027's grace period: a match still live an
// hour after its Session ended is saved as Unfinished with its last score —
// read from the live copy in Firebase, or, when that can't be read, what
// the server last stored (logged). That includes a match that reached its
// final point but was never confirmed. Idempotent: a match no longer live
// is left alone. Rides the auto-transition ticker.
func UnfinishOverdueMatches(ctx context.Context, pool *pgxpool.Pool, live LiveScores) (int, error) {
	matches, err := db.ListOverdueLiveMatches(ctx, pool)
	if err != nil {
		return 0, err
	}
	return saveUnfinished(ctx, pool, live, matches), nil
}

func saveUnfinished(ctx context.Context, pool *pgxpool.Pool, live LiveScores, matches []db.OverdueLiveMatch) int {
	saved := 0
	for _, m := range matches {
		result, pointLog := m.Result, m.PointLog
		if live == nil {
			log.Printf("match %s: no live score reader; saving it as unfinished with the server's last state", m.ActivityID)
		} else if state, history, found, err := live.LastScore(ctx, m.ActivityID); err != nil {
			log.Printf("match %s: reading its live score failed (%v); saving it as unfinished with the server's last state", m.ActivityID, err)
		} else if !found {
			log.Printf("match %s: no live score; saving it as unfinished with the server's last state", m.ActivityID)
		} else {
			result, pointLog = state, history
		}
		if len(result) == 0 {
			result = json.RawMessage("null")
		}
		changed, err := db.SaveUnfinished(ctx, pool, m.ActivityID, result, pointLog)
		if err != nil {
			log.Printf("match %s: saving as unfinished failed: %v", m.ActivityID, err)
			continue
		}
		if changed {
			saved++
		}
	}
	return saved
}
