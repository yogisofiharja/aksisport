# AKSI Product Decisions — Change Log

Historical record of changes to `AKSI_PRODUCT_DECISIONS.md`. That document
is the source of truth for *current* decisions; this file is append-only
history — never a place to look for what's true right now.

---

## v0.27.0

From the design sessions on the "Aksi app redesign" canvas (2026-10-19).

- DP-023: the umpire is per Session, not per match (decided 2026-10-19
  from hosting experience). The host by default; an owner or admin can
  hand it to any checked-in player, who then umpires every match of the
  Session until it is changed or taken back; it can change mid-match; the
  umpire cannot hand it on themselves. Replaces "per match".
- New DP-024: Session Screen Follows the Lifecycle — four tabs (Details ·
  Players · Matches · Chat); Configuration becomes "Match setup" in the
  organizer's ⋯ menu; Payment moves into Players; the opening tab and tab
  order follow the lifecycle; a live strip while In Progress; one bottom
  action that follows the viewer's state.
- DP-012: payment status, confirmation and bank accounts live in the
  Players tab instead of a Payment tab (DP-024); receipt visibility is
  unchanged.
- New DP-025: Match Result Confirmation — the umpire confirms the result
  (or undoes the last point) instead of the match completing on the final
  point; then Share result, Set up next match, Back to session.
- New DP-026: Sharing Match Results — anyone who can see the Session can
  share any finished match, from three places, with one share card
  (players, score, logo); Results shows all matches with a "My matches
  only" switch.
- DP-019 and DP-022 wording follows: the Players tab; only the umpire
  starts and scores matches.
- Information Architecture v1.1.0: Members becomes a Community tab (see
  `AKSI_INFORMATION_ARCHITECTURE_CHANGELOG.md`).

---

## v0.26.0

- New DP-023: Match Umpire — every match has one umpire who scores it;
  the Session's creator by default; owner/admins can assign any checked-in
  player of the Session, before or during the match, and reclaim it.

---

## v0.25.0

