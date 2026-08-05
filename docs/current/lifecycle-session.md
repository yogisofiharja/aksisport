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

**Auto-start** (Milestone 2, revised): once an `open` Session's
`starts_at` arrives, a background process — not an organizer action —
starts it automatically: `open` → `in_progress`. Draft is untouched by
this (never published, nobody could have joined); a Draft whose time
passes is instead caught by auto-transition below once its full window
elapses. See `internal/scheduling.AutoStartDueSessions`.

**Auto-transition** (DP-009, v0.5.0): once `starts_at + duration_minutes`
elapses, a background process — not an organizer PATCH — resolves the
Session automatically: `in_progress` → `completed`; any other non-terminal
status → `cancelled` (it never started, so there's nothing to complete).
See `internal/scheduling.AutoTransitionElapsedSessions`, riding the same
ticker as DP-007 generation (and auto-start, above). Session History
screens (Club-scoped and cross-Club) are part of DP-009 but not yet built.

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

**Recruiting/Ready/Full are derived server-side, not stored** (Milestone
2 — Session Experience; previously client-side, corrected to match
DP-001/DP-ARCH-003 — see `docs/engineering/architecture.md`). Every
Session response includes a computed `lifecycleStatus`
(`internal/db/sessions.go`'s `resolveLifecycleStatus`, set in
`CreateSession`/`GetSession`/`ListSessionsForClub`/`UpdateSession`):
`draft`/`in_progress`/`completed`/`cancelled` pass `status` through
unchanged; `open` resolves to `recruiting`/`ready`/`full` from
`joinedCount` vs. `maxParticipants` and a minimum-participants
threshold (`internal/sports.MinParticipantsToStart` — a small
Tennis-only mirror of the Sport Engine's `minParticipants` rule, not a
duplication that changes ownership: a Session asking the Sport Module
for its own lifecycle derivation is a dependency, not an ownership
transfer, per `DP-ARCH-002`). The client (`Session.lifecycleStatus` in
`core/api/types.ts`) consumes this directly — the former
`src/core/sessions/deriveStatus.ts` is retired.

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

**Cancel UI** (v0.6.2, revised Milestone 2): `SessionDetailScreen` shows
a "Cancel Session" action (owner/admin) behind a confirm dialog, calling
`cancelSession()` in `core/sessions/api.ts` — a thin named wrapper over
the guarded `PATCH /v1/sessions/:id {status: 'cancelled'}` transition.
**Published only** as of Milestone 2 (`isSessionActive && isPublished`)
— a Draft Session has Discard instead (below), not Cancel. A cancelled
Session shows a notice banner to everyone.

**Discard (Milestone 2)** — a hard delete, Draft-only, explicit
exception to the "no hard-delete for Sessions" reasoning above (which
still holds for anything published): `DELETE /v1/sessions/:id`
(`db.DeleteSession`, enforces `status = 'draft'` in the query itself,
defense in depth beyond the handler's own check), cascades
Participants/Activities via FK. The distinction from Cancel: a Draft
has never been visible to anyone but the organizer (`requireSessionAccess`
404s it for everyone else), so there's no audience a "this was
cancelled" record is for — deleting it outright loses nothing a
published Session's Cancel needs to preserve. Confirmed via dialog
(`core/sessions/api.ts`'s `discardDraftSession`), irreversible.
`SessionDetailScreen`'s bottom-of-screen Draft block is now Publish,
"or", Edit, a divider, then Discard — in that order, all three actions
grouped together as the organizer's options once they're done
reviewing/editing everything above.

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

**Draft-gated actions** (Milestone 2): a second boolean, `isPublished =
lifecycleStatus !== 'draft'`, gates check-in (self, host-initiated),
Add Guest, and Add Match/Regenerate — all require the Session to
already be published, not just non-terminal. Before this, Draft was
treated identically to Recruiting/Ready/Full/Live for these actions
(since `isSessionActive` alone doesn't distinguish Draft), which meant
a `hostPlaying` organizer's own "Checked In" badge, and check-in/guest/
match-generation affordances more generally, could appear on a Session
nobody else can even see yet. The self-service check-in area now
renders nothing at all while Draft (not even the organizer's own
status).

**Draft presentation** (Milestone 2, final layout): a small "DRAFT"
flag sits above the Session title (own line — inline next to the title
clipped on long names), with the explanatory notice ("only you can see
this session until you publish it") directly under it. All three
Draft-only actions are grouped at the *bottom* of the screen instead —
Publish (primary, full-width), "or", Edit Session (outline), a divider,
then Discard (destructive text link) — the intent is "review/edit
everything above, then decide what to do," not scattering the actions
across the screen. The Details card has no section header (just the
sport/activity-type/date/duration rows directly); Description, if set,
is its own separate card underneath rather than nested inside Details.
Location gets a small pin icon next to it, next to the title. A
participant's status label (Registered/Checked In/etc.) is hidden
entirely while still Draft — same reasoning as the self-service check-in
area being hidden (`isPublished`, above): a `hostPlaying` organizer's
own row would otherwise show "Checked In" before the Session is even
visible to anyone else, which reads as more real/final than it is.

**Draft editing** (Milestone 2): `EditSession { sessionId }`
(`docs/current/navigation.md`) reuses `CreateSessionScreen` in an edit
mode — every field from the original creation form (name, location,
description, activity type, capacity, host playing, date/time,
duration, skill level requirement) is editable while still Draft, via
the same guarded `PATCH /v1/sessions/:id` every other update already
uses. Sport and the recurring/ad-hoc toggle are **not** editable —
both are treated as fixed at creation (changing sport would orphan any
already-set skill level requirement, which is scoped to a sport; a
Recurring-Schedule-generated Session's schedule link is likewise
fixed). **Known limitation**: un-requiring a skill level once set can't
be done through this form — `PATCH`'s `COALESCE`-based partial update
has no way to distinguish "field omitted" from "explicitly clear this
field," so the skill level range can be changed but not removed. Not
solved here; would need an explicit "clear" signal added to the PATCH
contract.

**No participant picker while Draft** (Milestone 2, revised): an
earlier pass of this milestone added a "Participants" section to
`CreateSessionScreen`/its edit mode — a circle grid letting the
organizer pre-select club members and stage guest names before the
Session even existed, backed by a new `AddRegisteredParticipant`
DB function and a window-ungated guest-add route. That was then
reverted: participant management (member/guest add, and the
participant list itself) is **only available once a Session is
published**, exclusively through `SessionDetailScreen`'s placeholder
grid (below) — `CreateSessionScreen` no longer shows or edits
participants in either create or edit mode. `AddRegisteredParticipant`
and the `POST /v1/sessions/:id/participants/:userId/add` /
`POST /v1/sessions/:id/participants/guest/plan` routes were removed
as dead code along with it (`docs/current/api.md`).

**Ad-hoc creation is now a two-step preview flow** (Milestone 2,
`CreateSessionScreen`): tapping "Continue" no longer calls
`createSession()` directly — it only validates the form and flips to a
read-only preview of everything entered (name, location, sport/
activity type, date/time, duration, capacity, skill level range and
enforcement as two separate rows if required, notes), with **nothing
persisted yet**. Host Playing is deliberately not shown here — it's
redundant with the participant list the organizer already sees once
the Session is published. From there:
**Publish** (`createSession()` then immediately `publishSession()`),
**Save as Draft** (`createSession()` only, same end state as the old
direct-submit path), or **Discard** (just `onBack()` — no API call,
since nothing exists to delete). "Continue
Editing" is simply the back arrow, returning to the form with all
state intact (it's the same component, toggling a local `showPreview`
flag, not a separate screen/route). This preview step is **ad-hoc-
create only** — editing an existing Draft (`EditSession`) and creating
a Recurring Schedule both still save directly on submit, unchanged.

**Date/time cannot be in the past** (Milestone 2): validated in
`CreateSessionScreen` (`combinedStartsAt().getTime() < Date.now()`,
skipped for the recurring path — a weekday rule has no single literal
date to check) and mirrored server-side on both `POST
/v1/clubs/:clubId/sessions` and `PATCH /v1/sessions/:id` (400 if
`startsAt` is in the past) — client-side alone can be bypassed, so the
rule is enforced at the API too, same reasoning as the duration bounds
check.

**Session History UI** (v0.6.3, revised Milestone 2 —
`SessionListScreen`/`SessionHistoryScreen`, `core/sessions/sessionSchedule.ts`):
the Club-scoped half of DP-009's Session History is now built.
`sessionDateBucket()` buckets a Session — **status takes precedence
over date**: Completed/Cancelled always bucket as `'past'` regardless
of when they were scheduled (`sessionSchedule.test.ts`). Otherwise,
buckets by calendar date (not exact time) relative to today.
`'today'`/`'upcoming'` stay in `SessionListScreen`'s active list (split
into two labeled sections, sorted soonest-first); `'past'` moves to
`SessionHistoryScreen`, a read-only, most-recent-first view reachable
via a "Past Sessions" link. (Earlier behavior bucketed purely by date,
so a same-day Cancelled Session stayed in the active list — reversed
per explicit product decision: "Today" is only for currently active/
upcoming Sessions, not a historical record; once a Session is
Completed or Cancelled it moves to Past immediately, not just once its
date has passed.) This same fix also keeps cancelled/completed
Sessions out of `HomeScreen`'s attention section, which filters on
`sessionDateBucket(s) === 'today'` among other conditions. The
cross-Club "every Session I've joined" history view
remains unbuilt.

**`joinedCount`** (v0.6.3): `GET /sessions`/`GET /sessions/:id` now
include a computed `joinedCount` — DP-002 headcount (registered +
checked_in + checked_out; cancelled/no_show excluded), computed via
`db.CountJoinedParticipants` (one batched query for a list, not N+1).
`SessionCard` renders it as `joined/max`, colored green while spots
remain and red once `joinedCount >= maxParticipants` — the first real use
of `Badge`'s `success`/`error` actions, which gained dark-mode variants as
part of this (they were previously light-only and unused).

**`UpdateSession` `joinedCount` fix** (Milestone 2): `PATCH
/v1/sessions/:id` previously returned `joinedCount: 0` regardless of
actual participant count — its `UPDATE...RETURNING` only scanned raw
columns, unlike `GetSession`/`ListSessionsForClub`, which separately
query `CountJoinedParticipants`. Fixed by adding the same query to
`UpdateSession`, needed for the new `lifecycleStatus` field (below) to
be correct on every PATCH, not just GET.

**Session lifecycle framing** (Milestone 2 — Session Experience):
`SessionDetailScreen` now presents every `lifecycleStatus` distinctly
(previously only `draft`/`cancelled` had dedicated notices, everything
else silently fell through) — Draft (existing Publish notice,
unchanged), Recruiting/Ready/Full (a shared notice block, copy varies
by sub-state, e.g. "Recruiting — 1 of 2 minimum joined"), Live
(`in_progress`, a red "LIVE" indicator), Completed (a neutral notice),
Cancelled (existing notice, unchanged). Notice text is visible to
everyone; action buttons are owner/admin only.

**No manual "Start Session" action either — same correction as
Complete, below.** This milestone initially added a manual Start
Session button (owner/admin, shown whenever `lifecycleStatus` was
`recruiting`/`ready`/`full`, calling a `startSession()` wrapper) to
close the gap that `in_progress` was otherwise unreachable — the
DP-009 auto-transition job only ever auto-completed/auto-cancelled on
elapse, never auto-started. **Corrected**: rather than keep a manual
trigger, `in_progress` is now reached automatically too —
`AutoStartDueSessions` (above) starts an `open` Session the moment its
`starts_at` arrives, no organizer action needed. The button and the
`startSession()` wrapper were both removed again once this was
clarified. The Recruiting/Ready/Full notice box (the table above)
keeps its explanatory text, just with no button under it, same shape
as the Live/"in_progress" box below.

**No manual "Complete Session" action — explicit product decision.**
DP-001's lifecycle diagram lists "Organizer finishes session" as a
step, which an earlier pass of this milestone read as implying a
manual UI trigger (symmetric with Start Session) and built one,
including a `completeSession()` wrapper in `core/sessions/api.ts`.
**Corrected**: Completed is reached *only* via DP-009's auto-transition
(`starts_at + duration_minutes` elapses) — never an organizer action.
The `completeSession()` wrapper was removed again (it briefly existed,
then was deleted once this was clarified). `lifecycleStatus ===
'in_progress'` still gets its own "LIVE" indicator on
`SessionDetailScreen`, just with no button under it.

**Cancel UI condition simplified**: the "Cancel Session" link's gate
(`status` is `draft`/`open`/`in_progress`) is now just `isSessionActive`
— that boolean already means exactly the same three-way check (`status
!== 'cancelled' && status !== 'completed'`); no behavior change, just
removed a redundant re-derivation sitting right next to the new Start
logic.

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
  `registered → checked_in, checked_in_at=now()`. Never upserts/
  auto-registers — a player must already be approved-and-paid. Guarded:
  409 if not currently `registered`, 404 if no row at all.
- `DeleteParticipant` (`DELETE /v1/sessions/:id/participants/:userId`,
  owner/admin) hard-removes a row entirely — declining a request, or
  removing someone outright. Distinct from Cancel/NoShow, which record
  what happened rather than erase it. Matches on either `user_id` or the
  row's own `id` (Milestone 2, revised — previously `user_id`-only, so
  guests couldn't be removed at all; `SessionDetailScreen`'s remove badge
  now passes `p.userId ?? p.id`, reachable for guests too).

**Organizer-added participants land at `registered`, not `checked_in`**
(Milestone 2, revised — this used to go straight to `checked_in`; see
"Empty-slot placeholders" below for the product reasoning):

- `AddRegisteredParticipant` (owner/admin, `POST
  /v1/sessions/:id/participants/:userId/add`) adds an existing club
  member directly to the roster at `status='registered'`. Idempotent — a
  pre-existing row (any status) is left unchanged, never downgraded.
- `AddGuestParticipant` (owner/admin, `POST /v1/sessions/:id/participants`)
  inserts a guest directly at `status='registered'` — guests still skip
  request/approval entirely, but no longer skip check-in.
- `CheckInParticipantByID` (owner/admin, `POST
  /v1/sessions/:id/checkin/:participantId`) is the only action that
  actually moves a participant to `checked_in` — keyed by the
  participant row's own `id` rather than `user_id`, so it works
  uniformly for members and guests (guests have no `user_id` to key a
  user-based check-in on). Guarded: requires the row already be
  `registered`, 409 (`ErrConflict`) otherwise, 404 if no row at all.
  This **replaces** the old `CheckIn`-upserting
  `POST /v1/sessions/:id/participants/:userId/checkin` route (v0.8.3),
  which is removed — nothing calls it anymore now that adding and
  checking in are two separate actions. `db.CheckIn` itself (the
  upsert-straight-to-`checked_in` function) is **removed entirely** —
  its last remaining call sites were Host Playing's creation-time
  auto-add (`sessions_handler.go`) and DP-007 recurring-schedule
  generation (`generate.go`), both since switched to
  `AddRegisteredParticipant` (see below).
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

**Check-In Window** (v0.9.0, DP-002; scope revised Milestone 2):
`checkInWindowOpen` in `sessions_handler.go` gates `/checkin` (self) and
`/checkin/:participantId` (organizer, by participant id) —
check-in actions only — to `[startsAt - 1h, startsAt +
durationMinutes)`. Outside that window, 403. **Adding** a participant to
the roster (`AddRegisteredParticipant`, `AddGuestParticipant`) is
deliberately **not** window-gated — roster-building is no longer a
check-in action, so there's nothing to restrict to the window. Sessions
missing `startsAt`/`durationMinutes` (legacy, pre-DP-009) have no defined
window and are unrestricted. Mirrored client-side by
`isWithinCheckInWindow` in `core/sessions/sessionSchedule.ts`, which
`SessionDetailScreen` uses to hide/disable the check-in affordance rather
than let the request 403 — the add-a-participant affordance is no longer
conditioned on it at all. Host Playing's registration on Session
creation (`db.AddRegisteredParticipant` called directly) is likewise
unaffected — it's roster-building, not a check-in action; the organizer
still checks in for real within the window like anyone else, once
they're actually there. Requesting to join (`/register`) is **not**
window-gated either — a member can request anytime the Session is open,
well before the window.

## Mobile UI reflection

`SessionDetailScreen.tsx`'s self-service action area (v0.10.0, revised
Milestone 2) branches on `myParticipant?.status`:

- No row yet → "Request to Join" button (Strict Skill Level block and the
  Guidance-mode confirm dialog both live here now, moved from the old
  Check In button — requesting is the actual "joining" moment now).
- `requested` → a muted notice ("waiting for organizer approval").
- `waitlist` → an amber notice ("approved — complete payment to claim
  your spot").
- `registered` → the Check In button, if within the Check-In Window;
  otherwise the existing "check-in opens/closes" notice.
- `checked_in` → **nothing** (Milestone 2 — the old static "Checked in"
  badge was removed; that status is already visible on the caller's own
  avatar in the Participants grid below, right where everyone else's
  status shows too, so the standalone banner was redundant).

**Organizer section** (Milestone 2, new — shown above Participants,
always, any lifecycle stage): a single avatar card for `session.createdBy`
(looked up in `members`, falling back to the generic "Host" label if
not found), blue-bordered, name only. This is about identity, not
participation — if the organizer is also playing (`hostPlaying`),
they *additionally* appear in Participants' Checked In sub-section
below, same as any other participant; the Organizer card itself never
has Remove or any other action.

**Participants, split into sub-sections by status** (Milestone 2,
replaces both the old flat list-of-rows layout and an even-older flat
avatar grid): **Checked In** (`checked_in`) → **Confirmed**
(`registered`) → **Waitlist** (`waitlist`) → **Requested**
(`requested`) → **Cancelled** (`cancelled`) → **Other**
(`checked_out`/`no_show`, no dedicated action anywhere in this screen
today but shown rather than silently dropped). Each section header
only renders when it has at least one participant. Every card is now
exactly an avatar circle (initials — no `avatarUrl` on
`SessionParticipant` yet, swap in a real image there once one exists,
border colored by status) plus **one line of text**, the name — the
old second/third lines (a redundant "Host" label, a redundant status
caption, and inline "Approve"/"Confirm Payment" text links) are gone,
since the sub-section itself and the avatar's border color already
convey status, and organizer identity now lives in its own section
above. Owner/admin still get a small red "×" corner badge (top-right,
`isSessionActive`) for Remove on every card, and — Requested/Waitlist
cards only — a small blue checkmark corner badge (top-left) that
triggers Approve/Confirm Payment directly from the card, replacing the
old text links. The section header shows `joinedCount`/`maxParticipants`
next to the "Participants" title, same as before (moved off the
Details card in an earlier pass of this milestone).

Every participant HStack (each sub-section's row, and the placeholder
row below) uses `items-start` instead of `Box.tsx`'s `HStack` default
of `items-center` — otherwise a short single-line card (a placeholder,
or any now-simplified one-line participant card) drifts to the
vertical center of whatever the tallest item in that wrapped row is,
misaligning circles against each other. `items-start` keeps every
circle pinned to the same row position regardless of content height,
including when a long name wraps to two lines.

**Empty-slot placeholders** (Milestone 2, revised): once published *and*
still active (`isPublished && isSessionActive` — none show once
Cancelled/Completed, even with unfilled quota, since there's nothing
left to add a participant to), a trailing row shows placeholder circles
(dashed border, "+" icon) for remaining capacity — a capped Session
shows exactly `maxParticipants - joinedCount` of them; an uncapped one
shows a single generic slot instead, so the add-flow stays reachable
either way. Tapping one (owner/admin, `isSessionActive && isPublished`
— deliberately **not** gated by `checkInWindowOpen`, unlike before)
opens a bottom-sheet chooser: **Member** (a scrollable grid of club
members with no participant row *at all* yet — not "not yet checked
in" — rendered as avatar-circle cards; tapping one calls
`addRegisteredParticipant`/`AddRegisteredParticipant`, landing at
`registered`) or **Guest** (a name input, `addGuestParticipant`/
`AddGuestParticipant`, also landing at `registered` — Milestone 2,
revised: previously landed directly at `checked_in`). Both auto-close
the sheet on success. This still **replaces** the old always-visible
"Check in a member" pill row and the separate Add Guest form at the
bottom of the screen — same two underlying actions, triggered from the
empty slot itself instead of two permanently-visible sections.
Deliberately not restricted once the Session goes `in_progress` — a
late-arriving player or a walk-in guest still needs to be added after
the Session has started, same as before. The whole sheet is wrapped in
a `KeyboardAvoidingView` (`behavior: 'padding'` on iOS) so the Guest
step's text input stays above the keyboard instead of being obscured
by it — the bottom-sheet `Modal` itself doesn't reposition for the
keyboard on its own.

**Confirmed section's check-in action** (Milestone 2, revised): since
adding a participant no longer checks them in, the **Confirmed**
sub-section (below) gets its own action button — the same blue
checkmark badge Waitlist/Requested already use — visible only when
`checkInWindowOpen`, calling `checkInParticipantById`/
`CheckInParticipantByID` (by the participant's own row id, not
`user_id`, so it works for organizer-added guests too). This is now the
**only** way a participant reaches `checked_in` outside of self-service
Check In — there is no more one-tap "add and check in simultaneously"
shortcut.

This placeholder grid is also, as of Milestone 2 (revised), the
**only** place a Session's participants can be viewed or edited at
all — `CreateSessionScreen` (create and edit-draft) shows no
participant list and no add action; see "No participant picker while
Draft" above.

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
Matches. `SessionDetailScreen`'s Regenerate action (queued-only
`DELETE /v1/activities/:id`, then a fresh `generateFairRound` for the
same match count that was just deleted) is reachable two ways: the
explicit "Regenerate matches" link (unchanged), or automatically — see
"Automatic regeneration on checked-in pool change" below.

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
auto-navigation was added for `AddMatchScreen` — opening the Add Match
screen is still the trigger there, always recomputing from current data.

**Automatic regeneration on checked-in pool change** (Milestone 2,
revised): once matches have been generated, the checked-in pool they
were generated from can change for any reason — a late check-in, a
checked-in player cancelling/being removed, a no-show, a checkout —
and any still-`queued` (unplayed) match no longer reflects who's
actually available. Rather than requiring the organizer to notice this
and tap Regenerate manually, `SessionDetailScreen`'s `load()` compares
the checked-in participant set (by `userId` for members, participant
row `id` for guests, sorted into a stable key) against what it observed
on the *previous* successful load. If the set differs — not just the
count, so a same-size swap still counts — and the viewer is owner/admin
(matches Regenerate's own permission requirement, and avoids every
viewer's device racing to regenerate the same queue) and there's at
least one queued match, it runs the exact same delete-then-
`generateFairRound` sequence Regenerate does, automatically, before
rendering. The very first load after opening the screen never triggers
this (there's no "previous" pool yet to diff against) — only an
*observed change* does, which happens on every subsequent `load()` call:
after any participant-affecting action on this screen (check-in,
check-out, cancel, remove, no-show), on screen focus, and on pull-to-
refresh. A change made from a different device is only caught the next
time this device's own `load()` runs, same as everything else in this
screen — there's no live push/sync.
