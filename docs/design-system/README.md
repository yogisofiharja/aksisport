# Aksi Sport

Organize the game, then play it.

Aksi is a platform for community sports in Indonesia: Communities run Sessions, organizers coordinate, players join, check in and play. Tennis first, padel and pickleball next. This system replaces the earlier slate-and-amber docs palette with one built from the logo: **Urban Heat** orange, **ink** black and a warm **ground**, with the mark's slanted cuts as the recurring shape.

## Principles

- **Heat means action.** Orange marks the one thing to do or watch on a screen: the primary button, the Live session, the active tab. If two things are heat, one of them is wrong.
- **Ink on heat.** The logo is black and orange; so is every primary control. White on heat fails contrast below 24px bold.
- **Lean forward, don't tilt everything.** The mark leans at 33° and 10°. Use those angles for accents (the Live bar, the active-tab marker, hero cuts) and italic for display headlines. Never skew body text or whole cards.
- **Flat and courtside-readable.** Borders, not shadows, separate content. Large tap targets (44–52px), tabular numbers, high contrast for phones in the sun.
- **Organizer first.** Organizer-only actions use the asphalt secondary button so they sit near, but under, the player's primary action.

## Content fundamentals

- Voice: a friendly captain, not a referee. Short, direct, encouraging. "You're in." beats "Your registration has been successfully processed."
- Sentence case everywhere: buttons, titles, tabs. Uppercase only through the `overline` style.
- Domain words are capitalized as the product docs do: Community, Session, Recurring Schedule, Organizer. Statuses use the DP-001 names: Draft, Recruiting, Ready, Full, Live (In progress), Completed, Cancelled.
- Bilingual: write for English and Bahasa Indonesia from the start; Indonesian strings run ~20–30% longer, so never fix a button width. Money is `Rp 75.000` (period thousands), dates `Sab, 18 Okt` / `Sat 18 Oct`, 24-hour time `07:00–09:00`.
- Numbers are facts: "5/8 players", "Seen by 4". No exclamation marks in system copy; one is allowed in a celebration ("Match won!").

## Visual foundations

### Colour
| Role | Token | Notes |
| --- | --- | --- |
| Brand and action | `heat` | #F9440E in both themes. Fills only; text on it is `on-heat`. |
| Brand as text | `heat-strong` | Links and selected labels on ground or surface. |
| Quiet brand | `heat-tint` | Selected rows, highlighted cards. |
| Text | `ink`, `ink-muted`, `ink-faint` | `ink-faint` is for disabled text only. |
| Surfaces | `ground`, `surface`, `surface-sunken` | Ground behind, surface for cards and sheets. |
| Broadcast | `asphalt`, `on-asphalt` | Always-dark: scoreboard, hero, secondary button. |
| Lines | `border`, `border-strong` | Hairlines vs control outlines (3:1). |
| Accent | `ball` | Optic yellow, the tennis ball. A dot or badge, never text. |
| Signals | `success`, `info`, `danger` (+ `-tint`) | Ready / Recruiting / Cancelled. Danger is darker than heat by day so they never blur. |

Two themes: **Daylight** (light) and **Floodlight** (dark). Heat stays the same orange in both; everything around it flips.

Contrast checked: ink on heat 5.2:1; heat-strong on ground 5.3:1 (light) / 6.2:1 (dark); ink-muted 6.4:1 / 6.5:1; every signal colour on its tint ≥ 4.6:1; border-strong 3.0:1 / 3.7:1.

### Type
- **Saira** (display): headlines, scores, initials. Squared, technical shapes that sit next to the "aksi" wordmark. Italic 800 for the `display` style only.
- **Plus Jakarta Sans** (text): everything else. Designed in Jakarta, wide language support, clear at small sizes.
- Both are Google Fonts, loaded by `components/bundle.css`. Scores and counts always use `font-variant-numeric: tabular-nums`.
- Scale: `display` 48, `headline` 30, `title` 20, `score` 56 · `body-lg` 17, `body` 15, `label` 14, `caption` 12, `overline` 11.

### Space, shape, depth
- 4px grid. Screen gutter and card padding `space-4`; between cards `space-3`; between sections `space-6`.
- Corners are tight, like the softened tips of the mark: `radius-sm` for controls, `radius-md` for cards, `radius-lg` for sheets. `radius-pill` is only for status pills, badges and avatars.
- Depth: flat cards with a `border`. `shadow-lg` only for things that float (sheets, menus, toasts).
- Angles: `slant-cut` (33°) for hero cuts and pattern bars; `slant-lean` (-10°) skew for small accent bars.

## Iconography

No custom set yet. Use 24px outline icons at 1.75 stroke with round caps and joins (Lucide matches this and is what the previews imitate). Icons are `ink-muted` at rest and `heat-strong` when active; never filled-on-active. Sport icons (racket, ball, court) should be drawn in the same stroke when the set is made.

## Logo

See the **Logos** asset group. The mark is the slanted "A"; the lockup stacks it over the "aksi" wordmark.
- On ground or surface: ink or heat. On asphalt or photos: white or heat.
- Clear space: the height of the wordmark's "k" on every side. Minimum size: mark 24px, lockup 64px tall.
- Don't recolour outside ink, heat and white; don't skew, outline or add shadows.
- The heat lockup is #F9440E but the heat mark file is #F45125. Re-export the mark in #F9440E so the two match.

## Components

Mobile first: every component is specified at phone size (see **Mobile first**) and mapped to the file that builds it in the app (see **Applying it in the Aksi codebase**). The previews are plain CSS classes in `components/bundle.css` (prefix `ak-`), built on the tokens, so the specs can be read without React; the app builds them in `src/design-system/` with NativeWind on Expo.

- **Actions:** Button (with IconButton and FAB), ActionBar
- **Forms:** Input (with Textarea, search, prefix), Select, Checkbox and RadioGroup, Switch
- **Navigation:** AppBar, TabBar, Tabs (with Segmented)
- **Status:** StatusPill, Chip (filter chips, tags, counts)
- **Content:** SessionCard, ListItem, Chat, Scoreboard, Avatar
- **Feedback:** Alert, Toast, Progress (with Skeleton), EmptyState
- **Overlays:** Sheet, Dialog
- **Screens:** ScreenSessionDetail, a composed example
