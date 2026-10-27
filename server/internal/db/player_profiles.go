package db

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/models"
)

// CanViewPlayerProfile is DP-019's visibility rule: yourself; anyone you
// share a Club with; and, for a Club's owner/admins, anyone with a pending
// request to join that Club. DP-028 adds Session-only participants: people
// in the same Session see each other, and a Club's owner/admins see anyone
// taking part in one of its Sessions.
func CanViewPlayerProfile(ctx context.Context, pool *pgxpool.Pool, viewerID, targetID string) (bool, error) {
	if viewerID == targetID {
		return true, nil
	}
	var ok bool
	err := pool.QueryRow(ctx,
		`SELECT EXISTS(
			SELECT 1 FROM club_members mine JOIN club_members theirs ON theirs.club_id = mine.club_id
			WHERE mine.user_id = $1 AND theirs.user_id = $2
		) OR EXISTS(
			SELECT 1 FROM club_join_requests r JOIN club_members mine ON mine.club_id = r.club_id
			WHERE r.user_id = $2 AND r.status = 'pending' AND mine.user_id = $1 AND mine.role IN ('owner', 'admin')
		) OR EXISTS(
			SELECT 1 FROM session_participants a JOIN session_participants b ON b.session_id = a.session_id
			WHERE a.user_id = $1 AND b.user_id = $2
		) OR EXISTS(
			SELECT 1 FROM session_participants p JOIN sessions s ON s.id = p.session_id
			JOIN club_members mine ON mine.club_id = s.club_id
			WHERE p.user_id = $2 AND mine.user_id = $1 AND mine.role IN ('owner', 'admin')
		)`,
		viewerID, targetID,
	).Scan(&ok)
	return ok, err
}

func GetPlayerProfile(ctx context.Context, pool *pgxpool.Pool, userID string) (models.PlayerProfile, error) {
	var p models.PlayerProfile
	err := pool.QueryRow(ctx,
		`SELECT id, username, display_name, (avatar_image_data IS NOT NULL), `+isOnlineExpr+`, created_at
		 FROM users WHERE id = $1`,
		userID,
	).Scan(&p.ID, &p.Username, &p.DisplayName, &p.HasAvatar, &p.IsOnline, &p.JoinedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.PlayerProfile{}, ErrNotFound
	}
	if err != nil {
		return models.PlayerProfile{}, err
	}
	levels, err := ListMySkillLevels(ctx, pool, userID)
	if err != nil {
		return models.PlayerProfile{}, err
	}
	p.SkillLevels = levels
	return p, nil
}
