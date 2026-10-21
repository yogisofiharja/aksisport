package db

import (
	"context"
	"encoding/json"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

// These run against a real database (with migrations applied) when
// TEST_DATABASE_URL is set; they create their own users, Community and
// Session and remove them afterwards.
func testPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL is not set")
	}
	pool, err := pgxpool.New(context.Background(), url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	return pool
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
