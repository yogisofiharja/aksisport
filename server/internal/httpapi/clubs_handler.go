package httpapi

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/authjwt"
	dbpkg "github.com/yogisofiharja/aksi-server/internal/db"
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

func RegisterClubRoutes(rg *gin.RouterGroup, pool *pgxpool.Pool, verifier *authjwt.Verifier) {
	authed := rg.Group("")
	authed.Use(authjwt.RequireAuth(verifier))
	authed.Use(authjwt.RequireProfile(pool))

	authed.POST("/clubs", func(c *gin.Context) {
		var body struct {
			Name        string  `json:"name"`
			Description *string `json:"description"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.Name == "" {
			respondError(c, http.StatusBadRequest, "name is required")
			return
		}
		user := authjwt.CurrentUser(c)
		club, err := dbpkg.CreateClub(c.Request.Context(), pool, body.Name, body.Description, user.ID)
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
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			respondError(c, http.StatusBadRequest, "invalid body")
			return
		}
		club, err := dbpkg.UpdateClub(c.Request.Context(), pool, clubID, body.Name, body.Description)
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
