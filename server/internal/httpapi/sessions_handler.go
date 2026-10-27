package httpapi

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yogisofiharja/aksi-server/internal/authjwt"
	dbpkg "github.com/yogisofiharja/aksi-server/internal/db"
	"github.com/yogisofiharja/aksi-server/internal/models"
	"github.com/yogisofiharja/aksi-server/internal/notify"
)

// requireSessionAccess loads the session and the caller's role in its
// parent club — or "visitor" for a Session-only participant (DP-028).
// ok=false means a response has already been sent.
//
// DP-001: a 'draft' session is invisible to members who aren't owner/admin
// — treated as not-found rather than forbidden, so its existence isn't
// leaked to members it shouldn't be visible to at all.
func requireSessionAccess(c *gin.Context, pool *pgxpool.Pool, sessionID string) (session dbSession, role string, ok bool) {
	sess, err := dbpkg.GetSession(c.Request.Context(), pool, sessionID)
	if errors.Is(err, dbpkg.ErrNotFound) {
		respondError(c, http.StatusNotFound, "session not found")
		return dbSession{}, "", false
	}
	if err != nil {
		respondError(c, http.StatusInternalServerError, "internal error")
		return dbSession{}, "", false
	}

	user := authjwt.CurrentUser(c)
	m, err := dbpkg.GetMembership(c.Request.Context(), pool, sess.ClubID, user.ID)
	switch {
	case err == nil:
		role = m.Role
	case errors.Is(err, dbpkg.ErrNotFound):
		// DP-028: a non-member may still see this one Session — as its
		// participant, or because they were invited to it. They act as a
		// plain player here ("visitor") and stay outside the Community:
		// every /clubs/:clubId route still answers "not a member".
		visitor, verr := dbpkg.HasSessionVisitorAccess(c.Request.Context(), pool, sess.ID, user.ID)
		if verr != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return dbSession{}, "", false
		}
		if !visitor {
			respondError(c, http.StatusForbidden, "not a member of this club")
			return dbSession{}, "", false
		}
		role = dbpkg.SessionVisitorRole
	default:
		respondError(c, http.StatusInternalServerError, "internal error")
		return dbSession{}, "", false
	}
	if sess.Status == "draft" && !isOwnerOrAdmin(role) {
		respondError(c, http.StatusNotFound, "session not found")
		return dbSession{}, "", false
	}
	return dbSession{
		ID: sess.ID, ClubID: sess.ClubID, Sport: sess.Sport, Status: sess.Status,
		SkillLevelMinID: sess.SkillLevelMinID, SkillLevelMaxID: sess.SkillLevelMaxID, SkillLevelEnforcement: sess.SkillLevelEnforcement,
		StartsAt: sess.StartsAt, DurationMinutes: sess.DurationMinutes, UmpireUserID: sess.UmpireUserID,
	}, role, true
}

// dbSession is a tiny local alias to avoid importing models directly here
// for a value only used to pass a couple of fields around this file.
type dbSession struct {
	ID                    string
	ClubID                string
	Sport                 string
	Status                string
	SkillLevelMinID       *string
	SkillLevelMaxID       *string
	SkillLevelEnforcement *string
	StartsAt              *time.Time
	DurationMinutes       *int
	UmpireUserID          string
}

// checkInWindowOpen: check-in (self, host-initiated, or adding a guest) is
// only allowed from 1 hour before the Session starts until it ends
// (startsAt + durationMinutes) — an explicit product rule, not just a
// convenience. Sessions missing either field (legacy, pre-DP-009) have no
// defined window, so nothing is restricted for them.
func checkInWindowOpen(startsAt *time.Time, durationMinutes *int, now time.Time) bool {
	if startsAt == nil || durationMinutes == nil {
		return true
	}
	windowStart := startsAt.Add(-1 * time.Hour)
	windowEnd := startsAt.Add(time.Duration(*durationMinutes) * time.Minute)
	return !now.Before(windowStart) && now.Before(windowEnd)
}

// sessionChatWindowOpen: DP-011 — posting a new Chat message is only
// allowed until 1 week after the Session ends (startsAt + durationMinutes);
// past that, the chat becomes read-only history. No lower bound (unlike
// checkInWindowOpen) — chat is open for the entire Session too, including
// before it starts. Sessions missing either field (legacy, pre-DP-009)
// have no defined window, so posting is never restricted for them.
func sessionChatWindowOpen(startsAt *time.Time, durationMinutes *int, now time.Time) bool {
	if startsAt == nil || durationMinutes == nil {
		return true
	}
	windowEnd := startsAt.Add(time.Duration(*durationMinutes) * time.Minute).Add(7 * 24 * time.Hour)
	return now.Before(windowEnd)
}

func isOwnerOrAdmin(role string) bool {
	return role == "owner" || role == "admin"
}

// isValidDurationMinutes: 1-24 hours in hourly increments (DP-009 v0.6.0) —
// no tournament-length Sessions yet, so 24 hours is the ceiling for now.
func isValidDurationMinutes(minutes int) bool {
	return minutes >= 60 && minutes <= 1440 && minutes%60 == 0
}