- DP-022: Focus mode — scoring is portrait (in the start screen's look) by
  default; a button switches to a landscape, full-screen court and back.
- DP-022: on the web, Focus mode only where the browser can go full screen
  and lock landscape (Android); not on iPhone browsers or computers.

---

## v0.24.0

- DP-002: on a Free Session, approving a request to join registers the
  member straight away — no Waitlist, no payment step. Paid Sessions are
  unchanged.
- The payment decision: a Free Session no longer has a Payment tab
  (replacing "the Payment tab is always present, even on a Free Session").

---

## v0.23.0

- New DP-022: Live Scoring Screen — portrait on every platform; a start
  screen before each match to set sides, left and right (switchable), and the first server
  (picked or random); no switching sides during play.
- DP-022: matches can start from 10 minutes before a Session's start time
  (a server setting, raisable for testing); starting one makes the Session
  In Progress early. DP-009 Auto-Start notes the early path.

---

## v0.22.0

- DP-021 step 3 changed: one "new chat" entry point (a compose icon in
  Inbox) — one person picked is a private chat, two or more a group.
  Groups need no name (shown by members' names); the creator may name
  one. Every kind of chat works the same way.

---

## v0.21.0

- DP-021 amended: senders can edit their own messages for 15 minutes and
  delete them for everyone for 60 hours; anyone can delete a message for
  themselves (WhatsApp's rules). Removed "no editing or deleting" from
  its scope.

---

## v0.20.0

- New DP-021: Messaging — live delivery, unread counts, read receipts
  (always on), typing, push for new direct/group/Contact Organizer
  messages (step 1); blocking and reporting, reports going to the
  Community's owner/admins (step 2); group chats and one chat per
  Community (step 3). Promotes the rest of Planning > Communication.

---

## v0.19.0

- DP-019 expanded and renamed Player Profile: a Chat button at the top,
  and each sport opens a sport page — level, summary numbers, matches
  and Sessions — across every Community; also reachable for yourself
  from the Me tab.
- New DP-020: Direct Messages — one-to-one conversations between players
  who share a Community (or organizer and requester), started from a
  profile, listed first in Inbox. Promoted from Planning; blocking,
  reporting and moderation stay Planning.

---

## v0.18.0

- New DP-019: Player Profile for Organizers — owners/admins open a
  player's profile (picture, name, username, online, joined date, skill
  level per sport) from Session participants and Community join
  requests, and can approve or decline a pending request from it.

---

## v0.17.0

- New DP-018: Push Notifications — seven events (Community and Session
  join requests and approvals, payment receipts and confirmations, a
  reminder 2 hours before a Session), on phones and web. A Notifications
  page behind a bell with an unread count, separate from Inbox. A switch
  per kind in Settings. Web becomes installable to the home screen so
  iPhone browsers can receive push.

---

## v0.16.3

- DP-017: a User keeps several towns (up to 10) with exactly one active;
  switching is one tap on the Me tab or in Explore. Explore lists the
  active town's Communities.

---

## v0.16.2

- DP-017: a Community's location and a User's town are now picked from a
  list of Indonesia's provinces and cities/regencies kept in the
  database, replacing free text. "Same town" becomes an exact match.

---

## v0.16.1

- DP-017: a User can set their town; Explore lists Communities in that
  town before a search is typed. Text match, not distance.

---

## v0.16.0

- New DP-017: Community Discovery & Joining — Communities are Public
  (default, join instantly) or Private (join by request, approved by
  owner/admin); Communities gain a location; search in Explore and a
  shareable link. Closes the gap left when "Join with Code" was removed.

---

## v0.15.0

- New DP-016: Display Name — a User can set, change and remove their own
  display name from the Me tab (1–40 characters, not unique). Username
  stays immutable.

---

## v0.14.2

- DP-015: security notices added — "password changed" to the account's
  email, "email changed" to the replaced address. Activity emails
  explicitly left out of scope.

---

## v0.14.1

- DP-015: mail provider decided — Resend. Scope updated: real delivery
  still needs a verified sender domain.

---

## v0.14.0

Account Email & Password Recovery approved.

Major updates:

- New DP-015: a User has an email confirmed by a 6-digit code. Required
  for new accounts (sign-up does not complete without it); existing
  accounts get a dismissible reminder instead. Login accepts username or
  confirmed email. Forgot-password sends a code to the confirmed email.
  Mail provider deliberately left undecided — sending is behind an
  interface and codes go to the server log until one is configured.

---

## v0.13.0

DP-007 Session Synchronization resolved; DP-009 cross-Club Session
History built.

Major updates:

- DP-007: the three open questions blocking Session Synchronization
  were answered by the product owner. All Template fields synchronize;
  start time and duration never do. Sessions edited by hand after
  generation are excluded. "Upcoming" means not started and not
  cancelled. Schedule Editing itself — approved since v0.3.2 but never
  given a screen — is now reachable from the Schedule's detail page.
- DP-009: the Player's own cross-Club Session History is implemented,
  opened from the Me tab.

---

## v0.12.0

DP-013 revised to share Session Chat's messaging engine; Online
Indicator introduced.

Major updates:

- DP-013 Contact Organizer revised: no longer a deliberately
  "lightweight" plain-text-only variant — per explicit product
  direction, it now shares one messaging engine with DP-011 Session
  Chat (images included), differing only in participants and the
  posting-window rule (Contact Organizer has none; Session Chat still
  closes 1 week after the Session ends). Server-side, both now ride
  the same `conversations`/`conversation_messages` schema instead of
  two near-duplicate tables.
- New DP-014: Online Indicator — a User attribute, shown as a green
  outline ring around a member's circle avatar (Club Members grid,
  its detail sheet, Add Member search). Derived from recent request
  activity, no push/websocket presence infrastructure involved.

---

## v0.11.0

Contact Organizer promoted out of Planning.

Major updates:

- New DP-013: a private, two-way, Session-scoped thread between one
  member and that Session's owner/admins collectively — distinct from
  DP-011 Session Chat's group thread. Plain text only, no images. Same
  posting-window and no-edit/no-delete rules as Session Chat.
- Removed Contact Organizer from Planning's Communication list; Direct
  Messages and Community-level chat remain unapproved.
- Inbox (placeholder since Milestone 1) got its first real content:
  every Contact Organizer thread the caller is a party to, either as
  the member or as an organizer replying, most-recently-active first.

---

## v0.10.0

Join Approval: joining a Session now always requires organizer approval
plus manual payment confirmation.

Major updates:

- DP-002: new Join Approval flow, always required, no per-Session
  opt-out — `Requested` (self-service join request, Strict Skill Level
  enforced here now, not at check-in) → organizer approves → `Waitlist`
  (approved, slot not claimed) → organizer confirms payment (manual, no
  gateway) → `Registered` (slot claimed) → self check-in within the
  Check-In Window → `Checked In`. Two new participant states
  (`requested`, `waitlist`) added to `session_participants.status`.
- New endpoints: `POST /sessions/:id/participants/:userId/approve`,
  `POST /sessions/:id/participants/:userId/confirm-payment`,
  `DELETE /sessions/:id/participants/:userId` (hard removal — declining a
  request, or removing someone outright, distinct from Cancelled/No Show
  which record what happened).
- `POST /sessions/:id/checkin` (self-service) no longer upserts/auto-
  registers — it now requires the caller already be `registered`
  (`SelfCheckIn`, a guarded transition). `POST /sessions/:id/register` is
  the actual "request to join" action now, and — for the first time —
  has a real screen behind it (`SessionDetailScreen`'s "Request to Join"
  button replaces the old one-tap "Check In" for a first-time joiner).
- Organizer-initiated actions are explicitly exempt from the whole chain:
  Host Playing's auto-check-in, "check in a member," and adding a guest
  all still go straight to `checked_in` via the unchanged `CheckIn`
  (upsert) function — only self-service joining is gated.
- Explicitly deferred: an actual payment gateway integration. "Confirm
  Payment" is a manual organizer action recording that payment happened
  outside the app — no card processing, no provider, no PCI exposure.
  Payments (automated) remains a Planning-only item.

---

## v0.9.0

Check-In Window (new rule); Match Format fields completed; match count
picker changed to a wheel.

Major updates:

- DP-002: added Check-In Window — check-in (self, organizer-initiated, or
  adding a guest) is only allowed from 1 hour before a Session's start
  time until it ends. Enforced server-side (`checkInWindowOpen` in
  `sessions_handler.go`, applied to `/checkin`, the new host-initiated
  checkin endpoint, and guest-add) and mirrored client-side
  (`isWithinCheckInWindow` in `sessionSchedule.ts`) to hide/disable the
  affordances before a request would 403 anyway. Host Playing's
  auto-check-in on Session creation is explicitly exempt — it's the
  organizer's declared intent at creation time, not a check-in action.
- Engineering fix, no product decision change: `AddMatchScreen`'s Match
  Format picker was missing the actual configuration fields for Fixed
  Games (total games, golden-game-on-tie) and Race To (target games) —
  it only hardcoded defaults (4 games) with no way to adjust them. Best
  of Sets was missing its sets-to-win/super-tiebreak fields too. All
  three now match the web version's `MatchSetup.tsx` reference fields
  (steppers for total games/target games, 1/2/3 pills for sets to win,
  switches for golden game/super tiebreak).
- Engineering, explicitly requested: "Number of matches" (Generate
  Matches) changed from a text input to a collapsible wheel picker,
  matching the app's established pattern for other numeric pickers
  (Duration, Skill Level range).

---

## v0.8.3

Host-initiated Check-In.

Major updates:

- DP-002 already listed Check In as Organizer-or-Self-service — no doc
  text changed. Closes the implementation gap: owner/admin can now check
  in another club member directly from `SessionDetailScreen` ("Check in a
  member" — shown for members not yet checked in, excluding the caller,
  who already has the main Check In button). New endpoint
  `POST /v1/sessions/:id/participants/:userId/checkin`, same `db.CheckIn`
  upsert self check-in uses (auto-registers if needed), same Strict Skill
  Level gate applied to the target member rather than the caller.

---

## v0.8.2

Generate Matches now takes an organizer-defined match count; Generate
Match (singular) removed as redundant with Custom Match; AddMatchScreen
recolored to blue.

Major updates:

- DP-005 Match Generation: removed the "Generate Match" (one match) tab —
  it duplicated Custom Match's own suggested pre-fill. Add Match now has
  two tabs: **Generate Matches** (first/default) and **Custom Match**.
- Generate Matches now takes an organizer-defined match count (a number
  input, defaulting to a rough estimate from the Session's Duration —
  `matchGenerator.ts`'s `suggestedMatchCount`, ~3.5 matches/hour,
  organizer-adjustable, not a strict formula). `generateFairRound` was
  reworked to draw `count` matches total, cycling players through fairly
  when the requested count needs more matches than there are checked-in
  players to cover in one pass — previously it stopped after exactly one
  lap through the player pool.
- Regenerate now regenerates the same match count that was just deleted
  (previously: always "one full lap" of the checked-in pool).
- Engineering, explicitly requested: `AddMatchScreen`'s selected-state
  highlights (tabs, mode picker, match format picker) and primary buttons
  changed from amber/orange to blue, matching the rest of the app (most
  screens' primary actions use `action="secondary"`/blue-600, not the
  design system's technically-named-but-rarely-used amber `primary`
  token).

---

## v0.8.1

Terminal Sessions (Cancelled/Completed) disable all actions; Session
Detail page shows more of what's already there.

Major updates:

- DP-001: added "Terminal Session Actions" — a Cancelled or Completed
  Session accepts no further actions (check-in, add match, add guest,
  start/watch a match). History (who checked in, past matches) stays
  visible; only the actions that would change the Session are removed.
  `SessionDetailScreen` gained a single `isSessionActive` gate applied
  everywhere this matters.
- `SessionDetailScreen` gained a Details card surfacing fields that
  already existed on the Session model but were never shown: Sport,
  Activity Type, Date & Time, Duration, Capacity (joined/max), and
  Description. No new backend/data — purely closing a display gap.

---

## v0.8.0

Match Generation: Generate Match, Generate Matches, Regenerate, fair
playing-number balancing.

Major updates:

- DP-005: for Singles/Doubles Sessions, Add Match now offers three paths —
  Generate Match (one fair match now), Generate Matches (a full fair
  round for everyone checked in), and Custom Match (the original manual
  participant-picker, unchanged, still able to pick a one-off different
  mode than the Session's own). Class Activity Type Sessions keep the
  Custom Match flow only, as before.
- Fairness: Generate Match/Matches prioritize whichever checked-in
  players have played the fewest matches this Session. This promotes
  "Match balance" from Scheduler Evolution (Planning) to Ready to
  Develop, explicitly requested by the user — partner diversity, opponent
  diversity, and skill balancing remain Planning-only.
- Regenerate: once a new check-in isn't covered by any queued match, the
  organizer sees a Regenerate option — deletes all queued (not started)
  matches and generates a fresh fair round from everyone now checked in.
  Requires an explicit organizer tap, same as every other DP-005 action —
  never silent/automatic, preserving "organizer confirmation is always
  required."
- New backend capability: `DELETE /v1/activities/:id`, restricted to
  queued (not yet started) matches — needed for Regenerate, didn't exist
  before.
- Engineering note: `AddMatchScreen` migrated from the legacy
  `components/ui/*` primitives to the `design-system/*` component set,
  matching the rest of the app's newer screens (requested explicitly —
  "match the UI of add match page with the rest of the app").
- Deferred, not built this round (explicit user decision): push
  notifications on check-in. The Regenerate option surfaces on its own
  via the Session Detail screen's normal refresh, no push infra involved
  yet.

---

## v0.7.1

Session status pill color-coded in the list/history views.

Major updates:

- Engineering fix, no product decision change: `SessionCard`'s status
  pill previously rendered every status (draft/open/in_progress/
  completed/cancelled) with the same neutral gray `Badge`, making Open
  and Cancelled indistinguishable at a glance. Each status now gets a
  distinct color — draft: amber, open: blue, in_progress: green,
  completed: gray, cancelled: red. `Badge`'s `warning`/`info` actions
  gained dark-mode variants as part of this (previously light-only,
  unused by any real screen).

---

## v0.7.0

Skill Level requirement reverted from mandatory to optional.

Major updates:

- DP-008: a Session's Skill Level range is no longer mandatory (reverting
  the v0.5.1 change) — most Sessions won't set one. The range stays
  bounded, though: if `skillLevelMinId` is set, `skillLevelMaxId` (and
  `skillLevelEnforcement`) become mandatory, and vice versa — there's no
  one-sided range. `validateSkillLevelRange` already enforced this
  all-or-nothing rule; only the outer "must be set at all" gate was
  removed from both Session and Recurring Schedule creation.
