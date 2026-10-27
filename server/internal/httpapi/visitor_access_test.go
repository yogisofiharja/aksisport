package httpapi

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/authjwt"
	dbpkg "github.com/yogisofiharja/aksi-server/internal/db"
	"github.com/yogisofiharja/aksi-server/internal/mail"
	"github.com/yogisofiharja/aksi-server/internal/testdb"
)

// Club routes a non-member may use on purpose: the preview, joining (and
// withdrawing their own request), and the picture.
var openClubRoutes = map[string]bool{
	"GET /v1/clubs/:clubId/preview":         true,
	"POST /v1/clubs/:clubId/join":           true,
	"DELETE /v1/clubs/:clubId/join-request": true,
	"GET /v1/clubs/:clubId/avatar":          true,
}

// DP-028: a Session-only participant sees that one Session and nothing of
// its Community. Every /clubs/:clubId route is driven as them and must
// answer 403, so a new club route that forgets its membership check fails
// here.
func TestSessionVisitorAccess(t *testing.T) {
	pool := testdb.Pool(t)
	ctx := context.Background()

	owner := apiTestUser(t, pool, "owner")
	visitor := apiTestUser(t, pool, "visitor")
	stranger := apiTestUser(t, pool, "stranger")

	var clubID string
	if err := pool.QueryRow(ctx,
		"INSERT INTO clubs (name, invite_code, created_by, visibility) VALUES ('Visitor test', $1, $2, 'private') RETURNING id",
		"VT-"+owner.id[:8], owner.id,
	).Scan(&clubID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { pool.Exec(ctx, "DELETE FROM clubs WHERE id = $1", clubID) })
	if _, err := pool.Exec(ctx, "INSERT INTO club_members (club_id, user_id, role) VALUES ($1, $2, 'owner')", clubID, owner.id); err != nil {
		t.Fatal(err)
	}
	name, location := "Visitor test", "Court"
	sess, err := dbpkg.CreateSession(ctx, pool, dbpkg.CreateSessionParams{ClubID: clubID, Sport: "tennis", Name: &name, Location: &location, CreatedBy: owner.id, HostPlaying: true})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, "UPDATE sessions SET status = 'open' WHERE id = $1", sess.ID); err != nil {
		t.Fatal(err)
	}
	// A real schedule, so its routes get past "not found" to the
	// membership check.
	var scheduleID string
	if err := pool.QueryRow(ctx,
		`INSERT INTO recurring_schedules (club_id, sport, recurrence_rule, generation_lead_days, created_by)
		 VALUES ($1, 'tennis', '{"weekday":6,"time":"07:00","durationMinutes":60,"timezone":"UTC"}', 3, $2) RETURNING id`,
		clubID, owner.id,
	).Scan(&scheduleID); err != nil {
		t.Fatal(err)
	}
	if _, err := dbpkg.RecordInvitation(ctx, pool, owner.id, visitor.id, dbpkg.InviteTargetSession, sess.ID, clubID, "app", nil); err != nil {
		t.Fatal(err)
	}

	router := NewRouter(Deps{
		Pool:           pool,
		Verifier:       authjwt.NewStaticVerifier(map[string]string{owner.token: owner.uid, visitor.token: visitor.uid, stranger.token: stranger.uid}),
		AllowedOrigins: "*",
		Mailer:         mail.LogMailer{},
	})
	call := func(u apiUser, method, path string) int {
		req := httptest.NewRequest(method, path, strings.NewReader("{}"))
		req.Header.Set("Authorization", "Bearer "+u.token)
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		return w.Code
	}

	t.Run("the invited visitor sees the Session and can ask for a spot", func(t *testing.T) {
		for _, path := range []string{"/v1/sessions/" + sess.ID, "/v1/sessions/" + sess.ID + "/participants", "/v1/sessions/" + sess.ID + "/bank-accounts", "/v1/sessions/" + sess.ID + "/messages", "/v1/sessions/" + sess.ID + "/activities"} {
			if got := call(visitor, http.MethodGet, path); got != http.StatusOK {
				t.Errorf("GET %s = %d, want 200", path, got)
			}
		}
		if got := call(visitor, http.MethodPost, "/v1/sessions/"+sess.ID+"/register"); got != http.StatusOK {
			t.Errorf("register = %d, want 200", got)
		}
	})

	t.Run("someone neither invited nor playing doesn't see it", func(t *testing.T) {
		if got := call(stranger, http.MethodGet, "/v1/sessions/"+sess.ID); got != http.StatusForbidden {
			t.Errorf("GET session = %d, want 403", got)
		}
	})

	t.Run("the visitor can't do an organizer's job in the Session", func(t *testing.T) {
		if got := call(visitor, http.MethodPost, "/v1/sessions/"+sess.ID+"/invite-link/reset"); got != http.StatusForbidden {
			t.Errorf("reset = %d, want 403", got)
		}
		// DP-028: members invite; a Session-only participant doesn't.
		if got := call(visitor, http.MethodGet, "/v1/sessions/"+sess.ID+"/invite-link"); got != http.StatusForbidden {
			t.Errorf("invite link = %d, want 403", got)
		}
	})

	t.Run("every Community route answers 403 to the visitor", func(t *testing.T) {
		checked := 0
		for _, r := range router.Routes() {
			if !strings.HasPrefix(r.Path, "/v1/clubs/:clubId") || openClubRoutes[r.Method+" "+r.Path] {
				continue
			}
			path := strings.ReplaceAll(r.Path, ":clubId", clubID)
			path = strings.ReplaceAll(path, "recurring-schedules/:id", "recurring-schedules/"+scheduleID)
			for _, param := range []string{":requestId", ":userId", ":accountId", ":reportId", ":messageId"} {
				path = strings.ReplaceAll(path, param, "00000000-0000-0000-0000-000000000000")
			}
			if got := call(visitor, r.Method, path); got != http.StatusForbidden {
				t.Errorf("%s %s = %d, want 403", r.Method, r.Path, got)
			}
			checked++
		}
		if checked < 20 {
			t.Fatalf("only %d club routes checked — did the route list change?", checked)
		}
	})
}

type apiUser struct{ id, uid, token string }

func apiTestUser(t *testing.T, pool *pgxpool.Pool, name string) apiUser {
	t.Helper()
	ctx := context.Background()
	uid := "test-" + name + "-" + t.Name()
	var id string
	if err := pool.QueryRow(ctx,
		"INSERT INTO users (firebase_uid, username) VALUES ($1, $2) RETURNING id", uid, strings.ToLower(name+"_"+uid[len(uid)-6:]),
	).Scan(&id); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { pool.Exec(ctx, "DELETE FROM users WHERE id = $1", id) })
	return apiUser{id: id, uid: uid, token: "token-" + name}
}
