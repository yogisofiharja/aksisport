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
