package db

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/models"
)

// DP-021: who is in a conversation, how far each has read, and unread
// counts.

// ConversationParticipantIDs is everyone who belongs in a conversation —
// who receives its live events and pushes:
//   - direct: the two people;
//   - session_contact: the member, and the owner/admins of the Session's
//     Community;
//   - session_chat: every member of the Session's Community (organizers
//     only while the Session is still a Draft, which nobody else can see);
//   - group: its members;
//   - club: every member of the Community.
func ConversationParticipantIDs(ctx context.Context, pool *pgxpool.Pool, conversationID string) (models.Conversation, []string, error) {
	var conv models.Conversation
	if !IsUUID(conversationID) {
		return conv, nil, ErrNotFound
	}
	var sessionID, low, high, clubID, title *string
	err := pool.QueryRow(ctx,
		"SELECT id, kind, session_id, member_user_id, user_low, user_high, club_id, title, created_at FROM conversations WHERE id = $1",
		conversationID,
	).Scan(&conv.ID, &conv.Kind, &sessionID, &conv.MemberUserID, &low, &high, &clubID, &title, &conv.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return conv, nil, ErrNotFound
	}
	if err != nil {
		return conv, nil, err
	}
	if sessionID != nil {
		conv.SessionID = *sessionID
	}
	if clubID != nil {
		conv.ClubID = *clubID
	}
	if title != nil {
		conv.Title = *title
	}

	switch conv.Kind {
	case models.ConversationKindDirect:
		return conv, []string{*low, *high}, nil
	case models.ConversationKindGroup:
		ids, err := collectIDs(ctx, pool, "SELECT user_id FROM conversation_members WHERE conversation_id = $1", conv.ID)
		return conv, ids, err
	case models.ConversationKindClub:
		ids, err := collectIDs(ctx, pool, "SELECT user_id FROM club_members WHERE club_id = $1", conv.ClubID)
		return conv, ids, err
	case models.ConversationKindSessionContact:
		ids, err := collectIDs(ctx, pool,
			`SELECT m.user_id FROM club_members m JOIN sessions s ON s.club_id = m.club_id
			 WHERE s.id = $1 AND m.role IN ('owner', 'admin')`, conv.SessionID)
		if err != nil {
			return conv, nil, err
		}
		return conv, appendUnique(ids, *conv.MemberUserID), nil
	default: // session_chat
		ids, err := collectIDs(ctx, pool,
			`SELECT m.user_id FROM club_members m JOIN sessions s ON s.club_id = m.club_id
			 WHERE s.id = $1 AND (s.status <> 'draft' OR m.role IN ('owner', 'admin'))`, conv.SessionID)
		return conv, ids, err
	}
}

func collectIDs(ctx context.Context, pool *pgxpool.Pool, query string, args ...any) ([]string, error) {
	rows, err := pool.Query(ctx, query, args...)
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

func appendUnique(ids []string, id string) []string {
	for _, existing := range ids {
		if existing == id {
			return ids
		}
	}
	return append(ids, id)
}

// MarkConversationRead moves the user's read position to now. Returns it.
func MarkConversationRead(ctx context.Context, pool *pgxpool.Pool, conversationID, userID string) (time.Time, error) {
	var at time.Time
	err := pool.QueryRow(ctx,
		`INSERT INTO conversation_reads (conversation_id, user_id, last_read_at) VALUES ($1, $2, now())
		 ON CONFLICT (conversation_id, user_id) DO UPDATE SET last_read_at = now()
		 RETURNING last_read_at`,
		conversationID, userID,
	).Scan(&at)
	return at, err
}

// ListConversationReads is every read position in a conversation — what
// read receipts are drawn from.
func ListConversationReads(ctx context.Context, pool *pgxpool.Pool, conversationID string) ([]models.ConversationRead, error) {
	rows, err := pool.Query(ctx,
		"SELECT user_id, last_read_at FROM conversation_reads WHERE conversation_id = $1", conversationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []models.ConversationRead{}
	for rows.Next() {
		var r models.ConversationRead
		if err := rows.Scan(&r.UserID, &r.LastReadAt); err != nil {
			return nil, err
		}
		result = append(result, r)
	}
	return result, rows.Err()
}

// unreadForUser counts messages from others newer than the user's read
// position in conversation alias `c` — for SELECT lists. $1 is the user.
const unreadForUser = `(SELECT count(*) FROM conversation_messages um
	WHERE um.conversation_id = c.id AND um.sender_id <> $1 AND NOT um.withheld AND um.deleted_at IS NULL
	  AND um.created_at > coalesce((SELECT r.last_read_at FROM conversation_reads r WHERE r.conversation_id = c.id AND r.user_id = $1), '-infinity'))`

// CountUnreadMessages is the Inbox tab's badge: unread messages across the
// user's direct conversations, group chats and Contact Organizer threads
// (the ones listed in Inbox).
func CountUnreadMessages(ctx context.Context, pool *pgxpool.Pool, userID string) (int, error) {
	var count int
	err := pool.QueryRow(ctx,
		`SELECT coalesce(sum(`+unreadForUser+`), 0)
		 FROM conversations c
		 WHERE (c.kind = 'direct' AND (c.user_low = $1 OR c.user_high = $1))
		    OR (c.kind = 'group' AND EXISTS (SELECT 1 FROM conversation_members gm WHERE gm.conversation_id = c.id AND gm.user_id = $1))
		    OR (c.kind = 'session_contact' AND (c.member_user_id = $1 OR EXISTS (
		        SELECT 1 FROM sessions s JOIN club_members m ON m.club_id = s.club_id
		        WHERE s.id = c.session_id AND m.user_id = $1 AND m.role IN ('owner', 'admin'))))`,
		userID,
	).Scan(&count)
	return count, err
}

// SessionChatUnread is the Session Chat conversation's id and the user's
// unread count in it — for the Session's Chat tab. ("", 0) before anyone
// has posted.
func SessionChatUnread(ctx context.Context, pool *pgxpool.Pool, sessionID, userID string) (string, int, error) {
	var id string
	var count int
	if !IsUUID(sessionID) {
		return "", 0, nil
	}
	err := pool.QueryRow(ctx,
		`SELECT c.id, `+unreadForUser+` FROM conversations c WHERE c.kind = 'session_chat' AND c.session_id = $2`,
		userID, sessionID,
	).Scan(&id, &count)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", 0, nil
	}
	return id, count, err
}
