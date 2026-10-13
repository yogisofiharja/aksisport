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
| PATCH | `/v1/me` | profile | Body `{displayName?, email?, phoneNumber?, avatarUrl?}`. `username` is immutable — not accepted here. `avatarUrl` is a stale, never-wired string-URL stub — see the note under "Profile pictures" below; the real path is `POST /v1/me/avatar`. |
| POST | `/v1/me/avatar` | profile | Body `{imageBase64, imageContentType}`. Self-service only — always the caller's own picture. Same size/content-type validation as every other image upload (5MB decoded cap, JPEG/PNG/WebP only). |
| GET | `/v1/users/:userId/avatar` | profile | Serves the raw image bytes. Visible to any authenticated user with a profile — same broad visibility as the username/displayName it's paired with everywhere (search, member grids, organizer names), not scoped to a shared Club. 404 if the user has no picture. |
| GET | `/v1/me/contact-threads` | profile | DP-013 Contact Organizer's Inbox listing. See the "Conversations" subsection under Sessions below for the full shape. |
| GET | `/v1/users/search?q=` | profile | Case-insensitive substring match on `username` or `display_name`, excludes the caller, capped at 20 results ordered by `username`. Returns `[]` for `q` under 2 characters rather than erroring (avoids a near-full-table scan on a 0-1 char query). Response is the lean `UserSummary` shape (`id`/`username`/`displayName`/`hasAvatar`/`isOnline`) — unlike every other `/users`/`/me` route here, this never includes `email`/`phoneNumber`, since the caller is looking up *someone else*. Not club-scoped — `ClubMembersScreen`'s Add Member dialog filters out existing members client-side, since it already has that list loaded. |

### Profile pictures

Club and User both carry a real, working profile picture now — stored
directly in Postgres (`bytea`), same pattern as DP-011 Chat images and
Milestone 5 receipts (no object storage/CDN provisioned anywhere in
this app). A list/get response never embeds the bytes, only a computed
`hasAvatar` boolean; the actual image is fetched separately through its
own authenticated endpoint (`GET .../avatar`), same reasoning as
`hasReceipt`/receipt images — a polled or frequently-refetched list
response should never re-transfer image bytes for a picture already on
screen. `User.avatarUrl` / `ClubMember.avatarUrl` / `Club` having no
`avatarUrl` at all are leftovers from an earlier, never-wired
string-URL stub (nothing ever set or read it through a real upload
path) — left in place, unused, rather than ripped out as part of this
change.

### Online indicator (DP-014)

`User`/`UserSummary`/`ClubMember` all carry a computed `isOnline` bool
— `(last_active_at IS NOT NULL AND last_active_at > now() - interval
'2 minutes')`, `isOnlineExpr` in `internal/db/users.go`. No push/
websocket presence exists anywhere in this app: `last_active_at` is
stamped by `authjwt.RequireProfile` on every authenticated request,
fire-and-forget in a goroutine so it never adds latency to the request
it's riding on. 2 minutes is an engineering choice, not a persisted
online/offline state — there's no explicit "went offline" event, it
just ages out.

## Clubs

| Method | Path | Auth | Extra check | Notes |
|---|---|---|---|---|
| POST | `/v1/clubs` | profile | — | Body `{name, description?}`. Caller becomes `owner`. |
| GET | `/v1/clubs` | profile | — | Lists clubs the caller is a member of, with role, ordered by `created_at DESC`. |
| GET | `/v1/clubs/:clubId` | profile | member | |
| PATCH | `/v1/clubs/:clubId` | profile | owner | Body `{name?, description?}`. |
| DELETE | `/v1/clubs/:clubId` | profile | owner | Cascades `club_members`, `sessions`, etc. via FK. |
| POST | `/v1/clubs/:clubId/avatar` | profile | owner | Body `{imageBase64, imageContentType}`. Same size/content-type validation as every other image upload. See "Profile pictures" below. |
| GET | `/v1/clubs/:clubId/avatar` | profile | member | Serves the raw image bytes. 404 if the Club has no picture. |
| GET | `/v1/clubs/:clubId/members` | profile | member | |
| POST | `/v1/clubs/:clubId/members` | profile | owner | Body `{username}`. Direct-add, no invite flow. 404 if username not found, 409 if already a member. |
| PATCH | `/v1/clubs/:clubId/members/:userId` | profile | owner | Body `{role}` — `"member"` or `"admin"` only; cannot set/unset `"owner"` here. |
| DELETE | `/v1/clubs/:clubId/members/:userId` | profile | owner, or self | Removing the sole remaining owner returns 409. |
| GET | `/v1/clubs/:clubId/bank-accounts` | profile | member | Milestone 5. Oldest-first. A Club can list more than one. |
| POST | `/v1/clubs/:clubId/bank-accounts` | profile | owner | Milestone 5. Body `{bankName, accountNumber, accountName}`, all required (400 if any is empty). |
| PATCH | `/v1/clubs/:clubId/bank-accounts/:accountId` | profile | owner | Milestone 5. Body `{bankName?, accountNumber?, accountName?}`, `COALESCE`-based partial update. 404 if the account doesn't belong to `:clubId`. |
| DELETE | `/v1/clubs/:clubId/bank-accounts/:accountId` | profile | owner | Milestone 5. 404 if the account doesn't belong to `:clubId`. |

