# Component Standards

This document defines the standards for every reusable component in AKSI.

The goal is consistency, predictability, and maintainability.

---

# General Principles

Every reusable component should:

- Have a single responsibility
- Be composable
- Be predictable
- Be accessible
- Be easy to discover
- Be easy to extend

Avoid creating components that solve multiple unrelated problems.

---

# Component Hierarchy

Foundation

↓

Layout

↓

UI Components

↓

Domain UI

↓

Features

A component may only depend on layers below it.

---

# Folder Structure

The multi-file structure is a recommendation for components that have grown large enough to need it — not a strict requirement for every component. Optimize for simplicity; don't enforce boilerplate on a component that doesn't need it.

Small components may remain a single file:

```
Button.tsx
index.ts
```

Larger components — once styles, types, or tests genuinely warrant separation — may evolve into:

```
Button/
    Button.tsx
    Button.types.ts
    Button.styles.ts
    Button.test.tsx
    index.ts
```

Every component should expose a single public API through index.ts, regardless of which shape it uses internally.

---

# Naming

Use nouns.

Good

Button

Card

Input

Badge

Dialog

Section

Bad

MainButton

RedButton

AwesomeCard

FancyInput

---

# Variants

Prefer variants instead of duplicate components.

Good

<Button variant="primary" />

<Button variant="secondary" />

<Button variant="outline" />

Bad

PrimaryButton

SecondaryButton

OutlineButton

---

# Sizes

Use standard sizes.

Examples

xs

sm

md

lg

xl

Avoid arbitrary values.

---

# Composition

Prefer composition over configuration.

Good

<Card>

    <Card.Header />

    <Card.Content />

    <Card.Footer />

</Card>

Avoid components with dozens of boolean props.

---

# Props

Every component should have a minimal API.

Avoid unnecessary configuration.

Prefer sensible defaults.

---

# Styling

Reusable components should use design tokens.

Avoid hardcoded:

- colors
- spacing
- radius
- typography

---

# Icons

Icons should be passed as components.

Example

<Button leftIcon={<Icon name="plus" />} />

Avoid importing icons inside every screen.

---

# Accessibility

Every interactive component should support:

- accessibilityLabel
- accessibilityRole
- accessibilityHint

---

# Refs

Interactive components should forward refs when appropriate.

Examples:

Input

Button

ScrollView wrappers

---

# Class Names

Avoid repeating Tailwind classes.

Move repeated styling into reusable components.

---

# Anti Patterns

Do not create:

PrimaryButton

DangerButton

SuccessButton

Instead

<Button variant="primary" />

<Button variant="danger" />

<Button variant="success" />

---

# Before Creating A New Component

Ask:

Can an existing component solve this?

Can an existing variant solve this?

Can composition solve this?

Only create a new component when the answer is no.