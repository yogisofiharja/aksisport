# Session Lifecycle (Current)

Two separate state machines exist under "session": the session itself,
and each participant's status within it. `docs/archive/prd.md` describes a target
that doesn't fully match what's implemented — differences are called
out below.

**`starts_at`** (added by `0007_recurring_schedules.up.sql`, DP-007) is a
core Session property, separate from the `status` state machine below —
see `lifecycle-recurring-schedule.md` for how it's populated. As of
v0.5.1 (DP-009) it's mandatory at creation, paired with `duration_minutes`
(`0009_session_duration.up.sql`) — both columns stay nullable at the DB
level (existing rows predate the mandate), enforcement is in Go only.

**`activity_type`** (`0010_activity_type.up.sql`, mandatory as of v0.5.1)
— opaque, Sport-Module-owned (tennis: `single`/`double`/`class`).
Distinct from `default_match_format`, which seeds a match's *scoring*
format (`AddMatchScreen`'s `matchFormat` state) — the two are unrelated
fields with different purposes that happen to sit on the same row.

**Skill Level requirement** (`0008_skill_levels.up.sql`, DP-008; optional
as of v0.7.0, having briefly been mandatory in v0.5.1-v0.6.3):
`skill_level_min_id`/`max_id` plus an `enforcement` mode
(`strict`/`guidance`). All three are unset by default — but if any one is
set, all three must be (`validateSkillLevelRange` in
`skill_levels_handler.go`); there's no one-sided range. `CreateSessionScreen`
hides the range picker behind a "Require a skill level?" toggle,
defaulting off. Only `strict` is checked server-side, and only at the
point a player actually joins — which today means `/checkin`
(auto-registers on first call), not `/register` (unused by any screen).
See `api.md`'s Skill Levels section.

**Auto-transition** (DP-009, v0.5.0): once `starts_at + duration_minutes`
elapses, a background process — not an organizer PATCH — resolves the
Session automatically: `in_progress` → `completed`; any other non-terminal
status → `cancelled` (it never started, so there's nothing to complete).
See `internal/scheduling.AutoTransitionElapsedSessions`, riding the same
ticker as DP-007 generation. Session History screens (Club-scoped and
cross-Club) are part of DP-009 but not yet built.

## Session status

Column: `sessions.status`,
`CHECK IN ('draft','open','in_progress','completed','cancelled')`,
default `'draft'`.

Updated for `DP-001` (Session Lifecycle). Three categories, per the
approved product decision:

- **Explicit** — Draft, Cancelled, Completed. Set only by an owner/admin
  action.
- **Transition** — In Progress. Also explicit (an owner/admin "start
  session" action), but conceptually the active/ongoing state rather than
  a milestone the organizer lingers in.
- **Derived** — Recruiting, Ready, Full. **Not stored as separate values**
  — see below.

```
draft --publish--> open --start--> in_progress --complete--> completed
  |                  |                  |
  +---- cancel -------+---- cancel ------+
```

Guarded via `sessionStatusTransitions` in
`server/internal/httpapi/sessions_handler.go` — `PATCH /v1/sessions/:id
{status}` now validates the transition against the session's *current*
status (409 if invalid), not just that the target value is one of the
five allowed strings. This is a real behavior change from the prior "all
three reachable from each other" — DP-001 requires an enforced order.

**Recruiting/Ready/Full are derived client-side, not stored.** When
`status = 'open'`, `src/core/sessions/deriveStatus.ts`'s
`deriveSessionStatus` computes which of the three applies, from the
joined participant count vs. the session's `max_participants` and the
Sport Engine's `minParticipants` rule. This is client-side rather than
server-side specifically because `DP-003` keeps minimum-participants
Sport-Engine-owned and out of the Go server — deriving Recruiting/Ready/
Full in Go would mean duplicating that rule there. See
`docs/engineering/architecture.md`.

**Draft visibility**: a `draft` session is invisible to club members who
aren't owner/admin — `requireSessionAccess` returns 404 (not 403, to
avoid revealing existence) for a member fetching a draft session directly,
and `ListSessionsForClub` excludes drafts from the list unless the caller
is owner/admin.

**Publish UI**: `SessionDetailScreen` now shows a Publish button (owner/
admin, when `status === 'draft'`) — added specifically to avoid a
regression, since defaulting new sessions to `draft` would otherwise leave
every newly created session permanently unpublished with no way to reach
members. This is intentionally minimal — not the fuller Draft-editing
experience (courts, pricing, duplicate) described alongside the approved
decision, which remains unbuilt.

**Cancel UI** (v0.6.2): `SessionDetailScreen` now shows a "Cancel Session"
action (owner/admin, when `status` is `draft`/`open`/`in_progress`) behind
a confirm dialog, calling `cancelSession()` in `core/sessions/api.ts` —
already a thin named wrapper over the same guarded `PATCH /v1/sessions/:id
{status: 'cancelled'}` transition, but previously called by no screen.
This closes an implementation gap in an already-approved decision, not a
new one — DP-001 already defines Cancelled as reachable from any
non-terminal state. A cancelled Session shows a notice banner to everyone;
no separate hard-delete exists for Sessions (mirrors DP-007's reasoning
for Occurrences — Session Lifecycle is deliberately not extended with a
"deleted" state).

**Terminal Session Actions** (v0.8.1): `SessionDetailScreen` computes
`isSessionActive = status !== 'cancelled' && status !== 'completed'` and
gates every action affordance on it — the Check In button, Add Match/
Regenerate links, Add Guest form, and each queued/live match's Start/Watch
buttons all disappear once a Session is Cancelled or Completed. Already-
recorded facts (the "Checked In" badge for participants who were, past
matches) stay visible; only the actions that would change the Session are
hidden. Same round: a new Details card surfaces Sport, Activity Type,
Date & Time, Duration, Capacity (`joinedCount`/`maxParticipants`), and
Description — all fields that already existed on `Session` but were never
rendered on this screen before.

**Session History UI** (v0.6.3, `SessionListScreen`/`SessionHistoryScreen`,
`core/sessions/sessionSchedule.ts`): the Club-scoped half of DP-009's
Session History is now built. `sessionDateBucket()` buckets a Session by
calendar date (not status, not exact time) relative to today —
`'today'`/`'upcoming'` stay in `SessionListScreen`'s active list (split
into two labeled sections, sorted soonest-first); `'past'` moves to
`SessionHistoryScreen`, a read-only, most-recent-first view reachable via
a "Past Sessions" link. This is why a same-day Cancelled Session still
shows in the active list — the bucket is date-driven, and in practice a
past-dated Session is already Completed/Cancelled via Auto-Transition
regardless. The cross-Club "every Session I've joined" history view
remains unbuilt.

**`joinedCount`** (v0.6.3): `GET /sessions`/`GET /sessions/:id` now
include a computed `joinedCount` — DP-002 headcount (registered +
checked_in + checked_out; cancelled/no_show excluded), computed via
`db.CountJoinedParticipants` (one batched query for a list, not N+1).
`SessionCard` renders it as `joined/max`, colored green while spots
remain and red once `joinedCount >= maxParticipants` — the first real use
of `Badge`'s `success`/`error` actions, which gained dark-mode variants as
part of this (they were previously light-only and unused).

## Session participant status

Column: `session_participants.status`,
`CHECK IN ('registered','checked_in','checked_out','cancelled','no_show')`,
default `'registered'`.

Updated for `docs/AKSI_PRODUCT_DECISIONS.md`'s DP-002 (Participant
Lifecycle — Joined/Checked In/Checked Out/Cancelled/No Show). `registered`
and `checked_in` were kept as-is rather than renamed to `joined`/`checked_in`
— same meaning, smallest change necessary. `participated` (previously
declared but never set by any code path) was dropped — not part of DP-002's
five states.

