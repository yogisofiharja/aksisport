package db

import (
	"context"
	"errors"
	"math/rand"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/models"
)

const inviteCodeChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

func generateInviteCode() string {
	b := make([]byte, 5)
	for i := range b {
		b[i] = inviteCodeChars[rand.Intn(len(inviteCodeChars))]
	}
	return string(b)
}

const clubColumns = "id, name, description, invite_code, (avatar_image_data IS NOT NULL) AS has_avatar, created_by, created_at, updated_at"

func scanClub(row pgx.CollectableRow) (models.Club, error) {
	var c models.Club
	err := row.(pgx.Rows).Scan(&c.ID, &c.Name, &c.Description, &c.InviteCode, &c.HasAvatar, &c.CreatedBy, &c.CreatedAt, &c.UpdatedAt)
	return c, err
}

// isUniqueViolation reports whether err is a Postgres unique-constraint error.
func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

// CreateClub creates a club and adds the creator as its owner, retrying the
// invite code on the rare collision.
func CreateClub(ctx context.Context, pool *pgxpool.Pool, name string, description *string, ownerUserID string) (models.Club, error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return models.Club{}, err
	}
	defer tx.Rollback(ctx)

	var club models.Club
	for attempt := 0; attempt < 5; attempt++ {
		code := generateInviteCode()
		rows, err := tx.Query(ctx,
			"INSERT INTO clubs (name, description, invite_code, created_by) VALUES ($1, $2, $3, $4) RETURNING "+clubColumns,
			name, description, code, ownerUserID,
		)
		if err == nil {
			club, err = pgx.CollectOneRow(rows, scanClub)
			rows.Close()
		}
		if err == nil {
			break
		}
		if isUniqueViolation(err) && attempt < 4 {
			continue
		}
		return models.Club{}, err
	}

	if _, err := tx.Exec(ctx,
		"INSERT INTO club_members (club_id, user_id, role) VALUES ($1, $2, 'owner')",
		club.ID, ownerUserID,
	); err != nil {
		return models.Club{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return models.Club{}, err
	}
	return club, nil
}

func GetClub(ctx context.Context, pool *pgxpool.Pool, clubID string) (models.Club, error) {
	rows, err := pool.Query(ctx, "SELECT "+clubColumns+" FROM clubs WHERE id = $1", clubID)
	if err != nil {
		return models.Club{}, err
	}
	defer rows.Close()
	c, err := pgx.CollectOneRow(rows, scanClub)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Club{}, ErrNotFound
	}
	return c, err
}

func ListClubsForUser(ctx context.Context, pool *pgxpool.Pool, userID string) ([]models.ClubWithRole, error) {
	rows, err := pool.Query(ctx,
		`SELECT c.`+clubColumns+`, cm.role
		 FROM clubs c
		 JOIN club_members cm ON cm.club_id = c.id
		 WHERE cm.user_id = $1
		 ORDER BY c.created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []models.ClubWithRole{}
	for rows.Next() {
		var c models.ClubWithRole
		if err := rows.Scan(&c.ID, &c.Name, &c.Description, &c.InviteCode, &c.HasAvatar, &c.CreatedBy, &c.CreatedAt, &c.UpdatedAt, &c.Role); err != nil {
			return nil, err
		}
		result = append(result, c)
	}
	return result, rows.Err()
}

func UpdateClub(ctx context.Context, pool *pgxpool.Pool, clubID string, name, description *string) (models.Club, error) {
	rows, err := pool.Query(ctx,
		`UPDATE clubs SET
			name = COALESCE($2, name),
			description = COALESCE($3, description),
			updated_at = now()
		WHERE id = $1
		RETURNING `+clubColumns,
		clubID, name, description,
	)
	if err != nil {
		return models.Club{}, err
	}
	defer rows.Close()
	c, err := pgx.CollectOneRow(rows, scanClub)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Club{}, ErrNotFound
	}
	return c, err
}

// UploadClubAvatar sets a Club's profile picture — owner-only, enforced by
// the caller (clubs_handler.go) before this is reached.
func UploadClubAvatar(ctx context.Context, pool *pgxpool.Pool, clubID string, imageData []byte, contentType string) (models.Club, error) {
	rows, err := pool.Query(ctx,
		`UPDATE clubs SET
			avatar_image_data = $2,
			avatar_image_content_type = $3,
			updated_at = now()
		WHERE id = $1
		RETURNING `+clubColumns,
		clubID, imageData, contentType,
	)
	if err != nil {
		return models.Club{}, err
	}
	defer rows.Close()
	c, err := pgx.CollectOneRow(rows, scanClub)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Club{}, ErrNotFound
	}
	return c, err
}

// GetClubAvatarImage fetches a Club's profile picture bytes. Visibility is
// enforced by the caller (requireMember) — same access as the rest of the
// Club's data.
func GetClubAvatarImage(ctx context.Context, pool *pgxpool.Pool, clubID string) (models.AvatarImage, error) {
	var img models.AvatarImage
	var data []byte
	var contentType *string
	err := pool.QueryRow(ctx, "SELECT avatar_image_data, avatar_image_content_type FROM clubs WHERE id = $1", clubID).
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

func DeleteClub(ctx context.Context, pool *pgxpool.Pool, clubID string) error {
	tag, err := pool.Exec(ctx, "DELETE FROM clubs WHERE id = $1", clubID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

