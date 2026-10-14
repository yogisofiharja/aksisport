package db

import (
	"context"
	"encoding/json"
	"errors"
	"time"

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

// NotificationSettings is which push kinds (DP-018) the user has on;
// a kind never changed is on.
func NotificationSettings(ctx context.Context, pool *pgxpool.Pool, userID string, categories []string) (map[string]bool, error) {
	result := map[string]bool{}
	for _, c := range categories {
		result[c] = true
	}
	rows, err := pool.Query(ctx, "SELECT category, enabled FROM notification_settings WHERE user_id = $1", userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var category string
		var enabled bool
		if err := rows.Scan(&category, &enabled); err != nil {
			return nil, err
		}
		if _, known := result[category]; known {
			result[category] = enabled
		}
	}
	return result, rows.Err()
}

func SetNotificationSetting(ctx context.Context, pool *pgxpool.Pool, userID, category string, enabled bool) error {
	_, err := pool.Exec(ctx,
		`INSERT INTO notification_settings (user_id, category, enabled) VALUES ($1, $2, $3)
		 ON CONFLICT (user_id, category) DO UPDATE SET enabled = EXCLUDED.enabled`,
		userID, category, enabled)
	return err
}

// UsersWithCategoryOff is which of the given users turned a kind off.
func UsersWithCategoryOff(ctx context.Context, pool *pgxpool.Pool, userIDs []string, category string) (map[string]bool, error) {
	rows, err := pool.Query(ctx,
		"SELECT user_id FROM notification_settings WHERE user_id = ANY($1) AND category = $2 AND NOT enabled",
		userIDs, category)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := map[string]bool{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		result[id] = true
	}
	return result, rows.Err()
}

// DueReminder is a Session whose 2-hour reminder is due (DP-018 #7).
type DueReminder struct {
	SessionID    string
	Name         string
	MinutesUntil int
	// Participants who have claimed a spot: registered or checked in.
	UserIDs []string
}

// ClaimDueReminders marks every published Session starting within
// `within` (and not yet started) as reminded, returning them with who to
// tell. Marking and returning happen in one statement, so a reminder is
// claimed once even if two processes tick together.
func ClaimDueReminders(ctx context.Context, pool *pgxpool.Pool, within time.Duration) ([]DueReminder, error) {
	rows, err := pool.Query(ctx,
		`UPDATE sessions s SET reminder_sent_at = now()
		 FROM clubs c
		 WHERE c.id = s.club_id AND s.status = 'open' AND s.reminder_sent_at IS NULL
		   AND s.starts_at IS NOT NULL AND s.starts_at > now() AND s.starts_at <= now() + make_interval(secs => $1)
		 RETURNING s.id, coalesce(nullif(s.name, ''), c.name),
		           GREATEST(1, CEIL(EXTRACT(EPOCH FROM (s.starts_at - now())) / 60))::int,
		           ARRAY(SELECT p.user_id::text FROM session_participants p
		                 WHERE p.session_id = s.id AND p.user_id IS NOT NULL AND p.status IN ('registered', 'checked_in'))`,
		within.Seconds())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []DueReminder
	for rows.Next() {
		var r DueReminder
		if err := rows.Scan(&r.SessionID, &r.Name, &r.MinutesUntil, &r.UserIDs); err != nil {
			return nil, err
		}
		result = append(result, r)
	}
	return result, rows.Err()
}

// SessionLabel is how a Session is named in a notification: its name, or
// its Community's.
func SessionLabel(ctx context.Context, pool *pgxpool.Pool, sessionID string) (string, error) {
	var label string
	err := pool.QueryRow(ctx,
		`SELECT coalesce(nullif(s.name, ''), c.name) FROM sessions s JOIN clubs c ON c.id = s.club_id WHERE s.id = $1`,
		sessionID).Scan(&label)
	return label, err
}
