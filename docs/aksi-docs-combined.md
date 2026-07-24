# AKSI — Combined Documentation

Single-file export of `CLAUDE.md`, `README.md`, and everything under `docs/product/`, `docs/engineering/`, `docs/current/`, `docs/decisions/`, and `docs/architecture/` (the AKSI UI Design System). Generated for use as external LLM context — not itself a project doc, not part of the Documentation Authority order in `CLAUDE.md`.

**This is a point-in-time snapshot.** It will not update itself when the source docs change — regenerate it rather than hand-editing it, or treat it as stale after any doc change.

**Excluded:** `docs/archive/` — superseded/historical content, left out to keep this focused and small.

---

## File: `CLAUDE.md`

# CLAUDE.md

# AKSI Repository Guide

## Documentation Model

This project intentionally separates documentation into three layers.

### docs/current/
Describes the implementation that exists today.
- Reverse-engineered from the codebase.
- Never invent future behaviour.
- Updated whenever implementation changes.

### docs/product/
Describes the target product.
- Product vision
- UX
- Navigation
- Domain decisions
- Future behaviour

### docs/engineering/
Describes how the software should be built.
- Architecture
- State management
- API conventions
- Coding standards

Always distinguish between:

- Current → implemented today
- Target → intended direction
- Future → ideas that are not implementation requirements

## Documentation Authority

1. docs/product/
2. docs/engineering/
3. docs/current/
4. docs/archive/prd.md (historical — largely migrated into the layers above; see docs/archive/README.md for what wasn't)
5. README.md (setup only)

## Rules for Claude

- Never invent missing product requirements.
- If product documentation is missing, ask before implementing.
- You MAY generate docs/current by analysing the existing implementation.
- Do not rewrite architecture solely to match target documentation.
- Prefer incremental evolution over large rewrites.

---

## File: `README.md`

# PoinYuk

A web-first tennis scoring app for small clubs, built with Expo + React Native + TypeScript.
Designed for mobile browsers — large tap targets, fast session setup, instant share card.

## Run The App

1. Open terminal in this folder.
2. Install dependencies:

```bash
npm install
```

3. Run web app:

```bash
npm run web
```

When Expo opens, press `w` if needed to open browser.

## Run Tests

```bash
npm test
```

## Deploy To Vercel

This app is deployed as a static Expo web export.

### 1) Build locally (optional check)

```bash
npm run build:web
```

This generates the production web files in `dist/`.

### 2) Deploy with Vercel CLI

```bash
npm i -g vercel
vercel
```

For production deployment:

```bash
vercel --prod
```

### 3) Or deploy from GitHub

1. Push this repo to GitHub.
2. In Vercel, click **Add New Project** and import the repo.
3. Keep defaults (the included `vercel.json` already sets build/output):
	- Build command: `npm run build:web`
	- Output directory: `dist`

## App Flow

```
Setup → Lineup → Match → Final
```

| Screen | What happens |
|---|---|
| **Setup** | Enter all attending players one-by-one (Enter to submit). Pick Single or Double mode and deuce setting. `Sesi Baru` clears saved state. |
| **Lineup** | Tap players in sequence to fill KIRI/KANAN slots. `Tukar Tempat` physically swaps players between slots (KIRI/KANAN labels stay fixed; only player names animate). Pick or randomise first server — server picker order is stable across swaps. Player chips are sorted by least play-count first and show compact `x` badges. |
| **Match** | Side-by-side tap cards to add points. SET / GAME / POIN columns in the banner. Server highlighted with green dot. Undo has no confirmation; End Match is pinned at bottom. Reaching 6 games triggers a set: set counter increments and games reset to 0-0. |
| **Final** | TV-style scoreboard: set total + per-set game breakdown. Share button generates a preview card (set score headline when sets played, game score otherwise; per-set breakdown shown below). Replace background from gallery or camera. `Akhiri Sesi` clears all data (with confirmation). |

## Code Map

| File | Purpose |
|---|---|
| `App.tsx` | Root orchestrator — 4-screen state machine, handlers, persistence wiring |
| `src/scoring.ts` | Pure tennis scoring engine (no side-effects) |
| `src/scoring.test.ts` | Scoring unit tests |
| `src/persistence.ts` | localStorage parse / save / load / clear with backward-compat migration |
| `src/persistence.test.ts` | Persistence unit tests |
| `src/shareCard.ts` | Canvas share-card composer + web photo picker |
| `src/appTypes.ts` | Shared TypeScript types (`SetupForm`, `LineupResult`, `PersistedAppState`, …) |
| `src/components/ui.tsx` | shadcn-inspired primitives: `Card`, `Button`, `Pill`, `Input`, `DecorativeBackdrop` |
| `src/components/MatchSetup.tsx` | Setup screen |
| `src/components/LineupScreen.tsx` | Lineup / team-assignment screen |
| `src/components/MatchScreen.tsx` | Live match screen |
| `src/components/FinalScoreScreen.tsx` | End-of-match result + share screen |

## Notes

- Persistence uses web `localStorage`; state survives page refresh.
- Old save formats (pre-v4 player fields) are migrated automatically on load.
- Player play-count stats are persisted and reset when session is cleared.
- Share card background image is reset when a new match starts.
- Node 20.19.4+ recommended for Expo SDK 54.

---

# docs/product/

## File: `docs/product/README.md`

# Product Documentation

This folder defines the desired product behaviour.

It is the source of truth for product decisions.

If the implementation differs, do not silently change behaviour.
Raise the discrepancy and resolve it deliberately.

---

## File: `docs/product/vision.md`

# Vision

AKSI is a player-first sports companion.

Help sports communities organize themselves without getting in the way of playing.

---

## File: `docs/product/principles.md`

# Product Principles

- Players First
- Clubs are the primary organizational boundary
- Navigation is organized around the player's experience, not the backend hierarchy
- Time Organizes Navigation
- Value Before Commitment (future milestone — auth remains mandatory in Phase 1)
- Simplicity Is A Feature
- Build → Measure → Learn

Clarification: "clubs are context" does not mean clubs are optional. The
player always participates through a club — there are no personal
sessions or personal activities, and no "My Club" abstraction. The
business hierarchy (Club → Session → Activity → Match) stays club-centric;
only the *navigation surface* is organized around the player's own
experience rather than exposing that hierarchy directly (see
`navigation.md`).

---

## File: `docs/product/context.md`

# Context

Context =
Identity + Time + Club + Activity + Permissions + Device

The app adapts to context rather than repeatedly asking the user.

---

## File: `docs/product/interaction.md`

# Interaction

- One primary action per screen.
- Reduce uncertainty.
- Progressive disclosure.
- Preserve momentum.
- Never interrupt live play.

---

## File: `docs/product/domain.md`

# Domain Model

Migrated from `docs/archive/prd.md`. Preserves existing wording and decisions,
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

`docs/archive/prd.md`'s "Technical Direction" section (frontend/backend stack, Core
Platform vs. Sport Modules folder layout) belongs in
`docs/engineering/`, not here — see `docs/engineering/technical-direction.md`.

---

## File: `docs/product/terminology.md`

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

---

## File: `docs/product/navigation.md`

# Navigation

Bottom tabs:

- Today — What needs my attention?
- Play — My sports journey
- Me — Identity

Today surfaces attention.
Play owns timeline.
Me owns identity.

---

## File: `docs/product/roadmap.md`

# Roadmap

Migrated from `docs/archive/prd.md`. Preserves existing wording and decisions.

---

## Initial Problems We Solve

Version 1 focuses on solving four problems:

- Live scoring
- Session participation
- Match history
- Player statistics

The long-term goal is to become the primary platform where sports communities organize activities, record results, and build player identities.

---

## Development Roadmap

### Phase 1 — Foundation

- Authentication
- User profiles
- Cloud database
- Clubs
- Members

### Phase 2 — Sessions ✅

- Create session
- Add players
- Check-in

### Phase 3 — Live Gameplay

- Move Tennis scoring into Sport Engine
- Scorer permissions
- Scorer transfer

### Phase 4 — History

- Cloud history
- Player profile
- Club history

### Phase 5 — Growth

- Statistics
- Padel
- Reservation
- Payment
- Club discovery

---

## Features Not Included in MVP

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

## Future Features

### Club Discovery

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

## Open Questions

- `docs/archive/prd.md` doesn't state a checkmark/status convention beyond "Phase 2 —
  Sessions ✅" — it's unclear whether Phase 1 (Foundation) is considered
  complete but unmarked, or genuinely not yet checked off. Not assumed
  here; preserved exactly as written in `docs/archive/prd.md`.

---

## File: `docs/product/milestone-1.md`

# Milestone 1

Defines the exact scope of AKSI Milestone 1 (MVP). This is the
implementation contract — features not listed here are not part of
Milestone 1, regardless of how much of them already exists in code.

Built from `docs/product/{vision,principles,domain,roadmap}.md`,
`docs/current/*`, and `docs/engineering/*`. Nothing here is invented.
Ambiguities found while writing the first revision were surfaced
rather than decided unilaterally, then resolved by product review —
see "Resolved Decisions" at the end.

---

## Goal

Let an existing club take a group of players from "we have a session
scheduled" to "we played and recorded a tennis match" entirely through
their own phones — organizing the session, checking in, playing, and
scoring a live match together — without any player ever sharing a
device or the club needing anything outside the app to run a session.

---

## Target User

**Is**: a member of an existing (or newly created) informal tennis
club — a group of friends, a workplace group, a community club — who
wants to organize sessions and score matches on their own devices
instead of a single shared phone or a paper scoresheet.

