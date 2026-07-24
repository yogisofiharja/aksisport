# Performance Guidelines

Performance is a feature.

Every UI decision should consider rendering cost.

---

# Goals

Fast startup

Smooth scrolling

Responsive interactions

Low memory usage

Predictable rendering

---

# Rendering

Avoid unnecessary re-renders.

Prefer memoization where appropriate.

Do not memoize everything.

---

# Lists

Use FlashList for large collections.

Avoid rendering unnecessary items.

Keep renderItem lightweight.

---

# Keys

Always use stable keys.

Never use array indexes unless the list is static.

---

# Components

Prefer small components.

Avoid deeply nested trees.

Keep render logic simple.

---

# Props

Avoid creating new object references unnecessarily.

Avoid inline functions inside frequently rendered lists.

---

# Images

Lazy load when possible.

Avoid oversized assets.

Cache images where appropriate.

---

# Icons

Use shared icon components.

Avoid unnecessary imports.

---

# Animations

Animations should run on the UI thread whenever possible.

Use Reanimated for gesture-driven interactions.

---

# State

Keep state close to where it is used.

Avoid unnecessary global state.

---

# Network

Render loading states immediately.

Avoid blocking the UI while waiting for data.

---

# Profiling

Measure before optimizing.

Never optimize based on assumptions.

---

# Philosophy

Readable code comes first.

Optimize when there is measurable benefit.