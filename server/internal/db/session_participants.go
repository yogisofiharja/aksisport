package db

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/models"
)

const participantSelect = `SELECT sp.id, sp.session_id, sp.user_id, sp.guest_name, u.username, u.display_name, sp.status, sp.checked_in_at, sp.checked_out_at, sp.joined_at
	 FROM session_participants sp LEFT JOIN users u ON u.id = sp.user_id`

func scanParticipant(row pgx.CollectableRow) (models.SessionParticipant, error) {
	var p models.SessionParticipant
	err := row.(pgx.Rows).Scan(&p.ID, &p.SessionID, &p.UserID, &p.GuestName, &p.Username, &p.DisplayName, &p.Status, &p.CheckedInAt, &p.CheckedOutAt, &p.JoinedAt)
	return p, err
}

// CountJoinedParticipants returns, for each of the given session IDs, how
// many participants count toward headcount — DP-002: registered,
// checked_in, and checked_out all count; cancelled/no_show don't. Same
// definition as the client's own countJoined in deriveStatus.ts. Sessions
// with zero joined participants are simply absent from the returned map.
func CountJoinedParticipants(ctx context.Context, pool *pgxpool.Pool, sessionIDs []string) (map[string]int, error) {
	counts := map[string]int{}
	if len(sessionIDs) == 0 {
		return counts, nil
	}
	rows, err := pool.Query(ctx,
		`SELECT session_id, COUNT(*) FROM session_participants
		 WHERE session_id = ANY($1) AND status IN ('registered', 'checked_in', 'checked_out')
		 GROUP BY session_id`,
		sessionIDs,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		var count int
		if err := rows.Scan(&id, &count); err != nil {
			return nil, err
		}
		counts[id] = count
	}
	return counts, rows.Err()
}

func ListParticipants(ctx context.Context, pool *pgxpool.Pool, sessionID string) ([]models.SessionParticipant, error) {
	rows, err := pool.Query(ctx, participantSelect+" WHERE sp.session_id = $1 ORDER BY sp.joined_at ASC", sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []models.SessionParticipant{}
	for rows.Next() {
		p, err := scanParticipant(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, p)
	}
	return result, rows.Err()
}

func getParticipantByUser(ctx context.Context, pool *pgxpool.Pool, sessionID, userID string) (models.SessionParticipant, error) {
	rows, err := pool.Query(ctx, participantSelect+" WHERE sp.session_id = $1 AND sp.user_id = $2", sessionID, userID)
	if err != nil {
		return models.SessionParticipant{}, err
	}
	defer rows.Close()
	p, err := pgx.CollectOneRow(rows, scanParticipant)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.SessionParticipant{}, ErrNotFound
	}
	return p, err
}

// RegisterParticipant self-requests to join a session for userID —
// DP-002 Check-In Window / Approval: this is the "join request," not
// approval. Idempotent: if a row already exists (any status), it's left
// unchanged. Organizer approval (ApproveParticipant) is required before
// the player can self check-in.
func RegisterParticipant(ctx context.Context, pool *pgxpool.Pool, sessionID, userID string) (models.SessionParticipant, error) {
	if _, err := pool.Exec(ctx,
		`INSERT INTO session_participants (session_id, user_id, status)
		 VALUES ($1, $2, 'requested')
		 ON CONFLICT (session_id, user_id) WHERE user_id IS NOT NULL DO NOTHING`,
		sessionID, userID,
	); err != nil {
		return models.SessionParticipant{}, err
	}
	return getParticipantByUser(ctx, pool, sessionID, userID)
}

// ApproveParticipant moves a 'requested' join request to 'waitlist' —
// owner/admin only, the only path from requested to waitlist. Approved,
// but the slot isn't claimed until payment is confirmed (ConfirmPayment).
// Returns ErrConflict if the row isn't currently 'requested' (already
// approved, or never requested), ErrNotFound if there's no row at all.
func ApproveParticipant(ctx context.Context, pool *pgxpool.Pool, sessionID, userID string) (models.SessionParticipant, error) {
	tag, err := pool.Exec(ctx,
		`UPDATE session_participants SET status = 'waitlist'
		 WHERE session_id = $1 AND user_id = $2 AND status = 'requested'`,
		sessionID, userID,
	)
	if err != nil {
		return models.SessionParticipant{}, err
	}
	if tag.RowsAffected() == 0 {
		if _, gerr := getParticipantByUser(ctx, pool, sessionID, userID); errors.Is(gerr, ErrNotFound) {
			return models.SessionParticipant{}, ErrNotFound
		}
		return models.SessionParticipant{}, ErrConflict
	}
	return getParticipantByUser(ctx, pool, sessionID, userID)
}

// ConfirmPayment moves a 'waitlist' participant to 'registered' — owner/
// admin only, the only path from waitlist to registered. There is no
// payment gateway: this simply records that the organizer received
// payment outside the app (cash, transfer, etc.) and the slot is now
// claimed. Returns ErrConflict if the row isn't currently 'waitlist',
// ErrNotFound if there's no row at all.
func ConfirmPayment(ctx context.Context, pool *pgxpool.Pool, sessionID, userID string) (models.SessionParticipant, error) {
	tag, err := pool.Exec(ctx,
		`UPDATE session_participants SET status = 'registered'
		 WHERE session_id = $1 AND user_id = $2 AND status = 'waitlist'`,
		sessionID, userID,
	)
	if err != nil {
		return models.SessionParticipant{}, err
	}
	if tag.RowsAffected() == 0 {
		if _, gerr := getParticipantByUser(ctx, pool, sessionID, userID); errors.Is(gerr, ErrNotFound) {
			return models.SessionParticipant{}, ErrNotFound
		}
		return models.SessionParticipant{}, ErrConflict
	}
	return getParticipantByUser(ctx, pool, sessionID, userID)
}

