package httpapi

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/account"
	"github.com/yogisofiharja/aksi-server/internal/authjwt"
	dbpkg "github.com/yogisofiharja/aksi-server/internal/db"
	"github.com/yogisofiharja/aksi-server/internal/mail"
	"github.com/yogisofiharja/aksi-server/internal/models"
)

var usernamePattern = regexp.MustCompile(`^[a-z0-9_]{3,20}$`)

func RegisterUserRoutes(rg *gin.RouterGroup, pool *pgxpool.Pool, verifier *authjwt.Verifier, mailer mail.Mailer) {
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
			// DP-015: the address to confirm. Sign-up always sends it;
			// it is absent only when an interrupted sign-up is being
			// completed (CompleteProfileScreen), in which case the app's
			// confirmation step asks for it instead.
			Email *string `json:"email"`
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

		var pendingEmail *string
		if body.Email != nil && strings.TrimSpace(*body.Email) != "" {
			email := account.NormalizeEmail(*body.Email)
			if !account.ValidEmail(email) {
				respondError(c, http.StatusBadRequest, "enter a valid email address")
				return
			}
			if _, err := dbpkg.GetUserByConfirmedEmail(ctx, pool, email); err == nil {
				respondError(c, http.StatusConflict, "this email is already used by another account")
				return
			} else if !errors.Is(err, dbpkg.ErrNotFound) {
				respondError(c, http.StatusInternalServerError, "internal error")
				return
			}
			pendingEmail = &email
		}

		if _, err := dbpkg.GetUserByFirebaseUID(ctx, pool, uid); err == nil {
			respondError(c, http.StatusConflict, "profile already exists")
			return
		} else if !errors.Is(err, dbpkg.ErrNotFound) {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}

		user, err := dbpkg.CreateUser(ctx, pool, uid, body.Username, body.DisplayName, pendingEmail)
		if err != nil {
			respondError(c, http.StatusConflict, "username taken")
			return
		}
		// The account exists either way; if the code fails to send, the
		// confirmation step's "send again" covers it.
		if pendingEmail != nil {
			if err := sendEmailCode(ctx, pool, mailer, user.ID, account.PurposeVerifyEmail, *pendingEmail); err != nil {
				log.Printf("sending sign-up confirmation code: %v", err)
			}
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
			// DP-017: switches the active town (saving it if new); "" is
			// rejected — a town is removed with DELETE /me/cities/:code.
			CityCode    *string `json:"cityCode"`
			PhoneNumber *string `json:"phoneNumber"`
			AvatarURL   *string `json:"avatarUrl"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			respondError(c, http.StatusBadRequest, "invalid body")
			return
		}
		// DP-016: trimmed, at most 40 characters; empty removes it.
		if body.DisplayName != nil {
			trimmed := strings.TrimSpace(*body.DisplayName)
			if utf8.RuneCountInString(trimmed) > account.MaxDisplayNameLength {
				respondError(c, http.StatusBadRequest, "display name can be at most 40 characters")
				return
			}
			body.DisplayName = &trimmed
		}
		current := authjwt.CurrentUser(c)
		ctx := c.Request.Context()
		if body.CityCode != nil {
			code := strings.TrimSpace(*body.CityCode)
			if !requireCity(c, pool, code) {
				return
			}
			if err := dbpkg.SetActiveCity(ctx, pool, current.ID, code); err != nil {
				respondCityError(c, err)
				return
			}
		}
		user, err := dbpkg.UpdateUser(ctx, pool, current.ID, dbpkg.UserUpdate{
			DisplayName: body.DisplayName,
			PhoneNumber: body.PhoneNumber,
			AvatarURL:   body.AvatarURL,
		})
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, user)
	})

	// DP-017: save a town without switching to it (the first one saved
	// becomes active anyway). Returns the updated profile.
	profiled.POST("/me/cities", func(c *gin.Context) {
		var body struct {
			CityCode string `json:"cityCode"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			respondError(c, http.StatusBadRequest, "invalid body")
			return
		}
		code := strings.TrimSpace(body.CityCode)
		if !requireCity(c, pool, code) {
			return
		}
		current := authjwt.CurrentUser(c)
		ctx := c.Request.Context()
		if err := dbpkg.AddUserCity(ctx, pool, current.ID, code); err != nil {
			respondCityError(c, err)
			return
		}
		respondMe(c, pool, current.FirebaseUID)
	})

	// Forget one of the caller's towns. If it was active, the most recently
	// saved remaining town takes over (or none, if it was the last).
	profiled.DELETE("/me/cities/:cityCode", func(c *gin.Context) {
		current := authjwt.CurrentUser(c)
		if err := dbpkg.RemoveUserCity(c.Request.Context(), pool, current.ID, c.Param("cityCode")); err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		respondMe(c, pool, current.FirebaseUID)
	})

	// Self-service only — the caller sets their own profile picture, never
	// someone else's. Same size/content-type validation as every other
	// image upload in the app.
	profiled.POST("/me/avatar", func(c *gin.Context) {
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
		current := authjwt.CurrentUser(c)
		user, err := dbpkg.UploadUserAvatar(c.Request.Context(), pool, current.ID, decoded, body.ImageContentType)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, user)
	})

	// Visible to any authenticated user with a profile — same broad
	// visibility as the username/displayName it's paired with everywhere
	// (search results, member grids, organizer names), not scoped to a
	// shared Club.
	profiled.GET("/users/:userId/avatar", func(c *gin.Context) {
		img, err := dbpkg.GetUserAvatarImage(c.Request.Context(), pool, c.Param("userId"))
		if errors.Is(err, dbpkg.ErrNotFound) {
			respondError(c, http.StatusNotFound, "this user has no profile picture")
			return
		}
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.Header("Cache-Control", "private, max-age=31536000, immutable")
		c.Data(http.StatusOK, img.ContentType, img.Data)
	})

	// Contact Organizer (DP-013) Inbox — every thread the caller is a party
	// to, either as the member (their own thread) or as an owner/admin
	// (any member's thread on a Session in a Club they run), most-
	// recently-active first. Backs the Inbox tab.
	profiled.GET("/me/contact-threads", func(c *gin.Context) {
		current := authjwt.CurrentUser(c)
		threads, err := dbpkg.ListMyContactThreads(c.Request.Context(), pool, current.ID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, threads)
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

// respondMe answers with the caller's freshly read profile.
func respondMe(c *gin.Context, pool *pgxpool.Pool, firebaseUID string) {
	user, err := dbpkg.GetUserByFirebaseUID(c.Request.Context(), pool, firebaseUID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal error")
		return
	}
	c.JSON(http.StatusOK, user)
}

func respondCityError(c *gin.Context, err error) {
	if errors.Is(err, dbpkg.ErrTooManyCities) {
		respondError(c, http.StatusConflict, fmt.Sprintf("you can keep at most %d towns — remove one first", dbpkg.MaxUserCities))
		return
	}
	respondError(c, http.StatusInternalServerError, "internal error")
}
