package db

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/models"
)

const sessionColumns = "id, club_id, sport, name, location, court_count, status, max_participants, default_match_format, created_by, created_at, updated_at"

func scanSession(row pgx.CollectableRow) (models.Session, error) {
	var s models.Session
	err := row.(pgx.Rows).Scan(&s.ID, &s.ClubID, &s.Sport, &s.Name, &s.Location, &s.CourtCount, &s.Status, &s.MaxParticipants, &s.DefaultMatchFormat, &s.CreatedBy, &s.CreatedAt, &s.UpdatedAt)
	return s, err
}

// CreateSessionParams groups the optional, DP-003/DP-004 fields alongside
// the original required ones, rather than growing CreateSession's
// positional-argument list further.
type CreateSessionParams struct {
	ClubID             string
	Sport              string
	Name               *string
	Location           *string
	CourtCount         int
	MaxParticipants    *int
	DefaultMatchFormat []byte
	CreatedBy          string
}

func CreateSession(ctx context.Context, pool *pgxpool.Pool, p CreateSessionParams) (models.Session, error) {
	name := p.Name
	if name == nil {
		generated := "Session on " + time.Now().Format("Jan 2, 2006")
		name = &generated
	}
	courtCount := p.CourtCount
	if courtCount <= 0 {
		courtCount = 1
	}
	rows, err := pool.Query(ctx,
		`INSERT INTO sessions (club_id, sport, name, location, court_count, max_participants, default_match_format, created_by)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING `+sessionColumns,
		p.ClubID, p.Sport, name, p.Location, courtCount, p.MaxParticipants, p.DefaultMatchFormat, p.CreatedBy,
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

// ListSessionsForClub excludes 'draft' sessions unless includeDrafts is
// true — DP-001: a draft session "should not be visible or joinable by
// club members," only its owner/admin creators.
func ListSessionsForClub(ctx context.Context, pool *pgxpool.Pool, clubID string, includeDrafts bool) ([]models.Session, error) {
	query := "SELECT " + sessionColumns + " FROM sessions WHERE club_id = $1"
	if !includeDrafts {
		query += " AND status != 'draft'"
	}
	query += " ORDER BY created_at DESC"
	rows, err := pool.Query(ctx, query, clubID)
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
	Name               *string
	Location           *string
	Status             *string
	MaxParticipants    *int
	DefaultMatchFormat []byte
}

func UpdateSession(ctx context.Context, pool *pgxpool.Pool, sessionID string, u SessionUpdate) (models.Session, error) {
	rows, err := pool.Query(ctx,
		`UPDATE sessions SET
			name = COALESCE($2, name),
			location = COALESCE($3, location),
			status = COALESCE($4, status),
			max_participants = COALESCE($5, max_participants),
			default_match_format = COALESCE($6, default_match_format),
			updated_at = now()
		WHERE id = $1
		RETURNING `+sessionColumns,
		sessionID, u.Name, u.Location, u.Status, u.MaxParticipants, u.DefaultMatchFormat,
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
