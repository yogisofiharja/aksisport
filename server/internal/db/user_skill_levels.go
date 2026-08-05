package db

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/models"
)

const userSkillLevelColumns = "usl.user_id, usl.sport, usl.skill_level_id, sl.slug, sl.name, sl.rank, usl.updated_at"
const userSkillLevelJoin = "FROM user_skill_levels usl JOIN skill_levels sl ON sl.id = usl.skill_level_id"

func scanUserSkillLevel(row pgx.CollectableRow) (models.UserSkillLevel, error) {
	var u models.UserSkillLevel
	err := row.(pgx.Rows).Scan(&u.UserID, &u.Sport, &u.SkillLevelID, &u.SkillLevelSlug, &u.SkillLevelName, &u.SkillLevelRank, &u.UpdatedAt)
	return u, err
}

// ListMySkillLevels returns every sport a user has self-reported a level
// for.
func ListMySkillLevels(ctx context.Context, pool *pgxpool.Pool, userID string) ([]models.UserSkillLevel, error) {
	rows, err := pool.Query(ctx,
		"SELECT "+userSkillLevelColumns+" "+userSkillLevelJoin+" WHERE usl.user_id = $1 ORDER BY usl.sport",
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []models.UserSkillLevel{}
	for rows.Next() {
		u, err := scanUserSkillLevel(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, u)
	}
	return result, rows.Err()
}

// GetSkillLevelForUserAndSport returns ErrNotFound if the user hasn't
// self-reported a level for this sport yet — this is what a Strict-mode
// registration check calls (DP-008).
func GetSkillLevelForUserAndSport(ctx context.Context, pool *pgxpool.Pool, userID, sport string) (models.UserSkillLevel, error) {
	rows, err := pool.Query(ctx,
		"SELECT "+userSkillLevelColumns+" "+userSkillLevelJoin+" WHERE usl.user_id = $1 AND usl.sport = $2",
		userID, sport,
	)
	if err != nil {
		return models.UserSkillLevel{}, err
	}
	defer rows.Close()
	u, err := pgx.CollectOneRow(rows, scanUserSkillLevel)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.UserSkillLevel{}, ErrNotFound
	}
	return u, err
}

// SetSkillLevel upserts the caller's self-reported level for a sport
// (DP-008: players may update their own level at any time). skillLevelID
// must belong to `sport`'s own scale — validated here, not just left to
// the FK, since the FK alone can't catch "right level row, wrong sport."
func SetSkillLevel(ctx context.Context, pool *pgxpool.Pool, userID, sport, skillLevelID string) (models.UserSkillLevel, error) {
	level, err := GetSkillLevelByID(ctx, pool, skillLevelID)
	if err != nil {
		return models.UserSkillLevel{}, err
	}
	if level.Sport != sport {
		return models.UserSkillLevel{}, ErrConflict
	}

	if _, err := pool.Exec(ctx,
		`INSERT INTO user_skill_levels (user_id, sport, skill_level_id)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (user_id, sport) DO UPDATE SET skill_level_id = excluded.skill_level_id, updated_at = now()`,
		userID, sport, skillLevelID,
	); err != nil {
		return models.UserSkillLevel{}, err
	}
	return GetSkillLevelForUserAndSport(ctx, pool, userID, sport)
}
