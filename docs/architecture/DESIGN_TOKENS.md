# Design Tokens

Design Tokens provide a single source of truth for visual consistency.

No reusable component should hardcode values.

---

# Relationship to Tailwind Configuration

`tailwind.config.js` is the implementation source of truth for token values. Design Tokens do not replace it — they name it.

* `tailwind.config.js`'s existing semantic colors (`primary`, `secondary`, `accent`, `destructive`, `success`) remain the public API described in this document.
* Component code should reference these semantic names, never raw Tailwind palette values (`blue-600`, `slate-500`, `amber-600`).
* Future design token work should evolve this existing system — adding names, filling gaps, resolving inconsistencies — rather than introducing a second, parallel token system alongside it.

---

# Colors

Use semantic names.

Examples:

- background
- surface
- border
- primary
- secondary
- success
- warning
- danger
- text
- muted

Avoid:

- blue600
- slate700
- amber500

Components should not know implementation colors.

---

# Typography

Use semantic typography.

Examples:

- Display
- Heading
- Title
- Body
- Label
- Caption

Avoid hardcoded font sizes.

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

Corner radius should be minimal.

Prefer a very small number of radius values.

Consistency is more important than variety.

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