// validatePriceModel normalizes and validates a Session/Recurring Schedule
// Template's price fields — shared by both create routes (sessions_handler.go,
// recurring_schedules_handler.go). priceModel defaults to "free" when the
// caller omits it entirely (nil), same optional-with-a-default treatment
// as HostPlaying elsewhere isn't given but Skill Level's absence is. Each
// model has exactly one meaningful amount field; the other two return
// values are always nil regardless of what the caller sent, so a stray
// pricePerPerson sent alongside priceModel:"free" is silently dropped
// rather than stored.
func validatePriceModel(priceModel *string, pricePerPerson, totalPrice *int) (model string, perPerson, total *int, errMsg string) {
	model = "free"
	if priceModel != nil {
		model = *priceModel
	}
	switch model {
	case "free":
		return model, nil, nil, ""
	case "per_person":
		if pricePerPerson == nil || *pricePerPerson <= 0 {
			return "", nil, nil, "pricePerPerson must be a positive amount when priceModel is per_person"
		}
		return model, pricePerPerson, nil, ""
	case "split_bill":
		if totalPrice == nil || *totalPrice <= 0 {
			return "", nil, nil, "totalPrice must be a positive amount when priceModel is split_bill"
		}
		return model, nil, totalPrice, ""
	default:
		return "", nil, nil, `priceModel must be "free", "per_person", or "split_bill"`
	}
}

// validatePriceModelForUpdate mirrors validatePriceModel but for PATCH,
// where omitting priceModel entirely must mean "don't change price at
// all" — unlike create, there is no default-to-"free" here; a nil model
// return tells the caller to pass nil straight through to COALESCE.
func validatePriceModelForUpdate(priceModel *string, pricePerPerson, totalPrice *int) (model *string, perPerson, total *int, errMsg string) {
	if priceModel == nil {
		return nil, nil, nil, ""
	}
	m, pp, tp, errMsg := validatePriceModel(priceModel, pricePerPerson, totalPrice)
	if errMsg != "" {
		return nil, nil, nil, errMsg
	}
	return &m, pp, tp, ""
}

// sessionStatusTransitions: DP-001's explicit states (Draft, Cancelled,
// Completed) plus the two mechanically-explicit ones (In Progress is
// reached by an explicit "organizer starts session" action, per the
// approved model, even though it's conceptually a "transition state"
// rather than a milestone the organizer lingers in). Recruiting/Ready/Full
// are not here — never stored, see ListSessionsForClub's comment and
// docs/engineering/architecture.md.
var sessionStatusTransitions = map[string][]string{
	"draft":       {"open", "cancelled"},
	"open":        {"in_progress", "cancelled"},
	"in_progress": {"completed", "cancelled"},
	"completed":   {},
	"cancelled":   {},
}

func isValidSessionTransition(from, to string) bool {
	for _, allowed := range sessionStatusTransitions[from] {
		if allowed == to {
			return true
		}
	}
	return false
}

// notifySession sends a DP-018 notification about a Session, named by
// its label; best effort.
func notifySession(ctx context.Context, pool *pgxpool.Pool, notifier *notify.Service, sessionID string, recipients []string, actor, notificationType, path string, params map[string]string) {
	if notifier == nil || len(recipients) == 0 {
		return
	}
	label, err := dbpkg.SessionLabel(ctx, pool, sessionID)
	if err != nil {
		log.Printf("notify: session label %s: %v", sessionID, err)
		return
	}
	if params == nil {
		params = map[string]string{}
	}
	params["session"] = label
	notifier.Send(ctx, recipients, actor, notify.Notification{Type: notificationType, Params: params, Path: path})
}

