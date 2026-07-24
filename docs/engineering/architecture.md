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

`prd.md`'s "Technical Direction" (see
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
