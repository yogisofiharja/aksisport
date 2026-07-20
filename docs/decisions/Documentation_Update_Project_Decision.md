# Documentation Update (Project Decision)

## Purpose

This document clarifies the documentation strategy for AKSI and resolves
ambiguities introduced during the transition to the new handbook
structure.

------------------------------------------------------------------------

## Product Documentation Was **Not** Removed

The removal of the previous `docs/product/*` documents was **not
intentional**.

The latest handbook update was intended to **add** the new documentation
model (`docs/current`) and improve `CLAUDE.md`. It was **not** intended
to replace or delete any existing product documentation.

The following product documents should remain part of the repository
until they are intentionally rewritten:

``` text
docs/product/
├── vision.md
├── principles.md
├── navigation.md
├── context.md
├── interaction.md
├── domain.md
├── roadmap.md
└── terminology.md
```

------------------------------------------------------------------------

# Documentation Structure

``` text
docs/
├── current/
│   Describes the implementation exactly as it exists today.
│   Reverse-engineered from the codebase.
│
├── product/
│   Describes the desired product.
│   Product vision, UX, navigation, terminology,
│   domain rules, future behaviour.
│
└── engineering/
    Describes how the software should be built.
    Architecture, coding standards,
    state management, testing, API conventions.
```

All three folders are first-class documentation and serve different
purposes.

------------------------------------------------------------------------

# Documentation Principles

Always distinguish between three concepts.

## Current

Represents the implementation that exists today.

Examples:

-   Current API
-   Current navigation
-   Current permissions
-   Current lifecycle
-   Current repository structure

Rules:

-   Derived from implementation.
-   Never invent behaviour.
-   Keep synchronized with the code.

------------------------------------------------------------------------

## Product

Represents the intended behaviour of AKSI.

Contains:

-   Product vision
-   UX decisions
-   Domain model
-   Navigation
-   Terminology
-   Business rules

Rules:

-   Never infer product behaviour from implementation.
-   Missing product decisions must be discussed before implementation.

------------------------------------------------------------------------

## Engineering

Represents technical direction.

Contains:

-   Architecture
-   Coding standards
-   API guidelines
-   State management
-   Testing
-   Performance

Target architecture may be ahead of today's implementation.

Migration should normally be incremental.

------------------------------------------------------------------------

# Rules for Claude

When documentation is missing:

-   You MAY generate `docs/current/*` by analysing the implementation.
-   You MUST NOT invent new product behaviour.
-   You SHOULD ask questions whenever product intent is unclear.
-   You SHOULD prefer incremental improvements over large rewrites.
-   Do not perform architectural rewrites solely to match target
    documentation.

------------------------------------------------------------------------

# Documentation Authority

Priority order:

1.  `docs/product/`
2.  `docs/engineering/`
3.  `docs/current/`
4.  `prd.md` (temporary until migrated)
5.  `README.md` (setup only)

Legacy planning documents should be archived after their useful content
has been migrated.

------------------------------------------------------------------------

# Repository Goal

The repository should become self-documenting.

Each documentation layer answers a different question:

-   **Current** → How does the system work today?
-   **Product** → What should the system become?
-   **Engineering** → How should we build it?

These are intentionally different and should remain separate.

------------------------------------------------------------------------

# Guidance for AI Contributors

If a document can be generated from implementation (`docs/current`),
generate it.

If it requires product decisions (`docs/product`), ask before writing.

Prefer complete, high-quality documentation over placeholder files.
