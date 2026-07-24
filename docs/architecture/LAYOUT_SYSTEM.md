# Layout System

Layouts provide consistent screen structure.

Every page should feel familiar.

---

# Goals

Reduce duplicated layout code.

Improve consistency.

Improve readability.

---

# Layout Hierarchy

Page

↓

Section

↓

Container

↓

Stack

↓

Content

---

# Page

Responsible for:

- Safe Area
- Status Bar
- Background
- Keyboard
- Screen padding

Every screen should begin with a Page.

---

# ScrollPage

Adds scrolling.

Use when content may exceed screen height.

Avoid nesting multiple scroll views.

Composes Container and Stack internally for horizontal padding and
inter-child spacing — the same primitives a non-scrolling Page would
compose directly, not a separately maintained padding value.

Removed: `ModalPage`. Introduced in Phase 2 ahead of any real dialog
existing; Phase 4's `Dialog` — the one real candidate — needed a backdrop
+ centered card, not a safe-area-padded content panel, and was built
without it. Kept as a documented removal rather than silently deleting the
paragraph, so the reasoning isn't lost if a real bottom sheet or full-page
modal need ever resurfaces the question.

---

# Section

Groups related information.

Each section should have:

Optional title

Optional description

Content

Optional actions

---

# Container

Defines horizontal constraints.

Responsible for consistent page width and padding.

---

# Stack

Default layout primitive.

Responsible for vertical spacing.

Avoid manually adding margins between children.

---

# HStack

Horizontal layout.

Responsible for spacing between items.

---

# VStack

Vertical layout. A distinct primitive from `Stack`, not an alias — matches the existing implementation (`VStack`/`HStack` in `components/ui/box.tsx`).

Use `VStack` when a vertical group is being written alongside an `HStack` and the pairing improves readability; use `Stack` as the general-purpose default otherwise.

---

# Spacer

Used to create flexible layouts.

Avoid empty Views.

---

# Lists

All lists should use a shared layout.

Spacing between rows should remain consistent.

---

# Cards

Cards should never define page spacing.

Cards define internal spacing only.

The Page controls external spacing.

---

# Empty States

Every page should have a consistent empty state.

Do not create custom empty layouts.

---

# Loading States

Use shared loading components.

Avoid creating inline loading indicators.

---

# Page Checklist

Every page should provide:

- Safe Area
- Background
- Padding
- Accessibility
- Dark Mode
- Loading State
- Empty State
- Error State