package httpapi

import (
	"context"
	"errors"
	"log"
	"math"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/account"
	"github.com/yogisofiharja/aksi-server/internal/authjwt"
	dbpkg "github.com/yogisofiharja/aksi-server/internal/db"
	"github.com/yogisofiharja/aksi-server/internal/mail"
	"github.com/yogisofiharja/aksi-server/internal/models"
)

// PasswordSetter is the one admin capability password recovery needs.
// Nil when no Firebase service account is configured — recovery then
// reports itself unavailable instead of half-working.
type PasswordSetter interface {
	SetPassword(ctx context.Context, firebaseUID, newPassword string) error
}

// sendEmailCode issues a code for (user, purpose) and mails it. Shared by
// every DP-015 flow so the rules (cooldown, one live code, hash-only
// storage) can't drift between them.
func sendEmailCode(ctx context.Context, pool *pgxpool.Pool, mailer mail.Mailer, userID, purpose, email string) error {
	code, err := account.GenerateCode()
	if err != nil {
		return err
	}
	if err := dbpkg.IssueEmailCode(ctx, pool, userID, purpose, email, account.HashCode(userID, purpose, code)); err != nil {
		return err
	}
	msg := mail.VerificationMessage(email, code)
	if purpose == account.PurposeResetPassword {
		msg = mail.PasswordResetMessage(email, code)
	}
	return mailer.Send(ctx, msg)
}

// findUserByIdentifier resolves what a person types into "username or
// email" to an account: anything with an "@" is looked up as a confirmed
// email, anything else as a username.
func findUserByIdentifier(ctx context.Context, pool *pgxpool.Pool, identifier string) (models.User, error) {
	identifier = strings.TrimSpace(identifier)
	if strings.Contains(identifier, "@") {
		return dbpkg.GetUserByConfirmedEmail(ctx, pool, account.NormalizeEmail(identifier))
	}
	return dbpkg.GetUserByUsername(ctx, pool, strings.ToLower(identifier))
}

