package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/yogisofiharja/aksi-server/internal/authjwt"
	dbpkg "github.com/yogisofiharja/aksi-server/internal/db"
	"github.com/yogisofiharja/aksi-server/internal/mail"
	"github.com/yogisofiharja/aksi-server/internal/models"
	"github.com/yogisofiharja/aksi-server/internal/testdb"
)

// DP-032: organizers and Reguler members join without approval; paying
// is kept apart from the place, so some pay after playing.
func TestJoinStraightInAndPayLater(t *testing.T) {
	pool := testdb.Pool(t)
	ctx := context.Background()

	owner := apiTestUser(t, pool, "owner")
	admin := apiTestUser(t, pool, "admin")
	reguler := apiTestUser(t, pool, "reguler")
	plain := apiTestUser(t, pool, "plain")

	var clubID string
	if err := pool.QueryRow(ctx,
		"INSERT INTO clubs (name, invite_code, created_by) VALUES ('Pay later', $1, $2) RETURNING id",
		"PL-"+owner.id[:8], owner.id,
	).Scan(&clubID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { pool.Exec(ctx, "DELETE FROM clubs WHERE id = $1", clubID) })
	for _, m := range []struct{ id, role string }{{owner.id, "owner"}, {admin.id, "admin"}, {reguler.id, "member"}, {plain.id, "member"}} {
		if _, err := pool.Exec(ctx, "INSERT INTO club_members (club_id, user_id, role) VALUES ($1, $2, $3)", clubID, m.id, m.role); err != nil {
			t.Fatal(err)
		}
	}

	// Tomorrow, so the Check-In Window is closed.
	starts := time.Now().Add(24 * time.Hour)
	duration, price, name, location := 120, 50000, "Pay later", "Court"
	newSession := func(max *int) string {
		sess, err := dbpkg.CreateSession(ctx, pool, dbpkg.CreateSessionParams{
			ClubID: clubID, Sport: "tennis", Name: &name, Location: &location, CreatedBy: owner.id,
			StartsAt: &starts, DurationMinutes: &duration, MaxParticipants: max,
			PriceModel: "per_person", PricePerPerson: &price,
		})
		if err != nil {
			t.Fatal(err)
		}
		if _, err := pool.Exec(ctx, "UPDATE sessions SET status = 'open' WHERE id = $1", sess.ID); err != nil {
			t.Fatal(err)
		}
		return sess.ID
	}
	sessionID := newSession(nil)

	router := NewRouter(Deps{
		Pool:           pool,
		Verifier:       authjwt.NewStaticVerifier(map[string]string{owner.token: owner.uid, admin.token: admin.uid, reguler.token: reguler.uid, plain.token: plain.uid}),
		AllowedOrigins: "*",
		Mailer:         mail.LogMailer{},
	})
	call := func(u apiUser, method, path, body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+u.token)
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		return w
	}
	join := func(u apiUser, sid string) models.SessionParticipant {
		t.Helper()
		w := call(u, http.MethodPost, "/v1/sessions/"+sid+"/register", "{}")
		if w.Code != http.StatusOK {
			t.Fatalf("register = %d: %s", w.Code, w.Body.String())
		}
		var p models.SessionParticipant
		if err := json.Unmarshal(w.Body.Bytes(), &p); err != nil {
			t.Fatal(err)
		}
		return p
	}

	if w := call(owner, http.MethodPut, "/v1/clubs/"+clubID+"/members/"+reguler.id+"/reguler", `{"reguler":true}`); w.Code != http.StatusNoContent {
		t.Fatalf("tag Reguler = %d: %s", w.Code, w.Body.String())
	}
	if w := call(plain, http.MethodPut, "/v1/clubs/"+clubID+"/members/"+plain.id+"/reguler", `{"reguler":true}`); w.Code != http.StatusForbidden {
		t.Errorf("a member tagging themselves = %d, want 403", w.Code)
	}

	t.Run("an admin is in at once and hasn't paid", func(t *testing.T) {
		p := join(admin, sessionID)
		if p.Status != "registered" || p.Paid {
			t.Errorf("admin = %s paid=%v, want registered, not paid", p.Status, p.Paid)
		}
	})

	t.Run("pay after playing is off until the Community turns it on", func(t *testing.T) {
		other := newSession(nil)
		if p := join(reguler, other); p.Status != "waitlist" {
			t.Errorf("reguler by default = %s, want waitlist (pays first)", p.Status)
		}
		if w := call(owner, http.MethodPatch, "/v1/clubs/"+clubID, `{"regulerPayLater":true}`); w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `"regulerPayLater":true`) {
			t.Fatalf("turn on = %d %s", w.Code, w.Body.String())
		}
	})

	t.Run("a Reguler member is in at once and pays after", func(t *testing.T) {
		p := join(reguler, sessionID)
		if p.Status != "registered" || p.Paid {
			t.Errorf("reguler = %s paid=%v, want registered, not paid", p.Status, p.Paid)
		}
		w := call(owner, http.MethodPost, "/v1/sessions/"+sessionID+"/participants/"+reguler.id+"/confirm-payment", "{}")
		if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `"paid":true`) || !strings.Contains(w.Body.String(), `"status":"registered"`) {
			t.Errorf("confirm after = %d %s, want paid and still registered", w.Code, w.Body.String())
		}
		if w := call(owner, http.MethodPost, "/v1/sessions/"+sessionID+"/participants/"+reguler.id+"/confirm-payment", "{}"); w.Code != http.StatusConflict {
			t.Errorf("confirm twice = %d, want 409", w.Code)
		}
	})

	t.Run("anyone else still asks", func(t *testing.T) {
		if p := join(plain, sessionID); p.Status != "requested" {
			t.Errorf("plain member = %s, want requested", p.Status)
		}
	})

	t.Run("with pay later off, a Reguler skips approval but pays first", func(t *testing.T) {
		if w := call(owner, http.MethodPatch, "/v1/clubs/"+clubID, `{"regulerPayLater":false}`); w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `"regulerPayLater":false`) {
			t.Fatalf("turn off = %d %s", w.Code, w.Body.String())
		}
		other := newSession(nil)
		if p := join(reguler, other); p.Status != "waitlist" {
			t.Errorf("reguler = %s, want waitlist", p.Status)
		}
	})

	t.Run("a Full Session turns it back into a request", func(t *testing.T) {
		one := 1
		full := newSession(&one)
		if _, err := dbpkg.AddRegisteredParticipant(ctx, pool, full, plain.id); err != nil {
			t.Fatal(err)
		}
		if p := join(admin, full); p.Status != "requested" {
			t.Errorf("admin on a full Session = %s, want requested", p.Status)
		}
	})

	t.Run("the unpaid list waits for the start", func(t *testing.T) {
		var list []models.UnpaidSession
		w := call(admin, http.MethodGet, "/v1/me/unpaid", "")
		if err := json.Unmarshal(w.Body.Bytes(), &list); err != nil || len(list) != 0 {
			t.Fatalf("before the start = %s, want []", w.Body.String())
		}
		if _, err := pool.Exec(ctx, "UPDATE sessions SET starts_at = now() - interval '3 hours' WHERE id = $1", sessionID); err != nil {
			t.Fatal(err)
		}
		w = call(admin, http.MethodGet, "/v1/me/unpaid", "")
		if err := json.Unmarshal(w.Body.Bytes(), &list); err != nil {
			t.Fatal(err)
		}
		if len(list) != 1 || list[0].SessionID != sessionID || list[0].Amount == nil || *list[0].Amount != price {
			t.Errorf("after the start = %s, want this Session, amount %d", w.Body.String(), price)
		}
		// The Reguler paid already.
		w = call(reguler, http.MethodGet, "/v1/me/unpaid", "")
		if strings.Contains(w.Body.String(), sessionID) {
			t.Errorf("paid player still listed: %s", w.Body.String())
		}
	})
}
