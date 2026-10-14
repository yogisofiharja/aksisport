package db

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/models"
)

// DP-018 Push Notifications — storage only. Deciding who is notified,
// rendering text and delivering pushes live in internal/notify.

// --- Server keys ---------------------------------------------------------

// GetOrCreateServerKeys returns the value pair stored under nameA/nameB,
// creating it with generate() the first time. Concurrent first starts are
// safe: whichever insert lands first wins and both read that one back.
func GetOrCreateServerKeys(ctx context.Context, pool *pgxpool.Pool, nameA, nameB string, generate func() (string, string, error)) (string, string, error) {
	read := func() (string, string, error) {
		var a, b string
		err := pool.QueryRow(ctx,
			"SELECT (SELECT value FROM server_keys WHERE name = $1), (SELECT value FROM server_keys WHERE name = $2)",
			nameA, nameB,
		).Scan(&a, &b)
		return a, b, err
	}
	if a, b, err := read(); err == nil {
		return a, b, nil
	}
	valueA, valueB, err := generate()
	if err != nil {
		return "", "", err
	}
	if _, err := pool.Exec(ctx,
		"INSERT INTO server_keys (name, value) VALUES ($1, $2), ($3, $4) ON CONFLICT (name) DO NOTHING",
		nameA, valueA, nameB, valueB,
	); err != nil {
		return "", "", err
	}
	return read()
}

// --- Devices -------------------------------------------------------------

type PushSubscription struct {
	ID      string
	UserID  string
	Kind    string // "web" | "expo"
	Address string // Web Push endpoint, or Expo push token
	P256dh  *string
	Auth    *string
	Locale  string
}

// UpsertPushSubscription registers a device for userID. The same address
// registered again (refreshed keys, or another account signing in on the
// same browser) updates the existing row and moves it to userID.
func UpsertPushSubscription(ctx context.Context, pool *pgxpool.Pool, s PushSubscription) error {
	_, err := pool.Exec(ctx,
		`INSERT INTO push_subscriptions (user_id, kind, address, p256dh, auth, locale)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 ON CONFLICT (address) DO UPDATE SET
			user_id = EXCLUDED.user_id, kind = EXCLUDED.kind, p256dh = EXCLUDED.p256dh,
			auth = EXCLUDED.auth, locale = EXCLUDED.locale, last_seen_at = now()`,
		s.UserID, s.Kind, s.Address, s.P256dh, s.Auth, s.Locale,
	)
	return err
}

// DeletePushSubscription removes one of userID's devices (signing out).
func DeletePushSubscription(ctx context.Context, pool *pgxpool.Pool, userID, address string) error {
	_, err := pool.Exec(ctx, "DELETE FROM push_subscriptions WHERE user_id = $1 AND address = $2", userID, address)
	return err
}

// ForgetPushAddress drops a device the push service says is gone
// (uninstalled, permission revoked, subscription expired).
func ForgetPushAddress(ctx context.Context, pool *pgxpool.Pool, address string) error {
	_, err := pool.Exec(ctx, "DELETE FROM push_subscriptions WHERE address = $1", address)
	return err
}

func ListPushSubscriptions(ctx context.Context, pool *pgxpool.Pool, userIDs []string) ([]PushSubscription, error) {
	if len(userIDs) == 0 {
		return nil, nil
	}
	rows, err := pool.Query(ctx,
		"SELECT id, user_id, kind, address, p256dh, auth, locale FROM push_subscriptions WHERE user_id = ANY($1)",
		userIDs,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []PushSubscription
	for rows.Next() {
		var s PushSubscription
		if err := rows.Scan(&s.ID, &s.UserID, &s.Kind, &s.Address, &s.P256dh, &s.Auth, &s.Locale); err != nil {
			return nil, err
		}
		result = append(result, s)
	}
	return result, rows.Err()
}

// --- Notifications -------------------------------------------------------

// InsertNotifications records one notification per user, all with the
// same content. Returns each user's new notification id.
func InsertNotifications(ctx context.Context, pool *pgxpool.Pool, userIDs []string, kind string, params map[string]string, path string) (map[string]string, error) {
	ids := map[string]string{}
	if len(userIDs) == 0 {
		return ids, nil
	}
	encoded, err := json.Marshal(params)
	if err != nil {
		return nil, err
	}
	rows, err := pool.Query(ctx,
		`INSERT INTO notifications (user_id, type, params, path)
		 SELECT u, $2, $3, $4 FROM unnest($1::uuid[]) AS u
		 RETURNING user_id, id`,
		userIDs, kind, encoded, path,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var userID, id string
		if err := rows.Scan(&userID, &id); err != nil {
			return nil, err
		}
		ids[userID] = id
	}
	return ids, rows.Err()
}

// ListNotifications returns the user's notifications, newest first.
func ListNotifications(ctx context.Context, pool *pgxpool.Pool, userID string, limit int) ([]models.Notification, error) {
	rows, err := pool.Query(ctx,
		`SELECT id, type, params, path, created_at, read_at FROM notifications
		 WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
		userID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []models.Notification{}
	for rows.Next() {
		var n models.Notification
		if err := rows.Scan(&n.ID, &n.Type, &n.Params, &n.Path, &n.CreatedAt, &n.ReadAt); err != nil {
			return nil, err
		}
		result = append(result, n)
	}
	return result, rows.Err()
}

func CountUnreadNotifications(ctx context.Context, pool *pgxpool.Pool, userID string) (int, error) {
	var count int
	err := pool.QueryRow(ctx, "SELECT count(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL", userID).Scan(&count)
	return count, err
}

// MarkNotificationRead marks one of the user's notifications read
// (idempotent). ErrNotFound if it isn't theirs.
func MarkNotificationRead(ctx context.Context, pool *pgxpool.Pool, userID, id string) error {
	var found string
	err := pool.QueryRow(ctx,
		`UPDATE notifications SET read_at = coalesce(read_at, now())
		 WHERE id = $2 AND user_id = $1 RETURNING id`,
		userID, id,
	).Scan(&found)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	return err
}

func MarkAllNotificationsRead(ctx context.Context, pool *pgxpool.Pool, userID string) error {
	_, err := pool.Exec(ctx, "UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL", userID)
	return err
}

// ListClubOrganizerIDs returns the owner and admins of a Club — who is
// told about things that need an organizer.
func ListClubOrganizerIDs(ctx context.Context, pool *pgxpool.Pool, clubID string) ([]string, error) {
	rows, err := pool.Query(ctx, "SELECT user_id FROM club_members WHERE club_id = $1 AND role IN ('owner', 'admin')", clubID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}
