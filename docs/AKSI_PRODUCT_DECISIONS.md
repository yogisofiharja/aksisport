# AKSI Product Decisions

Version: 0.12.0

Status: Living Document

---

# Purpose

This document is the single source of truth for AKSI's product decisions, domain principles, and long-term vision.

Everything under **Ready to Develop** is approved for implementation.

Everything under **Planning** exists only to guide future architecture and should not be implemented until promoted into Ready to Develop.

When new product decisions are approved, this document should be updated before implementation continues.

Change history lives in `AKSI_PRODUCT_DECISIONS_CHANGELOG.md`, not here — this document only ever describes the current state.

---

# Product Vision

AKSI is a platform for organizing community sports activities.

Scoring is only one part of the experience.

AKSI helps communities organize activities before, during, and after a sports session.

---

# Product Principles

## Community First

Communities are the center of the platform.

Everything else exists to support communities.

---

## Organizer First

Organizers coordinate the session.

Players participate.

The system assists organizers rather than replacing them.

---

## AI Assists, Humans Decide

Recommendations are suggestions.

Organizers always make the final decision.

The system should explain recommendations whenever possible.

---

## Simplicity Before Intelligence

Every workflow should first have a deterministic implementation.

Examples:

- Scheduler before Smart Scheduler
- Manual organizer decisions before automation
- Fixed rules before fairness optimization

Intelligence should enhance workflows, never replace them.

---

## Continuous Evolution

The product will continue evolving.

Engineering should evolve with the product instead of protecting previous implementations.

---

# Domain Principles

## DP-ARCH-001 — Evolution over Replacement

Before implementing any approved decision:

1. Compare with the existing implementation.
2. Preserve everything that already satisfies the product decision.
3. Implement only the missing or conflicting parts.
4. Prefer incremental migration over rewriting.
5. Preserve working functionality whenever possible.

---

## DP-ARCH-002 — Domain Ownership

Each domain owns its own responsibilities.

### Sport Module

Owns sport-specific knowledge.

Examples:

- Supported activity types
- Match modes
- Scoring rules
- Validation rules
- Minimum participants
- Court requirements

---

### Session

Owns organizer intent.

Examples:

- Venue
- Schedule
- Pricing
- Participant limit
- Organizer preferences
- Session lifecycle

A Session may ask the Sport Module for sport-specific knowledge, but the Sport Module never owns session behavior.

---

## DP-ARCH-003 — Backend Owns Shared Business State

Business state shared across multiple clients should be derived by the backend.

Derived values should not be persisted unless explicitly required.

Examples:

- Session lifecycle
- Session readiness
- Future notifications
- Reporting
- Analytics

Clients should focus on presentation and user interaction.

---

## DP-ARCH-004 — Engineering Autonomy

Engineering should make reasonable implementation decisions when:

- product behavior is unaffected,
- future architecture remains healthy,
- and assumptions are documented.

Escalate decisions that affect:

- business rules
- user experience
- product philosophy
- domain model
- long-term architecture

---

# Core Domain

## Community

Communities organize:

- Recurring Schedules
- Sessions

---

## Recurring Schedule

A Recurring Schedule defines how Sessions are generated over time.

A Recurring Schedule owns:

- Template
- Recurrence Rule
- Generation Policy
- Status (Active / Paused)

Generated Sessions become independent after creation.

---

## Session

A Session represents a single sports gathering.

A Session owns:

- organizer preferences
- participant lifecycle
- activities
- scheduling
- lifecycle

---

## Activity

A Session contains Activities.

An Activity represents one playable unit inside a Session.

Examples:

- Match
- Practice
- Drill
- Challenge

The Tennis MVP currently supports Match activities only.

---

## Sport Module

Each sport provides its own rules and capabilities.

Examples:

- Tennis
- Padel
- Pickleball

---

# Ready to Develop

## DP-001 — Session Lifecycle

Status

Approved

### Explicit States

- Draft
- In Progress
- Completed
- Cancelled

These represent organizer actions.

They are persisted.

---

### Derived States

- Recruiting
- Ready
- Full

These represent session conditions.

They are derived.

