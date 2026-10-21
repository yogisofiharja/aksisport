package db

import (
	"context"
	"encoding/json"
	"testing"
)

// What a player's summary counts (DP-019, DP-025, DP-027): only completed
// matches; a draw is played but neither a win nor a loss; Unfinished and
// Not played matches don't count at all.
func TestPlayerSummaryCounts(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()
	me := testUser(t, pool, "me")

	var clubID string
	if err := pool.QueryRow(ctx,
		"INSERT INTO clubs (name, invite_code, created_by) VALUES ('Stats test', $1, $2) RETURNING id", "ST-"+me[:8], me,
	).Scan(&clubID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { pool.Exec(ctx, "DELETE FROM clubs WHERE id = $1", clubID) })
	name, location := "Stats test", "Court"
	sess, err := CreateSession(ctx, pool, CreateSessionParams{ClubID: clubID, Sport: "tennis", Name: &name, Location: &location, CreatedBy: me, HostPlaying: true})
	if err != nil {
		t.Fatal(err)
	}

	teamA := "A"
	add := func(status, result string) {
		t.Helper()
		a, err := CreateActivity(ctx, pool, sess.ID, "tennis", json.RawMessage(`{}`), []ActivityParticipantInput{{UserID: &me, Team: &teamA}}, me)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := pool.Exec(ctx, "UPDATE activities SET status = $2, result = $3::jsonb WHERE id = $1", a.ID, status, result); err != nil {
			t.Fatal(err)
		}
	}
	add("completed", `{"winner":"A"}`)
	add("completed", `{"winner":"A"}`)
	add("completed", `{"winner":"B"}`)
	add("completed", `{"winner":null}`)
	add("unfinished", `{"winner":"A"}`)
	add("not_played", `null`)

	got, err := GetPlayerSportActivity(ctx, pool, me, "tennis")
	if err != nil {
		t.Fatal(err)
	}
	s := got.Summary
	if s.MatchesPlayed != 4 || s.Wins != 2 || s.Losses != 1 {
		t.Fatalf("played/wins/losses = %d/%d/%d, want 4/2/1", s.MatchesPlayed, s.Wins, s.Losses)
	}
	if len(got.Matches) != 4 {
		t.Fatalf("history lists %d matches, want the 4 completed ones", len(got.Matches))
	}
}
