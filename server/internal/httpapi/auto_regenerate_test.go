package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/yogisofiharja/aksi-server/internal/authjwt"
	dbpkg "github.com/yogisofiharja/aksi-server/internal/db"
	"github.com/yogisofiharja/aksi-server/internal/mail"
	"github.com/yogisofiharja/aksi-server/internal/testdb"
)

// DP-005 (2026-11-05): once a Session has started, the server rebuilds
// its queued matches from who is checked in when someone checks in, or
// leaves while still in a queued match.
func TestQueueRegeneratesOnCheckInAndEarlyCheckOut(t *testing.T) {
	pool := testdb.Pool(t)
	ctx := context.Background()

	owner := apiTestUser(t, pool, "owner")
	names := []string{"a", "b", "c", "d", "late", "absent"}
	players := map[string]apiUser{}
	for _, n := range names {
		players[n] = apiTestUser(t, pool, n)
	}

	var clubID string
	if err := pool.QueryRow(ctx,
		"INSERT INTO clubs (name, invite_code, created_by) VALUES ('Regen', $1, $2) RETURNING id", "RG-"+owner.id[:8], owner.id,
	).Scan(&clubID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { pool.Exec(ctx, "DELETE FROM clubs WHERE id = $1", clubID) })
	if _, err := pool.Exec(ctx, "INSERT INTO club_members (club_id, user_id, role) VALUES ($1, $2, 'owner')", clubID, owner.id); err != nil {
		t.Fatal(err)
	}

	started := time.Now().Add(-30 * time.Minute)
	duration, name, location := 180, "Regen", "Court"
	sess, err := dbpkg.CreateSession(ctx, pool, dbpkg.CreateSessionParams{
		ClubID: clubID, Sport: "tennis", Name: &name, Location: &location, CreatedBy: owner.id,
		StartsAt: &started, DurationMinutes: &duration,
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, "UPDATE sessions SET status = 'in_progress', activity_type = 'single' WHERE id = $1", sess.ID); err != nil {
		t.Fatal(err)
	}
	tokens := map[string]string{owner.token: owner.uid}
	for _, n := range names {
		u := players[n]
		if _, err := pool.Exec(ctx, "INSERT INTO club_members (club_id, user_id, role) VALUES ($1, $2, 'member')", clubID, u.id); err != nil {
			t.Fatal(err)
		}
		status := "checked_in"
		if n == "late" || n == "absent" {
			status = "registered"
		}
		if _, err := pool.Exec(ctx, "INSERT INTO session_participants (session_id, user_id, status) VALUES ($1, $2, $3)", sess.ID, u.id, status); err != nil {
			t.Fatal(err)
		}
		tokens[u.token] = u.uid
	}
	team := func(s string) *string { return &s }
	for _, pair := range [][2]string{{"a", "b"}, {"c", "d"}} {
		first, second := players[pair[0]].id, players[pair[1]].id
		if _, err := dbpkg.CreateActivity(ctx, pool, sess.ID, "tennis", json.RawMessage(`{}`), []dbpkg.ActivityParticipantInput{
			{UserID: &first, Team: team("A")}, {UserID: &second, Team: team("B")},
		}, owner.id); err != nil {
			t.Fatal(err)
		}
	}

	router := NewRouter(Deps{Pool: pool, Verifier: authjwt.NewStaticVerifier(tokens), AllowedOrigins: "*", Mailer: mail.LogMailer{}})
	post := func(u apiUser, path string) {
		t.Helper()
		req := httptest.NewRequest(http.MethodPost, path, strings.NewReader("{}"))
		req.Header.Set("Authorization", "Bearer "+u.token)
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("POST %s = %d: %s", path, w.Code, w.Body.String())
		}
	}
	// The queue: its match ids, and everyone in it.
	queue := func() (string, map[string]bool) {
		t.Helper()
		acts, err := dbpkg.ListActivitiesForSession(ctx, pool, sess.ID)
		if err != nil {
			t.Fatal(err)
		}
		var ids []string
		in := map[string]bool{}
		for _, a := range acts {
			if a.Status != "queued" {
				continue
			}
			ids = append(ids, a.ID)
			for _, p := range a.Participants {
				in[*p.UserID] = true
			}
		}
		sort.Strings(ids)
		return strings.Join(ids, ","), in
	}

	before, _ := queue()
	post(players["late"], "/v1/sessions/"+sess.ID+"/checkin")
	after, in := queue()
	if after == before || strings.Count(after, ",") != 1 {
		t.Fatalf("a late check-in didn't rebuild a 2-match queue: before %q, after %q", before, after)
	}
	if in[players["absent"].id] {
		t.Error("a registered player who isn't here was put in a match")
	}

	// Five here, four places: someone sits out. Their leaving changes
	// nothing.
	var idle string
	for _, n := range []string{"a", "b", "c", "d", "late"} {
		if !in[players[n].id] {
			idle = n
		}
	}
	post(players[idle], "/v1/sessions/"+sess.ID+"/checkout")
	if again, _ := queue(); again != after {
		t.Errorf("checking out with no match left rebuilt the queue")
	}

	var leaving string
	for _, n := range []string{"a", "b", "c", "d", "late"} {
		if n != idle && in[players[n].id] {
			leaving = n
			break
		}
	}
	post(players[leaving], "/v1/sessions/"+sess.ID+"/checkout")
	final, finalIn := queue()
	if final == after {
		t.Error("checking out with a match to play didn't rebuild the queue")
	}
	if finalIn[players[leaving].id] || finalIn[players[idle].id] {
		t.Error("someone who left is still in a queued match")
	}
}
