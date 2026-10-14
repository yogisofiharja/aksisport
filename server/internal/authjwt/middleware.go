package authjwt

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	dbpkg "github.com/yogisofiharja/aksi-server/internal/db"
	"github.com/yogisofiharja/aksi-server/internal/models"
)

const (
	ctxFirebaseUID = "firebaseUID"
	ctxUser        = "user"
)

// RequireAuth verifies the Bearer Firebase ID token and stores the
// resulting Firebase UID on the Gin context. It does not require a
// Postgres profile to exist yet.
func RequireAuth(verifier *Verifier) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing bearer token"})
			return
		}
		token := strings.TrimPrefix(header, "Bearer ")
		uid, err := verifier.VerifyIDToken(token)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}
		c.Set(ctxFirebaseUID, uid)
		c.Next()
	}
}

// RequireProfile builds on RequireAuth: it additionally loads the Postgres
// user row for the authenticated Firebase UID and stores it on the
// context, responding 404 PROFILE_NOT_FOUND if the profile hasn't been
// created yet (client should call POST /v1/users first).
func RequireProfile(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		uid := FirebaseUID(c)
		user, err := dbpkg.GetUserByFirebaseUID(context.Background(), pool, uid)
		if errors.Is(err, dbpkg.ErrNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "profile not found", "code": "PROFILE_NOT_FOUND"})
			return
		}
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
			return
		}
		if EmailGateBlocks(user, c.FullPath()) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "confirm your email first", "code": "EMAIL_UNCONFIRMED"})
			return
		}
		c.Set(ctxUser, user)
		// Online indicator: no push/websocket presence exists anywhere in
		// this app, so "online" is derived from recent activity instead of
		// a stored boolean requiring explicit transitions. Fire-and-forget
		// on its own background context — never blocks the request it's
		// riding on, and outlives it if the client disconnects early.
		go func(userID string) {
			_ = dbpkg.TouchUserActivity(context.Background(), pool, userID)
		}(user.ID)
		c.Next()
	}
}

// emailGateOpenPaths are the only profile-requiring routes an account
// held at the email gate may use: the ones that confirm the email.
// (GET /v1/me needs no profile middleware at all, so it stays reachable.)
var emailGateOpenPaths = map[string]bool{
	"/v1/me/email":        true,
	"/v1/me/email/verify": true,
}

// EmailGateBlocks enforces DP-015 on the server: an account created under
// it (EmailRequired) can do nothing but confirm its email until it has. The
// app already holds such accounts on a confirmation screen; this stops a
// client that skips that screen. Older accounts are never blocked.
func EmailGateBlocks(user models.User, fullPath string) bool {
	return user.EmailRequired && user.Email == nil && !emailGateOpenPaths[fullPath]
}

func FirebaseUID(c *gin.Context) string {
	uid, _ := c.Get(ctxFirebaseUID)
	s, _ := uid.(string)
	return s
}

func CurrentUser(c *gin.Context) models.User {
	u, _ := c.Get(ctxUser)
	user, _ := u.(models.User)
	return user
}
