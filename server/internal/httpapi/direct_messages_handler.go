package httpapi

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/authjwt"
	dbpkg "github.com/yogisofiharja/aksi-server/internal/db"
	"github.com/yogisofiharja/aksi-server/internal/models"
)

// DP-020 Direct Messages. Two players can message each other when they
// could see each other's profile (DP-019: they share a Community, or one
// is an organizer of a Community the other asked to join) — or when they
// already have a conversation, so a thread doesn't go dead if one of
// them later leaves a Community.
func canDirectMessage(c *gin.Context, pool *pgxpool.Pool, viewerID, otherID string) bool {
	if viewerID == otherID {
		respondError(c, http.StatusBadRequest, "you can't message yourself")
		return false
	}
	ctx := c.Request.Context()
	if _, err := dbpkg.GetDirectConversationID(ctx, pool, viewerID, otherID); err == nil {
		return true
	} else if !errors.Is(err, dbpkg.ErrNotFound) {
		respondError(c, http.StatusInternalServerError, "internal error")
		return false
	}
	allowed, err := dbpkg.CanViewPlayerProfile(ctx, pool, viewerID, otherID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal error")
		return false
	}
	if !allowed {
		respondError(c, http.StatusNotFound, "player not found")
		return false
	}
	return true
}

func RegisterDirectMessageRoutes(rg *gin.RouterGroup, pool *pgxpool.Pool, verifier *authjwt.Verifier, msgs *messenger) {
	profiled := rg.Group("")
	profiled.Use(authjwt.RequireAuth(verifier))
	profiled.Use(authjwt.RequireProfile(pool))

	// Inbox: every direct conversation, most recently active first.
	profiled.GET("/me/direct-threads", func(c *gin.Context) {
		threads, err := dbpkg.ListMyDirectThreads(c.Request.Context(), pool, authjwt.CurrentUser(c).ID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, threads)
	})

	profiled.GET("/dm/:userId/messages", func(c *gin.Context) {
		me := authjwt.CurrentUser(c)
		otherID := c.Param("userId")
		if !canDirectMessage(c, pool, me.ID, otherID) {
			return
		}
		ctx := c.Request.Context()
		convID, err := dbpkg.GetDirectConversationID(ctx, pool, me.ID, otherID)
		if errors.Is(err, dbpkg.ErrNotFound) {
			c.JSON(http.StatusOK, []models.ConversationMessage{})
			return
		}
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		messages, err := dbpkg.ListConversationMessages(ctx, pool, convID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, messages)
	})

	// Same body as Session Chat: text and/or one image.
	profiled.POST("/dm/:userId/messages", func(c *gin.Context) {
		me := authjwt.CurrentUser(c)
		otherID := c.Param("userId")
		if !canDirectMessage(c, pool, me.ID, otherID) {
			return
		}
		body, imageData, imageContentType, ok := parseConversationMessageBody(c)
		if !ok {
			return
		}
		ctx := c.Request.Context()
		convID, err := dbpkg.GetOrCreateDirectConversationID(ctx, pool, me.ID, otherID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
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

	// An image from one of the caller's own direct conversations.
	profiled.GET("/dm/messages/:messageId/image", func(c *gin.Context) {
		img, err := dbpkg.GetDirectMessageImage(c.Request.Context(), pool, authjwt.CurrentUser(c).ID, c.Param("messageId"))
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
}
