package httpapi

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/authjwt"
	dbpkg "github.com/yogisofiharja/aksi-server/internal/db"
	"github.com/yogisofiharja/aksi-server/internal/notify"
)

// inviteRevokedMessage is shown as-is by the app (DP-028).
const inviteRevokedMessage = "This invite link no longer works. Ask for a new one."

// inviteResolution is what opening /i/:token tells the app: where the
// link goes, who sent it, and whether it lets the friend straight into a
// private Community.
type inviteResolution struct {
	TargetType  string     `json:"targetType"`
	TargetID    string     `json:"targetId"`
	ClubID      string     `json:"clubId"`
	ClubName    string     `json:"clubName"`
	SessionName *string    `json:"sessionName,omitempty"`
	StartsAt    *time.Time `json:"startsAt,omitempty"`
	InviterID   string     `json:"inviterId"`
	InviterName string     `json:"inviterName"`
	// StraightIn: the inviter is an owner/admin right now, so joining a
	// private Community needs no request.
	StraightIn bool `json:"straightIn"`
}

// RegisterInviteRoutes is DP-028: invite links (one per inviter per
// target, never expiring, reset by owners/admins) and opening one.
func RegisterInviteRoutes(rg *gin.RouterGroup, pool *pgxpool.Pool, verifier *authjwt.Verifier, notifier *notify.Service) {
	authed := rg.Group("")
	authed.Use(authjwt.RequireAuth(verifier))
	authed.Use(authjwt.RequireProfile(pool))

	// Any member's own link to their Community.
	authed.GET("/clubs/:clubId/invite-link", func(c *gin.Context) {
		clubID := c.Param("clubId")
		if _, _, ok := requireMember(c, pool, clubID); !ok {
			return
		}
		link, err := dbpkg.GetOrCreateInviteLink(c.Request.Context(), pool, dbpkg.InviteTargetClub, clubID, clubID, authjwt.CurrentUser(c).ID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, link)
	})

	authed.POST("/clubs/:clubId/invite-link/reset", func(c *gin.Context) {
		clubID := c.Param("clubId")
		if !requireOwnerOrAdmin(c, pool, clubID) {
			return
		}
		resetInviteLinks(c, pool, dbpkg.InviteTargetClub, clubID, clubID)
	})

	// Anyone who can see the Session — a member, or a Session-only
	// participant — has their own link to it. Not for a draft.
	authed.GET("/sessions/:id/invite-link", func(c *gin.Context) {
		sess, _, ok := requireSessionAccess(c, pool, c.Param("id"))
		if !ok {
			return
		}
		if sess.Status == "draft" {
			respondError(c, http.StatusConflict, "publish the session before inviting people")
			return
		}
		link, err := dbpkg.GetOrCreateInviteLink(c.Request.Context(), pool, dbpkg.InviteTargetSession, sess.ID, sess.ClubID, authjwt.CurrentUser(c).ID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, link)
	})

	authed.POST("/sessions/:id/invite-link/reset", func(c *gin.Context) {
		sess, role, ok := requireSessionAccess(c, pool, c.Param("id"))
		if !ok {
			return
		}
		if !isOwnerOrAdmin(role) {
			respondError(c, http.StatusForbidden, "only an owner or admin can do this")
			return
		}
		resetInviteLinks(c, pool, dbpkg.InviteTargetSession, sess.ID, sess.ClubID)
	})

	// Opening a link (the app's /i/:token page, after sign-in). Works
	// after the Session has ended. Opening someone else's Session link
	// records the invitation, which is what lets a non-member see that
	// Session (requireSessionAccess) and carries "<Name> invited you".
	authed.GET("/invites/:token", func(c *gin.Context) {
		ctx := c.Request.Context()
		user := authjwt.CurrentUser(c)
		link, err := dbpkg.GetInviteLink(ctx, pool, c.Param("token"))
		if errors.Is(err, dbpkg.ErrInviteRevoked) {
			c.JSON(http.StatusGone, gin.H{"error": inviteRevokedMessage, "code": "INVITE_REVOKED"})
			return
		}
		if errors.Is(err, dbpkg.ErrNotFound) {
			respondError(c, http.StatusNotFound, "invite not found")
			return
		}
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}

		club, err := dbpkg.GetClub(ctx, pool, link.ClubID)
		if err != nil {
			respondError(c, http.StatusNotFound, "invite not found")
			return
		}
		res := inviteResolution{TargetType: link.TargetType, TargetID: link.TargetID, ClubID: link.ClubID, ClubName: club.Name, InviterID: link.CreatedBy}
		if link.TargetType == dbpkg.InviteTargetSession {
			sess, err := dbpkg.GetSession(ctx, pool, link.TargetID)
			if errors.Is(err, dbpkg.ErrNotFound) || (err == nil && sess.Status == "draft") {
				respondError(c, http.StatusNotFound, "invite not found")
				return
			}
			if err != nil {
				respondError(c, http.StatusInternalServerError, "internal error")
				return
			}
			res.SessionName, res.StartsAt = sess.Name, sess.StartsAt
		}
		inviter, err := dbpkg.GetUserByID(ctx, pool, link.CreatedBy)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		res.InviterName = displayNameOf(inviter.DisplayName, inviter.Username)
		if res.StraightIn, err = dbpkg.InviterIsOrganizer(ctx, pool, link.ClubID, link.CreatedBy); err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}

		if link.CreatedBy != user.ID {
			token := link.Token
			if _, err := dbpkg.RecordInvitation(ctx, pool, link.CreatedBy, user.ID, link.TargetType, link.TargetID, link.ClubID, "link", &token); err != nil {
				respondError(c, http.StatusInternalServerError, "internal error")
				return
			}
		}
		c.JSON(http.StatusOK, res)
	})
}

func resetInviteLinks(c *gin.Context, pool *pgxpool.Pool, targetType, targetID, clubID string) {
	if _, err := dbpkg.ResetInviteLinks(c.Request.Context(), pool, targetType, targetID); err != nil {
		respondError(c, http.StatusInternalServerError, "internal error")
		return
	}
	// The caller gets their fresh link straight away.
	link, err := dbpkg.GetOrCreateInviteLink(c.Request.Context(), pool, targetType, targetID, clubID, authjwt.CurrentUser(c).ID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal error")
		return
	}
	c.JSON(http.StatusOK, link)
}