// DeleteParticipant removes a session_participants row entirely —
// owner/admin only. Unlike Cancel/NoShow (which record what happened),
// this is a hard removal, e.g. for declining a join request or removing
// someone outright.
func DeleteParticipant(ctx context.Context, pool *pgxpool.Pool, sessionID, userID string) error {
	tag, err := pool.Exec(ctx, "DELETE FROM session_participants WHERE session_id = $1 AND user_id = $2", sessionID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// SelfCheckIn transitions a self-service /checkin call from 'registered'
// (organizer-approved) to 'checked_in' — DP-002 Approval: unlike CheckIn
// below, this never upserts/auto-registers; a player must already be
// approved. Returns ErrConflict if not currently 'registered'
// (never requested, still pending approval, or already checked in),
// ErrNotFound if there's no row at all.
func SelfCheckIn(ctx context.Context, pool *pgxpool.Pool, sessionID, userID string) (models.SessionParticipant, error) {
	tag, err := pool.Exec(ctx,
		`UPDATE session_participants SET status = 'checked_in', checked_in_at = now()
		 WHERE session_id = $1 AND user_id = $2 AND status = 'registered'`,
		sessionID, userID,
	)
	if err != nil {
		return models.SessionParticipant{}, err
	}
	if tag.RowsAffected() == 0 {
		if _, gerr := getParticipantByUser(ctx, pool, sessionID, userID); errors.Is(gerr, ErrNotFound) {
			return models.SessionParticipant{}, ErrNotFound
		}
		return models.SessionParticipant{}, ErrConflict
	}
	return getParticipantByUser(ctx, pool, sessionID, userID)
}

// CheckIn is the organizer-override path: marks userID as checked_in
// directly, auto-registering (upserting past any existing status) if
// needed — used by Host Playing's creation-time auto-check-in, the
// host-initiated "check in a member" action, and nowhere else. This
// deliberately bypasses request/approval — it's already an organizer
// decision, same reasoning as AddGuestParticipant skipping straight to
// checked_in. Self-service check-in uses SelfCheckIn instead, which does
// require prior approval.
func CheckIn(ctx context.Context, pool *pgxpool.Pool, sessionID, userID string) (models.SessionParticipant, error) {
	if _, err := pool.Exec(ctx,
		`INSERT INTO session_participants (session_id, user_id, status, checked_in_at)
		 VALUES ($1, $2, 'checked_in', now())
		 ON CONFLICT (session_id, user_id) WHERE user_id IS NOT NULL
		 DO UPDATE SET status = 'checked_in', checked_in_at = now()`,
		sessionID, userID,
	); err != nil {
		return models.SessionParticipant{}, err
	}
	return getParticipantByUser(ctx, pool, sessionID, userID)
}

// CheckOut marks an existing participant row as checked_out. Unlike
// CheckIn, this does not upsert — checking out only makes sense for a
// participant who already has a row (there's nothing to "check out" of
// otherwise). No transition-guard on prior status, matching CheckIn's
// existing simplicity — this is last-write-wins, same as every other
// status write in this file today.
func CheckOut(ctx context.Context, pool *pgxpool.Pool, sessionID, userID string) (models.SessionParticipant, error) {
	if _, err := pool.Exec(ctx,
		`UPDATE session_participants SET status = 'checked_out', checked_out_at = now()
		 WHERE session_id = $1 AND user_id = $2`,
		sessionID, userID,
	); err != nil {
		return models.SessionParticipant{}, err
	}
	return getParticipantByUser(ctx, pool, sessionID, userID)
}

// CancelParticipant marks an existing participant row as cancelled —
// either the participant cancelling their own registration, or an
// owner/admin cancelling on their behalf (see requireSelfOrOwnerAdmin in
// the handler).
func CancelParticipant(ctx context.Context, pool *pgxpool.Pool, sessionID, userID string) (models.SessionParticipant, error) {
	if _, err := pool.Exec(ctx,
		`UPDATE session_participants SET status = 'cancelled'
		 WHERE session_id = $1 AND user_id = $2`,
		sessionID, userID,
	); err != nil {
		return models.SessionParticipant{}, err
	}
	return getParticipantByUser(ctx, pool, sessionID, userID)
}

// MarkNoShow marks an existing participant row as no_show — an
// owner/admin-only action (marking someone else's absence is inherently
// not self-service, unlike CheckOut/Cancel).
func MarkNoShow(ctx context.Context, pool *pgxpool.Pool, sessionID, userID string) (models.SessionParticipant, error) {
	if _, err := pool.Exec(ctx,
		`UPDATE session_participants SET status = 'no_show'
		 WHERE session_id = $1 AND user_id = $2`,
		sessionID, userID,
	); err != nil {
		return models.SessionParticipant{}, err
	}
	return getParticipantByUser(ctx, pool, sessionID, userID)
}

// AddGuestParticipant adds a freeform guest (no account) directly as
// checked_in — an owner/admin action for walk-ins without the app.
func AddGuestParticipant(ctx context.Context, pool *pgxpool.Pool, sessionID, guestName string) (models.SessionParticipant, error) {
	var participantID string
	err := pool.QueryRow(ctx,
		`INSERT INTO session_participants (session_id, guest_name, status, checked_in_at)
		 VALUES ($1, $2, 'checked_in', now())
		 RETURNING id`,
		sessionID, guestName,
	).Scan(&participantID)
	if err != nil {
		return models.SessionParticipant{}, err
	}

	rows, err := pool.Query(ctx, participantSelect+" WHERE sp.id = $1", participantID)
	if err != nil {
		return models.SessionParticipant{}, err
	}
	defer rows.Close()
	return pgx.CollectOneRow(rows, scanParticipant)
}
