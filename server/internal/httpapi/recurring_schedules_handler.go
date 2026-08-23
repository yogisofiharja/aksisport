package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/authjwt"
	dbpkg "github.com/yogisofiharja/aksi-server/internal/db"
	"github.com/yogisofiharja/aksi-server/internal/models"
	"github.com/yogisofiharja/aksi-server/internal/scheduling"
)

// requireRecurringScheduleAccess loads the Schedule, checks it belongs to
// the :clubId in the URL, and requires the caller be owner/admin — a
// Recurring Schedule is an organizer-only management surface (DP-007),
// unlike a Session, which becomes member-visible once published.
func requireRecurringScheduleAccess(c *gin.Context, pool *pgxpool.Pool, clubID, id string) (models.RecurringSchedule, bool) {
	sched, err := dbpkg.GetRecurringSchedule(c.Request.Context(), pool, id)
	if errors.Is(err, dbpkg.ErrNotFound) || (err == nil && sched.ClubID != clubID) {
		respondError(c, http.StatusNotFound, "recurring schedule not found")
		return models.RecurringSchedule{}, false
	}
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal error")
		return models.RecurringSchedule{}, false
	}

	user := authjwt.CurrentUser(c)
	m, err := dbpkg.GetMembership(c.Request.Context(), pool, clubID, user.ID)
	if errors.Is(err, dbpkg.ErrNotFound) {
		respondError(c, http.StatusForbidden, "not a member of this club")
		return models.RecurringSchedule{}, false
	}
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal error")
		return models.RecurringSchedule{}, false
	}
	if !isOwnerOrAdmin(m.Role) {
		respondError(c, http.StatusForbidden, "only owner/admin can manage recurring schedules")
		return models.RecurringSchedule{}, false
	}
	return sched, true
}

type recurringScheduleBody struct {
	Sport                 string          `json:"sport"`
	Name                  *string         `json:"name"`
	Location              *string         `json:"location"`
	Description           *string         `json:"description"`
	CourtCount            int             `json:"courtCount"`
	MaxParticipants       *int            `json:"maxParticipants"`
	DefaultMatchFormat    json.RawMessage `json:"defaultMatchFormat"`
	DefaultSingleDeuce    *bool           `json:"defaultSingleDeuce"`
	ActivityType          *string         `json:"activityType"`
	RecurrenceRule        json.RawMessage `json:"recurrenceRule"`
	GenerationLeadDays    int             `json:"generationLeadDays"`
	GenerationTime        *string         `json:"generationTime"`
	EndDate               *time.Time      `json:"endDate"`
	SkillLevelMinID       *string         `json:"skillLevelMinId"`
	SkillLevelMaxID       *string         `json:"skillLevelMaxId"`
	SkillLevelEnforcement *string         `json:"skillLevelEnforcement"`
	HostPlaying           *bool           `json:"hostPlaying"`
	PriceModel            *string         `json:"priceModel"`
	PricePerPerson        *int            `json:"pricePerPerson"`
	TotalPrice            *int            `json:"totalPrice"`
}

