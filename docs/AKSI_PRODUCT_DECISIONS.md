# AKSI Product Decisions

Version: 0.1.0

Status: Living Document

---

## Purpose

This document is the single source of truth for approved product decisions.

It is intentionally lightweight and continuously updated as the product evolves.

Claude Code should use this document together with `CLAUDE.md`.

Rules:

- Everything under **Ready to Develop** is implementation-ready.
- Everything under **Planning** is product direction only.
- Planning items should influence architecture, but must NOT be implemented unless explicitly requested.

---

# Product Principles

## Vision

AKSI is not just a scoring application.

AKSI is a platform that helps sports communities organize activities before, during, and after a sports session.

---

## Core Principles

- Community first.
- Organizer experience is as important as player experience.
- AI is an assistant, never the decision maker.
- Build extensible foundations before adding intelligence.
- Optimize for simplicity over feature count.
- Prefer reducing organizer workload.

---

# Ready to Develop

## DP-001 — Session Lifecycle

Status

Approved

### Lifecycle

- Draft
- Recruiting
- Ready
- Full
- In Progress
- Completed
- Cancelled

### Rules

Recruiting

- Joined participants < Minimum Participants

Ready

- Joined participants >= Minimum Participants

Full

- Joined participants == Maximum Participants

Status should be derived automatically whenever possible.

---

## DP-002 — Participant Lifecycle

Status

Approved

### Participant States

- Joined
- Checked In
- Checked Out
- Cancelled
- No Show

### Rules

- A participant must be checked in before joining a match.
- Store JoinedAt.
- Store CheckedInAt.
- Store CheckedOutAt.
- Participant lifecycle is independent from Match lifecycle.

---

## DP-003 — Minimum Participants

Status

Approved

### Decision

Minimum participants are owned by the Sport Engine.

Examples

- Tennis Singles = 2
- Tennis Doubles = 4
- Basketball 5v5 = 10
- Running = 1

Session only defines:

- Maximum Participants

---

## DP-004 — Match Ownership

Status

Approved

### Session owns

- Default Match Format

### Match owns

- Match Format
- Players
- Court
- Status
- Score

### Rules

- Every Match owns its own format.
- Match format may differ from Session default.
- Session.DefaultMatchFormat is only the initial default.
- Scoring Engine MUST always use Match.Format.

---

## DP-005 — Scheduler Architecture

Status

Approved

### Decision

Introduce a Scheduler abstraction.

Responsibilities

- Suggest the next match.
- Explain why the suggestion was made.
- Never force organizer decisions.

### Initial Implementation

A simple implementation is acceptable.

Example

- First checked-in players.

Do NOT implement fairness or AI yet.

---

## DP-006 — Check-in Driven Session

Status

Approved

### Workflow

Join

↓

Check In

↓

Generate / Suggest Match

↓

Play Match

↓

Finish Match

↓

Suggest Next Match

### Rules

- Only checked-in participants can play.
- Completed matches are immutable.
- Future matches may be regenerated.

---

## DP-007 — Session Templates

Status

Approved

### Decision

Introduce Session Templates.

Purpose

Allow organizers to create recurring sessions quickly.

Example

Saturday Morning Tennis

- Sport
- Venue
- Time
- Duration
- Court Count
- Maximum Participants
- Default Match Format

### Rules

Templates create Sessions.

Templates are never played directly.

---

# Planning

## Fairness Engine

Goal

Improve fairness automatically.

Possible considerations

- Total matches played
- Waiting time
- Partner repetition
- Opponent repetition

Not ready for implementation.

---

## Scheduling Policies

Potential policies

- Balanced
- Coach Priority
- Tournament
- King of the Court

Architecture should support multiple scheduling policies.

---

## Live Scheduler

After every completed match:

- Detect available court.
- Suggest the next match.
- Explain why the players were selected.

Organizer always has final control.

---

## Pre-generated Match Queue

Alternative scheduling mode.

Workflow

Generate all matches first.

Allow regenerating remaining matches when attendance changes.

---

## Organizer Dashboard

Potential information

- Joined
- Checked In
- Waiting
- Playing
- Available Courts
- Suggested Next Match

---

## Payments

Topics to design

- Session fee
- Membership
- Guest fee
- Cancellation
- Refund

---

## Attendance & Reliability

Track

- Attendance
- No Show
- Late Cancellation

Purpose

Help organizers manage their community.

---

## Court Management

Future scope

Potential features

- Court booking
- Court availability
- Court assignment

---

# Product Roadmap

## Phase 1 — Foundation

- Session Foundation
- Participant Lifecycle
- Match Refactor
- Scheduler Interface
- Check-in
- Session Templates

## Phase 2 — Organizer Experience

- Organizer Dashboard
- Live Scheduler
- Match Queue
- Attendance

## Phase 3 — Club Operations

- Payments
- Reports
- Member Management

## Phase 4 — Intelligence

- Smart Scheduler
- AI Recommendations
- Club Analytics

---

# Change Log

## v0.1.0

Initial product decisions established.

Includes:

- Session lifecycle
- Participant lifecycle
- Sport Engine ownership
- Match ownership
- Scheduler abstraction
- Check-in workflow
- Session Templates
- Initial product roadmap