They should never be persisted.

The backend should expose the resolved lifecycle state.

---

### Lifecycle

Draft

↓

Publish

↓

Recruiting

↓

Minimum participant threshold reached

↓

Ready

↓

Maximum participant limit reached (if any)

↓

Full

↓

Session's scheduled start time arrives

↓

In Progress

↓

Session's Duration elapses

↓

Completed

Cancelled may occur from any non-terminal state.

Neither the In Progress nor the Completed transition above is an
organizer action — both are backend-driven, matching DP-ARCH-003 and
DP-009's Auto-Start / Auto-Transition. Recruiting/Ready/Full describe
the Session's condition, not a gate the organizer must clear before it
can start; an under-subscribed Session still starts automatically once
its scheduled time arrives.

---

### Visibility

Draft sessions

- visible only to organizers
- not joinable
- hidden from members

---

### Terminal Session Actions

A Cancelled or Completed Session accepts no further actions — no
check-in, no adding a match, no adding a guest, no starting or watching a
queued/live match. The Session and its history (who was there, what
matches happened) remain fully visible; only the actions that would
change it are removed.

---

## DP-002 — Participant Lifecycle

Status

Approved

### Participant States

- Requested
- Waitlist
- Registered
- Checked In
- Checked Out
- Cancelled
- No Show

---

### Ownership

Requested

- Self-service only (a join request)

Waitlist

- Organizer only (approving a request)

Registered

- Organizer (confirming payment)
- Self-service (organizer-initiated actions bypass Requested/Waitlist
  entirely — see Join Approval below)

Checked In

- Organizer
- Self-service

Checked Out

- Organizer
- Self-service

Cancelled

- Organizer
- Self-service

No Show

- Organizer only

Strict transition validation will be introduced in a future milestone.

---

### Join Approval

Joining a Session always requires organizer approval — no exception, and
no per-Session opt-out. The self-service flow is:

```
Requested --organizer approves--> Waitlist --organizer confirms
  payment--> Registered --self check-in (Check-In Window)--> Checked In
```

- **Requested**: a member asks to join. Strict Skill Level (DP-008) is
  enforced at this point — an ineligible member can't even request.
- **Waitlist**: the organizer has approved the request, but the slot
  isn't claimed yet — the member must pay to claim it.
- **Registered**: payment is confirmed and the slot is claimed. There is
  no payment gateway — the organizer receives payment outside the app
  (cash, transfer, etc.) and confirms it manually. Building an actual
  payment gateway integration is future work (see Payments, Planning),
  not part of this decision.
- **Checked In**: the member confirms their own arrival, self-service,
  only once Registered and within the Check-In Window.

Organizer-initiated actions — Host Playing's auto-check-in on Session
creation, an organizer directly checking in a club member, and adding a
guest — all bypass this entire chain and go straight to Checked In. They
are already an organizer decision; approval and payment don't apply to
them.

Organizers may remove a participant entirely at any point (declining a
request, or removing someone outright) — a hard removal, distinct from
Cancelled/No Show, which record what happened rather than erase it.

---

### Check-In Window

Check-in (self, organizer checking someone else in, or adding a guest —
a guest is inserted directly as checked-in) is only allowed from 1 hour
before the Session's start time until the Session ends
(`startsAt + duration`). Outside that window, check-in is blocked, no
exception. This applies uniformly regardless of who initiates it.

Host Playing (DP-004) auto-check-in on Session creation is not affected —
it is the organizer's own declared intent at creation time, not a
check-in action subject to this window.

---

## DP-003 — Sport Modules

Status

Approved

Sport Modules own sport-specific rules.

Current Tennis implementation

Singles

- Minimum participants = 2

Doubles

- Minimum participants = 4

Future sports should follow the same abstraction.

---

## DP-004 — Organizer Preferences

Status

Approved

Organizer preferences describe how the organizer intends to run the Session.

Examples:

- Name
- Venue
- Description
- Schedule
- Pricing
- Maximum participants
- Activity Type
- Default Activity Configuration

---

### Session Identity

Every Session (and every Recurring Schedule Template) must define a Name
and a Venue. This applies uniformly — ad-hoc Session creation and
Recurring Schedule creation both require both fields, with no exception.

