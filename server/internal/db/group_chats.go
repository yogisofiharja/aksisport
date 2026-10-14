package db

import (
	"context"
	"errors"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/models"
)

// DP-021 step 3: group chats and Community chat. Who may be added to a
// group, and who may manage it, is decided by the caller (httpapi).

// MaxGroupMembers is a group chat's size limit, its creator included.
const MaxGroupMembers = 50

func CreateGroupChat(ctx context.Context, pool *pgxpool.Pool, creatorID, title string, memberIDs []string) (string, error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)
	var id string
	if err := tx.QueryRow(ctx,
		"INSERT INTO conversations (kind, title, created_by) VALUES ('group', nullif($1, ''), $2) RETURNING id", title, creatorID,
	).Scan(&id); err != nil {
		return "", err
	}
	for _, userID := range append([]string{creatorID}, memberIDs...) {
		if _, err := tx.Exec(ctx,
			"INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", id, userID); err != nil {
			return "", err
		}
	}
	return id, tx.Commit(ctx)
}

// GetGroupChat is a group with its members, oldest member first;
// ErrNotFound for anything but a group.
func GetGroupChat(ctx context.Context, pool *pgxpool.Pool, conversationID string) (models.GroupChat, error) {
	var g models.GroupChat
	if !IsUUID(conversationID) {
		return g, ErrNotFound
	}
	err := pool.QueryRow(ctx,
		"SELECT id, coalesce(title, ''), created_by, created_at FROM conversations WHERE id = $1 AND kind = 'group'", conversationID,
	).Scan(&g.ID, &g.Title, &g.CreatedBy, &g.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return g, ErrNotFound
	}
	if err != nil {
		return g, err
	}
	rows, err := pool.Query(ctx,
		`SELECT u.id, u.username, u.display_name, (u.avatar_image_data IS NOT NULL)
		 FROM conversation_members m JOIN users u ON u.id = m.user_id
		 WHERE m.conversation_id = $1 ORDER BY m.added_at, u.username`, g.ID)
	if err != nil {
		return g, err
	}
	defer rows.Close()
	g.Members = []models.GroupMember{}
	for rows.Next() {
		var m models.GroupMember
		if err := rows.Scan(&m.UserID, &m.Username, &m.DisplayName, &m.HasAvatar); err != nil {
			return g, err
		}
		g.Members = append(g.Members, m)
	}
	return g, rows.Err()
}

func RenameGroupChat(ctx context.Context, pool *pgxpool.Pool, conversationID, title string) error {
	_, err := pool.Exec(ctx, "UPDATE conversations SET title = nullif($2, '') WHERE id = $1 AND kind = 'group'", conversationID, title)
	return err
}

func AddGroupMembers(ctx context.Context, pool *pgxpool.Pool, conversationID string, userIDs []string) error {
	for _, userID := range userIDs {
		if _, err := pool.Exec(ctx,
			"INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", conversationID, userID); err != nil {
			return err
		}
	}
	return nil
}

// RemoveGroupMember takes someone out of a group (removed, or leaving).
// When the one leaving is its creator, the longest-standing member who
// remains takes over managing it.
func RemoveGroupMember(ctx context.Context, pool *pgxpool.Pool, conversationID, userID string) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, "DELETE FROM conversation_members WHERE conversation_id = $1 AND user_id = $2", conversationID, userID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx,
		`UPDATE conversations SET created_by = (
			SELECT user_id FROM conversation_members WHERE conversation_id = $1 ORDER BY added_at LIMIT 1)
		 WHERE id = $1 AND created_by = $2`, conversationID, userID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// ListMyGroupThreads is every group the user is in, for Inbox, most
