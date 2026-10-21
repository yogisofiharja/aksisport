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
- **No mocked Postgres or testcontainers.** Pure logic is tested without
  a database. Tests that need one run in a **throwaway schema** inside the
  dev database (`server/internal/testdb`): each package's test binary
  creates `aksi_test_<random>`, applies every migration there (its
  connections' `search_path` is that schema, then `public` for the
  pgcrypto/citext extensions), runs its tests and drops the schema with
  `CASCADE`. The tests never see or change the dev tables, and no extra
  database is created. Packages with database tests opt in with
  `func TestMain(m *testing.M) { os.Exit(testdb.Main(m)) }` and get their
  pool from `testdb.Pool(t)`. Without `TEST_DATABASE_URL` those tests are
  skipped; the rest still run.
- **No snapshot testing** — not a good fit for a UI this actively
  changing; prefer behavioral tests where tests are added at all.

## Running tests

```bash
npx vitest run <file>      # single client test file
npm test                    # all client tests

cd server && make test      # Go tests; database tests skip
cd server && make test-db   # Go tests, database tests included
cd server && make vet       # go vet
```

`make test-db` sets `TEST_DATABASE_URL` from `server/.env`'s
`DATABASE_URL`; the role only needs to be allowed to create schemas in
that database (the app's own role is). A run that is killed before it
finishes can leave an `aksi_test_…` schema behind; drop it by hand.
