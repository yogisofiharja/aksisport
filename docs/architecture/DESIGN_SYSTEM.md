# AKSI Design System

The Design System provides the foundation for every screen.

It should remain independent from business logic.

---

# Hierarchy

Foundation

↓

Primitives

↓

UI Components

↓

Domain UI

↓

Pages

↓

Features

---

# Foundation

Contains design tokens.

Examples:

- Colors
- Typography
- Spacing
- Radius
- Shadows
- Motion

Foundation contains no React components.

---

# Primitives

Very small building blocks.

Examples:

- Stack
- HStack
- VStack
- Spacer
- Container

Primitives never know about business logic.

---

# UI Components

Reusable controls.

Examples:

- Button
- Card
- Badge
- Input
- Icon
- Modal

These should work in every application.

They follow the Aksi Sport design system (`DESIGN_TOKENS.md`). Heat orange
marks the one main action on a screen, so:

- **Button:** `solid primary` is the main action (heat fill, ink label,
  never white); `solid secondary` a strong second action, often
  organizer-only (asphalt); `outline` neutral actions; `ghost` low-weight
  links (heat-strong); `negative` destructive. Heights 32 / 44 / 52.
  `ButtonText` takes its colour and size from its Button.
- **Selected chips and tabs:** ink fill with surface text. **Checkboxes:**
  heat fill with an ink tick. **Count badges:** heat with ink numerals.
- **Card:** surface, hairline border, 12px corners, no shadow.
- **Links and active icons:** heat-strong, never plain heat (too light on
  ground and surface).

---

# Domain UI

Reusable business UI.

Examples:

- ClubCard
- SessionCard
- PlayerCard
- MatchCard
- LeaderboardCard

These understand AKSI concepts.

---

# Pages

Page layouts.

Examples:

- Page
- ScrollPage

(`ModalPage` was introduced in Phase 2 and removed after Phase 4 — see
LAYOUT_SYSTEM.md and ROADMAP.md's Phase 2 scope note.)

Responsible for:

- Safe Area
- Status Bar
- Keyboard
- Background
- Header

---

# Features

Business logic.

Examples:

- Authentication
- Club
- Session
- Match
- Profile

Features consume Domain UI.

They never build reusable UI themselves.

---

# Dependency Rules

Foundation

↓

Primitives

↓

UI Components

↓

Domain UI

↓

Pages

↓

Features

Dependencies must only point downward.

Never the opposite.

---

# Design System Rules

Design System must never:

- Call APIs
- Know Firebase
- Know navigation
- Know business logic
- Know sports

It only renders UI.

---

# Icons

All icons go through a single `Icon` wrapper component. Feature screens must never import an icon library directly.

* **Provider**: `@expo/vector-icons/Ionicons` — already a project dependency, and the icon set used throughout the existing app. `Icon` wraps it; it does not replace it.
* **API**: `<Icon name="calendar" size="md" color="primary" />` — name matches the underlying Ionicons glyph name, `size` and `color` are semantic tokens, never raw numbers or hex values.
* **Sizes**: use the `xs`/`sm`/`md`/`lg`/`xl` scale from Design Tokens. Never pass a raw numeric `size`.
* **Colors**: use semantic color tokens (`primary`, `muted`, `destructive`, etc.), the same palette used everywhere else. Never pass a raw hex value, and never branch on `dark ? '#xxx' : '#yyy'` inline — `Icon` resolves the correct color for the current theme internally.
* **Rule**: no feature screen may import `Ionicons` (or any other icon library) directly. If a screen needs an icon, it goes through `Icon`.