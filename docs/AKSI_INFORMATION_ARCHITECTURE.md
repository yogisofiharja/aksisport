# AKSI_INFORMATION_ARCHITECTURE.md

Version: 1.1.0

Status: Living Document

---

# Purpose

Defines how AKSI is organized.

This document answers:

- Where users start.
- Where features belong.
- How users move between contexts.
- How objects relate to each other.

This document intentionally does not define UI design or business rules.

Change history lives in `AKSI_INFORMATION_ARCHITECTURE_CHANGELOG.md`, not here — this document only ever describes the current state.

---

# Application Hierarchy

Application

├── Personal Context
│
│   ├── Home
│   ├── Explore
│   ├── Inbox
│   └── Me
│
└── Community Context
    │
    ├── Home
    ├── Sessions
    ├── Communication
    ├── Members (Object)
    ├── Settings (Object)
    │
    └── Session
         │
         ├── Participants
         ├── Activities
         ├── Communication
         ├── Finance
         └── History

---

# Contexts

AKSI has two contexts.

## Personal Context

The user acts as themselves.

Responsibilities:

- Personal activities
- Explore
- Notifications
- Profile
- Communities

The application always starts here.

---

## Community Context

The user intentionally enters a Community.

Responsibilities:

- Community operations
- Sessions
- Members
- Communication

Everything inside this context belongs to one Community.

---

# Objects

Objects are opened inside a Context.

Objects do not own navigation.

Current objects include:

- Community
- Session
- Activity
- Member
- User
- Recurring Schedule
- Match

---

# Navigation Model

AKSI has two primary navigation systems.

## Personal Navigation

Responsibilities:

- Home
- Explore
- Inbox
- Me

---

## Community Navigation

Tabs:

- Home
- Sessions
- Chat
- Members

The Members tab is the same for every role; organizer-only actions
(approve, add, promote, remove) appear inside it. Join requests also stay
visible on Community Home as a callout for owners and admins.

Settings is accessed contextually (the Community's ⋯ menu) rather than
occupying permanent navigation.

---

# Navigation Rules

There are only three navigation behaviors.

## Enter Context

Personal

↓

Community

Navigation changes.

---

## Open Object

Community

↓

Session

↓

Activity

Navigation remains unchanged.

---

## Exit Context

Community

↓

Personal

Navigation returns to Personal Context.

---

# Context Persistence

Context should remain stable while users work.

Examples:

Opening a Session does not leave the Community.

Opening an Activity does not leave the Session.

Opening a Member does not leave the Community.

Only entering or leaving a Community changes the application context.

---

# Screen Ownership

Personal owns:

- Home
- Explore
- Inbox
- Me
- Community Collection

Community owns:

- Home
- Sessions
- Communication
- Members

Session owns:

- Participants
- Activities
- Session Communication
- Finance
- History

Activity owns:

- Match State
- Score
- Events

---

# Entry Points

Community

- Community Collection
- Explore
- Invitation

Session

- Community Home
- Session List
- Notification
- Deep Link

Activity

- Session
- Notification

---

# Communication

Communication is a platform capability.

Supported contexts:

- User
- Community
- Session

Future capabilities:

- Announcements
- Polls
- Voice Messages

---

# Future Expansion

Future contexts may include:

- Tournament
- League
- Organization

The architecture should remain hierarchical.

New contexts should not break existing navigation principles.

---

Change history has moved to `AKSI_INFORMATION_ARCHITECTURE_CHANGELOG.md`
— this document stays scoped to the current architecture only.