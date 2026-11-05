package httpapi

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/authjwt"
	dbpkg "github.com/yogisofiharja/aksi-server/internal/db"
	"github.com/yogisofiharja/aksi-server/internal/models"
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

// invitePreview is what a signed-out visitor sees of an invite link
// (DP-028, 2026-11-05): the Session's details or the Community's card,
// so they can decide to join before making an account.
type invitePreview struct {
	inviteResolution
	Club          models.ClubPreview `json:"club"`
	Session       *models.Session    `json:"session,omitempty"`
	OrganizerName string             `json:"organizerName,omitempty"`
	SkillLevelMin *models.SkillLevel `json:"skillLevelMin,omitempty"`
	SkillLevelMax *models.SkillLevel `json:"skillLevelMax,omitempty"`
}

// resolveInvite looks up a link and what it points at. It answers the
// request itself (410 reset, 404 unknown / draft) when ok is false. sess
// is set for a Session link.
func resolveInvite(c *gin.Context, pool *pgxpool.Pool, token string) (models.InviteLink, inviteResolution, *models.Session, bool) {
	ctx := c.Request.Context()
	var res inviteResolution
	link, err := dbpkg.GetInviteLink(ctx, pool, token)
	if errors.Is(err, dbpkg.ErrInviteRevoked) {
		c.JSON(http.StatusGone, gin.H{"error": inviteRevokedMessage, "code": "INVITE_REVOKED"})
		return link, res, nil, false
	}
	if errors.Is(err, dbpkg.ErrNotFound) {
		respondError(c, http.StatusNotFound, "invite not found")
		return link, res, nil, false
	}
	if err != nil {
		respondInternal(c, err)
		return link, res, nil, false
	}

	club, err := dbpkg.GetClub(ctx, pool, link.ClubID)
	if err != nil {
		respondError(c, http.StatusNotFound, "invite not found")
		return link, res, nil, false
	}
	res = inviteResolution{TargetType: link.TargetType, TargetID: link.TargetID, ClubID: link.ClubID, ClubName: club.Name, InviterID: link.CreatedBy}
	var sess *models.Session
	if link.TargetType == dbpkg.InviteTargetSession {
		s, err := dbpkg.GetSession(ctx, pool, link.TargetID)
		if errors.Is(err, dbpkg.ErrNotFound) || (err == nil && s.Status == "draft") {
			respondError(c, http.StatusNotFound, "invite not found")
			return link, res, nil, false
		}
		if err != nil {
			respondInternal(c, err)
			return link, res, nil, false
		}
		sess = &s
		res.SessionName, res.StartsAt = s.Name, s.StartsAt
	}
	inviter, err := dbpkg.GetUserByID(ctx, pool, link.CreatedBy)
	if err != nil {
		respondInternal(c, err)
		return link, res, nil, false
	}
	res.InviterName = displayNameOf(inviter.DisplayName, inviter.Username)
	if res.StraightIn, err = dbpkg.InviterIsOrganizer(ctx, pool, link.ClubID, link.CreatedBy); err != nil {
		respondInternal(c, err)
		return link, res, nil, false
	}
	return link, res, sess, true
}