**Is NOT**:
- A solo player with no club — there is no personal/club-less play by
  design (`docs/product/domain.md`: "no personal or automatically
  created clubs").
- A tournament organizer — no bracket/ranking tooling exists or is
  planned for Milestone 1.
- A Padel or other non-tennis player — only Tennis is implemented
  (`docs/product/roadmap.md` Phase 5).
- An anonymous, no-signup scorer — that's the existing, separate,
  frozen web product (`ScoringFlow`/`poin-yuk.vercel.app`), not this
  milestone.

---

## Success Criteria

What a user must be able to do, end to end, on a real device:

- Create an account (username + password).
- Create a club, or join one with an invite code.
- View the club's sessions.
- Check in to a session.
- Be added as a participant to a match by the session's
  owner/admin (there is no self-service "join a match" — matches are
  created with their participants already chosen).
- Start a match they're a checked-in participant of.
- Score the match (singles or doubles, any supported format).
- View the live score while another player is scoring (read-only —
  see Live Match Viewer below).
- Finish the match (automatically, by format rule, or manually).
- See the result immediately after the match ends.

Deliberately excluded from this list even though the words appear
elsewhere in product docs: **match history** and **player statistics**
(`docs/product/roadmap.md`'s "Initial Problems We Solve" names both as
problems the overall product/Version 1 solves, but `domain.md`
explicitly states "Statistics: Not part of MVP," and history is its
own later phase — see Out of Scope).

---

## In Scope

**Terminology**: this document uses *Match* as the product-facing
term throughout. *Activity* is the underlying technical entity name
(API, database, code — `ActivityMatchScreen`, `activities` table,
`live`/`queued`/`completed` status) for the same concept. They refer
to the same thing; product language says Match, implementation
references say Activity.

### Authentication

Firebase Auth, username + password only (synthetic email under the
hood). Sign up, log in, session persists across app restart.

### Clubs

Create a club, join by invite code. Owner can update/delete the club,
regenerate the invite code, add members by username, promote/demote
member ↔ admin, remove members. Roles: Owner / Admin / Member,
enforced server-side. No personal or auto-created clubs.

### Sessions

Owner/admin creates a session (sport, name, location, court count).
Members view/list sessions in their club. Members self-register and
self check-in. Owner/admin can add a walk-in guest (no account)
directly as checked-in.

### Matches

Owner/admin creates a match by picking participants from the
checked-in list and a tennis format/deuce configuration — it starts
queued. Any checked-in participant of that specific match can start
it, which makes them the scorer. Only the current scorer can mark it
complete.

Full tennis rules: singles and doubles, all four match formats (open,
fixed-games, race-to, best-of-sets with optional super-tiebreak), both
deuce modes (standard, single-deuce sudden death), tiebreak at 6-6,
server rotation, undo.

### Live Scoring

Tap-to-score interface, voice announcements of score after each point
and at match end, native share of the result.

### Realtime

Live score sync via Firebase Realtime Database while a match is in
progress.

**Live Match Viewer (required for Milestone 1)**: a checked-in
participant who is not the assigned scorer must be able to open the
session, open the in-progress match, and watch the score update in
real time. Read-only — only the assigned scorer may modify the score.
This does not exist yet (`docs/current/navigation.md`,
`SessionDetailScreen` currently has no action for a `live`-status
Activity) and is treated as a missing MVP feature, not a future
enhancement.

Security hardening of who is *allowed* to write to a live match
(RTDB rules) is explicitly **not** part of this — see Technical
Requirements and `docs/current/firebase-security.md`/`ADR-001`.

### Player Profile

Username and display name, established at sign-up, used to identify
people throughout the app (participant lists, "(You)" labeling).
Profile editing (display name, avatar, etc.) is not required for
Milestone 1 — the API to support it already exists (`PATCH /v1/me`),
but no screen needs to expose it yet. This leaves room for a dedicated
profile view to land later as part of the target Me tab
(`docs/product/navigation.md`), without requiring rework now.

### Settings

Exactly three controls, reachable from the club/session/activity
navigation (currently not reachable from anywhere in it — see Release
Checklist):

- Theme
- Language (English / Bahasa Indonesia)
- Logout

Nothing else. Any other preference (notifications, voice/announcement
settings, etc.) is out of scope for Milestone 1 regardless of whether
it already exists as a component elsewhere (e.g. the legacy
`SettingsModal`'s TTS voice picker).

---

## Out of Scope

- Visitor mode / unauthenticated preview (`docs/product/principles.md`:
  explicit future milestone, "auth remains mandatory in Phase 1").
- Today / Play / Me tab navigation (`docs/product/navigation.md` is a
  target, already clarified elsewhere as "the long-term destination
  rather than an immediate migration," not Milestone 1).
- Cross-club feed of any kind.
- Match/session history browsing (`docs/product/roadmap.md` Phase 4 —
  not started).
- Statistics, rankings, leaderboards, achievements.
- Notifications.
- Payments, reservations.
- Tournament brackets/management, automatic player rotation.
- Match timer, match duration tracking.
- Multi-sport beyond Tennis (Padel is Phase 5).
- Public club directory / club discovery.
- AI features (not mentioned anywhere in product or engineering docs).
- Club ownership transfer (explicitly deferred to a future
  permissions/admin system).
- Scorer transfer mid-match (explicitly called an upcoming feature,
  not current scope).
- Firebase RTDB security hardening (rules requiring scorer
  authorization to write). Current fully-open realtime access is
  sufficient for Milestone 1. Deferred to Milestone 2, after the
  scoring-device authentication design (`ADR-001`) is implemented —
  see `docs/current/firebase-security.md`.
- Offline/resume recovery for in-progress matches. Milestone 1 assumes
  an active network connection while scoring — see Technical
  Requirements.

---

## Non-Goals

Milestone 1 is not intended to:

- Replace tournament software.
- Support very large clubs.
- Support every tennis workflow.
- Compete with professional scoring platforms.

The goal is to validate the core experience — organizing a session and
scoring a match together on personal devices — for small recreational
tennis clubs. Everything in this document is scoped to prove that,
not to build a complete or general-purpose sports platform.

---

## Technical Requirements

- Mobile-first: Expo dev client, **both iOS and Android required.**
  iOS is verified on a physical device; Android is not yet verified on
  any device or emulator — iOS-only is not sufficient to call
  Milestone 1 complete.
- Firebase Auth for identity.
- Go + Gin backend, PostgreSQL for durable data, forward-only migrations.
- Firebase Realtime Database for live match sync. **No security rules
  required for Milestone 1** — current fully-open access is accepted
  as sufficient; hardening is Milestone 2 (`ADR-001`).
- Expo / React Native / TypeScript throughout.
- **No offline tolerance requirement.** Milestone 1 assumes an active
  network connection for the duration of scoring a match. The
  Activity-based match flow (`ActivityMatchScreen`) has no local
  persistence today — an app kill or network loss mid-match loses
  score progress (nothing is written to Postgres until `complete`).
  This is an accepted MVP limitation, not a gap to close now. Mitigate
  with a warning, not a fix — see Release Checklist. Full offline/resume
  recovery moves to Milestone 2.

---

## Release Checklist

- [x] Build the Live Match Viewer: from a session, open a live match
      as a checked-in non-scorer participant and watch score updates
      in real time, read-only.
- [ ] Add a warning before leaving an in-progress scoring screen,
      informing the scorer that progress may be interrupted without a
      network connection. (Offline/resume recovery itself is out of
      scope — Milestone 2.)
- [ ] Build a Settings screen with exactly Theme, Language, Logout,
      reachable from the club/session/match navigation.
- [ ] Android build verified on a physical device or emulator —
      required, not optional, for Milestone 1.
- [ ] Backend deployed somewhere reachable outside a private dev VM.
- [ ] Mobile distribution mechanism decided (EAS build + TestFlight /
      Play Console, vs. continuing manual on-device builds).
- [ ] Regression pass confirming full tennis feature parity (all
      formats, both deuce modes, singles + doubles, undo, voice
      announcements) on the Activity-based flow specifically, not just
      the legacy flow it was ported from.
- [ ] All product decisions in this document confirmed by product
      review, not just engineering read of existing docs.

Explicitly **not** on this checklist, by decision (see Resolved
Decisions): Firebase RTDB security rules, offline/resume recovery.

---

## Definition of Done

Milestone 1 is complete when all of the following are true:

- All Success Criteria items work end-to-end on a real device, without
  developer intervention (no manual database edits, no
  directly-invoked API calls).
- All Release Checklist items are complete.
- The iOS and Android builds are usable by a non-developer — install
  and use the app without engineering assistance, not just runnable
  via `expo run` from a connected laptop.
- No known critical or high-severity bugs.
- Documentation (`docs/product`, `docs/current`, `docs/engineering`)
  matches the shipped implementation.
- The Out of Scope list has been explicitly confirmed by product
  review, not just assumed.

---

## Resolved Decisions

The four open questions from the previous revision of this document,
and the two implementation gaps found while writing it, were resolved
by product review as follows. Recorded here for traceability; the
resolutions are already reflected in the sections above.

1. **RTDB security** — not required for Milestone 1. Current
   fully-open realtime access is sufficient. Hardening moves to
   Milestone 2, after the scoring-device authentication design
   (`ADR-001`) is implemented.
2. **Mobile spectator view** — required for Milestone 1. A checked-in
   participant must be able to open a session, open a live match, and
   watch the score update in real time. Only the assigned scorer may
   modify it.
3. **Android** — required. Milestone 1 targets both iOS and Android;
   iOS-only is not sufficient.
4. **Settings** — scoped to exactly Theme, Language, Logout. Nothing else.
5. **Live Match Viewer** (implementation gap) — treated as a missing
   MVP feature, added to Milestone 1 (see Success Criteria, Realtime,
   Release Checklist).
6. **Offline/resume** (implementation gap) — not a Milestone 1
   requirement. MVP assumes an active network connection while
   scoring. A warning before leaving an in-progress scoring screen is
   the Milestone 1 mitigation; full offline/resume recovery moves to
   Milestone 2.

---

# docs/engineering/

## File: `docs/engineering/README.md`

# Engineering Documentation

Defines technical direction.

Target architecture may be ahead of the current implementation.

Migration should normally be incremental unless explicitly planned otherwise.

---

## File: `docs/engineering/architecture.md`

# Architecture (Target)

Target engineering direction. For what's actually built today, see
`docs/current/architecture.md` — don't treat any gap between the two
as a refactor to do immediately; see `CLAUDE.md`'s rule to prefer
incremental evolution.

## Layers

```
Presentation
    ↓
Application
    ↓
Domain
    ↓
Infrastructure
```

Mapped onto this codebase:

| Layer | Client | Server |
|---|---|---|
| Presentation | `src/mobile/`, `src/components/` | — (no server UI) |
| Application | Use-case functions that orchestrate more than one API call or combine an API call with a business rule. Small and few — most screens don't need this layer, see below. | `server/internal/httpapi/` handlers, kept thin |
| Domain | `src/sports/<sport>/` (scoring engines, format rules), any pure business-rule helper with no I/O | Business rules embedded in `server/internal/db/*.go` query functions (e.g. state-transition guards) |
| Infrastructure | `src/core/api/client.ts` (HTTP), `src/sessionSync.ts` (Firebase RTDB), `src/firebase.ts`, `src/persistence.ts` | `server/internal/db/` (Postgres via pgx), `server/internal/authjwt/` (Firebase token verification) |

**Pragmatic rule, not a mandate**: a screen calling one `core/*/api.ts`
function and rendering the result does not need a separate Application
layer — Presentation calling Infrastructure/Domain directly is fine.
Introduce an explicit use-case function only when a screen's logic
genuinely combines multiple calls, retries, or business rules that
would otherwise get duplicated across screens (see
`docs/current/architecture.md`'s note on `ActivityMatchScreen` for an
example of a good candidate: start-if-queued, tolerate a 409 race,
then create the live-sync session — currently inlined in the screen,
would be a reasonable first Application-layer extraction if a second
screen ever needs the same sequence).

## Server: keep handlers thin

Current pattern (Gin handler → `server/internal/db` function →
SQL) is the target. Do not introduce a service/repository layer on top
of it unless a specific handler's business logic grows past what's
comfortable to read in the handler + one db function. Most handlers
today are ~10–20 lines; that's the bar for "still simple enough."

## Sport modules — target contract

`docs/archive/prd.md`'s "Technical Direction" (see
`docs/engineering/technical-direction.md`) describes a `sports/<name>/`
folder per sport. Today only `sports/tennis/scoringEngine.ts` exists —
no shared contract file. Before Padel is implemented (`docs/product/roadmap.md`
Phase 5), introduce `src/sports/types.ts`:

```ts
interface SportModule<Config, Result> {
  id: string;                                    // 'tennis' | 'padel'
  scoringEngine: {
    createInitialState(config: Config): unknown;
    // addPoint/endMatchNow etc. — sport-specific signatures, no shared
    // interface forced beyond createInitialState, since scoring rules
    // genuinely differ per sport
  };
  rules: {
    validateParticipants(config: Config): boolean;  // e.g. 2 or 4 players
  };
  formatter: {
    pointLabel(state: unknown, team: 'A' | 'B'): string;
    resultSummary(state: unknown): string;           // history lists, share text, voice
  };
}
```

Core code (session/activity screens, future history views, live sync)
should depend only on this contract plus the opaque `config`/`result`
JSON columns already in Postgres (`activities.config`,
`activities.result`) — never on `sports/tennis`'s concrete types
directly. This is already true in practice for the server (the columns
are `JSONB`, never parsed server-side); the client-side contract just
hasn't been written down yet because there's only been one sport to
implement against.

## What this deliberately does not introduce

Per "pragmatic architecture for a small team" — none of the following
are adopted unless a specific, concrete need shows up:

- A global client state library (Redux/Zustand/etc.) — see `state-management.md`.
- A server-side service/repository layer separate from `internal/db/`.
- GraphQL, tRPC, or any alternative to the current plain REST + JSON approach.
- An ORM on the Go side — raw SQL via `pgx` stays.

---

## File: `docs/engineering/project-structure.md`

# Project Structure (Target)

For the current tree with descriptions, see
`docs/current/repository-map.md`. This document is about where *new*
code should go, not a re-listing of what exists.

## Client feature folders

New product features (anything under the Club → Session → Activity →
Match hierarchy, or future Today/Play/Me screens) follow the pattern
already established by `clubs`/`sessions`/`activities`:

```
src/core/<feature>/api.ts       Thin fetch wrappers, typed with core/api/types.ts DTOs
src/mobile/<feature>/*Screen.tsx  One file per screen, no "Mobile" prefix
```

**Two conventions coexist today** — legacy `src/mobile/Mobile*.tsx`
files (each with a `src/components/` web equivalent) and the newer
no-prefix feature folders (mobile-only, no web equivalent). Target:
all new mobile-only screens use the feature-folder convention. Do not
rename existing `Mobile*.tsx` files to match unless you're already
substantially rewriting one for another reason — a pure rename is
churn with no functional benefit.

## Domain/business logic

Sport-specific rules and scoring live in `src/sports/<sport>/`, never
inside a screen component. See `architecture.md` for the target
`SportModule` contract. Cross-sport, cross-feature business rules that
aren't sport-specific (e.g. a future shared "can this user check in"
helper used by multiple screens) belong in `src/core/<feature>/`
alongside that feature's `api.ts`, not in a new top-level folder —
don't create a generic `src/domain/` or `src/utils/` grab-bag.

## Server

Keep the existing one-file-per-aggregate pattern in each of
`internal/models/`, `internal/db/`, `internal/httpapi/`. A new
aggregate (e.g. eventually `matches` if it's ever split out from
`activities`, or `notifications` for a future Today feed) gets its own
`models/<aggregate>.go`, `db/<aggregate>.go`,
`httpapi/<aggregate>_handler.go`, registered in `router.go` — mirrors
how `activities` was added alongside `sessions`/`clubs`.

## Where things don't go

- No `src/utils/` or `src/helpers/` catch-all — if a helper is generic
  enough to not belong to a feature, it likely belongs next to what
  uses it (see e.g. `src/audio.ts`, `src/tts.ts` — platform-split
  utilities living at `src/` root because multiple features use them,
  not because there's a general "utils" convention).
- No new top-level directory without a corresponding entry in
  `docs/current/repository-map.md` once it exists — keep that document
  in sync when structure actually changes.

---

## File: `docs/engineering/state-management.md`

# State Management (Target)

For what's actually implemented, see
`docs/current/state-machines.md` and `docs/current/architecture.md`.
The target is mostly "keep doing what's already being done" — this
project does not need a global state library, and shouldn't adopt one
speculatively.

## The three kinds of state in this app

1. **Server-authoritative state** (clubs, sessions, activities, users)
   — lives in Postgres, fetched per-screen via `core/*/api.ts`, held in
   local `useState`, refreshed via `useFocusEffect`. No client-side
   cache/store keeps this in sync across screens; navigating back to a
   screen re-fetches. **Target: keep this pattern.** It's simple,
   correct (no stale-cache bugs), and the data volumes involved (one
   user's clubs/sessions/activities) are small enough that redundant
   fetches are not a performance problem.
2. **Live, ephemeral state** (an in-progress match's score) — lives in
   Firebase RTDB while live, held in local `useState` on the scoring
   screen, never cached or stored elsewhere. **Target: keep this
   pattern** — this is exactly what RTDB is for, and duplicating it
   into a client store would just be a second source of truth to keep
   in sync.
3. **Cross-cutting session state** (who's logged in) — `AuthContext`,
   a single React Context provider wrapping the app. **Target: this is
   the only case that should use Context.** Don't introduce Context
   providers for feature data (e.g. a "ClubContext") — that data
   belongs to whichever screen fetched it, not to a shared provider.

## When to reconsider

If a specific, concrete pain point shows up — e.g. multiple screens
needing the same data simultaneously and re-fetching becomes visibly
slow, or optimistic updates become necessary for a good UX somewhere —
a lightweight data-fetching/caching library (e.g. TanStack Query) is a
reasonable target to introduce *then*, scoped to that need. Don't
adopt one preemptively; per `CLAUDE.md`, ask before introducing a
major dependency.

## Local match scoring state

`src/sports/tennis/scoringEngine.ts`'s pattern — a pure `MatchState`
object plus pure transition functions (`addPoint`, `endMatchNow`), no
class, no internal mutation — is the target for any future sport
module too (see `architecture.md`'s `SportModule` contract). This
keeps the scoring logic unit-testable without React or network mocks,
which is already paying off (`docs/current` — the scoring engine is
the most thoroughly tested part of the codebase).

## Undo

Callers keep a `history: MatchState[]` array and push a deep clone
before each mutation (see `docs/current/lifecycle-match.md`). This is
adequate for match-length histories (dozens of points, not thousands)
— no need for a more efficient undo structure (e.g. command pattern,
structural sharing) unless match length assumptions change.

---

## File: `docs/engineering/api-guidelines.md`

# API Guidelines (Target)

For the actual current endpoint list, see `docs/current/api.md` — this
document is the convention to follow for *new* endpoints, formalizing
what the existing ones already do consistently.

## URL structure

Resource-oriented, nested under their parent when access is scoped to
it:

```
/v1/clubs/:clubId/sessions          (nested — a session belongs to a club)
/v1/sessions/:id                     (flat — once you have the id, no need to repeat clubId)
/v1/sessions/:id/activities
/v1/activities/:id/start             (action-suffixed for state transitions, not a new verb/method)
```

Keep this pattern: nest under the parent for creation/listing, flatten
to `/v1/<resource>/:id` for direct access once an id is known, and use
a trailing action segment (`/start`, `/complete`, `/join`) for state
transitions rather than modeling them as a generic `PATCH` with a
status field, when the transition has real business logic attached
(auth checks, side effects) beyond "set a column."

## Auth layering

Every new route should compose from the same three checks already
established, in order — see `docs/current/permissions.md`:

1. `RequireAuth` — valid Firebase token.
2. `RequireProfile` — Postgres profile exists (skip only for the two
   routes whose job is to create/check that profile).
3. A resource-scoped check (`requireMember` / `requireSessionAccess` /
   `requireActivityAccess`-style helper) — write a new one following
   the same shape if a new aggregate needs it, rather than inlining
   the membership lookup in the handler.

## Request/response conventions

- JSON in, JSON out. Field names `camelCase` on the wire (Go struct
  tags translate from Go's `PascalCase`).
- Optional fields: `omitempty` + pointer types (`*string`, `*time.Time`)
  in Go, `field?:` in TypeScript. Keep them symmetric.
- Sport-specific or otherwise schema-flexible data (activity `config`/`result`)
  stays opaque `JSONB` server-side, never parsed or validated in Go —
  see `architecture.md`'s `SportModule` contract for why. Don't add
  server-side validation of these blobs' internal shape; that's the
  client-side sport module's job.
- Errors: `{"error": "<message>"}`, plus `code` only when the client
  needs to branch on it programmatically (today: `PROFILE_NOT_FOUND`).
  Don't add a `code` for errors the client only displays as text.

## Status codes

Follow what's already consistent: `201` on resource creation, `200` on
reads/updates/actions, `204` on delete, `400` bad input, `401` auth
failure, `403` authenticated-but-not-permitted, `404` not found, `409`
conflict (state-transition guard failed, uniqueness violation).

## Pagination

Not implemented anywhere today — every list endpoint returns the full
set (see `docs/current/api.md`). This is fine at current data volumes
(one user's clubs/sessions/activities). **Target, not urgent**: if any
list endpoint's result set could realistically grow past a few
hundred rows (most plausible candidate: `GET /v1/activities` once a
history/filter endpoint exists per `docs/product/roadmap.md` Phase 4),
add simple `limit`/`offset` query params then — don't add pagination
to endpoints that don't need it yet.

## Versioning

`/v1` prefix is already in place for exactly this purpose. No action
needed until a breaking change is actually required — then add `/v2`
for the changed routes only, not a wholesale bump.

---

## File: `docs/engineering/coding-standards.md`

# Coding Standards (Target)

Formalizes conventions already followed consistently in the codebase —
this is a "keep doing this" document, not a departure from current
practice.

## TypeScript / React Native

- Function components with hooks only. No class components anywhere
  in the codebase — keep it that way.
- One component per file, file name matches the exported component
  (`SessionDetailScreen.tsx` exports `SessionDetailScreen`).
- Props typed with an inline `type Props = { ... }` above the
  component, not a separate exported interface, unless another file
  needs to import that shape.
- Platform-specific implementations use the `.ts` / `.web.ts` split
  (see `src/audio.ts` / `audio.web.ts`, `tts.ts` / `tts.web.ts`,
  `storage.ts` / `storage.web.ts`) — Metro/webpack resolve the right
  one automatically. Use this pattern for new platform-divergent code
  rather than `Platform.OS` branches inside a single file, when the
  divergence is substantial (more than a few lines).

## User-facing text

**All user-facing strings go through `t()`** (`src/i18n.tsx`), added to
both the `en` and `id` dictionaries. No hardcoded UI strings, including
error messages shown to the user (API error messages from the server
are English-only today — client code should still route them through
a translated fallback where feasible, matching the existing
`err instanceof Error ? err.message : t('authGenericError')` pattern).

## Go

- Standard `gofmt` formatting, no exceptions.
- Sentinel errors (`db.ErrNotFound`, `db.ErrConflict`) + `errors.Is` at
  the handler layer to map to HTTP status codes — this is the
  established pattern (see any `httpapi/*_handler.go`); use it for new
  db-layer errors rather than returning raw `error` and string-matching
  in the handler.
- Handlers stay thin: parameter extraction, permission check, one or
  two db calls, response. Business logic that needs more than that
  belongs in the `db` package function, not the handler — see
  `architecture.md`.
- No ORM, raw SQL via `pgx`. Keep query strings inline in the function
  that runs them (current pattern), not in a separate constants file —
  there aren't enough queries yet for that indirection to pay off.

## Comments

Per the project-wide instruction already in effect: comments explain
*why*, not *what* — a hidden constraint, a workaround, a non-obvious
invariant. Don't add a comment a reader could get from the code itself.
This is already followed closely in the codebase (e.g. the comments on
`requireSessionAccess`, `CreateActivity`'s transaction) — keep matching
that bar.

## No premature abstraction

Small team, small codebase. Three similar lines beat an early
abstraction. Don't build a generic version of something for a second
use case that doesn't exist yet — this applies as much to engineering
docs as code: `architecture.md`'s `SportModule` contract is justified
because Padel is a *committed* next sport (`docs/product/roadmap.md`),
not a hypothetical one.

## Linting / formatting tools

No linter config (ESLint/Prettier) currently exists in this repo, and
none is being added as part of this document — if one is introduced
later, it should be a deliberate, separate decision (it touches every
file), not bundled into unrelated work.

---

## File: `docs/engineering/testing.md`

# Testing (Target)

Current state: two Vitest files client-side
(`src/sports/tennis/scoringEngine.test.ts`,
`src/persistence.test.ts`, 25 tests total), zero Go tests server-side
despite `make test`/`make vet` existing in `server/Makefile`. This
document is the target priority order, not a coverage mandate.

## Priority order (per `CLAUDE.md`: "prioritize business logic and critical user journeys")

1. **Sport modules** (`src/sports/<sport>/scoringEngine.ts`) — pure
   functions, cheapest to test, highest value (a scoring bug is a
   correctness bug in the core product). Keep this at or near full
   coverage of format/deuce/tiebreak combinations, as
   `scoringEngine.test.ts` already does. Any new sport module should
   ship with tests before its scoring engine is considered done.
2. **Server state-transition guards** (`StartActivity`,
   `CompleteActivity`, and anything else that encodes a business rule
   as a SQL `WHERE status = ...` condition — see
   `docs/current/lifecycle-activity.md`) — currently untested. These
   are the highest-value gap: a bug here means a match could be
   started twice or completed by the wrong scorer. Target: add Go
   tests for `internal/db/activities.go` and the permission-check
   helpers in `internal/httpapi/` (`requireMember`,
   `IsCheckedInActivityParticipant`) before this area gets touched
   again for scorer-transfer work.
3. **Permission boundaries** — who can call what (owner/admin/member,
   checked-in-participant, scorer-only, per
   `docs/current/permissions.md`). Currently verified only by manual
   testing during development. Target: at minimum, one test per
   "should be forbidden" case for each new endpoint.
4. Everything else (screen rendering, navigation, simple CRUD
   handlers) — lower priority. Don't chase coverage numbers here.

## What's deliberately not in scope yet

- **No integration/E2E test framework** (Detox, Playwright, etc.) —
  the app is still small enough that manual on-device testing (as
  used throughout this migration) is adequate. Revisit if regressions
  from manual testing start recurring.
- **No mocked-Postgres or testcontainers setup for Go tests** — until
  server-side tests exist at all, don't over-invest in test
  infrastructure. Start with pure-logic tests (permission helpers that
  don't need a live DB) and plain `go test` against a real dev
  Postgres for the rest, matching how the project already does manual
  verification (see `docs/current` — smoke-tested against the real dev
  VM database throughout this migration).
- **No snapshot testing** — not a good fit for a UI this actively
  changing; prefer behavioral tests where tests are added at all.

## Running tests

```bash
npx vitest run <file>      # single client test file
npm test                    # all client tests

cd server && make test      # all Go tests, once they exist
cd server && make vet       # go vet
```

---

## File: `docs/engineering/technical-direction.md`

# Technical Direction

Migrated from `docs/archive/prd.md`. Preserves existing wording and decisions.

---

## Frontend

- React Native
- Expo

Targets

- iOS
- Android
- Web

## Backend

- Authentication
- Cloud database
- Realtime synchronization

## Core Platform

- Users
- Clubs
- Sessions
- Permissions
- History

## Sport Modules

- Rules
- Scoring
- Result formatting
- Statistics

Example

```
sports/

    tennis/
        scoringEngine/
        rules/
        formatter/

    padel/
        scoringEngine/
        rules/
        formatter/
```

---

# docs/current/

## File: `docs/current/README.md`

# Current Documentation

Purpose:
Document the system exactly as implemented today.

This folder is descriptive, not aspirational.

Typical documents:

- api.md
- permissions.md
- session-lifecycle.md
- activity-lifecycle.md
- navigation.md
- state-machines.md

Rules:

- Extract from implementation.
- Do not invent behaviour.
- Keep synchronized with the codebase.

---

## File: `docs/current/architecture.md`

# Architecture (Current)

Describes the system as implemented today. Not the target layered
architecture in `CLAUDE.md` — see `docs/engineering/` for that.

## Components

- **Mobile app** — React Native + Expo, TypeScript. Runs as a custom
  Expo dev client (not Expo Go — native modules like `expo-audio`,
  `expo-image-picker`, `expo-screen-orientation` are configured via
  `app.json` plugins). Entry: `App.tsx` → `Platform.OS !== 'web'` →
  `src/navigation/RootNavigator`.
- **Web app** — same codebase, `react-native-web`. Entry: `App.tsx` →
  `Platform.OS === 'web'` → `src/mobile/ScoringFlow.tsx` directly (no
  navigation library, no auth gate, no club/session/activity model).
  Deployed to Vercel. Untouched by the Aksi migration — still the
  original local-only tennis scorer.
- **Backend** — Go + Gin, module `github.com/yogisofiharja/aksi-server`,
  in `server/`, own `go.mod` (not part of the npm workspace). Talks to
  Postgres via `pgx/v5` (no ORM). Verifies Firebase ID tokens directly
  (`golang-jwt` + `keyfunc` against Google's JWKS) — no Firebase Admin
  SDK, no server-side Firebase project credentials.
- **Postgres** — durable store for users, clubs, sessions, activities.
  Forward-only migrations in `server/migrations/` (`golang-migrate`),
  applied automatically on server startup (`db.RunMigrations` in
  `cmd/api/main.go`) — there is no separate deploy-time migration step,
  and no `.down.sql` files exist.
- **Firebase Auth** — username/password only, via a synthetic email
  (`<username>@accounts.aksi.app`, see `src/core/auth/firebaseAuth.ts`).
  No Google/Apple sign-in, no phone/OTP.
- **Firebase Realtime Database** — live match transport only
  (`src/sessionSync.ts`). Postgres is not written to per-point; a
  match's live score lives in RTDB while in progress and is persisted
  to Postgres once, on `POST /v1/activities/:id/complete`.

## Request flow (mobile, authenticated)

1. `src/core/auth/AuthContext.tsx` holds the Firebase `User` object and
   the Postgres `UserProfile`, fetched via `GET /v1/me`.
2. `src/core/api/client.ts`'s `apiFetch` attaches
   `Authorization: Bearer <Firebase ID token>` (fetched fresh via
   `auth.currentUser.getIdToken()`) to every request. No token caching
   or refresh logic beyond what the Firebase SDK does internally.
3. Backend middleware chain per route: `RequireAuth` (verifies the
   token, no Postgres lookup) → `RequireProfile` (loads the Postgres
   user row, 404s with `code: "PROFILE_NOT_FOUND"` if it doesn't exist
   yet) → handler. Two routes (`POST /v1/users`, `GET /v1/me`) use only
   `RequireAuth`, since they're how the profile gets created/checked in
   the first place.
4. Handlers call into `server/internal/db/*.go` functions directly —
   there is no service/use-case layer between HTTP handlers and SQL.

## Client-side layering (as implemented, not target)

- `src/core/<feature>/api.ts` — thin fetch wrappers, one function per
  endpoint, typed with DTOs from `src/core/api/types.ts` that mirror
  the Go JSON response shape field-for-field (camelCase).
- `src/mobile/<feature>/*Screen.tsx` — screens call `core/*/api.ts`
  functions directly and hold the raw DTOs in `useState`. There is no
  mapping/view-model layer and no separate "Application" layer — the
  screen component is both the presentation and the orchestration code.
- `src/sports/tennis/scoringEngine.ts` — the one clearly-isolated
  domain module: pure functions (`createInitialState`, `addPoint`,
  `endMatchNow`), no I/O, no React, no knowledge of clubs/sessions.
  Used identically by web (`src/components/`) and mobile
  (`src/mobile/activities/ActivityMatchScreen.tsx`,
  `src/mobile/ScoringFlow.tsx`).

## Sport modules

Only `src/sports/tennis/` exists and contains only
`scoringEngine.ts` (+ its test). There is no `src/sports/types.ts`
contract file and no `src/sports/padel/` directory yet, despite both
being described in `docs/archive/prd.md`'s "Technical Direction" section — not
implemented.

---

## File: `docs/current/api.md`

# API (Current)

Base path `/v1`, plus an unversioned `/healthz`. All request/response
bodies are JSON. Auth column: **none** = no auth; **auth** =
`RequireAuth` only (valid Firebase ID token, Postgres profile not
required); **profile** = `RequireAuth` + `RequireProfile` (Postgres
user row must exist).

CORS: `Access-Control-Allow-Origin` is a single configured value
(`ALLOWED_ORIGINS` env var), methods `GET, POST, PATCH, DELETE, OPTIONS`.

## Health

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/healthz` | none | `{"status":"ok"}` |

## Users

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/v1/users/check-username?username=` | none | `{available, reason?}`. Invalid format (not `^[a-z0-9_]{3,20}$`) returns `available:false, reason:"invalid_format"` rather than 400. |
| POST | `/v1/users` | auth | Body `{username, displayName?}`. Creates the Postgres profile. 409 if a profile already exists for this Firebase UID, 409 if username taken (only error mapping — `CreateUser`'s error isn't distinguished further). |
| GET | `/v1/me` | auth | 404 `{"error":"profile not found","code":"PROFILE_NOT_FOUND"}` if no profile yet. |
| PATCH | `/v1/me` | profile | Body `{displayName?, email?, phoneNumber?, avatarUrl?}`. `username` is immutable — not accepted here. |

## Clubs

| Method | Path | Auth | Extra check | Notes |
|---|---|---|---|---|
| POST | `/v1/clubs` | profile | — | Body `{name, description?}`. Caller becomes `owner`. |
| GET | `/v1/clubs` | profile | — | Lists clubs the caller is a member of, with role, ordered by `created_at DESC`. |
| POST | `/v1/clubs/join` | profile | — | Body `{inviteCode}`. Idempotent — already-a-member returns the club without error. |
| GET | `/v1/clubs/:clubId` | profile | member | |
| PATCH | `/v1/clubs/:clubId` | profile | owner | Body `{name?, description?}`. |
| DELETE | `/v1/clubs/:clubId` | profile | owner | Cascades `club_members`, `sessions`, etc. via FK. |
| POST | `/v1/clubs/:clubId/invite-code/regenerate` | profile | owner | |
| GET | `/v1/clubs/:clubId/members` | profile | member | |
| POST | `/v1/clubs/:clubId/members` | profile | owner | Body `{username}`. Direct-add, no invite flow. 404 if username not found, 409 if already a member. |
| PATCH | `/v1/clubs/:clubId/members/:userId` | profile | owner | Body `{role}` — `"member"` or `"admin"` only; cannot set/unset `"owner"` here. |
| DELETE | `/v1/clubs/:clubId/members/:userId` | profile | owner, or self | Removing the sole remaining owner returns 409. |

## Sessions

| Method | Path | Auth | Extra check | Notes |
|---|---|---|---|---|
| POST | `/v1/clubs/:clubId/sessions` | profile | owner/admin of club | Body `{sport, name?, location?, courtCount?}`. `sport` required. Name auto-generated (`"Session on <date>"`) if omitted. |
| GET | `/v1/clubs/:clubId/sessions` | profile | member | |
| GET | `/v1/sessions/:id` | profile | member of parent club | |
| PATCH | `/v1/sessions/:id` | profile | owner/admin | Body `{name?, location?, status?}`. `status` must be one of `open`/`in_progress`/`completed` if present. |
| GET | `/v1/sessions/:id/participants` | profile | member | |
| POST | `/v1/sessions/:id/register` | profile | member | Self-registers caller, idempotent. |
| POST | `/v1/sessions/:id/checkin` | profile | member | Self check-in; auto-registers first if no row exists yet. |
| POST | `/v1/sessions/:id/participants` | profile | owner/admin | Body `{guestName}`. Adds a guest directly as `checked_in`. |

## Activities

| Method | Path | Auth | Extra check | Notes |
|---|---|---|---|---|
| POST | `/v1/sessions/:id/activities` | profile | owner/admin | Body `{config, participants: [{userId\|guestName, team?}]}`. Creates a `queued` activity. `config`/`result` are opaque JSON, not validated server-side. |
| GET | `/v1/sessions/:id/activities` | profile | member | Ordered live → queued → completed, then `created_at ASC` within each. |
| GET | `/v1/activities/:id` | profile | member of parent club | Returns `ActivityDetail` (activity + participants). |
| POST | `/v1/activities/:id/start` | profile | checked-in participant of *this activity* | `queued → live`. Sets `scorer_user_id` = caller, `started_at` = now. 409 if not currently `queued`. |
| POST | `/v1/activities/:id/complete` | profile | current scorer only | Body `{result, pointLog?}`. `live → completed`. 403 if caller isn't `scorer_user_id`. 409 if not currently `live`. |

Not implemented: activity edit/cancel while queued (`PATCH`/`DELETE
/v1/activities/:id`), auto-generation (`POST
/v1/sessions/:id/activities/generate`), scorer transfer — all four are
mentioned in earlier planning but have no route.

## Error shape

All errors: `{"error": "<message>"}`, sometimes with a `code` field
(only `PROFILE_NOT_FOUND` currently uses this). No structured
validation-error format — bad input is a flat 400 with a short string.

---

## File: `docs/current/navigation.md`

# Navigation (Current)

Not the target Today/Play/Me tab bar in `docs/product/navigation.md` —
this describes the actual `src/navigation/` implementation, mobile only.

## Top level — `RootNavigator.tsx`

```
initializing (Firebase auth state loading)
  → ActivityIndicator, nothing else

!firebaseUser
  → AuthStack

firebaseUser && needsProfile
  → CompleteProfileScreen (no navigator, standalone)

firebaseUser && !needsProfile
  → MainStack
```

`needsProfile` comes from `AuthContext`: true when `GET /v1/me` returns
404 `PROFILE_NOT_FOUND` (Firebase account exists, Postgres profile
doesn't — e.g. app was killed mid-signup).

## AuthStack (native-stack, `headerShown: false`)

- **Login** (initial route) → SignUp
- **SignUp** → Login

## MainStack (native-stack, `headerShown: false`)

Single linear stack, no tabs. Screens and how they're reached:

```
ClubList (initial)
  ├─→ CreateClub          → replaces with ClubDetail on success
  ├─→ JoinClub            → replaces with ClubDetail on success
  └─→ ClubDetail { clubId }
        ├─→ ClubMembers { clubId }
        └─→ SessionList { clubId }
              ├─→ CreateSession { clubId }   → replaces with SessionDetail on success
              └─→ SessionDetail { sessionId }
                    ├─→ AddMatch { sessionId }        → goBack() on success
                    └─→ ActivityMatch { activityId }  → goBack() on done
```

Every screen that isn't the initial route is reached via
`navigation.navigate` (pushes) or `navigation.replace` (create/join
flows, so the form screen isn't left in the back stack). "Back" is
always `navigation.goBack()`.

## Not present

- No bottom tabs, no "Today"/"Play"/"Me" concept.
- No profile/settings screen reachable from `MainStack` — the existing
  `SettingsModal` (theme, language, TTS voice) is only reachable from
  `MobileSetupScreen`, which is part of the legacy `ScoringFlow` and is
  not wired into `MainStack` at all.
- No cross-club view of any kind — every screen below `ClubList`
  requires a `clubId` or something scoped under one.

## Web

Web has no navigation library and no screens under `src/navigation/`
or `src/mobile/{auth,clubs,sessions,activities}/`. `App.tsx` renders
`src/mobile/ScoringFlow.tsx` directly, which is its own internal
`useState<AppScreen>` machine — see `docs/current/state-machines.md`.

---

## File: `docs/current/permissions.md`

# Permissions (Current)

All permission logic lives server-side, in `server/internal/httpapi/`.
There is no client-side permission model beyond conditionally hiding
buttons based on the same data the server would check (e.g.
`SessionDetailScreen` only renders "Start" when it thinks the rule
would pass) — the server is always the actual enforcement point, and
re-checks independently.

## Layers, from outermost in

1. **Valid Firebase ID token** (`RequireAuth`) — required by every
   route except `GET /healthz` and `GET /v1/users/check-username`.
2. **Existing Postgres profile** (`RequireProfile`) — required by every
   route except `POST /v1/users` and `GET /v1/me` (which exist
   specifically to create/check that profile).
3. **Club membership** — required for almost everything else. Checked
   via `club_members` row lookup (`requireMember` / `requireSessionAccess`
   / `requireActivityAccess`, which all resolve up to a club membership
   check). No membership → 403 "not a member of this club" (clubs) or
   403 "not a member of this club" (sessions/activities, same message
   reused).
4. **Role within that club** — `owner` / `admin` / `member`, stored per
   `(club_id, user_id)` in `club_members.role`. No cross-club roles —
   being an owner of one club has no effect on another.

## Role capabilities (as enforced, not as documented in `docs/archive/prd.md`)

| Action | Required role |
|---|---|
| Update club, delete club, regenerate invite code, add/remove members, change member roles | `owner` only — `isOwnerOrAdmin` is **not** used here, `requireMember`'s `isOwner` bool is checked directly |
| Remove self from a club | any role (member can always remove themselves) |
| Create session, update session, add guest participant | `owner` or `admin` (`isOwnerOrAdmin`) |
| View session, list sessions, register, check in, view participants | any member |
| Create activity (`POST /v1/sessions/:id/activities`) | `owner` or `admin` |
| View activity/activities | any member of the parent club |
| Start an activity | **not role-based** — see below |
| Complete an activity | **not role-based** — see below |

`docs/archive/prd.md`'s Club Roles section lists Admin as able to "Assign scorer" —
there is no assign-scorer endpoint; the closest actual behavior is
that starting an activity makes the starter the scorer (see
`lifecycle-activity.md`), which is participant-based, not
admin-triggered.

## Activity-specific rules (not role-based)

- **Start** (`POST /v1/activities/:id/start`): caller must be a
  **checked-in participant of that specific activity** — i.e. present
  in `activity_participants` for this activity AND their
  `session_participants.status = 'checked_in'` for the parent session.
  Club role is irrelevant here; an owner who isn't one of the
  activity's participants cannot start it.
- **Complete** (`POST /v1/activities/:id/complete`): caller must be
  exactly `activities.scorer_user_id` (set when the activity was
  started). No one else — not even the club owner — can complete a
  match they aren't scoring.

## Sole-owner protection

`DELETE /v1/clubs/:clubId/members/:userId` refuses (409) if the target
is the club's only `owner`. There is no ownership-transfer endpoint —
if a sole owner wants to leave, another member must first be promoted
to `admin`... but promotion (`PATCH .../members/:userId`) explicitly
only accepts `role: "member" | "admin"`, never `"owner"`. **As
implemented, there is no way to create a second owner or transfer
ownership at all** — a club's owner is permanent once set at creation.

## Live match (Firebase RTDB)

`src/sessionSync.ts` has no security rules or auth check of any kind —
`db.ts`'s Firebase Realtime Database has no documented rules file in
this repo. Any client holding a session code can read and write
`sessions/{code}`. The `scorerUid` field added to `SessionPayload` this
migration is not enforced anywhere (client or RTDB rules) — it's
present in the payload but nothing currently rejects a write from a
non-scorer.

---

## File: `docs/current/repository-map.md`

# Repository Map (Current)

Top-level layout, generated by listing the actual repository. Build
artifacts and dependency directories (`node_modules/`, `ios/`,
`android/`, `dist/`, `.expo/`) are omitted.

```
.
├── App.tsx                  Entry point. Platform.OS branches web vs mobile.
├── app.json                 Expo config — name "Aksi", bundle id com.yogisofiharja.aksi
├── CLAUDE.md                 The only other root-level markdown file, by design — see
│                              docs/archive/ below for everything that used to live here.
├── README.md                Setup only
│
├── docs/
│   ├── product/               Target product docs (vision, principles, navigation,
│   │                           context, interaction, domain, roadmap, terminology)
│   ├── engineering/            Target technical docs (architecture, project-structure,
│   │                           state-management, api-guidelines, coding-standards,
│   │                           testing, technical-direction)
│   ├── current/                 This folder — descriptive, generated from implementation
│   ├── decisions/                Decision records (ADRs, documentation strategy)
│   └── archive/                   Historical planning docs, moved from repo root —
│                                  prd.md (partially migrated, see docs/archive/README.md)
│                                  and three pre-Aksi PoinYuk planning docs (fully
│                                  superseded, kept for reference only)
│
├── src/
│   ├── core/                    Sport-agnostic API layer, one subfolder per feature
│   │   ├── api/                  client.ts (fetch wrapper), types.ts (DTOs)
│   │   ├── auth/                  AuthContext.tsx, firebaseAuth.ts
│   │   ├── clubs/                 api.ts
│   │   ├── sessions/               api.ts
│   │   └── activities/              api.ts
│   │
│   ├── navigation/               React Navigation, mobile only
│   │   ├── RootNavigator.tsx       Picks AuthStack vs MainStack based on auth state
│   │   ├── AuthStack.tsx            Login, SignUp
│   │   └── MainStack.tsx            Everything else (see docs/current/navigation.md)
│   │
│   ├── mobile/                   Native UI — two conventions coexist:
│   │   ├── Mobile*.tsx              Legacy scoring-flow screens (MobileMatchScreen,
│   │   │                            MobileLineupScreen, MobileFinalScreen,
│   │   │                            MobileSetupScreen, MobileHistoryScreen) —
│   │   │                            each has a web/ equivalent in src/components/
│   │   ├── ScoringFlow.tsx          The old App.tsx body, relocated. Used directly by
│   │   │                            web; on mobile it is no longer reachable from
│   │   │                            navigation (retired as an entry point).
│   │   ├── auth/                    SignUpScreen, LoginScreen, CompleteProfileScreen
│   │   ├── clubs/                    ClubListScreen, CreateClubScreen, JoinClubScreen,
│   │   │                            ClubDetailScreen, ClubMembersScreen
│   │   ├── sessions/                  SessionListScreen, CreateSessionScreen,
│   │   │                            SessionDetailScreen
│   │   └── activities/                 AddMatchScreen, ActivityMatchScreen
│   │       (auth/clubs/sessions/activities screens have no web equivalent)
│   │
│   ├── components/                Web UI only. MatchSetup, LineupScreen, MatchScreen,
│   │                              FinalScoreScreen, WatchScreen, HistoryScreen,
│   │                              NativeShareModal, ui/ (design system primitives)
│   │
│   ├── sports/tennis/             scoringEngine.ts (+ test) — the relocated
│   │                              src/scoring.ts, unchanged logic
│   │
│   ├── i18n.tsx                   English + Indonesian, manual dictionary + t()
│   ├── firebase.ts                 Firebase app/auth/db init
│   ├── sessionSync.ts               Firebase RTDB live-match push/subscribe
│   ├── persistence.ts               Local device resume/offline cache (AsyncStorage/localStorage)
│   ├── appTypes.ts                   SetupForm, LineupResult, MatchRecord — legacy
│   │                                local-setup-scoped types, still used by ScoringFlow
│   ├── shareCard.ts / nativeCard.ts   Share-card image generation
│   ├── audio.ts, tts.ts, storage.ts, imagePicker.ts   Platform-split (.ts / .web.ts) utilities
│   └── theme.tsx
│
├── components/ui/                  Gluestack-based UI primitives (box, button, text,
│                                    input, pressable) — used by both src/mobile/<feature>/
│                                    screens and src/components/
│
└── server/                          Go + Gin backend, own go.mod
    ├── cmd/api/main.go               Entry point: load .env, run migrations, start HTTP server
    ├── cmd/migrate/main.go            Standalone `migrate up` command
    ├── internal/
    │   ├── config/                    Env var loading
    │   ├── authjwt/                    Firebase ID token verification + Gin middleware
    │   ├── db/                         One file per aggregate: users, clubs,
    │   │                              club_members, sessions, session_participants,
    │   │                              activities. Raw SQL via pgx, no ORM.
    │   ├── models/                     Plain structs, JSON tags mirror API responses
    │   └── httpapi/                    Route registration + handlers, one file per
    │                                  aggregate + router.go + respond.go
    └── migrations/                     0001_init.up.sql, 0002_drop_personal_club.up.sql
                                        Forward-only — no .down.sql files exist anywhere.
```

## Notes on inconsistency

- Two unrelated mobile screen conventions coexist under `src/mobile/`
  (see the `Mobile*.tsx` vs. feature-subfolder split above) — this is
  a real artifact of the migration, not a mistake to "fix" without
  discussion.
- `README.md` still describes the pre-Aksi, web-only app in places and
  references `src/scoring.ts`, a path that no longer exists (moved to
  `src/sports/tennis/scoringEngine.ts`). Unlike the equivalent legacy
  planning docs (`docs/archive/poinyuk-legacy-roadmap.md`,
  `poinyuk-legacy-plan.md`), `README.md` is meant to stay at root
  (setup only, per `CLAUDE.md`'s Documentation Authority) — its content
  wasn't in scope when the root was consolidated down to `CLAUDE.md` +
  `README.md`, so this staleness is still unresolved.

---

## File: `docs/current/state-machines.md`

# Client-Side State Machines (Current)

Covers app/UI-level state machines not already described in
`navigation.md` (screen routing), `lifecycle-session.md`,
`lifecycle-activity.md`, or `lifecycle-match.md` (data lifecycles).

## AuthContext (`src/core/auth/AuthContext.tsx`)

```
initializing: true, firebaseUser: null, profile: null
        │
        │ Firebase onAuthStateChanged fires
        ▼
firebaseUser === null                          firebaseUser !== null
  → profile: null, needsProfile: false           → GET /v1/me
    initializing: false                              │
                                          ┌───────────┴───────────┐
                                     200 OK                  404 PROFILE_NOT_FOUND
                                          │                       │
                            profile: <data>          profile: null, needsProfile: true
                            needsProfile: false
                                          └───────────┬───────────┘
                                              initializing: false
```

`loadProfile()` failures other than `PROFILE_NOT_FOUND` are swallowed
(`.catch(() => {})` in the `onAuthStateChanged` handler) — the app
falls through to `initializing: false` with stale/no profile rather
than surfacing a network-error state. There is no retry mechanism.

`RootNavigator` reads `{ firebaseUser, initializing, needsProfile }`
directly off this state to choose Auth/CompleteProfile/Main — see
`navigation.md`.

## ActivityMatchScreen (`src/mobile/activities/ActivityMatchScreen.tsx`)

```
mount
  → loading: true
  → GET /v1/activities/:id
  → createInitialState(config)          [see lifecycle-match.md]
  → if status === 'queued': POST /start (409 from a race is swallowed)
  → if Firebase configured: generate a session code, no subscription (push-only)
  → loading: false

render branches on (loading, error, matchState.isEnded):
  loading            → spinner + "activityLoading" text
  error || !matchState → error text + back button
  matchState.isEnded  → MobileFinalScreen (share / back-to-session / leave-live-session)
  else                → MobileMatchScreen (live scoring UI)
```

There is no explicit "live" vs "queued" render state distinct from
`matchState.isEnded` — the screen doesn't re-check `activities.status`
after the initial load; it trusts local `matchState` for the rest of
the screen's life. `startedRef`/`completedRef` guards exist only to
prevent duplicate network calls (React effect double-invocation in
dev), not to represent additional UI states.

## ScoringFlow (`src/mobile/ScoringFlow.tsx`) — legacy, web + retired-on-mobile

Still the entire web app (`App.tsx`'s web branch renders it directly,
no auth, no navigation library). On mobile it is no longer reachable
from any screen (see `navigation.md`) but the file and its logic are
unchanged and still shared with web.

```
type AppScreen = 'setup' | 'lineup' | 'match' | 'final' | 'history'
```

- **setup** (default) — `MatchSetup`/`MobileSetupScreen`. Local
  `SetupForm` state (mode, players[], matchFormat,
  singleDeuceSuddenDeath). Optionally generates a Firebase session code
  here or defers to lineup.
- **lineup** — `LineupScreen`/`MobileLineupScreen`. Assigns players to
  teams + picks first server, builds a `MatchConfig`, calls
  `createInitialState`, → **match**.
- **match** — `MatchScreen`/`MobileMatchScreen`, driven by
  `src/sports/tennis/scoringEngine.ts` exactly as in
  `lifecycle-match.md`. On `isEnded` → **final**.
- **final** — `FinalScoreScreen`/`MobileFinalScreen`. Share, "new
  match" (→ **lineup**, keeping session alive), or "end session"
  (clears everything → **setup**).
- **history** — `HistoryScreen`/`MobileHistoryScreen`, local
  `matchHistory` array only (not Postgres) capped at 100 entries.
  Reachable from **final** only, returns to whichever screen requested
  it (`historyReturnScreenRef`).

Firebase RTDB sync in this flow pushes/receives `SessionPayload`
without `activityId`/`scorerUid` (those fields are `ActivityMatchScreen`-only;
`SessionPayload` declares them optional so both flows share one type).

State persists to local storage (`src/persistence.ts`) on every
change and rehydrates on mount — this is the only one of the four
flows described here with offline/relaunch resume.

---

## File: `docs/current/lifecycle-session.md`

# Session Lifecycle (Current)

Two separate state machines exist under "session": the session itself,
and each participant's status within it. `docs/archive/prd.md` describes a target
that doesn't fully match what's implemented — differences are called
out below.

## Session status

Column: `sessions.status`, `CHECK IN ('open','in_progress','completed')`,
default `'open'`.

```
open  ⇄  in_progress  ⇄  completed
```

All three are reachable from each other — there is **no enforced
transition order**. The only way status changes is an explicit
`PATCH /v1/sessions/:id { status }` by the session's club owner/admin
(`UpdateSession` in `server/internal/db/sessions.go`). **Nothing in the
codebase changes session status automatically** — starting an
activity, completing a match, or checking players in has no effect on
`sessions.status`. No mobile screen currently exposes a control to
change it either (`SessionDetailScreen` never calls `updateSession`).

## Session participant status

Column: `session_participants.status`,
`CHECK IN ('registered','checked_in','participated')`, default
`'registered'`.

```
registered → checked_in → participated   (per docs/archive/prd.md's target)

registered → checked_in                   (as actually implemented)
```

- `RegisterParticipant` (`POST /v1/sessions/:id/register`) inserts with
  `status='registered'` if no row exists; no-op if one already does
  (`ON CONFLICT ... DO NOTHING`).
- `CheckIn` (`POST /v1/sessions/:id/checkin`) upserts to
  `status='checked_in', checked_in_at=now()` — auto-registers first if
  the caller had no row at all (one tap covers both steps).
- `AddGuestParticipant` (owner/admin action) inserts a guest directly
  at `status='checked_in'` — guests skip `'registered'` entirely.
- **`'participated'` is declared in the DB `CHECK` constraint and in
  the TypeScript type (`ParticipantStatus` in `src/core/api/types.ts`)
  but no code path ever sets it.** There is no "mark as participated"
  endpoint, and completing an activity does not update
  `session_participants.status` for anyone in it. As implemented, a
  participant's status is permanently either `registered` or
  `checked_in`.

## Mobile UI reflection

`SessionDetailScreen.tsx` shows a single "Check In" button when
`myParticipant?.status !== 'checked_in'`, and a static "Checked in"
badge otherwise — it has no concept of `'participated'`.

---

## File: `docs/current/lifecycle-activity.md`

# Activity Lifecycle (Current)

Column: `activities.status`, `CHECK IN ('queued','live','completed')`,
default `'queued'`.

```
queued → live → completed
```

Strictly linear, one direction, no skipping — enforced by SQL `WHERE
status = '<expected>'` on every transition (see below), not just
application-level checks.

## queued (creation)

`POST /v1/sessions/:id/activities` (owner/admin only, see
`permissions.md`). Inserts one `activities` row (`status` defaults to
`queued`) and one `activity_participants` row per entry in the request
body, all in a single transaction (`CreateActivity` in
`server/internal/db/activities.go`). `config` is stored as opaque
`JSONB` — the server never parses or validates its shape; it's built
and read entirely client-side by
`src/sports/tennis/scoringEngine.ts`/`AddMatchScreen.tsx`.

**Not implemented**: no auto-generation from an idle player pool, no
editing or cancelling a queued activity (`PATCH`/`DELETE
/v1/activities/:id` don't exist), no `queue_position` is ever written
despite the column existing.

## queued → live (start)

`POST /v1/activities/:id/start`. Requires the caller to be a
checked-in participant of *this* activity (see `permissions.md`).
`StartActivity`: `UPDATE activities SET status='live',
scorer_user_id=$caller, started_at=now() WHERE id=$1 AND
status='queued'`. If the `WHERE` matches zero rows, the handler
disambiguates: activity genuinely not found → 404, activity exists but
isn't `queued` → 409. This means **the first person to successfully
call `/start` becomes the scorer** — there's no separate
"assign scorer" step, and no explicit conflict handling beyond the
race being resolved by whichever request's `UPDATE` commits first.

On the client, `ActivityMatchScreen` calls `getActivity` first; if
status is already `queued`, it calls `/start` and treats a 409 as
"someone else already started it, join anyway" (catches
`ApiRequestError` with `status === 409` and proceeds without
surfacing an error).

## live (in progress)

Score updates during this phase go through Firebase RTDB
(`src/sessionSync.ts`), **not** the Postgres API — `activities.config`,
`result`, `point_log` are not touched again until completion. See
`lifecycle-match.md` for what happens client-side during this phase,
and `permissions.md` for the (currently unenforced) live-sync access
model.

There is no scorer-transfer endpoint. Whoever started the activity
remains `scorer_user_id` until it completes; if their device is lost
mid-match there's no way to hand off through the API.

## live → completed (complete)

`POST /v1/activities/:id/complete`, caller must equal
`scorer_user_id` exactly. `CompleteActivity`: `UPDATE activities SET
status='completed', result=$body.result, point_log=COALESCE($body.pointLog,
point_log), completed_at=now() WHERE id=$1 AND status='live'` — same
404-vs-409 disambiguation as start. `result` is required in the
request body (400 if empty); `pointLog` is optional and, if omitted,
leaves the column at its default `'[]'`.

`ActivityMatchScreen` calls this once, from `finalizeActivity`, guarded
by a `completedRef` so it can't fire twice for the same screen
instance. On failure it only `console.error`s — there is no retry and
no user-facing error if the complete call fails after the match has
already ended locally.

**Not implemented**: no automatic top-up/regeneration of the next
queued activity on completion (mentioned in earlier planning, no code
exists for it).

## completed (terminal)

No further transitions. `GET /v1/sessions/:id/activities` and `GET
/v1/activities/:id` still return completed activities (ordered after
`live`/`queued` in the list endpoint), but there is no dedicated
history view — see `docs/current/api.md`'s note that no
`GET /v1/activities?userId=&clubId=&sport=` filter endpoint exists.

---

## File: `docs/current/lifecycle-match.md`

# Match Lifecycle (Current)

This is the client-side state machine in
`src/sports/tennis/scoringEngine.ts` — pure functions, no I/O. It runs
identically on web and mobile, and both inside a Phase-3 Activity
(`ActivityMatchScreen`) and in the legacy local flow (`ScoringFlow`).
It is **not** the same thing as `activities.status` in
`lifecycle-activity.md` — a single `live` Activity's entire match plays
out client-side inside this state machine before `complete` is ever
called.

## State shape (`MatchState`)

```
config          MatchConfig (mode, deuceMode, players[], matchFormat, serviceOrderPlayerIds?)
points          { A, B }
games           { A, B }
sets            { A, B }
completedSets   Array<{ A, B }>
deuceCount      number
currentServerPlayerId
tiebreak        { target, pointsPlayed } | null
isEnded         boolean
winner          'A' | 'B' | null
endReason       'manual' | 'auto' | 'none'
```

## Entry — `createInitialState(config)`

Server (first entry in `serviceOrderPlayerIds`, or `players[0]` if
unset) starts as `currentServerPlayerId`. All counters zero, `tiebreak:
null`, `isEnded: false`.

## Per-point — `addPoint(state, team)`

No-op if `isEnded`. Two modes:

**Tiebreak mode** (`state.tiebreak` set): increments the scoring
team's point count; server rotates after the 1st point then every 2
points (`newPointsPlayed % 2 === 1`). Ends when a side reaches
`tiebreak.target` with a lead of ≥2 — awards the game, resets points,
appends to `completedSets`, increments `sets`, clears `tiebreak`. If
the format is `best-of-sets` and the winner has now reached
`setsToWin`, `isEnded = true, endReason = 'auto'`. If instead both
sides are one set from `setsToWin` and `superTiebreak` is enabled, a
new tiebreak starts immediately (`target: 10`) instead of a normal
game.

**Normal mode**: standard point increment, with deuce/advantage logic:
- `standard` deuce: unlimited deuce/advantage, win by 2, `points >= 4`.
- `singleDeuceSuddenDeath`: after `deuceCount >= 2`, the next point
  scored by either side wins the game outright (no advantage step).

On a game win, points reset, server rotates, `deuceCount` resets, and
one of four format branches runs:
- `open` — no auto-end, only manual.
- `race-to` — ends when a side's `games` reaches `raceTo`.
- `fixed-games` — ends when `games.A + games.B >= totalGames`, unless
  tied and `goldenGameOnTie` is set and the total hasn't been exceeded
  yet (plays one more game).
- `best-of-sets` — at 6–6 games, starts a tiebreak (`target: 7`)
  instead of continuing normal games. Otherwise a set is won at ≥6
  games with a 2-game lead; same `setsToWin`/`superTiebreak` checks as
  the tiebreak-mode set-win path above.

## Manual end — `endMatchNow(state)`

No-op if already `isEnded`. Sets `isEnded = true, endReason =
'manual'`, and decides a winner by: more sets → more games → (if a
tiebreak is in progress) more tiebreak points → otherwise `null`
(no winner, e.g. ending at 0–0).

## Undo

Not part of the engine itself — callers (`ScoringFlow`,
`ActivityMatchScreen`) keep a `history: MatchState[]` array, push a
deep clone (`JSON.parse(JSON.stringify(...))`) before every
`addPoint`/`endMatchNow` call, and undo by popping the last entry back
into current state. The engine has no built-in undo/redo.

## Persistence during a live match

Nothing here writes to Postgres. `ActivityMatchScreen` pushes the
entire `MatchState` (plus `history`, `activityId`, `scorerUid`) to
Firebase RTDB on every state change (`pushSessionState`), for
spectators/QR viewers only. The Activity row in Postgres is untouched
between `start` and `complete`.

---

## File: `docs/current/firebase-security.md`

# Firebase Realtime Database Security (Current + Proposal)

**Status: proposal only. Nothing in this document has been implemented.**
See `docs/current/permissions.md` for how this was first flagged.

## Current state

No `database.rules.json` (or equivalent) exists anywhere in this
repository, and no `firebase.json` either — RTDB rules for this
project, whatever they are, live only in the Firebase console and
aren't version-controlled or reviewable here.

What the client code implies about the effective rules: `src/sessionSync.ts`
reads and writes `sessions/{code}` with no ID token, no per-user check,
and no server-side mediation — `pushSessionState`/`subscribeToSession`
just call `set`/`onValue` on a path built from the 5-character code
alone (`src/sessionSync.ts`, `generateSessionCode`). For this to have
worked in testing throughout this migration (live score sync between
devices), the actual configured rules must currently allow open
read/write on `sessions/{code}` to anyone who has the code — codes
being the only "secret." This is inferred from observed behavior, not
read directly from the Firebase console (out of this repo's reach) —
worth confirming against the console directly before treating it as
fact.

## Why this matters

Per `docs/product/domain.md`'s Scoring Permission rules: "Only one
scorer can edit the score. Everyone else has read-only access." This
is currently a **client-side convention only** —
`ActivityMatchScreen` includes a `scorerUid` field in what it pushes,
but nothing rejects a write from a non-scorer client. Anyone who
obtains a session code (e.g. by guessing one of the ~40 billion
5-character combinations, or more realistically by a QR code being
shared beyond its intended audience) can currently overwrite live
match state for that session.

## Complication: web and mobile share this database differently

This is the main reason to review before implementing, not just ship
a rule:

- **Mobile** (`ActivityMatchScreen`) — user is always signed in via
  Firebase Auth (mandatory before reaching any screen that scores a
  match, see `docs/current/navigation.md`). `auth.uid` is reliably
  available.
- **Web** (`ScoringFlow` via `App.tsx`) — **no sign-in exists at all**.
  `src/firebase.ts` initializes `auth` from the same app instance, but
  nothing on web ever calls `signIn`/`signUp` — web users are always
  anonymous/unauthenticated as far as Firebase Auth is concerned. Web
  is explicitly frozen/untouched by this migration (see
  `docs/current/architecture.md`).

Both currently write to the same `sessions/{code}` path shape via the
same `SessionPayload` type (`activityId`/`scorerUid` are optional
precisely so both flows can share it — see
`docs/current/state-machines.md`). **A rule that requires
`auth != null` to write would silently break web's live-sync/share
feature entirely**, since no web request will ever carry a Firebase
ID token.

## Proposed ruleset (for review — do not apply yet)

```json
{
  "rules": {
    "sessions": {
      "$code": {
        ".read": true,
        ".write": "auth == null || !data.exists() || data.child('scorerUid').val() === auth.uid || !data.child('scorerUid').exists()"
      }
    }
  }
}
```

Mechanism: read stays open (spectators/QR viewers never sign in
either, on either platform). Write is allowed if:
- unauthenticated (web — no `scorerUid` enforcement possible or
  attempted for that path), **or**
- the node doesn't exist yet (first write, whoever creates the
  session), **or**
- the existing node has no `scorerUid` (payloads without it — legacy
  `ScoringFlow` sessions on mobile, if any old clients remain), **or**
- the caller's `auth.uid` matches the stored `scorerUid`.

This closes the gap for `ActivityMatchScreen` sessions specifically
(the only flow that actually sets `scorerUid` and has a signed-in
user) without breaking web. It is **not** a strong guarantee — a
malicious signed-in mobile user could still write to a session they
were never a participant of, as long as they know the code and no
scorer has claimed it yet (`data.exists()` false or no `scorerUid`
set). Closing that gap fully would require the write to check the
caller is an actual participant of the corresponding Activity, which
RTDB rules can't verify against Postgres — would need either (a) the
Go backend to mint a scoped custom token on `/start`, or (b) moving
live sync off RTDB entirely (see `docs/archive/prd.md`'s deferred "self-hosted
replacement" idea, out of scope here).

## Options for review, not a decision made here

1. **Ship the rule above as-is** — meaningfully better than today (an
   idle/unclaimed session or any web session is still open, but an
   actively-scored mobile Activity session is protected once claimed).
2. **Wait and design a stronger mechanism** (custom token minted on
   `/start`, scoped to that specific `activityId`) before touching
   rules at all — more correct, more work, blocks on backend changes.
3. **Split the RTDB path** by flow (e.g. `activities/{activityId}`
   for mobile, keep `sessions/{code}` for legacy/web) so mobile can
   get a strict `auth.uid`-only rule with zero risk to web — cleanest
   long-term separation, but is a client-side change to
   `sessionSync.ts` and every caller, not just a rules file.

No action taken pending a decision on which of these (or something
else) to pursue.

---

# docs/decisions/

## File: `docs/decisions/ADR-001-scoring-device-authentication.md`

# ADR-001: Scoring Device Authentication

## Status

**Target** — not implemented. This ADR records a decision about the
long-term direction; it does not describe current behavior and does
not authorize any code change. See "Current Implementation" below for
what actually exists today, and `docs/current/firebase-security.md`
for the fuller current-state writeup and the interim options this ADR
supersedes with a chosen direction.

## Context

Live match scoring syncs through Firebase Realtime Database
(`sessions/{code}`, see `docs/current/architecture.md` and
`docs/current/state-machines.md`). Two independent flows write to the
same path shape:

- **Mobile** (`ActivityMatchScreen`) — the user is always signed in
  via Firebase Authentication before reaching this screen
  (`docs/current/navigation.md`'s `AuthStack` gate). `auth.uid` is
  always available.
- **Web** (`ScoringFlow`) — intentionally has no sign-in at all. This
  is deliberate, not an oversight: web is frozen/untouched by the Aksi
  migration (`docs/current/architecture.md`), and its whole value
  proposition is zero-friction scoring — open the page, get a code,
  start scoring, no account needed.

Both flows currently write to `sessions/{code}` with no server-side
enforcement of who's allowed to write (`docs/current/firebase-security.md`).
That document proposed a stopgap `scorerUid`-based rule keyed on
`auth.uid`, but flagged that any rule requiring `auth != null` would
break web outright, since web requests never carry a Firebase ID
token.

## Decision

Stop modeling this as "authenticated user vs. anonymous user." Model
it instead as: **every device that is actively scoring a match holds a
temporary scoring credential, whether or not it's signed into a full
Aksi account.**

Concretely, the target mechanism:

1. **The web scorer is a temporary scoring device, not an anonymous
   user.** It doesn't need — and should never be pushed toward
   needing — a real account just to keep scoring working. The
   credential it holds is scoped to *one match*, not to an identity.
2. **The backend issues a temporary scoring token** (or equivalent
   mechanism — e.g. a Firebase custom token minted with narrow custom
   claims, short expiry, scoped to a specific session code / activity
   id) at the point scoring begins:
   - Mobile: issued when `POST /v1/activities/:id/start` succeeds
     (the caller is already a verified checked-in participant at that
     point — the token is a natural byproduct of that check, not a
     new authorization decision).
   - Web: issued by an equivalent "create a scoring session" call that
     doesn't require a Postgres profile or Firebase account at all —
     preserving today's zero-friction entry point.
3. **Firebase Security Rules validate that token**, not permanent
   user identity — e.g. `auth.token.sessionCode ===
   $code`/`auth.token.activityId === $id` instead of comparing against
   a stored `scorerUid`. A device holding a valid, unexpired token for
   *this* session can write to it; nothing else can, regardless of
   whether it's "logged in" in the Aksi-account sense.
4. This directly closes the gap `docs/current/firebase-security.md`
   couldn't close with a `scorerUid`-only rule: today, any client that
   knows a session code and has *some* Firebase Auth session (any
   account) can claim an unclaimed session as scorer. A scoped token
   tied to a specific session/activity at issuance time removes that
   window entirely, for both platforms uniformly.

## Consequences

**Positive**

- Web keeps its frictionless, no-signup scoring experience — this was
  the non-negotiable constraint that made the simpler
  "`auth != null`" rule unworkable.
- Mobile and web converge on the *same* security mechanism instead of
  needing platform-specific rules or a split RTDB path
  (`docs/current/firebase-security.md`'s Option 3) — one rule, one
  mental model.
- The credential is scoped to exactly what it needs to authorize (one
  session/match), which is a tighter guarantee than "any signed-in
  user who got there first," the gap in the current `scorerUid`
  proposal.

**Negative / cost**

- Requires new backend work: a token-issuing endpoint (or extending
  `/start` and its web equivalent), token expiry/refresh handling for
  long matches, and a new RTDB rules shape built around custom claims
  instead of `auth.uid`.
- Firebase custom tokens (if that's the chosen mechanism) require the
  Admin SDK to mint — the backend currently deliberately avoids the
  Firebase Admin SDK (`docs/current/architecture.md`: ID-token
  verification only, no Admin SDK, no server-side Firebase
  credentials). This ADR's mechanism would be the first thing to
  require adding it.
- More moving parts than the `docs/current/firebase-security.md`
  stopgap rule — not something to build until it's prioritized.

## Alternatives considered

See `docs/current/firebase-security.md`'s three options for the fuller
comparison. This ADR selects a variant of its Option 2 (a stronger,
purpose-built mechanism) over Option 1 (ship the `scorerUid` rule
as-is — rejected as a permanent solution because it still requires
`auth != null` and therefore still excludes web) and Option 3 (split
RTDB paths by platform — rejected because it solves the access-control
problem by fragmenting the data model instead of by fixing the
credential model, and would still need *some* answer to "how does web
prove it's allowed to write" underneath it).

## Not decided here

- Exact token mechanism (Firebase custom token vs. a different
  short-lived credential scheme) — "or equivalent mechanism" is left
  open deliberately.
- Token lifetime / refresh behavior for matches longer than one token's TTL.
- Whether this replaces or coexists with the interim `scorerUid` rule
  proposed in `docs/current/firebase-security.md` as a stepping stone.
- Timeline — this is a target direction, not scheduled work.

---

## File: `docs/decisions/Documentation_Update_Project_Decision.md`

# Documentation Update (Project Decision)

## Purpose

This document clarifies the documentation strategy for AKSI and resolves
ambiguities introduced during the transition to the new handbook
structure.

------------------------------------------------------------------------

## Product Documentation Was **Not** Removed

The removal of the previous `docs/product/*` documents was **not
intentional**.

The latest handbook update was intended to **add** the new documentation
model (`docs/current`) and improve `CLAUDE.md`. It was **not** intended
to replace or delete any existing product documentation.

The following product documents should remain part of the repository
until they are intentionally rewritten:

``` text
docs/product/
├── vision.md
├── principles.md
├── navigation.md
├── context.md
├── interaction.md
├── domain.md
├── roadmap.md
└── terminology.md
```

------------------------------------------------------------------------

# Documentation Structure

``` text
docs/
├── current/
│   Describes the implementation exactly as it exists today.
│   Reverse-engineered from the codebase.
│
├── product/
│   Describes the desired product.
│   Product vision, UX, navigation, terminology,
│   domain rules, future behaviour.
│
└── engineering/
    Describes how the software should be built.
    Architecture, coding standards,
    state management, testing, API conventions.
```

All three folders are first-class documentation and serve different
purposes.

------------------------------------------------------------------------

# Documentation Principles

Always distinguish between three concepts.

## Current

Represents the implementation that exists today.

Examples:

-   Current API
-   Current navigation
-   Current permissions
-   Current lifecycle
-   Current repository structure

Rules:

-   Derived from implementation.
-   Never invent behaviour.
-   Keep synchronized with the code.

------------------------------------------------------------------------

## Product

Represents the intended behaviour of AKSI.

Contains:

-   Product vision
-   UX decisions
-   Domain model
-   Navigation
-   Terminology
-   Business rules

Rules:

-   Never infer product behaviour from implementation.
-   Missing product decisions must be discussed before implementation.

------------------------------------------------------------------------

## Engineering

Represents technical direction.

Contains:

-   Architecture
-   Coding standards
-   API guidelines
-   State management
-   Testing
-   Performance

Target architecture may be ahead of today's implementation.

Migration should normally be incremental.

------------------------------------------------------------------------

# Rules for Claude

When documentation is missing:

-   You MAY generate `docs/current/*` by analysing the implementation.
-   You MUST NOT invent new product behaviour.
-   You SHOULD ask questions whenever product intent is unclear.
-   You SHOULD prefer incremental improvements over large rewrites.
-   Do not perform architectural rewrites solely to match target
    documentation.

------------------------------------------------------------------------

# Documentation Authority

Priority order:

1.  `docs/product/`
2.  `docs/engineering/`
3.  `docs/current/`
4.  `docs/archive/prd.md` (temporary until migrated)
5.  `README.md` (setup only)

Legacy planning documents should be archived after their useful content
has been migrated.

------------------------------------------------------------------------

# Repository Goal

The repository should become self-documenting.

Each documentation layer answers a different question:

-   **Current** → How does the system work today?
-   **Product** → What should the system become?
-   **Engineering** → How should we build it?

These are intentionally different and should remain separate.

------------------------------------------------------------------------

# Guidance for AI Contributors

If a document can be generated from implementation (`docs/current`),
generate it.

If it requires product decisions (`docs/product`), ask before writing.

Prefer complete, high-quality documentation over placeholder files.

---

# docs/architecture/ (AKSI UI Design System)

## File: `docs/architecture/README.md`

# AKSI Architecture Documentation

Welcome to the AKSI Architecture documentation.

This folder contains the architectural principles that guide the development of the AKSI application.

These documents exist to ensure consistency across the project regardless of whether code is written by humans or AI assistants.

---

# Reading Order

New contributors should read these documents in the following order:

1. DESIGN_PHILOSOPHY.md
2. DESIGN_SYSTEM.md
3. DESIGN_TOKENS.md
4. COMPONENT_STANDARDS.md
5. DOMAIN_UI.md
6. LAYOUT_SYSTEM.md
7. MOTION_AND_ANIMATION.md
8. ACCESSIBILITY.md
9. PERFORMANCE.md
10. MIGRATION_GUIDE.md

---

# Architecture Goals

The architecture prioritizes:

- Simplicity
- Consistency
- Scalability
- Maintainability
- Developer Experience
- Accessibility
- Performance

---

# Principles

We optimize for long-term maintainability instead of short-term convenience.

Every component should be reusable.

Every abstraction should justify its existence.

Every new dependency increases maintenance cost.

Whenever possible:

- Improve existing code
- Avoid duplication
- Prefer composition
- Keep APIs predictable

---

# Scope

These documents define:

- Design language
- Design System
- Component standards
- Layout architecture
- Motion
- Accessibility
- Domain UI
- Performance
- Migration strategy

They intentionally do NOT define:

- Business logic
- Firebase architecture
- Backend APIs
- Navigation flow
- Feature requirements

Those belong in Product documentation.
---

## File: `docs/architecture/DESIGN_PHILOSOPHY.md`

# AKSI Design Philosophy

## Vision

AKSI is a premium community sports platform.

The UI should feel modern, calm, and trustworthy.

The interface should disappear so users can focus on playing sports.

---

# Inspiration

Our visual inspiration comes from:

- Linear
- Vercel
- Apple Fitness
- Notion
- Arc Browser

We intentionally do NOT follow:

- Material Design
- Bootstrap
- Enterprise dashboards
- Gaming interfaces

---

# Design Values

Every screen should feel:

- Clean
- Fast
- Spacious
- Predictable
- Consistent
- Accessible

---

# Simplicity

Simple beats clever.

Simple code.

Simple UI.

Simple interactions.

Every additional feature increases maintenance cost.

---

# Consistency

Consistency is more important than creativity.

Users should never wonder:

- How do I navigate?
- Where is the action?
- Why is this button different?

---

# Typography First

Hierarchy should come from typography.

Not colors.

Not borders.

Not shadows.

If typography cannot explain the hierarchy, rethink the layout.

---

# Color Philosophy

Color is reserved for:

- Primary actions
- Status
- Feedback

Everything else should remain neutral.

Avoid colorful dashboards.

---

# Motion Philosophy

Motion should:

- Explain
- Guide
- Confirm

Never distract.

Never exist for decoration.

---

# White Space

White space is not wasted space.

Spacing improves readability.

Avoid crowded interfaces.

---

# Components

Components should solve problems.

Not showcase engineering.

The best component is the simplest one that solves the problem.

---

# Maintainability

Every new component has a maintenance cost.

Before creating a component ask:

Can an existing component be extended?

If yes, extend it.

---

# Final Principle

When in doubt:

Prefer consistency over creativity.

Prefer composition over configuration.

Prefer readability over cleverness.

Prefer fewer components over many.

Prefer long-term maintainability over short-term speed.
---

## File: `docs/architecture/DESIGN_SYSTEM.md`

# AKSI Design System

The Design System provides the foundation for every screen.

It should remain independent from business logic.

---

# Hierarchy

Foundation

↓

Primitives

↓

UI Components

↓

Domain UI

↓

Pages

↓

Features

---

# Foundation

Contains design tokens.

Examples:

- Colors
- Typography
- Spacing
- Radius
- Shadows
- Motion

Foundation contains no React components.

---

# Primitives

Very small building blocks.

Examples:

- Stack
- HStack
- VStack
- Spacer
- Container

Primitives never know about business logic.

---

# UI Components

Reusable controls.

Examples:

- Button
- Card
- Badge
- Input
- Icon
- Modal

These should work in every application.

---

# Domain UI

Reusable business UI.

Examples:

- ClubCard
- SessionCard
- PlayerCard
- MatchCard
- LeaderboardCard

These understand AKSI concepts.

---

# Pages

Page layouts.

Examples:

- Page
- ScrollPage

(`ModalPage` was introduced in Phase 2 and removed after Phase 4 — see
LAYOUT_SYSTEM.md and ROADMAP.md's Phase 2 scope note.)

Responsible for:

- Safe Area
- Status Bar
- Keyboard
- Background
- Header

---

# Features

Business logic.

Examples:

- Authentication
- Club
- Session
- Match
- Profile

Features consume Domain UI.

They never build reusable UI themselves.

---

# Dependency Rules

Foundation

↓

Primitives

↓

UI Components

↓

Domain UI

↓

Pages

↓

Features

Dependencies must only point downward.

Never the opposite.

---

# Design System Rules

Design System must never:

- Call APIs
- Know Firebase
- Know navigation
- Know business logic
- Know sports

It only renders UI.

---

# Icons

All icons go through a single `Icon` wrapper component. Feature screens must never import an icon library directly.

* **Provider**: `@expo/vector-icons/Ionicons` — already a project dependency, and the icon set used throughout the existing app. `Icon` wraps it; it does not replace it.
* **API**: `<Icon name="calendar" size="md" color="primary" />` — name matches the underlying Ionicons glyph name, `size` and `color` are semantic tokens, never raw numbers or hex values.
* **Sizes**: use the `xs`/`sm`/`md`/`lg`/`xl` scale from Design Tokens. Never pass a raw numeric `size`.
* **Colors**: use semantic color tokens (`primary`, `muted`, `destructive`, etc.), the same palette used everywhere else. Never pass a raw hex value, and never branch on `dark ? '#xxx' : '#yyy'` inline — `Icon` resolves the correct color for the current theme internally.
* **Rule**: no feature screen may import `Ionicons` (or any other icon library) directly. If a screen needs an icon, it goes through `Icon`.
---

## File: `docs/architecture/DESIGN_TOKENS.md`

# Design Tokens

Design Tokens provide a single source of truth for visual consistency.

No reusable component should hardcode values.

---

# Relationship to Tailwind Configuration

`tailwind.config.js` is the implementation source of truth for token values. Design Tokens do not replace it — they name it.

* `tailwind.config.js`'s existing semantic colors (`primary`, `secondary`, `accent`, `destructive`, `success`) remain the public API described in this document.
* Component code should reference these semantic names, never raw Tailwind palette values (`blue-600`, `slate-500`, `amber-600`).
* Future design token work should evolve this existing system — adding names, filling gaps, resolving inconsistencies — rather than introducing a second, parallel token system alongside it.

---

# Colors

Use semantic names.

Examples:

- background
- surface
- border
- primary
- secondary
- success
- warning
- danger
- text
- muted

Avoid:

- blue600
- slate700
- amber500

Components should not know implementation colors.

---

# Typography

Use semantic typography.

Examples:

- Display
- Heading
- Title
- Body
- Label
- Caption

Avoid hardcoded font sizes.

---

# Spacing

Use spacing tokens.

Examples:

xs

sm

md

lg

xl

2xl

Never hardcode spacing in reusable components.

---

# Radius

Corner radius should be minimal.

Prefer a very small number of radius values.

Consistency is more important than variety.

---

# Elevation

Use semantic elevation.

Examples:

none

low

medium

high

Avoid manually creating shadows.

---

# Opacity

Use semantic opacity.

Examples:

disabled

overlay

pressed

---

# Motion

Define motion tokens.

Examples:

fast

normal

slow

Use consistent durations.

---

# Icons

Define icon sizes.

Examples:

xs

sm

md

lg

xl

Avoid inline numeric values.

---

# Screen Layout

Define layout tokens.

Examples:

Screen padding

Section spacing

Card spacing

List spacing

Navigation spacing

---

# Naming

Always use semantic names.

Good:

primary

surface

text

muted

Bad:

blue500

gray200

red600

Implementation details should stay hidden.

---

# Future Direction: Component-Level Tokens

Foundation tokens (Colors, Typography, Spacing, Radius, Elevation) are the only tokens required for Phase 1.

The token system is expected to later expand into component-level tokens — values scoped to a specific component rather than the whole app. Examples:

```
button.primary.background
button.primary.text
button.primary.pressed
card.padding
card.radius
input.height
input.padding
avatar.size
navigation.header.height
```

This is **not required for Phase 1**. It is documented here as the long-term direction so that later component work (Phase 3 onward) builds toward it rather than away from it.
---

## File: `docs/architecture/COMPONENT_STANDARDS.md`

# Component Standards

This document defines the standards for every reusable component in AKSI.

The goal is consistency, predictability, and maintainability.

---

# General Principles

Every reusable component should:

- Have a single responsibility
- Be composable
- Be predictable
- Be accessible
- Be easy to discover
- Be easy to extend

Avoid creating components that solve multiple unrelated problems.

---

# Component Hierarchy

Foundation

↓

Layout

↓

UI Components

↓

Domain UI

↓

Features

A component may only depend on layers below it.

---

# Folder Structure

The multi-file structure is a recommendation for components that have grown large enough to need it — not a strict requirement for every component. Optimize for simplicity; don't enforce boilerplate on a component that doesn't need it.

Small components may remain a single file:

```
Button.tsx
index.ts
```

Larger components — once styles, types, or tests genuinely warrant separation — may evolve into:

```
Button/
    Button.tsx
    Button.types.ts
    Button.styles.ts
    Button.test.tsx
    index.ts
```

Every component should expose a single public API through index.ts, regardless of which shape it uses internally.

---

# Naming

Use nouns.

Good

Button

Card

Input

Badge

Dialog

Section

Bad

MainButton

RedButton

AwesomeCard

FancyInput

---

# Variants

Prefer variants instead of duplicate components.

Good

<Button variant="primary" />

<Button variant="secondary" />

<Button variant="outline" />

Bad

PrimaryButton

SecondaryButton

OutlineButton

---

# Sizes

Use standard sizes.

Examples

xs

sm

md

lg

xl

Avoid arbitrary values.

---

# Composition

Prefer composition over configuration.

Good

<Card>

    <Card.Header />

    <Card.Content />

    <Card.Footer />

</Card>

Avoid components with dozens of boolean props.

---

# Props

Every component should have a minimal API.

Avoid unnecessary configuration.

Prefer sensible defaults.

---

# Styling

Reusable components should use design tokens.

Avoid hardcoded:

- colors
- spacing
- radius
- typography

---

# Icons

Icons should be passed as components.

Example

<Button leftIcon={<Icon name="plus" />} />

Avoid importing icons inside every screen.

---

# Accessibility

Every interactive component should support:

- accessibilityLabel
- accessibilityRole
- accessibilityHint

---

# Refs

Interactive components should forward refs when appropriate.

Examples:

Input

Button

ScrollView wrappers

---

# Class Names

Avoid repeating Tailwind classes.

Move repeated styling into reusable components.

---

# Anti Patterns

Do not create:

PrimaryButton

DangerButton

SuccessButton

Instead

<Button variant="primary" />

<Button variant="danger" />

<Button variant="success" />

---

# Before Creating A New Component

Ask:

Can an existing component solve this?

Can an existing variant solve this?

Can composition solve this?

Only create a new component when the answer is no.
---

## File: `docs/architecture/LAYOUT_SYSTEM.md`

# Layout System

Layouts provide consistent screen structure.

Every page should feel familiar.

---

# Goals

Reduce duplicated layout code.

Improve consistency.

Improve readability.

---

# Layout Hierarchy

Page

↓

Section

↓

Container

↓

Stack

↓

Content

---

# Page

Responsible for:

- Safe Area
- Status Bar
- Background
- Keyboard
- Screen padding

Every screen should begin with a Page.

---

# ScrollPage

Adds scrolling.

Use when content may exceed screen height.

Avoid nesting multiple scroll views.

Composes Container and Stack internally for horizontal padding and
inter-child spacing — the same primitives a non-scrolling Page would
compose directly, not a separately maintained padding value.

Removed: `ModalPage`. Introduced in Phase 2 ahead of any real dialog
existing; Phase 4's `Dialog` — the one real candidate — needed a backdrop
+ centered card, not a safe-area-padded content panel, and was built
without it. Kept as a documented removal rather than silently deleting the
paragraph, so the reasoning isn't lost if a real bottom sheet or full-page
modal need ever resurfaces the question.

---

# Section

Groups related information.

Each section should have:

Optional title

Optional description

Content

Optional actions

---

# Container

Defines horizontal constraints.

Responsible for consistent page width and padding.

---

# Stack

Default layout primitive.

Responsible for vertical spacing.

Avoid manually adding margins between children.

---

# HStack

Horizontal layout.

Responsible for spacing between items.

---

# VStack

Vertical layout. A distinct primitive from `Stack`, not an alias — matches the existing implementation (`VStack`/`HStack` in `components/ui/box.tsx`).

Use `VStack` when a vertical group is being written alongside an `HStack` and the pairing improves readability; use `Stack` as the general-purpose default otherwise.

---

# Spacer

Used to create flexible layouts.

Avoid empty Views.

---

# Lists

All lists should use a shared layout.

Spacing between rows should remain consistent.

---

# Cards

Cards should never define page spacing.

Cards define internal spacing only.

The Page controls external spacing.

---

# Empty States

Every page should have a consistent empty state.

Do not create custom empty layouts.

---

# Loading States

Use shared loading components.

Avoid creating inline loading indicators.

---

# Page Checklist

Every page should provide:

- Safe Area
- Background
- Padding
- Accessibility
- Dark Mode
- Loading State
- Empty State
- Error State
---

## File: `docs/architecture/MOTION_AND_ANIMATION.md`

# Motion & Animation

Motion exists to improve usability.

Never animate for decoration.

---

# Principles

Motion should:

- Explain
- Confirm
- Guide

Motion should never distract.

---

# Inspiration

- Apple
- Linear
- Arc Browser
- Raycast

---

# Motion Types

Screen Transition

Component Transition

Feedback Animation

State Change

Gesture Animation

---

# Allowed Animations

Fade

Scale

Slide

Opacity

Shared Element (future)

---

# Avoid

Bounce

Elastic

Excessive Rotation

Long Delays

Flashing Effects

---

# Button Press

Buttons should provide subtle feedback.

Examples

Scale

Opacity

Elevation

Never combine multiple effects.

---

# Cards

Cards may scale slightly when pressed.

Avoid dramatic animations.

---

# Lists

New items may fade in.

Removed items may fade out.

Avoid complex list choreography.

---

# Modals

Use fade + slide.

Keep duration short.

---

# Bottom Sheets

Use platform-native motion.

Do not invent custom behavior.

---

# Timing

Use motion tokens.

Fast

Normal

Slow

Never hardcode animation duration.

---

# Performance

Animations must remain smooth.

Avoid blocking the JavaScript thread.

Use Reanimated for interactive animations.

---

# Accessibility

Respect reduced motion preferences when supported.

Animations should never prevent interaction.

---

# Philosophy

The best animation is the one users barely notice.
---

## File: `docs/architecture/ACCESSIBILITY.md`

# Accessibility

Accessibility is a product requirement.

Not an optional enhancement.

---

# Principles

Every user should be able to use AKSI.

Regardless of:

- Vision
- Hearing
- Motor ability
- Device

---

# Touch Targets

Interactive elements should have comfortable touch areas.

Avoid tiny buttons.

---

# Labels

Every interactive component should expose:

accessibilityLabel

accessibilityRole

accessibilityHint

Avoid unlabeled controls.

---

# Dynamic Type

Typography should scale when appropriate.

Layouts should remain usable.

---

# Contrast

Maintain readable contrast in both:

Light Mode

Dark Mode

Never rely only on color.

---

# Icons

Decorative icons should be hidden from screen readers.

Meaningful icons should have labels.

---

# Forms

Inputs should always have labels.

Validation messages should be accessible.

Errors should clearly explain:

What happened

How to fix it

---

# Focus

Keyboard and accessibility focus should follow logical order.

Avoid trapping focus.

---

# Motion

Avoid animations that may trigger discomfort.

Support reduced motion when practical.

---

# VoiceOver

Screens should be navigable using VoiceOver.

---

# TalkBack

Screens should be navigable using TalkBack.

---

# Error Messages

Errors should:

Explain the issue.

Explain the solution.

Avoid technical language.

---

# Testing

Accessibility should be verified during UI review.

Every new component should be tested before release.

---

# Final Principle

Accessibility should be built into components.

Never added later as an afterthought.
---

## File: `docs/architecture/DOMAIN_UI.md`

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
---

## File: `docs/architecture/MULTI_SPORT_ARCHITECTURE.md`

# Multi Sport Architecture

AKSI is not a tennis application.

AKSI is a community sports platform.

The architecture must support future sports without redesigning the UI.

---

# Current Sport

Tennis

---

# Future Sports

Padel

Badminton

Pickleball

Table Tennis

Other racket sports

---

# Naming

Never use sport-specific names inside generic UI.

Bad

TennisCard

TennisButton

TennisPlayer

PadelCard

Good

MatchCard

PlayerCard

SessionCard

ActivityCard

ScoreBoard

---

# Sport Engine

Sport-specific logic belongs in a dedicated engine.

Examples

sports/

    tennis/

    padel/

    badminton/

Shared UI should never know sport rules.

---

# Domain Models

Prefer generic terminology.

Good

Match

Player

Team

Court

Score

Set

Round

Session

Avoid sport-specific terminology unless required.

---

# UI

The same MatchCard should display:

Tennis

Padel

Badminton

Only the data changes.

---

# Design System

The Design System should never contain:

TennisButton

PadelCard

BadmintonInput

Keep it completely generic.

---

# Benefits

Adding a new sport should require:

New sport engine

New business logic

Minimal UI changes

---

# Long Term Vision

AKSI should become a reusable platform for community sports.

Not a collection of sport-specific applications.
---

## File: `docs/architecture/PERFORMANCE.md`

# Performance Guidelines

Performance is a feature.

Every UI decision should consider rendering cost.

---

# Goals

Fast startup

Smooth scrolling

Responsive interactions

Low memory usage

Predictable rendering

---

# Rendering

Avoid unnecessary re-renders.

Prefer memoization where appropriate.

Do not memoize everything.

---

# Lists

Use FlashList for large collections.

Avoid rendering unnecessary items.

Keep renderItem lightweight.

---

# Keys

Always use stable keys.

Never use array indexes unless the list is static.

---

# Components

Prefer small components.

Avoid deeply nested trees.

Keep render logic simple.

---

# Props

Avoid creating new object references unnecessarily.

Avoid inline functions inside frequently rendered lists.

---

# Images

Lazy load when possible.

Avoid oversized assets.

Cache images where appropriate.

---

# Icons

Use shared icon components.

Avoid unnecessary imports.

---

# Animations

Animations should run on the UI thread whenever possible.

Use Reanimated for gesture-driven interactions.

---

# State

Keep state close to where it is used.

Avoid unnecessary global state.

---

# Network

Render loading states immediately.

Avoid blocking the UI while waiting for data.

---

# Profiling

Measure before optimizing.

Never optimize based on assumptions.

---

# Philosophy

Readable code comes first.

Optimize when there is measurable benefit.
---

## File: `docs/architecture/ROADMAP.md`

# UI Architecture Roadmap

This roadmap defines the order in which the AKSI UI architecture should evolve.

Each phase should be completed, reviewed, and merged independently.

**This is the single source of truth for phase order and scope.** Migration strategy, safety rules, and execution guidance live in [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) — that document does not redefine phases.

---

# Phase 1 — Foundation

- Design Tokens
- Theme
- Colors
- Typography
- Spacing
- Radius
- Elevation

Status: Planned

---

# Phase 2 — Layout

- Page
- ScrollPage
- Stack
- HStack
- VStack
- Section
- Container

Status: Planned

Scope note: `ModalPage` was originally built here but removed after the
Phase 5 pre-Phase-6 audit. Its one real candidate consumer, Phase 4's
`Dialog`, needed a backdrop + centered card, not the safe-area-padded
content panel `ModalPage` provided — real usage showed the abstraction
didn't fit, so it was deleted rather than kept speculatively. Unlike
Avatar/Chip/Skeleton/etc. (deferred, not yet needed), this isn't in
Optional — the shape itself was wrong, not just premature.

---

# Phase 3 — Core Components

- Typography
- Icon
- Button
- Card
- Badge
- Divider
- Input

Status: Planned

Scope note: `Avatar` and `Chip` were originally listed here but have zero
current consumers anywhere in the codebase (verified during Phase 3
planning). Building them now would be a speculative abstraction, contrary
to DESIGN_PHILOSOPHY.md's "build only what is needed" principle. Moved to
Optional — see below.

---

# Phase 4 — Feedback Components

- Empty State
- Loading State
- Dialog

Status: Planned

Scope note: `Skeleton`, `Bottom Sheet`, and `Toast` were originally listed
here but have zero current consumers (every loading state today is a
spinner, not a skeleton; no bottom sheet exists anywhere; errors are shown
as inline text, not a toast). Same reasoning as Avatar/Chip in Phase 3.
Moved to Optional — see below.

---

# Phase 5 — Domain UI

- ClubCard
- PlayerCard
- MatchCard
- SessionCard

Status: Planned

Scope note: `ActivityCard` was originally listed alongside `MatchCard` as a
separate item, but in this app's domain model they're the same real thing
under two names — SessionDetailScreen's activity queue row *is* the match
card (`ActivityDetail.config` is literally a `MatchConfig`). Built once, as
`MatchCard`, per MULTI_SPORT_ARCHITECTURE.md's preference for the
sport-neutral term. `LeaderboardCard` deferred — zero current consumer, no
leaderboard/ranking screen exists anywhere in the app. Moved to Optional.

---

# Phase 6 — Screen Migration

Migrate existing screens to use:

- Layout primitives
- Core Components
- Domain UI

Remove duplicated layouts and styles.

Status: Planned

---

# Phase 7 — Polish

- Motion
- Accessibility improvements
- Performance optimization
- Visual consistency review

Status: Planned

---

# Optional — Implement When First Required

Components with no current or immediate consumer in the codebase. Do not
build ahead of need — implement only once a real screen requires one.

- **Avatar** — no screen currently displays a user photo/initials circle
  (`ClubMembersScreen` shows plain name rows).
- **Chip** — the closest existing visual (`AddMatchScreen`'s participant
  selection pills) is bespoke match-assignment logic, not a generic
  reusable chip.
- **Skeleton** — no skeleton-loading pattern exists anywhere; every loading
  state today is an `ActivityIndicator` spinner.
- **Bottom Sheet** — not used anywhere in the app.
- **Toast** — errors are shown as inline text under forms today, not a
  toast/snackbar.
- **LeaderboardCard** — no leaderboard/ranking screen exists anywhere in
  the app.

---

# Definition of Done

A phase is complete when:

- All code compiles
- UI Review Checklist passes
- Documentation updated (if required)
- No regressions introduced
- Ready for production
---

## File: `docs/architecture/MIGRATION_GUIDE.md`

# Migration Guide

This document defines the strategy, safety rules, and execution guidance for migrating from the current UI architecture to the AKSI Design System.

**Phase order and scope are defined in [ROADMAP.md](./ROADMAP.md).** This document does not redefine phases — it defines how each phase should be executed safely.

---

# Objectives

Reduce duplication.

Improve consistency.

Preserve functionality.

Avoid large refactors.

---

# Rules

Every migration should:

Compile successfully.

Be independently reviewable.

Avoid changing business logic.

Avoid redesigning screens.

---

# Behavior-Heavy Screens

Some existing screens carry real logic alongside their styling, not just presentation. These require extra care during migration.

Known behavior-heavy screens:

* `src/mobile/MobileMatchScreen.tsx` — locks screen orientation to landscape and hides the status bar during live scoring.
* `src/mobile/MobileFinalScreen.tsx` — drives text-to-speech announcement timing tied to match state changes.
* `src/mobile/SettingsModal.tsx` and `src/mobile/ScoringFlow.tsx` — the legacy web-only scoring flow, with its own self-contained navigation and state machine.

When migrating these screens:

* Migrate presentation only (`className`, style values, layout markup).
* Preserve behavior exactly — orientation locking, TTS timing, and state transitions must not change.
* Avoid logic refactoring in the same change as a styling migration. If a logic change is genuinely needed, do it as a separate, independently reviewed change.

---

# Risk-Based Screen Migration Order

Screen migration (see Screen Migration phase in [ROADMAP.md](./ROADMAP.md)) proceeds in stages, ordered from lowest to highest regression risk:

1. Simple CRUD screens
2. Dashboard
3. Club screens
4. Profile
5. Settings
6. Match Scoring
7. Legacy scoring flow

Note: as of this writing, the current codebase does not yet have Dashboard or Profile screens — the existing screens are Club (`src/mobile/clubs/`), Session (`src/mobile/sessions/`), and Activity/Match (`src/mobile/activities/`) CRUD screens. Stages 2 and 4 apply once those screens exist; in the meantime, stage 1 covers the Club and Session screens, and stages 6–7 map to the behavior-heavy screens listed above.

This ordering exists specifically to defer the behavior-heavy screens (stages 6–7) to last, so any regression surfaces against a smaller, more isolated change rather than being entangled with the bulk of the CRUD-screen migration.

---

# Dialog vs. Alert.alert

Phase 4 introduced `Dialog` (`src/design-system/feedback/Dialog.tsx`) to unify the app's confirm-dialog implementations. It is **not** a blanket replacement for every `Alert.alert` call site. Distinguish:

* **Workflow confirmations** (End Match, End Session, Leave Screen, and similar in-app decisions) — migrate to `Dialog`.
* **System-style confirmations or platform-native interactions** — `Alert.alert` may still be the right choice; a native OS dialog is sometimes the correct UX, not a gap to close.

Apply this distinction at each Phase 6 call site individually rather than converting every `Alert.alert` on sight.

---

# Migration Checklist

Before merging:

UI unchanged

Business logic unchanged

Dark mode works

Accessibility works

Performance maintained

No duplicated code introduced

---

# Completion Criteria

The migration is complete when:

All reusable UI comes from the Design System.

Legacy styling is removed.

No duplicated components remain.

The application behaves exactly as before.
---

## File: `docs/architecture/UI_REVIEW_CHECKLIST.md`

# UI Review Checklist

This checklist must be completed before any UI-related Pull Request is approved.

---

# Design System

- [ ] Existing component reused where possible
- [ ] No duplicate components introduced
- [ ] Uses Design Tokens
- [ ] No hardcoded colors
- [ ] No hardcoded spacing
- [ ] No hardcoded typography
- [ ] No hardcoded radius

---

# Layout

- [ ] Uses Page or ScrollPage
- [ ] Uses Stack/HStack/VStack
- [ ] Consistent spacing
- [ ] No unnecessary wrapper Views

---

# Components

- [ ] Minimal public API
- [ ] Correct variant usage
- [ ] Supports disabled state
- [ ] Supports loading state (if applicable)
- [ ] Uses Icon wrapper
- [ ] Uses Typography component

---

# Accessibility

- [ ] accessibilityLabel provided
- [ ] accessibilityRole correct
- [ ] Accessible touch target
- [ ] Screen reader friendly
- [ ] Color is not the only indicator

---

# States

- [ ] Loading state
- [ ] Empty state
- [ ] Error state
- [ ] Success state (if applicable)

---

# Dark Mode

- [ ] Fully supported
- [ ] No hardcoded light colors

---

# Performance

- [ ] No unnecessary re-renders
- [ ] Stable list keys
- [ ] Images optimized
- [ ] Animations are smooth

---

# Code Quality

- [ ] No duplicated Tailwind classes
- [ ] No duplicated business logic
- [ ] Component kept small
- [ ] Clear naming
- [ ] Props remain simple

---

# Final Question

If this component already existed elsewhere, would I still build it this way?

If the answer is "No", refactor before merging.
---

## File: `docs/architecture/CONTRIBUTING_UI.md`

# Contributing UI

This document defines how contributors should build UI inside AKSI.

These rules apply to both human developers and AI assistants.

---

# Before Writing Code

Always search for an existing solution.

Order:

1. Design Tokens
2. Layout components
3. UI Components
4. Domain UI
5. Existing variants

Only create something new if nothing suitable exists.

---

# Component Rules

Prefer:

Composition

Over

Configuration

Example

Good

<Card>
    <Card.Header />
    <Card.Content />
</Card>

Bad

<Card
    hasHeader
    hasDivider
    hasShadow
    hasFooter
    hasBadge
    hasImage
/>

---

# Naming

Use business-neutral names whenever possible.

Good

Card

Button

Section

Stack

Bad

BlueButton

DashboardCard

AwesomeCard

---

# Styling

Always use:

Design Tokens

Never hardcode:

- Colors
- Radius
- Font sizes
- Shadows
- Spacing

---

# Business Logic

UI components must never:

- Fetch data
- Call Firebase
- Navigate
- Manage authentication

These belong to Features.

---

# Reusability

If the same UI appears twice:

Stop.

Extract it.

---

# Reviews

Every UI Pull Request must pass the UI Review Checklist.

---

# Philosophy

Build fewer components.

Build better components.

Reuse everything possible.
---

## File: `docs/architecture/AI_INSTRUCTIONS.md`

# AI Instructions

This document defines how AI assistants should contribute to the AKSI codebase.

Read this document before making any code changes.

---

# Primary Goal

Improve the codebase without increasing complexity.

Prefer consistency over creativity.

---

# Before Making Changes

Always:

1. Read the relevant architecture documents.
2. Search for existing implementations.
3. Reuse existing components whenever possible.

Never assume a new component is required.

---

# Component Creation Rules

Before creating a new component, ask:

- Can an existing component be extended?
- Can a variant solve this?
- Can composition solve this?

If the answer is yes, do not create a new component.

---

# Design System

Never bypass the Design System.

Always use:

- Design Tokens
- Layout primitives
- Shared UI components
- Domain UI components

Avoid hardcoded values.

---

# Business Logic

Never move business logic into reusable UI.

UI components should only render data provided through props.

---

# Refactoring

Prefer small, incremental refactors.

Do not rewrite large sections of the application unless explicitly requested.

Each refactor should:

- Preserve behavior
- Reduce duplication
- Improve readability
- Compile successfully

---

# Pull Request Size

Keep changes focused.

A single PR should solve one problem.

Avoid mixing refactoring with new features.

---

# Code Style

Prioritize:

- Readability
- Simplicity
- Predictability

Avoid clever abstractions.

---

# Documentation

If a new architectural pattern is introduced:

Update the relevant documentation.

Documentation and code should evolve together.

---

# Self Review

Before completing a task, verify:

- No duplicated UI
- No hardcoded design values
- Uses existing components
- Accessibility preserved
- Dark mode supported
- Performance not degraded

If any check fails, revise the implementation before considering the task complete.
---

## File: `docs/architecture/ARCHITECTURE_REVIEW_RESPONSE.md`

# ARCHITECTURE_REVIEW_RESPONSE.md

## Overall Assessment

Thank you for the comprehensive architecture review. The findings are grounded in the current codebase and identify several real architectural issues that should be addressed before implementation.

After reviewing the report, I agree with the overall conclusion of **GO WITH CHANGES**.

However, not every recommendation should block implementation. The following decisions define the direction moving forward.

---

# Accepted Blocking Changes

These items must be completed before starting Phase 1.

## 1. Reconcile ROADMAP.md and MIGRATION_GUIDE.md

**Status:** Accepted

Currently, both documents define migration phases and they are inconsistent.

Going forward:

* `ROADMAP.md` will become the single source of truth for implementation order.
* `MIGRATION_GUIDE.md` will focus only on migration strategy, safety rules, and execution guidance.

Migration phases must exist in only one document.

---

## 2. Resolve Stack / VStack inconsistency

**Status:** Accepted

The current architecture documentation contains conflicting definitions.

We will standardize on the existing implementation already present in the project.

`Stack`, `HStack`, and `VStack` will remain separate primitives.

Documentation will be updated accordingly.

---

## 3. Align Design Tokens with existing Tailwind configuration

**Status:** Accepted

The architecture currently describes semantic design tokens without acknowledging the existing implementation.

`DESIGN_TOKENS.md` will be updated to clarify that:

* `tailwind.config.js` is the implementation source of truth.
* Semantic tokens (`primary`, `secondary`, `success`, `destructive`, etc.) remain the public API.
* Future design token work should evolve the existing system rather than replace it.

---

# Accepted Improvements

These improvements are valuable but are not blockers.

---

## Icon Guidelines

Instead of creating another standalone document, expand `DESIGN_SYSTEM.md`.

Include:

* Icon provider
* Icon wrapper component
* Semantic icon sizes
* Semantic icon colors
* Rule prohibiting direct `Ionicons` usage inside feature screens

---

## Legacy Screen Migration

Update `MIGRATION_GUIDE.md`.

Explicitly identify behavior-heavy screens (orientation lock, speech/TTS, scoring flow).

During migration:

* migrate presentation only
* preserve behavior
* avoid logic refactoring

---

## Risk-Based Migration

Screen migration will be split into multiple stages.

Recommended order:

1. Simple CRUD screens
2. Dashboard
3. Club screens
4. Profile
5. Settings
6. Match Scoring
7. Legacy scoring flow

This minimizes regression risk.

---

## Component Folder Structure

The proposed four-file structure should become a recommendation instead of a strict requirement.

Small components may remain as:

```
Button.tsx
index.ts
```

Larger components may evolve into:

```
Button/
    Button.tsx
    Button.types.ts
    Button.styles.ts
    Button.test.tsx
    index.ts
```

The architecture should optimize for simplicity rather than enforcing boilerplate.

---

# Deferred Recommendations

The following items are valuable but will not block implementation.

* Storybook strategy
* Forms guidelines
* Localization documentation
* Import-boundary enforcement tooling
* CI architecture rules

These can be introduced after the Design System foundation is complete.

---

# Additional Recommendation

One important area is still missing from the architecture.

## Component-Level Design Tokens

Current documentation defines only foundation tokens:

* Colors
* Typography
* Spacing
* Radius
* Elevation

The architecture should acknowledge that the token system will later expand into component tokens.

Examples:

```
button.primary.background

button.primary.text

button.primary.pressed

card.padding

card.radius

input.height

input.padding

avatar.size

navigation.header.height
```

This is **not required for Phase 1**, but it should be documented as the long-term direction of the Design System.

---

# Implementation Decision

After applying the three accepted blocking changes, the architecture will be considered ready.

Implementation should proceed according to the following sequence:

1. Finalize architecture documents
2. Begin Phase 1 (Design Tokens)
3. Review
4. Commit
5. Phase 2 (Layout)
6. Review
7. Commit
8. Phase 3 (Core Components)

Each phase should be completed independently, reviewed, and merged before the next phase begins.

Large-scale refactoring across multiple phases in a single pull request is discouraged.

---

# Final Decision

**GO WITH CHANGES**

The architecture is fundamentally sound.

Only the following items must be completed before implementation:

* Reconcile `ROADMAP.md` and `MIGRATION_GUIDE.md`
* Resolve the `Stack` / `VStack` inconsistency
* Align `DESIGN_TOKENS.md` with the existing Tailwind semantic token system

After these changes, proceed with **Phase 1: Design Tokens**.

---

