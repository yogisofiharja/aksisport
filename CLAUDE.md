# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Product focus

**The web app is the primary product.** Default all feature work, bug fixes, and UI changes to `src/components/` (web screens) unless the user explicitly says "mobile". The mobile app is a future milestone pending App Store release.

## Commands

```bash
npm run web          # Start dev server at http://localhost:8081 (web — primary target)
npm test             # Run all tests once (Vitest)
npm run test:watch   # Run tests in watch mode
npm run build:web    # Build for production (outputs to dist/)
npm run preview:web  # Serve the production build locally
```

To run a single test file:
```bash
npx vitest run src/scoring.test.ts
```

Deployment is via Vercel (`vercel.json` sets `buildCommand: npm run build:web`, `outputDirectory: dist`). Deploy with `vercel --prod`.

## Mobile development

Targets iOS/Android via Expo (not Expo Go — built as a standalone dev client):

```bash
npx expo start --port 8082
npx expo start --port 8082 --reset-cache  # when changes don't appear on device
```

The native path uses NativeWind v4 for styling and GlueStack UI primitives (`components/ui/`).

## Architecture

React Native + Expo (TypeScript, Expo ~54) targeting both web and native. Web uses `react-native-web`; native uses the Expo dev client. The scoring engine implements tennis rules.

### Screen flow

`App.tsx` owns all state and drives a manual screen state machine:

```
setup → lineup → match → final
```

No routing library. Active screen is `AppScreen` union type (`'setup' | 'lineup' | 'match' | 'final'`). All transitions, scoring logic, and share card generation are in `App.tsx`.

`App.tsx` gates on `Platform.OS !== 'web'` for each screen to route native devices to `src/mobile/`. Web always uses `src/components/`.

### Key source files

- **`src/scoring.ts`** — Pure immutable scoring engine. `addPoint()` and `endMatchNow()` return new state objects. Handles point labels (0/15/30/40/D/AD), deuce modes (`standard` or `singleDeuceSuddenDeath`), service rotation, and set scoring. **Custom formats (`open`, `fixed-games`, `race-to`) accumulate games freely past 6 — no set completion. Only `best-of-sets` has set logic.**

- **`src/i18n.tsx`** — `LanguageProvider` / `useTranslation()` hook. English default + Indonesian alt, persisted via storage. All UI copy goes through `t('key')`. Language switcher lives in `SettingsModal`.

- **`src/persistence.ts`** — `localStorage`-backed session state. Contains backward-compat migration logic (`normalizeSetup`). The `StorageLike` interface makes it testable without a DOM.

- **`src/shareCard.ts`** — Canvas-based share card generator. `composeShareCardDataUrlWeb()` draws a 1080×1920 image with background (default: programmatic dark court, or user photo), gradient overlay from vertical midpoint, and score text. Accepts optional `setBreakdown` string.

- **`src/sessionSync.ts`** — Firebase Realtime Database session sync. `pushSessionState` / `subscribeToSession` / `deleteSession`. Session is created by the host; joiners subscribe and can also push (collaborative scoring). Joiners are blocked from pushing until the first host payload is received (`joinSyncedRef`) to prevent blank-state echo crashing the host.

- **`src/appTypes.ts`** — Shared types: `SetupForm`, `LineupResult`, `TeamASide`, `PersistedAppState`.

- **`src/components/ui.tsx`** — Web component primitives: `Card`, `Button`, `DecorativeBackdrop`, `Input`. Uses a `palette` object for all colours (orange/blue/yellow theme).

### Web screens (`src/components/`)

Primary product. All feature work defaults here.

- **`MatchSetup.tsx`** — Setup form: player list, match format, deuce mode, session create/join.
- **`LineupScreen.tsx`** — Player pool with tap-to-assign, side-swap animation, server picker, add-player input.
- **`MatchScreen.tsx`** — Live scoring: two tap zones, score display, undo, voice toggle, end match confirmation.
- **`FinalScoreScreen.tsx`** — Final result with share card generation.
- **`HistoryScreen.tsx`** — Match history list with per-record share. Header row: back button (white) + session code badge.
- **`WatchScreen.tsx`** — Read-only spectator view for session joiners on web.

### Mobile screens (`src/mobile/`)

All mobile screens use **inline `style` props** (not NativeWind `className`). NativeWind is used only in setup/lineup/history via GlueStack UI primitives (`components/ui/`).

- **`MobileMatchScreen.tsx`** — Landscape-locked. Two full-screen tap halves. Long-press stop button to end match (uses animation `.start()` callback — no `setTimeout` race). End-match confirmation `Modal` requires `supportedOrientations={['landscape', 'landscape-left', 'landscape-right']}` to avoid iOS orientation crash.
- **`MobileSetupScreen.tsx`** — Portrait. Landing / create / join views. Includes `SettingsModal`.
- **`MobileLineupScreen.tsx`** — Portrait. Player pool, side-swap, server picker, add-player input.
- **`MobileHistoryScreen.tsx`** — Portrait. Match history list.
- **`MobileFinalScreen.tsx`** — Portrait. Final score + share card.
- **`SettingsModal.tsx`** — Bottom sheet. TTS language + voice selector. Theme: light/dark/system.

### Platform-split modules

`.web.ts` suffix is bundled for web; plain `.ts` for native. Metro/Webpack resolve automatically.

- `src/audio.ts` / `src/audio.web.ts` — applause via `expo-audio` (native) / Web Audio API (web)
- `src/tts.ts` / `src/tts.web.ts` — announcements via `expo-speech` (native) / `SpeechSynthesis` (web)
- `src/storage.ts` / `src/storage.web.ts` — `AsyncStorage` (native) / `localStorage` (web)
- `src/imagePicker.ts` / `src/imagePicker.web.ts` — `expo-image-picker` (native) / hidden `<input type="file">` (web)
- `src/nativeCard.ts` / `src/nativeCard.web.ts` — share card: `expo-media-library` (native) / Canvas API (web)

### Session sync

Firebase Realtime Database. The host creates a session code and pushes state on every change. Joiners (web or mobile) subscribe and can also push — enabling collaborative scoring handoff. Key guards:

- `joinSyncedRef` — joiners cannot push until they receive the first host payload (prevents blank initial state from overwriting host's live match)
- `lastRemoteUpdateRef` — 400ms cooldown after receiving remote state to suppress echo pushes
- `lastPushTimeRef` — 1 second window to detect own-push echoes coming back from Firebase

### UI conventions

All UI copy goes through `t('key')` from `src/i18n.tsx`. Every web screen opens with a `<Card tone="accent">` containing only `<Text>PoinYuk</Text>` as a branding banner.

### Team A / Team B and sides

`Team` is always `'A'` or `'B'` internally. Left slot → Team A, right slot → Team B. `teamASide` in persisted state is always `'left'`. Share card always renders Team A on the left.

### Set scoring

Only `best-of-sets` format triggers set completion (at 6 games with 2-game lead, or 6-6 tiebreak). All other formats (`open`, `fixed-games`, `race-to`) let games accumulate freely past 6. `endMatchNow()` checks sets first, then games, then tiebreak points to decide the winner.

### Player play counts

`playerPlayCounts: Record<string, number>` incremented on match end, persisted. Lineup screens sort the player pool by lowest play count first and display `x` badges.

### Tests

`src/scoring.test.ts` and `src/persistence.test.ts`. Vitest, Node environment, no setup file.