- `CreateSessionScreen` gained a "Require a skill level?" toggle,
  defaulting off — `SkillLevelRangePicker` is now hidden until the
  organizer opts in, instead of always shown.

---

## v0.6.3

Club-scoped Session History (DP-009) implemented; Session list now shows
date/time and joined/max capacity.

Major updates:

- DP-009 Session History: implemented the Club-scoped half. Session lists
  now bucket by scheduled date (not status) — a same-day Cancelled Session
  stays visible in the active list instead of disappearing, since it's
  bucketed by date, not status. `SessionListScreen` splits into "Today"
  and "Upcoming" sections; a new "Past Sessions" entry point opens
  `SessionHistoryScreen`, a read-only, most-recent-first view of that
  Club's own past Sessions. The cross-Club "every Session I've joined"
  view remains not yet implemented.
- Session list items now show scheduled date/time and joined/max
  participant count, color-coded (green while spots remain, red once
  full) — backend gained a computed `joinedCount` field (DP-002 headcount:
  registered/checked_in/checked_out) on `GET /sessions`/`GET /sessions/:id`.
- Engineering note: `Badge`'s `success`/`error` actions gained dark-mode
  variants (previously light-only, unused by any real screen) to support
  the new capacity color-coding.

---

## v0.6.2

Session Cancel exposed in the UI.

