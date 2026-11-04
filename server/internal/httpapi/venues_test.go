package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/yogisofiharja/aksi-server/internal/authjwt"
	"github.com/yogisofiharja/aksi-server/internal/mail"
	"github.com/yogisofiharja/aksi-server/internal/places"
	"github.com/yogisofiharja/aksi-server/internal/testdb"
)

// fakePlaces stands in for Google.
type fakePlaces struct{}

func (fakePlaces) Autocomplete(ctx context.Context, input, lang, token string) ([]places.Suggestion, error) {
	return []places.Suggestion{{PlaceID: "zz-P1", Name: "GBK Tennis", Address: "Senayan"}}, nil
}

func (fakePlaces) CheckPlace(ctx context.Context, placeID, token string) error {
	if placeID != "zz-P1" {
		return places.ErrNotFound
	}
	return nil
}

func TestVenueFlow(t *testing.T) {
	pool := testdb.Pool(t)
	ctx := context.Background()
	owner := apiTestUser(t, pool, "venueowner")
	t.Cleanup(func() { pool.Exec(ctx, "DELETE FROM venues WHERE created_by = $1", owner.id) })
	var clubID string
	if err := pool.QueryRow(ctx,
		"INSERT INTO clubs (name, invite_code, created_by) VALUES ('Venue test', $1, $2) RETURNING id", "VE-"+owner.id[:8], owner.id,
	).Scan(&clubID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { pool.Exec(ctx, "DELETE FROM clubs WHERE id = $1", clubID) })
	if _, err := pool.Exec(ctx, "INSERT INTO club_members (club_id, user_id, role) VALUES ($1, $2, 'owner')", clubID, owner.id); err != nil {
		t.Fatal(err)
	}

	newRouter := func(maps places.Searcher) http.Handler {
		return NewRouter(Deps{
			Pool:           pool,
			Verifier:       authjwt.NewStaticVerifier(map[string]string{owner.token: owner.uid}),
			AllowedOrigins: "*",
			Mailer:         mail.LogMailer{},
			Places:         maps,
		})
	}
	call := func(h http.Handler, method, path, body string, out any) int {
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+owner.token)
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, req)
		if out != nil {
			_ = json.Unmarshal(w.Body.Bytes(), out)
		}
		return w.Code
	}

	// Without a key, Google search says so; Aksi search still works.
	off := newRouter(nil)
	if got := call(off, http.MethodGet, "/v1/venues/google?q=gbk", "", nil); got != http.StatusServiceUnavailable {
		t.Fatalf("google search without a key = %d", got)
	}

	r := newRouter(fakePlaces{})
	var sugg []places.Suggestion
	if got := call(r, http.MethodGet, "/v1/venues/google?q=gbk&session=t1", "", &sugg); got != http.StatusOK || len(sugg) != 1 {
		t.Fatalf("google search %d %v", got, sugg)
	}
	if got := call(r, http.MethodPost, "/v1/venues", `{"placeId":"made-up","name":"X"}`, nil); got != http.StatusBadRequest {
		t.Fatalf("unknown place = %d", got)
	}
	var venue struct{ ID, Name string }
	if got := call(r, http.MethodPost, "/v1/venues", `{"placeId":"zz-P1","name":"  GBK Tennis, Court 3 "}`, &venue); got != http.StatusOK || venue.Name != "GBK Tennis, Court 3" {
		t.Fatalf("add venue %d %+v", got, venue)
	}

	// The fields every new Session needs, besides its venue.
	base := `"sport":"tennis","activityType":"single","startsAt":"2099-01-01T07:00:00Z","durationMinutes":60,"hostPlaying":true`

	// A Session at that venue takes its name and carries the place ID.
	var sess struct {
		Location     string  `json:"location"`
		VenueID      *string `json:"venueId"`
		VenuePlaceID *string `json:"venuePlaceId"`
	}
	body := `{` + base + `,"name":"Venue test","location":"anything","venueId":"` + venue.ID + `"}`
	if got := call(r, http.MethodPost, "/v1/clubs/"+clubID+"/sessions", body, &sess); got != http.StatusCreated && got != http.StatusOK {
		t.Fatalf("create session = %d", got)
	}
	if sess.Location != "GBK Tennis, Court 3" || sess.VenueID == nil || sess.VenuePlaceID == nil || *sess.VenuePlaceID != "zz-P1" {
		t.Fatalf("session %+v", sess)
	}

	// A typed venue becomes a venue too, and both are found by name.
	body = `{` + base + `,"name":"Venue test 2","location":"Zz Backyard Court"}`
	typed := sess
	typed.VenueID, typed.VenuePlaceID = nil, nil
	if got := call(r, http.MethodPost, "/v1/clubs/"+clubID+"/sessions", body, &typed); got != http.StatusCreated && got != http.StatusOK {
		t.Fatalf("create typed session = %d", got)
	}
	if typed.VenueID == nil || typed.VenuePlaceID != nil {
		t.Fatalf("typed session %+v", typed)
	}
	var found []struct{ Name string }
	call(r, http.MethodGet, "/v1/venues?q=court", "", &found)
	names := []string{}
	for _, v := range found {
		names = append(names, v.Name)
	}
	if !strings.Contains(strings.Join(names, "|"), "GBK Tennis, Court 3") || !strings.Contains(strings.Join(names, "|"), "Zz Backyard Court") {
		t.Fatalf("search found %v", names)
	}
	if got := call(r, http.MethodPost, "/v1/clubs/"+clubID+"/sessions", `{`+base+`,"name":"x","location":"y","venueId":"00000000-0000-0000-0000-000000000000"}`, nil); got != http.StatusBadRequest {
		t.Fatalf("unknown venue = %d", got)
	}
}