func RegisterRecurringScheduleRoutes(rg *gin.RouterGroup, pool *pgxpool.Pool, verifier *authjwt.Verifier) {
	authed := rg.Group("")
	authed.Use(authjwt.RequireAuth(verifier))
	authed.Use(authjwt.RequireProfile(pool))

	authed.POST("/clubs/:clubId/recurring-schedules", func(c *gin.Context) {
		clubID := c.Param("clubId")
		user := authjwt.CurrentUser(c)
		m, err := dbpkg.GetMembership(c.Request.Context(), pool, clubID, user.ID)
		if errors.Is(err, dbpkg.ErrNotFound) {
			respondError(c, http.StatusForbidden, "not a member of this club")
			return
		}
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		if !isOwnerOrAdmin(m.Role) {
			respondError(c, http.StatusForbidden, "only owner/admin can create recurring schedules")
			return
		}

		var body recurringScheduleBody
		if err := c.ShouldBindJSON(&body); err != nil || body.Sport == "" || len(body.RecurrenceRule) == 0 {
			respondError(c, http.StatusBadRequest, "sport and recurrenceRule are required")
			return
		}
		// DP-004: Name and Location are mandatory on the Template too, same
		// rule as ad-hoc Session creation — every generated Session inherits
		// them, so an unset Template would produce unnamed/unlocated Sessions.
		if body.Name == nil || *body.Name == "" || body.Location == nil || *body.Location == "" {
			respondError(c, http.StatusBadRequest, "name and location are required")
			return
		}
		if body.ActivityType == nil || *body.ActivityType == "" {
			respondError(c, http.StatusBadRequest, "activityType is required")
			return
		}
		if body.HostPlaying == nil {
			respondError(c, http.StatusBadRequest, "hostPlaying is required")
			return
		}
		if _, err := scheduling.ParseRecurrenceRule(body.RecurrenceRule); err != nil {
			respondError(c, http.StatusBadRequest, "invalid recurrenceRule: "+err.Error())
			return
		}
		// DP-008: optional on Recurring Schedule Templates too, same
		// all-or-nothing rule as ad-hoc Sessions.
		if _, errMsg := validateSkillLevelRange(c.Request.Context(), pool, body.Sport, body.SkillLevelMinID, body.SkillLevelMaxID, body.SkillLevelEnforcement); errMsg != "" {
			respondError(c, http.StatusBadRequest, errMsg)
			return
		}
		// Price (Payments): optional on the Template too, same all-or-
		// nothing-per-model rule as ad-hoc Sessions — copied onto every
		// generated Session (see internal/scheduling/generate.go).
		priceModel, pricePerPerson, totalPrice, errMsg := validatePriceModel(body.PriceModel, body.PricePerPerson, body.TotalPrice)
		if errMsg != "" {
			respondError(c, http.StatusBadRequest, errMsg)
			return
		}
		sched, err := dbpkg.CreateRecurringSchedule(c.Request.Context(), pool, dbpkg.CreateRecurringScheduleParams{
			ClubID: clubID, Sport: body.Sport, Name: body.Name, Location: body.Location, Description: body.Description,
			CourtCount: body.CourtCount, MaxParticipants: body.MaxParticipants,
			DefaultMatchFormat: body.DefaultMatchFormat, DefaultSingleDeuce: body.DefaultSingleDeuce,
			ActivityType: body.ActivityType, RecurrenceRule: body.RecurrenceRule,
			GenerationLeadDays: body.GenerationLeadDays, GenerationTime: body.GenerationTime,
			EndDate: body.EndDate, CreatedBy: user.ID,
			SkillLevelMinID: body.SkillLevelMinID, SkillLevelMaxID: body.SkillLevelMaxID, SkillLevelEnforcement: body.SkillLevelEnforcement,
			HostPlaying:    *body.HostPlaying,
			PriceModel:     priceModel,
			PricePerPerson: pricePerPerson,
			TotalPrice:     totalPrice,
		})
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusCreated, sched)
	})

	authed.GET("/clubs/:clubId/recurring-schedules", func(c *gin.Context) {
		clubID := c.Param("clubId")
		user := authjwt.CurrentUser(c)
		m, err := dbpkg.GetMembership(c.Request.Context(), pool, clubID, user.ID)
		if errors.Is(err, dbpkg.ErrNotFound) {
			respondError(c, http.StatusForbidden, "not a member of this club")
			return
		}
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		if !isOwnerOrAdmin(m.Role) {
			respondError(c, http.StatusForbidden, "only owner/admin can view recurring schedules")
			return
		}
		schedules, err := dbpkg.ListRecurringSchedulesForClub(c.Request.Context(), pool, clubID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, schedules)
	})

	authed.GET("/clubs/:clubId/recurring-schedules/:id", func(c *gin.Context) {
		sched, ok := requireRecurringScheduleAccess(c, pool, c.Param("clubId"), c.Param("id"))
		if !ok {
			return
		}
		c.JSON(http.StatusOK, sched)
	})

	authed.PATCH("/clubs/:clubId/recurring-schedules/:id", func(c *gin.Context) {
		existing, ok := requireRecurringScheduleAccess(c, pool, c.Param("clubId"), c.Param("id"))
		if !ok {
			return
		}
		var body struct {
			Name                  *string         `json:"name"`
			Location              *string         `json:"location"`
			Description           *string         `json:"description"`
			CourtCount            *int            `json:"courtCount"`
			MaxParticipants       *int            `json:"maxParticipants"`
			DefaultMatchFormat    json.RawMessage `json:"defaultMatchFormat"`
			DefaultSingleDeuce    *bool           `json:"defaultSingleDeuce"`
			ActivityType          *string         `json:"activityType"`
			RecurrenceRule        json.RawMessage `json:"recurrenceRule"`
			GenerationLeadDays    *int            `json:"generationLeadDays"`
			GenerationTime        *string         `json:"generationTime"`
			EndDate               *time.Time      `json:"endDate"`
			SkillLevelMinID       *string         `json:"skillLevelMinId"`
			SkillLevelMaxID       *string         `json:"skillLevelMaxId"`
			SkillLevelEnforcement *string         `json:"skillLevelEnforcement"`
			HostPlaying           *bool           `json:"hostPlaying"`
			PriceModel            *string         `json:"priceModel"`
			PricePerPerson        *int            `json:"pricePerPerson"`
			TotalPrice            *int            `json:"totalPrice"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			respondError(c, http.StatusBadRequest, "invalid body")
			return
		}
		if len(body.RecurrenceRule) > 0 {
			if _, err := scheduling.ParseRecurrenceRule(body.RecurrenceRule); err != nil {
				respondError(c, http.StatusBadRequest, "invalid recurrenceRule: "+err.Error())
				return
			}
		}
		if ok, errMsg := validateSkillLevelIDForUpdate(c.Request.Context(), pool, existing.Sport, body.SkillLevelMinID); !ok {
			respondError(c, http.StatusBadRequest, errMsg)
			return
		}
		if ok, errMsg := validateSkillLevelIDForUpdate(c.Request.Context(), pool, existing.Sport, body.SkillLevelMaxID); !ok {
			respondError(c, http.StatusBadRequest, errMsg)
			return
		}
		if body.SkillLevelEnforcement != nil && *body.SkillLevelEnforcement != "strict" && *body.SkillLevelEnforcement != "guidance" {
			respondError(c, http.StatusBadRequest, `skillLevelEnforcement must be "strict" or "guidance"`)
			return
		}
		priceModel, pricePerPerson, totalPrice, priceErrMsg := validatePriceModelForUpdate(body.PriceModel, body.PricePerPerson, body.TotalPrice)
		if priceErrMsg != "" {
			respondError(c, http.StatusBadRequest, priceErrMsg)
			return
		}
		sched, err := dbpkg.UpdateRecurringSchedule(c.Request.Context(), pool, c.Param("id"), dbpkg.RecurringScheduleUpdate{
			Name: body.Name, Location: body.Location, Description: body.Description, CourtCount: body.CourtCount,
			MaxParticipants: body.MaxParticipants, DefaultMatchFormat: body.DefaultMatchFormat, DefaultSingleDeuce: body.DefaultSingleDeuce,
			ActivityType: body.ActivityType,
			HostPlaying:  body.HostPlaying,
			RecurrenceRule: body.RecurrenceRule, GenerationLeadDays: body.GenerationLeadDays,
			GenerationTime: body.GenerationTime, EndDate: body.EndDate,
			SkillLevelMinID: body.SkillLevelMinID, SkillLevelMaxID: body.SkillLevelMaxID, SkillLevelEnforcement: body.SkillLevelEnforcement,
			PriceModel:      priceModel,
			PricePerPerson:  pricePerPerson,
			TotalPrice:      totalPrice,
		})
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, sched)
	})

	authed.POST("/clubs/:clubId/recurring-schedules/:id/pause", func(c *gin.Context) {
		if _, ok := requireRecurringScheduleAccess(c, pool, c.Param("clubId"), c.Param("id")); !ok {
			return
		}
		sched, err := dbpkg.SetRecurringScheduleStatus(c.Request.Context(), pool, c.Param("id"), "paused")
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, sched)
	})

	authed.POST("/clubs/:clubId/recurring-schedules/:id/resume", func(c *gin.Context) {
		if _, ok := requireRecurringScheduleAccess(c, pool, c.Param("clubId"), c.Param("id")); !ok {
			return
		}
		sched, err := dbpkg.SetRecurringScheduleStatus(c.Request.Context(), pool, c.Param("id"), "active")
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, sched)
	})

	authed.DELETE("/clubs/:clubId/recurring-schedules/:id", func(c *gin.Context) {
		if _, ok := requireRecurringScheduleAccess(c, pool, c.Param("clubId"), c.Param("id")); !ok {
			return
		}
		if err := dbpkg.DeleteRecurringSchedule(c.Request.Context(), pool, c.Param("id")); err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.Status(http.StatusNoContent)
	})

	// Unifies "skip a future occurrence before it's generated" and "delete
	// an already-generated Session" into one operation, per DP-007's own
	// framing of these as the same business event (skipping an occurrence)
	// rather than two different features.
	authed.POST("/clubs/:clubId/recurring-schedules/:id/occurrences/skip", func(c *gin.Context) {
		scheduleID := c.Param("id")
		if _, ok := requireRecurringScheduleAccess(c, pool, c.Param("clubId"), scheduleID); !ok {
			return
		}
		var body struct {
			OccurrenceStartsAt time.Time `json:"occurrenceStartsAt"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.OccurrenceStartsAt.IsZero() {
			respondError(c, http.StatusBadRequest, "occurrenceStartsAt is required")
			return
		}
		if err := dbpkg.SkipOccurrence(c.Request.Context(), pool, scheduleID, body.OccurrenceStartsAt); err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		if err := dbpkg.DeleteGeneratedSession(c.Request.Context(), pool, scheduleID, body.OccurrenceStartsAt); err != nil && !errors.Is(err, dbpkg.ErrNotFound) {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.Status(http.StatusNoContent)
	})

	// Manual override of the automatic ticker — an explicit organizer
	// action to generate a specific occurrence right now, without waiting
	// for its Generation Policy lead time to elapse.
	authed.POST("/clubs/:clubId/recurring-schedules/:id/occurrences/generate", func(c *gin.Context) {
		scheduleID := c.Param("id")
		if _, ok := requireRecurringScheduleAccess(c, pool, c.Param("clubId"), scheduleID); !ok {
			return
		}
		var body struct {
			OccurrenceStartsAt time.Time `json:"occurrenceStartsAt"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.OccurrenceStartsAt.IsZero() {
			respondError(c, http.StatusBadRequest, "occurrenceStartsAt is required")
			return
		}
		session, err := scheduling.GenerateOccurrenceNow(c.Request.Context(), pool, scheduleID, body.OccurrenceStartsAt)
		if errors.Is(err, scheduling.ErrNotAnOccurrence) {
			respondError(c, http.StatusBadRequest, "not a valid occurrence of this recurring schedule")
			return
		}
		if errors.Is(err, scheduling.ErrOccurrenceSkipped) {
			respondError(c, http.StatusConflict, "this occurrence was skipped")
			return
		}
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, session)
	})

	// Preview endpoint: shows organizers what's upcoming (generated,
	// pending, or skipped), computed from the Recurrence Rule rather than
	// stored — occurrence tracking is not a first-class domain object.
	authed.GET("/clubs/:clubId/recurring-schedules/:id/occurrences", func(c *gin.Context) {
		scheduleID := c.Param("id")
		sched, ok := requireRecurringScheduleAccess(c, pool, c.Param("clubId"), scheduleID)
		if !ok {
			return
		}
		from := time.Now().UTC()
		if v := c.Query("from"); v != "" {
			if parsed, err := time.Parse(time.RFC3339, v); err == nil {
				from = parsed
			}
		}
		to := from.AddDate(0, 0, 56) // 8 weeks ahead by default
		if v := c.Query("to"); v != "" {
			if parsed, err := time.Parse(time.RFC3339, v); err == nil {
				to = parsed
			}
		}

		rule, err := scheduling.ParseRecurrenceRule(sched.RecurrenceRule)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		occurrences, err := scheduling.OccurrencesInRange(rule, sched.CreatedAt, sched.EndDate, from, to)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		statuses, err := dbpkg.OccurrenceStatuses(c.Request.Context(), pool, scheduleID, occurrences)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}

		type occurrencePreview struct {
			StartsAt time.Time `json:"startsAt"`
			// One of "pending" (not yet generated), "generated", "skipped".
			Status string `json:"status"`
		}
		result := make([]occurrencePreview, 0, len(occurrences))
		for _, occ := range occurrences {
			status, ok := statuses[occ.Unix()]
			if !ok {
				status = "pending"
			}
			result = append(result, occurrencePreview{StartsAt: occ, Status: status})
		}
		c.JSON(http.StatusOK, result)
	})
}
