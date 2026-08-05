# API (Current)

Base path `/v1`, plus an unversioned `/healthz`. All request/response
bodies are JSON. Auth column: **none** = no auth; **auth** =
`RequireAuth` only (valid Firebase ID token, Postgres profile not
required); **profile** = `RequireAuth` + `RequireProfile` (Postgres
user row must exist).

CORS: `Access-Control-Allow-Origin` is a single configured value
(`ALLOWED_ORIGINS` env var), methods `GET, POST, PATCH, DELETE, OPTIONS`.

## Health

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/healthz` | none | `{"status":"ok"}` |

## Users

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/v1/users/check-username?username=` | none | `{available, reason?}`. Invalid format (not `^[a-z0-9_]{3,20}$`) returns `available:false, reason:"invalid_format"` rather than 400. |
| POST | `/v1/users` | auth | Body `{username, displayName?}`. Creates the Postgres profile. 409 if a profile already exists for this Firebase UID, 409 if username taken (only error mapping — `CreateUser`'s error isn't distinguished further). |
| GET | `/v1/me` | auth | 404 `{"error":"profile not found","code":"PROFILE_NOT_FOUND"}` if no profile yet. |
| PATCH | `/v1/me` | profile | Body `{displayName?, email?, phoneNumber?, avatarUrl?}`. `username` is immutable — not accepted here. |

## Clubs

| Method | Path | Auth | Extra check | Notes |
|---|---|---|---|---|
| POST | `/v1/clubs` | profile | — | Body `{name, description?}`. Caller becomes `owner`. |
| GET | `/v1/clubs` | profile | — | Lists clubs the caller is a member of, with role, ordered by `created_at DESC`. |
| POST | `/v1/clubs/join` | profile | — | Body `{inviteCode}`. Idempotent — already-a-member returns the club without error. |
| GET | `/v1/clubs/:clubId` | profile | member | |
| PATCH | `/v1/clubs/:clubId` | profile | owner | Body `{name?, description?}`. |
| DELETE | `/v1/clubs/:clubId` | profile | owner | Cascades `club_members`, `sessions`, etc. via FK. |
| POST | `/v1/clubs/:clubId/invite-code/regenerate` | profile | owner | |
| GET | `/v1/clubs/:clubId/members` | profile | member | |
| POST | `/v1/clubs/:clubId/members` | profile | owner | Body `{username}`. Direct-add, no invite flow. 404 if username not found, 409 if already a member. |
| PATCH | `/v1/clubs/:clubId/members/:userId` | profile | owner | Body `{role}` — `"member"` or `"admin"` only; cannot set/unset `"owner"` here. |
| DELETE | `/v1/clubs/:clubId/members/:userId` | profile | owner, or self | Removing the sole remaining owner returns 409. |

## Sessions

