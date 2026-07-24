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
