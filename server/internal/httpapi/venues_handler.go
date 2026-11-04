package httpapi

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/authjwt"
	dbpkg "github.com/yogisofiharja/aksi-server/internal/db"
	"github.com/yogisofiharja/aksi-server/internal/places"
)

const (
	venueSearchLimit = 8
	venueNameMax     = 120
)

// resolveVenue (DP-031) settles where a Session or Schedule is played
// before it is saved. A venueId names an Aksi venue and its name becomes
// the location. A location typed by hand finds or adds the matching
// venue in the Community's town. Neither: nothing changes.
func resolveVenue(c *gin.Context, pool *pgxpool.Pool, clubID string, venueID, location *string) (*string, *string, bool) {
	if venueID != nil && *venueID != "" {
		v, err := dbpkg.GetVenue(c.Request.Context(), pool, *venueID)
		if errors.Is(err, dbpkg.ErrNotFound) {
			respondError(c, http.StatusBadRequest, "unknown venue")
			return nil, nil, false
		}
		if err != nil {
			respondInternal(c, err)
			return nil, nil, false
		}
		return &v.ID, &v.Name, true
	}
	if location == nil || strings.TrimSpace(*location) == "" {
		return nil, location, true
	}
	if len([]rune(strings.TrimSpace(*location))) > venueNameMax {
		respondError(c, http.StatusBadRequest, "location is too long")
		return nil, nil, false
	}
	v, err := dbpkg.TypedVenue(c.Request.Context(), pool, *location, clubID, authjwt.CurrentUser(c).ID)
	if err != nil {
		respondInternal(c, err)
		return nil, nil, false
	}
	return &v.ID, &v.Name, true
}

// RegisterVenueRoutes: DP-031. maps is nil when no Google key is set;
// the Google search then answers 503 MAPS_UNAVAILABLE and the app offers
// Aksi's own venues and typing only.
func RegisterVenueRoutes(rg *gin.RouterGroup, pool *pgxpool.Pool, verifier *authjwt.Verifier, maps places.Searcher, ips ClientIPResolver) {
	authed := rg.Group("")
	authed.Use(authjwt.RequireAuth(verifier))
	authed.Use(authjwt.RequireProfile(pool))

	authed.GET("/venues", func(c *gin.Context) {
		q := strings.TrimSpace(c.Query("q"))
		if len([]rune(q)) < 2 {
			c.JSON(http.StatusOK, []any{})
			return
		}
		city := ""
		if u := authjwt.CurrentUser(c); u.CityCode != nil {
			city = *u.CityCode
		}
		list, err := dbpkg.SearchVenues(c.Request.Context(), pool, q, city, venueSearchLimit)
		if err != nil {
			respondInternal(c, err)
			return
		}
		c.JSON(http.StatusOK, list)
	})

	// Google's suggestions, shown and never stored. Rate limited per
	// address on top of the daily quota set in Google Cloud.
	authed.GET("/venues/google", rateLimited(ips, 60, time.Minute), func(c *gin.Context) {
		if maps == nil {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"error": "map search is not available", "code": "MAPS_UNAVAILABLE"})
			return
		}
		q := strings.TrimSpace(c.Query("q"))
		if len([]rune(q)) < 2 || len([]rune(q)) > venueNameMax {
			c.JSON(http.StatusOK, []any{})
			return
		}
		lang := "id"
		if c.Query("lang") == "en" {
			lang = "en"
		}
		list, err := maps.Autocomplete(c.Request.Context(), q, lang, c.Query("session"))
		if err != nil {
			respondInternal(c, err)
			return
		}
		c.JSON(http.StatusOK, list)
	})

	// Adds a Google place under the name the organizer confirmed, or
	// returns the venue it already is.
	authed.POST("/venues", func(c *gin.Context) {
		var body struct {
			PlaceID      string `json:"placeId"`
			Name         string `json:"name"`
			SessionToken string `json:"sessionToken"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			respondError(c, http.StatusBadRequest, "invalid body")
			return
		}
		name := strings.TrimSpace(body.Name)
		if body.PlaceID == "" || name == "" || len([]rune(name)) > venueNameMax || len(body.PlaceID) > 300 {
			respondError(c, http.StatusBadRequest, "placeId and a name of up to 120 characters are required")
			return
		}
		if maps == nil {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"error": "map search is not available", "code": "MAPS_UNAVAILABLE"})
			return
		}
		if err := maps.CheckPlace(c.Request.Context(), body.PlaceID, body.SessionToken); errors.Is(err, places.ErrNotFound) {
			respondError(c, http.StatusBadRequest, "unknown place")
			return
		} else if err != nil {
			respondInternal(c, err)
			return
		}
		user := authjwt.CurrentUser(c)
		city := ""
		if user.CityCode != nil {
			city = *user.CityCode
		}
		v, err := dbpkg.AddGoogleVenue(c.Request.Context(), pool, body.PlaceID, name, city, user.ID)
		if err != nil {
			respondInternal(c, err)
			return
		}
		c.JSON(http.StatusOK, v)
	})
}