Venue is currently a free-text field. Selecting a Venue from a real map
(for example, via a map provider's place picker) is planned but not yet
implemented — see Planning.

---

### Description

A Session (and every Recurring Schedule Template) may optionally include a
free-text Description — details for players such as what to bring, house
rules, or anything else the organizer wants to communicate. Description is
not part of Session Identity and is never required.

---

### Host Playing

Every Session (and every Recurring Schedule Template) must declare whether
the organizer intends to play, not just run, the Session. This applies
uniformly — ad-hoc Session creation and Recurring Schedule creation both
require it, with no exception. It defaults to "yes" so the organizer isn't
forced to think about it in the common case, but the value is always
explicit, never silently inferred.

When Host Playing is "yes", the organizer is automatically added as a
registered participant (DP-002) the moment the Session is created — for a
Recurring Schedule, this happens on every generated Session. This is the
organizer's own declared intent to play, not a third-party join request,
so it is not subject to a Session's Strict Skill Level requirement
(DP-008) — an organizer is never blocked from their own Session.

Checked In specifically means physically present and ready to play —
that's the entire reason the Check-In Window (DP-002, 1 hour before the
Session starts) exists. Host Playing being "yes" is a declaration of
intent made in advance, not a claim of presence, so it lands the
organizer at Registered, not Checked In. The organizer still checks
themselves in for real, same as anyone else, once the Check-In Window
opens and they're actually there. (Revised — this previously landed the
organizer directly at Checked In on creation, before that distinction
was drawn out explicitly.)

---

### Activity Type

Every Session (and every Recurring Schedule Template) must declare an
Activity Type. The organizer chooses Sport first, then Activity Type —
the available choices depend on the chosen Sport.

Activity Type is owned by the Sport Module (DP-ARCH-002), the same as the
Sport itself — each Sport defines its own set of Activity Types.

Tennis's Activity Types:

- Singles
- Doubles
- Class

Activity Type is distinct from Default Activity Configuration below —
Activity Type describes what kind of Activity a Session is for (a match
mode, or a non-match Activity like a coached Class); Default Activity
Configuration seeds a new Activity's scoring format. They answer different
questions and are not substitutes for one another.

---

### Default Activity Configuration

The default configuration represents organizer intent.

It is not a restriction.

Existing Activities remain unchanged when the default changes.

Future Activities may use the updated configuration.

---

## DP-005 — Scheduler

Status

Approved

The Scheduler recommends the next Activity.

Responsibilities:

- Suggest participants.
- Explain the recommendation.
- Respect current participant availability.
- Never create Activities automatically.
- Never override organizer decisions.

Organizer confirmation is always required — every action below still needs
an explicit organizer tap; none of them fire on their own in the
background.

---

### Match Generation

For a Session (or Recurring Schedule) whose Activity Type is Singles or
Doubles, the organizer has two ways to add matches:

- **Generate Matches** — the organizer sets how many matches to generate
  (a number, defaulting to a rough estimate from the Session's Duration —
  organizer-adjustable, not fixed). Matches are fairly drawn from any
  participant with a claimed spot — registered or checked-in, not
  checked-in alone (revised) — who isn't already in a queued or live
  match; this lets the organizer plan a round before anyone's physically
  checked in, though a match's own players still need to actually check
  in before they can start it. If the requested count needs more matches
  than there are players to cover in one pass, players cycle through
  again rather than the batch stopping early. Generating just one match
  is simply setting the count to 1 — there is no separate "one match"
  action, since that would only duplicate Custom Match's own suggested
  pre-fill. The organizer may also choose to delete every currently
  queued match as part of the same action (a "remove existing matches"
  option), replacing the queue in one step instead of a separate
  Regenerate trip.
- **Custom Match** — the organizer manually builds a match: participants,
  mode, and all. The mode is not required to match the Session's own
  Activity Type — a Doubles Session may still have a one-off Custom
  Singles match. This is the original, unrestricted match-creation flow,
  unchanged.

