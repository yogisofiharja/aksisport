# Domain Model

Migrated from `prd.md`. Preserves existing wording and decisions —
see the "Open Questions" section at the end for gaps found during
migration, not new product decisions.

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
Sport
    ↓
Activity
    ↓
Result
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
- Sport

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

## Open Questions

Found while migrating `prd.md` — not resolved here, flagging per
migration instructions rather than assuming an answer.

- **"Result" in the Core Hierarchy** has no standalone definition
  elsewhere in `prd.md`. It's implied to be the outcome data of an
  Activity (`Activity` → "Contains: ... Result ... Events"), but
  whether it's a distinct entity or just a field on Activity is unstated.
- **"Sport" in the Core Hierarchy** sits as its own layer between
  Session and Activity, but no section defines "Sport" as an entity —
  `Session` has a "Sport" field, and `Activity` is described as
  "Sport-specific," but there's no explicit model for what a Sport
  record contains (vs. it just being a string/enum like `tennis`).
- **`prd.md`'s "Technical Direction" section** (frontend/backend stack,
  Core Platform vs. Sport Modules folder layout) was intentionally
  **not** migrated here — it belongs in `docs/engineering/`, which
  doesn't have content yet. It remains in `prd.md` until that exists.
