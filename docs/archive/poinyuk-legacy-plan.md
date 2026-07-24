## PoinYuk — App Plan

A web-first tennis scoring app for small clubs, built with React Native + Expo + TypeScript targeting Expo Web. Same codebase can later be packaged for Android and iOS.

---

### Shipped ✅

#### Phase 1 — Core Setup
- [x] Expo TypeScript project running on Expo Web.
- [x] Single / Double mode selection.
- [x] Player name entry (minimum 2 for single, 4 for double).

#### Phase 2 — Match Rules & Scoring
- [x] Pure scoring engine (`src/scoring.ts`) with configurable deuce:
  - [x] Standard deuce, or
  - [x] Single deuce then sudden death.
- [x] Service indicator logic (current server tracked throughout match).
- [x] Tap-to-add-point per team card.
- [x] Undo with full state rollback across edge transitions.
- [x] End match anytime (leader wins; tied = draw).

#### Phase 3 — UI / UX Overhaul
- [x] shadcn-inspired custom component layer (`src/components/ui.tsx`) — bold orange / blue / yellow palette.
- [x] TV-style score banner with game + point columns.
- [x] Side-by-side tap cards (always row layout, no stacking) with square card layout.
- [x] Server highlighted with green dot on serving player's name (banner + tap card); no text label.
- [x] Serving team card gets blue border highlight.
- [x] Match controls refined: centered Undo and End Match pinned to bottom.

#### Phase 4 — Club Session Flow
- [x] **Setup screen** (`MatchSetup.tsx`): shared player pool, one-by-one Enter-to-add input, mode pill, deuce toggle.
- [x] **Lineup screen** (`LineupScreen.tsx`): tap players in sequence → first N go to left card, next N to right card. Animated card swap with `⇄ Tukar Tempat`. Server picker with random-spinner animation.
- [x] Player rotation helpers: play-count tracking per player, shown as compact `x` badges, and player list sorted by lowest play-count first.
- [x] **Match screen** → **Final screen** flow, screen state persisted to `localStorage`.
- [x] Backward-compat migration in `persistence.ts` handles all historical save formats.

#### Phase 5 — Final Screen & Share
- [x] Winner row highlighted (name bold, score orange); loser row muted.
- [x] "Share" button immediately generates a preview card — default background is a programmatic dark-gradient court design (no photo required).
- [x] Gallery / Camera buttons inside preview to swap background photo.
- [x] Share card simplified: matchup + final game score only (no winner/point text), black fade overlay, stronger bottom emphasis, and bottom-centered score layout.
- [x] Uploaded share background now resets each new match.
- [x] Setup action uses `Sesi Baru`; Final screen bottom action uses `Akhiri Sesi` (confirmed before clearing data). No alert after clearing.
- [x] "Match Baru" goes straight to lineup selection, preserving the player pool.

#### Phase 6 — Set Scoring, TV Scoreboard & UX Refinements
- [x] **Set scoring**: reaching 6 games increments the set counter, resets games to 0-0, and records the completed set's game scores in `completedSets`. `endMatchNow()` checks sets → games → points for winner.
- [x] **TV-style final scoreboard** (`FinalScoreScreen`): set total column (orange for winner) + vertical divider + per-set game scores. Ongoing partial set shown in yellow.
- [x] **Share card adapts**: headline score is set score when sets have been played, game score otherwise. Per-set breakdown (e.g. `6–3  ·  4–6`) rendered below the main score.
- [x] **Lineup side swap revised**: `Tukar Tempat` physically swaps players in `assignedOrder`. Static "KIRI" / "KANAN" labels in their own row never animate; only the player name row animates. Server picker order is derived from stable `sortedPlayers` (unaffected by swaps).
- [x] **Score banner** (`MatchScreen`): SET column added alongside GAME and POIN.
- [x] **Consistent branding**: all screens open with a `Card tone="accent"` showing only "PoinYuk" — no content in the hero card.
- [x] **Language**: all UI copy in Bahasa Indonesia throughout.
- [x] **UX cleanup**: undo confirmation removed; all share-flow alerts removed; mobile Safari camera GC bug fixed (file input appended to `document.body`); share card gradient starts from vertical midpoint.

---

### Deferred / Post-MVP 🔲

- [ ] **Multi-device session sharing** — implementation steps:
  - [ ] Step 1: Create Firebase project, enable Realtime Database, copy config to `.env`
  - [ ] Step 2: `npm install firebase`, create `src/firebase.ts` to initialize app and export db reference
  - [ ] Step 3: Create `src/sessionSync.ts` — `generateCode()`, `pushState(code, state)`, `subscribeToSession(code, callback)`, `unsubscribe()`
  - [ ] Step 4: Wire into `App.tsx` — push state to Firebase on every `setMatchState`; on app load detect `?code=` URL param and auto-join that session
  - [ ] Step 5: `npm install qrcode` — show QR code on match screen encoding `https://poinyuk.vercel.app/?code=XK4R2`; umpire scans → browser opens app → auto-joins. Show text code below as fallback.
  - [ ] Step 6: "Gabung Sesi" manual code input on setup screen for edge cases where camera is unavailable
- [ ] Native Android / iOS packaging and platform-specific sharing.
- [ ] Match history log across sessions.
- [ ] Club / player profiles.
- [ ] Advanced tournament formats (round-robin, elimination bracket).
- [ ] Offline-first sync / cloud backup.
