package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/coder/websocket"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/authjwt"
	dbpkg "github.com/yogisofiharja/aksi-server/internal/db"
	"github.com/yogisofiharja/aksi-server/internal/live"
	"github.com/yogisofiharja/aksi-server/internal/models"
	"github.com/yogisofiharja/aksi-server/internal/notify"
)

// messenger is what every chat route uses after a message is stored
// (DP-021): tell everyone in the conversation at once over the live
// connection, and push to those who don't have Aksi open.
type messenger struct {
	pool     *pgxpool.Pool
	hub      *live.Hub
	notifier *notify.Service
}

func (m *messenger) announce(ctx context.Context, sender models.User, message models.ConversationMessage) {
	if m == nil || m.hub == nil {
		return
	}
	conv, participants, err := dbpkg.ConversationParticipantIDs(ctx, m.pool, message.ConversationID)
	if err != nil {
		log.Printf("messaging: participants of %s: %v", message.ConversationID, err)
		return
	}
	// Withheld (the recipient blocked the sender, DP-021): only the
	// sender's own screens hear of it, and nobody gets a push.
	if message.Withheld {
		participants = []string{sender.ID}
	}
	m.hub.Publish(participants, live.Event{Type: "message.created", Data: gin.H{
		"conversationId": conv.ID,
		"kind":           conv.Kind,
		"sessionId":      conv.SessionID,
		"clubId":         conv.ClubID,
		"message":        message,
	}})

	// Pushes: direct messages, group chats and Contact Organizer only —
	// Session Chat and Community chat would be too noisy (DP-021). Only to people without Aksi open: the
	// live event already reached everyone else.
	if m.notifier == nil || message.Withheld || conv.Kind == models.ConversationKindSessionChat || conv.Kind == models.ConversationKindClub {
		return
	}
	var offline []string
	for _, id := range participants {
		if id != sender.ID && !m.hub.IsConnected(id) {
			offline = append(offline, id)
		}
	}
	if len(offline) == 0 {
		return
	}
	name := displayNameOf(sender.DisplayName, sender.Username)
	switch conv.Kind {
	case models.ConversationKindDirect:
		m.notifier.PushOnly(offline, notify.Notification{
			Type:   notify.TypeDirectMessage,
			Params: map[string]string{"name": name, "body": message.Body},
			Path:   "/messages/" + sender.ID,
		})
	case models.ConversationKindGroup:
		label, err := dbpkg.GroupLabel(ctx, m.pool, conv.ID)
		if err != nil {
			log.Printf("messaging: group label %s: %v", conv.ID, err)
		}
		m.notifier.PushOnly(offline, notify.Notification{
			Type:   notify.TypeGroupMessage,
			Params: map[string]string{"name": name, "group": label, "body": message.Body},
			Path:   "/groups/" + conv.ID,
		})
	case models.ConversationKindSessionContact:
		sessionName := "Session"
		if sess, err := dbpkg.GetSession(ctx, m.pool, conv.SessionID); err == nil && sess.Name != nil {
			sessionName = *sess.Name
		}
		m.notifier.PushOnly(offline, notify.Notification{
			Type:   notify.TypeContactMessage,
			Params: map[string]string{"name": name, "body": message.Body, "session": sessionName},
			Path:   "/sessions/" + conv.SessionID,
		})
	}
}

// requireConversationParticipant loads a conversation and checks the
// caller belongs in it; 404 otherwise (whether or not it exists).
func requireConversationParticipant(c *gin.Context, pool *pgxpool.Pool, conversationID string) ([]string, bool) {
	_, participants, err := dbpkg.ConversationParticipantIDs(c.Request.Context(), pool, conversationID)
	if errors.Is(err, dbpkg.ErrNotFound) {
		respondError(c, http.StatusNotFound, "conversation not found")
		return nil, false
	}
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal error")
		return nil, false
	}
	me := authjwt.CurrentUser(c).ID
	for _, id := range participants {
		if id == me {
			return participants, true
		}
	}
	respondError(c, http.StatusNotFound, "conversation not found")
	return nil, false
}

