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
		c.Set(ctxUser, user)
		c.Next()
	}
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
