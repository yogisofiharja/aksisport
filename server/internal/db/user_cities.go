package db

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5/pgxpool"
)

// DP-017: a User keeps several towns and has one active town at a time
// (users.city_code, always one of their user_cities rows). City codes are
// validated by the caller.

// MaxUserCities bounds how many towns one User keeps — generous for the
// real case (where they live, a hometown, a work city) while keeping the
// list a short choice rather than a growing log.
const MaxUserCities = 10

// ErrTooManyCities: adding would exceed MaxUserCities.
var ErrTooManyCities = errors.New("too many saved towns")

// AddUserCity saves a town for the user (idempotent). The first town a
// user saves becomes their active one; later ones don't change it.
func AddUserCity(ctx context.Context, pool *pgxpool.Pool, userID, cityCode string) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var count int
	var alreadySaved bool
	if err := tx.QueryRow(ctx,
		"SELECT count(*), coalesce(bool_or(city_code = $2), false) FROM user_cities WHERE user_id = $1", userID, cityCode,
	).Scan(&count, &alreadySaved); err != nil {
		return err
	}
	if !alreadySaved && count >= MaxUserCities {
		return ErrTooManyCities
	}
	if _, err := tx.Exec(ctx,
		"INSERT INTO user_cities (user_id, city_code) VALUES ($1, $2) ON CONFLICT DO NOTHING", userID, cityCode,
	); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx,
		"UPDATE users SET city_code = $2, updated_at = now() WHERE id = $1 AND city_code IS NULL", userID, cityCode,
	); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// SetActiveCity makes cityCode the user's active town, saving it first if
// it isn't one of theirs yet (so picking a new place from Explore is one
// step). Subject to MaxUserCities like AddUserCity.
func SetActiveCity(ctx context.Context, pool *pgxpool.Pool, userID, cityCode string) error {
	if err := AddUserCity(ctx, pool, userID, cityCode); err != nil {
		return err
	}
	_, err := pool.Exec(ctx, "UPDATE users SET city_code = $2, updated_at = now() WHERE id = $1", userID, cityCode)
	return err
}

// RemoveUserCity forgets one of the user's towns. If it was the active
// one, the most recently saved remaining town becomes active — or none,
// if it was the last.
func RemoveUserCity(ctx context.Context, pool *pgxpool.Pool, userID, cityCode string) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, "DELETE FROM user_cities WHERE user_id = $1 AND city_code = $2", userID, cityCode); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx,
		`UPDATE users SET updated_at = now(), city_code = (
			SELECT city_code FROM user_cities WHERE user_id = $1 ORDER BY created_at DESC, city_code LIMIT 1
		 ) WHERE id = $1 AND city_code = $2`,
		userID, cityCode,
	); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
