# AI Instructions

This document defines how AI assistants should contribute to the AKSI codebase.

Read this document before making any code changes.

---

# Primary Goal

Improve the codebase without increasing complexity.

Prefer consistency over creativity.

---

# Before Making Changes

Always:

1. Read the relevant architecture documents.
2. Search for existing implementations.
3. Reuse existing components whenever possible.

Never assume a new component is required.

---

# Component Creation Rules

Before creating a new component, ask:

- Can an existing component be extended?
- Can a variant solve this?
- Can composition solve this?

If the answer is yes, do not create a new component.

---

# Design System

Never bypass the Design System.

Always use:

- Design Tokens
- Layout primitives
- Shared UI components
- Domain UI components

Avoid hardcoded values.

---

# Business Logic

Never move business logic into reusable UI.

UI components should only render data provided through props.

---

# Refactoring

Prefer small, incremental refactors.

Do not rewrite large sections of the application unless explicitly requested.

Each refactor should:

- Preserve behavior
- Reduce duplication
- Improve readability
- Compile successfully

---

# Pull Request Size

Keep changes focused.

A single PR should solve one problem.

Avoid mixing refactoring with new features.

---

# Code Style

Prioritize:

- Readability
- Simplicity
- Predictability

Avoid clever abstractions.

---

# Documentation

If a new architectural pattern is introduced:

Update the relevant documentation.

Documentation and code should evolve together.

---

# Self Review

Before completing a task, verify:

- No duplicated UI
- No hardcoded design values
- Uses existing components
- Accessibility preserved
- Dark mode supported
- Performance not degraded

If any check fails, revise the implementation before considering the task complete.