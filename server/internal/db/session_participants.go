package db

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/models"
)

const participantSelect = `SELECT sp.id, sp.session_id, sp.user_id, sp.guest_name, u.username, u.display_name, sp.status, sp.checked_in_at, sp.checked_out_at, sp.joined_at, (sp.receipt_image_data IS NOT NULL)
	 FROM session_participants sp LEFT JOIN users u ON u.id = sp.user_id`

func scanParticipant(row pgx.CollectableRow) (models.SessionParticipant, error) {
	var p models.SessionParticipant
	err := row.(pgx.Rows).Scan(
		&p.ID, &p.SessionID, &p.UserID, &p.GuestName, &p.Username, &p.DisplayName, &p.Status,
		&p.CheckedInAt, &p.CheckedOutAt, &p.JoinedAt, &p.HasReceipt,
	)
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
//
// Someone who cancelled their own spot can ask again: their row starts
// over as a fresh request (new join time, no check-in, no receipt from
// the earlier attempt). Any other existing row — already requested,
// approved, registered, checked in, or marked no-show — is left alone.
func RegisterParticipant(ctx context.Context, pool *pgxpool.Pool, sessionID, userID string) (models.SessionParticipant, error) {
	if _, err := pool.Exec(ctx,
		`INSERT INTO session_participants (session_id, user_id, status)
		 VALUES ($1, $2, 'requested')
		 ON CONFLICT (session_id, user_id) WHERE user_id IS NOT NULL DO UPDATE SET
			status = 'requested',
			joined_at = now(),
			checked_in_at = NULL,
			checked_out_at = NULL,
			receipt_image_data = NULL,
			receipt_image_content_type = NULL,
			receipt_uploaded_at = NULL
		 WHERE session_participants.status = 'cancelled'`,
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
	// A free Session has nothing to pay: approval registers the player
	// straight away (DP-002, v0.24.0). A paid one puts them on the
	// waitlist until payment is confirmed.
	tag, err := pool.Exec(ctx,
		`UPDATE session_participants
		 SET status = CASE WHEN (SELECT price_model FROM sessions WHERE id = $1) = 'free' THEN 'registered' ELSE 'waitlist' END
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

// UploadParticipantReceipt (Milestone 5) attaches/replaces a payment
// receipt image on the caller's own participant row — self-service only,
// there is no organizer-uploads-for-someone-else path. Overwrites any
// previous receipt (no history kept, no editing UI, just re-upload).
// ErrNotFound if the caller has no participant row in this Session at
// all (never joined/requested), regardless of its current status.
func UploadParticipantReceipt(ctx context.Context, pool *pgxpool.Pool, sessionID, userID string, imageData []byte, contentType string) (models.SessionParticipant, error) {
	tag, err := pool.Exec(ctx,
		`UPDATE session_participants
		 SET receipt_image_data = $3, receipt_image_content_type = $4, receipt_uploaded_at = now()
		 WHERE session_id = $1 AND user_id = $2`,
		sessionID, userID, imageData, contentType,
	)
	if err != nil {
		return models.SessionParticipant{}, err
	}
	if tag.RowsAffected() == 0 {
		return models.SessionParticipant{}, ErrNotFound
	}
	return getParticipantByUser(ctx, pool, sessionID, userID)
}

// GetParticipantReceiptImage fetches one participant's receipt bytes,
// scoped to sessionID (defense in depth beyond the URL's own participant
// id), alongside the row's own UserID — the caller (handler) needs that
// to decide access: only the uploading participant themselves, or an
// owner/admin, may ever see these bytes (narrower than every other read
// in this domain). ErrNotFound covers "no such participant in this
// Session" and "participant exists but has no receipt" alike.
func GetParticipantReceiptImage(ctx context.Context, pool *pgxpool.Pool, sessionID, participantID string) (models.ParticipantReceiptImage, *string, error) {
	var img models.ParticipantReceiptImage
	var contentType *string
	var ownerUserID *string
	err := pool.QueryRow(ctx,
		`SELECT receipt_image_data, receipt_image_content_type, user_id FROM session_participants
		 WHERE id = $1 AND session_id = $2 AND receipt_image_data IS NOT NULL`,
		participantID, sessionID,
	).Scan(&img.Data, &contentType, &ownerUserID)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.ParticipantReceiptImage{}, nil, ErrNotFound
	}
	if err != nil {
		return models.ParticipantReceiptImage{}, nil, err
	}
	if contentType != nil {
		img.ContentType = *contentType
	}
	return img, ownerUserID, nil
}

// DeleteParticipant removes a session_participants row entirely —
// owner/admin only. Unlike Cancel/NoShow (which record what happened),
// this is a hard removal, e.g. for declining a join request or removing
// someone outright. Matches on either user_id or the row's own id, so
// the same route/function works for guests too (they have no user_id to
// match on) — the caller passes whichever identifier it has.
func DeleteParticipant(ctx context.Context, pool *pgxpool.Pool, sessionID, participantIDOrUserID string) error {
	tag, err := pool.Exec(ctx,
		"DELETE FROM session_participants WHERE session_id = $1 AND (user_id = $2 OR id = $2)",
		sessionID, participantIDOrUserID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// SelfCheckIn transitions a self-service /checkin call from 'registered'
// (organizer-approved) to 'checked_in' — DP-002 Approval: never upserts/
// auto-registers; a player must already be approved. Returns ErrConflict
// if not currently 'registered' (never requested, still pending
// approval, or already checked in), ErrNotFound if there's no row at all.
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

// CheckOut marks an existing participant row as checked_out — does not
// upsert, since checking out only makes sense for a participant who
// already has a row. No transition-guard on prior status — last-write-
// wins, same as most other status writes in this file.
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
// 'registered' — an owner/admin action, roster-building rather than a
// check-in action (Milestone 2, revised): a guest named this way still
// needs to be checked in, same as an organizer-added member, once the
// Check-In Window opens (CheckInParticipantByID, below — the only way to
// check in a guest, since they have no user_id for a user-keyed check-in).
func AddGuestParticipant(ctx context.Context, pool *pgxpool.Pool, sessionID, guestName string) (models.SessionParticipant, error) {
	var participantID string
	err := pool.QueryRow(ctx,
		`INSERT INTO session_participants (session_id, guest_name, status)
		 VALUES ($1, $2, 'registered')
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

// AddRegisteredParticipant is the organizer-initiated "add an existing
// member to the roster" path — used by SessionDetailScreen's
// participant-placeholder "Member" option, and by session creation/
// generation for Host Playing (sessions_handler.go, generate.go). Lands
// directly at 'registered' — skips request/approval, but stops short of
// 'checked_in': an organizer-added member (including the organizer
// themselves, via Host Playing) still isn't physically present yet, so
// they still need Check-In (self, or the organizer's own
// CheckInParticipantByID) once the Check-In Window opens. Idempotent like
// RegisterParticipant: a pre-existing row (any status) is left unchanged,
// never downgraded.
func AddRegisteredParticipant(ctx context.Context, pool *pgxpool.Pool, sessionID, userID string) (models.SessionParticipant, error) {
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

func getParticipantByID(ctx context.Context, pool *pgxpool.Pool, sessionID, participantID string) (models.SessionParticipant, error) {
	rows, err := pool.Query(ctx, participantSelect+" WHERE sp.session_id = $1 AND sp.id = $2", sessionID, participantID)
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

// CheckInParticipantByID transitions an existing 'registered' participant
// row to 'checked_in', identified by its own row id rather than user_id —
// this requires the row already be 'registered' and works for guests too
// (which have no user_id to key a user-based check-in on). This is the
// Check-In Window-gated action that follows AddRegisteredParticipant/
// AddGuestParticipant, both of which land at 'registered' rather than
// 'checked_in' directly — adding a participant to a published Session
// (including the organizer, via Host Playing) never checks them in
// immediately; Checked In specifically means physically present, which
// only the Check-In Window (1h before start) is meant to gate. Returns
// ErrConflict if not currently 'registered', ErrNotFound if no row at all.
func CheckInParticipantByID(ctx context.Context, pool *pgxpool.Pool, sessionID, participantID string) (models.SessionParticipant, error) {
	tag, err := pool.Exec(ctx,
		`UPDATE session_participants SET status = 'checked_in', checked_in_at = now()
		 WHERE id = $1 AND session_id = $2 AND status = 'registered'`,
		participantID, sessionID,
	)
	if err != nil {
		return models.SessionParticipant{}, err
	}
	if tag.RowsAffected() == 0 {
		if _, gerr := getParticipantByID(ctx, pool, sessionID, participantID); errors.Is(gerr, ErrNotFound) {
			return models.SessionParticipant{}, ErrNotFound
		}
		return models.SessionParticipant{}, ErrConflict
	}
	return getParticipantByID(ctx, pool, sessionID, participantID)
}

// GetParticipantStatus is a member's current status in a Session;
// ErrNotFound if they have no row.
func GetParticipantStatus(ctx context.Context, pool *pgxpool.Pool, sessionID, userID string) (string, error) {
	var status string
	err := pool.QueryRow(ctx,
		"SELECT status FROM session_participants WHERE session_id = $1 AND user_id = $2", sessionID, userID,
	).Scan(&status)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	return status, err
}
