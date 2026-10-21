package db

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/testdb"
)

// Database tests run against the test binary's own database
// (internal/testdb, see main_test.go), never the dev database.
func testPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	return testdb.Pool(t)
}

func testUser(t *testing.T, pool *pgxpool.Pool, name string) string {
	t.Helper()
	ctx := context.Background()
	var id string
	uniq := name + "-" + t.Name()
	if err := pool.QueryRow(ctx,
		"INSERT INTO users (firebase_uid, username) VALUES ($1, $2) RETURNING id", "test-"+uniq, "test-"+uniq,
	).Scan(&id); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { pool.Exec(ctx, "DELETE FROM users WHERE id = $1", id) })
	return id
}

func TestSessionUmpire(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()
	host := testUser(t, pool, "host")
	player := testUser(t, pool, "player")

	var clubID string
	if err := pool.QueryRow(ctx,
		"INSERT INTO clubs (name, invite_code, created_by) VALUES ('Umpire test', $1, $2) RETURNING id", "UT-"+host[:8], host,
	).Scan(&clubID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { pool.Exec(ctx, "DELETE FROM clubs WHERE id = $1", clubID) })

	name, location := "Umpire test", "Court"
	sess, err := CreateSession(ctx, pool, CreateSessionParams{ClubID: clubID, Sport: "tennis", Name: &name, Location: &location, CreatedBy: host, HostPlaying: true})
	if err != nil {
		t.Fatal(err)
	}

	t.Run("the host is the default umpire", func(t *testing.T) {
		if sess.UmpireUserID != host {
			t.Fatalf("umpire = %q, want the host %q", sess.UmpireUserID, host)
		}
		if sess.UmpireName == nil || *sess.UmpireName == "" {
			t.Fatal("umpire name is empty")
		}
	})

	config := json.RawMessage(`{}`)
	live, err := CreateActivity(ctx, pool, sess.ID, "tennis", config, []ActivityParticipantInput{{UserID: &player}}, host)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := StartActivity(ctx, pool, live.ID, host); err != nil {
		t.Fatal(err)
	}
	queued, err := CreateActivity(ctx, pool, sess.ID, "tennis", config, []ActivityParticipantInput{{UserID: &player}}, host)
	if err != nil {
		t.Fatal(err)
	}

	t.Run("assigning hands live matches to the new umpire", func(t *testing.T) {
		ids, err := SetSessionUmpire(ctx, pool, sess.ID, player)
		if err != nil {
			t.Fatal(err)
		}
		if len(ids) != 1 || ids[0] != live.ID {
			t.Fatalf("live matches handed over = %v, want [%s]", ids, live.ID)
		}
		got, _ := GetSession(ctx, pool, sess.ID)
		if got.UmpireUserID != player {
			t.Fatalf("umpire = %q, want %q", got.UmpireUserID, player)
		}
		a, _ := GetActivity(ctx, pool, live.ID)
		if a.ScorerUserID == nil || *a.ScorerUserID != player {
			t.Fatalf("live scorer = %v, want %q", a.ScorerUserID, player)
		}
		q, _ := GetActivity(ctx, pool, queued.ID)
		if q.ScorerUserID != nil {
			t.Fatalf("queued match got a scorer: %v", *q.ScorerUserID)
		}
	})

	t.Run("ending early saves the match as unfinished", func(t *testing.T) {
		other, err := CreateActivity(ctx, pool, sess.ID, "tennis", config, []ActivityParticipantInput{{UserID: &player}}, host)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := StartActivity(ctx, pool, other.ID, player); err != nil {
			t.Fatal(err)
		}
		a, err := EndActivityEarly(ctx, pool, other.ID, json.RawMessage(`{"games":{"A":2,"B":1}}`), json.RawMessage(`[]`))
		if err != nil {
			t.Fatal(err)
		}
		if a.Status != "unfinished" || a.CompletedAt == nil {
			t.Fatalf("status = %q, completedAt = %v", a.Status, a.CompletedAt)
		}
		if _, err := EndActivityEarly(ctx, pool, other.ID, json.RawMessage(`{}`), nil); err != ErrConflict {
			t.Fatalf("ending it again: err = %v, want ErrConflict", err)
		}
	})

	t.Run("reclaiming hands them back", func(t *testing.T) {
		if _, err := SetSessionUmpire(ctx, pool, sess.ID, host); err != nil {
			t.Fatal(err)
		}
		a, _ := GetActivity(ctx, pool, live.ID)
		if a.ScorerUserID == nil || *a.ScorerUserID != host {
			t.Fatalf("live scorer = %v, want %q", a.ScorerUserID, host)
		}
	})
}
