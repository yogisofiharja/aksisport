package db

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/models"
)

const sessionColumns = "id, club_id, sport, name, location, court_count, status, created_by, created_at, updated_at"

func scanSession(row pgx.CollectableRow) (models.Session, error) {
	var s models.Session
	err := row.(pgx.Rows).Scan(&s.ID, &s.ClubID, &s.Sport, &s.Name, &s.Location, &s.CourtCount, &s.Status, &s.CreatedBy, &s.CreatedAt, &s.UpdatedAt)
	return s, err
}

func CreateSession(ctx context.Context, pool *pgxpool.Pool, clubID, sport string, name, location *string, courtCount int, createdBy string) (models.Session, error) {
	if name == nil {
		generated := "Session on " + time.Now().Format("Jan 2, 2006")
		name = &generated
	}
	if courtCount <= 0 {
		courtCount = 1
	}
	rows, err := pool.Query(ctx,
		`INSERT INTO sessions (club_id, sport, name, location, court_count, created_by)
		 VALUES ($1, $2, $3, $4, $5, $6) RETURNING `+sessionColumns,
		clubID, sport, name, location, courtCount, createdBy,
	)
	if err != nil {
		return models.Session{}, err
	}
	defer rows.Close()
	return pgx.CollectOneRow(rows, scanSession)
}

func GetSession(ctx context.Context, pool *pgxpool.Pool, sessionID string) (models.Session, error) {
	rows, err := pool.Query(ctx, "SELECT "+sessionColumns+" FROM sessions WHERE id = $1", sessionID)
	if err != nil {
		return models.Session{}, err
	}
	defer rows.Close()
	s, err := pgx.CollectOneRow(rows, scanSession)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Session{}, ErrNotFound
	}
	return s, err
}

func ListSessionsForClub(ctx context.Context, pool *pgxpool.Pool, clubID string) ([]models.Session, error) {
	rows, err := pool.Query(ctx, "SELECT "+sessionColumns+" FROM sessions WHERE club_id = $1 ORDER BY created_at DESC", clubID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []models.Session{}
	for rows.Next() {
		s, err := scanSession(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, s)
	}
	return result, rows.Err()
}

type SessionUpdate struct {
	Name     *string
	Location *string
	Status   *string
}

func UpdateSession(ctx context.Context, pool *pgxpool.Pool, sessionID string, u SessionUpdate) (models.Session, error) {
	rows, err := pool.Query(ctx,
		`UPDATE sessions SET
			name = COALESCE($2, name),
			location = COALESCE($3, location),
			status = COALESCE($4, status),
			updated_at = now()
		WHERE id = $1
		RETURNING `+sessionColumns,
		sessionID, u.Name, u.Location, u.Status,
	)
	if err != nil {
		return models.Session{}, err
	}
	defer rows.Close()
	s, err := pgx.CollectOneRow(rows, scanSession)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Session{}, ErrNotFound
	}
	return s, err
}