Major updates:

- `SessionDetailScreen` now has a "Cancel Session" action (owner/admin,
  behind a confirm dialog) — no product or backend change, DP-001 already
  defines Cancelled as reachable from any non-terminal state and the
  guarded `PATCH /sessions/:id {status: 'cancelled'}` transition (plus its
  `cancelSession()` client wrapper) already existed; this closes an
  implementation gap, same category as v0.6.1's Number of Players fix.
- Sessions do not get a hard "delete" — only Cancel. This mirrors DP-007's
  existing reasoning for Recurring Schedule Occurrences: Session Lifecycle
  (DP-001) is deliberately not extended with a "deleted" state.

---

## v0.6.1

Host Playing added; Number of Players exposed in the Create Session flow.

Major updates:

- DP-004: added Host Playing — every Session and Recurring Schedule
  Template must declare whether the organizer intends to play, not just
  run, the Session. Mandatory, defaults to "yes." When "yes," the
  organizer is auto-checked-in as a participant on creation (or on each
  generated Session, for Recurring Schedules) — the organizer's own
  declared intent, so it bypasses Strict Skill Level (DP-008), unlike a
  third-party join.
- Maximum Participants (already an approved DP-004 Organizer Preference,
  never exposed in the UI) is now settable on the Create Session screen —
  no product/backend change, closing an implementation gap.

