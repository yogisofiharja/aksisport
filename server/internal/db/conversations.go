package db

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/models"
)

// GetConversation resolves an existing conversation for (kind, sessionID,
// memberUserID) — ErrNotFound if no message has ever been sent yet (a
// conversation row is only created lazily, on first message).
func GetConversation(ctx context.Context, pool *pgxpool.Pool, kind, sessionID string, memberUserID *string) (models.Conversation, error) {
	var conv models.Conversation
	var row pgx.Row
	if memberUserID != nil {
		row = pool.QueryRow(ctx,
			`SELECT id, kind, session_id, member_user_id, created_at FROM conversations
			 WHERE kind = $1 AND session_id = $2 AND member_user_id = $3`,
			kind, sessionID, *memberUserID,
		)
	} else {
		row = pool.QueryRow(ctx,
			`SELECT id, kind, session_id, member_user_id, created_at FROM conversations
			 WHERE kind = $1 AND session_id = $2 AND member_user_id IS NULL`,
			kind, sessionID,
		)
	}
	err := row.Scan(&conv.ID, &conv.Kind, &conv.SessionID, &conv.MemberUserID, &conv.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Conversation{}, ErrNotFound
	}
	return conv, err
}

// GetOrCreateConversation is GetConversation, creating the row on first
// use. The two Kinds have different partial-unique-index conflict
// targets (see migration 0021), hence the branch.
func GetOrCreateConversation(ctx context.Context, pool *pgxpool.Pool, kind, sessionID string, memberUserID *string) (models.Conversation, error) {
	var conv models.Conversation
	var row pgx.Row
	if memberUserID != nil {
		row = pool.QueryRow(ctx,
			`INSERT INTO conversations (kind, session_id, member_user_id) VALUES ($1, $2, $3)
			 ON CONFLICT (session_id, member_user_id) WHERE kind = 'session_contact'
			 DO UPDATE SET kind = conversations.kind
			 RETURNING id, kind, session_id, member_user_id, created_at`,
			kind, sessionID, *memberUserID,
		)
	} else {
		row = pool.QueryRow(ctx,
			`INSERT INTO conversations (kind, session_id) VALUES ($1, $2)
			 ON CONFLICT (session_id) WHERE kind = 'session_chat'
			 DO UPDATE SET kind = conversations.kind
			 RETURNING id, kind, session_id, member_user_id, created_at`,
			kind, sessionID,
		)
	}
	err := row.Scan(&conv.ID, &conv.Kind, &conv.SessionID, &conv.MemberUserID, &conv.CreatedAt)
	return conv, err
}

const conversationMessageSelect = `SELECT cm.id, cm.conversation_id, coalesce(c.session_id::text, ''), cm.sender_id, u.username, u.display_name, cm.body, (cm.image_data IS NOT NULL), cm.created_at
	 FROM conversation_messages cm
	 JOIN conversations c ON c.id = cm.conversation_id
	 JOIN users u ON u.id = cm.sender_id`

func scanConversationMessage(row pgx.CollectableRow) (models.ConversationMessage, error) {
	var m models.ConversationMessage
	err := row.(pgx.Rows).Scan(&m.ID, &m.ConversationID, &m.SessionID, &m.SenderID, &m.SenderUsername, &m.SenderDisplayName, &m.Body, &m.HasImage, &m.CreatedAt)
	return m, err
}

