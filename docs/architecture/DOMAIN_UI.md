# Domain UI

Domain UI bridges the gap between the Design System and Feature implementation.

It contains reusable UI that understands AKSI's business domain while remaining independent from business logic.

---

# Layer Hierarchy

Foundation

↓

Primitives

↓

UI Components

↓

Domain UI

↓

Features

---

# Responsibilities

Domain UI may understand concepts like:

- Club
- Session
- Match
- Player
- Activity
- Leaderboard

But it must NOT:

- Call APIs
- Read Firebase
- Access navigation
- Manage business logic

It only renders data.

---

# Examples

Good

PlayerCard

ClubCard

SessionCard

MatchCard

ActivityCard

ScoreBoard

LeaderboardCard

RankingBadge

---

# Not Domain UI

Authentication

ProfileService

SessionRepository

Firebase hooks

Navigation

State management

Business validation

---

# Data Flow

Feature

↓

Fetches data

↓

Passes props

↓

Domain UI

↓

Design System

---

# Good Example

SessionCard

Props

- session
- onPress
- showParticipants
- showLocation

The component only renders.

It never fetches.

---

# Bad Example

SessionCard

- fetches Firebase
- updates session
- navigates
- manages loading state

This belongs in Features.

---

# Folder Structure

domain-ui/

    club/

        ClubCard

        ClubBanner

        ClubStats

    session/

        SessionCard

        SessionStatus

        SessionParticipants

    player/

        PlayerCard

        PlayerStats

        RankingBadge

    activity/

        ActivityCard

    match/

        MatchCard

        ScoreBoard

---

# Reuse

Domain UI should be reused across:

Dashboard

Club

Search

History

Profile

Notifications

Avoid creating screen-specific versions.

---

# Philosophy

Domain UI understands the business.

It does not implement the business.