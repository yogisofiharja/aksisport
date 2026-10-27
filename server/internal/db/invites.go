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
// target: a newer invite replaces the older one and is pending again.
func RecordInvitation(ctx context.Context, pool *pgxpool.Pool, fromUser, toUser, targetType, targetID, clubID, via string, linkToken *string) (models.Invitation, error) {
	var id string
	err := pool.QueryRow(ctx,
		`INSERT INTO invitations (from_user, to_user, target_type, target_id, club_id, via, link_token)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 ON CONFLICT (to_user, target_type, target_id) DO UPDATE
		   SET from_user = EXCLUDED.from_user, via = EXCLUDED.via, link_token = EXCLUDED.link_token,
		       created_at = now(), responded_at = NULL, response = NULL
		 RETURNING id`,
		fromUser, toUser, targetType, targetID, clubID, via, linkToken,
	).Scan(&id)
	if err != nil {
		return models.Invitation{}, err
	}
	return GetInvitation(ctx, pool, id)
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