---

## v0.6.0

Session Identity, Description, and Duration Range refined.

Major updates:

- DP-004: Name and Venue are now mandatory Session Identity fields on every
  Session and Recurring Schedule Template — no longer optional, no
  server-side auto-generated name fallback.
- DP-004: added optional free-text Description, available on every Session
  and Recurring Schedule Template, never required.
- DP-009: Duration is now selected in hourly increments, 1-24 hours (up
  from a 30/60/90/120-minute set) — no tournament-length Sessions yet, so
  24 hours is a deliberate scope boundary.
- Planning: added Map-Based Venue Selection — Venue stays free text until a
  map provider API key is available; not yet scheduled.

---

## v0.5.2

Activity Type documented retroactively.

Major updates:

- Added Activity Type under DP-004 (Organizer Preferences) — Sport-Module-
  owned, mandatory on every Session and Recurring Schedule Template,
  chosen after Sport. Tennis: Singles, Doubles, Class.
- Clarified Activity Type is distinct from Default Activity Configuration
  — different fields answering different questions, not substitutes.
- This decision was already implemented in code before being written here
  — the doc was out of sync with the build for one round; this closes
  that gap.

---

## v0.5.1

Skill Level and Duration made mandatory.

Major updates:

- DP-008: Skill Level range is now required on every Session and Recurring
  Schedule Template — no longer optional.
