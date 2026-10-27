package db

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/models"
)

// DP-028: invite links and invitations to a Community or a Session.

const (
	InviteTargetClub    = "club"
	InviteTargetSession = "session"
)

// ErrInviteRevoked: the link was reset by an owner/admin.
var ErrInviteRevoked = errors.New("invite link revoked")

const inviteLinkColumns = "token, target_type, target_id, club_id, created_by, created_at, revoked_at"

func scanInviteLink(row pgx.Row) (models.InviteLink, error) {
	var l models.InviteLink
	err := row.Scan(&l.Token, &l.TargetType, &l.TargetID, &l.ClubID, &l.CreatedBy, &l.CreatedAt, &l.RevokedAt)
	return l, err
}

// newInviteToken: 16 random bytes, URL-safe, 22 characters — short enough
// to share, far too many to guess.
func newInviteToken() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// GetOrCreateInviteLink returns the inviter's live link for the target,
// making it the first time. One live link per inviter per target (the
// partial unique index); a reset leaves none, so the next call makes a
// fresh one.
func GetOrCreateInviteLink(ctx context.Context, pool *pgxpool.Pool, targetType, targetID, clubID, inviterID string) (models.InviteLink, error) {
	token, err := newInviteToken()
	if err != nil {
		return models.InviteLink{}, err
	}
	if _, err := pool.Exec(ctx,
		`INSERT INTO invite_links (token, target_type, target_id, club_id, created_by)
		 VALUES ($1, $2, $3, $4, $5)
		 ON CONFLICT (created_by, target_type, target_id) WHERE revoked_at IS NULL DO NOTHING`,
		token, targetType, targetID, clubID, inviterID,
	); err != nil {
		return models.InviteLink{}, err
	}
	return scanInviteLink(pool.QueryRow(ctx,
		"SELECT "+inviteLinkColumns+` FROM invite_links
		 WHERE created_by = $1 AND target_type = $2 AND target_id = $3 AND revoked_at IS NULL`,
		inviterID, targetType, targetID,
	))
}

// ResetInviteLinks revokes every live link for the target and returns how
// many it revoked.
func ResetInviteLinks(ctx context.Context, pool *pgxpool.Pool, targetType, targetID string) (int64, error) {
	tag, err := pool.Exec(ctx,
		`UPDATE invite_links SET revoked_at = now()
		 WHERE target_type = $1 AND target_id = $2 AND revoked_at IS NULL`,
		targetType, targetID,
	)
	return tag.RowsAffected(), err
}

// GetInviteLink loads a link by token: ErrNotFound if there is none,
// ErrInviteRevoked (with the link) if it was reset.
func GetInviteLink(ctx context.Context, pool *pgxpool.Pool, token string) (models.InviteLink, error) {
	l, err := scanInviteLink(pool.QueryRow(ctx, "SELECT "+inviteLinkColumns+" FROM invite_links WHERE token = $1", token))
	if errors.Is(err, pgx.ErrNoRows) {
		return models.InviteLink{}, ErrNotFound
	}
	if err != nil {
		return models.InviteLink{}, err
	}
	if l.RevokedAt != nil {
		return l, ErrInviteRevoked
	}
	return l, nil
}

