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

## Sport modules — contract

`src/sports/types.ts` exists (`SportModule`/`SportRules`), introduced for
`docs/AKSI_PRODUCT_DECISIONS.md`'s DP-003 (minimum participants owned by
the Sport Engine, not hardcoded in a screen). Deliberately smaller than
originally sketched here — only `rules.minParticipants(mode): number`
today. `scoringEngine`/`formatter` are **not** part of the shared contract
yet; `src/sports/tennis/scoringEngine.ts` stays a standalone module with
its own concrete types, consumed directly by the screens that need it
(`AddMatchScreen`, `ActivityMatchScreen`). Add fields to the shared
contract only when a second sport actually needs the same shape — per
`docs/AKSI_PRODUCT_DECISIONS.md`'s explicit note that Basketball/Running
in DP-003's examples are architectural illustrations, not a near-term
implementation target; Tennis remains the only implemented sport.

```ts
// src/sports/types.ts — current, not aspirational
export interface SportRules {
  minParticipants(mode: string): number;
}

export interface SportModule {
  id: string;
  rules: SportRules;
}
```

`src/sports/tennis/rules.ts` implements it (`minParticipants('single') →
2`, `minParticipants('double') → 4`), and `src/sports/tennis/index.ts`
exports `tennisSportModule: SportModule`. `AddMatchScreen` now calls
`minParticipants(mode)` directly from `rules.ts` rather than the
`SportModule` wrapper — the app only ever runs Tennis today, so there's no
dynamic sport dispatch yet to justify going through the abstraction at the
call site.

Core code depending only on this contract plus the opaque `config`/`result`
JSON columns (never `sports/tennis`'s concrete types directly) is still the
target for everything beyond `rules.minParticipants` — unchanged from
before, just no longer entirely aspirational.

`src/sports/registry.ts` adds a small `sportId -> SportModule` lookup, so
session-level code (see below) doesn't import a specific sport by name.
Tennis is still the only registered entry.

## Derived state is resolved server-side (DP-ARCH-003)

`DP-001` (Session Lifecycle) is explicit: "the backend should expose the
resolved lifecycle state." An earlier version of this document described
keeping Recruiting/Ready/Full client-side instead, to avoid duplicating
the Sport-Engine's `minParticipants` rule in Go — that was a deviation
from `DP-001`/`DP-ARCH-003`, not a sanctioned exception, and has been
corrected (Milestone 2 — Session Experience).

The server now resolves `LifecycleStatus` (Go) / `lifecycleStatus`
(JSON) on every Session response — `internal/db/sessions.go`'s
`resolveLifecycleStatus`, called wherever a `Session` is returned
(`CreateSession`/`GetSession`/`ListSessionsForClub`/`UpdateSession`).
`draft`/`in_progress`/`completed`/`cancelled` pass through unchanged;
`open` resolves to `recruiting`/`ready`/`full` from `JoinedCount`/
`MaxParticipants` plus a minimum-participants threshold. **Still never
persisted** — computed fresh on every request, exactly as `DP-001`
requires ("derived values should not be persisted unless explicitly
required").

That minimum-participants threshold comes from a new
`internal/sports` package (`MinParticipantsToStart`) — a small,
Tennis-only mirror of `src/sports/tennis/rules.ts`'s
`minParticipants('single')`. This is a Session asking the Sport Module
for sport-specific knowledge, not an ownership transfer — `DP-ARCH-002`
already explicitly allows this ("A Session may ask the Sport Module for
sport-specific knowledge"). The mirror is a deliberately small stand-in,
not a real registry — evolve `internal/sports` toward mirroring
`src/sports/registry.ts`'s `sportId -> SportModule` shape once a second
sport needs its own rules exposed the same way; nothing here blocks
that.

The client no longer derives this itself — the former
`src/core/sessions/deriveStatus.ts` (dead code with zero production
call sites even before this) is deleted. `Session.lifecycleStatus`
(`src/core/api/types.ts`) is consumed directly.

## What this deliberately does not introduce

Per "pragmatic architecture for a small team" — none of the following
are adopted unless a specific, concrete need shows up:

- A global client state library (Redux/Zustand/etc.) — see `state-management.md`.
- A server-side service/repository layer separate from `internal/db/`.
- GraphQL, tRPC, or any alternative to the current plain REST + JSON approach.
- An ORM on the Go side — raw SQL via `pgx` stays.