func RegisterMessagingRoutes(rg *gin.RouterGroup, pool *pgxpool.Pool, verifier *authjwt.Verifier, hub *live.Hub, allowedOrigins string) {
	profiled := rg.Group("")
	profiled.Use(authjwt.RequireAuth(verifier))
	profiled.Use(authjwt.RequireProfile(pool))

	// The Inbox tab's badge.
	profiled.GET("/me/unread-messages", func(c *gin.Context) {
		count, err := dbpkg.CountUnreadMessages(c.Request.Context(), pool, authjwt.CurrentUser(c).ID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, gin.H{"count": count})
	})

	// Unread messages in a Session's Chat — its Chat tab's badge. Session
	// Chat is not in Inbox, so it has a count of its own.
	profiled.GET("/sessions/:id/chat/unread", func(c *gin.Context) {
		ctx := c.Request.Context()
		conversationID, count, err := dbpkg.SessionChatUnread(ctx, pool, c.Param("id"), authjwt.CurrentUser(c).ID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		if conversationID == "" {
			c.JSON(http.StatusOK, gin.H{"count": 0})
			return
		}
		if _, ok := requireConversationParticipant(c, pool, conversationID); !ok {
			return
		}
		c.JSON(http.StatusOK, gin.H{"count": count})
	})

	// ---- Edit and delete, WhatsApp's rules (DP-021).

	// Edit your own message's text, within 15 minutes of sending.
	profiled.PATCH("/conversation-messages/:id", func(c *gin.Context) {
		message, participants, ok := loadOwnMessage(c, pool)
		if !ok {
			return
		}
		if time.Since(message.CreatedAt) > editWindow {
			respondError(c, http.StatusForbidden, "messages can only be edited for 15 minutes")
			return
		}
		var req struct {
			Body string `json:"body"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			respondError(c, http.StatusBadRequest, "invalid request")
			return
		}
		body := strings.TrimSpace(req.Body)
		if (body == "" && !message.HasImage) || utf8.RuneCountInString(body) > maxMessageBodyLength {
			respondError(c, http.StatusBadRequest, "a message needs text of up to 2000 characters")
			return
		}
		updated, err := dbpkg.EditConversationMessage(c.Request.Context(), pool, message.ID, body)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		hub.Publish(messageAudience(message, participants), live.Event{Type: "message.updated", Data: gin.H{"conversationId": message.ConversationID, "messageId": message.ID}})
		c.JSON(http.StatusOK, updated)
	})

	// ?for=everyone: your own message, within about 2½ days — everyone
	// sees "This message was deleted". ?for=me (default): any message you
	// can see, hidden only for you.
	profiled.DELETE("/conversation-messages/:id", func(c *gin.Context) {
		ctx := c.Request.Context()
		me := authjwt.CurrentUser(c).ID
		if c.Query("for") == "everyone" {
			message, participants, ok := loadOwnMessage(c, pool)
			if !ok {
				return
			}
			if time.Since(message.CreatedAt) > deleteForEveryoneWindow {
				respondError(c, http.StatusForbidden, "this message is too old to delete for everyone")
				return
			}
			if err := dbpkg.DeleteConversationMessageForEveryone(ctx, pool, message.ID); err != nil {
				respondError(c, http.StatusInternalServerError, "internal error")
				return
			}
			hub.Publish(messageAudience(message, participants), live.Event{Type: "message.updated", Data: gin.H{"conversationId": message.ConversationID, "messageId": message.ID}})
			c.Status(http.StatusNoContent)
			return
		}
		message, err := dbpkg.GetConversationMessage(ctx, pool, c.Param("id"))
		if errors.Is(err, dbpkg.ErrNotFound) || (err == nil && message.Withheld && message.SenderID != me) {
			respondError(c, http.StatusNotFound, "message not found")
			return
		}
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		if _, ok := requireConversationParticipant(c, pool, message.ConversationID); !ok {
			return
		}
		if err := dbpkg.HideConversationMessage(ctx, pool, message.ID, me); err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		// Your other devices.
		hub.Publish([]string{me}, live.Event{Type: "message.updated", Data: gin.H{"conversationId": message.ConversationID, "messageId": message.ID}})
		c.Status(http.StatusNoContent)
	})

	// "I have read up to now." Tells everyone in the conversation, so
	// their "Seen" updates at once.
	profiled.POST("/conversations/:id/read", func(c *gin.Context) {
		conversationID := c.Param("id")
		participants, ok := requireConversationParticipant(c, pool, conversationID)
		if !ok {
			return
		}
		me := authjwt.CurrentUser(c).ID
		at, err := dbpkg.MarkConversationRead(c.Request.Context(), pool, conversationID, me)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		// Not to anyone the reader blocked: blocking is silent, and a
		// "Seen" would give it away (DP-021).
		blocked, err := dbpkg.BlockedBy(c.Request.Context(), pool, me, participants)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		hub.Publish(withoutIDs(participants, blocked), live.Event{Type: "read", Data: gin.H{"conversationId": conversationID, "userId": me, "lastReadAt": at}})
		c.Status(http.StatusNoContent)
	})

	// Everyone's read position in a conversation — read receipts.
	profiled.GET("/conversations/:id/reads", func(c *gin.Context) {
		conversationID := c.Param("id")
		participants, ok := requireConversationParticipant(c, pool, conversationID)
		if !ok {
			return
		}
		ctx := c.Request.Context()
		reads, err := dbpkg.ListConversationReads(ctx, pool, conversationID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		// Leave out people who blocked the caller (DP-021).
		blockers, err := dbpkg.BlockersOf(ctx, pool, authjwt.CurrentUser(c).ID, participants)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		visible := []models.ConversationRead{}
		for _, r := range reads {
			if !blockers[r.UserID] {
				visible = append(visible, r)
			}
		}
		c.JSON(http.StatusOK, visible)
	})

	// The live connection. Browsers can't add an Authorization header to a
	// WebSocket, so the Firebase ID token comes as ?token= instead.
	rg.GET("/live", func(c *gin.Context) {
		uid, err := verifier.VerifyIDToken(c.Query("token"))
		if err != nil {
			respondError(c, http.StatusUnauthorized, "invalid token")
			return
		}
		ctx := c.Request.Context()
		user, err := dbpkg.GetUserByFirebaseUID(ctx, pool, uid)
		if err != nil || authjwt.EmailGateBlocks(user, "") {
			respondError(c, http.StatusForbidden, "no profile")
			return
		}
		conn, err := websocket.Accept(c.Writer, c.Request, liveAcceptOptions(allowedOrigins))
		if err != nil {
			return // Accept has already answered
		}
		hub.Serve(context.Background(), conn, user.ID, func(raw []byte) {
			handleLiveMessage(pool, hub, user, raw)
		})
	})
}

// liveAcceptOptions limits which web pages may open the live connection
// to the app's own origins (ALLOWED_ORIGINS). The phone apps send no
// Origin header and are not affected.
func liveAcceptOptions(allowedOrigins string) *websocket.AcceptOptions {
	if strings.TrimSpace(allowedOrigins) == "*" || strings.TrimSpace(allowedOrigins) == "" {
		return &websocket.AcceptOptions{InsecureSkipVerify: true}
	}
	var patterns []string
	for _, origin := range strings.Split(allowedOrigins, ",") {
		origin = strings.TrimSpace(origin)
		origin = strings.TrimPrefix(strings.TrimPrefix(origin, "https://"), "http://")
		if origin != "" {
			patterns = append(patterns, origin)
		}
	}
	return &websocket.AcceptOptions{OriginPatterns: patterns}
}

// Typing is the only thing clients send over the live connection:
// {"type":"typing","conversationId":"..."}. It is relayed to everyone
// else in the conversation, if the sender belongs in it.
func handleLiveMessage(pool *pgxpool.Pool, hub *live.Hub, user models.User, raw []byte) {
	var msg struct {
		Type           string `json:"type"`
		ConversationID string `json:"conversationId"`
	}
	if json.Unmarshal(raw, &msg) != nil || msg.Type != "typing" || msg.ConversationID == "" {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, participants, err := dbpkg.ConversationParticipantIDs(ctx, pool, msg.ConversationID)
	if err != nil {
		return
	}
	var others []string
	member := false
	for _, id := range participants {
		if id == user.ID {
			member = true
		} else {
			others = append(others, id)
		}
	}
	if !member {
		return
	}
	// Typing never crosses a block, either way (DP-021).
	blockedByMe, err := dbpkg.BlockedBy(ctx, pool, user.ID, others)
	if err != nil {
		return
	}
	blockers, err := dbpkg.BlockersOf(ctx, pool, user.ID, others)
	if err != nil {
		return
	}
	others = withoutIDs(withoutIDs(others, blockedByMe), blockers)
	hub.Publish(others, live.Event{Type: "typing", Data: gin.H{
		"conversationId": msg.ConversationID,
		"userId":         user.ID,
		"name":           displayNameOf(user.DisplayName, user.Username),
	}})
}

func withoutIDs(ids []string, drop map[string]bool) []string {
	if len(drop) == 0 {
		return ids
	}
	kept := make([]string, 0, len(ids))
	for _, id := range ids {
		if !drop[id] {
			kept = append(kept, id)
		}
	}
	return kept
}

// WhatsApp's limits (DP-021).
const (
	editWindow              = 15 * time.Minute
	deleteForEveryoneWindow = 60 * time.Hour
)

// loadOwnMessage loads the :id message for an edit or delete-for-everyone:
// the caller must have sent it, and it must still be there.
func loadOwnMessage(c *gin.Context, pool *pgxpool.Pool) (models.ConversationMessage, []string, bool) {
	message, err := dbpkg.GetConversationMessage(c.Request.Context(), pool, c.Param("id"))
	if errors.Is(err, dbpkg.ErrNotFound) {
		respondError(c, http.StatusNotFound, "message not found")
		return message, nil, false
	}
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal error")
		return message, nil, false
	}
	if message.SenderID != authjwt.CurrentUser(c).ID {
		respondError(c, http.StatusForbidden, "you can only change your own messages")
		return message, nil, false
	}
	if message.Deleted || message.Removed {
		respondError(c, http.StatusBadRequest, "this message was deleted")
		return message, nil, false
	}
	participants, ok := requireConversationParticipant(c, pool, message.ConversationID)
	return message, participants, ok
}

// messageAudience is who hears about a change to a message: everyone in
// the conversation, or only its sender when it was withheld by a block.
func messageAudience(message models.ConversationMessage, participants []string) []string {
	if message.Withheld {
		return []string{message.SenderID}
	}
	return participants
}

// Same limit as a new message (parseConversationMessageBody).
const maxMessageBodyLength = 2000
