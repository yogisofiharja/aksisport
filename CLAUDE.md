# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run web          # Start dev server at http://localhost:8081 (web only — primary target)
npm test             # Run all tests once (Vitest)
npm run test:watch   # Run tests in watch mode
npm run build:web    # Build for production (outputs to dist/)
npm run preview:web  # Serve the production build locally
```

To run a single test file:
```bash
npx vitest run src/scoring.test.ts
```

Deployment is via Vercel (`vercel.json` sets `buildCommand: npm run build:web`, `outputDirectory: dist`).

## Mobile development

The app now targets **both web and native iOS/Android** via Expo Go. To run on device:

```bash
npx expo start --port 8082          # Start Expo dev server
npx expo start --port 8082 --reset-cache  # Use when changes don't appear on device
```

Scan the QR code with Expo Go (iOS/Android). The native path uses NativeWind v4 for styling and GlueStack UI primitives (`components/ui/`).

## Architecture

This is a React Native + Expo app (TypeScript, Expo ~54) targeting **both web and native**. Web uses `react-native-web`; native uses Expo Go. The scoring engine implements **tennis rules** (0/15/30/40/D/AD points, games, sets).

### Screen flow

`App.tsx` owns all state and drives a manual screen state machine:

```
setup → lineup → match → final
```

There is no routing library. The active screen is a `AppScreen` union type (`'setup' | 'lineup' | 'match' | 'final'`). All screen transitions, scoring logic calls, and share card generation happen in `App.tsx`.

`App.tsx` gates on `Platform.OS !== 'web'` for each screen to route native devices to the mobile-specific components in `src/mobile/`. Web always uses `src/components/`.

### Key source files

- **`src/scoring.ts`** — Pure scoring engine with no side effects. `MatchState` is immutable-style: `addPoint()` and `endMatchNow()` return new state objects. The engine handles tennis point labels (0/15/30/40/D/AD), deuce modes (`standard` or `singleDeuceSuddenDeath`), game counting, service rotation, and **set scoring** (winning 6 games increments `sets`, resets `games` to 0-0, and appends the final game scores to `completedSets`).

- **`src/persistence.ts`** — `localStorage`-backed session state. Contains backward-compat migration logic (`normalizeSetup`) that handles three historical save formats plus inline migrations for `sets`/`completedSets` fields added in later versions. The `StorageLike` interface makes it testable without a DOM.

- **`src/shareCard.ts`** — Canvas-based share card generator. `composeShareCardDataUrlWeb()` draws a 1080×1920 image with a background (default: programmatic dark court design, or a user photo), gradient overlay starting from the **vertical midpoint**, and score text. `pickImageDataUrlWeb()` appends a hidden file input to `document.body` before `.click()` — required to avoid GC on mobile Safari. Accepts optional `setBreakdown` string rendered below the main score (used when sets have been played).

- **`src/appTypes.ts`** — Shared types: `SetupForm`, `LineupResult`, `TeamASide`, `PersistedAppState`.

- **`src/components/ui.tsx`** — Shared component primitives: `Card`, `Button`, `DecorativeBackdrop`, `Input`. Uses a `palette` object for all colours (orange/blue/yellow theme).

### Mobile screens (`src/mobile/`)

All mobile screens use **inline `style` props** (not NativeWind `className`) for reliability. NativeWind is used in setup/lineup/history screens via GlueStack UI primitives (`components/ui/`).

- **`MobileMatchScreen.tsx`** — Landscape-locked (`ScreenOrientation.lockAsync(LANDSCAPE_LEFT)`). Two full-screen `TouchableOpacity` halves (blue left, red right) for point scoring. Overlay layer uses `pointerEvents="box-none"` so touches pass through to the court halves. Key layout details:
  - Score box hangs from `top: 0`, measured via `onLayout` → `scoreBoxHalfW` state used to anchor QR (left) and Suara (right) buttons symmetrically via `right: '50%', marginRight` and `left: '50%', marginLeft`.
  - Set-score row is always rendered but `opacity: 0` when no sets won — prevents the box from changing height mid-match.
  - Per-player serve indicator: only the current server's name text turns yellow (`#fde047`); non-servers stay white. Uses `matchState.currentServerPlayerId` compared against each `Player.id`.
  - Undo button: orange (`#ea580c`) at center, icon-only; grey icon when no undo available (full opacity always).
  - QR button: shows `react-native-qrcode-svg` popup with session code when `sessionCode` prop is set.
  - Tennis ball (serve court): `isAdvantage = (points.A + points.B) % 2 === 1` → bottom-outer corner for deuce, top-outer for advantage.

