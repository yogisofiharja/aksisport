package httpapi

import (
	"errors"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/authjwt"
	dbpkg "github.com/yogisofiharja/aksi-server/internal/db"
	"github.com/yogisofiharja/aksi-server/internal/live"
	"github.com/yogisofiharja/aksi-server/internal/models"
)

// DP-021 step 3: group chats and Community chat, on the shared
// conversations engine.

const maxGroupTitleLength = 60

func validGroupTitle(c *gin.Context, raw string) (string, bool) {
	title := strings.TrimSpace(raw)
	if title == "" || utf8.RuneCountInString(title) > maxGroupTitleLength {
		respondError(c, http.StatusBadRequest, "name the group, up to 60 characters")
		return "", false
	}
	return title, true
}

// requireGroup loads a group the caller is in; 404 otherwise.
func requireGroup(c *gin.Context, pool *pgxpool.Pool) (models.GroupChat, bool) {
	group, err := dbpkg.GetGroupChat(c.Request.Context(), pool, c.Param("groupId"))
	if errors.Is(err, dbpkg.ErrNotFound) {
		respondError(c, http.StatusNotFound, "group not found")
		return group, false
	}
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal error")
		return group, false
	}
	me := authjwt.CurrentUser(c).ID
	for _, m := range group.Members {
		if m.UserID == me {
			return group, true
		}
	}
	respondError(c, http.StatusNotFound, "group not found")
	return group, false
}

func requireGroupCreator(c *gin.Context, group models.GroupChat) bool {
	if group.CreatedBy == nil || *group.CreatedBy != authjwt.CurrentUser(c).ID {
		respondError(c, http.StatusForbidden, "only the group's creator can do this")
		return false
	}
	return true
}

// checkNewGroupMembers: everyone added must be someone the adder could
// message (not blocked either way), and the group stays within 50.
func checkNewGroupMembers(c *gin.Context, pool *pgxpool.Pool, userIDs []string, currentCount int) ([]string, bool) {
	me := authjwt.CurrentUser(c).ID
	allowed, err := dbpkg.MessageableUserIDs(c.Request.Context(), pool, me, userIDs)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal error")
		return nil, false
	}
	unique := []string{}
	seen := map[string]bool{}
	for _, id := range userIDs {
		if seen[id] {
			continue
		}
		seen[id] = true
		if !allowed[id] {
			respondError(c, http.StatusBadRequest, "you can only add people you can message")
			return nil, false
		}
		unique = append(unique, id)
	}
	if currentCount+len(unique) > dbpkg.MaxGroupMembers {
		respondError(c, http.StatusBadRequest, "a group can have up to 50 people")
		return nil, false
	}
	return unique, true
}