// InviterIsOrganizer is DP-028's "skips approval" check, made when an
// invite is used rather than when it was sent: is the inviter an owner or
// admin of the Community right now? A demoted admin's invites stop
// letting people straight in.
func InviterIsOrganizer(ctx context.Context, pool *pgxpool.Pool, clubID, inviterID string) (bool, error) {
	var ok bool
	err := pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM club_members WHERE club_id = $1 AND user_id = $2 AND role IN ('owner', 'admin'))`,
		clubID, inviterID,
	).Scan(&ok)
	return ok, err
}

const invitationColumns = `i.id, i.from_user, COALESCE(NULLIF(fu.display_name, ''), fu.username), i.to_user,
	i.target_type, i.target_id, i.club_id, i.via, i.link_token, i.created_at, i.responded_at, i.response`

func scanInvitation(row pgx.Row) (models.Invitation, error) {
	var inv models.Invitation
	err := row.Scan(&inv.ID, &inv.FromUserID, &inv.FromName, &inv.ToUserID, &inv.TargetType, &inv.TargetID, &inv.ClubID,
		&inv.Via, &inv.LinkToken, &inv.CreatedAt, &inv.RespondedAt, &inv.Response)
	return inv, err
}

// RecordInvitation notes that toUser was invited to the target — in the
// app, or by opening a link while signed in. One row per person per
// target: a newer invite replaces the older one and is pending again —
// except that opening a link never replaces a pending in-app invitation,
// which stays on the friend's Home until they answer it.
func RecordInvitation(ctx context.Context, pool *pgxpool.Pool, fromUser, toUser, targetType, targetID, clubID, via string, linkToken *string) (models.Invitation, error) {
	if _, err := pool.Exec(ctx,
		`INSERT INTO invitations (from_user, to_user, target_type, target_id, club_id, via, link_token)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 ON CONFLICT (to_user, target_type, target_id) DO UPDATE
		   SET from_user = EXCLUDED.from_user, via = EXCLUDED.via, link_token = EXCLUDED.link_token,
		       created_at = now(), responded_at = NULL, response = NULL
		   WHERE NOT (EXCLUDED.via = 'link' AND invitations.via = 'app' AND invitations.responded_at IS NULL)`,
		fromUser, toUser, targetType, targetID, clubID, via, linkToken,
	); err != nil {
		return models.Invitation{}, err
	}
	return GetInvitationFor(ctx, pool, toUser, targetType, targetID)
}

func GetInvitation(ctx context.Context, pool *pgxpool.Pool, id string) (models.Invitation, error) {
	inv, err := scanInvitation(pool.QueryRow(ctx,
		"SELECT "+invitationColumns+" FROM invitations i JOIN users fu ON fu.id = i.from_user WHERE i.id = $1", id))
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Invitation{}, ErrNotFound
	}
	return inv, err
}

// GetInvitationFor is the caller's invitation to a target, if any.
func GetInvitationFor(ctx context.Context, pool *pgxpool.Pool, userID, targetType, targetID string) (models.Invitation, error) {
	inv, err := scanInvitation(pool.QueryRow(ctx,
		"SELECT "+invitationColumns+` FROM invitations i JOIN users fu ON fu.id = i.from_user
		 WHERE i.to_user = $1 AND i.target_type = $2 AND i.target_id = $3`,
		userID, targetType, targetID))
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Invitation{}, ErrNotFound
	}
	return inv, err
}

// RespondToInvitation records Join or Not now on the caller's invitation
// to a target; a no-op when there is none.
func RespondToInvitation(ctx context.Context, pool *pgxpool.Pool, userID, targetType, targetID, response string) error {
	_, err := pool.Exec(ctx,
		`UPDATE invitations SET responded_at = now(), response = $4
		 WHERE to_user = $1 AND target_type = $2 AND target_id = $3`,
		userID, targetType, targetID, response,
	)
	return err
}

// HasOrganizerInvite is DP-028's straight-in rule for a private
// Community: the user holds an invitation to it — or to one of its
// Sessions — from someone who is an owner/admin there right now, and the
// invitation didn't come through a link that has since been reset.
func HasOrganizerInvite(ctx context.Context, pool *pgxpool.Pool, clubID, userID string) (bool, error) {
	var ok bool
	err := pool.QueryRow(ctx,
		`SELECT EXISTS(
			SELECT 1 FROM invitations i
			JOIN club_members m ON m.club_id = i.club_id AND m.user_id = i.from_user AND m.role IN ('owner', 'admin')
			LEFT JOIN invite_links l ON l.token = i.link_token
			WHERE i.club_id = $1 AND i.to_user = $2 AND (i.link_token IS NULL OR l.revoked_at IS NULL)
		)`,
		clubID, userID,
	).Scan(&ok)
	return ok, err
}

// MarkClubInvitationsJoined closes the user's invitations to the
// Community once they are in it.
func MarkClubInvitationsJoined(ctx context.Context, pool *pgxpool.Pool, clubID, userID string) error {
	_, err := pool.Exec(ctx,
		`UPDATE invitations SET responded_at = now(), response = 'joined'
		 WHERE club_id = $1 AND to_user = $2 AND target_type = 'club' AND responded_at IS NULL`,
		clubID, userID,
	)
	return err
}

// SessionVisitorRole is the role a Session-only participant (DP-028) has
// in requireSessionAccess: a plain player of that one Session, never an
// organizer, and nothing in the Community.
const SessionVisitorRole = "visitor"

// HasSessionVisitorAccess: a non-member may see this Session because they
// are (or were) a participant in it, or were invited to it — in the app,
// or by opening its link.
func HasSessionVisitorAccess(ctx context.Context, pool *pgxpool.Pool, sessionID, userID string) (bool, error) {
	var ok bool
	err := pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM session_participants WHERE session_id = $1 AND user_id = $2)
		     OR EXISTS(SELECT 1 FROM invitations WHERE target_type = 'session' AND target_id = $1 AND to_user = $2)`,
		sessionID, userID,
	).Scan(&ok)
	return ok, err
}

// Who is already "in" a target for in-app invites: a member of the
// Community, or someone taking part in the Session (asked, approved,
// playing or played).
const (
	inClubSQL    = `EXISTS(SELECT 1 FROM club_members WHERE club_id = $1 AND user_id = u.id)`
	inSessionSQL = `EXISTS(SELECT 1 FROM session_participants WHERE session_id = $1 AND user_id = u.id
	                       AND status IN ('requested', 'waitlist', 'registered', 'checked_in', 'checked_out'))`
)