Once a generated batch is played through, if there's still time left in
the Session, the organizer can generate another batch (any size) or add a
Custom Match — Generate Matches is not a one-time action.

A Class Activity Type has no match-generation concept — only Custom Match
applies there, same as before this decision.

Fairness: Generate Matches balances two things, not one. Fewest-played
is still the primary sort — whichever eligible players have played the
fewest matches so far this Session go first. Ties are no longer broken
purely at random: **longest-waiting-since-last-match** is the tiebreak
(a player is ordered by how long it's been, in match order, since their
last match; never having played counts as having waited longest). Only
a genuine remaining tie (same play count and same last-played position —
e.g. everyone's never played) falls back to random. This is "Match
balance" (equal/fair playing number) and "Waiting time," both promoted
here from Scheduler Evolution (Planning) — explicit product requirements
(a fair number of matches *and* a fair wait between them), not a general
fairness/AI engine. Partner diversity, opponent diversity, and skill
balancing remain Planning-only.

### Regenerate

Once matches exist, if a player becomes eligible (registered or
checked-in) who isn't covered by any currently queued (not yet started)
match, the organizer also sees a **Regenerate** option they can trigger
manually at any time. Regenerating deletes every currently queued match
and generates the same number of matches again, fairly, from everyone
currently eligible — live and completed matches are never touched.

Regeneration also now happens **automatically**: whenever the eligible
(registered-or-checked-in) pool changes for any reason (a new
registration, a late check-in, an eligible player cancelling their
participation, being removed by the organizer, marked a no-show, or
checking out) while matches are still queued, the app regenerates the
queue itself — the organizer doesn't have to notice the mismatch and
remember to tap Regenerate. (Revised — this previously required an
explicit tap every time, with no silent/automatic path, and only
tracked the checked-in pool rather than the wider eligible one.)

---

## DP-006 — Check-in Driven Workflow

Status

Approved

Workflow

Join Session

↓

Check In

↓

Suggest Activity

↓

Organizer Confirms

↓

Play Activity

↓

Finish Activity

↓

Suggest Next Activity

Only checked-in participants may participate.

---

## DP-007 — Recurring Schedules

Status

Approved

### Decision

Introduce a new domain object: **Recurring Schedule**.

A Recurring Schedule generates Sessions. It is not a Session.

It owns:

- Template
- Recurrence Rule
- Generation Policy
- Status (Active / Paused)

The Template consists of the Organizer Preferences defined in DP-004. It is not a standalone entity.

Each point in time defined by the Recurrence Rule is an occurrence. An occurrence generates at most one Session.

Occurrence tracking is an internal implementation detail. It is not required to become a first-class domain object.

### Schedule Editing

Editing a Recurring Schedule:

- always affects future Sessions that have not yet been generated
- optionally updates all already-generated upcoming Sessions after organizer confirmation
- does not support selecting individual Sessions for synchronization

Session Synchronization must not be implemented until the following are resolved:

- Which Template fields are synchronized to already-generated upcoming Sessions, and which remain local to the Session.
- Whether synchronization overwrites a Session that has already been manually edited, or excludes it.
- The definition of "upcoming" for synchronization purposes, relative to Session Lifecycle (DP-001) states.

### Session Editing

Editing a Session:

- affects only that Session
- never updates the parent Recurring Schedule
- never affects other Sessions

### Generation Policy

Configuration:

- Generate X days before
- Optional generation time

If generation time is omitted, the Session start time is used.

Generation is eventually consistent. If generation is unavailable for any period, once it resumes it must generate every missed occurrence that still satisfies the Generation Policy. Generation must remain idempotent — each occurrence generates at most one Session regardless of how many times generation runs.

### Pause

Paused schedules stop generating future Sessions.

Existing Sessions remain unchanged.

### Delete

Deleting a Recurring Schedule:

- stops future generation
- preserves all generated Sessions

### Skipping an Occurrence

An organizer may intentionally skip an occurrence, either before it generates a Session or after (for example, by deleting the Session already generated for that occurrence).

A skipped occurrence must never generate a Session.

Skipping an occurrence is not the same business event as cancelling a Session. A Cancelled Session communicates that a Session existed and was cancelled. A skipped occurrence communicates that the occurrence should never produce a Session at all. Session Lifecycle (DP-001) is not extended with a "deleted" state to represent this.

### Additional Rules

Generated Sessions should keep a nullable reference to their originating Recurring Schedule.

Generated Sessions are automatically published.

A Recurring Schedule may optionally define an end date. If no end date is provided, generation continues until the Schedule is paused or deleted.

Product invariant:

- One occurrence may generate at most one Session.
- A skipped occurrence must never generate a Session.

---

## DP-008 — Player Skill Level

Status

Approved

### Decision

Introduce Player Skill Level.

A player's skill level is owned by the player, scoped per Sport — a player
may be at a different level in Tennis than in Padel.

A Player has exactly one Skill Level per Sport.

Player Skill Level is self-reported.

Players may update their own Skill Level at any time.

Future milestones may introduce optional supporting evidence (for example, certificates) without changing player ownership of the Skill Level.

### Level Scale

The Level Scale is owned by the Sport Module (DP-ARCH-002), not shared
globally across sports — different sports commonly grade players
differently (for example, Tennis with named tiers, Padel with a numeric
ladder). A player's Skill Level is always scoped to one Sport's own scale.

Tennis's Level Scale, ordered lowest to highest:

- Newbie
- Beginner
- Upper Beginner
- Intermediate
- Upper Intermediate
- Advanced

Each Sport's scale is expected to be reconfigured over time — renamed,
reordered, or extended — independently of other Sports' scales. It must
not be implemented as a fixed, unchangeable set.

Other Sports' scales (for example, Padel) are defined when that Sport
itself is introduced, not in advance.

### Session Level Requirement

A Skill Level range on a Session (or Recurring Schedule Template) is
optional — most Sessions won't set one. But the range is bounded: if a
minimum is defined, a maximum (and an enforcement mode) must be defined
too, and vice versa. There is no such thing as a one-sided range. This
applies uniformly — ad-hoc Session creation and Recurring Schedule
creation both follow the same all-or-nothing rule.

The organizer chooses, per Session, one of two enforcement modes:

- Strict — a player outside the Session's level range cannot register.
- Guidance — a player outside the Session's level range sees a warning but
  may still register.

Skill Level ranges are inclusive.

Example:

Beginner → Intermediate includes:

- Beginner
- Upper Beginner
- Intermediate

---

## DP-009 — Session Duration

Status

Approved

### Decision

Every Session must define a Duration and a start time (a core Session
property, see DP-007). Duration is only meaningful together with a start
time, so both are required together at creation — this applies uniformly
to ad-hoc Session creation and Recurring Schedule creation.

### Duration Range

Duration is selected in hourly increments, from a minimum of 1 hour up to
a maximum of 24 hours. There is no support for tournament-length Sessions
(multi-day) yet — the 24-hour ceiling is a deliberate scope boundary, not
a technical limit, and will be revisited when tournament support is
planned.

### Auto-Start

There is no manual "Start Session" organizer action. Once a published
(Open) Session's scheduled start time (`startsAt`) arrives, it
automatically transitions to In Progress. A Draft Session is
unaffected (never published, nobody could have joined) — if a Draft's
scheduled time passes while it's still a Draft, it's caught by
Auto-Transition below instead, which cancels it the same as any other
Session that never started.

### Auto-Transition

When a Session's Duration elapses:

- If the Session is In Progress, it automatically transitions to
  Completed.
- If the Session was never started (any non-terminal state other than In
  Progress), it automatically transitions to Cancelled.

This is a backend-driven transition (DP-ARCH-003). Organizers are not
required to act for a Session's lifecycle to resolve once its scheduled
time has passed.

### Session History

Sessions are surfaced as history once their scheduled date has passed —
not mixed into the active Session list. A Session scheduled for today
stays in the active list regardless of status, so a same-day Cancelled
Session doesn't disappear from view; in practice Completed/Cancelled
Sessions are exactly what accumulate once a date is behind us, thanks to
Auto-Transition above.

History is contextual to where the Player is looking:

- Inside a Club, history shows that Club's own past Sessions.
  **Implemented** (v0.6.3) — the active list splits into Today/Upcoming,
  with a "Past Sessions" entry point to a separate, read-only history view.
- Outside a Club (a Player's own view), history shows every Session the
  Player has joined, across all Clubs. **Not yet implemented.**

---

## DP-010 — Session Pricing

Status

Approved

### Decision

A Session (and every Recurring Schedule Template, copied onto each
generated Session same as every other Template field) may optionally
declare a price. Three models, `free` by default:

- **Free** — no cost. The default; an organizer never has to think
  about pricing unless they opt in.
- **Per Person** — a fixed fee (whole IDR) every participant pays.
- **Split Bill** — the organizer enters one total bill amount (whole
  IDR); the per-person share is `total / joined count`, always
  **computed, never stored** — it must reflect the current headcount,
  not a snapshot from whenever the price was set. "Joined" here is
  DP-002's existing `joinedCount` definition (registered + checked_in +
  checked_out; cancelled/no_show excluded) — someone who requested or is
  waitlisted doesn't have a claimed spot yet, so isn't counted, but
  someone already checked in still owes their share, so status
  progressing past `registered` doesn't drop them out of the split.

IDR has no subunit in practice — both amount fields are plain integers,
not a fractional/decimal type.

### Scope

This is a display/informational feature, not a payment flow: AKSI
records what a Session costs and shows each participant's computed
share. It does **not** track who has paid, does not integrate a payment
gateway or processor, and does not gate Check-In or participation on
payment for this price — that remains entirely outside the app,
consistent with DP-002's existing manual "Confirm Payment" step (which
records that an organizer received payment for a join request, a
different and pre-existing mechanism this doesn't change).

### Relationship to "Payments" (Planning, below)

This promotes "Session fees" out of Planning. The rest of the Payments
Planning item — an actual payment gateway, membership/guest fees,
refunds — remains unapproved and unbuilt.

---

## DP-011 — Session Chat

Status

Approved

### Decision

Every Session has one chat — plain text messages, visible to and
postable by anyone who can already see that Session (the same access
`GET /v1/sessions/:id` already requires: any member of the parent Club
once the Session is published, owner/admin only while still Draft).
Deliberately **not** narrowed to "participants only" — a member asking
"is there still room?" or "can I still join?" needs to be able to post
before they've joined, not after.

Messages are plain text, optionally with a single attached image, shown
oldest-first. There is no editing or deleting a sent message, no
attachments other than one image (files, location), and no read
receipts or typing indicators. Delivery is a short client-side poll
while the Chat tab is open, not a push/websocket channel — consistent
with the rest of the app, which has no live sync anywhere yet.

**Images**: stored directly in Postgres (`bytea`), not an object store
— this app has no cloud storage/CDN provisioned, and the one
half-configured option (Firebase Storage) requires the paid Blaze plan
and would need its own versioned security rules this repo has no way
to deploy yet. Capped at 5MB decoded, JPEG/PNG/WebP only, one per
message, served through its own authenticated endpoint rather than
embedded in the message list — so the 5-second poll never re-transfers
image bytes for messages already on screen.

**Posting window**: new messages can only be sent until 1 week after
the Session ends (`startsAt + durationMinutes`) — after that, the chat
becomes permanently read-only. History is never deleted or hidden; the
window only closes the ability to add to it. A Session missing
`startsAt`/`durationMinutes` (legacy, pre-DP-009) has no defined
window and is never restricted.

### Scope

This is the first of the four Communication contexts named in
`AKSI_INFORMATION_ARCHITECTURE.md` (User↔User DMs, Community,
Session, Contact Organizer) to get a product decision — Contact
Organizer followed as DP-013; Direct Messages and Community-level
chat remain undefined (see `docs/IMPLEMENTATION_ROADMAP.md`'s
Milestone 6), and are **not** approved by this decision. Moderation
(an organizer removing a message, reporting) is explicitly out of
scope for this first pass — a known, deliberate gap, not an
oversight.

### Relationship to "Communication" (Planning, below)

This promotes Session-scoped Chat specifically out of Planning.
Contact Organizer followed as DP-013, below. Direct Messages and
Community-level chat remain unapproved and unbuilt.

---

## DP-012 — Session Finance

Status

Approved

### Decision

Surfaces DP-002's existing manual payment-confirm step (Waitlist →
Registered) as its own Session-owned Payment tab, instead of a small
inline action buried in the Participants tab. Two new pieces on top of
what DP-002/DP-010 already defined:

