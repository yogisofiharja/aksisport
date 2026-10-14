package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

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
	m.hub.Publish(participants, live.Event{Type: "message.created", Data: gin.H{
		"conversationId": conv.ID,
		"kind":           conv.Kind,
		"sessionId":      conv.SessionID,
		"message":        message,
	}})

	// Pushes: direct messages and Contact Organizer only — Session Chat
	// would be too noisy (DP-021). Only to people without Aksi open: the
	// live event already reached everyone else.
	if m.notifier == nil || conv.Kind == models.ConversationKindSessionChat {
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
		hub.Publish(participants, live.Event{Type: "read", Data: gin.H{"conversationId": conversationID, "userId": me, "lastReadAt": at}})
		c.Status(http.StatusNoContent)
	})

	// Everyone's read position in a conversation — read receipts.
	profiled.GET("/conversations/:id/reads", func(c *gin.Context) {
		conversationID := c.Param("id")
		if _, ok := requireConversationParticipant(c, pool, conversationID); !ok {
			return
		}
		reads, err := dbpkg.ListConversationReads(c.Request.Context(), pool, conversationID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, reads)
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
	hub.Publish(others, live.Event{Type: "typing", Data: gin.H{
		"conversationId": msg.ConversationID,
		"userId":         user.ID,
		"name":           displayNameOf(user.DisplayName, user.Username),
	}})
}
