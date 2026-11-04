package db

import (
	"context"
	"testing"
)

func TestVenues(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()
	host := testUser(t, pool, "venuehost")
	sid := endTestSession(t, pool, host)
	var clubID string
	_ = pool.QueryRow(ctx, "SELECT club_id FROM sessions WHERE id = $1", sid).Scan(&clubID)
	t.Cleanup(func() { pool.Exec(ctx, "DELETE FROM venues WHERE created_by = $1", host) })

	// The same typed name, any case or spacing, is one venue.
	a, err := TypedVenue(ctx, pool, "Zz Test Court  ", clubID, host)
	if err != nil {
		t.Fatal(err)
	}
	b, err := TypedVenue(ctx, pool, "zz test court", clubID, host)
	if err != nil {
		t.Fatal(err)
	}
	if a.ID != b.ID || a.Name != "Zz Test Court" {
		t.Fatalf("typed venues %+v %+v", a, b)
	}

	// A Google place is one venue; adding it again keeps the first name.
	g, err := AddGoogleVenue(ctx, pool, "zz-place-1", "Zz GBK Tennis", "", host)
	if err != nil {
		t.Fatal(err)
	}
	g2, err := AddGoogleVenue(ctx, pool, "zz-place-1", "Another name", "", host)
	if err != nil {
		t.Fatal(err)
	}
	if g.ID != g2.ID || g2.Name != "Zz GBK Tennis" || g.PlaceID == nil || *g.PlaceID != "zz-place-1" {
		t.Fatalf("google venues %+v %+v", g, g2)
	}

	// A Session at the Google venue carries its place ID; the most used
	// venue comes first.
	if _, err := UpdateSession(ctx, pool, sid, SessionUpdate{VenueID: &g.ID, Location: &g.Name}); err != nil {
		t.Fatal(err)
	}
	s, _ := GetSession(ctx, pool, sid)
	if s.VenueID == nil || *s.VenueID != g.ID || s.VenuePlaceID == nil || *s.VenuePlaceID != "zz-place-1" {
		t.Fatalf("session venue %v %v", s.VenueID, s.VenuePlaceID)
	}
	list, err := SearchVenues(ctx, pool, "zz", "", 8)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 2 || list[0].ID != g.ID || list[0].Uses != 1 {
		t.Fatalf("search %+v", list)
	}
	// LIKE wildcards in the query are literal.
	if list, _ := SearchVenues(ctx, pool, "%%", "", 8); len(list) != 0 {
		t.Fatalf("wildcard search matched %d", len(list))
	}
}
