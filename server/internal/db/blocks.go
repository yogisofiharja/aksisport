package db

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/models"
)

// DP-021 blocking: one-directional and silent.

func BlockUser(ctx context.Context, pool *pgxpool.Pool, blockerID, blockedID string) error {
	_, err := pool.Exec(ctx,
		"INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", blockerID, blockedID)
	return err
}

func UnblockUser(ctx context.Context, pool *pgxpool.Pool, blockerID, blockedID string) error {
	_, err := pool.Exec(ctx, "DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2", blockerID, blockedID)
	return err
}

// HasBlocked reports whether blocker has blocked blocked.
func HasBlocked(ctx context.Context, pool *pgxpool.Pool, blockerID, blockedID string) (bool, error) {
	var exists bool
	err := pool.QueryRow(ctx,
		"SELECT EXISTS (SELECT 1 FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2)", blockerID, blockedID,
	).Scan(&exists)
	return exists, err
}

// BlockersOf is which of the given users have blocked userID.
func BlockersOf(ctx context.Context, pool *pgxpool.Pool, userID string, among []string) (map[string]bool, error) {
	rows, err := pool.Query(ctx,
		"SELECT blocker_id FROM user_blocks WHERE blocked_id = $1 AND blocker_id = ANY($2)", userID, among)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := map[string]bool{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		result[id] = true
	}
	return result, rows.Err()
}

// BlockedBy is which of the given users userID has blocked.
func BlockedBy(ctx context.Context, pool *pgxpool.Pool, userID string, among []string) (map[string]bool, error) {
	rows, err := pool.Query(ctx,
		"SELECT blocked_id FROM user_blocks WHERE blocker_id = $1 AND blocked_id = ANY($2)", userID, among)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := map[string]bool{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		result[id] = true
	}
	return result, rows.Err()
}

func ListMyBlocks(ctx context.Context, pool *pgxpool.Pool, userID string) ([]models.BlockedUser, error) {
	rows, err := pool.Query(ctx,
		`SELECT u.id, u.username, u.display_name, (u.avatar_image_data IS NOT NULL), b.created_at
		 FROM user_blocks b JOIN users u ON u.id = b.blocked_id
		 WHERE b.blocker_id = $1 ORDER BY b.created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []models.BlockedUser{}
	for rows.Next() {
		var b models.BlockedUser
		if err := rows.Scan(&b.UserID, &b.Username, &b.DisplayName, &b.HasAvatar, &b.BlockedAt); err != nil {
			return nil, err
		}
		result = append(result, b)
	}
	return result, rows.Err()
}
