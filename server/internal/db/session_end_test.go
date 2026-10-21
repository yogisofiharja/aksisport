package db

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

// endTestSession makes a Community and an In Progress tennis Session
// hosted (and umpired) by host; removed afterwards with its matches.
func endTestSession(t *testing.T, pool *pgxpool.Pool, host string) string {
	t.Helper()
	ctx := context.Background()
	var clubID string
	if err := pool.QueryRow(ctx,
		"INSERT INTO clubs (name, invite_code, created_by) VALUES ('Session end test', $1, $2) RETURNING id", "SE-"+host[:8], host,
	).Scan(&clubID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { pool.Exec(ctx, "DELETE FROM clubs WHERE id = $1", clubID) })
	name, location := "Session end test", "Court"
	sess, err := CreateSession(ctx, pool, CreateSessionParams{ClubID: clubID, Sport: "tennis", Name: &name, Location: &location, CreatedBy: host, HostPlaying: true})
	if err != nil {
		t.Fatal(err)
	}
	if err := SetSessionStatus(ctx, pool, sess.ID, "in_progress"); err != nil {
		t.Fatal(err)
	}
	return sess.ID
}

func endTestMatch(t *testing.T, pool *pgxpool.Pool, sessionID, user string) string {
	t.Helper()
	a, err := CreateActivity(context.Background(), pool, sessionID, "tennis", json.RawMessage(`{}`), []ActivityParticipantInput{{UserID: &user}}, user)
	if err != nil {
		t.Fatal(err)
	}
	return a.ID
}

func TestCompleteElapsedSessionMarksQueuedNotPlayed(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()
	host := testUser(t, pool, "host")
	sid := endTestSession(t, pool, host)
	queued := endTestMatch(t, pool, sid, host)
	live := endTestMatch(t, pool, sid, host)
	if _, err := StartActivity(ctx, pool, live, host); err != nil {
		t.Fatal(err)
	}

	n, err := CompleteElapsedSession(ctx, pool, sid)
	if err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("not played = %d, want 1", n)
	}
	sess, _ := GetSession(ctx, pool, sid)
	if sess.Status != "completed" {
		t.Fatalf("session status = %q", sess.Status)
	}
	q, _ := GetActivity(ctx, pool, queued)
	l, _ := GetActivity(ctx, pool, live)
	if q.Status != "not_played" || l.Status != "live" {
		t.Fatalf("queued → %q, live → %q; want not_played, live", q.Status, l.Status)
	}
	// A Not played match never starts.
	if _, err := StartActivity(ctx, pool, queued, host); err != ErrConflict {
		t.Fatalf("starting a not-played match: err = %v, want ErrConflict", err)
	}
}
