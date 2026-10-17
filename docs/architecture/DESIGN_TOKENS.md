# Design Tokens

Design Tokens provide a single source of truth for visual consistency.

No reusable component should hardcode values.

---

# Relationship to Tailwind Configuration

The token values come from the **Aksi Sport** design system (Claude Design).
`src/design-system/foundation/tokens/colors.js` is the single source of truth
for colour: every entry is a light/dark pair, and `tailwind.config.js` turns
each into two classes, the light value under its kebab-case name and the dark
value under `<name>-dark` (`bg-surface dark:bg-surface-dark`).
`foundation/colors.ts` and `foundation/theme.ts` expose the same values to JS
(`theme[mode].heat`).

Light or dark is the person's choice in Settings (Follow device, the
default; Light; Dark), applied by `src/theme.tsx`. Tailwind uses
`darkMode: 'class'`: on web the provider sets the `dark` class on `<html>`,
resolving Follow device from the browser and tracking it as it changes.

* Component code should reference these semantic names, never raw Tailwind palette values (`blue-600`, `slate-500`).
* Transitional (until each component is restyled): Tailwind keeps a `primary`
  scale mapped onto the heat colours, and `theme.ts` keeps the old
  `text`, `brand`, `background` and `destructive` keys mapped onto the new names.

---

# Colors

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `heat` | #F9440E | #F9440E | Brand: primary actions, live state |
| `heat-strong` | #C2330A | #FF6A3D | Heat text and icons on light surfaces, active tab |
| `heat-tint` | #FFE9E0 | #3A1A0E | Heat backgrounds |
| `on-heat` | #131315 | #131315 | Text on heat (ink, not white) |
| `ink` / `ink-muted` / `ink-faint` | #131315 / #5F5A55 / #9A948E | #F4F2EF / #A19C96 / #6B6660 | Text |
| `ground` | #FAF8F6 | #0E0E10 | Screen background |
| `surface` / `surface-sunken` | #FFFFFF / #F2EFEC | #18181B / #222226 | Cards / wells |
| `asphalt` / `on-asphalt` / `heat-on-asphalt` | #131315 / #F4F2EF / #FF6A3D | #26262B / #F4F2EF / #FF6A3D | Dark panels (scoreboard, toast) |
| `border` / `border-strong` | #E4DFDA / #9A948E | #2E2E33 / #77716B | Dividers / input outlines |
| `ball` | #DCF23A | #DCF23A | The serving ball |
| `success`, `info`, `danger` (+ `-tint`) | | | Status |

There is no `warning` colour.

---

# Typography

Saira for display text, Plus Jakarta Sans for everything else. The files are
in `assets/fonts/` (SIL OFL) and load in `App.tsx`. React Native picks a font
file by family name, so each weight is its own family: `font-sans`,
`font-sans-medium`, `font-sans-semibold`, `font-sans-bold`, `font-display`
(Saira Bold) and `font-display-hero` (Saira ExtraBold Italic).

| Role | Size / line height | Face |
| --- | --- | --- |
| Display | 48/48 | Saira ExtraBold Italic |
| Heading | 30/34 | Saira Bold |
| Title | 20/26 | Saira Bold |
| Body | 15/22 | Plus Jakarta Sans Regular |
| Label | 14/20 | Plus Jakarta Sans SemiBold |
| Caption | 12/16 | Plus Jakarta Sans Medium |
| Overline | 11/16, 0.9px tracking, uppercase | Plus Jakarta Sans Bold |

The heaviest weight is 800, used only for the Display line. Avoid hardcoded font sizes.

---

# Spacing

Use spacing tokens.

Examples:

xs

sm

md

lg

xl

2xl

Never hardcode spacing in reusable components.

---

# Radius

| Token | Value | Tailwind | Use |
| --- | --- | --- | --- |
| xs | 4 | `rounded` | Score cells, checkbox |
| sm | 8 | `rounded-lg` | Buttons, inputs, chips |
| md | 12 | `rounded-xl` | Cards |
| lg | 20 | `rounded-[20px]` | Sheets, dialogs |
| full | 9999 | `rounded-full` | Pills, avatars |

---

# Elevation

Use semantic elevation.

Examples:

none

low

medium

high

Avoid manually creating shadows.

---

# Opacity

Use semantic opacity.

Examples:

disabled

overlay

pressed

---

# Motion

Define motion tokens.

Examples:

fast

normal

slow

Use consistent durations.

---

# Icons

Define icon sizes.

Examples:

xs

sm

md

lg

xl

Avoid inline numeric values.

---

# Screen Layout

Define layout tokens.

Examples:

Screen padding

Section spacing

Card spacing

List spacing

Navigation spacing

---

# Naming

Always use semantic names.

Good:

primary

surface

text

muted

Bad:

blue500

gray200

red600

Implementation details should stay hidden.

---

# Future Direction: Component-Level Tokens

Foundation tokens (Colors, Typography, Spacing, Radius, Elevation) are the only tokens required for Phase 1.

The token system is expected to later expand into component-level tokens — values scoped to a specific component rather than the whole app. Examples:

```
button.primary.background
button.primary.text
button.primary.pressed
card.padding
card.radius
input.height
input.padding
avatar.size
navigation.header.height
```

This is **not required for Phase 1**. It is documented here as the long-term direction so that later component work (Phase 3 onward) builds toward it rather than away from it.