func RegisterChatRoutes(rg *gin.RouterGroup, pool *pgxpool.Pool, verifier *authjwt.Verifier, hub *live.Hub, msgs *messenger) {
	profiled := rg.Group("")
	profiled.Use(authjwt.RequireAuth(verifier))
	profiled.Use(authjwt.RequireProfile(pool))

	// People you can start a conversation or group with, by name.
	profiled.GET("/me/messageable-users", func(c *gin.Context) {
		users, err := dbpkg.ListMessageableUsers(c.Request.Context(), pool, authjwt.CurrentUser(c).ID, strings.TrimSpace(c.Query("q")))
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, users)
	})

	// Any message's image, for anyone in its conversation.
	profiled.GET("/conversation-messages/:id/image", func(c *gin.Context) {
		ctx := c.Request.Context()
		message, err := dbpkg.GetConversationMessage(ctx, pool, c.Param("id"))
		me := authjwt.CurrentUser(c).ID
		if errors.Is(err, dbpkg.ErrNotFound) || (err == nil && message.Withheld && message.SenderID != me) {
			respondError(c, http.StatusNotFound, "image not found")
			return
		}
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		if _, ok := requireConversationParticipant(c, pool, message.ConversationID); !ok {
			return
		}
		img, err := dbpkg.GetConversationMessageImageByID(ctx, pool, message.ID)
		if errors.Is(err, dbpkg.ErrNotFound) {
			respondError(c, http.StatusNotFound, "image not found")
			return
		}
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.Header("Cache-Control", "private, max-age=31536000, immutable")
		c.Data(http.StatusOK, img.ContentType, img.Data)
	})

	// ---- Group chats

	profiled.GET("/me/groups", func(c *gin.Context) {
		threads, err := dbpkg.ListMyGroupThreads(c.Request.Context(), pool, authjwt.CurrentUser(c).ID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, threads)
	})

	profiled.POST("/groups", func(c *gin.Context) {
		var req struct {
			Title     string   `json:"title"`
			MemberIDs []string `json:"memberIds"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			respondError(c, http.StatusBadRequest, "invalid request")
			return
		}
		title, ok := validGroupTitle(c, req.Title)
		if !ok {
			return
		}
		if len(req.MemberIDs) == 0 {
			respondError(c, http.StatusBadRequest, "add at least one person")
			return
		}
		members, ok := checkNewGroupMembers(c, pool, req.MemberIDs, 1)
		if !ok {
			return
		}
		ctx := c.Request.Context()
		id, err := dbpkg.CreateGroupChat(ctx, pool, authjwt.CurrentUser(c).ID, title, members)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		group, err := dbpkg.GetGroupChat(ctx, pool, id)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		announceGroup(hub, group, nil)
		c.JSON(http.StatusCreated, group)
	})

	profiled.GET("/groups/:groupId", func(c *gin.Context) {
		group, ok := requireGroup(c, pool)
		if !ok {
			return
		}
		c.JSON(http.StatusOK, group)
	})

	profiled.PATCH("/groups/:groupId", func(c *gin.Context) {
		group, ok := requireGroup(c, pool)
		if !ok || !requireGroupCreator(c, group) {
			return
		}
		var req struct {
			Title string `json:"title"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			respondError(c, http.StatusBadRequest, "invalid request")
			return
		}
		title, ok := validGroupTitle(c, req.Title)
		if !ok {
			return
		}
		if err := dbpkg.RenameGroupChat(c.Request.Context(), pool, group.ID, title); err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		announceGroup(hub, group, nil)
		c.Status(http.StatusNoContent)
	})

	profiled.POST("/groups/:groupId/members", func(c *gin.Context) {
		group, ok := requireGroup(c, pool)
		if !ok || !requireGroupCreator(c, group) {
			return
		}
		var req struct {
			UserIDs []string `json:"userIds"`
		}
		if err := c.ShouldBindJSON(&req); err != nil || len(req.UserIDs) == 0 {
			respondError(c, http.StatusBadRequest, "choose people to add")
			return
		}
		inGroup := map[string]bool{}
		for _, m := range group.Members {
			inGroup[m.UserID] = true
		}
		fresh := []string{}
		for _, id := range req.UserIDs {
			if !inGroup[id] {
				fresh = append(fresh, id)
			}
		}
		members, ok := checkNewGroupMembers(c, pool, fresh, len(group.Members))
		if !ok {
			return
		}
		ctx := c.Request.Context()
		if err := dbpkg.AddGroupMembers(ctx, pool, group.ID, members); err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		updated, err := dbpkg.GetGroupChat(ctx, pool, group.ID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		announceGroup(hub, updated, nil)
		c.JSON(http.StatusOK, updated)
	})

	// The creator removes someone; anyone removes themself (leaves).
	profiled.DELETE("/groups/:groupId/members/:userId", func(c *gin.Context) {
		group, ok := requireGroup(c, pool)
		if !ok {
			return
		}
		target := c.Param("userId")
		if target != authjwt.CurrentUser(c).ID && !requireGroupCreator(c, group) {
			return
		}
		if err := dbpkg.RemoveGroupMember(c.Request.Context(), pool, group.ID, target); err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		announceGroup(hub, group, nil)
		c.Status(http.StatusNoContent)
	})

	profiled.GET("/groups/:groupId/messages", func(c *gin.Context) {
		group, ok := requireGroup(c, pool)
		if !ok {
			return
		}
		messages, err := dbpkg.ListConversationMessages(c.Request.Context(), pool, group.ID, authjwt.CurrentUser(c).ID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, messages)
	})

	profiled.POST("/groups/:groupId/messages", func(c *gin.Context) {
		group, ok := requireGroup(c, pool)
		if !ok {
			return
		}
		body, imageData, imageContentType, ok := parseConversationMessageBody(c)
		if !ok {
			return
		}
		me := authjwt.CurrentUser(c)
		ctx := c.Request.Context()
		message, err := dbpkg.CreateConversationMessage(ctx, pool, dbpkg.CreateConversationMessageParams{
			ConversationID: group.ID, SenderID: me.ID, Body: body, ImageData: imageData, ImageContentType: imageContentType,
		})
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		msgs.announce(ctx, me, message)
		c.JSON(http.StatusCreated, message)
	})

	// ---- Community chat: every member reads and posts; owner/admins can
	// delete any message and turn it off.

	profiled.GET("/clubs/:clubId/chat", func(c *gin.Context) {
		clubID := c.Param("clubId")
		if _, _, ok := requireMember(c, pool, clubID); !ok {
			return
		}
		ctx := c.Request.Context()
		enabled, err := dbpkg.GetClubChatEnabled(ctx, pool, clubID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		unread, err := dbpkg.ClubChatUnread(ctx, pool, clubID, authjwt.CurrentUser(c).ID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, gin.H{"enabled": enabled, "unreadCount": unread})
	})

	profiled.PATCH("/clubs/:clubId/chat", func(c *gin.Context) {
		clubID := c.Param("clubId")
		if !requireOwnerOrAdmin(c, pool, clubID) {
			return
		}
		var req struct {
			Enabled *bool `json:"enabled"`
		}
		if err := c.ShouldBindJSON(&req); err != nil || req.Enabled == nil {
			respondError(c, http.StatusBadRequest, "invalid request")
			return
		}
		ctx := c.Request.Context()
		if err := dbpkg.SetClubChatEnabled(ctx, pool, clubID, *req.Enabled); err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		if members, err := dbpkg.ListClubMemberIDs(ctx, pool, clubID); err == nil {
			hub.Publish(members, live.Event{Type: "club.chat.updated", Data: gin.H{"clubId": clubID, "enabled": *req.Enabled}})
		}
		c.Status(http.StatusNoContent)
	})

	profiled.GET("/clubs/:clubId/chat/messages", func(c *gin.Context) {
		clubID := c.Param("clubId")
		if _, _, ok := requireMember(c, pool, clubID); !ok {
			return
		}
		ctx := c.Request.Context()
		convID, err := dbpkg.GetClubConversationID(ctx, pool, clubID)
		if errors.Is(err, dbpkg.ErrNotFound) {
			c.JSON(http.StatusOK, []models.ConversationMessage{})
			return
		}
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		messages, err := dbpkg.ListConversationMessages(ctx, pool, convID, authjwt.CurrentUser(c).ID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, messages)
	})

	profiled.POST("/clubs/:clubId/chat/messages", func(c *gin.Context) {
		clubID := c.Param("clubId")
		if _, _, ok := requireMember(c, pool, clubID); !ok {
			return
		}
		ctx := c.Request.Context()
		enabled, err := dbpkg.GetClubChatEnabled(ctx, pool, clubID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		if !enabled {
			c.JSON(http.StatusForbidden, gin.H{"error": "this Community's chat is turned off", "code": "CHAT_OFF"})
			return
		}
		body, imageData, imageContentType, ok := parseConversationMessageBody(c)
		if !ok {
			return
		}
		convID, err := dbpkg.GetOrCreateClubConversationID(ctx, pool, clubID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		me := authjwt.CurrentUser(c)
		message, err := dbpkg.CreateConversationMessage(ctx, pool, dbpkg.CreateConversationMessageParams{
			ConversationID: convID, SenderID: me.ID, Body: body, ImageData: imageData, ImageContentType: imageContentType,
		})
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		msgs.announce(ctx, me, message)
		c.JSON(http.StatusCreated, message)
	})

	// An owner/admin deletes any message in their Community's chat; it
	// shows as removed by an organizer.
	profiled.DELETE("/clubs/:clubId/chat/messages/:messageId", func(c *gin.Context) {
		clubID := c.Param("clubId")
		if !requireOwnerOrAdmin(c, pool, clubID) {
			return
		}
		ctx := c.Request.Context()
		convID, err := dbpkg.GetClubConversationID(ctx, pool, clubID)
		if err != nil && !errors.Is(err, dbpkg.ErrNotFound) {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		message, err := dbpkg.GetConversationMessage(ctx, pool, c.Param("messageId"))
		if errors.Is(err, dbpkg.ErrNotFound) || (err == nil && message.ConversationID != convID) {
			respondError(c, http.StatusNotFound, "message not found")
			return
		}
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		if err := dbpkg.RemoveMessage(ctx, pool, message.ID, authjwt.CurrentUser(c).ID); err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		if members, err := dbpkg.ListClubMemberIDs(ctx, pool, clubID); err == nil {
			hub.Publish(members, live.Event{Type: "message.removed", Data: gin.H{"conversationId": convID, "messageId": message.ID}})
		}
		c.Status(http.StatusNoContent)
	})
}

// announceGroup tells everyone who is or was in a group that it changed
// (name, members), so their screens refresh. extra: people just removed.
func announceGroup(hub *live.Hub, group models.GroupChat, extra []string) {
	ids := extra
	for _, m := range group.Members {
		ids = append(ids, m.UserID)
	}
	hub.Publish(ids, live.Event{Type: "group.updated", Data: gin.H{"conversationId": group.ID}})
}