- DP-009: start time and Duration are now both required together at
  creation, for ad-hoc Sessions and Recurring Schedules alike.
- Implementation note (not a product change): Session History screens are
  being built after the auto-transition mechanics, not in the same pass.

---

## v0.5.0

Session Duration introduced.

Major updates:

- Added DP-009 — Session Duration: only meaningful together with a
  Session's start time.
- Defined backend-driven auto-transition on Duration elapsing: In
  Progress → Completed, any other non-terminal state → Cancelled.
- Introduced Session History as a concept — Club-scoped inside a Club,
  cross-Club ("Sessions I've joined") outside one.
- Resolved the "Session Duration" open question from Domain Evolution
  Planning; removed the placeholder now that it's decided.
- Added Session Duration to the Phase 1 roadmap.

---

## v0.4.1

DP-008 Level Scale corrected to be per-Sport.

Major updates:

- The Level Scale is now explicitly owned by the Sport Module (DP-ARCH-002),
  not one list shared across all sports — different sports commonly grade
  players differently (e.g. Tennis's named tiers vs. Padel's numeric
  ladder). Caught during implementation planning, before any schema was
  written.
- Tennis's scale (Newbie through Advanced) is unchanged. Other sports'
  scales are defined when that sport itself is introduced.

---

## v0.4.0

Player Skill Level introduced.

Major updates:

- Added DP-008 — Player Skill Level: self-reported, owned by the player,
  scoped per Sport.
- Defined an initial, explicitly reconfigurable Level Scale (Newbie through
  Advanced).
- Sessions and Recurring Schedule Templates may optionally define a Skill
  Level range, with a per-Session Strict/Guidance enforcement choice.
- Added Player Skill Level to the Phase 1 roadmap.

---

## v0.3.2

Recurring Schedule semantics finalized ahead of implementation.

Major updates:

- Introduced the occurrence concept between Recurring Schedule and Session; skipping an occurrence is explicitly distinguished from cancelling a Session, and does not extend Session Lifecycle with a "deleted" state. Occurrence tracking remains an internal implementation detail, not a first-class domain object.
- Simplified auto-publish wording: generated Sessions are always automatically published (removed "by default," which implied configurability that isn't intended).
- Defined generation as eventually consistent: a generation outage must be followed by catch-up generation of every missed occurrence, and generation must stay idempotent.
- Template is now defined by reference: "the Organizer Preferences defined in DP-004," rather than a duplicated field list.
- Session Synchronization is explicitly called out as blocked on three unresolved questions (field scope, manual-edit conflict, definition of "upcoming") and must not be implemented until they're resolved.

---

## v0.3.1

Recurring Schedule specification refined.

Major updates:

- Generated Sessions reference their originating Recurring Schedule.
- Generated Sessions are automatically published.
- Added optional Schedule end date.
- Added recurrence idempotency invariant.
- Clarified deleted occurrences must never be regenerated.

---

## v0.3.0

Recurring Schedules introduced.

Major updates:

- Replaced Session Templates with Recurring Schedules.
- Added Recurring Schedule as a Core Domain.
- Template is now owned by a Recurring Schedule.
- Formalized Schedule vs Session ownership.
- Added Generation Policy.
- Added Active / Paused schedule lifecycle.
- Defined synchronization behavior for generated Sessions.
- Deleted generated Sessions are never recreated.

---

## v0.2.0

Foundation milestone completed.

Major updates:

- Established Product Principles.
- Added Domain Principles.
- Formalized Session Lifecycle.
- Formalized Participant Lifecycle.
- Defined Sport Module responsibilities.
- Introduced Activity as a first-class domain concept.
- Renamed Session Configuration to Organizer Preferences.
- Renamed Default Match Configuration to Default Activity Configuration.
- Established Scheduler philosophy.
- Clarified backend ownership of shared business state.
- Expanded Planning for future domain evolution.
