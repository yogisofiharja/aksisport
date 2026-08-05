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
- **Recurring Schedule generation** (DP-007) — the app's first background
  process. An in-process `time.Ticker` goroutine in `cmd/api/main.go`
  (interval `RECURRING_SCHEDULE_GENERATION_INTERVAL_MINUTES`, default 15)
  calls `internal/scheduling.GenerateDueSessions` on every tick. Not a
  separate binary/cron/job queue — this repo has no second deployment
  target, so generation lives in the same process as the HTTP server and
  shares its lifecycle (started after the server goroutine, stopped by the
  same shutdown context). Idempotent by construction (a DB unique index
  plus catch-up-by-recomputation, see `lifecycle-recurring-schedule.md`),
  so this is safe under any interval, missed ticks included.
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
