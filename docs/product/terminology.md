# Terminology

Migrated from `prd.md`. Definitions are quoted or closely paraphrased
from existing wording — nothing invented. See "Open Questions" for
terms `prd.md` uses but never explicitly defines.

---

**User** — Represents a real player.

**Club** — Represents a sports community. Not tied to one sport.

**Session** — Represents a scheduled community gathering.

**Activity** — Sport-specific unit inside a session.

**Match** — The Activity type used for Tennis and Padel (`Activity` examples list "Match" under both).

**Owner** (club role) — Manages the club, admins, members, and settings.

**Admin** (club role) — Creates and manages sessions, manages players, starts activities, assigns the scorer.

**Member** (club role) — Joins sessions, checks in, watches live score, views history and statistics.

**Registered** (session lifecycle state) — Player is added before the event.

**Checked In** (session lifecycle state) — Player has arrived.

**Participated** (session lifecycle state) — Player has played at least one activity.

**Scorer** — The single participant with permission to edit the score during a match. Read-only for everyone else. Temporary role — can be transferred to another participant without interrupting the match.

---

## Open Questions

- **Sport** and **Result** are used as Core Hierarchy entities in
  `domain.md` but `prd.md` never gives either an explicit standalone
  definition. See `domain.md`'s "Open Questions" section — not
  duplicated here to avoid two sources answering the same question
  differently.
