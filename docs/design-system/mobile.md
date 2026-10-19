# Mobile first

Aksi is a phone app that ships first on the web, then on iOS and Android. Design every screen at 390px wide; the web build should feel like the native app, not like a website.

## The frame

- Design at **390 × 844** (iPhone 14/15); check at **360** (small Android) and **430** (Pro Max). Nothing scrolls sideways except chip rows and tabs, which scroll on purpose.
- On the web, the app column is **max 480px**, centered, on `ground`. Desktop visitors see the phone layout in the middle, not a stretched one. A wider desktop layout is a later decision.
- One Expo codebase: the same screens run on web (Expo web), iOS and Android. Platform-only tweaks use NativeWind's `web:`, `ios:` and `android:` prefixes, never forked screens.
- Safe areas: pad the app bar, tab bar, action bar and sheets with `useSafeAreaInsets()` (react-native-safe-area-context); on web the same insets come from the browser.

## Navigation

- **Root screens** (Home, Explore, Inbox, Me): large-title AppBar, bottom TabBar.
- **Detail screens** (Session, Community, profile, chat): detail AppBar with back; the TabBar hides and an ActionBar takes the bottom when there is a primary action.
- **Back** works with the browser back button and Android's back gesture: every screen and every open sheet is a URL or history entry.
- **Overlays**: Sheet by default; Dialog only for destructive confirms. No hover menus, no tooltips that carry information.

## Touch

- Targets at least **44×44px**, with 8px between neighbours. Small visuals (a 22px checkbox) get a full-row hit area.
- Feedback on press (`active:` classes on `Pressable`), never hover-only. Long-press opens an action Sheet (messages, list rows).
- The primary action lives in the bottom third, where thumbs reach: ActionBar, Sheet buttons, FAB.
- Inputs are 16px so iOS Safari doesn't zoom on the web build; set `keyboardType` and `autoComplete`.

## Motion

- Controls 150ms, sheets and screens 250ms, `cubic-bezier(.2,.8,.2,1)` (fast out, soft landing). Sheets slide up; screens push from the right.
- When reduce motion is on (`AccessibilityInfo.isReduceMotionEnabled()`, which also follows `prefers-reduced-motion` on web), cross-fade instead of slide and stop pulses and shimmers.

## Web app now, store apps later

- Add a web app manifest so people can "Add to Home Screen" (it is also what enables push on iPhone, DP-018 step 3): `name` "Aksi", `display` "standalone", `background_color` #faf8f6, `theme_color` #faf8f6 (dark: #0e0e10), icons from the **heat mark** on ground at 192 and 512px plus a maskable version.
- Status bar: `apple-mobile-web-app-status-bar-style` "default"; `<meta name="theme-color">` per colour scheme.
- Keep everything in tokens. Native builds take the same values (NativeWind variables or a generated `tokens.ts`), so the store apps look the same without a redesign.
- Native-only extras later: haptic tick on check-in and match result, the native share sheet, and system date pickers.