Joining a Club by invite code — `POST /v1/clubs/join`, plus the owner-
facing `POST /v1/clubs/:clubId/invite-code/regenerate` — was removed
(both the routes and every UI entry point). Self-service joining is
planned to come back as Club search from the Explore tab instead
(currently a placeholder, see `docs/current/navigation.md`); until that
ships, a member can only be added by a Club owner/admin
(`POST /v1/clubs/:clubId/members`, by username). `clubs.invite_code`
itself is still a real, generated, `NOT NULL UNIQUE` column — nothing
touched the schema, only the application layer — it's simply unused by
any route now.

## Sessions

| Method | Path | Auth | Extra check | Notes |
|---|---|---|---|---|
| POST | `/v1/clubs/:clubId/sessions` | profile | owner/admin of club | Body `{sport, name, location, activityType, startsAt, durationMinutes, hostPlaying, skillLevelMinId?, skillLevelMaxId?, skillLevelEnforcement?, description?, courtCount?, maxParticipants?, defaultMatchFormat?, defaultSingleDeuce?}`. `sport`/`name`/`location`/`activityType`/`startsAt`/`durationMinutes`/`hostPlaying` are **mandatory** — 400 if any is missing (no more server-side auto-generated name fallback). `durationMinutes` must be a multiple of 60 between 60 and 1440 (1-24 hours) — 400 otherwise. `description` and `maxParticipants` are always optional. `hostPlaying` (DP-004): if `true`, the creator is added as a `registered` participant right after the Session is created — via `db.AddRegisteredParticipant` directly, so it bypasses the Strict Skill Level gate (`enforceStrictSkillLevel`) that a normal join would go through. Milestone 2 (revised): previously landed at `checked_in` directly; Checked In specifically means physically present, which is what the Check-In Window exists to gate, so the organizer now checks in for real like anyone else once it opens. `activityType` (opaque, Sport-Module-owned, e.g. tennis `single`/`double`/`class`) is distinct from `defaultMatchFormat`/`defaultSingleDeuce` (Match Setup, DP-005) — together these seed every match's *scoring* format/deuce rule generated from this Session, set once by `CreateSessionScreen` and read by `AddMatchScreen`, never reconfigured there. Both nullable — no CHECK constraint, validated only by the `MatchFormat` union being opaque JSONB (unvalidated server-side, same as `Activity.config`). `startsAt`+`durationMinutes` (DP-009) are core Session properties, required together. `startsAt` cannot be in the past (Milestone 2, 400 if so — mirrored client-side in `CreateSessionScreen`'s validation). `skillLevel*` (DP-008, **optional as of v0.7.0**) — `validateSkillLevelRange` allows all three unset (no requirement), but if any one is set, all three must be, 400 if partial or if the two ids don't resolve to real levels of `sport`'s own scale with `min.rank <= max.rank`. `priceModel`/`pricePerPerson`/`totalPrice` (DP-010, optional, defaults to `"free"` via `validatePriceModel`) — `"free"` needs neither amount, `"per_person"` requires a positive `pricePerPerson`, `"split_bill"` requires a positive `totalPrice`; whichever amount doesn't apply to the chosen model is silently dropped (never persisted) rather than erroring if sent anyway. |
| GET | `/v1/clubs/:clubId/sessions` | profile | member | DP-001: `draft` sessions excluded from the list unless the caller is owner/admin of the club. As of v0.6.3, each Session includes a computed `joinedCount` (DP-002 headcount: `registered`+`checked_in`+`checked_out`, via `db.CountJoinedParticipants` — one batched query, not N+1). As of Milestone 2, also includes a computed `lifecycleStatus` — DP-001's resolved lifecycle state (`draft`/`recruiting`/`ready`/`full`/`in_progress`/`completed`/`cancelled`), resolved fresh on every response, never persisted (see `docs/current/lifecycle-session.md`). |
| GET | `/v1/me/sessions` | profile | self | DP-009 cross-Club Session History. Every non-draft Session the caller has joined (participant status `registered`/`checked_in`/`checked_out`) in Clubs they still belong to, newest `startsAt` first. Each entry is a Session (with `joinedCount`/`lifecycleStatus`) plus `clubName`. Not filtered to past dates — the client buckets by local calendar day, same as the Club-scoped history. |
| GET | `/v1/sessions/:id` | profile | member of parent club | Also includes computed `joinedCount`/`lifecycleStatus`, same definitions as the list endpoint. |
| PATCH | `/v1/sessions/:id` | profile | owner/admin | Body `{name?, location?, description?, status?, maxParticipants?, defaultMatchFormat?, defaultSingleDeuce?, activityType?, startsAt?, durationMinutes?, skillLevelMinId?, skillLevelMaxId?, skillLevelEnforcement?, hostPlaying?}`. `status` is now a guarded transition — `draft→open→in_progress→completed`, `cancelled` reachable from any non-terminal state — 409 if the transition from the session's current status isn't allowed, not just a flat set of valid strings (the DP-009 auto-start/auto-transition jobs bypass this guard entirely, see below). `publishSession`/`cancelSession` in `core/sessions/api.ts` are named wrappers over this same endpoint, not separate routes. There is deliberately no `startSession`/`completeSession` wrapper — as of Milestone 2 (revised), both `in_progress` and `completed` are reached only via the DP-009 auto-start/auto-transition jobs below, never an organizer PATCH; an earlier pass of this milestone briefly added a manual Start Session action, then removed it again in favor of auto-start. All fields here are independent partial updates (unlike `POST`'s all-or-nothing mandate) — each `skillLevel*` id just needs to belong to the session's sport; `durationMinutes`, if set, is still bound-checked (multiple of 60, 60-1440); `startsAt`, if set, cannot be in the past (Milestone 2, same rule as POST). `hostPlaying`, if set, is a plain value write — no auto-checkin side effect on PATCH, unlike POST. `priceModel`/`pricePerPerson`/`totalPrice` (DP-010) via `validatePriceModelForUpdate` — omitting `priceModel` entirely leaves price untouched; sending it re-validates/normalizes the same as POST. **Known limitation, same as Skill Level**: switching `priceModel` away from `per_person`/`split_bill` doesn't clear the now-irrelevant stale amount column (COALESCE can't distinguish "omitted" from "explicitly clear"), harmless since every reader branches on `priceModel` first. `defaultMatchFormat`/`defaultSingleDeuce` (DP-005 Match Setup) — plain `COALESCE`-based partial updates, no validation beyond opaque JSONB/nullable boolean; this is how `CreateSessionScreen`'s edit mode and the Configuration tab's Edit button change Match Setup after creation. Response also includes `joinedCount`/`lifecycleStatus` — fixed in Milestone 2 to actually query the current participant count (previously silently returned `joinedCount: 0` on every PATCH). On a Session generated by a Recurring Schedule, a PATCH carrying any Template field sets `edited_after_generation`, which excludes it from DP-007 Session Synchronization. |
| DELETE | `/v1/sessions/:id` | profile | owner/admin | Milestone 2 — "Discard." Hard-deletes a **Draft-only** Session — `db.DeleteSession`'s query itself requires `status = 'draft'` (409 if not, 404 if the session doesn't exist at all), the only hard-delete anywhere in the Sessions domain (everything published only ever gets Cancel's soft, visible-record terminal state). Participants/Activities cascade via FK (`ON DELETE CASCADE`). `discardDraftSession()` in `core/sessions/api.ts`. |
| GET | `/v1/sessions/:id/participants` | profile | member | |
| POST | `/v1/sessions/:id/register` | profile | member | As of v0.10.0 (DP-002 Join Approval): this is the **"request to join" action** — creates a `requested` row, idempotent (no-op if a row already exists in any status). Has a real screen now (`SessionDetailScreen`'s "Request to Join"). Strict Skill Level (`enforceStrictSkillLevel`) is enforced here — an ineligible member can't even request. |
| POST | `/v1/sessions/:id/participants/:userId/approve` | profile | owner/admin | As of v0.10.0. Moves a `requested` row to `waitlist` (approved, not yet claimed). 409 if not currently `requested`, 404 if no row. |
| POST | `/v1/sessions/:id/participants/:userId/confirm-payment` | profile | owner/admin | As of v0.10.0. Moves a `waitlist` row to `registered` (slot claimed). No payment gateway — this just records that the organizer received payment outside the app. 409 if not currently `waitlist`, 404 if no row. As of Milestone 5, exposed on the Payment tab (`SessionPayment.tsx`), not the Participants tab. |
| POST | `/v1/sessions/:id/receipt` | profile | `requireSessionAccess` | Milestone 5. Self-service only — attaches to the caller's own participant row. Body `{imageBase64, imageContentType}`, same validation as DP-011 Chat images (`image/jpeg`/`image/png`/`image/webp`, 5MB decoded cap, 8MB request-body cap). 404 if the caller has no participant row in this Session at all. Overwrites any previous receipt — no history, no separate edit/delete route. |
| GET | `/v1/sessions/:id/participants/:participantId/receipt` | profile | `requireSessionAccess` **+ self or owner/admin** | Milestone 5. Serves the raw image bytes with its stored `Content-Type`, 404 if no receipt. Deliberately narrower than every other read in this domain: even a fellow Club member who can see the Session gets 403 unless they're the uploader themselves or owner/admin — everyone else only ever sees the participant's `status` (paid vs. awaiting) via the normal list, never this image. |
| DELETE | `/v1/sessions/:id/participants/:userId` | profile | owner/admin | As of v0.10.0. Hard-removes a participant row entirely (e.g. declining a request, or removing someone outright) — distinct from Cancel/NoShow, which record what happened. 404 if no row. Despite the path segment's name, `db.DeleteParticipant` matches on either `user_id` or the row's own `id` (Milestone 2, revised) — the same route removes a guest too, passing the guest's participant id. |
| POST | `/v1/sessions/:id/checkin` | profile | member | As of v0.10.0: no longer upserts/auto-registers — requires the caller already be `registered` (`db.SelfCheckIn`, a guarded transition; 409 if not `registered`, 404 if no row at all). Strict Skill Level is **not** re-checked here anymore — it's enforced at `/register` instead. Still gated by the Check-In Window (v0.9.0): 403 unless `now` is within `[startsAt - 1h, startsAt + durationMinutes)` — `checkInWindowOpen` in `sessions_handler.go`; no-op (unrestricted) for Sessions missing `startsAt`/`durationMinutes`. |
| POST | `/v1/sessions/:id/participants/:userId/add` | profile | owner/admin | Milestone 2 (revised). Adds an existing club member directly as `registered` — `db.AddRegisteredParticipant`, idempotent (a pre-existing row in any status is left unchanged, mirrors `RegisterParticipant`'s contract). No Check-In Window gate (roster-building, not a check-in action) and Strict Skill Level is **not** enforced (same bypass Host Playing gets). Called by `SessionDetailScreen`'s participant-placeholder "Member" option. |
| POST | `/v1/sessions/:id/checkin/:participantId` | profile | owner/admin | Milestone 2 (revised). Moves an already-`registered` participant to `checked_in` — `db.CheckInParticipantByID`, a guarded transition (409 if not currently `registered`, 404 if no row) keyed by the participant row's own id rather than `user_id`, so it works for guests too. Gated by the Check-In Window, same as `/checkin` above. This is the **only** way a participant reaches `checked_in` besides self-service `/checkin` — replaces the old `POST /v1/sessions/:id/participants/:userId/checkin` (v0.8.3, removed), which upserted straight to `checked_in` in one step. Called by the **Confirmed** section's check-in action in `SessionDetailScreen`. |
| POST | `/v1/sessions/:id/checkout` | profile | member | Self-service, mirrors `/checkin`'s shape. DP-002. As of Milestone 2 (revised): `SessionDetailScreen`'s self-service area shows a "Check Out" link once `checked_in` — auto-regenerates any still-queued match the caller was part of, same as an organizer removal (see `lifecycle-session.md`). |
| POST | `/v1/sessions/:id/cancel` | profile | member | Self-service. DP-002. As of Milestone 2 (revised): `SessionDetailScreen`'s self-service area shows a "Cancel my spot" link while `requested`/`waitlist`/`registered` (not offered once `checked_in` — Check Out is the equivalent from there). |
| POST | `/v1/sessions/:id/participants/:userId/no-show` | profile | owner/admin | Marks another participant `no_show` — not self-service, unlike checkout/cancel. DP-002. No screen calls this yet — API only. |
| POST | `/v1/sessions/:id/participants` | profile | owner/admin | Body `{guestName}`. Adds a guest directly as `registered` (via `db.AddGuestParticipant`, bypasses Requested/Waitlist) — Milestone 2 (revised): previously landed at `checked_in` directly; no longer Check-In Window gated, same reasoning as the member-add route above. Called by `SessionDetailScreen`'s participant-placeholder "Guest" option. |

`session_participants.status` now also accepts `checked_out`/`cancelled`/`no_show` alongside the original `registered`/`checked_in`, plus `requested`/`waitlist` (v0.10.0, DP-002 Join Approval) — see `lifecycle-session.md`. `participated` was dropped (never set by any code path).

Every participant read (list and single) now also includes `hasReceipt` (Milestone 5, DP-012) — a bool computed from `receipt_image_data IS NOT NULL`, never the image bytes themselves. See the receipt endpoints above for how the bytes are actually fetched, and their narrower access rule.

### Conversations — Session Chat (DP-011) & Contact Organizer (DP-013)

Both share one messaging engine server-side (`conversations` +
`conversation_messages`, `internal/db/conversations.go`) — per explicit
product direction, the only real differences are **participants** and
**whether a posting window applies**; the message mechanics (compose,
list, optional image) are identical. A `conversations` row's
`kind` is `session_chat` (shared, `member_user_id` NULL — everyone who
can already see the Session) or `session_contact` (private,
`member_user_id` set — that member, plus any owner/admin of the
Session's Club). Both are created lazily on first message, never
pre-created. Every response below is the same `ConversationMessage`
shape: `{id, sessionId, senderId, senderUsername, senderDisplayName?,
body, hasImage, createdAt}`.

| Method | Path | Auth | Extra check | Notes |
|---|---|---|---|---|
| GET | `/v1/sessions/:id/messages` | profile | `requireSessionAccess` | The `session_chat` conversation, oldest-first, no pagination. Empty list (not an error) if nobody has posted yet. |
| POST | `/v1/sessions/:id/messages` | profile | `requireSessionAccess` + `sessionChatWindowOpen` | Body `{body?, imageBase64?, imageContentType?}` — at least one of `body`/image required, same validation as every other image upload (5MB decoded cap, 8MB request-body cap, jpeg/png/webp only). 403 once `now` is 1 week or more past `startsAt + durationMinutes` — Chat becomes permanently read-only past that point, history stays visible via GET. No editing/deleting. |
| GET | `/v1/sessions/:id/contact/:userId` | profile | `requireSessionAccess` + (self or owner/admin) | The `session_contact` conversation for that member, oldest-first. 403 if the caller is neither `:userId` themselves nor owner/admin. |
| POST | `/v1/sessions/:id/contact/:userId` | profile | `requireSessionAccess` + (self or owner/admin) | Same body shape and validation as Chat's POST above. **No posting-window check** — unlike Chat, a Contact Organizer thread never closes. A plain member can only post as themselves (`:userId` must equal their own id); an owner/admin can post into any member's thread for this Session. |
| GET | `/v1/sessions/:id/contact` | profile | `requireSessionAccess` + owner/admin | One row per member who has messaged this Session's organizers, most-recently-active first, each with a `needsReply` bool (the member's last message hasn't been answered by any organizer yet). Owner/admin only — a plain member never sees other members' threads. |
| GET | `/v1/sessions/:id/conversation-messages/:messageId/image` | profile | `requireSessionAccess` (+ self-or-owner/admin if the message belongs to a `session_contact` conversation) | Shared image-serving route for both Chat and Contact Organizer messages — access is resolved per-message from its owning conversation's `kind`. Serves raw bytes with the stored `Content-Type`, 404 if the message has no image or doesn't belong to `:id`. `Cache-Control: private, max-age=31536000, immutable`. Fetched one at a time (`<Image source={{uri, headers}}>`), never bundled into a list response. |

`GET /v1/me/contact-threads` (Users section above) is the cross-Session
Inbox listing — every `session_contact` conversation the caller is a
party to, either as the member or as an organizer, with `needsReply`
computed relative to the caller specifically (`contactThreadNeedsReply`
in `internal/db/conversations.go`).

**DP-009 auto-start / auto-transition** (no endpoint — background processes, `internal/scheduling.AutoStartDueSessions` and `AutoTransitionElapsedSessions`, both riding the same ticker as DP-007 generation): once an `open` Session's `starts_at` arrives, it's auto-started to `in_progress` (Milestone 2, revised — no manual "Start Session" action). Once `starts_at + duration_minutes` has passed, a Session still `in_progress` is set to `completed`; any other non-terminal Session (a Draft that was never published/started) is set to `cancelled`. Both write directly via `db.SetSessionStatus`, bypassing `sessionStatusTransitions` — that guard is for organizer-initiated PATCH calls only.

## Activities

| Method | Path | Auth | Extra check | Notes |
|---|---|---|---|---|
| POST | `/v1/sessions/:id/activities` | profile | owner/admin | Body `{config, participants: [{userId\|guestName, team?}]}`. Creates a `queued` activity. `config`/`result` are opaque JSON, not validated server-side. |
| GET | `/v1/sessions/:id/activities` | profile | member | Ordered live → queued → completed, then `created_at ASC` within each. |
| GET | `/v1/activities/:id` | profile | member of parent club | Returns `ActivityDetail` (activity + participants). |
| POST | `/v1/activities/:id/start` | profile | checked-in participant of *this activity*, or owner/admin of the parent club | `queued → live`. Sets `scorer_user_id` = caller, `started_at` = now. 409 if the Session's own `status` isn't `in_progress` yet (checked before anything else — matches can be generated ahead of the Session actually starting, but not started ahead of it) or if the activity isn't currently `queued`. Owner/admin bypasses the checked-in-participant eligibility check (`dbpkg.IsCheckedInActivityParticipant`) entirely — they can start any queued match in the session administratively, becoming its scorer even if they're not one of its players (e.g. scoring on behalf of players without the app). |
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
| POST | `/v1/clubs/:clubId/recurring-schedules` | profile | owner/admin | Body `{sport, name, location, activityType, recurrenceRule, generationLeadDays, hostPlaying, skillLevelMinId?, skillLevelMaxId?, skillLevelEnforcement?, description?, courtCount?, maxParticipants?, defaultMatchFormat?, defaultSingleDeuce?, generationTime?, endDate?}`. `recurrenceRule` is `{weekday, time, durationMinutes, timezone}` — weekly-only shape, an engineering default, not product-specified; `durationMinutes` must be a multiple of 60 between 60 and 1440 (1-24 hours, v0.6.0) — 400 otherwise. `name`/`location`/`activityType`/`hostPlaying` are mandatory, same as Sessions' own `POST`; the Skill Level range is optional but all-or-nothing (v0.7.0), same rule as Sessions — whichever fields are set are copied onto every generated Session. `hostPlaying` (v0.6.1): if `true`, the Schedule's creator is added as a `registered` participant on every generated Session, same bypass-Strict-Skill-Level behavior as ad-hoc creation (and same Milestone 2 revision — `registered`, not `checked_in`). `priceModel`/`pricePerPerson`/`totalPrice` (DP-010) — same optional, all-or-nothing-per-model rule as ad-hoc Sessions, copied onto every generated Session (`internal/scheduling/generate.go`). `defaultMatchFormat`/`defaultSingleDeuce` (DP-005 Match Setup) — same fields as ad-hoc Sessions, copied onto every generated Session the same way. |
| GET | `/v1/clubs/:clubId/recurring-schedules` | profile | owner/admin | |
| GET | `/v1/clubs/:clubId/recurring-schedules/:id` | profile | owner/admin | 404 if the schedule doesn't belong to `:clubId`. |
| PATCH | `/v1/clubs/:clubId/recurring-schedules/:id` | profile | owner/admin | Same body shape as create, all fields optional. Template/Recurrence Rule/Generation Policy/end date only — never touches already-generated Sessions; that is the separate `sync-sessions` step below. |
| GET | `/v1/clubs/:clubId/recurring-schedules/:id/sync-sessions` | profile | owner/admin | DP-007 Session Synchronization preview. Returns `{updated, skippedEdited}`: how many upcoming generated Sessions (`starts_at > now()`, status `draft`/`open`) a sync would overwrite, and how many it would skip because they were edited by hand. Changes nothing. |
| POST | `/v1/clubs/:clubId/recurring-schedules/:id/sync-sessions` | profile | owner/admin | Overwrites every Template field on the eligible Sessions with the Schedule's current values; never `startsAt`/`durationMinutes`. Returns the same `{updated, skippedEdited}` shape. See `docs/current/lifecycle-recurring-schedule.md`. |
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
