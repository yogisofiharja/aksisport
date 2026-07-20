package db

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/models"
)

const membershipColumns = "club_id, user_id, role, joined_at"

func scanMembership(row pgx.CollectableRow) (models.ClubMember, error) {
	var m models.ClubMember
	err := row.(pgx.Rows).Scan(&m.ClubID, &m.UserID, &m.Role, &m.JoinedAt)
	return m, err
}

func scanMembershipWithUser(row pgx.CollectableRow) (models.ClubMember, error) {
	var m models.ClubMember
	err := row.(pgx.Rows).Scan(&m.ClubID, &m.UserID, &m.Role, &m.JoinedAt, &m.Username, &m.DisplayName, &m.AvatarURL)
	return m, err
}

func GetMembership(ctx context.Context, pool *pgxpool.Pool, clubID, userID string) (models.ClubMember, error) {
	rows, err := pool.Query(ctx,
		"SELECT "+membershipColumns+" FROM club_members WHERE club_id = $1 AND user_id = $2",
		clubID, userID,
	)
	if err != nil {
		return models.ClubMember{}, err
	}
	defer rows.Close()
	m, err := pgx.CollectOneRow(rows, scanMembership)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.ClubMember{}, ErrNotFound
	}
	return m, err
}

func ListMembers(ctx context.Context, pool *pgxpool.Pool, clubID string) ([]models.ClubMember, error) {
	rows, err := pool.Query(ctx,
		`SELECT cm.club_id, cm.user_id, u.username, u.display_name, u.avatar_url, cm.role, cm.joined_at
		 FROM club_members cm
		 JOIN users u ON u.id = cm.user_id
		 WHERE cm.club_id = $1
		 ORDER BY cm.role = 'owner' DESC, cm.role = 'admin' DESC, cm.joined_at ASC`,
		clubID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []models.ClubMember{}
	for rows.Next() {
		var m models.ClubMember
		if err := rows.Scan(&m.ClubID, &m.UserID, &m.Username, &m.DisplayName, &m.AvatarURL, &m.Role, &m.JoinedAt); err != nil {
			return nil, err
		}
		result = append(result, m)
	}
	return result, rows.Err()
}

// JoinClubByCode adds userID as a member of the club identified by
// inviteCode. Idempotent: if already a member, returns the existing
// membership without error.
func JoinClubByCode(ctx context.Context, pool *pgxpool.Pool, inviteCode, userID string) (models.Club, error) {
	club, err := GetClubByInviteCode(ctx, pool, inviteCode)
	if err != nil {
		return models.Club{}, err
	}

	if _, err := GetMembership(ctx, pool, club.ID, userID); err == nil {
		return club, nil // already a member
	} else if !errors.Is(err, ErrNotFound) {
		return models.Club{}, err
	}

	if _, err := pool.Exec(ctx,
		"INSERT INTO club_members (club_id, user_id, role, invited_by) VALUES ($1, $2, 'member', NULL)",
		club.ID, userID,
	); err != nil {
		return models.Club{}, err
	}
	return club, nil
}

// AddMemberByUsername directly adds a user to a club by username (owner action).
func AddMemberByUsername(ctx context.Context, pool *pgxpool.Pool, clubID, username, invitedBy string) (models.ClubMember, error) {
	user, err := GetUserByUsername(ctx, pool, username)
	if err != nil {
		return models.ClubMember{}, err
	}

	if _, err := GetMembership(ctx, pool, clubID, user.ID); err == nil {
		return models.ClubMember{}, ErrConflict
	} else if !errors.Is(err, ErrNotFound) {
		return models.ClubMember{}, err
	}

	rows, err := pool.Query(ctx,
		`INSERT INTO club_members (club_id, user_id, role, invited_by) VALUES ($1, $2, 'member', $3)
		 RETURNING `+membershipColumns,
		clubID, user.ID, invitedBy,
	)
	if err != nil {
		return models.ClubMember{}, err
	}
	m, err := pgx.CollectOneRow(rows, scanMembership)
	rows.Close()
	if err != nil {
		return models.ClubMember{}, err
	}
	m.Username = user.Username
	m.DisplayName = user.DisplayName
	m.AvatarURL = user.AvatarURL
	return m, nil
}

// ChangeMemberRole updates a membership's role between 'member' and 'admin'
// only — promoting/demoting an 'owner' is not supported here.
func ChangeMemberRole(ctx context.Context, pool *pgxpool.Pool, clubID, userID, role string) (models.ClubMember, error) {
	rows, err := pool.Query(ctx,
		`WITH updated AS (
			UPDATE club_members SET role = $3
			WHERE club_id = $1 AND user_id = $2 AND role != 'owner'
			RETURNING club_id, user_id, role, joined_at
		 )
		 SELECT updated.club_id, updated.user_id, updated.role, updated.joined_at, u.username, u.display_name, u.avatar_url
		 FROM updated JOIN users u ON u.id = updated.user_id`,
		clubID, userID, role,
	)
	if err != nil {
		return models.ClubMember{}, err
	}
	defer rows.Close()
	m, err := pgx.CollectOneRow(rows, scanMembershipWithUser)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.ClubMember{}, ErrNotFound
	}
	return m, err
}

func CountOwners(ctx context.Context, pool *pgxpool.Pool, clubID string) (int, error) {
	var count int
	err := pool.QueryRow(ctx, "SELECT COUNT(*) FROM club_members WHERE club_id = $1 AND role = 'owner'", clubID).Scan(&count)
	return count, err
}

func RemoveMember(ctx context.Context, pool *pgxpool.Pool, clubID, userID string) error {
	tag, err := pool.Exec(ctx, "DELETE FROM club_members WHERE club_id = $1 AND user_id = $2", clubID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