- **Club bank accounts** — a Club owner can list one or more bank
  accounts (bank name, account number, account holder name), shown to
  every member on a priced Session's Payment tab so they know where to
  send money. Plain display fields, no payment processor integration.
- **Payment receipts** — a participant can attach one receipt image
  (photo/screenshot of a transfer) to their own row on a priced
  Session, as proof for the organizer to review before confirming.
  Self-service only — there is no organizer-uploads-for-someone-else
  path. Re-uploading replaces the previous receipt; no history is
  kept.

**Visibility, explicitly**: every participant can see everyone else's
paid/awaiting status (the existing `registered`/`waitlist` distinction,
just framed plainly as "Paid"/"Awaiting" on this tab) — but a receipt
**image** is visible only to the uploading participant themselves and
the Club's owner/admin. No other participant can ever view someone
else's receipt, even though they can see that person's payment status.
This is enforced server-side (the receipt-serving endpoint checks
identity, not just "can view this Session"), not just hidden in the
UI.

The Payment tab itself is always present, even on a Free Session —
Waitlist → Registered is a step in DP-002's approval chain regardless
of price, so the "Confirm" action needs to live somewhere for free
Sessions too. Bank accounts and receipt upload are the only pieces
that hide when `priceModel === 'free'`.

### Scope

