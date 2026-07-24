# Contributing UI

This document defines how contributors should build UI inside AKSI.

These rules apply to both human developers and AI assistants.

---

# Before Writing Code

Always search for an existing solution.

Order:

1. Design Tokens
2. Layout components
3. UI Components
4. Domain UI
5. Existing variants

Only create something new if nothing suitable exists.

---

# Component Rules

Prefer:

Composition

Over

Configuration

Example

Good

<Card>
    <Card.Header />
    <Card.Content />
</Card>

Bad

<Card
    hasHeader
    hasDivider
    hasShadow
    hasFooter
    hasBadge
    hasImage
/>

---

# Naming

Use business-neutral names whenever possible.

Good

Card

Button

Section

Stack

Bad

BlueButton

DashboardCard

AwesomeCard

---

# Styling

Always use:

Design Tokens

Never hardcode:

- Colors
- Radius
- Font sizes
- Shadows
- Spacing

---

# Business Logic

UI components must never:

- Fetch data
- Call Firebase
- Navigate
- Manage authentication

These belong to Features.

---

# Reusability

If the same UI appears twice:

Stop.

Extract it.

---

# Reviews

Every UI Pull Request must pass the UI Review Checklist.

---

# Philosophy

Build fewer components.

Build better components.

Reuse everything possible.