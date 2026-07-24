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
