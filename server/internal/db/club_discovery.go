package db

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/models"
)

// DP-017 Community Discovery & Joining.

// clubPreviewSelect produces a ClubPreview as seen by the user in $1:
// their role if they are a member, and whether they have a request
// pending. Callers append a WHERE (their own params start at $2).
var clubPreviewSelect = `SELECT c.id, c.name, c.description, c.city_code, ` + cityNameExpr("c") + `, c.visibility,
	(c.avatar_image_data IS NOT NULL),
	(SELECT count(*) FROM club_members m WHERE m.club_id = c.id) AS member_count,
	(SELECT m.role FROM club_members m WHERE m.club_id = c.id AND m.user_id = $1),
	EXISTS(SELECT 1 FROM club_join_requests r WHERE r.club_id = c.id AND r.user_id = $1 AND r.status = 'pending')
	FROM clubs c`

func scanClubPreview(row pgx.CollectableRow) (models.ClubPreview, error) {
	var p models.ClubPreview
	err := row.(pgx.Rows).Scan(&p.ID, &p.Name, &p.Description, &p.CityCode, &p.CityName, &p.Visibility, &p.HasAvatar, &p.MemberCount, &p.ViewerRole, &p.ViewerRequestPending)
	return p, err
}

func GetClubPreview(ctx context.Context, pool *pgxpool.Pool, viewerID, clubID string) (models.ClubPreview, error) {
	rows, err := pool.Query(ctx, clubPreviewSelect+" WHERE c.id = $2", viewerID, clubID)
	if err != nil {
		return models.ClubPreview{}, err
	}
	defer rows.Close()
	p, err := pgx.CollectOneRow(rows, scanClubPreview)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.ClubPreview{}, ErrNotFound
	}
	return p, err
}

// SearchClubs matches q against a Club's name, or the name of its city or
// province (case-insensitive substring) — so "bandung" finds Clubs called
// that and Clubs located there. Private Clubs are included: DP-017 gates
// joining, not finding. Clubs whose own name matches come first, then
// larger Clubs. Capped at 20.
func SearchClubs(ctx context.Context, pool *pgxpool.Pool, viewerID, q string) ([]models.ClubPreview, error) {
	rows, err := pool.Query(ctx,
		clubPreviewSelect+`
		 WHERE c.name ILIKE '%' || $2 || '%'
		    OR EXISTS(SELECT 1 FROM cities ci JOIN provinces pr ON pr.code = ci.province_code
		              WHERE ci.code = c.city_code AND (ci.name ILIKE '%' || $2 || '%' OR pr.name ILIKE '%' || $2 || '%'))
		 ORDER BY (c.name ILIKE '%' || $2 || '%') DESC, member_count DESC, c.name ASC
		 LIMIT 20`,
		viewerID, q,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []models.ClubPreview{}
	for rows.Next() {
		p, err := scanClubPreview(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, p)
	}
	return result, rows.Err()
}

// JoinClub is the self-service way in (DP-017). A public Club adds the
// user as a member straight away; a private one records a pending join
// request. Both are idempotent: already a member, or already waiting,
// changes nothing. ErrNotFound if the Club doesn't exist.
func JoinClub(ctx context.Context, pool *pgxpool.Pool, clubID, userID string) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var visibility string
	err = tx.QueryRow(ctx, "SELECT visibility FROM clubs WHERE id = $1", clubID).Scan(&visibility)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}

	var isMember bool
	if err := tx.QueryRow(ctx,
		"SELECT EXISTS(SELECT 1 FROM club_members WHERE club_id = $1 AND user_id = $2)", clubID, userID,
	).Scan(&isMember); err != nil {
		return err
	}
	if isMember {
		return nil
	}

	if visibility == "private" {
		if _, err := tx.Exec(ctx,
			`INSERT INTO club_join_requests (club_id, user_id) VALUES ($1, $2)
			 ON CONFLICT (club_id, user_id) WHERE status = 'pending' DO NOTHING`,
			clubID, userID,
		); err != nil {
			return err
		}
		return tx.Commit(ctx)
	}

	if _, err := tx.Exec(ctx,
		"INSERT INTO club_members (club_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING",
		clubID, userID,
	); err != nil {
		return err
	}
	// Joining outright settles any request left over from when the Club
	// was private.
	if _, err := tx.Exec(ctx,
		`UPDATE club_join_requests SET status = 'approved', decided_at = now()
		 WHERE club_id = $1 AND user_id = $2 AND status = 'pending'`,
		clubID, userID,
	); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// CancelJoinRequest withdraws the caller's own pending request, if any.
