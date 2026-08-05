package httpapi

import (
	"context"
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/authjwt"
	dbpkg "github.com/yogisofiharja/aksi-server/internal/db"
)

// RegisterSkillLevelRoutes wires up DP-008 (Player Skill Level): the Level
// Scale (owned by the Sport Module per DP-ARCH-002, scoped per sport) and
// the caller's own self-reported levels.
func RegisterSkillLevelRoutes(rg *gin.RouterGroup, pool *pgxpool.Pool, verifier *authjwt.Verifier) {
	profiled := rg.Group("")
	profiled.Use(authjwt.RequireAuth(verifier))
	profiled.Use(authjwt.RequireProfile(pool))

	profiled.GET("/skill-levels", func(c *gin.Context) {
		sport := c.Query("sport")
		if sport == "" {
			respondError(c, http.StatusBadRequest, "sport is required")
			return
		}
		levels, err := dbpkg.ListSkillLevels(c.Request.Context(), pool, sport)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, levels)
	})

	profiled.GET("/me/skill-levels", func(c *gin.Context) {
		user := authjwt.CurrentUser(c)
		levels, err := dbpkg.ListMySkillLevels(c.Request.Context(), pool, user.ID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, levels)
	})

	// DP-008: players may update their own Skill Level at any time,
	// self-reported only — no organizer/admin override exists.
	profiled.PUT("/me/skill-levels/:sport", func(c *gin.Context) {
		sport := c.Param("sport")
		var body struct {
			SkillLevelID string `json:"skillLevelId"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.SkillLevelID == "" {
			respondError(c, http.StatusBadRequest, "skillLevelId is required")
			return
		}
		user := authjwt.CurrentUser(c)
		level, err := dbpkg.SetSkillLevel(c.Request.Context(), pool, user.ID, sport, body.SkillLevelID)
		if errors.Is(err, dbpkg.ErrNotFound) {
			respondError(c, http.StatusBadRequest, "unknown skillLevelId")
			return
		}
		if errors.Is(err, dbpkg.ErrConflict) {
			respondError(c, http.StatusBadRequest, "skillLevelId does not belong to this sport")
			return
		}
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, level)
	})
}

// validateSkillLevelRange enforces DP-008's Session Level Requirement for
// a fresh Session/Recurring Schedule (create path). The requirement
// itself is optional — but if any of the three fields is set, all three
// must be: enforcement mode requires both min and max, both must belong
// to `sport`, and min.rank <= max.rank. attempted=false means none of the
// three fields were set at all — valid, no requirement. errMsg is
// non-empty only when attempted and invalid.
func validateSkillLevelRange(ctx context.Context, pool *pgxpool.Pool, sport string, minID, maxID, enforcement *string) (attempted bool, errMsg string) {
	if minID == nil && maxID == nil && enforcement == nil {
		return false, ""
	}
	if minID == nil || maxID == nil || enforcement == nil {
		return true, "skillLevelMinId, skillLevelMaxId, and skillLevelEnforcement must all be set together"
	}
	if *enforcement != "strict" && *enforcement != "guidance" {
		return true, `skillLevelEnforcement must be "strict" or "guidance"`
	}
	min, err := dbpkg.GetSkillLevelByID(ctx, pool, *minID)
	if err != nil || min.Sport != sport {
		return true, "skillLevelMinId is invalid for this sport"
	}
	max, err := dbpkg.GetSkillLevelByID(ctx, pool, *maxID)
	if err != nil || max.Sport != sport {
		return true, "skillLevelMaxId is invalid for this sport"
	}
	if min.Rank > max.Rank {
		return true, "skillLevelMinId must be at or below skillLevelMaxId"
	}
	return true, ""
}

// enforceStrictSkillLevel checks DP-008's Strict enforcement mode before a
// player joins a Session (register, or check-in — whichever actually
// creates the participant row, see the callers). Writes a response and
// returns false when blocked; true means either enforcement doesn't apply
// (unset or Guidance, which is client-side-only) or the player qualifies.
func enforceStrictSkillLevel(c *gin.Context, pool *pgxpool.Pool, sess dbSession, userID string) bool {
	if sess.SkillLevelEnforcement == nil || *sess.SkillLevelEnforcement != "strict" {
		return true
	}
	ctx := c.Request.Context()
	playerLevel, err := dbpkg.GetSkillLevelForUserAndSport(ctx, pool, userID, sess.Sport)
	if errors.Is(err, dbpkg.ErrNotFound) {
		respondError(c, http.StatusForbidden, "set your "+sess.Sport+" skill level before joining this session")
		return false
	}
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal error")
		return false
	}
	minLevel, err := dbpkg.GetSkillLevelByID(ctx, pool, *sess.SkillLevelMinID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal error")
		return false
	}
	maxLevel, err := dbpkg.GetSkillLevelByID(ctx, pool, *sess.SkillLevelMaxID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal error")
		return false
	}
	if playerLevel.SkillLevelRank < minLevel.Rank || playerLevel.SkillLevelRank > maxLevel.Rank {
		respondError(c, http.StatusForbidden, "your skill level is outside this session's required range")
		return false
	}
	return true
}

// validateSkillLevelIDForUpdate is the partial-update counterpart: a PATCH
// may legitimately touch only one of the three fields (e.g. just flipping
// Strict/Guidance), so it can't demand all-or-nothing the way create does.
// Only checks that a provided ID actually belongs to `sport` — it does not
// re-validate rank ordering against whatever the other two fields already
// are in the database, which is a known simplification.
func validateSkillLevelIDForUpdate(ctx context.Context, pool *pgxpool.Pool, sport string, id *string) (ok bool, errMsg string) {
	if id == nil {
		return true, ""
	}
	level, err := dbpkg.GetSkillLevelByID(ctx, pool, *id)
	if err != nil || level.Sport != sport {
		return false, "skill level id is invalid for this sport"
	}
	return true, ""
}
