# Domain Model

Migrated from `prd.md`. Preserves existing wording and decisions,
except where noted — see "Decisions" below for the two Core Hierarchy
gaps this document originally flagged as open, since resolved.

## Decisions

- **Sport is not a standalone entity.** It's `sportType`, an attribute
  of Activity. Values: `TENNIS`, `PADEL`, `PICKLEBALL`. This supports
  multi-sport without adding another aggregate.
- **Result is not a standalone entity.** The hierarchy ends at Match.
  Match owns Score, Winner, Statistics, and Events. Result/Outcome is
  derived from Match data, not stored separately.

---

## Product Pillars

- Club
- Session
- Player Identity
- Live Gameplay
- History
- Insights

Every future feature should strengthen one or more of these pillars.

---

## Core Hierarchy

```
User
    ↓
Club
    ↓
Session
    ↓
Activity
    ↓
Match
```

---

## User

Represents a real player.

Contains:

- Profile
- Joined clubs
- Sports played
- History
- Statistics
- Achievements (future)

---

## Club

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

## Club Roles

### Owner

- Manage club
- Manage admins
- Manage members
- Configure settings

### Admin

- Create sessions
- Manage sessions
- Manage players
- Start activities
- Assign scorer

### Member

- Join sessions
- Check in
- Watch live score
- View history
- View statistics

---

## Club Settings

Stores default preferences.

Examples

- Default sport
- Match format
- Tiebreak rule
- Deuce rule
- Language
- Timezone

---

## Session

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

## Session Lifecycle

```
Registered
    ↓
Checked In
    ↓
Participated
```

Definitions

**Registered** — Player is added before the event.

**Checked In** — Player has arrived.

**Participated** — Player has played at least one activity.

---

## Activity

Sport-specific unit inside a session.

`sportType` attribute: `TENNIS` | `PADEL` | `PICKLEBALL`.

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

- Sport Type
- Participants
- Match
- Permissions

---

## Match

The concrete play instance for Activities whose type is Match (Tennis,
Padel today — see Activity examples above).

Owns

- Score
- Winner
- Statistics
- Events

Result/Outcome is derived from Match data. It is not a separately
stored entity.

---

## Tennis Module (Version 1)

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

## Scoring Permission

Only one scorer can edit the score.

Everyone else has read-only access.

The scorer role is temporary.

Scorer can transfer the role to another participant without interrupting the match.

---

## Live Match

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

## History

Every completed activity becomes permanent history.

Stored under

- User
- Club
- Sport Type

---

## Statistics

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

## Note

`prd.md`'s "Technical Direction" section (frontend/backend stack, Core
Platform vs. Sport Modules folder layout) belongs in
`docs/engineering/`, not here — see `docs/engineering/technical-direction.md`.