// InviteCandidates is the in-app invite search (DP-028): users matching q,
// each marked "in" (already a member / already playing), "invited" (a
// pending in-app invitation) or "invite".
func InviteCandidates(ctx context.Context, pool *pgxpool.Pool, targetType, targetID, q, callerID string) ([]models.InviteCandidate, error) {
	in := inClubSQL
	if targetType == InviteTargetSession {
		in = inSessionSQL
	}
	rows, err := pool.Query(ctx,
		`SELECT u.id, u.username, u.display_name, (u.avatar_image_data IS NOT NULL), `+in+`,
		        EXISTS(SELECT 1 FROM invitations i WHERE i.to_user = u.id AND i.target_type = $3 AND i.target_id = $1
		               AND i.via = 'app' AND i.responded_at IS NULL)
		 FROM users u
		 WHERE u.id != $2 AND (u.username ILIKE '%' || $4 || '%' OR u.display_name ILIKE '%' || $4 || '%')
		 ORDER BY u.username ASC
		 LIMIT 20`,
		targetID, callerID, targetType, q,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []models.InviteCandidate{}
	for rows.Next() {
		var c models.InviteCandidate
		var in, invited bool
		if err := rows.Scan(&c.ID, &c.Username, &c.DisplayName, &c.HasAvatar, &in, &invited); err != nil {
			return nil, err
		}
		switch {
		case in:
			c.State = "in"
		case invited:
			c.State = "invited"
		default:
			c.State = "invite"
		}
		result = append(result, c)
	}
	return result, rows.Err()
}

// IsAlreadyIn: a member of the Community, or taking part in the Session.
func IsAlreadyIn(ctx context.Context, pool *pgxpool.Pool, targetType, targetID, userID string) (bool, error) {
	in := inClubSQL
	if targetType == InviteTargetSession {
		in = inSessionSQL
	}
	var ok bool
	err := pool.QueryRow(ctx, `SELECT `+in+` FROM users u WHERE u.id = $2`, targetID, userID).Scan(&ok)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, ErrNotFound
	}
	return ok, err
}

// ListPendingInvitations is Home's "Invited" section: the caller's
// unanswered in-app invitations, newest first, with what Home shows about
// the target. Sessions that ended or were cancelled drop out.
func ListPendingInvitations(ctx context.Context, pool *pgxpool.Pool, userID string) ([]models.InvitationCard, error) {
	rows, err := pool.Query(ctx,
		`SELECT i.id, i.from_user, COALESCE(NULLIF(fu.display_name, ''), fu.username), i.target_type, i.target_id, i.club_id,
		        c.name, i.created_at, s.name, s.starts_at, s.duration_minutes, s.location, s.price_model, s.price_per_person, s.total_price
		 FROM invitations i
		 JOIN users fu ON fu.id = i.from_user
		 JOIN clubs c ON c.id = i.club_id
		 LEFT JOIN sessions s ON i.target_type = 'session' AND s.id = i.target_id
		 WHERE i.to_user = $1 AND i.via = 'app' AND i.responded_at IS NULL
		   AND (i.target_type = 'club' OR (s.id IS NOT NULL AND s.status IN ('open', 'in_progress')))
		 ORDER BY i.created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []models.InvitationCard{}
	for rows.Next() {
		var c models.InvitationCard
		var priceModel *string
		if err := rows.Scan(&c.ID, &c.FromUserID, &c.FromName, &c.TargetType, &c.TargetID, &c.ClubID, &c.ClubName, &c.CreatedAt,
			&c.SessionName, &c.StartsAt, &c.DurationMinutes, &c.Location, &priceModel, &c.PricePerPerson, &c.TotalPrice); err != nil {
			return nil, err
		}
		if priceModel != nil {
			c.PriceModel = *priceModel
		}
		result = append(result, c)
	}
	return result, rows.Err()
}

// DismissInvitation is Not now on Home: only the invitee's own.
func DismissInvitation(ctx context.Context, pool *pgxpool.Pool, id, userID string) error {
	tag, err := pool.Exec(ctx,
		`UPDATE invitations SET responded_at = now(), response = 'dismissed' WHERE id = $1 AND to_user = $2`, id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ClubInviteFor is what a Community's preview tells a non-member about
// their invitation to it (DP-028): who invited them most recently — to the
// Community or one of its Sessions — that inviter's role there now, and
// whether it lets them straight in (HasOrganizerInvite). ErrNotFound when
// there is none.
func ClubInviteFor(ctx context.Context, pool *pgxpool.Pool, clubID, userID string) (models.ClubInvite, error) {
	var inv models.ClubInvite
	err := pool.QueryRow(ctx,
		`SELECT COALESCE(NULLIF(fu.display_name, ''), fu.username), COALESCE(m.role, '')
		 FROM invitations i
		 JOIN users fu ON fu.id = i.from_user
		 LEFT JOIN club_members m ON m.club_id = i.club_id AND m.user_id = i.from_user
		 WHERE i.club_id = $1 AND i.to_user = $2
		 ORDER BY (i.target_type = 'club') DESC, i.created_at DESC
		 LIMIT 1`,
		clubID, userID,
	).Scan(&inv.FromName, &inv.FromRole)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.ClubInvite{}, ErrNotFound
	}
	if err != nil {
		return models.ClubInvite{}, err
	}
	inv.StraightIn, err = HasOrganizerInvite(ctx, pool, clubID, userID)
	return inv, err
}
