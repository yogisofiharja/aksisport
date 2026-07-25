# AKSI Product Decisions

Version: 0.2.0

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

Communities organize Sessions.

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

## DP-007 — Session Templates

Status

Approved

Templates create Sessions.

Templates are never played directly.

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
- Templates

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