func RegisterSessionRoutes(rg *gin.RouterGroup, pool *pgxpool.Pool, verifier *authjwt.Verifier, msgs *messenger, notifier *notify.Service) {
	authed := rg.Group("")
	authed.Use(authjwt.RequireAuth(verifier))
	authed.Use(authjwt.RequireProfile(pool))

	authed.POST("/clubs/:clubId/sessions", func(c *gin.Context) {
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
			respondError(c, http.StatusForbidden, "only owner/admin can create sessions")
			return
		}

		var body struct {
			Sport                 string          `json:"sport"`
			Name                  *string         `json:"name"`
			Location              *string         `json:"location"`
			Description           *string         `json:"description"`
			CourtCount            int             `json:"courtCount"`
			MaxParticipants       *int            `json:"maxParticipants"`
			DefaultMatchFormat    json.RawMessage `json:"defaultMatchFormat"`
			DefaultSingleDeuce    *bool           `json:"defaultSingleDeuce"`
			ActivityType          *string         `json:"activityType"`
			StartsAt              *time.Time      `json:"startsAt"`
			DurationMinutes       *int            `json:"durationMinutes"`
			SkillLevelMinID       *string         `json:"skillLevelMinId"`
			SkillLevelMaxID       *string         `json:"skillLevelMaxId"`
			SkillLevelEnforcement *string         `json:"skillLevelEnforcement"`
			HostPlaying           *bool           `json:"hostPlaying"`
			PriceModel            *string         `json:"priceModel"`
			PricePerPerson        *int            `json:"pricePerPerson"`
			TotalPrice            *int            `json:"totalPrice"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.Sport == "" {
			respondError(c, http.StatusBadRequest, "sport is required")
			return
		}
		// DP-004: Name and Location are mandatory as of this round — no more
		// server-side auto-generated name fallback for ad-hoc creation.
		if body.Name == nil || *body.Name == "" || body.Location == nil || *body.Location == "" {
			respondError(c, http.StatusBadRequest, "name and location are required")
			return
		}
		if body.ActivityType == nil || *body.ActivityType == "" {
			respondError(c, http.StatusBadRequest, "activityType is required")
			return
		}
		// DP-009: startsAt + durationMinutes are mandatory together as of v0.5.1.
		if body.StartsAt == nil || body.DurationMinutes == nil {
			respondError(c, http.StatusBadRequest, "startsAt and durationMinutes are required")
			return
		}
		// Milestone 2: mirrors the client-side check in CreateSessionScreen —
		// a Session can't be scheduled in the past.
		if body.StartsAt.Before(time.Now()) {
			respondError(c, http.StatusBadRequest, "startsAt cannot be in the past")
			return
		}
		if !isValidDurationMinutes(*body.DurationMinutes) {
			respondError(c, http.StatusBadRequest, "durationMinutes must be a multiple of 60 between 60 and 1440")
			return
		}
		if body.HostPlaying == nil {
			respondError(c, http.StatusBadRequest, "hostPlaying is required")
			return
		}
		// DP-008: a Skill Level range is optional — but if skillLevelMinId is
		// set, skillLevelMaxId (and enforcement) become mandatory, and vice
		// versa; validateSkillLevelRange enforces the all-or-nothing rule.
		if _, errMsg := validateSkillLevelRange(c.Request.Context(), pool, body.Sport, body.SkillLevelMinID, body.SkillLevelMaxID, body.SkillLevelEnforcement); errMsg != "" {
			respondError(c, http.StatusBadRequest, errMsg)
			return
		}
		// Price (Payments): optional, defaults to "free" — validated/
		// normalized together since each model has exactly one meaningful
		// amount field.
		priceModel, pricePerPerson, totalPrice, errMsg := validatePriceModel(body.PriceModel, body.PricePerPerson, body.TotalPrice)
		if errMsg != "" {
			respondError(c, http.StatusBadRequest, errMsg)
			return
		}
		session, err := dbpkg.CreateSession(c.Request.Context(), pool, dbpkg.CreateSessionParams{
			ClubID: clubID, Sport: body.Sport, Name: body.Name, Location: body.Location, Description: body.Description,
			CourtCount: body.CourtCount, MaxParticipants: body.MaxParticipants,
			DefaultMatchFormat: body.DefaultMatchFormat, DefaultSingleDeuce: body.DefaultSingleDeuce,
			ActivityType: body.ActivityType, CreatedBy: user.ID, StartsAt: body.StartsAt,
			DurationMinutes: body.DurationMinutes,
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
		// Host Playing: the organizer's own declared intent to play, not a
		// third-party join — lands at 'registered' (not 'checked_in'), same
		// as any other roster-building add. Checked In specifically means
		// physically present and ready to play, which is what the Check-In
		// Window (1h before start) exists to gate — even the organizer
		// still checks in for real once they're actually there. Bypasses
		// the Strict Skill Level gate (enforceStrictSkillLevel) entirely,
		// same trust already extended to organizer-added members.
		if *body.HostPlaying {
			if _, err := dbpkg.AddRegisteredParticipant(c.Request.Context(), pool, session.ID, user.ID); err != nil {
				respondError(c, http.StatusInternalServerError, "internal error")
				return
			}
		}
		c.JSON(http.StatusCreated, session)
	})

	authed.GET("/clubs/:clubId/sessions", func(c *gin.Context) {
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
		// DP-001: only owner/admin see draft sessions in the list —
		// requireMember only distinguishes owner, not admin, so this
		// fetches membership directly rather than widening that shared
		// helper's signature for every one of its other call sites.
		sessions, err := dbpkg.ListSessionsForClub(c.Request.Context(), pool, clubID, isOwnerOrAdmin(m.Role))
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, sessions)
	})

	// DP-009 Session History, the Player's own view: every Session the
	// caller has joined, across all their Clubs.
	authed.GET("/me/sessions", func(c *gin.Context) {
		user := authjwt.CurrentUser(c)
		sessions, err := dbpkg.ListJoinedSessionsForUser(c.Request.Context(), pool, user.ID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, sessions)
	})

	authed.GET("/sessions/:id", func(c *gin.Context) {
		sessionID := c.Param("id")
		_, role, ok := requireSessionAccess(c, pool, sessionID)
		if !ok {
			return
		}
		session, err := dbpkg.GetSession(c.Request.Context(), pool, sessionID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		session.ViewerRole = role
		c.JSON(http.StatusOK, session)
	})

	authed.PATCH("/sessions/:id", func(c *gin.Context) {
		sessionID := c.Param("id")
		sess, role, ok := requireSessionAccess(c, pool, sessionID)
		if !ok {
			return
		}
		if !isOwnerOrAdmin(role) {
			respondError(c, http.StatusForbidden, "only owner/admin can update this session")
			return
		}
		var body struct {
			Name                  *string         `json:"name"`
			Location              *string         `json:"location"`
			Description           *string         `json:"description"`
			Status                *string         `json:"status"`
			MaxParticipants       *int            `json:"maxParticipants"`
			DefaultMatchFormat    json.RawMessage `json:"defaultMatchFormat"`
			DefaultSingleDeuce    *bool           `json:"defaultSingleDeuce"`
			ActivityType          *string         `json:"activityType"`
			StartsAt              *time.Time      `json:"startsAt"`
			DurationMinutes       *int            `json:"durationMinutes"`
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
		// DP-001: status is now a guarded transition (draft->open->in_progress
		// ->completed, cancelled reachable from any non-terminal state), not
		// a free-form set-to-anything write — see sessionStatusTransitions.
		if body.Status != nil {
			if _, known := sessionStatusTransitions[*body.Status]; !known {
				respondError(c, http.StatusBadRequest, "invalid status")
				return
			}
			if !isValidSessionTransition(sess.Status, *body.Status) {
				respondError(c, http.StatusConflict, "cannot transition session from "+sess.Status+" to "+*body.Status)
				return
			}
		}
		if ok, errMsg := validateSkillLevelIDForUpdate(c.Request.Context(), pool, sess.Sport, body.SkillLevelMinID); !ok {
			respondError(c, http.StatusBadRequest, errMsg)
			return
		}
		if ok, errMsg := validateSkillLevelIDForUpdate(c.Request.Context(), pool, sess.Sport, body.SkillLevelMaxID); !ok {
			respondError(c, http.StatusBadRequest, errMsg)
			return
		}
		if body.SkillLevelEnforcement != nil && *body.SkillLevelEnforcement != "strict" && *body.SkillLevelEnforcement != "guidance" {
			respondError(c, http.StatusBadRequest, `skillLevelEnforcement must be "strict" or "guidance"`)
			return
		}
		if body.DurationMinutes != nil && !isValidDurationMinutes(*body.DurationMinutes) {
			respondError(c, http.StatusBadRequest, "durationMinutes must be a multiple of 60 between 60 and 1440")
			return
		}
		// Milestone 2: mirrors the create-time check above — updating a
		// Session's schedule to a past date/time isn't allowed either.
		if body.StartsAt != nil && body.StartsAt.Before(time.Now()) {
			respondError(c, http.StatusBadRequest, "startsAt cannot be in the past")
			return
		}
		priceModel, pricePerPerson, totalPrice, errMsg := validatePriceModelForUpdate(body.PriceModel, body.PricePerPerson, body.TotalPrice)
		if errMsg != "" {
			respondError(c, http.StatusBadRequest, errMsg)
			return
		}
		session, err := dbpkg.UpdateSession(c.Request.Context(), pool, sessionID, dbpkg.SessionUpdate{
			Name: body.Name, Location: body.Location, Description: body.Description, Status: body.Status,
			MaxParticipants: body.MaxParticipants, DefaultMatchFormat: body.DefaultMatchFormat, DefaultSingleDeuce: body.DefaultSingleDeuce,
			ActivityType: body.ActivityType,
			StartsAt:     body.StartsAt, DurationMinutes: body.DurationMinutes,
			SkillLevelMinID: body.SkillLevelMinID, SkillLevelMaxID: body.SkillLevelMaxID, SkillLevelEnforcement: body.SkillLevelEnforcement,
			HostPlaying:    body.HostPlaying,
			PriceModel:     priceModel,
			PricePerPerson: pricePerPerson,
			TotalPrice:     totalPrice,
		})
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, session)
	})

	// Milestone 2: "Discard" — hard-deletes a Draft Session. Draft-only by
	// design (see dbpkg.DeleteSession's doc comment) — a published Session
	// still only has Cancel as its terminal action, never a hard delete.
	authed.DELETE("/sessions/:id", func(c *gin.Context) {
		sessionID := c.Param("id")
		_, role, ok := requireSessionAccess(c, pool, sessionID)
		if !ok {
			return
		}
		if !isOwnerOrAdmin(role) {
			respondError(c, http.StatusForbidden, "only owner/admin can discard this session")
			return
		}
		if err := dbpkg.DeleteSession(c.Request.Context(), pool, sessionID); err != nil {
			if errors.Is(err, dbpkg.ErrNotFound) {
				respondError(c, http.StatusNotFound, "session not found")
				return
			}
			if errors.Is(err, dbpkg.ErrConflict) {
				respondError(c, http.StatusConflict, "only a draft session can be discarded")
				return
			}
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.Status(http.StatusNoContent)
	})

	// Where to send money for this Session (DP-012), for anyone who can see
	// it — including a Session-only participant (DP-028), who can't read
	// the Community's own /clubs/:clubId/bank-accounts.
	authed.GET("/sessions/:id/bank-accounts", func(c *gin.Context) {
		sess, _, ok := requireSessionAccess(c, pool, c.Param("id"))
		if !ok {
			return
		}
		accounts, err := dbpkg.ListClubBankAccounts(c.Request.Context(), pool, sess.ClubID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, accounts)
	})

	authed.GET("/sessions/:id/participants", func(c *gin.Context) {
		sessionID := c.Param("id")
		if _, _, ok := requireSessionAccess(c, pool, sessionID); !ok {
			return
		}
		participants, err := dbpkg.ListParticipants(c.Request.Context(), pool, sessionID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, participants)
	})

	// DP-002 Approval: this is the "request to join" action — creates a
	// 'requested' row, not an immediate join. Organizer approval
	// (ApproveParticipant) is required before the player can self check-in.
	// Strict Skill Level is enforced here, at the point of requesting —
	// not at check-in — so an ineligible player can't even ask.
	authed.POST("/sessions/:id/register", func(c *gin.Context) {
		sessionID := c.Param("id")
		sess, _, ok := requireSessionAccess(c, pool, sessionID)
		if !ok {
			return
		}
		user := authjwt.CurrentUser(c)
		if !enforceStrictSkillLevel(c, pool, sess, user.ID) {
			return
		}
		ctx := c.Request.Context()
		before, beforeErr := dbpkg.GetParticipantStatus(ctx, pool, sessionID, user.ID)
		p, err := dbpkg.RegisterParticipant(ctx, pool, sessionID, user.ID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		// DP-018 #3: a new request (or one made again after cancelling)
		// tells the Community's owner and admins; repeating a pending one
		// doesn't.
		if p.Status == "requested" && (errors.Is(beforeErr, dbpkg.ErrNotFound) || before == "cancelled") {
			if organizers, err := dbpkg.ListClubOrganizerIDs(ctx, pool, sess.ClubID); err == nil {
				notifySession(ctx, pool, notifier, sessionID, organizers, user.ID, notify.TypeSessionJoinRequest,
					"/sessions/"+sessionID+"?tab=participants", map[string]string{"name": displayNameOf(user.DisplayName, user.Username)})
			}
		}
		c.JSON(http.StatusOK, p)
	})

	// Owner/admin approves a 'requested' join request, moving it to
	// 'waitlist' — approved, but the slot isn't claimed until payment is
	// confirmed. The only path from requested to waitlist.
	authed.POST("/sessions/:id/participants/:userId/approve", func(c *gin.Context) {
		sessionID := c.Param("id")
		targetUserID := c.Param("userId")
		_, role, ok := requireSessionAccess(c, pool, sessionID)
		if !ok {
			return
		}
		if !isOwnerOrAdmin(role) {
			respondError(c, http.StatusForbidden, "only owner/admin can approve a join request")
			return
		}
		ctx := c.Request.Context()
		p, err := dbpkg.ApproveParticipant(ctx, pool, sessionID, targetUserID)
		if errors.Is(err, dbpkg.ErrNotFound) {
			respondError(c, http.StatusNotFound, "no join request from this user")
			return
		}
		if errors.Is(err, dbpkg.ErrConflict) {
			respondError(c, http.StatusConflict, "this participant is not awaiting approval")
			return
		}
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		// DP-018 #4: approved — on a paid Session, now pay to claim the
		// spot; on a free one the spot is already theirs.
		if p.Status == "registered" {
			notifySession(ctx, pool, notifier, sessionID, []string{targetUserID}, authjwt.CurrentUser(c).ID,
				notify.TypeSessionJoinApproved, "/sessions/"+sessionID, map[string]string{"claimed": "1"})
		} else {
			notifySession(ctx, pool, notifier, sessionID, []string{targetUserID}, authjwt.CurrentUser(c).ID,
				notify.TypeSessionJoinApproved, "/sessions/"+sessionID+"?tab=payment", nil)
		}
		c.JSON(http.StatusOK, p)
	})

	// Owner/admin confirms payment was received (outside the app — no
	// payment gateway) for a 'waitlist' participant, moving them to
	// 'registered'. The only path from waitlist to registered.
	authed.POST("/sessions/:id/participants/:userId/confirm-payment", func(c *gin.Context) {
		sessionID := c.Param("id")
		targetUserID := c.Param("userId")
		_, role, ok := requireSessionAccess(c, pool, sessionID)
		if !ok {
			return
		}
		if !isOwnerOrAdmin(role) {
			respondError(c, http.StatusForbidden, "only owner/admin can confirm payment")
			return
		}
		ctx := c.Request.Context()
		p, err := dbpkg.ConfirmPayment(ctx, pool, sessionID, targetUserID)
		if errors.Is(err, dbpkg.ErrNotFound) {
			respondError(c, http.StatusNotFound, "this participant is not on the waitlist")
			return
		}
		if errors.Is(err, dbpkg.ErrConflict) {
			respondError(c, http.StatusConflict, "this participant is not awaiting payment")
			return
		}
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		// DP-018 #6: the spot is claimed.
		notifySession(ctx, pool, notifier, sessionID, []string{targetUserID}, authjwt.CurrentUser(c).ID,
			notify.TypePaymentConfirmed, "/sessions/"+sessionID, nil)
		c.JSON(http.StatusOK, p)
	})

	// Milestone 5 (Session Finance) — self-service only: the caller
	// attaches a receipt to their own participant row, never someone
	// else's. Same size/content-type validation as DP-011 Chat images.
	authed.POST("/sessions/:id/receipt", func(c *gin.Context) {
		sessionID := c.Param("id")
		sess, _, ok := requireSessionAccess(c, pool, sessionID)
		if !ok {
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
		user := authjwt.CurrentUser(c)
		ctx := c.Request.Context()
		p, err := dbpkg.UploadParticipantReceipt(ctx, pool, sessionID, user.ID, decoded, body.ImageContentType)
		if errors.Is(err, dbpkg.ErrNotFound) {
			respondError(c, http.StatusNotFound, "you must have joined or requested to join this session first")
			return
		}
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		// DP-018 #5: a receipt to check.
		if organizers, err := dbpkg.ListClubOrganizerIDs(ctx, pool, sess.ClubID); err == nil {
			notifySession(ctx, pool, notifier, sessionID, organizers, user.ID, notify.TypePaymentReceipt,
				"/sessions/"+sessionID+"?tab=payment", map[string]string{"name": displayNameOf(user.DisplayName, user.Username)})
		}
		c.JSON(http.StatusOK, p)
	})

	// Deliberately narrower than every other read in this domain — only
	// the uploading participant themselves, or an owner/admin, may ever
	// fetch these bytes. Every other participant only ever sees the
	// existing session_participants.status via the normal participant
	// list (paid vs. awaiting), never this image.
	authed.GET("/sessions/:id/participants/:participantId/receipt", func(c *gin.Context) {
		sessionID := c.Param("id")
		_, role, ok := requireSessionAccess(c, pool, sessionID)
		if !ok {
			return
		}
		img, ownerUserID, err := dbpkg.GetParticipantReceiptImage(c.Request.Context(), pool, sessionID, c.Param("participantId"))
		if errors.Is(err, dbpkg.ErrNotFound) {
			respondError(c, http.StatusNotFound, "receipt not found")
			return
		}
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		user := authjwt.CurrentUser(c)
		isSelf := ownerUserID != nil && *ownerUserID == user.ID
		if !isOwnerOrAdmin(role) && !isSelf {
			respondError(c, http.StatusForbidden, "you can only view your own payment receipt")
			return
		}
		c.Header("Cache-Control", "private, max-age=31536000, immutable")
		c.Data(http.StatusOK, img.ContentType, img.Data)
	})

	// Owner/admin removes a participant entirely (e.g. declining a join
	// request, or removing someone outright) — a hard delete, unlike
	// Cancel/NoShow which record what happened. The path param accepts
	// either a member's user_id or a guest's own participant row id —
	// db.DeleteParticipant matches on either column, since guests have no
	// user_id (Milestone 2: the "×" remove badge on a guest's avatar in
	// SessionDetailScreen passes the participant's own id here).
	authed.DELETE("/sessions/:id/participants/:userId", func(c *gin.Context) {
		sessionID := c.Param("id")
		targetID := c.Param("userId")
		_, role, ok := requireSessionAccess(c, pool, sessionID)
		if !ok {
			return
		}
		if !isOwnerOrAdmin(role) {
			respondError(c, http.StatusForbidden, "only owner/admin can remove a participant")
			return
		}
		if err := dbpkg.DeleteParticipant(c.Request.Context(), pool, sessionID, targetID); err != nil {
			if errors.Is(err, dbpkg.ErrNotFound) {
				respondError(c, http.StatusNotFound, "participant not found")
				return
			}
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.Status(http.StatusNoContent)
	})

	// DP-002 Approval: self check-in requires the caller already be
	// 'registered' (approved) — SelfCheckIn never upserts/auto-registers,
	// unlike CheckIn (the organizer-override path used elsewhere). Strict
	// Skill Level is not re-checked here — it already gated the original
	// join request at /register.
	authed.POST("/sessions/:id/checkin", func(c *gin.Context) {
		sessionID := c.Param("id")
		sess, _, ok := requireSessionAccess(c, pool, sessionID)
		if !ok {
			return
		}
		if !checkInWindowOpen(sess.StartsAt, sess.DurationMinutes, time.Now()) {
			respondError(c, http.StatusForbidden, "check-in is only available from 1 hour before the session starts until it ends")
			return
		}
		user := authjwt.CurrentUser(c)
		p, err := dbpkg.SelfCheckIn(c.Request.Context(), pool, sessionID, user.ID)
		if errors.Is(err, dbpkg.ErrNotFound) {
			respondError(c, http.StatusNotFound, "request to join before checking in")
			return
		}
		if errors.Is(err, dbpkg.ErrConflict) {
			respondError(c, http.StatusConflict, "your join request hasn't been approved yet")
			return
		}
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, p)
	})

	// Milestone 2 (revised): organizer adds an existing club member
	// directly to the roster as 'registered' — used by
	// SessionDetailScreen's participant-placeholder "Member" option.
	// Deliberately available any time the Session is published (unlike
	// /checkin below, no checkInWindowOpen gate — this is roster-building,
	// not a check-in action). Strict Skill Level is deliberately NOT
	// enforced here — an organizer manually adding a specific member is a
	// deliberate decision, same trust already extended to Host Playing's
	// own auto-check-in bypass (DP-004).
	authed.POST("/sessions/:id/participants/:userId/add", func(c *gin.Context) {
		sessionID := c.Param("id")
		targetUserID := c.Param("userId")
		_, role, ok := requireSessionAccess(c, pool, sessionID)
		if !ok {
			return
		}
		if !isOwnerOrAdmin(role) {
			respondError(c, http.StatusForbidden, "only owner/admin can add a participant")
			return
		}
		p, err := dbpkg.AddRegisteredParticipant(c.Request.Context(), pool, sessionID, targetUserID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, p)
	})

	// Milestone 2 (revised): checks in an already-'registered' participant
	// (member or guest) by their own participant row id — the only action
	// that actually moves someone to 'checked_in', separate from adding
	// them to the roster. Keyed by row id rather than user_id (unlike the
	// old organizer-override db.CheckIn upsert this replaces) so it works
	// uniformly for guests too, which have no user_id. Strict Skill Level
	// is not re-checked here — same as self-check-in, it was already
	// enforced at the "join" moment (self-request, or here it's an
	// organizer's own manual add, which deliberately bypasses it, DP-004).
	authed.POST("/sessions/:id/checkin/:participantId", func(c *gin.Context) {
		sessionID := c.Param("id")
		participantID := c.Param("participantId")
		sess, role, ok := requireSessionAccess(c, pool, sessionID)
		if !ok {
			return
		}
		if !isOwnerOrAdmin(role) {
			respondError(c, http.StatusForbidden, "only owner/admin can check in a participant")
			return
		}
		if !checkInWindowOpen(sess.StartsAt, sess.DurationMinutes, time.Now()) {
			respondError(c, http.StatusForbidden, "check-in is only available from 1 hour before the session starts until it ends")
			return
		}
		p, err := dbpkg.CheckInParticipantByID(c.Request.Context(), pool, sessionID, participantID)
		if errors.Is(err, dbpkg.ErrNotFound) {
			respondError(c, http.StatusNotFound, "participant not found")
			return
		}
		if errors.Is(err, dbpkg.ErrConflict) {
			respondError(c, http.StatusConflict, "this participant is not registered")
			return
		}
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, p)
	})

	// DP-002: self-service, mirrors /checkin's existing shape exactly (acts
	// on the caller, no userId in the path). Owner/admin managing another
	// participant's checkout/cancellation on their behalf is not built here
	// — deferred until a screen actually needs it (DP-006).
	authed.POST("/sessions/:id/checkout", func(c *gin.Context) {
		sessionID := c.Param("id")
		if _, _, ok := requireSessionAccess(c, pool, sessionID); !ok {
			return
		}
		user := authjwt.CurrentUser(c)
		p, err := dbpkg.CheckOut(c.Request.Context(), pool, sessionID, user.ID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, p)
	})

	authed.POST("/sessions/:id/cancel", func(c *gin.Context) {
		sessionID := c.Param("id")
		if _, _, ok := requireSessionAccess(c, pool, sessionID); !ok {
			return
		}
		user := authjwt.CurrentUser(c)
		p, err := dbpkg.CancelParticipant(c.Request.Context(), pool, sessionID, user.ID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, p)
	})

	// DP-002: marking someone else absent is inherently an organizer
	// action, not self-service — owner/admin only, unlike checkout/cancel.
	authed.POST("/sessions/:id/participants/:userId/no-show", func(c *gin.Context) {
		sessionID := c.Param("id")
		targetUserID := c.Param("userId")
		_, role, ok := requireSessionAccess(c, pool, sessionID)
		if !ok {
			return
		}
		if !isOwnerOrAdmin(role) {
			respondError(c, http.StatusForbidden, "only owner/admin can mark a participant as no-show")
			return
		}
		p, err := dbpkg.MarkNoShow(c.Request.Context(), pool, sessionID, targetUserID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, p)
	})

	// Milestone 2 (revised): a guest is added directly as 'registered'
	// (AddGuestParticipant) — roster-building, not a check-in action, so
	// no checkInWindowOpen gate (mirrors the member-add route above).
	// Checking them in is the separate /checkin/:participantId action.
	authed.POST("/sessions/:id/participants", func(c *gin.Context) {
		sessionID := c.Param("id")
		_, role, ok := requireSessionAccess(c, pool, sessionID)
		if !ok {
			return
		}
		if !isOwnerOrAdmin(role) {
			respondError(c, http.StatusForbidden, "only owner/admin can add a guest")
			return
		}
		var body struct {
			GuestName string `json:"guestName"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.GuestName == "" {
			respondError(c, http.StatusBadRequest, "guestName is required")
			return
		}
		p, err := dbpkg.AddGuestParticipant(c.Request.Context(), pool, sessionID, body.GuestName)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusCreated, p)
	})

	// DP-011 Session Chat: same access as viewing the Session itself
	// (requireSessionAccess) — deliberately not narrowed to "participants
	// only," since a member asking "can I still join?" needs to post
	// before they've joined.
	// Session Chat (DP-011) and Contact Organizer (DP-013) share one
	// engine (conversations/conversation_messages) — per product
	// direction, the only real differences are participants (everyone who
	// can see the Session, vs. one member + owner/admins) and whether a
	// posting window applies (Chat closes 1 week after the Session ends;
	// Contact Organizer never does).
	authed.GET("/sessions/:id/messages", func(c *gin.Context) {
		sessionID := c.Param("id")
		if _, _, ok := requireSessionAccess(c, pool, sessionID); !ok {
			return
		}
		messages, err := listConversation(c, pool, models.ConversationKindSessionChat, sessionID, nil)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, messages)
	})

	authed.POST("/sessions/:id/messages", func(c *gin.Context) {
		sessionID := c.Param("id")
		sess, _, ok := requireSessionAccess(c, pool, sessionID)
		if !ok {
			return
		}
		if !sessionChatWindowOpen(sess.StartsAt, sess.DurationMinutes, time.Now()) {
			respondError(c, http.StatusForbidden, "chat is read-only more than a week after the session")
			return
		}
		trimmed, imageData, imageContentType, ok := parseConversationMessageBody(c)
		if !ok {
			return
		}
		user := authjwt.CurrentUser(c)
		message, err := postConversationMessage(c, pool, models.ConversationKindSessionChat, sessionID, nil, user.ID, trimmed, imageData, imageContentType)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		msgs.announce(c.Request.Context(), user, message)
		c.JSON(http.StatusCreated, message)
	})

	// Contact Organizer (DP-013) — a private, two-way thread scoped to
	// (session, member), distinct from the group Session Chat above. The
	// member (memberUserID == caller) always starts/continues their own
	// thread; only an owner/admin may reply into someone else's. No
	// posting-window restriction — unlike Chat, a Contact Organizer
	// thread never closes.
	authed.GET("/sessions/:id/contact/:userId", func(c *gin.Context) {
		sessionID := c.Param("id")
		memberUserID := c.Param("userId")
		_, role, ok := requireSessionAccess(c, pool, sessionID)
		if !ok {
			return
		}
		user := authjwt.CurrentUser(c)
		if user.ID != memberUserID && !isOwnerOrAdmin(role) {
			respondError(c, http.StatusForbidden, "you can only view your own thread with the organizer")
			return
		}
		messages, err := listConversation(c, pool, models.ConversationKindSessionContact, sessionID, &memberUserID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, messages)
	})

	authed.POST("/sessions/:id/contact/:userId", func(c *gin.Context) {
		sessionID := c.Param("id")
		memberUserID := c.Param("userId")
		_, role, ok := requireSessionAccess(c, pool, sessionID)
		if !ok {
			return
		}
		user := authjwt.CurrentUser(c)
		if user.ID != memberUserID && !isOwnerOrAdmin(role) {
			respondError(c, http.StatusForbidden, "you can only message your own thread with the organizer")
			return
		}
		trimmed, imageData, imageContentType, ok := parseConversationMessageBody(c)
		if !ok {
			return
		}
		message, err := postConversationMessage(c, pool, models.ConversationKindSessionContact, sessionID, &memberUserID, user.ID, trimmed, imageData, imageContentType)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		msgs.announce(c.Request.Context(), user, message)
		c.JSON(http.StatusCreated, message)
	})

	// Owner/admin only — the organizer's per-Session list of who has
	// messaged them, most-recently-active first.
	authed.GET("/sessions/:id/contact", func(c *gin.Context) {
		sessionID := c.Param("id")
		_, role, ok := requireSessionAccess(c, pool, sessionID)
		if !ok {
			return
		}
		if !isOwnerOrAdmin(role) {
			respondError(c, http.StatusForbidden, "only owner/admin can view this session's contact threads")
			return
		}
		threads, err := dbpkg.ListSessionContactThreads(c.Request.Context(), pool, sessionID, authjwt.CurrentUser(c).ID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		c.JSON(http.StatusOK, threads)
	})

	// Shared by both Chat and Contact Organizer images — served one at a
	// time, never listed alongside a message itself (see
	// ConversationMessage.HasImage's doc comment for why). Cache-Control
	// is safe to set aggressively: a message's image never changes once
	// posted (no editing). A session_contact image gets the same narrower
	// access check the thread's own messages get; a session_chat image
	// only needs requireSessionAccess, already checked above.
	authed.GET("/sessions/:id/conversation-messages/:messageId/image", func(c *gin.Context) {
		sessionID := c.Param("id")
		_, role, ok := requireSessionAccess(c, pool, sessionID)
		if !ok {
			return
		}
		img, conv, err := dbpkg.GetConversationMessageImage(c.Request.Context(), pool, sessionID, c.Param("messageId"))
		if errors.Is(err, dbpkg.ErrNotFound) {
			respondError(c, http.StatusNotFound, "image not found")
			return
		}
		if err != nil {
			respondError(c, http.StatusInternalServerError, "internal error")
			return
		}
		if conv.Kind == models.ConversationKindSessionContact {
			user := authjwt.CurrentUser(c)
			if conv.MemberUserID == nil || (*conv.MemberUserID != user.ID && !isOwnerOrAdmin(role)) {
				respondError(c, http.StatusForbidden, "you can only view images from your own thread with the organizer")
				return
			}
		}
		c.Header("Cache-Control", "private, max-age=31536000, immutable")
		c.Data(http.StatusOK, img.ContentType, img.Data)
	})
}

