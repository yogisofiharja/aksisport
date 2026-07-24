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