// RegisterInviteRoutes is DP-028: invite links (one per inviter per
// target, never expiring, reset by owners/admins) and opening one —
// signed in, or as a signed-out preview.
func RegisterInviteRoutes(rg *gin.RouterGroup, pool *pgxpool.Pool, verifier *authjwt.Verifier, notifier *notify.Service, ips ClientIPResolver) {
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
			respondInternal(c, err)
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

	// Any member of the Session's Community has their own link to it
	// (DP-028: members invite; a Session-only participant doesn't). Not
	// for a draft.
	authed.GET("/sessions/:id/invite-link", func(c *gin.Context) {
		sess, role, ok := requireSessionAccess(c, pool, c.Param("id"))
		if !ok || !requireInviterRole(c, role) {
			return
		}
		if sess.Status == "draft" {
			respondError(c, http.StatusConflict, "publish the session before inviting people")
			return
		}
		link, err := dbpkg.GetOrCreateInviteLink(c.Request.Context(), pool, dbpkg.InviteTargetSession, sess.ID, sess.ClubID, authjwt.CurrentUser(c).ID)
		if err != nil {
			respondInternal(c, err)
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
		link, res, _, ok := resolveInvite(c, pool, c.Param("token"))
		if !ok {
			return
		}
		if link.CreatedBy != user.ID {
			token := link.Token
			if _, err := dbpkg.RecordInvitation(ctx, pool, link.CreatedBy, user.ID, link.TargetType, link.TargetID, link.ClubID, "link", &token); err != nil {
				respondInternal(c, err)
				return
			}
		}
		c.JSON(http.StatusOK, res)
	})

	// Opening a link signed out: enough to decide whether to join before
	// making an account. No player names, nothing member-only, and it
	// records nothing — the invitation is recorded once they sign in and
	// open the link again.
	rg.GET("/invites/:token/preview", rateLimited(ips, 60, time.Minute), func(c *gin.Context) {
		ctx := c.Request.Context()
		link, res, sess, ok := resolveInvite(c, pool, c.Param("token"))
		if !ok {
			return
		}
		// No viewer: the zero UUID is nobody's id.
		club, err := dbpkg.GetClubPreview(ctx, pool, "00000000-0000-0000-0000-000000000000", link.ClubID)
		if err != nil {
			respondInternal(c, err)
			return
		}
		club.ViewerRole, club.ViewerRequestPending, club.HasAvatar, club.AvatarVersion = nil, false, false, nil
		preview := invitePreview{inviteResolution: res, Club: club}
		if sess != nil {
			sess.UmpireUserID, sess.UmpireName, sess.MatchesOpenAt, sess.ScoringClosesAt = "", nil, nil, nil
			preview.Session = sess
			if organizer, err := dbpkg.GetUserByID(ctx, pool, sess.CreatedBy); err == nil {
				preview.OrganizerName = displayNameOf(organizer.DisplayName, organizer.Username)
			}
			if sess.SkillLevelMinID != nil {
				if l, err := dbpkg.GetSkillLevelByID(ctx, pool, *sess.SkillLevelMinID); err == nil {
					preview.SkillLevelMin = &l
				}
			}
			if sess.SkillLevelMaxID != nil {
				if l, err := dbpkg.GetSkillLevelByID(ctx, pool, *sess.SkillLevelMaxID); err == nil {
					preview.SkillLevelMax = &l
				}
			}
		}
		c.JSON(http.StatusOK, preview)
	})

	registerInvitationRoutes(authed, pool, notifier)
}

// registerInvitationRoutes is DP-028's in-app invites: search Aksi users,
// invite one (a notification and a card on their Home), answer it.
func registerInvitationRoutes(authed *gin.RouterGroup, pool *pgxpool.Pool, notifier *notify.Service) {
	candidates := func(c *gin.Context, targetType, targetID string) {
		q := strings.TrimSpace(c.Query("q"))
		if len([]rune(q)) < 2 {
			c.JSON(http.StatusOK, []any{})
			return
		}
		list, err := dbpkg.InviteCandidates(c.Request.Context(), pool, targetType, targetID, q, authjwt.CurrentUser(c).ID)
		if err != nil {
			respondInternal(c, err)
			return
		}
		c.JSON(http.StatusOK, list)
	}

	// invite records the invitation and notifies the friend. Someone
	// already in is refused: Invite friends shows them as already in.
	invite := func(c *gin.Context, targetType, targetID, clubID string, n notify.Notification) {
		ctx := c.Request.Context()
		user := authjwt.CurrentUser(c)
		var body struct {
			UserID string `json:"userId"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.UserID == "" || body.UserID == user.ID {
			respondError(c, http.StatusBadRequest, "choose someone to invite")
			return
		}
		in, err := dbpkg.IsAlreadyIn(ctx, pool, targetType, targetID, body.UserID)
		if errors.Is(err, dbpkg.ErrNotFound) {
			respondError(c, http.StatusNotFound, "user not found")
			return
		}
		if err != nil {
			respondInternal(c, err)
			return
		}
		if in {
			c.JSON(http.StatusConflict, gin.H{"error": "already in", "code": "ALREADY_IN"})
			return
		}
		inv, err := dbpkg.RecordInvitation(ctx, pool, user.ID, body.UserID, targetType, targetID, clubID, "app", nil)
		if err != nil {
			respondInternal(c, err)
			return
		}
		if notifier != nil {
			n.Params["name"] = displayNameOf(user.DisplayName, user.Username)
			notifier.Send(ctx, []string{body.UserID}, user.ID, n)
		}
		c.JSON(http.StatusCreated, inv)
	}

	authed.GET("/clubs/:clubId/invitations/candidates", func(c *gin.Context) {
		clubID := c.Param("clubId")
		if _, _, ok := requireMember(c, pool, clubID); !ok {
			return
		}
		candidates(c, dbpkg.InviteTargetClub, clubID)
	})

	authed.POST("/clubs/:clubId/invitations", func(c *gin.Context) {
		clubID := c.Param("clubId")
		if _, _, ok := requireMember(c, pool, clubID); !ok {
			return
		}
		club, err := dbpkg.GetClub(c.Request.Context(), pool, clubID)
		if err != nil {
			respondInternal(c, err)
			return
		}
		invite(c, dbpkg.InviteTargetClub, clubID, clubID, notify.Notification{
			Type: notify.TypeCommunityInvite, Params: map[string]string{"club": club.Name}, Path: "/clubs/" + clubID,
		})
	})

	authed.GET("/sessions/:id/invitations/candidates", func(c *gin.Context) {
		sess, role, ok := requireSessionAccess(c, pool, c.Param("id"))
		if !ok || !requireInviterRole(c, role) {
			return
		}
		candidates(c, dbpkg.InviteTargetSession, sess.ID)
	})

	authed.POST("/sessions/:id/invitations", func(c *gin.Context) {
		sess, role, ok := requireSessionAccess(c, pool, c.Param("id"))
		if !ok || !requireInviterRole(c, role) {
			return
		}
		if sess.Status == "draft" {
			respondError(c, http.StatusConflict, "publish the session before inviting people")
			return
		}
		label, err := dbpkg.SessionLabel(c.Request.Context(), pool, sess.ID)
		if err != nil {
			respondInternal(c, err)
			return
		}
		invite(c, dbpkg.InviteTargetSession, sess.ID, sess.ClubID, notify.Notification{
			Type: notify.TypeSessionInvite, Params: map[string]string{"session": label}, Path: "/sessions/" + sess.ID,
		})
	})

	// Home's "Invited" cards.
	authed.GET("/me/invitations", func(c *gin.Context) {
		list, err := dbpkg.ListPendingInvitations(c.Request.Context(), pool, authjwt.CurrentUser(c).ID)
		if err != nil {
			respondInternal(c, err)
			return
		}
		c.JSON(http.StatusOK, list)
	})

	// Not now.
	authed.POST("/invitations/:id/dismiss", func(c *gin.Context) {
		err := dbpkg.DismissInvitation(c.Request.Context(), pool, c.Param("id"), authjwt.CurrentUser(c).ID)
		if errors.Is(err, dbpkg.ErrNotFound) {
			respondError(c, http.StatusNotFound, "invitation not found")
			return
		}
		if err != nil {
			respondInternal(c, err)
			return
		}
		c.Status(http.StatusNoContent)
	})
}

// requireInviterRole: DP-028 lets any member invite, not a Session-only
// participant. Responds 403 for a visitor.
func requireInviterRole(c *gin.Context, role string) bool {
	if role == dbpkg.SessionVisitorRole {
		respondError(c, http.StatusForbidden, "only members of the community can invite")
		return false
	}
	return true
}

func resetInviteLinks(c *gin.Context, pool *pgxpool.Pool, targetType, targetID, clubID string) {
	if _, err := dbpkg.ResetInviteLinks(c.Request.Context(), pool, targetType, targetID); err != nil {
		respondInternal(c, err)
		return
	}
	// The caller gets their fresh link straight away.
	link, err := dbpkg.GetOrCreateInviteLink(c.Request.Context(), pool, targetType, targetID, clubID, authjwt.CurrentUser(c).ID)
	if err != nil {
		respondInternal(c, err)
		return
	}
	c.JSON(http.StatusOK, link)
}