// listConversation resolves a conversation for (kind, sessionID,
// memberUserID) and lists its messages — an empty slice, not an error, if
// no conversation exists yet (nobody has posted).
func listConversation(c *gin.Context, pool *pgxpool.Pool, kind, sessionID string, memberUserID *string) ([]models.ConversationMessage, error) {
	conv, err := dbpkg.GetConversation(c.Request.Context(), pool, kind, sessionID, memberUserID)
	if errors.Is(err, dbpkg.ErrNotFound) {
		return []models.ConversationMessage{}, nil
	}
	if err != nil {
		return nil, err
	}
	return dbpkg.ListConversationMessages(c.Request.Context(), pool, conv.ID, authjwt.CurrentUser(c).ID)
}

// postConversationMessage lazily creates the conversation on first use,
// then inserts the message.
func postConversationMessage(
	c *gin.Context, pool *pgxpool.Pool, kind, sessionID string, memberUserID *string,
	senderID, body string, imageData []byte, imageContentType *string,
) (models.ConversationMessage, error) {
	conv, err := dbpkg.GetOrCreateConversation(c.Request.Context(), pool, kind, sessionID, memberUserID)
	if err != nil {
		return models.ConversationMessage{}, err
	}
	return dbpkg.CreateConversationMessage(c.Request.Context(), pool, dbpkg.CreateConversationMessageParams{
		ConversationID: conv.ID, SenderID: senderID, Body: body, ImageData: imageData, ImageContentType: imageContentType,
	})
}

