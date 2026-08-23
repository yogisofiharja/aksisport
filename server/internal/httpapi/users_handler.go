package httpapi

import (
	"context"
	"errors"
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/authjwt"
	dbpkg "github.com/yogisofiharja/aksi-server/internal/db"
	"github.com/yogisofiharja/aksi-server/internal/models"
)

var usernamePattern = regexp.MustCompile(`^[a-z0-9_]{3,20}$`)

func RegisterUserRoutes(rg *gin.RouterGroup, pool *pgxpool.Pool, verifier *authjwt.Verifier) {
	rg.GET("/users/check-username", func(c *gin.Context) {
		username := c.Query("username")
		if !usernamePattern.MatchString(username) {
			c.JSON(http.StatusOK, gin.H{"available": false, "reason": "invalid_format"})
			return
		}
		taken, err := dbpkg.UsernameTaken(c.Request.Context(), pool, username)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, gin.H{"available": !taken})
	})

	authed := rg.Group("")
	authed.Use(authjwt.RequireAuth(verifier))

	authed.POST("/users", func(c *gin.Context) {
		var body struct {
			Username    string  `json:"username"`
			DisplayName *string `json:"displayName"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			respondError(c, http.StatusBadRequest, "invalid body")
			return
		}
		if !usernamePattern.MatchString(body.Username) {
			respondError(c, http.StatusBadRequest, "invalid username")
			return
		}

		uid := authjwt.FirebaseUID(c)
		ctx := c.Request.Context()

		if _, err := dbpkg.GetUserByFirebaseUID(ctx, pool, uid); err == nil {
			respondError(c, http.StatusConflict, "profile already exists")
			return
		} else if !errors.Is(err, dbpkg.ErrNotFound) {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}

		user, err := dbpkg.CreateUser(ctx, pool, uid, body.Username, body.DisplayName)
		if err != nil {
			respondError(c, http.StatusConflict, "username taken")
			return
		}
		c.JSON(http.StatusCreated, user)
	})

	authed.GET("/me", func(c *gin.Context) {
		uid := authjwt.FirebaseUID(c)
		user, err := dbpkg.GetUserByFirebaseUID(context.Background(), pool, uid)
		if errors.Is(err, dbpkg.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "profile not found", "code": "PROFILE_NOT_FOUND"})
			return
		}
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, user)
	})

	profiled := authed.Group("")
	profiled.Use(authjwt.RequireProfile(pool))

	profiled.PATCH("/me", func(c *gin.Context) {
		var body struct {
			DisplayName *string `json:"displayName"`
			Email       *string `json:"email"`
			PhoneNumber *string `json:"phoneNumber"`
			AvatarURL   *string `json:"avatarUrl"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			respondError(c, http.StatusBadRequest, "invalid body")
			return
		}
		current := authjwt.CurrentUser(c)
		user, err := dbpkg.UpdateUser(c.Request.Context(), pool, current.ID, dbpkg.UserUpdate{
			DisplayName: body.DisplayName,
			Email:       body.Email,
			PhoneNumber: body.PhoneNumber,
			AvatarURL:   body.AvatarURL,
		})
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, user)
	})

	// Backs the "add member" dialog's search — any user with a profile can
	// search (not scoped to a specific club; the caller filters out
	// existing members client-side, since it already has that list
	// loaded). Requires at least 2 characters to avoid a near-full-table
	// scan on a 0-1 char query.
	profiled.GET("/users/search", func(c *gin.Context) {
		q := strings.TrimSpace(c.Query("q"))
		if len(q) < 2 {
			c.JSON(http.StatusOK, []models.UserSummary{})
			return
		}
		current := authjwt.CurrentUser(c)
		users, err := dbpkg.SearchUsers(c.Request.Context(), pool, q, current.ID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, users)
	})
}