| Method | Path | Auth | Extra check | Notes |
|---|---|---|---|---|
| POST | `/v1/clubs/:clubId/sessions` | profile | owner/admin of club | Body `{sport, name, location, activityType, startsAt, durationMinutes, hostPlaying, skillLevelMinId?, skillLevelMaxId?, skillLevelEnforcement?, description?, courtCount?, maxParticipants?, defaultMatchFormat?}`. `sport`/`name`/`location`/`activityType`/`startsAt`/`durationMinutes`/`hostPlaying` are **mandatory** — 400 if any is missing (no more server-side auto-generated name fallback). `durationMinutes` must be a multiple of 60 between 60 and 1440 (1-24 hours) — 400 otherwise. `description` and `maxParticipants` are always optional. `hostPlaying` (DP-004): if `true`, the creator is auto-checked-in as a participant right after the Session is created — via `db.CheckIn` directly, so it bypasses the Strict Skill Level gate (`enforceStrictSkillLevel`) that a normal `/checkin` call goes through. `activityType` (opaque, Sport-Module-owned, e.g. tennis `single`/`double`/`class`) is distinct from `defaultMatchFormat`, which seeds a match's *scoring* format, not this — no screen sets `defaultMatchFormat` yet. `startsAt`+`durationMinutes` (DP-009) are core Session properties, required together. `skillLevel*` (DP-008, **optional as of v0.7.0**) — `validateSkillLevelRange` allows all three unset (no requirement), but if any one is set, all three must be, 400 if partial or if the two ids don't resolve to real levels of `sport`'s own scale with `min.rank <= max.rank`. |
| GET | `/v1/clubs/:clubId/sessions` | profile | member | DP-001: `draft` sessions excluded from the list unless the caller is owner/admin of the club. As of v0.6.3, each Session includes a computed `joinedCount` (DP-002 headcount: `registered`+`checked_in`+`checked_out`, via `db.CountJoinedParticipants` — one batched query, not N+1). |
| GET | `/v1/sessions/:id` | profile | member of parent club | Also includes computed `joinedCount`, same definition as the list endpoint. |
| PATCH | `/v1/sessions/:id` | profile | owner/admin | Body `{name?, location?, description?, status?, maxParticipants?, defaultMatchFormat?, activityType?, startsAt?, durationMinutes?, skillLevelMinId?, skillLevelMaxId?, skillLevelEnforcement?, hostPlaying?}`. `status` is now a guarded transition — `draft→open→in_progress→completed`, `cancelled` reachable from any non-terminal state — 409 if the transition from the session's current status isn't allowed, not just a flat set of valid strings (the DP-009 auto-transition job bypasses this guard entirely, see below). `publishSession`/`startSession`/`completeSession`/`cancelSession` in `core/sessions/api.ts` are named wrappers over this same endpoint, not separate routes. All fields here are independent partial updates (unlike `POST`'s all-or-nothing mandate) — each `skillLevel*` id just needs to belong to the session's sport; `durationMinutes`, if set, is still bound-checked (multiple of 60, 60-1440). `hostPlaying`, if set, is a plain value write — no auto-checkin side effect on PATCH, unlike POST. |
| GET | `/v1/sessions/:id/participants` | profile | member | |
| POST | `/v1/sessions/:id/register` | profile | member | As of v0.10.0 (DP-002 Join Approval): this is the **"request to join" action** — creates a `requested` row, idempotent (no-op if a row already exists in any status). Has a real screen now (`SessionDetailScreen`'s "Request to Join"). Strict Skill Level (`enforceStrictSkillLevel`) is enforced here — an ineligible member can't even request. |
| POST | `/v1/sessions/:id/participants/:userId/approve` | profile | owner/admin | As of v0.10.0. Moves a `requested` row to `waitlist` (approved, not yet claimed). 409 if not currently `requested`, 404 if no row. |
| POST | `/v1/sessions/:id/participants/:userId/confirm-payment` | profile | owner/admin | As of v0.10.0. Moves a `waitlist` row to `registered` (slot claimed). No payment gateway — this just records that the organizer received payment outside the app. 409 if not currently `waitlist`, 404 if no row. |
| DELETE | `/v1/sessions/:id/participants/:userId` | profile | owner/admin | As of v0.10.0. Hard-removes a participant row entirely (e.g. declining a request, or removing someone outright) — distinct from Cancel/NoShow, which record what happened. 404 if no row. |
| POST | `/v1/sessions/:id/checkin` | profile | member | As of v0.10.0: no longer upserts/auto-registers — requires the caller already be `registered` (`db.SelfCheckIn`, a guarded transition; 409 if not `registered`, 404 if no row at all). Strict Skill Level is **not** re-checked here anymore — it's enforced at `/register` instead. Still gated by the Check-In Window (v0.9.0): 403 unless `now` is within `[startsAt - 1h, startsAt + durationMinutes)` — `checkInWindowOpen` in `sessions_handler.go`; no-op (unrestricted) for Sessions missing `startsAt`/`durationMinutes`. |
| POST | `/v1/sessions/:id/participants/:userId/checkin` | profile | owner/admin | As of v0.8.3. Host-initiated check-in for another club member (e.g. a walk-in without the app) — uses `db.CheckIn`, the **organizer-override** upsert that bypasses Requested/Waitlist entirely (same function Host Playing and guest-add use), same Check-In Window gate. Called by `SessionDetailScreen`'s "Check in a member." |
| POST | `/v1/sessions/:id/checkout` | profile | member | Self-service, mirrors `/checkin`'s shape. DP-002. No screen calls this yet — API only. |
| POST | `/v1/sessions/:id/cancel` | profile | member | Self-service. DP-002. No screen calls this yet — API only. |
| POST | `/v1/sessions/:id/participants/:userId/no-show` | profile | owner/admin | Marks another participant `no_show` — not self-service, unlike checkout/cancel. DP-002. No screen calls this yet — API only. |
| POST | `/v1/sessions/:id/participants` | profile | owner/admin | Body `{guestName}`. Adds a guest directly as `checked_in` (via `db.AddGuestParticipant`, bypasses Requested/Waitlist same as `db.CheckIn`) — also gated by the Check-In Window (a guest add is a check-in action, v0.9.0). |

`session_participants.status` now also accepts `checked_out`/`cancelled`/`no_show` alongside the original `registered`/`checked_in`, plus `requested`/`waitlist` (v0.10.0, DP-002 Join Approval) — see `lifecycle-session.md`. `participated` was dropped (never set by any code path).

**DP-009 auto-transition** (no endpoint — a background process, `internal/scheduling.AutoTransitionElapsedSessions`, riding the same ticker as DP-007 generation): once `starts_at + duration_minutes` has passed, a Session still `in_progress` is set to `completed`; any other non-terminal Session (never started) is set to `cancelled`. Writes directly via `db.SetSessionStatus`, bypassing `sessionStatusTransitions` — that guard is for organizer-initiated PATCH calls only.

## Activities

| Method | Path | Auth | Extra check | Notes |
|---|---|---|---|---|
| POST | `/v1/sessions/:id/activities` | profile | owner/admin | Body `{config, participants: [{userId\|guestName, team?}]}`. Creates a `queued` activity. `config`/`result` are opaque JSON, not validated server-side. |
| GET | `/v1/sessions/:id/activities` | profile | member | Ordered live → queued → completed, then `created_at ASC` within each. |
| GET | `/v1/activities/:id` | profile | member of parent club | Returns `ActivityDetail` (activity + participants). |
| POST | `/v1/activities/:id/start` | profile | checked-in participant of *this activity* | `queued → live`. Sets `scorer_user_id` = caller, `started_at` = now. 409 if not currently `queued`. |
| POST | `/v1/activities/:id/complete` | profile | current scorer only | Body `{result, pointLog?}`. `live → completed`. 403 if caller isn't `scorer_user_id`. 409 if not currently `live`. |
| DELETE | `/v1/activities/:id` | profile | owner/admin | As of v0.8.0. Only a `queued` match can be deleted — 409 otherwise (`db.DeleteActivity`). Used by the client's Regenerate-matches flow (`AddMatchScreen`/`SessionDetailScreen`), which deletes every currently queued match before generating a fresh fair round; not exposed as a standalone "delete this match" action anywhere in the UI yet. |

Not implemented: activity edit while queued (`PATCH /v1/activities/:id`),
auto-generation as a standalone endpoint (match generation instead
happens client-side — see DP-005's Match Generation — by calling the
existing `POST /v1/sessions/:id/activities` once per generated match),
scorer transfer.

## Skill Levels (DP-008)

The Level Scale is owned by the Sport Module (DP-ARCH-002) and scoped per
sport — Tennis is the only seeded sport today (`newbie` through
`advanced`). Data in `skill_levels`, not a fixed enum — adding/renaming/
reordering a sport's scale is a row change, no migration.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/v1/skill-levels?sport=` | profile | The ordered scale for one sport, lowest rank first. 400 if `sport` is omitted. |
| GET | `/v1/me/skill-levels` | profile | The caller's self-reported level for every sport they've set one for. |
| PUT | `/v1/me/skill-levels/:sport` | profile | Body `{skillLevelId}`. Self-reported only — no organizer/admin override exists anywhere. Upserts; 400 if `skillLevelId` doesn't exist or belongs to a different sport. |

## Recurring Schedules (DP-007, Milestone D.1)

Organizer-only management surface (owner/admin of the parent club — unlike
Sessions, there's no member-visible view of a Recurring Schedule itself,
only of the Sessions it generates).

| Method | Path | Auth | Extra check | Notes |
|---|---|---|---|---|
| POST | `/v1/clubs/:clubId/recurring-schedules` | profile | owner/admin | Body `{sport, name, location, activityType, recurrenceRule, generationLeadDays, hostPlaying, skillLevelMinId?, skillLevelMaxId?, skillLevelEnforcement?, description?, courtCount?, maxParticipants?, defaultMatchFormat?, generationTime?, endDate?}`. `recurrenceRule` is `{weekday, time, durationMinutes, timezone}` — weekly-only shape, an engineering default, not product-specified; `durationMinutes` must be a multiple of 60 between 60 and 1440 (1-24 hours, v0.6.0) — 400 otherwise. `name`/`location`/`activityType`/`hostPlaying` are mandatory, same as Sessions' own `POST`; the Skill Level range is optional but all-or-nothing (v0.7.0), same rule as Sessions — whichever fields are set are copied onto every generated Session. `hostPlaying` (v0.6.1): if `true`, the Schedule's creator is auto-checked-in on every generated Session, same bypass-Strict-Skill-Level behavior as ad-hoc creation. |
| GET | `/v1/clubs/:clubId/recurring-schedules` | profile | owner/admin | |
| GET | `/v1/clubs/:clubId/recurring-schedules/:id` | profile | owner/admin | 404 if the schedule doesn't belong to `:clubId`. |
| PATCH | `/v1/clubs/:clubId/recurring-schedules/:id` | profile | owner/admin | Same body shape as create, all fields optional. Template/Recurrence Rule/Generation Policy/end date only — **no synchronization to already-generated Sessions** (Milestone D.2, blocked pending product decisions — see `docs/AKSI_PRODUCT_DECISIONS.md` DP-007). |
| POST | `/v1/clubs/:clubId/recurring-schedules/:id/pause` | profile | owner/admin | Stops future generation; existing Sessions unchanged. |
| POST | `/v1/clubs/:clubId/recurring-schedules/:id/resume` | profile | owner/admin | |
| DELETE | `/v1/clubs/:clubId/recurring-schedules/:id` | profile | owner/admin | Preserves all generated Sessions — `sessions.recurring_schedule_id` is `ON DELETE SET NULL`. |
| POST | `/v1/clubs/:clubId/recurring-schedules/:id/occurrences/skip` | profile | owner/admin | Body `{occurrenceStartsAt}`. Unifies "skip a future occurrence" and "delete an already-generated Session for this occurrence" into one idempotent operation — writes a tombstone (`recurring_schedule_skips`) and deletes any matching generated Session. |
| POST | `/v1/clubs/:clubId/recurring-schedules/:id/occurrences/generate` | profile | owner/admin | Body `{occurrenceStartsAt}`. Manual override of the automatic ticker — generates this specific occurrence immediately, bypassing the Generation Policy's lead-time gate. 400 if `occurrenceStartsAt` isn't a real occurrence of the Schedule's Recurrence Rule, 409 if it was already skipped, idempotent (returns the existing Session) if already generated. |
| GET | `/v1/clubs/:clubId/recurring-schedules/:id/occurrences?from=&to=` | profile | owner/admin | Preview only, computed from the Recurrence Rule, not stored. Each entry: `{startsAt, status: "pending"\|"generated"\|"skipped"}`. Defaults to the next 8 weeks from now. |

Generation itself has no endpoint — it's a background process
(`internal/scheduling.GenerateDueSessions`), ticking on an in-process
timer (`RECURRING_SCHEDULE_GENERATION_INTERVAL_MINUTES`, default 15) in
`cmd/api/main.go`. See `lifecycle-recurring-schedule.md`.

## Error shape

All errors: `{"error": "<message>"}`, sometimes with a `code` field
(only `PROFILE_NOT_FOUND` currently uses this). No structured
validation-error format — bad input is a flat 400 with a short string.
