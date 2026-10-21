# Match Lifecycle (Current)

This is the client-side state machine in
`src/sports/tennis/scoringEngine.ts` — pure functions, no I/O. It runs
identically on web and mobile, inside a Phase-3 Activity
(`ActivityMatchScreen`).
It is **not** the same thing as `activities.status` in
`lifecycle-activity.md` — a single `live` Activity's entire match plays
out client-side inside this state machine before `complete` is ever
called.

## State shape (`MatchState`)

```
config          MatchConfig (mode, deuceMode, players[], matchFormat, serviceOrderPlayerIds?)
points          { A, B }
games           { A, B }
sets            { A, B }
completedSets   Array<{ A, B }>
deuceCount      number
currentServerPlayerId
tiebreak        { target, pointsPlayed } | null
isEnded         boolean
winner          'A' | 'B' | null
endReason       'manual' | 'auto' | 'none'
```

## Entry — `createInitialState(config)`

Server (first entry in `serviceOrderPlayerIds`, or `players[0]` if
unset) starts as `currentServerPlayerId`. All counters zero, `tiebreak:
null`, `isEnded: false`.

## Per-point — `addPoint(state, team)`

No-op if `isEnded`. Two modes:

**Tiebreak mode** (`state.tiebreak` set): increments the scoring
team's point count; server rotates after the 1st point then every 2
points (`newPointsPlayed % 2 === 1`). Ends when a side reaches
`tiebreak.target` with a lead of ≥2 — awards the game, resets points,
appends to `completedSets`, increments `sets`, clears `tiebreak`. If
the format is `best-of-sets` and the winner has now reached
`setsToWin`, `isEnded = true, endReason = 'auto'`. If instead both
sides are one set from `setsToWin` and `superTiebreak` is enabled, a
new tiebreak starts immediately (`target: 10`) instead of a normal
game.

**Normal mode**: standard point increment, with deuce/advantage logic:
- `standard` deuce: unlimited deuce/advantage, win by 2, `points >= 4`.
- `singleDeuceSuddenDeath`: after `deuceCount >= 2`, the next point
  scored by either side wins the game outright (no advantage step).

On a game win, points reset, server rotates, `deuceCount` resets, and
one of four format branches runs:
- `open` — no auto-end, only manual.
- `race-to` — ends when a side's `games` reaches `raceTo`.
- `fixed-games` — ends when `games.A + games.B >= totalGames`, unless
  tied and `goldenGameOnTie` is set and the total hasn't been exceeded
  yet (plays one more game).
- `best-of-sets` — at 6–6 games, starts a tiebreak (`target: 7`)
  instead of continuing normal games. Otherwise a set is won at ≥6
  games with a 2-game lead; same `setsToWin`/`superTiebreak` checks as
  the tiebreak-mode set-win path above.

## Manual end — `endMatchNow(state)`

No-op if already `isEnded`. Sets `isEnded = true, endReason =
'manual'`, and decides a winner by: more sets → more games → (if a
tiebreak is in progress) more tiebreak points → otherwise `null`
(no winner, e.g. ending at 0–0).

Called by the app only from **Finish match** in a Free Play match's
Match options (DP-025): its result has the side ahead as winner, or no
winner (a draw). The press-and-hold End that used to call it on any
match was removed; other formats end on their final point, or are ended
early as Unfinished (`POST /end-early`).

## Undo

Not part of the engine itself — the caller (`ActivityMatchScreen`) keeps a `history: MatchState[]` array, push a
deep clone (`JSON.parse(JSON.stringify(...))`) before every
`addPoint` call, and undo by popping the last entry back
into current state. The engine has no built-in undo/redo.

## Persistence during a live match

Nothing here writes to Postgres. `ActivityMatchScreen` pushes the
entire `MatchState` (plus `history`, `activityId`, `scorerUid`) to
Firebase RTDB on every state change (`pushSessionState`), for
spectators/QR viewers only. The Activity row in Postgres is untouched
between `start` and `complete`.

## UX rules this screen follows

Relocated from the now-retired `docs/product/interaction.md` (its other
two rules, "One primary action per screen" and "Progressive
disclosure," are already restated in `AKSI_UX_PRINCIPLES.md`):

- **Preserve momentum** — scoring a point should never require
  confirmation or a secondary step.
- **Never interrupt live play** — no modal, navigation, or blocking UI
  may appear while a match is in progress except when the scorer
  explicitly requests it (e.g. undo, manual end).
