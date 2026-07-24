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

## Derived state stays client-side, by design

`DP-001` (Session Lifecycle) needed exactly this contract to resolve a
real fork: Recruiting/Ready/Full depend on "minimum participants," which
is Sport-Engine-owned per `DP-003` — client-side only, deliberately not
replicated in Go. Rather than duplicating that rule server-side (which
would mean two sources of truth for the same number), the derivation
itself lives client-side: `src/core/sessions/deriveStatus.ts` computes
Recruiting/Ready/Full from data the client already has (the session, its
participants, and `getSportModule(session.sport).rules.minParticipants`).
The server only ever stores and returns `draft`/`open`/`in_progress`/
`completed`/`cancelled` — `open` is the one value with a derived
sub-state, resolved client-side, never stored as `recruiting`/`ready`/
`full` in Postgres.

## What this deliberately does not introduce

Per "pragmatic architecture for a small team" — none of the following
are adopted unless a specific, concrete need shows up:

- A global client state library (Redux/Zustand/etc.) — see `state-management.md`.
- A server-side service/repository layer separate from `internal/db/`.
- GraphQL, tRPC, or any alternative to the current plain REST + JSON approach.
- An ORM on the Go side — raw SQL via `pgx` stays.