// recently active first (a group with no messages yet by its creation).
func ListMyGroupThreads(ctx context.Context, pool *pgxpool.Pool, userID string) ([]models.GroupThread, error) {
	rows, err := pool.Query(ctx,
		`SELECT c.id, coalesce(c.title, ''), (SELECT count(*) FROM conversation_members x WHERE x.conversation_id = c.id),
		        ARRAY(SELECT coalesce(nullif(u.display_name, ''), u.username) FROM conversation_members x JOIN users u ON u.id = x.user_id
		              WHERE x.conversation_id = c.id AND x.user_id <> $1 ORDER BY x.added_at LIMIT 4),
		        coalesce(last.body, ''), coalesce(last.has_image, false), coalesce(last.gone, false),
		        last.sender_id, lu.username, lu.display_name, coalesce(last.created_at, c.created_at), `+unreadForUser+`
		 FROM conversation_members me
		 JOIN conversations c ON c.id = me.conversation_id AND c.kind = 'group'
		 LEFT JOIN LATERAL (
			SELECT cm.body, (cm.image_data IS NOT NULL) AS has_image, cm.sender_id, cm.created_at,
			       (cm.deleted_at IS NOT NULL OR cm.removed_at IS NOT NULL) AS gone
			FROM conversation_messages cm
			WHERE cm.conversation_id = c.id AND (NOT cm.withheld OR cm.sender_id = $1) AND `+hiddenForUser+`
			ORDER BY cm.created_at DESC LIMIT 1
		 ) last ON true
		 LEFT JOIN users lu ON lu.id = last.sender_id
		 WHERE me.user_id = $1
		 ORDER BY coalesce(last.created_at, c.created_at) DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []models.GroupThread{}
	for rows.Next() {
		var t models.GroupThread
		if err := rows.Scan(&t.ConversationID, &t.Title, &t.MemberCount, &t.MemberNames, &t.LastMessageBody, &t.LastMessageHasImage, &t.LastMessageDeleted,
			&t.LastMessageSenderID, &t.LastMessageSenderUsername, &t.LastMessageSenderDisplayName, &t.LastActivityAt, &t.UnreadCount); err != nil {
			return nil, err
		}
		result = append(result, t)
	}
	return result, rows.Err()
}

// ListMessageableUsers is who the user may start a direct message or a
// group with (DP-020): everyone sharing a Community with them, plus anyone
// they already have a direct conversation with — matching a search on
// username or display name, blocked people (either way) left out.
func ListMessageableUsers(ctx context.Context, pool *pgxpool.Pool, userID, query string) ([]models.UserSummaryLite, error) {
	rows, err := pool.Query(ctx,
		`SELECT u.id, u.username, u.display_name, (u.avatar_image_data IS NOT NULL)
		 FROM users u
		 WHERE u.id <> $1
		   AND (EXISTS (SELECT 1 FROM club_members a JOIN club_members b ON b.club_id = a.club_id WHERE a.user_id = $1 AND b.user_id = u.id)
		     OR EXISTS (SELECT 1 FROM conversations d WHERE d.kind = 'direct' AND ((d.user_low = $1 AND d.user_high = u.id) OR (d.user_high = $1 AND d.user_low = u.id))))
		   AND NOT EXISTS (SELECT 1 FROM user_blocks ub WHERE (ub.blocker_id = $1 AND ub.blocked_id = u.id) OR (ub.blocker_id = u.id AND ub.blocked_id = $1))
		   AND ($2 = '' OR u.username ILIKE '%' || $2 || '%' OR coalesce(u.display_name, '') ILIKE '%' || $2 || '%')
		 ORDER BY coalesce(u.display_name, u.username)
		 LIMIT 50`,
		userID, query,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []models.UserSummaryLite{}
	for rows.Next() {
		var u models.UserSummaryLite
		if err := rows.Scan(&u.UserID, &u.Username, &u.DisplayName, &u.HasAvatar); err != nil {
			return nil, err
		}
		result = append(result, u)
	}
	return result, rows.Err()
}

// ---- Community chat

func GetClubChatEnabled(ctx context.Context, pool *pgxpool.Pool, clubID string) (bool, error) {
	var enabled bool
	err := pool.QueryRow(ctx, "SELECT chat_enabled FROM clubs WHERE id = $1", clubID).Scan(&enabled)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, ErrNotFound
	}
	return enabled, err
}

func SetClubChatEnabled(ctx context.Context, pool *pgxpool.Pool, clubID string, enabled bool) error {
	_, err := pool.Exec(ctx, "UPDATE clubs SET chat_enabled = $2 WHERE id = $1", clubID, enabled)
	return err
}

// GetClubConversationID is the Community's chat, or ErrNotFound before
// the first message.
func GetClubConversationID(ctx context.Context, pool *pgxpool.Pool, clubID string) (string, error) {
	var id string
	err := pool.QueryRow(ctx, "SELECT id FROM conversations WHERE kind = 'club' AND club_id = $1", clubID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	return id, err
}

func GetOrCreateClubConversationID(ctx context.Context, pool *pgxpool.Pool, clubID string) (string, error) {
	var id string
	err := pool.QueryRow(ctx,
		`INSERT INTO conversations (kind, club_id) VALUES ('club', $1)
		 ON CONFLICT (club_id) WHERE kind = 'club' DO UPDATE SET kind = conversations.kind
		 RETURNING id`, clubID,
	).Scan(&id)
	return id, err
}

// ClubChatUnread is the user's unread count in a Community's chat.
func ClubChatUnread(ctx context.Context, pool *pgxpool.Pool, clubID, userID string) (int, error) {
	var count int
	err := pool.QueryRow(ctx,
		`SELECT coalesce((SELECT `+unreadForUser+` FROM conversations c WHERE c.kind = 'club' AND c.club_id = $2), 0)`,
		userID, clubID,
	).Scan(&count)
	return count, err
}

// MessageableUserIDs is which of the given users the user may put in a
// group: the ListMessageableUsers rule, one by one.
func MessageableUserIDs(ctx context.Context, pool *pgxpool.Pool, userID string, candidates []string) (map[string]bool, error) {
	valid := []string{}
	for _, id := range candidates {
		if IsUUID(id) && id != userID {
			valid = append(valid, id)
		}
	}
	rows, err := pool.Query(ctx,
		`SELECT u.id FROM users u
		 WHERE u.id = ANY($2)
		   AND (EXISTS (SELECT 1 FROM club_members a JOIN club_members b ON b.club_id = a.club_id WHERE a.user_id = $1 AND b.user_id = u.id)
		     OR EXISTS (SELECT 1 FROM conversations d WHERE d.kind = 'direct' AND ((d.user_low = $1 AND d.user_high = u.id) OR (d.user_high = $1 AND d.user_low = u.id))))
		   AND NOT EXISTS (SELECT 1 FROM user_blocks ub WHERE (ub.blocker_id = $1 AND ub.blocked_id = u.id) OR (ub.blocker_id = u.id AND ub.blocked_id = $1))`,
		userID, valid)
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

// GetConversationMessageImageByID serves one message's image; the caller
// has already checked the viewer belongs in its conversation.
func GetConversationMessageImageByID(ctx context.Context, pool *pgxpool.Pool, messageID string) (models.ConversationMessageImage, error) {
	var img models.ConversationMessageImage
	var contentType *string
	if !IsUUID(messageID) {
		return img, ErrNotFound
	}
	err := pool.QueryRow(ctx,
		"SELECT image_data, image_content_type FROM conversation_messages WHERE id = $1 AND image_data IS NOT NULL", messageID,
	).Scan(&img.Data, &contentType)
	if errors.Is(err, pgx.ErrNoRows) {
		return img, ErrNotFound
	}
	if contentType != nil {
		img.ContentType = *contentType
	}
	return img, err
}

// ListClubMemberIDs is every member of a Community.
func ListClubMemberIDs(ctx context.Context, pool *pgxpool.Pool, clubID string) ([]string, error) {
	return collectIDs(ctx, pool, "SELECT user_id FROM club_members WHERE club_id = $1", clubID)
}

// GroupLabel is what a group is called in a push: its name, or its
// members' names (up to three, then "+N").
func GroupLabel(ctx context.Context, pool *pgxpool.Pool, conversationID string) (string, error) {
	var title string
	var names []string
	var count int
	err := pool.QueryRow(ctx,
		`SELECT coalesce(c.title, ''),
		        ARRAY(SELECT coalesce(nullif(u.display_name, ''), u.username) FROM conversation_members x JOIN users u ON u.id = x.user_id
		              WHERE x.conversation_id = c.id ORDER BY x.added_at LIMIT 3),
		        (SELECT count(*) FROM conversation_members x WHERE x.conversation_id = c.id)
		 FROM conversations c WHERE c.id = $1`, conversationID,
	).Scan(&title, &names, &count)
	if err != nil || title != "" {
		return title, err
	}
	return JoinGroupNames(names, count), nil
}

// JoinGroupNames: "Ana, Budi, Citra" or "Ana, Budi, Citra +2".
func JoinGroupNames(names []string, total int) string {
	label := strings.Join(names, ", ")
	if extra := total - len(names); extra > 0 {
		label += " +" + strconv.Itoa(extra)
	}
	return label
}
