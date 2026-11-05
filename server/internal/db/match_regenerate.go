package db

import (
	"context"
	"encoding/json"
	"math/rand"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/matchgen"
)

// matchSize is how many players a generated match needs (DP-003).
var matchSize = map[string]int{"single": 2, "double": 4}

// RegenerateQueue is DP-005's automatic regeneration, on the server
// (2026-11-05): once a Session has started, its queued matches are
// rebuilt from the players who are checked in — the same number of
// matches, fairly (internal/matchgen), live and finished ones untouched.
// Called when someone checks in, or leaves while still in a queued match.
// It does nothing (false) before the start, after the end, for a Session
// that doesn't generate matches, or when nothing is queued. One at a time
// per Session (advisory lock), so two check-ins can't both rebuild it.
func RegenerateQueue(ctx context.Context, pool *pgxpool.Pool, sessionID string) (bool, error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtext('regenerate:' || $1))", sessionID); err != nil {
		return false, err
	}

	var (
		sport, status, createdBy string
		activityType             *string
		startsAt                 *time.Time
		matchFormat              json.RawMessage
		singleDeuce              *bool
	)
	if err := tx.QueryRow(ctx,
		`SELECT sport, status, created_by, activity_type, starts_at, default_match_format, default_single_deuce
		 FROM sessions WHERE id = $1`, sessionID,
	).Scan(&sport, &status, &createdBy, &activityType, &startsAt, &matchFormat, &singleDeuce); err != nil {
		return false, err
	}
	if activityType == nil || matchSize[*activityType] == 0 {
		return false, nil
	}
	if (status != "open" && status != "in_progress") || startsAt == nil || startsAt.After(time.Now()) {
		return false, nil
	}

	tag, err := tx.Exec(ctx, "DELETE FROM activities WHERE session_id = $1 AND status = 'queued'", sessionID)
	if err != nil {
		return false, err
	}
	count := int(tag.RowsAffected())
	if count == 0 {
		return false, nil
	}

	// After the start, only the players who are here.
	rows, err := tx.Query(ctx,
		`SELECT sp.id, sp.user_id, sp.guest_name, coalesce(nullif(u.display_name, ''), u.username, sp.guest_name, 'Player')
		 FROM session_participants sp LEFT JOIN users u ON u.id = sp.user_id
		 WHERE sp.session_id = $1 AND sp.status = 'checked_in'
		 ORDER BY sp.joined_at`, sessionID)
	if err != nil {
		return false, err
	}
	eligible, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (matchgen.Player, error) {
		var p matchgen.Player
		err := r.Scan(&p.ID, &p.UserID, &p.GuestName, &p.Label)
		return p, err
	})
	if err != nil {
		return false, err
	}

	// Every match left (live, finished): who has played how often and how
	// recently. Live ones also keep their players busy.
	rows, err = tx.Query(ctx,
		`SELECT a.id, a.status, a.created_at, ap.user_id, ap.guest_name
		 FROM activities a JOIN activity_participants ap ON ap.activity_id = a.id
		 WHERE a.session_id = $1 AND a.status <> 'not_played'
		 ORDER BY a.created_at, ap.slot_order`, sessionID)
	if err != nil {
		return false, err
	}
	byID := map[string]*matchgen.Match{}
	live := map[string]bool{}
	var order []string
	for rows.Next() {
		var id, st string
		var at time.Time
		var ref matchgen.Ref
		if err := rows.Scan(&id, &st, &at, &ref.UserID, &ref.GuestName); err != nil {
			rows.Close()
			return false, err
		}
		m, ok := byID[id]
		if !ok {
			m = &matchgen.Match{CreatedAt: at}
			byID[id] = m
			order = append(order, id)
		}
		m.Players = append(m.Players, ref)
		live[id] = st == "live"
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return false, err
	}
	var history, busy []matchgen.Match
	for _, id := range order {
		history = append(history, *byID[id])
		if live[id] {
			busy = append(busy, *byID[id])
		}
	}

	needed := matchSize[*activityType]
	round := matchgen.FairRound(eligible, busy, history, needed, count, rand.New(rand.NewSource(time.Now().UnixNano())))
	for _, picked := range round {
		config, err := matchgen.Config(picked, *activityType, singleDeuce == nil || *singleDeuce, matchFormat)
		if err != nil {
			return false, err
		}
		var activityID string
		if err := tx.QueryRow(ctx,
			"INSERT INTO activities (session_id, sport, config, created_by) VALUES ($1, $2, $3, $4) RETURNING id",
			sessionID, sport, config, createdBy,
		).Scan(&activityID); err != nil {
			return false, err
		}
		for i, p := range picked {
			if _, err := tx.Exec(ctx,
				"INSERT INTO activity_participants (activity_id, user_id, guest_name, team, slot_order) VALUES ($1, $2, $3, $4, $5)",
				activityID, p.UserID, p.GuestName, matchgen.Team(i, needed), i,
			); err != nil {
				return false, err
			}
		}
	}
	return true, tx.Commit(ctx)
}

// InQueuedMatch: the participant (by user id or row id) is in one of the
// Session's queued matches — leaving then means the queue needs
// rebuilding.
func InQueuedMatch(ctx context.Context, pool *pgxpool.Pool, sessionID, participantIDOrUserID string) (bool, error) {
	var in bool
	err := pool.QueryRow(ctx,
		`SELECT EXISTS (
			SELECT 1 FROM session_participants sp
			JOIN activities a ON a.session_id = sp.session_id AND a.status = 'queued'
			JOIN activity_participants ap ON ap.activity_id = a.id
			  AND ((sp.user_id IS NOT NULL AND ap.user_id = sp.user_id) OR (sp.user_id IS NULL AND ap.guest_name = sp.guest_name))
			WHERE sp.session_id = $1 AND (sp.user_id::text = $2 OR sp.id::text = $2))`,
		sessionID, participantIDOrUserID,
	).Scan(&in)
	return in, err
}
