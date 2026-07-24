# CLAUDE.md

# AKSI Repository Guide

## Documentation Model

This project intentionally separates documentation into three layers.

### docs/current/

Describes the implementation that exists today.

- Reverse-engineered from the codebase.
- Never invent future behaviour.
- Updated whenever implementation changes.

### docs/product/

Describes the target product.

- Product vision
- UX
- Navigation
- Domain decisions
- Future behaviour

### docs/engineering/

Describes how the software should be built.

- Architecture
- State management
- API conventions
- Coding standards

Always distinguish between:

- Current → implemented today
- Target → intended direction
- Future → ideas that are not implementation requirements

---

# Documentation Authority

Documentation priority is:

1. docs/AKSI_PRODUCT_DECISIONS.md
2. docs/product/
3. docs/engineering/
4. docs/current/
5. docs/archive/prd.md (historical)
6. README.md (setup only)

If multiple documents conflict:

**docs/AKSI_PRODUCT_DECISIONS.md always wins.**

---

# Product Decision Workflow

The project follows an iterative Product × Engineering workflow.

Product discussions and software implementation happen in parallel.

Do NOT wait until every product requirement has been finalized.

The product team continuously updates:

```
docs/AKSI_PRODUCT_DECISIONS.md
```

This file contains two sections.

## Ready to Develop

Everything inside this section is approved.

Claude should:

- implement it,
- refactor existing code when necessary,
- create tests,
- update documentation,
- improve architecture if appropriate.

Do NOT ask whether an approved feature should be implemented.

Assume it is already approved.

---

## Planning

Planning contains future product direction.

Planning exists to guide architecture.

Planning should NEVER be implemented directly unless explicitly requested.

Good example:

Planning:

Smart Scheduler

Implementation:

- Scheduler interface
- dependency injection
- extension points

Bad example:

- AI scheduler
- fairness algorithm
- optimization engine

Architecture should support future features without implementing speculative behaviour.

---

# Documentation Responsibilities

Documentation is part of development.

Whenever implementation changes:

- update affected documentation,
- keep documentation synchronized with implementation,
- merge duplicated documentation,
- simplify outdated documentation,
- remove obsolete documentation whenever appropriate.

Avoid creating unnecessary markdown files.

Prefer improving existing documentation instead of introducing new documentation.

The goal is to keep the docs folder clean, organized, and easy to navigate.

---

# Rules for Claude

- Never invent missing product requirements.
- Never implement items that only exist under Planning.
- Always implement approved items under Ready to Develop.
- Use Planning only to influence architecture.
- Prefer incremental evolution over large rewrites.
- Preserve existing functionality whenever possible.
- Refactor when necessary to improve long-term maintainability.

---

# Architecture Principles

Always prefer architecture that is:

- modular
- domain-driven
- loosely coupled
- extensible
- maintainable

Future features should be supported through abstractions rather than speculative implementations.

Modules should remain independent whenever possible.

Example:

Session

↓

Match

↓

Scheduler

↓

Scoring

↓

Payments

These modules should communicate through clear interfaces.

Avoid unnecessary coupling.

---

# Engineering Autonomy

Claude is encouraged to make engineering decisions without asking for approval when product behaviour does not change.

Examples include:

- folder organization
- naming improvements
- architecture refactoring
- dependency injection
- design patterns
- testing strategy
- performance improvements
- code cleanup

Do not ask for approval for engineering decisions.

Ask only when uncertainty affects:

- product behaviour,
- user experience,
- business rules,
- conflicting product decisions.

---

# Development Workflow

For every implementation:

1. Read:

```
docs/AKSI_PRODUCT_DECISIONS.md
```

2. Implement all approved decisions related to the task.

3. Refactor architecture where appropriate.

4. Update affected documentation.

5. Remove obsolete documentation if necessary.

6. Summarize:

- implemented features,
- architectural improvements,
- documentation updates,
- assumptions made,
- anything blocked by future Planning decisions.

---

# Product Philosophy

AKSI is not just a scoring application.

AKSI is a platform that helps sports communities organize activities.

When making engineering decisions, prioritize:

- organizer experience,
- player experience,
- simplicity,
- extensibility,
- maintainability.

Whenever there is a trade-off, prefer reducing organizer workload while maintaining a clean user experience.

---

# AI Philosophy

AI is an assistant.

AI recommends.

Organizers decide.

Architecture should support intelligent recommendations in the future without removing organizer control.

---

# Refactoring Policy

Refactoring is encouraged.

Claude may:

- reorganize modules,
- improve architecture,
- remove dead code,
- simplify abstractions,
- improve naming,

provided that:

- functionality is preserved,
- migration is incremental,
- implementation remains understandable,
- documentation stays synchronized.

Long-term maintainability is preferred over preserving legacy structure.