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
