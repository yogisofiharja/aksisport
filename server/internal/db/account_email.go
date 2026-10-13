package db

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/account"
	"github.com/yogisofiharja/aksi-server/internal/models"
)

// ErrCodeInvalid covers every way a submitted code can fail — wrong,
// expired, already used, locked after too many attempts, or never
// requested. Callers show one message for all of them on purpose.
var ErrCodeInvalid = errors.New("invalid or expired code")

// ErrTooSoon: a code for this user and purpose was sent less than
// account.ResendCooldown ago. What IssueEmailCode actually returns is a
// *TooSoonError carrying how long is left; errors.Is(err, ErrTooSoon)
// matches it for callers that don't care.
var ErrTooSoon = errors.New("a code was sent too recently")

type TooSoonError struct {
	RetryAfter time.Duration
}

func (e *TooSoonError) Error() string { return ErrTooSoon.Error() }
func (e *TooSoonError) Unwrap() error { return ErrTooSoon }

// GetUserByConfirmedEmail finds the account that has confirmed this
// (already normalized) email.
func GetUserByConfirmedEmail(ctx context.Context, pool *pgxpool.Pool, email string) (models.User, error) {
	rows, err := pool.Query(ctx, "SELECT "+userColumns+" FROM users WHERE lower(email) = $1", email)
	if err != nil {
		return models.User{}, err
	}
	defer rows.Close()
	u, err := pgx.CollectOneRow(rows, scanUser)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.User{}, ErrNotFound
	}
	return u, err
}

// EmailConfirmedByAnother reports whether a different account already
// owns this (normalized) email.
func EmailConfirmedByAnother(ctx context.Context, pool *pgxpool.Pool, email, userID string) (bool, error) {
	var exists bool
	err := pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM users WHERE lower(email) = $1 AND id != $2)", email, userID).Scan(&exists)
	return exists, err
}

// IssueEmailCode records a new code for (user, purpose) and retires any
// earlier unused one, so only the newest code ever works. For
// verify_email it also records the address as the user's pending email.
// Returns ErrTooSoon inside the resend cooldown. The caller sends the
// actual email — only the hash is stored here.
func IssueEmailCode(ctx context.Context, pool *pgxpool.Pool, userID, purpose, email, codeHash string) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var lastSent *time.Time
	if err := tx.QueryRow(ctx,
		"SELECT max(created_at) FROM email_codes WHERE user_id = $1 AND purpose = $2", userID, purpose,
	).Scan(&lastSent); err != nil {
		return err
	}
	if lastSent != nil {
		if wait := account.ResendCooldown - time.Since(*lastSent); wait > 0 {
			return &TooSoonError{RetryAfter: wait}
		}
	}

	if _, err := tx.Exec(ctx,
		"UPDATE email_codes SET consumed_at = now() WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL", userID, purpose,
	); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx,
		"INSERT INTO email_codes (user_id, purpose, email, code_hash, expires_at) VALUES ($1, $2, $3, $4, $5)",
		userID, purpose, email, codeHash, time.Now().Add(account.CodeTTL),
	); err != nil {
		return err
	}
	if purpose == account.PurposeVerifyEmail {
		if _, err := tx.Exec(ctx, "UPDATE users SET pending_email = $2, updated_at = now() WHERE id = $1", userID, email); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// RedeemEmailCode checks a submitted code against the newest live code
// for (user, purpose). A match consumes it and returns the email it was
// sent to; a miss counts an attempt. Anything else is ErrCodeInvalid.
func RedeemEmailCode(ctx context.Context, pool *pgxpool.Pool, userID, purpose, codeHash string) (string, error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)

	var id, email, storedHash string
	var attempts int
	err = tx.QueryRow(ctx,
		`SELECT id, email, code_hash, attempts FROM email_codes
		 WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL AND expires_at > now()
		 ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
		userID, purpose,
	).Scan(&id, &email, &storedHash, &attempts)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrCodeInvalid
	}
	if err != nil {
		return "", err
	}
	if attempts >= account.MaxAttempts {
		return "", ErrCodeInvalid
	}
	if storedHash != codeHash {
		if _, err := tx.Exec(ctx, "UPDATE email_codes SET attempts = attempts + 1 WHERE id = $1", id); err != nil {
			return "", err
		}
		if err := tx.Commit(ctx); err != nil {
			return "", err
		}
		return "", ErrCodeInvalid
	}
	if _, err := tx.Exec(ctx, "UPDATE email_codes SET consumed_at = now() WHERE id = $1", id); err != nil {
		return "", err
	}
	return email, tx.Commit(ctx)
}

// SetConfirmedEmail makes email the user's confirmed address and clears
// the pending one. ErrConflict if another account confirmed the same
// address in the meantime (users_email_unique).
func SetConfirmedEmail(ctx context.Context, pool *pgxpool.Pool, userID, email string) (models.User, error) {
	rows, err := pool.Query(ctx,
		"UPDATE users SET email = $2, pending_email = NULL, updated_at = now() WHERE id = $1 RETURNING "+userColumns,
		userID, email,
	)
	if err != nil {
		return models.User{}, err
	}
	defer rows.Close()
	u, err := pgx.CollectOneRow(rows, scanUser)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return models.User{}, ErrConflict
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return models.User{}, ErrNotFound
	}
	return u, err
}
