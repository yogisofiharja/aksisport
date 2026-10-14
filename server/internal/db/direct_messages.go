package db

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/models"
)

// DP-020 Direct Messages, on the shared conversations engine. Who may
// message whom is decided by the caller (httpapi), not here.

func orderedPair(a, b string) (string, string) {
	if a < b {
		return a, b
	}
	return b, a
}

// GetDirectConversationID returns the conversation between two users, or
// ErrNotFound if neither has written yet (it is created on first message).
func GetDirectConversationID(ctx context.Context, pool *pgxpool.Pool, userA, userB string) (string, error) {
	low, high := orderedPair(userA, userB)
	var id string
	err := pool.QueryRow(ctx,
		"SELECT id FROM conversations WHERE kind = 'direct' AND user_low = $1 AND user_high = $2", low, high,
	).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	return id, err
}

func GetOrCreateDirectConversationID(ctx context.Context, pool *pgxpool.Pool, userA, userB string) (string, error) {
	low, high := orderedPair(userA, userB)
	var id string
	err := pool.QueryRow(ctx,
		`INSERT INTO conversations (kind, user_low, user_high) VALUES ('direct', $1, $2)
		 ON CONFLICT (user_low, user_high) WHERE kind = 'direct'
		 DO UPDATE SET kind = conversations.kind
		 RETURNING id`,
		low, high,
	).Scan(&id)
	return id, err
}

// GetDirectMessageImage fetches an image from a direct conversation the
// given user is part of; ErrNotFound otherwise.
func GetDirectMessageImage(ctx context.Context, pool *pgxpool.Pool, userID, messageID string) (models.ConversationMessageImage, error) {
	var img models.ConversationMessageImage
	var contentType *string
	err := pool.QueryRow(ctx,
		`SELECT cm.image_data, cm.image_content_type
		 FROM conversation_messages cm JOIN conversations c ON c.id = cm.conversation_id
		 WHERE cm.id = $2 AND c.kind = 'direct' AND (c.user_low = $1 OR c.user_high = $1) AND cm.image_data IS NOT NULL`,
		userID, messageID,
	).Scan(&img.Data, &contentType)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.ConversationMessageImage{}, ErrNotFound
	}
	if err != nil {
		return models.ConversationMessageImage{}, err
	}
	if contentType != nil {
		img.ContentType = *contentType
	}
	return img, nil
}

// ListMyDirectThreads lists every direct conversation the user has, the
// most recently active first, each with its latest message.
func ListMyDirectThreads(ctx context.Context, pool *pgxpool.Pool, userID string) ([]models.DirectThread, error) {
	rows, err := pool.Query(ctx,
		`SELECT u.id, u.username, u.display_name, (u.avatar_image_data IS NOT NULL), `+isOnlineExpr+`,
		        last.body, last.has_image, last.sender_id, last.created_at, c.id, `+unreadForUser+`
		 FROM conversations c
		 JOIN users u ON u.id = CASE WHEN c.user_low = $1 THEN c.user_high ELSE c.user_low END
		 JOIN LATERAL (
			SELECT cm.body, (cm.image_data IS NOT NULL) AS has_image, cm.sender_id, cm.created_at
			FROM conversation_messages cm WHERE cm.conversation_id = c.id
			ORDER BY cm.created_at DESC LIMIT 1
		 ) last ON true
		 WHERE c.kind = 'direct' AND (c.user_low = $1 OR c.user_high = $1)
		 ORDER BY last.created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []models.DirectThread{}
	for rows.Next() {
		var t models.DirectThread
		if err := rows.Scan(&t.OtherUserID, &t.OtherUsername, &t.OtherDisplayName, &t.OtherHasAvatar, &t.OtherIsOnline,
			&t.LastMessageBody, &t.LastMessageHasImage, &t.LastMessageSenderID, &t.LastMessageAt, &t.ConversationID, &t.UnreadCount); err != nil {
			return nil, err
		}
		result = append(result, t)
	}
	return result, rows.Err()
}
