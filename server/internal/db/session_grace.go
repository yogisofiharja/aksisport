package db

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// OverdueLiveMatch is a match still live on a Completed Session whose grace
// period is over (DP-027), with what the server last stored for it.
type OverdueLiveMatch struct {
	ActivityID string
	SessionID  string
	Result     json.RawMessage
	PointLog   json.RawMessage
}

// ListOverdueLiveMatches: live matches of Completed Sessions whose end plus
// MatchGrace has passed.
func ListOverdueLiveMatches(ctx context.Context, pool *pgxpool.Pool) ([]OverdueLiveMatch, error) {
	rows, err := pool.Query(ctx,
		`SELECT a.id, a.session_id, a.result, a.point_log
		 FROM activities a JOIN sessions s ON s.id = a.session_id
		 WHERE a.status = 'live' AND s.status = 'completed'
		   AND s.starts_at IS NOT NULL AND s.duration_minutes IS NOT NULL
		   AND s.starts_at + (s.duration_minutes || ' minutes')::interval + make_interval(secs => $1) <= now()`,
		MatchGrace.Seconds(),
	)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (OverdueLiveMatch, error) {
		var m OverdueLiveMatch
		err := row.Scan(&m.ActivityID, &m.SessionID, &m.Result, &m.PointLog)
		return m, err
	})
}

// SaveUnfinished saves a live match as Unfinished with the given score and
// point log (nil keeps what is stored). It does nothing to a match that is
// no longer live, so running it twice is harmless; changed says whether it
// did anything.
func SaveUnfinished(ctx context.Context, pool *pgxpool.Pool, activityID string, result, pointLog json.RawMessage) (changed bool, err error) {
	_, err = EndActivityEarly(ctx, pool, activityID, result, pointLog)
	if errors.Is(err, ErrConflict) {
		return false, nil
	}
	return err == nil, err
}
