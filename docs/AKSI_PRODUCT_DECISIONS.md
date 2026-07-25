# AKSI Product Decisions

Version: 0.3.2

Status: Living Document

---

# Purpose

This document is the single source of truth for AKSI's product decisions, domain principles, and long-term vision.

Everything under **Ready to Develop** is approved for implementation.

Everything under **Planning** exists only to guide future architecture and should not be implemented until promoted into Ready to Develop.

When new product decisions are approved, this document should be updated before implementation continues.

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

Organizer starts session

↓

In Progress

↓

Organizer finishes session

↓

Completed

Cancelled may occur from any non-terminal state.

---

### Visibility

Draft sessions

- visible only to organizers
- not joinable
- hidden from members

---

## DP-002 — Participant Lifecycle

Status

Approved

### Participant States

- Registered
- Checked In
- Checked Out
- Cancelled
- No Show

---

### Ownership

Registered

- Organizer
- Self-service

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

- Venue
- Schedule
- Pricing
- Maximum participants
- Default Activity Configuration

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

Organizer confirmation is always required.

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

- Waiting time
- Match balance
- Partner diversity
- Opponent diversity
- Skill balancing
- Court optimization

Recommendations must remain explainable.

Organizer authority must always be preserved.

---

## Organizer Dashboard

Potential future capabilities:

- Live participant status
- Court overview
- Suggested next activity
- Waiting queue
- Session health

---

## Payments

Potential future capabilities:

- Membership
- Guest fees
- Session fees
- Refunds

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

# Product Roadmap

## Phase 1

Foundation

- Sessions
- Participants
- Activities
- Scheduler
- Recurring Schedules

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

# Change Log

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