func RegisterAccountEmailRoutes(rg *gin.RouterGroup, pool *pgxpool.Pool, verifier *authjwt.Verifier, mailer mail.Mailer, passwords PasswordSetter) {
	profiled := rg.Group("")
	profiled.Use(authjwt.RequireAuth(verifier))
	profiled.Use(authjwt.RequireProfile(pool))

	// Start (or restart) confirming an email for the caller: records it as
	// pending and mails a code. The caller's confirmed email, if any,
	// stays in effect until the code is redeemed.
	profiled.POST("/me/email", func(c *gin.Context) {
		var body struct {
			Email string `json:"email"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			respondError(c, http.StatusBadRequest, "invalid body")
			return
		}
		email := account.NormalizeEmail(body.Email)
		if !account.ValidEmail(email) {
			respondError(c, http.StatusBadRequest, "enter a valid email address")
			return
		}
		user := authjwt.CurrentUser(c)
		ctx := c.Request.Context()
		if user.Email != nil && strings.EqualFold(*user.Email, email) {
			respondError(c, http.StatusConflict, "this is already your email")
			return
		}
		taken, err := dbpkg.EmailConfirmedByAnother(ctx, pool, email, user.ID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		if taken {
			respondError(c, http.StatusConflict, "this email is already used by another account")
			return
		}
		err = sendEmailCode(ctx, pool, mailer, user.ID, account.PurposeVerifyEmail, email)
		var tooSoon *dbpkg.TooSoonError
		if errors.As(err, &tooSoon) {
			// retryAfterSeconds lets the client count down instead of
			// just saying "wait".
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":             "a code was just sent — wait a moment before asking for another",
				"code":              "TOO_SOON",
				"retryAfterSeconds": int(math.Ceil(tooSoon.RetryAfter.Seconds())),
			})
			return
		}
		if err != nil {
			log.Printf("sending email confirmation code: %v", err)
			respondError(c, http.StatusBadGateway, "could not send the code — try again")
			return
		}
		updated, err := dbpkg.GetUserByFirebaseUID(ctx, pool, user.FirebaseUID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, updated)
	})

	profiled.POST("/me/email/verify", func(c *gin.Context) {
		var body struct {
			Code string `json:"code"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.Code) == "" {
			respondError(c, http.StatusBadRequest, "code is required")
			return
		}
		user := authjwt.CurrentUser(c)
		ctx := c.Request.Context()
		email, err := dbpkg.RedeemEmailCode(ctx, pool, user.ID, account.PurposeVerifyEmail, account.HashCode(user.ID, account.PurposeVerifyEmail, body.Code))
		if errors.Is(err, dbpkg.ErrCodeInvalid) {
			respondError(c, http.StatusBadRequest, "that code is wrong or has expired")
			return
		}
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		updated, err := dbpkg.SetConfirmedEmail(ctx, pool, user.ID, email)
		if errors.Is(err, dbpkg.ErrConflict) {
			respondError(c, http.StatusConflict, "this email is already used by another account")
			return
		}
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		// Changing (not first adding) an email: tell the address that was
		// just replaced. Best-effort — the change itself already happened.
		if user.Email != nil && !strings.EqualFold(*user.Email, email) {
			if err := mailer.Send(ctx, mail.EmailChangedMessage(*user.Email, email)); err != nil {
				log.Printf("sending email-changed notice: %v", err)
			}
		}
		c.JSON(http.StatusOK, updated)
	})

	// --- Unauthenticated: the caller, by definition, cannot sign in. ---

	// Login with email: Firebase identities are synthetic
	// ("<username>@accounts.aksi.app"), so the client asks which identity
	// to sign in as. An email nobody confirmed gets a decoy identity that
	// fails at sign-in like a wrong password — the answer never reveals
	// whether the email is registered.
	rg.POST("/auth/login-identity", func(c *gin.Context) {
		var body struct {
			Email string `json:"email"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			respondError(c, http.StatusBadRequest, "invalid body")
			return
		}
		email := account.NormalizeEmail(body.Email)
		user, err := dbpkg.GetUserByConfirmedEmail(c.Request.Context(), pool, email)
		if errors.Is(err, dbpkg.ErrNotFound) {
			c.JSON(http.StatusOK, gin.H{"loginEmail": account.DecoyLoginEmail(email)})
			return
		}
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, gin.H{"loginEmail": account.LoginEmailForUsername(user.Username)})
	})

	// Always 204, whatever the identifier: unknown account, no confirmed
	// email, and cooldown all look the same from outside as success.
	rg.POST("/auth/password-reset/request", func(c *gin.Context) {
		var body struct {
			Identifier string `json:"identifier"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.Identifier) == "" {
			respondError(c, http.StatusBadRequest, "identifier is required")
			return
		}
		if passwords == nil {
			respondError(c, http.StatusServiceUnavailable, "password recovery is not available yet")
			return
		}
		ctx := c.Request.Context()
		user, err := findUserByIdentifier(ctx, pool, body.Identifier)
		if err == nil && user.Email != nil {
			if err := sendEmailCode(ctx, pool, mailer, user.ID, account.PurposeResetPassword, *user.Email); err != nil && !errors.Is(err, dbpkg.ErrTooSoon) {
				log.Printf("sending password reset code: %v", err)
			}
		} else if err != nil && !errors.Is(err, dbpkg.ErrNotFound) {
			log.Printf("password reset lookup: %v", err)
		}
		c.Status(http.StatusNoContent)
	})

	rg.POST("/auth/password-reset/confirm", func(c *gin.Context) {
		var body struct {
			Identifier  string `json:"identifier"`
			Code        string `json:"code"`
			NewPassword string `json:"newPassword"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.Identifier) == "" || strings.TrimSpace(body.Code) == "" {
			respondError(c, http.StatusBadRequest, "identifier and code are required")
			return
		}
		if len(body.NewPassword) < account.MinPasswordLength {
			respondError(c, http.StatusBadRequest, "password must be at least 6 characters")
			return
		}
		if passwords == nil {
			respondError(c, http.StatusServiceUnavailable, "password recovery is not available yet")
			return
		}
		ctx := c.Request.Context()
		const invalid = "that code is wrong or has expired"
		user, err := findUserByIdentifier(ctx, pool, body.Identifier)
		if errors.Is(err, dbpkg.ErrNotFound) {
			respondError(c, http.StatusBadRequest, invalid)
			return
		}
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		if _, err := dbpkg.RedeemEmailCode(ctx, pool, user.ID, account.PurposeResetPassword, account.HashCode(user.ID, account.PurposeResetPassword, body.Code)); err != nil {
			if errors.Is(err, dbpkg.ErrCodeInvalid) {
				respondError(c, http.StatusBadRequest, invalid)
				return
			}
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		// The code is spent at this point. If Firebase refuses the change
		// the person asks for a fresh code — safer than leaving a redeemed
		// code reusable.
		if err := passwords.SetPassword(ctx, user.FirebaseUID, body.NewPassword); err != nil {
			log.Printf("setting new password for user %s: %v", user.ID, err)
			respondError(c, http.StatusBadGateway, "could not change the password — request a new code and try again")
			return
		}
		// Best-effort notice to the owner, in case the reset wasn't theirs.
		if user.Email != nil {
			if err := mailer.Send(ctx, mail.PasswordChangedMessage(*user.Email)); err != nil {
				log.Printf("sending password-changed notice: %v", err)
			}
		}
		c.Status(http.StatusNoContent)
	})
}