- **`MobileSetupScreen.tsx`** — Portrait, NativeWind + GlueStack. Landing / create / join views. Includes `SettingsModal` for TTS voice and theme.

- **`MobileLineupScreen.tsx`** — Portrait. Player pool with tap-to-assign, side-swap animation, randomised server picker.

- **`MobileHistoryScreen.tsx`** — Portrait. Match history list with share button per record.

- **`MobileFinalScreen.tsx`** — Portrait. Final score display with share card generation.

- **`SettingsModal.tsx`** — Bottom sheet. TTS language + curated voice selector (Samantha/Ava/Allison for en-US, Daniel/Arthur/Serena for en-GB). Theme: light/dark/system.

### Platform-split modules

Files with `.web.ts` suffix are bundled for web; the plain `.ts` file is used on native. Metro/Webpack resolve them automatically.

- `src/audio.ts` / `src/audio.web.ts` — applause sound via `expo-av` (native) / Web Audio API (web)
- `src/tts.ts` / `src/tts.web.ts` — score announcements via `expo-speech` (native) / `SpeechSynthesis` (web)
- `src/storage.ts` / `src/storage.web.ts` — `AsyncStorage` (native) / `localStorage` (web)
- `src/imagePicker.ts` / `src/imagePicker.web.ts` — `expo-image-picker` (native) / hidden `<input type="file">` (web)
- `src/nativeCard.ts` / `src/nativeCard.web.ts` — share card: `expo-media-library` (native) / Canvas API (web)

### UI conventions

All UI copy is in **Bahasa Indonesia**. Every screen opens with a `<Card tone="accent">` containing only `<Text>PoinYuk</Text>` as a branding banner — no content labels in that top card.

### Team A / Team B and sides

`Team` is always `'A'` or `'B'` internally. In `LineupScreen`, players assigned to the **left slot become Team A**, right slot becomes Team B. The "Tukar Tempat" button physically swaps the players between `assignedOrder` slots (the first `perTeam` entries are always KIRI/left). Static "KIRI"/"KANAN" labels live in their own row and never animate; only the player names animate during the swap. `teamASide` in persisted state is always `'left'`.

`MatchScreen` uses `teamASide` to decide which card renders on which side of the screen. The share card in `shareCard.ts` always renders Team A on the left of the image.

### Set scoring

When a team reaches 6 games, `addPoint()` pushes the current game scores to `completedSets`, increments `sets[winner]`, and resets `games` to `{A:0, B:0}`. `endMatchNow()` checks `sets` first, then `games`, then `points` to decide the winner. The share card in `App.tsx` uses `sets` to decide whether to show a set score or game score as the headline number, and passes `setBreakdown` (e.g. `"6–3  ·  4–6"`) when sets have been played.

### Player play counts

`playerPlayCounts: Record<string, number>` (keyed by player name) is incremented when a match ends and persisted. `LineupScreen` uses it to sort the player pool (lowest play count first) and display `x` badges. `serverCandidates` for the first-server picker is derived from the stable `sortedPlayers` array, not from `assignedOrder`, so swapping sides does not change the server picker order.

### Tests

Tests live alongside source: `src/scoring.test.ts` and `src/persistence.test.ts`. Vitest is configured to run in Node environment. There is no test setup file — tests import modules directly.