```
requested → waitlist → registered → checked_in → checked_out
registered/checked_in → cancelled
registered → no_show
```

No enforced transition order beyond what's implied above — same
last-write-wins simplicity as the original two states, not a state machine
with guards, except for the four new guarded transitions below
(`ApproveParticipant`, `ConfirmPayment`, `SelfCheckIn` all use a
`WHERE status = '<expected>'` guard + `ErrConflict`/`ErrNotFound`
disambiguation, the same pattern `StartActivity`/`CompleteActivity` in
`activities.go` already established).

**Join Approval** (v0.10.0, DP-002): joining a Session always requires
organizer approval plus manual payment confirmation, no per-Session
opt-out.

- `RegisterParticipant` (`POST /v1/sessions/:id/register`) is the
  **"request to join" action** — inserts with `status='requested'` if no
  row exists; no-op if one already does (`ON CONFLICT ... DO NOTHING`).
  Strict Skill Level (DP-008) is enforced here now, not at check-in — an
  ineligible member can't even request. Has a real screen for the first
  time: `SessionDetailScreen`'s "Request to Join" button (shown when the
  caller has no participant row yet).
- `ApproveParticipant` (`POST /v1/sessions/:id/participants/:userId/approve`,
  owner/admin) moves `requested → waitlist` — approved, but the slot
  isn't claimed. Guarded: 409 if not currently `requested`, 404 if no row.