func CancelJoinRequest(ctx context.Context, pool *pgxpool.Pool, clubID, userID string) error {
	_, err := pool.Exec(ctx,
		`UPDATE club_join_requests SET status = 'cancelled', decided_at = now()
		 WHERE club_id = $1 AND user_id = $2 AND status = 'pending'`,
		clubID, userID,
	)
	return err
}

// ListPendingJoinRequests returns a Club's pending requests, oldest first.
func ListPendingJoinRequests(ctx context.Context, pool *pgxpool.Pool, clubID string) ([]models.ClubJoinRequest, error) {
	rows, err := pool.Query(ctx,
		`SELECT r.id, r.club_id, r.user_id, u.username, u.display_name, (u.avatar_image_data IS NOT NULL), r.created_at
		 FROM club_join_requests r
		 JOIN users u ON u.id = r.user_id
		 WHERE r.club_id = $1 AND r.status = 'pending'
		 ORDER BY r.created_at ASC`,
		clubID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []models.ClubJoinRequest{}
	for rows.Next() {
		var r models.ClubJoinRequest
		if err := rows.Scan(&r.ID, &r.ClubID, &r.UserID, &r.Username, &r.DisplayName, &r.HasAvatar, &r.CreatedAt); err != nil {
			return nil, err
		}
		result = append(result, r)
	}
	return result, rows.Err()
}

// DecideJoinRequest approves or declines one pending request of this
// Club. Approving adds the requester as a member in the same transaction.
// ErrNotFound if there is no such pending request (wrong Club, already
// decided, or cancelled by the requester meanwhile).
func DecideJoinRequest(ctx context.Context, pool *pgxpool.Pool, clubID, requestID, decidedBy string, approve bool) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	status := "declined"
	if approve {
		status = "approved"
	}
	var userID string
	err = tx.QueryRow(ctx,
		`UPDATE club_join_requests SET status = $4, decided_at = now(), decided_by = $3
		 WHERE id = $2 AND club_id = $1 AND status = 'pending'
		 RETURNING user_id`,
		clubID, requestID, decidedBy, status,
	).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if approve {
		if _, err := tx.Exec(ctx,
			"INSERT INTO club_members (club_id, user_id, role, invited_by) VALUES ($1, $2, 'member', $3) ON CONFLICT DO NOTHING",
			clubID, userID, decidedBy,
		); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// ListClubsInCity backs Explore's list before a search is typed: Clubs in
// the given city that the user is not already in. An exact match on the
// city, since both sides pick it from the same list. Larger Clubs first,
// capped at 20.
func ListClubsInCity(ctx context.Context, pool *pgxpool.Pool, viewerID, cityCode string) ([]models.ClubPreview, error) {
	rows, err := pool.Query(ctx,
		clubPreviewSelect+`
		 WHERE c.city_code = $2
		   AND NOT EXISTS(SELECT 1 FROM club_members m WHERE m.club_id = c.id AND m.user_id = $1)
		 ORDER BY member_count DESC, c.name ASC
		 LIMIT 20`,
		viewerID, cityCode,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []models.ClubPreview{}
	for rows.Next() {
		p, err := scanClubPreview(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, p)
	}
	return result, rows.Err()
}
