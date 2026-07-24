# Community Sports Platform PRD

Version: 1.0

Status: Frozen

---

# Product Vision

**Build the operating system for community sports clubs.**

The platform helps sports communities organize sessions, record activities, build player history, and create long-term engagement.

The first supported sport is **Tennis**.

The next planned sport is **Padel**.

The platform architecture must remain flexible enough to support additional sports in the future without requiring major redesign.

---

# Initial Problems We Solve

Version 1 focuses on solving four problems:

- Live scoring
- Session participation
- Match history
- Player statistics

The long-term goal is to become the primary platform where sports communities organize activities, record results, and build player identities.

---

# Product Principles

## Community First

Everything belongs to a club.

Users do not have personal sessions or personal activities.

---

## Low Friction

Built for recreational communities.

Not tournament software.

---

## Personal Device First

Each participant uses their own account.

No phone sharing.

---

## Data First

Collect clean activity data.

Generate statistics later.

---

## Future Proof

Architecture must support multiple sports.

Business logic must remain independent from sport rules.

---

# Product Pillars

- Club
- Session
- Player Identity
- Live Gameplay
- History
- Insights

Every future feature should strengthen one or more of these pillars.

---

# Core Hierarchy

```
User
    ↓
Club
    ↓
Session
    ↓
Sport
    ↓
Activity
    ↓
Result
```

---

# User

Represents a real player.

Contains:

- Profile
- Joined clubs
- Sports played
- History
- Statistics
- Achievements (future)

---

# Club

Represents a sports community.

Examples

- AKSI Tennis
- Jakarta Padel Club
- Office Sports Community

Contains

- Members
- Sessions
- Activities
- Statistics
- Settings

A club is not tied to one sport.

A user starts with zero clubs.

Users must explicitly create or join a club before participating.

---

# Club Roles

## Owner

- Manage club
- Manage admins
- Manage members
- Configure settings

## Admin

- Create sessions
- Manage sessions
- Manage players
- Start activities
- Assign scorer

## Member

- Join sessions
- Check in
- Watch live score
- View history
- View statistics

---

# Club Settings

Stores default preferences.

Examples

- Default sport
- Match format
- Tiebreak rule
- Deuce rule
- Language
- Timezone

---

# Session

Represents a scheduled community gathering.

Contains

- Club
- Sport
- Date
- Time
- Location
- Registered players
- Checked-in players
- Activities

---

# Session Lifecycle

```
Registered
    ↓
Checked In
    ↓
Participated
```

Definitions

Registered

Player is added before the event.

Checked In

Player has arrived.

Participated

Player has played at least one activity.

---

# Activity

Sport-specific unit inside a session.

Examples

Tennis

- Match

Padel

- Match

Future

- Run
- Training
- Practice

Contains

- Sport
- Participants
- Result
- Events
- Permissions

---

# Tennis Module (Version 1)

Supports

- Singles
- Doubles
- Games
- Sets
- Deuce
- Advantage
- Tiebreak
- Server rotation
- Undo
- Voice announcements
- Live synchronization
- Result sharing

---

# Scoring Permission

Only one scorer can edit the score.

Everyone else has read-only access.

The scorer role is temporary.

Scorer can transfer the role to another participant without interrupting the match.

---

# Live Match

Provides

- Real-time synchronization
- Large score display
- Voice announcements
- Result sharing

Live Match Preferences

Each scorer can configure:

- Announcer voice
- Announcement speed
- Keep screen awake
- Sound effects
- Vibration
- Display options

These preferences are match-specific and should be easily accessible from the Live Match screen.

---

# History

Every completed activity becomes permanent history.

Stored under

- User
- Club
- Sport

---

# Statistics

Not part of MVP.

Future

Player

- Matches played
- Win rate
- Attendance
- Favorite partner
- Head-to-head

Club

- Active players
- Sessions
- Activities

---

# Features Not Included in MVP

- Reservation
- Payment
- Automatic player rotation
- Tournament brackets
- Rankings
- Leaderboards
- Match timer
- Match duration
- Public club directory

---

# Future Features

## Club Discovery

Users will eventually be able to discover public clubs.

Discovery methods

- Current location
- City
- Sport
- Distance

Club visibility

- Public
- Unlisted
- Private

Invitation methods

- Invitation code
- QR code
- Shareable link

---

# Technical Direction

Frontend

- React Native
- Expo

Targets

- iOS
- Android
- Web

Backend

- Authentication
- Cloud database
- Realtime synchronization

Core Platform

- Users
- Clubs
- Sessions
- Permissions
- History

Sport Modules

- Rules
- Scoring
- Result formatting
- Statistics

Example

sports/

    tennis/
        scoringEngine/
        rules/
        formatter/

    padel/
        scoringEngine/
        rules/
        formatter/

---

# Development Roadmap

## Phase 1 — Foundation

- Authentication
- User profiles
- Cloud database
- Clubs
- Members

## Phase 2 — Sessions ✅

- Create session
- Add players
- Check-in

## Phase 3 — Live Gameplay

- Move Tennis scoring into Sport Engine
- Scorer permissions
- Scorer transfer

## Phase 4 — History

- Cloud history
- Player profile
- Club history

## Phase 5 — Growth

- Statistics
- Padel
- Reservation
- Payment
- Club discovery