// ListConversationMessages returns every message in a conversation,
// oldest first — no pagination yet, same MVP tradeoff as before the
// merge (a Session-scoped conversation is bounded by the Session's own
// lifetime).
func ListConversationMessages(ctx context.Context, pool *pgxpool.Pool, conversationID string) ([]models.ConversationMessage, error) {
	rows, err := pool.Query(ctx, conversationMessageSelect+" WHERE cm.conversation_id = $1 ORDER BY cm.created_at ASC", conversationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []models.ConversationMessage{}
	for rows.Next() {
		m, err := scanConversationMessage(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, m)
	}
	return result, rows.Err()
}

// CreateConversationMessageParams — body and image are each optional
// individually, but the caller (handler) guarantees at least one is set
// before reaching here; imageData/imageContentType are either both nil or
// both set, same guarantee.
type CreateConversationMessageParams struct {
	ConversationID   string
	SenderID         string
	Body             string
	ImageData        []byte
	ImageContentType *string
}

func CreateConversationMessage(ctx context.Context, pool *pgxpool.Pool, p CreateConversationMessageParams) (models.ConversationMessage, error) {
	var imageSizeBytes *int
	if p.ImageData != nil {
		n := len(p.ImageData)
		imageSizeBytes = &n
	}
	var id string
	err := pool.QueryRow(ctx,
		`INSERT INTO conversation_messages (conversation_id, sender_id, body, image_data, image_content_type, image_size_bytes)
		 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
		p.ConversationID, p.SenderID, p.Body, p.ImageData, p.ImageContentType, imageSizeBytes,
	).Scan(&id)
	if err != nil {
		return models.ConversationMessage{}, err
	}
	rows, err := pool.Query(ctx, conversationMessageSelect+" WHERE cm.id = $1", id)
	if err != nil {
		return models.ConversationMessage{}, err
	}
	defer rows.Close()
	return pgx.CollectOneRow(rows, scanConversationMessage)
}

// GetConversationMessageImage fetches one message's image bytes, scoped
// to sessionID (defense in depth beyond the URL's own messageID). Also
// returns the owning conversation so the caller can apply that Kind's
// own access rule (session_contact is narrower than session_chat).
func GetConversationMessageImage(ctx context.Context, pool *pgxpool.Pool, sessionID, messageID string) (models.ConversationMessageImage, models.Conversation, error) {
	var img models.ConversationMessageImage
	var conv models.Conversation
	var contentType *string
	err := pool.QueryRow(ctx,
		`SELECT cm.image_data, cm.image_content_type, c.id, c.kind, c.session_id, c.member_user_id, c.created_at
		 FROM conversation_messages cm
		 JOIN conversations c ON c.id = cm.conversation_id
		 WHERE cm.id = $1 AND c.session_id = $2 AND cm.image_data IS NOT NULL`,
		messageID, sessionID,
	).Scan(&img.Data, &contentType, &conv.ID, &conv.Kind, &conv.SessionID, &conv.MemberUserID, &conv.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.ConversationMessageImage{}, models.Conversation{}, ErrNotFound
	}
	if err != nil {
		return models.ConversationMessageImage{}, models.Conversation{}, err
	}
	if contentType != nil {
		img.ContentType = *contentType
	}
	return img, conv, nil
}

// contactThreadNeedsReply: a session_contact thread has exactly two
// sides — the member, and the organizer collective. It needs viewerID's
// attention when the last message came from the *other* side, not
// merely "not from viewerID" (an organizer viewer shouldn't see
// needsReply=true just because a different admin already answered).
func contactThreadNeedsReply(memberUserID, lastSenderID, viewerID string) bool {
	if memberUserID == viewerID {
		return lastSenderID != viewerID
	}
	return lastSenderID == memberUserID
}

// ListSessionContactThreads returns one row per member who has messaged
// this Session's organizers, most-recently-active first. Owner/admin-only
// access is enforced by the caller — every row here is from the
// organizer's point of view, so NeedsReply is always "the member sent
// last and nobody has answered yet."
func ListSessionContactThreads(ctx context.Context, pool *pgxpool.Pool, sessionID string) ([]models.SessionContactThread, error) {
	rows, err := pool.Query(ctx, `
		SELECT c.session_id, u.id, u.username, u.display_name, last.body, last.sender_id, last.created_at
		FROM conversations c
		JOIN users u ON u.id = c.member_user_id
		JOIN LATERAL (
			SELECT body, sender_id, created_at FROM conversation_messages cm
			WHERE cm.conversation_id = c.id
			ORDER BY cm.created_at DESC LIMIT 1
		) last ON true
		WHERE c.session_id = $1 AND c.kind = 'session_contact'
		ORDER BY last.created_at DESC`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []models.SessionContactThread{}
	for rows.Next() {
		var t models.SessionContactThread
		if err := rows.Scan(&t.SessionID, &t.MemberUserID, &t.MemberUsername, &t.MemberDisplayName, &t.LastMessageBody, &t.LastMessageSenderID, &t.LastMessageAt); err != nil {
			return nil, err
		}
		t.NeedsReply = t.LastMessageSenderID == t.MemberUserID
		result = append(result, t)
	}
	return result, rows.Err()
}

// ListMyContactThreads is the cross-Session Inbox listing — every
// session_contact thread userID is a party to, either as the member
// (their own thread with a Session's organizers) or as an organizer
// (owner/admin of the Session's Club, for any member's thread),
// most-recently-active first.
func ListMyContactThreads(ctx context.Context, pool *pgxpool.Pool, userID string) ([]models.SessionContactThread, error) {
	rows, err := pool.Query(ctx, `
		SELECT c.session_id, s.name, s.club_id, cl.name, u.id, u.username, u.display_name,
		       last.body, last.sender_id, last.created_at, c.id, `+unreadForUser+`
		FROM conversations c
		JOIN sessions s ON s.id = c.session_id
		JOIN clubs cl ON cl.id = s.club_id
		JOIN users u ON u.id = c.member_user_id
		JOIN LATERAL (
			SELECT body, sender_id, created_at FROM conversation_messages cm
			WHERE cm.conversation_id = c.id
			ORDER BY cm.created_at DESC LIMIT 1
		) last ON true
		WHERE c.kind = 'session_contact'
		  AND (c.member_user_id = $1
		    OR EXISTS (
		      SELECT 1 FROM club_members m
		      WHERE m.club_id = s.club_id AND m.user_id = $1 AND m.role IN ('owner', 'admin')
		    ))
		ORDER BY last.created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []models.SessionContactThread{}
	for rows.Next() {
		var t models.SessionContactThread
		if err := rows.Scan(&t.SessionID, &t.SessionName, &t.ClubID, &t.ClubName, &t.MemberUserID, &t.MemberUsername, &t.MemberDisplayName,
			&t.LastMessageBody, &t.LastMessageSenderID, &t.LastMessageAt, &t.ConversationID, &t.UnreadCount); err != nil {
			return nil, err
		}
		t.NeedsReply = contactThreadNeedsReply(t.MemberUserID, t.LastMessageSenderID, userID)
		result = append(result, t)
	}
	return result, rows.Err()
}