Still no payment gateway, no automated charge, no tracking of *how
much* has been paid vs. owed beyond the existing Price computation
(DP-010). This remains an organizer trusting a receipt and manually
confirming, exactly as DP-002 already worked — just given its own
place to happen, with a receipt to look at instead of no evidence at
all.

---

## DP-013 — Contact Organizer

Status

Approved

### Decision

The second of the four Communication contexts named in
`AKSI_INFORMATION_ARCHITECTURE.md` to get a product decision (DP-011
Session Chat was the first). Explicitly **session-scoped only** — not a
Club-wide affordance. Community-level chat and Direct Messages (either
member↔member or member↔admin, generalized beyond one Session) remain
separate, unapproved Planning items; Contact Organizer does not
substitute for either.

A private, two-way thread scoped to one Session and one member —
distinct from DP-011 Session Chat's group thread, which is visible to
everyone who can see the Session. Either side may reply: the member,
or any owner/admin of the Session's Club, collectively representing
"the organizer" (a reply from any one of them answers the thread; it
isn't attributed to "the organizer" as an anonymous role — the
member sees which admin replied). A member reaches their own thread
from the Session itself; an organizer reaches every member's thread
for that Session the same way, plus sees every thread they're a party
to (across every Session in every Club they run) surfaced in the
Inbox tab — the first real content Inbox has ever had.