// parseConversationMessageBody validates a Chat/Contact-message POST
// body — shared by both since they're the same engine now. Returns the
// trimmed text and decoded image (each individually optional, but at
// least one is required).
func parseConversationMessageBody(c *gin.Context) (body string, imageData []byte, imageContentType *string, ok bool) {
	// Caps the whole request body, not just the decoded image — a
	// generous margin over maxImageBytes' own base64 expansion (~4/3)
	// plus JSON overhead, so a malicious/broken client can't force the
	// server to buffer an unbounded body before ShouldBindJSON even gets
	// to look at it.
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxImagePostBytes)
	var req struct {
		Body             string  `json:"body"`
		ImageBase64      string  `json:"imageBase64"`
		ImageContentType *string `json:"imageContentType"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "invalid body, or image too large")
		return "", nil, nil, false
	}
	trimmed := strings.TrimSpace(req.Body)
	if len(trimmed) > 2000 {
		respondError(c, http.StatusBadRequest, "body must be 2000 characters or fewer")
		return "", nil, nil, false
	}
	if req.ImageBase64 != "" {
		if req.ImageContentType == nil || !isAllowedImageContentType(*req.ImageContentType) {
			respondError(c, http.StatusBadRequest, "imageContentType must be image/jpeg, image/png, or image/webp")
			return "", nil, nil, false
		}
		decoded, err := base64.StdEncoding.DecodeString(req.ImageBase64)
		if err != nil {
			respondError(c, http.StatusBadRequest, "imageBase64 is not valid base64")
			return "", nil, nil, false
		}
		if len(decoded) == 0 || len(decoded) > maxImageBytes {
			respondError(c, http.StatusBadRequest, "image must be non-empty and 5MB or smaller")
			return "", nil, nil, false
		}
		imageData = decoded
		imageContentType = req.ImageContentType
	}
	if trimmed == "" && imageData == nil {
		respondError(c, http.StatusBadRequest, "body or image is required")
		return "", nil, nil, false
	}
	return trimmed, imageData, imageContentType, true
}