- `ConfirmPayment` (`POST /v1/sessions/:id/participants/:userId/confirm-payment`,
  owner/admin) moves `waitlist → registered` — slot claimed. **No payment
  gateway** — this only records that the organizer received payment
  outside the app (cash, transfer, etc.). Guarded: 409 if not currently
  `waitlist`, 404 if no row.
- `SelfCheckIn` (`POST /v1/sessions/:id/checkin`) moves
  `registered → checked_in, checked_in_at=now()`. Unlike the old
  `CheckIn`, this **never upserts/auto-registers** — a player must
  already be approved-and-paid. Guarded: 409 if not currently
  `registered`, 404 if no row at all.
- `DeleteParticipant` (`DELETE /v1/sessions/:id/participants/:userId`,
  owner/admin) hard-removes a row entirely — declining a request, or
  removing someone outright. Distinct from Cancel/NoShow, which record
  what happened rather than erase it.

**Organizer-override actions bypass the whole chain**, going straight to
`checked_in` — these are unaffected by Join Approval, since they're
already an organizer decision, same reasoning as before:

- `CheckIn` (the original function, now exclusively the organizer-override
  path) upserts to `status='checked_in', checked_in_at=now()` regardless
  of prior state. Used by Host Playing's creation-time auto-check-in and
  `POST /v1/sessions/:id/participants/:userId/checkin` (v0.8.3,
  host-initiated check-in for another club member — owner/admin, has a
  screen: `SessionDetailScreen`'s "Check in a member").
- `AddGuestParticipant` (owner/admin action) inserts a guest directly at
  `status='checked_in'` — guests skip the whole chain entirely.
- `CheckOut` (`POST /v1/sessions/:id/checkout`) sets
  `status='checked_out', checked_out_at=now()` — self-service, requires an
  existing row (does not upsert).
- `CancelParticipant` (`POST /v1/sessions/:id/cancel`) sets
  `status='cancelled'` — self-service.
- `MarkNoShow` (`POST /v1/sessions/:id/participants/:userId/no-show`) sets
  `status='no_show'` — owner/admin only, targets another participant.
- **Checkout/Cancel/No Show still have no screen** — API only, added as
  Milestone A foundation work; wiring is expected as part of DP-006's
  later UX work.

**Check-In Window** (v0.9.0, DP-002): `checkInWindowOpen` in
`sessions_handler.go` gates `/checkin`, the host-initiated checkin route,
and guest-add — all three are check-in actions — to
`[startsAt - 1h, startsAt + durationMinutes)`. Outside that window, 403.
Sessions missing `startsAt`/`durationMinutes` (legacy, pre-DP-009) have no
defined window and are unrestricted. Mirrored client-side by
`isWithinCheckInWindow` in `core/sessions/sessionSchedule.ts`, which
`SessionDetailScreen` uses to hide/disable the affordances rather than
let the request 403. Host Playing's auto-check-in on Session creation
(`db.CheckIn` called directly, not through `/checkin`) is unaffected —
it's the organizer's declared creation-time intent, not a gated check-in
action. Requesting to join (`/register`) is **not** window-gated — a
member can request anytime the Session is open, well before the window.

## Mobile UI reflection

`SessionDetailScreen.tsx`'s self-service action area (v0.10.0) branches on
`myParticipant?.status`:

- No row yet → "Request to Join" button (Strict Skill Level block and the
  Guidance-mode confirm dialog both live here now, moved from the old
  Check In button — requesting is the actual "joining" moment now).
- `requested` → a muted notice ("waiting for organizer approval").
- `waitlist` → an amber notice ("approved — complete payment to claim
  your spot").
- `registered` → the Check In button, if within the Check-In Window;
  otherwise the existing "check-in opens/closes" notice.
- `checked_in` → the existing static "Checked in" badge.

The participant list shows each participant's real status
(`participantStatusLabel` — Requested/Waitlist/Registered/Checked
in/Checked out/Cancelled/No show) instead of the old binary "Checked
in"-or-"Registered". Owner/admin see inline actions per row: "Approve"
when `requested`, "Confirm Payment" when `waitlist`, and "Remove" (hard
delete, confirm dialog) always — none of `checked_out`/`cancelled`/
`no_show` have a *dedicated* transition UI yet beyond Remove.

**Host-initiated check-in** (v0.8.3): owner/admin also see a "Check in a
member" row of tappable club-member pills — every club member not yet
checked in to this Session, excluding the caller. Tapping one calls
`checkInParticipant(sessionId, userId)` — the organizer-override
`db.CheckIn`, which bypasses Requested/Waitlist entirely (this list isn't
filtered by request status; an organizer can check in a member who never
requested at all). Guests are unaffected — they're already inserted
directly as `checked_in` via `AddGuestParticipant`, so they never appear
in either list.

## Match scheduling (DP-005, DP-006)

Two independent selection strategies exist, used by different
`AddMatchScreen` tabs (v0.8.0):

`src/core/sessions/scheduler.ts` implements `DP-005`'s original Scheduler
Architecture: a `SchedulingPolicy` interface (`suggestNextMatch({
checkedIn, busyActivities, sport, mode }) => MatchSuggestion | null`) and
its only implementation, `firstCheckedInPolicy` — orders checked-in
participants by `checkedInAt`, excludes anyone already in a `queued` or
`live` activity, and takes the first `minParticipants(mode)` of them.
Deliberately no fairness weighting or rotation logic, per DP-005's own
original text ("do NOT implement fairness or AI yet"). **This policy now
only powers the Custom Match tab's pre-fill** — the organizer can still
freely add, remove, or reorder before submitting, and any manual tap
clears the "Suggested" banner (`schedulerSuggested` + a reason key like
`schedulerReasonEarliestCheckedIn`), same as before.

`src/core/sessions/matchGenerator.ts` is the new, separate fairness-aware
generator behind the Generate Matches tab — fewest-played-first (ties
broken randomly), computed from the Session's own activities so far (any
status counts toward a player's play count, including a still-`queued`
match — they're already allocated a turn). `generateFairRound(checkedIn,
busyActivities, activities, needed, count)` draws exactly `count` matches
(v0.8.2 — previously it drew matches until the checked-in pool ran out
once; now the organizer picks the count, defaulting to
`suggestedMatchCount(session.durationMinutes)`, a rough ~3.5
matches/hour estimate, freely adjustable). Requesting more matches than
there are checked-in players is expected — players cycle through fairly
via a running per-batch play count, rather than the batch stopping once
everyone's had one turn. There is no separate "generate one match" tab —
it duplicated Custom Match's own suggested pre-fill, so it was removed;
generating one match is just setting the count to 1. This is DP-005's
Match Generation decision — "Match balance" promoted here from Scheduler
Evolution (Planning), an explicit product requirement, not a general
fairness/AI engine. The generator never calls `createActivity` itself;
`AddMatchScreen` still does that only once the organizer taps Generate
Matches, and `SessionDetailScreen`'s Regenerate action (queued-only
`DELETE /v1/activities/:id`, then a fresh `generateFairRound` for the
same match count that was just deleted) needs the same explicit organizer
tap.

**Match count picker** (v0.9.0): "Number of matches" is a collapsible
wheel picker (1-30, `@react-native-picker/picker`), not a text input —
matches the app's established pattern for other numeric pickers
(Session Duration, Skill Level range). Defaults to
`suggestedMatchCount(session.durationMinutes)`.

**Match Format fields** (v0.9.0): the Match Format card's Fixed Games,
Race To, and Best of Sets options previously only set hardcoded defaults
(4 games, no golden game; race to 4; 2 sets, no super tiebreak) with no
way to adjust them — a real gap against the web version's
`MatchSetup.tsx`, which has always exposed these. `AddMatchScreen` now
shows the same fields conditionally on `matchFormat.type`: Fixed Games
gets a total-games stepper (2-20) and a golden-game-on-tie switch; Race To
gets a target-games stepper (1-20); Best of Sets gets 1/2/3 sets-to-win
pills and a super-tiebreak switch (hidden when `setsToWin === 1`, and
picking `1` force-disables it). This applies to both Generate Matches and
Custom Match, since both share the same `matchFormat` state.

This is DP-006's check-in-driven loop in practice: checking a player in
makes them eligible for the next suggestion or generated match; completing
a match frees its players (no longer `queued`/`live`) so they become
eligible again the next time `AddMatchScreen` is opened, or the next time
Regenerate runs. No separate "suggest next match" trigger or
auto-navigation was added — opening the Add Match screen, or tapping
Regenerate, is the trigger; both always recompute from current data.
