# UI Review Checklist

This checklist must be completed before any UI-related Pull Request is approved.

---

# Design System

- [ ] Existing component reused where possible
- [ ] No duplicate components introduced
- [ ] Uses Design Tokens
- [ ] No hardcoded colors
- [ ] No hardcoded spacing
- [ ] No hardcoded typography
- [ ] No hardcoded radius

---

# Layout

- [ ] Uses Page or ScrollPage
- [ ] Uses Stack/HStack/VStack
- [ ] Consistent spacing
- [ ] No unnecessary wrapper Views

---

# Components

- [ ] Minimal public API
- [ ] Correct variant usage
- [ ] Supports disabled state
- [ ] Supports loading state (if applicable)
- [ ] Uses Icon wrapper
- [ ] Uses Typography component

---

# Accessibility

- [ ] accessibilityLabel provided
- [ ] accessibilityRole correct
- [ ] Accessible touch target
- [ ] Screen reader friendly
- [ ] Color is not the only indicator

---

# States

- [ ] Loading state
- [ ] Empty state
- [ ] Error state
- [ ] Success state (if applicable)

---

# Dark Mode

- [ ] Fully supported
- [ ] No hardcoded light colors

---

# Performance

- [ ] No unnecessary re-renders
- [ ] Stable list keys
- [ ] Images optimized
- [ ] Animations are smooth

---

# Code Quality

- [ ] No duplicated Tailwind classes
- [ ] No duplicated business logic
- [ ] Component kept small
- [ ] Clear naming
- [ ] Props remain simple

---

# Final Question

If this component already existed elsewhere, would I still build it this way?

If the answer is "No", refactor before merging.