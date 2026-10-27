package httpapi

import (
	"encoding/base64"
	"errors"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/authjwt"
	dbpkg "github.com/yogisofiharja/aksi-server/internal/db"
	"github.com/yogisofiharja/aksi-server/internal/notify"
)

// requireMember loads the caller's membership for the club in the :clubId
// URL param, responding 404 if the club doesn't exist or 403 if the caller
// isn't a member. Returns ok=false if the response has already been sent.
func requireMember(c *gin.Context, pool *pgxpool.Pool, clubID string) (member bool, isOwner bool, ok bool) {
	user := authjwt.CurrentUser(c)
	m, err := dbpkg.GetMembership(c.Request.Context(), pool, clubID, user.ID)
	if errors.Is(err, dbpkg.ErrNotFound) {
		respondError(c, http.StatusForbidden, "not a member of this club")
		return false, false, false
	}
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal error")
		return false, false, false
	}
	return true, m.Role == "owner", true
}

// requireCity checks that cityCode names a city in the reference list
// (DP-017), responding 400 if it is empty or unknown. Returns false if the
// response has already been sent.
func requireCity(c *gin.Context, pool *pgxpool.Pool, cityCode string) bool {
	if cityCode == "" {
		respondError(c, http.StatusBadRequest, "choose a city")
		return false
	}
	exists, err := dbpkg.CityExists(c.Request.Context(), pool, cityCode)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal error")
		return false
	}
	if !exists {
		respondError(c, http.StatusBadRequest, "unknown city")
		return false
	}
	return true
}

func validClubVisibility(v string) bool { return v == "public" || v == "private" }

// requireOwnerOrAdmin is requireMember for the actions DP-017 gives to
// both roles (deciding join requests).
func requireOwnerOrAdmin(c *gin.Context, pool *pgxpool.Pool, clubID string) bool {
	user := authjwt.CurrentUser(c)
	m, err := dbpkg.GetMembership(c.Request.Context(), pool, clubID, user.ID)
	if errors.Is(err, dbpkg.ErrNotFound) {
		respondError(c, http.StatusForbidden, "not a member of this club")
		return false
	}
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal error")
		return false
	}
	if !isOwnerOrAdmin(m.Role) {
		respondError(c, http.StatusForbidden, "only an owner or admin can do this")
		return false
	}
	return true
}

