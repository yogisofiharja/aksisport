# AKSI UX Principles

Version: 1.0.0

Status: Living Document

---

# Purpose

This document defines the UX philosophy of AKSI.

Unlike `AKSI_PRODUCT_DECISIONS.md`, which defines the product domain and business rules, this document defines how users experience the product.

Every new screen, workflow, navigation decision, and interaction should follow these principles.

Change history lives in `AKSI_UX_PRINCIPLES_CHANGELOG.md`, not here — this document only ever describes the current state.

---

# UX Vision

AKSI helps people discover, join, organize, and enjoy community sports.

The experience should feel effortless.

Users should always know:

- where they are,
- what needs their attention,
- and what they should do next.

---

# UX Principles

## UX-001 — Personal First

Users always enter AKSI in **Personal Mode**.

The application belongs to the user.

Communities are contexts the user intentionally enters.

The default experience should never assume a specific Community.

---

## UX-002 — Community Context

Entering a Community changes the user's context.

The user temporarily leaves Personal Mode and enters Community Mode.

Everything inside Community Mode is scoped to that Community.

Community Mode should feel like entering a workspace rather than opening another page.

---

## UX-003 — Attention Before Browsing

The first screen should answer:

> What needs my attention right now?

Do not force users to browse lists before they can continue their current task.

Current work always has higher priority than historical information.

---

## UX-004 — Session-Centric Experience

Sessions are the primary experience of AKSI.

Communities exist to organize Sessions.

Members participate in Sessions.

Organizers prepare and manage Sessions.

The application should naturally guide users toward relevant Sessions rather than emphasizing Community administration.

---

## UX-005 — Draft Recovery

Drafts represent unfinished work.

Whenever appropriate, users should be encouraged to continue existing drafts before creating new ones.

Draft recovery should feel natural rather than intrusive.

---

## UX-006 — Context Before Navigation

The application understands the user's current context.

Examples:

- Today's Session
- Next Session
- Live Session
- Draft Session

The application should proactively surface the most relevant context instead of requiring navigation.

---

## UX-007 — One Primary Action

Every major screen should have one obvious primary action.

Examples:

Not Joined

→ Join

Waiting Approval

→ Wait

Payment Required

→ Pay

Check-in Available

→ Check In

Playing

→ Continue Match

Completed

→ Review

Users should never wonder what they should do next.

---

## UX-008 — Activity First Discovery

Discovery begins with activities, not Communities.

People decide they want to play first.

Communities are discovered through activities.

Explore should prioritize nearby and relevant sports activities.

---

## UX-009 — Personal Before Community

The user's identity always comes first.

The Community never replaces the user's identity.

A user may belong to multiple Communities.

Returning to Personal Mode should always be simple and predictable.

---

## UX-010 — Communication Has Context

Communication should always be attached to something.

Examples:

- User ↔ User
- Community Communication
- Session Communication
- Contact Organizer

Users communicate about an object rather than inside a generic chat system.

---
## UX-011 — Familiar Before Clever

Users should recognize how to use the application immediately.

Prefer familiar interaction patterns over novel interactions.

If multiple designs achieve the same goal, choose the one that:

- requires less learning,
- reduces cognitive load,
- matches common mobile application conventions.

Innovation should solve real user problems rather than introducing unnecessary concepts.

---

## UX-012 — Progressive Disclosure

Only show users what they need for their current task.

Advanced capabilities should appear only when they become relevant.

Avoid exposing every feature at once.

Examples:

- Community settings remain under Settings.
- Organizer capabilities appear only for organizers.
- Draft actions appear only when drafts exist.
- Session actions evolve with the Session lifecycle.

The interface should grow with the user's context rather than overwhelming them.

---

## UX-013 — Navigation Follows Frequency

Primary navigation should prioritize the workflows users perform most often.

Frequently used workflows belong in primary navigation.

Occasionally used features belong in secondary navigation.

Rare administrative functions belong in Settings.

Navigation should reflect how often features are used rather than how many features exist.

---

## UX-014 — Objects, Not Destinations

Not every domain object deserves a permanent navigation destination.

Contexts provide navigation.

Objects are opened within those contexts.

Examples of objects:

- Session
- Activity
- Member Profile
- Recurring Schedule

Users open objects.

They do not navigate between unrelated object types.

---

## UX-015 — Consistent Mental Model

The same interaction pattern should repeat throughout the application.

Every major context should answer three questions:

- Where am I?
- What needs my attention?
- What should I do next?

Examples:

Personal Home

- Current Focus
- Next Action

Community Home

- Current Focus
- Next Action

Session

- Current Focus
- Next Action

Consistency reduces learning and increases confidence.

---

## UX-016 — Context Persistence

Users should remain in the same context while working.

Opening objects should not change the user's primary context.

Examples:

- Opening a Session does not leave the Community.
- Opening an Activity does not leave the Session.
- Opening a Member Profile does not leave the Community.

Only intentional context switches should change navigation.

Examples:

- Personal World → Community World
- Community World → Personal World

This allows users to complete related tasks without feeling lost.

---

## UX-017 — Creation Belongs to Context

Creation actions should exist where the created object naturally belongs.

Examples:

- Create Community from the Community collection.
- Create Session from Sessions.
- Create Activity from a Session.

Avoid generic global creation actions that mix unrelated object types.

Users should always understand what they are creating and where it will appear.

---

## UX-018 — One Clear Primary Action

Every major screen should present one obvious primary action.

The primary action should reflect the user's current state.

Examples:

Not Joined

→ Join Session

Waiting Approval

→ Wait

Payment Required

→ Complete Payment

Check-in Available

→ Check In

Live Match

→ Continue Match

Completed Session

→ Review Results

Users should never wonder what they should do next.

---

# Personal World

Personal Mode represents the user's own world.

Its primary responsibilities are:

- My Activities
- Explore
- Communication
- My Profile

Personal Mode answers:

"What should I do today?"

---

# Community World

Community Mode represents one Community.

Its primary responsibilities are:

- Current Focus
- Sessions
- Members
- Communication

Community Mode answers:

"What does this Community need?"

---

# Current Focus

Current Focus is the primary workspace inside a Community.

Rather than showing all Sessions equally, the application should surface the Session requiring attention.

Examples:

- Today's Session
- Next Session
- Live Session
- Draft Session

Only when no current work exists should the application encourage creating a new Session.

---

# Explore

Explore helps users discover sports opportunities.

Explore should prioritize:

- Nearby activities
- Upcoming sessions
- Public communities
- Relevant recommendations

Communities are secondary.

Activities are primary.

---

# Communication

Communication is a platform capability rather than a standalone feature.

Supported contexts include:

- Direct Messages
- Community Communication
- Session Communication
- Contact Organizer

Future communication capabilities may include:

- Announcements
- Polls
- Event Updates
- Voice Messages

---

# Design Philosophy

The application should always feel:

- calm
- focused
- welcoming
- lightweight

Avoid:

- dashboard overload
- unnecessary statistics
- excessive navigation
- multiple competing primary actions

---

# Long-Term Vision

AKSI should feel like the operating system for community sports.

Users should naturally move between:

Personal World

↓

Community World

↓

Session

↓

Activity

without ever feeling lost.

Navigation should support the user's current context rather than exposing the application's internal structure.

---

Change history has moved to `AKSI_UX_PRINCIPLES_CHANGELOG.md` — this
document stays scoped to current principles only.