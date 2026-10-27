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

// DP-028: a Session-only participant (not a member of the Community) has
// their matches counted like anyone's, and joining the Community later
// changes nothing.
func TestSessionVisitorStatsCount(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()
	owner := testUser(t, pool, "owner")
	visitor := testUser(t, pool, "visitor")
	clubID := testClub(t, pool, owner, "private")

	name, location := "Visitor stats", "Court"
	sess, err := CreateSession(ctx, pool, CreateSessionParams{ClubID: clubID, Sport: "tennis", Name: &name, Location: &location, CreatedBy: owner, HostPlaying: true})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx,
		"INSERT INTO session_participants (session_id, user_id, status) VALUES ($1, $2, 'checked_in')", sess.ID, visitor,
	); err != nil {
		t.Fatal(err)
	}
	teamA, teamB := "A", "B"
	a, err := CreateActivity(ctx, pool, sess.ID, "tennis", json.RawMessage(`{}`),
		[]ActivityParticipantInput{{UserID: &visitor, Team: &teamA}, {UserID: &owner, Team: &teamB}}, owner)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `UPDATE activities SET status = 'completed', result = '{"winner":"A"}' WHERE id = $1`, a.ID); err != nil {
		t.Fatal(err)
	}

	check := func(when string) {
		t.Helper()
		got, err := GetPlayerSportActivity(ctx, pool, visitor, "tennis")
		if err != nil {
			t.Fatal(err)
		}
		if got.Summary.MatchesPlayed != 1 || got.Summary.Wins != 1 || len(got.Matches) != 1 {
			t.Fatalf("%s: played/wins/history = %d/%d/%d, want 1/1/1", when, got.Summary.MatchesPlayed, got.Summary.Wins, len(got.Matches))
		}
	}
	check("as a non-member")
	testMember(t, pool, clubID, visitor, "member")
	check("after joining the Community")
}
