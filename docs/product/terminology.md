# Terminology

Migrated from `docs/archive/prd.md`. Definitions are quoted or closely paraphrased
from existing wording, except **Sport Type** and **Match**/**Result**,
which reflect the Core Hierarchy decision recorded in `domain.md`.

---

**User** — Represents a real player.

**Club** — Represents a sports community. Not tied to one sport.

**Session** — Represents a scheduled community gathering.

**Activity** — Sport-specific unit inside a session. Not a standalone hierarchy layer for its sport — see Sport Type.

**Sport Type** — Attribute of Activity, not a standalone entity. Values: `TENNIS`, `PADEL`, `PICKLEBALL`.

**Match** — The concrete play instance for Activities whose type is Match (Tennis, Padel today). Owns Score, Winner, Statistics, Events.

**Result** / **Outcome** — Derived from Match data. Not a separately stored entity.

**Owner** (club role) — Manages the club, admins, members, and settings.

**Admin** (club role) — Creates and manages sessions, manages players, starts activities, assigns the scorer.

**Member** (club role) — Joins sessions, checks in, watches live score, views history and statistics.

**Registered** (session lifecycle state) — Player is added before the event.

**Checked In** (session lifecycle state) — Player has arrived.

**Participated** (session lifecycle state) — Player has played at least one activity.

**Scorer** — The single participant with permission to edit the score during a match. Read-only for everyone else. Temporary role — can be transferred to another participant without interrupting the match.
