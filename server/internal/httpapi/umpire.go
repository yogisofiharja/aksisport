package httpapi

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/authjwt"
	dbpkg "github.com/yogisofiharja/aksi-server/internal/db"
)

// umpireAssignmentProblem is DP-023's rule for who may make whom the
// Session's umpire: an owner/admin, on a Session that isn't over, picks a
// checked-in participant (playing or not) or themselves (reclaim, even
// when not checked in). targetStatus is the target's participant status,
// "" when they have none. Returns 0 when the assignment is allowed.
func umpireAssignmentProblem(sessionStatus, callerRole, callerID, targetID, targetStatus string) (int, string) {
	if !isOwnerOrAdmin(callerRole) {
		return http.StatusForbidden, "only an owner or admin can change the umpire"
	}
	if sessionStatus == "completed" || sessionStatus == "cancelled" {
		return http.StatusConflict, "the umpire can't be changed on a completed or cancelled session"
	}
	if targetID != callerID && targetStatus != "checked_in" {
		return http.StatusBadRequest, "the umpire must be checked in to this session"
	}
	return 0, ""
}

// isSessionUmpire: only the Session's umpire starts, scores and completes
// its matches (DP-023) — not the match's players, not owners or admins.
func isSessionUmpire(umpireUserID, userID string) bool {
	return umpireUserID != "" && umpireUserID == userID
}

func RegisterUmpireRoutes(rg *gin.RouterGroup, pool *pgxpool.Pool, verifier *authjwt.Verifier) {
	authed := rg.Group("")
	authed.Use(authjwt.RequireAuth(verifier))
	authed.Use(authjwt.RequireProfile(pool))

	authed.PUT("/sessions/:id/umpire", func(c *gin.Context) {
		sessionID := c.Param("id")
		sess, role, ok := requireSessionAccess(c, pool, sessionID)
		if !ok {
			return
		}
		var body struct {
			UserID string `json:"userId"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.UserID == "" {
			respondError(c, http.StatusBadRequest, "userId is required")
			return
		}
		ctx := c.Request.Context()
		user := authjwt.CurrentUser(c)
		targetStatus, err := dbpkg.GetParticipantStatus(ctx, pool, sessionID, body.UserID)
		if err != nil && !errors.Is(err, dbpkg.ErrNotFound) {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		if code, msg := umpireAssignmentProblem(sess.Status, role, user.ID, body.UserID, targetStatus); code != 0 {
			respondError(c, code, msg)
			return
		}
		if body.UserID != sess.UmpireUserID {
			if _, err := dbpkg.SetSessionUmpire(ctx, pool, sessionID, body.UserID); err != nil {
				respondError(c, http.StatusInternalServerError, "internal error")
				return
			}
		}
		updated, err := dbpkg.GetSession(ctx, pool, sessionID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, updated)
	})
}
