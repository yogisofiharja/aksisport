# PoinYuk — Product Roadmap

Improvement milestones derived from post-MVP review. Ordered by impact.

---

## Milestone 1 — Match Formats

> The app currently has no match format concept — play stops only when the user manually taps Akhiri. Both standard and recreational formats need a configurable "when does this match end?" rule.

### 1.0 Match format config (prerequisite for all below)

Add `matchFormat` to `SetupForm` in `src/appTypes.ts`:

```ts
type MatchFormat =
  | { type: 'open' }                                          // current behaviour
  | { type: 'fixed-games'; totalGames: number; goldenGameOnTie: boolean }
  | { type: 'race-to'; raceTo: number }
  | { type: 'best-of-sets'; setsToWin: number }              // standard tennis
```

Add a "Format Pertandingan" card to `MobileSetupScreen` and `MatchSetup.tsx` with the relevant sub-options per type. `totalGames` for fixed-services should default to the player count on court (4 for doubles).

---

### Cross-cutting rule: Single Deuce + Sudden Death
All three formats below support the existing `singleDeuceSuddenDeath` toggle. It applies at the point level regardless of match format — the format only controls when the **match** ends, not how individual **games** are decided.

---

### 1.1 Fixed Services format *(recreational — non-standard)*

> "6 players, 2 hours. Each of the 4 players on court serves one game. Match stops after 4 games regardless of score."

- `matchFormat: { type: 'fixed-games', totalGames: 4, goldenGameOnTie: false/true }`
- In `addPoint()` (`src/scoring.ts`): after a game ends, check `games.A + games.B >= totalGames`
  - If `goldenGameOnTie` is **off**: set `isEnded = true` immediately, winner is whoever has more games (draw if equal)
  - If `goldenGameOnTie` is **on** and score is tied at game end: let exactly one more game play, then auto-end
- Match screen: show a game progress counter in the score box, e.g. "3 / 4", so players know how many games remain
- Winner declaration: if tied at the end with no golden game, result is a draw — handle this in `endMatchNow()` and the final screen

### 1.2 Race-to-N format *(recreational — non-standard)*

> "8 players, 4 hours. First team to win 4 games is the winner. Score can be 4-0, 4-1, 4-2, 4-3."

- `matchFormat: { type: 'race-to', raceTo: 4 }`
- In `addPoint()`: after a game ends, check `games.A >= raceTo || games.B >= raceTo`
  - If yes: `isEnded = true`, winner is the team that reached `raceTo`
- No sets, no tiebreak — game count is the entire scoreline
- Match screen: score box shows games only (same as today); no progress counter needed since the match ends naturally

### 1.3 Tiebreak at 6–6 *(standard tennis)*
- When both teams reach 6 games in a set, enter tiebreak mode
- Tiebreak scoring: plain integers (1, 2, 3…), first to 7, win by 2
- Server alternates every 2 points (first point is 1 serve)
- Tiebreak winner takes the set 7–6
- Requires new `mode: 'tiebreak'` branch in `addPoint()` inside `src/scoring.ts`
- Show tiebreak score in `MobileMatchScreen` similarly to the current game score

### 1.4 Best-of-sets format *(standard tennis)*
- `matchFormat: { type: 'best-of-sets', setsToWin: 1 | 2 | 3 }` (1 = one set, 2 = best of 3, 3 = best of 5)
- When a team reaches `setsToWin` sets, `addPoint()` marks `isEnded = true`
- Depends on 1.3 (tiebreak) to handle the 6-6 case within each set

### 1.5 Super tiebreak (match tiebreak) *(standard tennis)*
- Optional toggle: replace the deciding set with a match tiebreak (first to 10, win by 2)
- Common in doubles and casual play as a faster finish
- Reuses tiebreak logic from 1.3 with target = 10 instead of 7

---

## Milestone 2 — UX Friction Fixes

> Points of frustration that come up during actual play.

### 2.1 Game-level undo
- Current undo only works within an unfinished game (disabled when current game points are 0–0)
- Add ability to undo the last completed game: restore previous game scores, re-open the last game
- Store completed game point sequences in history so they can be replayed on undo
- Scope: one game back is enough; do not chain across sets

### 2.2 Long-press to end match
- Replace tap-to-open-confirm on Akhiri with a long-press (500–700ms)
- Eliminates accidental match termination from a stray thumb during play
- Show a brief progress ring or vibration during the hold to signal intent

### 2.3 Point log / rally history
- Slide-up panel (or separate screen) listing every point in the current match
- Format: timestamp, who won the point, resulting score
- Lets players resolve "wait, who scored that?" disputes
- Data already exists in the `history` array in `App.tsx`; UI is the only addition

---

## Milestone 3 — Social & Visibility

> Features that make the app useful beyond the two players holding the phones.

### 3.1 Spectator web page
- A read-only page at `/watch/[sessionCode]` showing the live score in real time
- Consumes the existing Firebase session; no new backend needed
- Large font, auto-rotating landscape layout, same colour scheme
- QR button in `MobileMatchScreen` should encode this URL so scanning opens the spectator page directly

### 3.2 Match duration
- Record `startedAt: number` (Date.now()) when the match begins
- Display elapsed time on the final screen and in match history cards
- Optionally show a running clock on `MobileMatchScreen` (small, unobtrusive)

### 3.3 Player statistics
- Aggregate match history into per-player W/L record, sets won, games won
- Show on a stats tab or player card in the setup/history screens
- Extend the existing `playerPlayCounts` mechanism (already persisted)

---

## Milestone 4 — Polish

> Low-effort improvements with meaningful feel.

### 4.1 Haptic feedback on scoring
- Light impact on every point tap
- Medium impact on game win
- Strong impact (notification) on set/match win
- `expo-haptics` is already a dependency (used in lineup screen); just wire it to `onAddPoint`

### 4.2 No-Ad scoring rule
- Optional toggle: skip deuce entirely — at 40–40 the next point wins the game
- Single line change in `addPoint()` in `src/scoring.ts`
- Common in timed recreational sessions

### 4.3 Warm-up / practice mode
- Start a scoring session that does not record to history
- Useful for warming up or demoing the app
- Flag in `SetupForm`, read in `App.tsx` when persisting history

---

## Status legend

| Status | Meaning |
|--------|---------|
| — | Not started |
| 🔨 | In progress |
| ✅ | Done |

### M1 status

| Sub-item | Status |
|----------|--------|
| 1.0 matchFormat config (MatchConfig + SetupForm + persistence migration) | ✅ |
| 1.1 Fixed Games (auto-end after N games + golden game option) | ✅ |
| 1.2 Race-to-N (auto-end when team reaches N wins) | ✅ |
| 1.3 Tiebreak at 6–6 | — |
| 1.4 Best-of-sets | — |
| 1.5 Super tiebreak | — |

All M2–M4 items are currently **—**.