func RegisterClubRoutes(rg *gin.RouterGroup, pool *pgxpool.Pool, verifier *authjwt.Verifier, notifier *notify.Service) {
	authed := rg.Group("")
	authed.Use(authjwt.RequireAuth(verifier))
	authed.Use(authjwt.RequireProfile(pool))

	authed.POST("/clubs", func(c *gin.Context) {
		var body struct {
			Name        string  `json:"name"`
			Description *string `json:"description"`
			// DP-017: a city is required for a new Club; visibility
			// defaults to "public".
			CityCode   string  `json:"cityCode"`
			Visibility *string `json:"visibility"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.Name) == "" {
			respondError(c, http.StatusBadRequest, "name is required")
			return
		}
		cityCode := strings.TrimSpace(body.CityCode)
		if !requireCity(c, pool, cityCode) {
			return
		}
		visibility := "public"
		if body.Visibility != nil {
			if !validClubVisibility(*body.Visibility) {
				respondError(c, http.StatusBadRequest, `visibility must be "public" or "private"`)
				return
			}
			visibility = *body.Visibility
		}
		user := authjwt.CurrentUser(c)
		club, err := dbpkg.CreateClub(c.Request.Context(), pool, strings.TrimSpace(body.Name), body.Description, cityCode, visibility, user.ID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusCreated, club)
	})

	authed.GET("/clubs", func(c *gin.Context) {
		user := authjwt.CurrentUser(c)
		clubs, err := dbpkg.ListClubsForUser(c.Request.Context(), pool, user.ID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, clubs)
	})

	// --- DP-017 Community Discovery & Joining ---------------------------
	// Everything here is open to any signed-in user with a profile, member
	// or not, except deciding join requests.

	// Registered before /clubs/:clubId; gin matches the static segment
	// first, so "search" is never read as a club id.
	authed.GET("/clubs/search", func(c *gin.Context) {
		q := strings.TrimSpace(c.Query("q"))
		if utf8.RuneCountInString(q) < 2 {
			c.JSON(http.StatusOK, []struct{}{})
			return
		}
		user := authjwt.CurrentUser(c)
		clubs, err := dbpkg.SearchClubs(c.Request.Context(), pool, user.ID, q)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, clubs)
	})

	// Explore before a search is typed: Communities in the caller's own
	// city that they haven't joined. [] if they have set no city.
	authed.GET("/clubs/in-my-city", func(c *gin.Context) {
		user := authjwt.CurrentUser(c)
		if user.CityCode == nil {
			c.JSON(http.StatusOK, []struct{}{})
			return
		}
		clubs, err := dbpkg.ListClubsInCity(c.Request.Context(), pool, user.ID, *user.CityCode)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, clubs)
	})

	// What a shared link opens: enough to recognise the Club and decide
	// whether to join, nothing member-only.
	authed.GET("/clubs/:clubId/preview", func(c *gin.Context) {
		user := authjwt.CurrentUser(c)
		preview, err := dbpkg.GetClubPreview(c.Request.Context(), pool, user.ID, c.Param("clubId"))
		if errors.Is(err, dbpkg.ErrNotFound) {
			respondError(c, http.StatusNotFound, "club not found")
			return
		}
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		// DP-028: a non-member sees who invited them and whether it lets
		// them straight in.
		if preview.ViewerRole == nil {
			if inv, err := dbpkg.ClubInviteFor(c.Request.Context(), pool, preview.ID, user.ID); err == nil {
				preview.Invite = &inv
			}
		}
		c.JSON(http.StatusOK, preview)
	})

	// Public Club: the caller becomes a member. Private Club: a join
	// request is recorded. Returns the preview either way, whose
	// viewerRole / viewerRequestPending say which happened.
	authed.POST("/clubs/:clubId/join", func(c *gin.Context) {
		clubID := c.Param("clubId")
		user := authjwt.CurrentUser(c)
		ctx := c.Request.Context()
		// DP-028: an owner/admin's invite lets them into a private
		// Community without a request — checked now, not when sent.
		straightIn, err := dbpkg.HasOrganizerInvite(ctx, pool, clubID, user.ID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		outcome, err := dbpkg.JoinClub(ctx, pool, clubID, user.ID, straightIn)
		if errors.Is(err, dbpkg.ErrNotFound) {
			respondError(c, http.StatusNotFound, "club not found")
			return
		}
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		preview, err := dbpkg.GetClubPreview(ctx, pool, user.ID, clubID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		if outcome == dbpkg.JoinJoined {
			_ = dbpkg.MarkClubInvitationsJoined(ctx, pool, clubID, user.ID)
		}
		// DP-018 #1: a new request to a private Community tells its owner
		// and admins. Asking again while waiting doesn't repeat it.
		if outcome == dbpkg.JoinRequested {
			if organizers, err := dbpkg.ListClubOrganizerIDs(ctx, pool, clubID); err == nil {
				notifier.Send(ctx, organizers, user.ID, notify.Notification{
					Type:   notify.TypeCommunityJoinRequest,
					Params: map[string]string{"name": displayNameOf(user.DisplayName, user.Username), "club": preview.Name},
					Path:   "/clubs/" + clubID + "/members",
				})
			}
		}
		c.JSON(http.StatusOK, preview)
	})

	// The caller withdraws their own pending request.
	authed.DELETE("/clubs/:clubId/join-request", func(c *gin.Context) {
		user := authjwt.CurrentUser(c)
		if err := dbpkg.CancelJoinRequest(c.Request.Context(), pool, c.Param("clubId"), user.ID); err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.Status(http.StatusNoContent)
	})

	authed.GET("/clubs/:clubId/join-requests", func(c *gin.Context) {
		clubID := c.Param("clubId")
		if !requireOwnerOrAdmin(c, pool, clubID) {
			return
		}
		requests, err := dbpkg.ListPendingJoinRequests(c.Request.Context(), pool, clubID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, requests)
	})

	decide := func(approve bool) gin.HandlerFunc {
		return func(c *gin.Context) {
			clubID := c.Param("clubId")
			if !requireOwnerOrAdmin(c, pool, clubID) {
				return
			}
			user := authjwt.CurrentUser(c)
			ctx := c.Request.Context()
			requesterID, err := dbpkg.DecideJoinRequest(ctx, pool, clubID, c.Param("requestId"), user.ID, approve)
			if errors.Is(err, dbpkg.ErrNotFound) {
				respondError(c, http.StatusNotFound, "this request is no longer pending")
				return
			}
			if err != nil {
				respondError(c, http.StatusInternalServerError, "internal error")
				return
			}
			// DP-018 #2: tell the person they're in. A decline is not
			// announced.
			if approve {
				if club, err := dbpkg.GetClub(ctx, pool, clubID); err == nil {
					notifier.Send(ctx, []string{requesterID}, user.ID, notify.Notification{
						Type:   notify.TypeCommunityJoinApproved,
						Params: map[string]string{"club": club.Name},
						Path:   "/clubs/" + clubID,
					})
				}
			}
			c.Status(http.StatusNoContent)
		}
	}
	authed.POST("/clubs/:clubId/join-requests/:requestId/approve", decide(true))
	authed.POST("/clubs/:clubId/join-requests/:requestId/decline", decide(false))

	// --------------------------------------------------------------------

	authed.GET("/clubs/:clubId", func(c *gin.Context) {
		clubID := c.Param("clubId")
		if _, _, ok := requireMember(c, pool, clubID); !ok {
			return
		}
		club, err := dbpkg.GetClub(c.Request.Context(), pool, clubID)
		if errors.Is(err, dbpkg.ErrNotFound) {
			respondError(c, http.StatusNotFound, "club not found")
			return
		}
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, club)
	})

	authed.PATCH("/clubs/:clubId", func(c *gin.Context) {
		clubID := c.Param("clubId")
		_, isOwner, ok := requireMember(c, pool, clubID)
		if !ok {
			return
		}
		if !isOwner {
			respondError(c, http.StatusForbidden, "only the owner can update this club")
			return
		}
		var body struct {
			Name        *string `json:"name"`
			Description *string `json:"description"`
			CityCode    *string `json:"cityCode"`
			Visibility  *string `json:"visibility"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			respondError(c, http.StatusBadRequest, "invalid body")
			return
		}
		if body.CityCode != nil && !requireCity(c, pool, strings.TrimSpace(*body.CityCode)) {
			return
		}
		if body.Visibility != nil && !validClubVisibility(*body.Visibility) {
			respondError(c, http.StatusBadRequest, `visibility must be "public" or "private"`)
			return
		}
		club, err := dbpkg.UpdateClub(c.Request.Context(), pool, clubID, dbpkg.ClubUpdate{
			Name: body.Name, Description: body.Description, CityCode: body.CityCode, Visibility: body.Visibility,
		})
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, club)
	})

	authed.DELETE("/clubs/:clubId", func(c *gin.Context) {
		clubID := c.Param("clubId")
		_, isOwner, ok := requireMember(c, pool, clubID)
		if !ok {
			return
		}
		if !isOwner {
			respondError(c, http.StatusForbidden, "only the owner can delete this club")
			return
		}
		if err := dbpkg.DeleteClub(c.Request.Context(), pool, clubID); err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.Status(http.StatusNoContent)
	})

	// Club profile picture — owner only to set (same permission as PATCH
	// /clubs/:clubId), anyone signed in can view. Same size/content-type
	// validation as every other image upload in the app.
	authed.POST("/clubs/:clubId/avatar", func(c *gin.Context) {
		clubID := c.Param("clubId")
		_, isOwner, ok := requireMember(c, pool, clubID)
		if !ok {
			return
		}
		if !isOwner {
			respondError(c, http.StatusForbidden, "only the owner can change this club's picture")
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxImagePostBytes)
		var body struct {
			ImageBase64      string `json:"imageBase64"`
			ImageContentType string `json:"imageContentType"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			respondError(c, http.StatusBadRequest, "invalid body, or image too large")
			return
		}
		if !isAllowedImageContentType(body.ImageContentType) {
			respondError(c, http.StatusBadRequest, "imageContentType must be image/jpeg, image/png, or image/webp")
			return
		}
		decoded, err := base64.StdEncoding.DecodeString(body.ImageBase64)
		if err != nil {
			respondError(c, http.StatusBadRequest, "imageBase64 is not valid base64")
			return
		}
		if len(decoded) == 0 || len(decoded) > maxImageBytes {
			respondError(c, http.StatusBadRequest, "image must be non-empty and 5MB or smaller")
			return
		}
		club, err := dbpkg.UploadClubAvatar(c.Request.Context(), pool, clubID, decoded, body.ImageContentType)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, club)
	})

	// Visible to any signed-in user, not only members: a Club's picture is
	// part of what search results and a shared link show (DP-017).
	authed.GET("/clubs/:clubId/avatar", func(c *gin.Context) {
		clubID := c.Param("clubId")
		img, err := dbpkg.GetClubAvatarImage(c.Request.Context(), pool, clubID)
		if errors.Is(err, dbpkg.ErrNotFound) {
			respondError(c, http.StatusNotFound, "this club has no profile picture")
			return
		}
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.Header("Cache-Control", "private, max-age=31536000, immutable")
		c.Data(http.StatusOK, img.ContentType, img.Data)
	})

	authed.GET("/clubs/:clubId/members", func(c *gin.Context) {
		clubID := c.Param("clubId")
		if _, _, ok := requireMember(c, pool, clubID); !ok {
			return
		}
		members, err := dbpkg.ListMembers(c.Request.Context(), pool, clubID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, members)
	})

	authed.POST("/clubs/:clubId/members", func(c *gin.Context) {
		clubID := c.Param("clubId")
		_, isOwner, ok := requireMember(c, pool, clubID)
		if !ok {
			return
		}
		if !isOwner {
			respondError(c, http.StatusForbidden, "only the owner can add members")
			return
		}
		var body struct {
			Username string `json:"username"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.Username == "" {
			respondError(c, http.StatusBadRequest, "username is required")
			return
		}
		caller := authjwt.CurrentUser(c)
		member, err := dbpkg.AddMemberByUsername(c.Request.Context(), pool, clubID, body.Username, caller.ID)
		if errors.Is(err, dbpkg.ErrNotFound) {
			respondError(c, http.StatusNotFound, "username not found")
			return
		}
		if errors.Is(err, dbpkg.ErrConflict) {
			respondError(c, http.StatusConflict, "already a member")
			return
		}
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusCreated, member)
	})

	authed.PATCH("/clubs/:clubId/members/:userId", func(c *gin.Context) {
		clubID := c.Param("clubId")
		targetUserID := c.Param("userId")
		_, isOwner, ok := requireMember(c, pool, clubID)
		if !ok {
			return
		}
		if !isOwner {
			respondError(c, http.StatusForbidden, "only the owner can change roles")
			return
		}
		var body struct {
			Role string `json:"role"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || (body.Role != "member" && body.Role != "admin") {
			respondError(c, http.StatusBadRequest, "role must be 'member' or 'admin'")
			return
		}
		member, err := dbpkg.ChangeMemberRole(c.Request.Context(), pool, clubID, targetUserID, body.Role)
		if errors.Is(err, dbpkg.ErrNotFound) {
			respondError(c, http.StatusNotFound, "membership not found")
			return
		}
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, member)
	})

	authed.DELETE("/clubs/:clubId/members/:userId", func(c *gin.Context) {
		clubID := c.Param("clubId")
		targetUserID := c.Param("userId")
		caller := authjwt.CurrentUser(c)
		_, isOwner, ok := requireMember(c, pool, clubID)
		if !ok {
			return
		}
		if !isOwner && targetUserID != caller.ID {
			respondError(c, http.StatusForbidden, "only the owner can remove other members")
			return
		}

		target, err := dbpkg.GetMembership(c.Request.Context(), pool, clubID, targetUserID)
		if errors.Is(err, dbpkg.ErrNotFound) {
			respondError(c, http.StatusNotFound, "membership not found")
			return
		}
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		if target.Role == "owner" {
			count, err := dbpkg.CountOwners(c.Request.Context(), pool, clubID)
			if err != nil {
				respondError(c, http.StatusInternalServerError, "internal error")
				return
			}
			if count <= 1 {
				respondError(c, http.StatusConflict, "cannot remove the sole remaining owner")
				return
			}
		}

		if err := dbpkg.RemoveMember(c.Request.Context(), pool, clubID, targetUserID); err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.Status(http.StatusNoContent)
	})

	// Milestone 5 (Session Finance) — bank accounts an owner lists for
	// members to send payment to. Listed by any member (shown on every
	// priced Session's Payment tab); managed by the owner only, same
	// permission level as every other Club-level setting.
	authed.GET("/clubs/:clubId/bank-accounts", func(c *gin.Context) {
		clubID := c.Param("clubId")
		if _, _, ok := requireMember(c, pool, clubID); !ok {
			return
		}
		accounts, err := dbpkg.ListClubBankAccounts(c.Request.Context(), pool, clubID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, accounts)
	})

	authed.POST("/clubs/:clubId/bank-accounts", func(c *gin.Context) {
		clubID := c.Param("clubId")
		_, isOwner, ok := requireMember(c, pool, clubID)
		if !ok {
			return
		}
		if !isOwner {
			respondError(c, http.StatusForbidden, "only the owner can manage bank accounts")
			return
		}
		var body struct {
			BankName      string `json:"bankName"`
			AccountNumber string `json:"accountNumber"`
			AccountName   string `json:"accountName"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.BankName == "" || body.AccountNumber == "" || body.AccountName == "" {
			respondError(c, http.StatusBadRequest, "bankName, accountNumber, and accountName are required")
			return
		}
		account, err := dbpkg.CreateClubBankAccount(c.Request.Context(), pool, clubID, body.BankName, body.AccountNumber, body.AccountName)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusCreated, account)
	})

	authed.PATCH("/clubs/:clubId/bank-accounts/:accountId", func(c *gin.Context) {
		clubID := c.Param("clubId")
		_, isOwner, ok := requireMember(c, pool, clubID)
		if !ok {
			return
		}
		if !isOwner {
			respondError(c, http.StatusForbidden, "only the owner can manage bank accounts")
			return
		}
		var body struct {
			BankName      *string `json:"bankName"`
			AccountNumber *string `json:"accountNumber"`
			AccountName   *string `json:"accountName"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			respondError(c, http.StatusBadRequest, "invalid body")
			return
		}
		account, err := dbpkg.UpdateClubBankAccount(c.Request.Context(), pool, clubID, c.Param("accountId"), body.BankName, body.AccountNumber, body.AccountName)
		if errors.Is(err, dbpkg.ErrNotFound) {
			respondError(c, http.StatusNotFound, "bank account not found")
			return
		}
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, account)
	})

	authed.DELETE("/clubs/:clubId/bank-accounts/:accountId", func(c *gin.Context) {
		clubID := c.Param("clubId")
		_, isOwner, ok := requireMember(c, pool, clubID)
		if !ok {
			return
		}
		if !isOwner {
			respondError(c, http.StatusForbidden, "only the owner can manage bank accounts")
			return
		}
		if err := dbpkg.DeleteClubBankAccount(c.Request.Context(), pool, clubID, c.Param("accountId")); err != nil {
			if errors.Is(err, dbpkg.ErrNotFound) {
				respondError(c, http.StatusNotFound, "bank account not found")
				return
			}
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.Status(http.StatusNoContent)
	})
}

// displayNameOf is how a person is named to others: their display name,
// or their username when they have none (DP-016).
func displayNameOf(displayName *string, username string) string {
	if displayName != nil && strings.TrimSpace(*displayName) != "" {
		return *displayName
	}
	return username
}