Shares one messaging engine with DP-011 Session Chat (revised — per
explicit product direction, the only real differences between the two
are participants and the posting-window rule, so the mechanics
themselves are identical rather than a deliberately narrower
"lightweight" variant): plain text, optionally one image per message,
same "no editing or deleting a sent message" rule. Unlike Session
Chat, there is **no posting-window restriction** — a Contact Organizer
thread never closes, since it's a private line to the organizer
rather than a Session-lifetime group discussion.

### Scope

No moderation tooling (blocking, reporting) — a known, deliberate gap,
same reasoning as DP-011's first pass. No read receipts or typing
indicators. "Needs a reply" in the Inbox is a simple heuristic (the
last message came from the other side of the thread), not a persisted
read/unread state.

### Relationship to "Communication" (Planning, below)

This promotes Contact Organizer specifically out of Planning. Direct
Messages and Community-level chat remain unapproved and unbuilt.

---

## DP-014 — Online Indicator

Status

Approved

### Decision

A User carries a new attribute: whether they're currently online.
Shown as a green outline ring around a member's circle avatar
wherever one appears (currently: the Club Members grid, its detail
sheet, and the Add Member search results).

There is no push/websocket presence infrastructure anywhere in this
app (DP-ARCH-004 Engineering Autonomy) — "online" is derived from
recent request activity rather than a stored boolean requiring
explicit online/offline transitions. This is an implementation detail
below the product-decision level, not a separate approval.

