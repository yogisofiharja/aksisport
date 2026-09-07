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

// isOnlineExpr: no push/websocket presence exists anywhere in this app —
// "online" is derived from last_active_at (stamped by
// authjwt.RequireProfile on every authenticated request) rather than a
// stored boolean requiring explicit online/offline transitions. 2 minutes
// is an engineering choice (DP-ARCH-004), not a product requirement.
const isOnlineExpr = "(last_active_at IS NOT NULL AND last_active_at > now() - interval '2 minutes')"

const userColumns = "id, firebase_uid, username, display_name, email, phone_number, avatar_url, (avatar_image_data IS NOT NULL) AS has_avatar, " + isOnlineExpr + " AS is_online, created_at, updated_at"

func scanUser(row pgx.CollectableRow) (models.User, error) {
	var u models.User
	err := row.(pgx.Rows).Scan(&u.ID, &u.FirebaseUID, &u.Username, &u.DisplayName, &u.Email, &u.PhoneNumber, &u.AvatarURL, &u.HasAvatar, &u.IsOnline, &u.CreatedAt, &u.UpdatedAt)
	return u, err
}

// TouchUserActivity stamps last_active_at — called fire-and-forget from
// authjwt.RequireProfile on every authenticated request, not awaited by
// the handler it's protecting.
func TouchUserActivity(ctx context.Context, pool *pgxpool.Pool, userID string) error {
	_, err := pool.Exec(ctx, "UPDATE users SET last_active_at = now() WHERE id = $1", userID)
	return err
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
		`SELECT id, username, display_name, (avatar_image_data IS NOT NULL) AS has_avatar, `+isOnlineExpr+` AS is_online FROM users
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
		if err := rows.Scan(&u.ID, &u.Username, &u.DisplayName, &u.HasAvatar, &u.IsOnline); err != nil {
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

// UploadUserAvatar sets a User's own profile picture — self-service only,
// enforced by the caller (users_handler.go) via the authenticated caller's
// own id, never a userId path param.
func UploadUserAvatar(ctx context.Context, pool *pgxpool.Pool, userID string, imageData []byte, contentType string) (models.User, error) {
	rows, err := pool.Query(ctx,
		`UPDATE users SET
			avatar_image_data = $2,
			avatar_image_content_type = $3,
			updated_at = now()
		WHERE id = $1
		RETURNING `+userColumns,
		userID, imageData, contentType,
	)
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

// GetUserAvatarImage fetches a User's profile picture bytes. Visible to any
// authenticated user with a profile — same broad visibility as the
// username/displayName it's paired with everywhere (search results,
// member lists, organizer names), not restricted to shared-club members.
func GetUserAvatarImage(ctx context.Context, pool *pgxpool.Pool, userID string) (models.AvatarImage, error) {
	var img models.AvatarImage
	var data []byte
	var contentType *string
	err := pool.QueryRow(ctx, "SELECT avatar_image_data, avatar_image_content_type FROM users WHERE id = $1", userID).
		Scan(&data, &contentType)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.AvatarImage{}, ErrNotFound
	}
	if err != nil {
		return models.AvatarImage{}, err
	}
	if data == nil || contentType == nil {
		return models.AvatarImage{}, ErrNotFound
	}
	img.Data = data
	img.ContentType = *contentType
	return img, nil
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
