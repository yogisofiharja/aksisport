package scheduling

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/db"
	"github.com/yogisofiharja/aksi-server/internal/testdb"
)

func gracePool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	return testdb.Pool(t)
}

type fakeScores struct {
	state json.RawMessage
	err   error
}

func (f fakeScores) LastScore(context.Context, string) (json.RawMessage, json.RawMessage, bool, error) {
	if f.err != nil {
		return nil, nil, false, f.err
	}
	return f.state, json.RawMessage(`[]`), true, nil
}

// A Completed Session that ended `ago` ago with one live match; returns
// the match id.
func graceSession(t *testing.T, pool *pgxpool.Pool, ago time.Duration) string {
	t.Helper()
	ctx := context.Background()
	var host, clubID string
	tag := t.Name() + "-" + ago.String()
	if err := pool.QueryRow(ctx, "INSERT INTO users (firebase_uid, username) VALUES ($1, $2) RETURNING id", "test-"+tag, "test-"+tag).Scan(&host); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, "INSERT INTO clubs (name, invite_code, created_by) VALUES ('Grace test', $1, $2) RETURNING id", "GR-"+host[:8], host).Scan(&clubID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		pool.Exec(ctx, "DELETE FROM clubs WHERE id = $1", clubID)
		pool.Exec(ctx, "DELETE FROM users WHERE id = $1", host)
	})
	name, location, minutes := "Grace test", "Court", 60
	start := time.Now().Add(-ago - time.Hour)
	sess, err := db.CreateSession(ctx, pool, db.CreateSessionParams{ClubID: clubID, Sport: "tennis", Name: &name, Location: &location, CreatedBy: host, HostPlaying: true, StartsAt: &start, DurationMinutes: &minutes})
	if err != nil {
		t.Fatal(err)
	}
	a, err := db.CreateActivity(ctx, pool, sess.ID, "tennis", json.RawMessage(`{}`), []db.ActivityParticipantInput{{UserID: &host}}, host)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.StartActivity(ctx, pool, a.ID, host); err != nil {
		t.Fatal(err)
	}
	if err := db.SetSessionStatus(ctx, pool, sess.ID, "completed"); err != nil {
		t.Fatal(err)
	}
	return a.ID
}

func TestUnfinishOverdueMatches(t *testing.T) {
	pool := gracePool(t)
	ctx := context.Background()
	inGrace := graceSession(t, pool, 30*time.Minute)
	overdue := graceSession(t, pool, 2*time.Hour)
	fallback := graceSession(t, pool, 3*time.Hour)

	score := json.RawMessage(`{"games":{"A":3,"B":2}}`)
	reader := perMatch{overdue: fakeScores{state: score}, fallback: fakeScores{err: errors.New("firebase down")}}
	// Only this test's matches, in case another test left some behind.
	run := func() int {
		t.Helper()
		all, err := db.ListOverdueLiveMatches(ctx, pool)
		if err != nil {
			t.Fatal(err)
		}
		var mine []db.OverdueLiveMatch
		for _, m := range all {
			if m.ActivityID == inGrace || m.ActivityID == overdue || m.ActivityID == fallback {
				mine = append(mine, m)
			}
		}
		return saveUnfinished(ctx, pool, reader, mine)
	}

	if n := run(); n != 2 {
		t.Fatalf("saved %d, want 2", n)
	}
	a, _ := db.GetActivity(ctx, pool, inGrace)
	if a.Status != "live" {
		t.Fatalf("inside the grace hour: %q, want live", a.Status)
	}
	a, _ = db.GetActivity(ctx, pool, overdue)
	if a.Status != "unfinished" || string(a.Result) != `{"games": {"A": 3, "B": 2}}` {
		t.Fatalf("overdue: %q %s, want unfinished with the live score", a.Status, a.Result)
	}
	a, _ = db.GetActivity(ctx, pool, fallback)
	if a.Status != "unfinished" {
		t.Fatalf("live score unreadable: %q, want unfinished with the server's state", a.Status)
	}

	// Idempotent: nothing left to change.
	if n := run(); n != 0 {
		t.Fatalf("second run saved %d, want 0", n)
	}
}

// perMatch answers each match from its own fake.
type perMatch map[string]LiveScores

func (p perMatch) LastScore(ctx context.Context, id string) (json.RawMessage, json.RawMessage, bool, error) {
	if f, ok := p[id]; ok {
		return f.LastScore(ctx, id)
	}
	return nil, nil, false, nil
}
