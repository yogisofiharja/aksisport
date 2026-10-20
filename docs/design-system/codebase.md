# Applying it in the Aksi codebase

Where every part of this system lands in the app's own code (`yogisofiharja/aksisport`, branch `dev`). The app keeps its in-house design system in `src/design-system/`; nothing here adds a component library.

## What the app is built with

| Layer | In the code |
| --- | --- |
| Framework | Expo SDK 54, React Native 0.81, react-native-web for the web build |
| Navigation | React Navigation: `src/navigation/PersonalTabs.tsx` (bottom tabs), `MainStack.tsx`, `AuthStack.tsx` |
| Styling | NativeWind 4 on Tailwind CSS 3. Light/dark through `dark:` classes, switched by `src/theme.tsx` |
| Tokens | `src/design-system/foundation/` (colors, typography, spacing, radius, elevation, theme) |
| Components | `src/design-system/ui`, `feedback`, `layout`, `domain-ui`, plus older primitives in `components/ui/` |
| Already installed and useful | `react-native-svg` (illustrations), `expo-font` (fonts), `expo-haptics`, `react-native-safe-area-context` |

## Step 1 — Tokens (the whole app changes look)

### Colours: `foundation/tokens/colors.js`
Today this is the blue `primary` scale, shared by `tailwind.config.js` and `colors.ts`. Replace it with the Aksi palette, each colour as a light/dark pair:

```js
module.exports = {
  heat:          { light: '#f9440e', dark: '#f9440e' },
  heatStrong:    { light: '#c2330a', dark: '#ff6a3d' },
  heatTint:      { light: '#ffe9e0', dark: '#3a1a0e' },
  onHeat:        { light: '#131315', dark: '#131315' },
  ink:           { light: '#131315', dark: '#f4f2ef' },
  inkMuted:      { light: '#5f5a55', dark: '#a19c96' },
  inkFaint:      { light: '#9a948e', dark: '#6b6660' },
  ground:        { light: '#faf8f6', dark: '#0e0e10' },
  surface:       { light: '#ffffff', dark: '#18181b' },
  surfaceSunken: { light: '#f2efec', dark: '#222226' },
  asphalt:       { light: '#131315', dark: '#26262b' },
  onAsphalt:     { light: '#f4f2ef', dark: '#f4f2ef' },
  heatOnAsphalt: { light: '#ff6a3d', dark: '#ff6a3d' },
  border:        { light: '#e4dfda', dark: '#2e2e33' },
  borderStrong:  { light: '#9a948e', dark: '#77716b' },
  ball:          { light: '#dcf23a', dark: '#dcf23a' },
  success:       { light: '#0e7c4a', dark: '#34d399' },
  successTint:   { light: '#e3f3ea', dark: '#0f2a1e' },
  info:          { light: '#1d4ed8', dark: '#93c5fd' },
  infoTint:      { light: '#e6eefd', dark: '#14213d' },
  danger:        { light: '#b42318', dark: '#f87171' },
  dangerTint:    { light: '#fde8e6', dark: '#3a1414' },
};
```

### Tailwind names: `tailwind.config.js`
Generate the class names from that same file so values live in one place. Each pair becomes a colour and its `-dark` twin, matching how the app already writes `bg-slate-50 dark:bg-slate-900`:

```js
const aksi = require('./src/design-system/foundation/tokens/colors');
const kebab = (s) => s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
const colors = {};
for (const [name, v] of Object.entries(aksi)) {
  colors[kebab(name)] = v.light;
  colors[kebab(name) + '-dark'] = v.dark;
}
// theme.extend.colors = colors;   → bg-ground dark:bg-ground-dark, text-ink dark:text-ink-dark …
```

Remove the unused `background`, `foreground`, `muted`, `accent`, `secondary` entries (`colors.ts` notes they have no live consumers).

### Semantic layer: `foundation/colors.ts` and `theme.ts`
Keep the file's job (light/dark pairs for JS-side use, such as icon colours and `ActivityIndicator`), with the new names: `color.heat`, `color.ground`, `color.surface`, `color.ink`, `color.inkMuted`, `color.border`… `theme.ts` keeps resolving them per mode; update its `resolve()` keys to match.

### Radius: `foundation/radius.ts`
One 16px radius today. New scale: `xs` 4 (score cells, checkbox), `sm` 8 (buttons, inputs, chips), `md` 12 (cards), `lg` 20 (sheets, dialogs), `full` (pills, avatars). In Tailwind: `rounded` / `rounded-lg` / `rounded-xl` / `rounded-[20px]` / `rounded-full`, or add named radii to the config.

### Spacing: `foundation/spacing.ts`
No change. The app's 4px scale (xs 4 … 4xl 48) is the same grid as `space-1` … `space-12` here.

### Type: `foundation/typography.ts` and fonts
- Put the font files in `assets/fonts/` (Saira Bold, Saira ExtraBold Italic; Plus Jakarta Sans Regular, Medium, SemiBold, Bold) and load them in `App.tsx` with `useFonts` from the already-installed `expo-font`; hold the splash until they load.
- React Native picks a font **file** by family name, so add one Tailwind family per weight: `font-sans` (Regular), `font-sans-medium`, `font-sans-semibold`, `font-sans-bold`, `font-display` (Saira Bold), `font-display-hero` (Saira ExtraBold Italic).
- Map `typeRole`: `display` 48/48 hero, `heading` 30/34 display, `title` 20/26 display, `body` 15/22 regular, `label` 14/20 semibold, `caption` 12/16 medium; add `overline` 11/16 bold with `tracking-[0.9px]` and `uppercase`.
- The current roles use weight 900 (`font-black`) everywhere; the new system tops out at 800 and uses it only for the hero line.

