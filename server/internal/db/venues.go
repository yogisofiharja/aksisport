package db

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/models"
)

// DP-031 Venues.

func likeEscape(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}

// SearchVenues: venues whose name contains query, the given town first,
// then the most used.
func SearchVenues(ctx context.Context, pool *pgxpool.Pool, query, cityCode string, limit int) ([]models.Venue, error) {
	rows, err := pool.Query(ctx, `
		SELECT v.id, v.name, v.google_place_id, count(s.id)::int
		FROM venues v LEFT JOIN sessions s ON s.venue_id = v.id
		WHERE v.name ILIKE '%' || $1 || '%'
		GROUP BY v.id
		ORDER BY (v.city_code IS NOT DISTINCT FROM NULLIF($2, '')) DESC, count(s.id) DESC, v.name
		LIMIT $3`, likeEscape(strings.TrimSpace(query)), cityCode, limit)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (models.Venue, error) {
		var v models.Venue
		err := row.Scan(&v.ID, &v.Name, &v.PlaceID, &v.Uses)
		return v, err
	})
}

func GetVenue(ctx context.Context, pool *pgxpool.Pool, id string) (models.Venue, error) {
	var v models.Venue
	err := pool.QueryRow(ctx, `SELECT id, name, google_place_id FROM venues WHERE id::text = $1`, id).Scan(&v.ID, &v.Name, &v.PlaceID)
	if errors.Is(err, pgx.ErrNoRows) {
		return v, ErrNotFound
	}
	return v, err
}

// AddGoogleVenue records a place picked from Google under the name the
// organizer confirmed. A place already on Aksi is returned as it is
// (its name stays).
func AddGoogleVenue(ctx context.Context, pool *pgxpool.Pool, placeID, name, cityCode, userID string) (models.Venue, error) {
	var v models.Venue
	err := pool.QueryRow(ctx, `
		INSERT INTO venues (name, google_place_id, city_code, created_by)
		VALUES (btrim($1), $2, NULLIF($3, ''), $4)
		ON CONFLICT (google_place_id) DO UPDATE SET google_place_id = EXCLUDED.google_place_id
		RETURNING id, name, google_place_id`, name, placeID, cityCode, userID,
	).Scan(&v.ID, &v.Name, &v.PlaceID)
	return v, err
}

// TypedVenue finds or adds the venue for a name typed by hand, in the
// Community's town: the same name in the same town is one venue.
func TypedVenue(ctx context.Context, pool *pgxpool.Pool, name, clubID, userID string) (models.Venue, error) {
	var v models.Venue
	err := pool.QueryRow(ctx, `
		WITH town AS (SELECT city_code FROM clubs WHERE id = $2),
		ins AS (
			INSERT INTO venues (name, city_code, created_by)
			SELECT btrim($1), (SELECT city_code FROM town), $3
			ON CONFLICT (lower(btrim(name)), COALESCE(city_code, '')) WHERE google_place_id IS NULL DO NOTHING
			RETURNING id, name, google_place_id
		)
		SELECT id, name, google_place_id FROM ins
		UNION ALL
		SELECT id, name, google_place_id FROM venues
		WHERE google_place_id IS NULL AND lower(btrim(name)) = lower(btrim($1))
			AND COALESCE(city_code, '') = COALESCE((SELECT city_code FROM town), '')
		LIMIT 1`, name, clubID, userID,
	).Scan(&v.ID, &v.Name, &v.PlaceID)
	return v, err
}
