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
)

// DP-021 step 2: blocking and reporting.

const maxReportReasonLength = 500

func RegisterSafetyRoutes(rg *gin.RouterGroup, pool *pgxpool.Pool, verifier *authjwt.Verifier, hub *live.Hub) {
	profiled := rg.Group("")
	profiled.Use(authjwt.RequireAuth(verifier))
	profiled.Use(authjwt.RequireProfile(pool))

	// ---- Blocking: silent, undone from Settings.

	profiled.GET("/me/blocks", func(c *gin.Context) {
		blocks, err := dbpkg.ListMyBlocks(c.Request.Context(), pool, authjwt.CurrentUser(c).ID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, blocks)
	})

	// Anyone you can see the profile of, or already have a conversation
	// with, can be blocked.
	profiled.PUT("/users/:userId/block", func(c *gin.Context) {
		me := authjwt.CurrentUser(c)
		otherID := c.Param("userId")
		if !canDirectMessage(c, pool, me.ID, otherID) {
			return
		}
		if err := dbpkg.BlockUser(c.Request.Context(), pool, me.ID, otherID); err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.Status(http.StatusNoContent)
	})

	profiled.DELETE("/users/:userId/block", func(c *gin.Context) {
		if err := dbpkg.UnblockUser(c.Request.Context(), pool, authjwt.CurrentUser(c).ID, c.Param("userId")); err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.Status(http.StatusNoContent)
	})

	// ---- Reporting: a message, or a person, with a short reason. Goes to
	// the owner/admins of the Communities it concerns.

	profiled.POST("/reports", func(c *gin.Context) {
		var req struct {
			UserID    string `json:"userId"`
			MessageID string `json:"messageId"`
			Reason    string `json:"reason"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			respondError(c, http.StatusBadRequest, "invalid request")
			return
		}
		reason := strings.TrimSpace(req.Reason)
		if reason == "" || utf8.RuneCountInString(reason) > maxReportReasonLength {
			respondError(c, http.StatusBadRequest, "give a reason of up to 500 characters")
			return
		}
		me := authjwt.CurrentUser(c)
		ctx := c.Request.Context()
		params := dbpkg.CreateReportParams{ReporterID: me.ID, Reason: reason}

		if req.MessageID != "" {
			message, err := dbpkg.GetMessageForReport(ctx, pool, req.MessageID)
			if errors.Is(err, dbpkg.ErrNotFound) {
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
			if message.SenderID == me.ID {
				respondError(c, http.StatusBadRequest, "you can't report your own message")
				return
			}
			conv, _, err := dbpkg.ConversationParticipantIDs(ctx, pool, message.ConversationID)
			if err != nil {
				respondError(c, http.StatusInternalServerError, "internal error")
				return
			}
			kind := conv.Kind
			params.ReportedUserID = message.SenderID
			params.MessageID = &message.ID
			params.MessageBody = &message.Body
			params.MessageHasImage = message.HasImage
			params.ConversationKind = &kind
			// A message in a Session's conversation concerns that Session's
			// Community; a direct message, every Community both share.
			if conv.SessionID != "" {
				clubID, err := dbpkg.SessionClubID(ctx, pool, conv.SessionID)
				if err != nil {
					respondError(c, http.StatusInternalServerError, "internal error")
					return
				}
				params.ClubIDs = []string{clubID}
			} else if conv.ClubID != "" {
				// A Community chat message: that Community.
				params.ClubIDs = []string{conv.ClubID}
			}
		} else {
			if req.UserID == "" || req.UserID == me.ID {
				respondError(c, http.StatusBadRequest, "choose someone to report")
				return
			}
			if !canDirectMessage(c, pool, me.ID, req.UserID) {
				return
			}
			params.ReportedUserID = req.UserID
		}

		if params.ClubIDs == nil {
			shared, err := dbpkg.SharedClubIDs(ctx, pool, me.ID, params.ReportedUserID)
			if err != nil {
				respondError(c, http.StatusInternalServerError, "internal error")
				return
			}
			params.ClubIDs = shared
		}
		if _, err := dbpkg.CreateReport(ctx, pool, params); err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.Status(http.StatusNoContent)
	})

	// ---- A Community's reports, for its owner and admins.

	profiled.GET("/clubs/:clubId/reports", func(c *gin.Context) {
		clubID := c.Param("clubId")
		if !requireOwnerOrAdmin(c, pool, clubID) {
			return
		}
		reports, err := dbpkg.ListOpenClubReports(c.Request.Context(), pool, clubID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, reports)
	})

	profiled.GET("/clubs/:clubId/reports/count", func(c *gin.Context) {
		clubID := c.Param("clubId")
		if !requireOwnerOrAdmin(c, pool, clubID) {
			return
		}
		n, err := dbpkg.CountOpenClubReports(c.Request.Context(), pool, clubID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, gin.H{"count": n})
	})

	// Nothing to do: the report leaves this Community's list.
	profiled.POST("/clubs/:clubId/reports/:reportId/dismiss", func(c *gin.Context) {
		clubID := c.Param("clubId")
		if !requireOwnerOrAdmin(c, pool, clubID) {
			return
		}
		ctx := c.Request.Context()
		if _, err := dbpkg.GetOpenClubReport(ctx, pool, clubID, c.Param("reportId")); errors.Is(err, dbpkg.ErrNotFound) {
			respondError(c, http.StatusNotFound, "report not found")
			return
		} else if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		if err := dbpkg.ResolveClubReport(ctx, pool, clubID, c.Param("reportId"), authjwt.CurrentUser(c).ID); err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.Status(http.StatusNoContent)
	})

	// Remove the reported message — only one posted in this Community's
	// own Session conversations, never a direct message — and close the
	// report.
	profiled.POST("/clubs/:clubId/reports/:reportId/remove-message", func(c *gin.Context) {
		clubID := c.Param("clubId")
		if !requireOwnerOrAdmin(c, pool, clubID) {
			return
		}
		ctx := c.Request.Context()
		me := authjwt.CurrentUser(c)
		report, err := dbpkg.GetOpenClubReport(ctx, pool, clubID, c.Param("reportId"))
		if errors.Is(err, dbpkg.ErrNotFound) {
			respondError(c, http.StatusNotFound, "report not found")
			return
		}
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		if report.Message == nil || !report.Message.CanRemove || report.Message.ID == nil {
			respondError(c, http.StatusBadRequest, "this message can't be removed here")
			return
		}
		message, err := dbpkg.GetMessageForReport(ctx, pool, *report.Message.ID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		if err := dbpkg.RemoveMessage(ctx, pool, message.ID, me.ID); err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		if err := dbpkg.ResolveClubReport(ctx, pool, clubID, report.ID, me.ID); err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		if _, participants, err := dbpkg.ConversationParticipantIDs(ctx, pool, message.ConversationID); err == nil {
			hub.Publish(participants, live.Event{Type: "message.removed", Data: gin.H{"conversationId": message.ConversationID, "messageId": message.ID}})
		}
		c.Status(http.StatusNoContent)
	})
}
