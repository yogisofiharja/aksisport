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

// RegisterParticipant self-registers userID for a session. Idempotent: if
// already registered or checked in, returns the existing row unchanged.
func RegisterParticipant(ctx context.Context, pool *pgxpool.Pool, sessionID, userID string) (models.SessionParticipant, error) {
	if _, err := pool.Exec(ctx,
		`INSERT INTO session_participants (session_id, user_id, status)
		 VALUES ($1, $2, 'registered')
		 ON CONFLICT (session_id, user_id) WHERE user_id IS NOT NULL DO NOTHING`,
		sessionID, userID,
	); err != nil {
		return models.SessionParticipant{}, err
	}
	return getParticipantByUser(ctx, pool, sessionID, userID)
}

// CheckIn marks userID as checked_in, auto-registering them first if they
// have no session_participants row yet (low-friction: one tap either way).
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
