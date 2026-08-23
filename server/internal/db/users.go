package db

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/models"
)

var ErrNotFound = errors.New("not found")
var ErrConflict = errors.New("conflict")

const userColumns = "id, firebase_uid, username, display_name, email, phone_number, avatar_url, created_at, updated_at"

func scanUser(row pgx.CollectableRow) (models.User, error) {
	var u models.User
	err := row.(pgx.Rows).Scan(&u.ID, &u.FirebaseUID, &u.Username, &u.DisplayName, &u.Email, &u.PhoneNumber, &u.AvatarURL, &u.CreatedAt, &u.UpdatedAt)
	return u, err
}

func GetUserByFirebaseUID(ctx context.Context, pool *pgxpool.Pool, firebaseUID string) (models.User, error) {
	rows, err := pool.Query(ctx, "SELECT "+userColumns+" FROM users WHERE firebase_uid = $1", firebaseUID)
	if err != nil {
		return models.User{}, err
	}
	defer rows.Close()
	u, err := pgx.CollectOneRow(rows, scanUser)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.User{}, ErrNotFound
	}
	return u, err
}

func GetUserByUsername(ctx context.Context, pool *pgxpool.Pool, username string) (models.User, error) {
	rows, err := pool.Query(ctx, "SELECT "+userColumns+" FROM users WHERE username = $1", username)
	if err != nil {
		return models.User{}, err
	}
	defer rows.Close()
	u, err := pgx.CollectOneRow(rows, scanUser)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.User{}, ErrNotFound
	}
	return u, err
}

func UsernameTaken(ctx context.Context, pool *pgxpool.Pool, username string) (bool, error) {
	var exists bool
	err := pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)", username).Scan(&exists)
	return exists, err
}

// SearchUsers returns users whose username or display name contains q
// (case-insensitive substring match), excluding excludeUserID (the
// caller — searching for yourself to add yourself somewhere never makes
// sense). Capped at 20, ordered by username. Returns the lean
// UserSummary shape, not the full User — unlike GetUserByUsername, this
// never exposes email/phone to the searching caller.
func SearchUsers(ctx context.Context, pool *pgxpool.Pool, q, excludeUserID string) ([]models.UserSummary, error) {
	rows, err := pool.Query(ctx,
		`SELECT id, username, display_name FROM users
		 WHERE id != $1 AND (username ILIKE '%' || $2 || '%' OR display_name ILIKE '%' || $2 || '%')
		 ORDER BY username ASC
		 LIMIT 20`,
		excludeUserID, q,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []models.UserSummary{}
	for rows.Next() {
		var u models.UserSummary
		if err := rows.Scan(&u.ID, &u.Username, &u.DisplayName); err != nil {
			return nil, err
		}
		result = append(result, u)
	}
	return result, rows.Err()
}

// CreateUser creates the user's profile row. Club membership is entirely
// separate — a new user starts with no clubs until they create or join one.
func CreateUser(ctx context.Context, pool *pgxpool.Pool, firebaseUID, username string, displayName *string) (models.User, error) {
	rows, err := pool.Query(ctx,
		"INSERT INTO users (firebase_uid, username, display_name) VALUES ($1, $2, $3) RETURNING "+userColumns,
		firebaseUID, username, displayName,
	)
	if err != nil {
		return models.User{}, err
	}
	defer rows.Close()
	return pgx.CollectOneRow(rows, scanUser)
}

type UserUpdate struct {
	DisplayName *string
	Email       *string
	PhoneNumber *string
	AvatarURL   *string
}

func UpdateUser(ctx context.Context, pool *pgxpool.Pool, id string, u UserUpdate) (models.User, error) {
	rows, err := pool.Query(ctx,
		`UPDATE users SET
			display_name = COALESCE($2, display_name),
			email = COALESCE($3, email),
			phone_number = COALESCE($4, phone_number),
			avatar_url = COALESCE($5, avatar_url),
			updated_at = now()
		WHERE id = $1
		RETURNING `+userColumns,
		id, u.DisplayName, u.Email, u.PhoneNumber, u.AvatarURL,
	)
	if err != nil {
		return models.User{}, err
	}
	defer rows.Close()
	user, err := pgx.CollectOneRow(rows, scanUser)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.User{}, ErrNotFound
	}
	return user, err
}
