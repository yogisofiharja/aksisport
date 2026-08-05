package db

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/models"
)

const skillLevelColumns = "id, sport, slug, name, rank, created_at, updated_at"

func scanSkillLevel(row pgx.CollectableRow) (models.SkillLevel, error) {
	var l models.SkillLevel
	err := row.(pgx.Rows).Scan(&l.ID, &l.Sport, &l.Slug, &l.Name, &l.Rank, &l.CreatedAt, &l.UpdatedAt)
	return l, err
}

// ListSkillLevels returns one Sport's Level Scale, ordered lowest to
// highest rank.
func ListSkillLevels(ctx context.Context, pool *pgxpool.Pool, sport string) ([]models.SkillLevel, error) {
	rows, err := pool.Query(ctx, "SELECT "+skillLevelColumns+" FROM skill_levels WHERE sport = $1 ORDER BY rank ASC", sport)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []models.SkillLevel{}
	for rows.Next() {
		l, err := scanSkillLevel(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, l)
	}
	return result, rows.Err()
}

func GetSkillLevelByID(ctx context.Context, pool *pgxpool.Pool, id string) (models.SkillLevel, error) {
	rows, err := pool.Query(ctx, "SELECT "+skillLevelColumns+" FROM skill_levels WHERE id = $1", id)
	if err != nil {
		return models.SkillLevel{}, err
	}
	defer rows.Close()
	l, err := pgx.CollectOneRow(rows, scanSkillLevel)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.SkillLevel{}, ErrNotFound
	}
	return l, err
}