### Scope

Not yet surfaced on Session participant/organizer avatars (those
don't have profile pictures wired up at all yet) or on the caller's
own avatar (Me tab) — scoped to where it was asked for. Extending it
elsewhere is a small follow-up, not a new decision.

---

# Planning

## Domain Evolution

The following concepts are intentionally incomplete and will evolve over time.

Examples:

- Activity Configuration
- Match Mode
- Match Scoring Configuration
- Scheduler Intelligence
- Fairness Engine

These are known design areas, not implementation tasks.

---

## Scheduler Evolution

Future scheduler improvements may include:

- Partner diversity
- Opponent diversity
- Skill balancing
- Court optimization

Match balance (equal/fair playing number) and Waiting time
(longest-waiting-since-last-match as the tiebreak) have both been
implemented — see DP-005's Match Generation section — and are removed
from this list.

Recommendations must remain explainable.

Organizer authority must always be preserved.

---

## Player Preferences

Potential future capabilities:

- Preferred opponent skill level
- Preferred partner skill level
- Competitive vs. casual play preference
- Coaching / mentoring preference

Player Preferences are independent from Player Skill Level and should never be used as a substitute for actual playing ability.

---

## Organizer Dashboard

Potential future capabilities:

- Live participant status
- Court overview
- Suggested next activity
- Waiting queue
- Session health

---

## Communication

`AKSI_INFORMATION_ARCHITECTURE.md` names four Communication contexts.
Potential future capabilities:

- Direct Messages (User↔User)
- Community-level chat (all members of a Club)

**Session Chat — promoted to DP-011, Ready to Develop.** A Session has
one chat, visible to and postable by anyone who can already see that
Session — plain text with an optional single image. No editing/
deleting, no moderation tooling yet.

**Contact Organizer — promoted to DP-013, Ready to Develop.** A private,
two-way, Session-scoped thread between one member and that Session's
organizer(s) — plain text, distinct from Session Chat's group thread.
The rest of this list (Direct Messages, Community-level chat) remains
unapproved Planning.

---

## Payments

Potential future capabilities:

- Membership
- Guest fees
- Refunds
- An actual payment gateway (card/e-wallet processing, provider
  integration, webhooks)

**Session fees — promoted to DP-010, Ready to Develop.** A Session may
declare Free/Per Person/Split Bill pricing and show each participant's
computed share; it does not track who has paid or move any money. The
rest of this list remains unapproved Planning.

A manual, organizer-confirmed payment step exists today as part of DP-002
Join Approval (Waitlist → Registered) — the organizer records that
payment happened outside the app. That is not an implementation of this
Planning item; no payment gateway, provider, or automated charge exists.

---

## Attendance

Potential future capabilities:

- Attendance history
- No-show tracking
- Reliability scoring

---

## Court Management

Potential future capabilities:

- Court assignment
- Court booking
- Court availability

---

## Map-Based Venue Selection

Session Venue (DP-004) is currently free text. A future milestone should
let organizers select a real place on a map (for example, via a map
provider's place picker) instead of typing it, so Sessions carry a real
location rather than a text label.

Blocked on provisioning a map provider API key — not yet scheduled.

---

# Product Roadmap

## Phase 1

Foundation

- Sessions
- Participants
- Activities
- Scheduler
- Recurring Schedules
- Player Skill Level
- Session Duration

---

## Phase 2

Organizer Experience

- Organizer Dashboard
- Live Scheduling
- Match Queue

---

## Phase 3

Club Operations

- Membership
- Payments
- Reports
- Attendance

---

## Phase 4

Intelligence

- Smart Scheduler
- AI Recommendations
- Analytics

---

Change history has moved to `AKSI_PRODUCT_DECISIONS_CHANGELOG.md` — this
document stays scoped to current decisions only.