## Step 2 — Existing components

| File | Spec here | Changes |
| --- | --- | --- |
| `ui/Button.tsx` | Button | `solid primary` → `bg-heat`, label `text-on-heat` (ink, not white); `solid secondary` → `bg-asphalt`; `outline` → `border border-border-strong`, ink label; `ghost` → `text-heat-strong`; `negative` → danger. Heights 32 / 44 / 52; `rounded-2xl` → `rounded-lg`; label weight `font-black` → `font-sans-semibold`. Update `spinnerColor` to the same tokens. |
| `ui/Badge.tsx` | StatusPill, Chip | Keep `success`, `info`, `error` (→ danger), `muted`; add the lifecycle actions `draft`, `recruiting`, `ready`, `full`, `live`, `completed`, `cancelled`, with the dot. `warning` has no place in the new palette; map its uses to `info` or `heat-tint`. |
| `ui/Input.tsx` | Input | 48px, `border-border-strong`, `rounded-lg`, 16px text, error state in danger with the hint below. |
| `ui/Card.tsx` | SessionCard (card shell) | `bg-surface`, `border border-border`, `rounded-xl` (12), no shadow. |
| `ui/Typography.tsx` | Visual foundations › Type | Variants follow the new `typeRole`; headings use the display face. |
| `ui/Icon.tsx` | Iconography | 24px outline at 1.75 stroke; `ink-muted` at rest, `heat-strong` when active. |
| `feedback/EmptyState.tsx` | EmptyState, Illustration | Keep today's plain-text default; add an `illustration` prop that switches on the centred layout with the display-face title. |
| `feedback/Dialog.tsx` | Dialog | Destructive confirms only; safe button left (outline), danger right. |
| `feedback/appAlert.tsx` | Toast | Restyle the host as the asphalt toast at the bottom; one optional action in `heat-on-asphalt`. |
| `domain-ui/SessionCard.tsx` | SessionCard (redesign canvas › Cards) | Eyebrow date · time with a repeat icon for generated Sessions, caps StatusPill, Saira title, "Sport · Activity · location", footer price + capacity (ink bar, "N players" without a limit). Live: heat border, players + Open matches. Draft dashed; completed/cancelled sunken without footer. State comes from `statusAction`. |
| `domain-ui/ClubCard.tsx` | ClubCard | `variant="tile"` (Home, 150px: role · city) and `"row"` (Explore: city · members · private, trailing Joined / Requested / chevron). 44px radius-12 avatar, initials on heat-tint. |
| `domain-ui/RecurringScheduleCard.tsx` | RecurringScheduleCard | 44px repeat icon on sunken, title, "Every Sat · 07:00–09:00", Active / Paused pill; paused mutes title and icon. |
| `domain-ui/PlayerCard.tsx` | PlayerCard | 40px round avatar with the online dot (DP-014) in `success`, dashed for guests; trailing slot composed by the screen (Owner tag = `Chip strong`, Admin tag, Paid / Awaiting, ⋯ `IconButton`, Approve). |
| `domain-ui/MatchCard.tsx` | MatchCard | Queued row with queue number; `isMine` heat border; live asphalt scoreboard (ball serve dot, games box, heat points box for the side ahead); finished row with winner in 700 and Share (DP-026). |
| `domain-ui/legacy/` | — | Pre-redesign SessionCard and RecurringScheduleCard, still used by screens until the redesigned cards are swapped in. |
| `navigation/PersonalTabs.tsx` | TabBar | Custom `tabBar`: heat bar over the active tab, heat count badges. |
| `layout/AppBar.tsx` | AppBar (redesign canvas › App bar) | `root` (date line + Saira italic 34), `stack` (back, 17/700 title + context line, ≤2 icons, ⋯ via `onMore`, optional `largeTitle`), `form` (✕ Close). `tone="dark"` for live scoring. Built and in the Gallery; screens adopt it with the page redesigns. |
| `ui/IconButton.tsx` | IconButton | 44×44, required label, `onDark`. |
| `feedback/Sheet.tsx` | Sheet | Grab handle, title left, "Close" as text right (never "Cancel"); no bottom dismiss button. |

## Step 3 — New pieces

- **Illustrations** — one component per illustration with `react-native-svg` (already installed), filled from `color.*` so one component covers both themes. Files and shapes: the Illustrations asset group.
- **Sheet** — a bottom sheet built on React Native's `Modal`, the way `locations/CityPickerModal.tsx` already works, so no new dependency. If drag-to-dismiss is wanted later, `@gorhom/bottom-sheet` is the usual choice.
- **ActionBar**, **Chip**, **Tabs** (segmented), **Chat** bubbles for `src/mobile/messages`, **Progress**.

## Rules for the code

- No raw Tailwind palette colours (`slate-*`, `blue-*`, `amber-*`) in new code; use the Aksi names, always with their `-dark` twin.
- No hex values in components; JS-side colours come from `foundation/colors.ts`.
- Primary buttons have ink labels. White on heat fails contrast below 24px bold.
