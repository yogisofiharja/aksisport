# Session Lifecycle (Current)

Two separate state machines exist under "session": the session itself,
and each participant's status within it. `docs/archive/prd.md` describes a target
that doesn't fully match what's implemented — differences are called
out below.

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
registered → checked_in → checked_out
registered/checked_in → cancelled
registered → no_show
```

No enforced transition order beyond what's implied above — same
last-write-wins simplicity as the original two states, not a state machine
with guards.

- `RegisterParticipant` (`POST /v1/sessions/:id/register`) inserts with
  `status='registered'` if no row exists; no-op if one already does
  (`ON CONFLICT ... DO NOTHING`).
- `CheckIn` (`POST /v1/sessions/:id/checkin`) upserts to
  `status='checked_in', checked_in_at=now()` — auto-registers first if
  the caller had no row at all (one tap covers both steps).
- `CheckOut` (`POST /v1/sessions/:id/checkout`) sets
  `status='checked_out', checked_out_at=now()` — self-service, requires an
  existing row (does not upsert, unlike CheckIn).
- `CancelParticipant` (`POST /v1/sessions/:id/cancel`) sets
  `status='cancelled'` — self-service.
- `MarkNoShow` (`POST /v1/sessions/:id/participants/:userId/no-show`) sets
  `status='no_show'` — owner/admin only, targets another participant.
- `AddGuestParticipant` (owner/admin action) inserts a guest directly
  at `status='checked_in'` — guests skip `'registered'` entirely.
- **None of the three new transitions have a screen yet** — API only,
  added as Milestone A foundation work. `SessionDetailScreen` still only
  exposes Check In (see Mobile UI reflection below); Checkout/Cancel/No
  Show wiring is expected as part of DP-006's later UX work.

## Mobile UI reflection

`SessionDetailScreen.tsx` shows a single "Check In" button when
`myParticipant?.status !== 'checked_in'`, and a static "Checked in"
badge otherwise — unchanged by this update. It has no UI for
`checked_out`/`cancelled`/`no_show` yet.

## Match scheduling (DP-005, DP-006)

`src/core/sessions/scheduler.ts` implements `DP-005`'s Scheduler
Architecture: a `SchedulingPolicy` interface (`suggestNextMatch({
checkedIn, busyActivities, sport, mode }) => MatchSuggestion | null`) and
its only implementation, `firstCheckedInPolicy` — orders checked-in
participants by `checkedInAt`, excludes anyone already in a `queued` or
`live` activity, and takes the first `minParticipants(mode)` of them.
Deliberately no fairness weighting or rotation logic, per DP-005's own
text ("do NOT implement fairness or AI yet").

**Organizer Control**: this only suggests. `AddMatchScreen` calls it on
initial load and again on mode change, pre-filling `assignedOrder` (and
`firstServerId` with the first suggested player) — but the picker beneath
it is the same tap-to-toggle UI as before, so the organizer can freely add,
remove, or reorder before submitting. Any manual tap clears the "Suggested"
banner (`schedulerSuggested` + the suggestion's reason key,
e.g. `schedulerReasonEarliestCheckedIn`), since the picks no longer
reflect what the policy proposed. The scheduler never calls `createActivity`
itself.

This is DP-006's check-in-driven loop in practice: checking a player in
makes them eligible for the next suggestion; completing a match frees its
players (no longer `queued`/`live`) so they become eligible again the next
time `AddMatchScreen` is opened. No separate "suggest next match" trigger
or auto-navigation was added — opening the existing Add Match screen is
the trigger, since it always recomputes from current data.
