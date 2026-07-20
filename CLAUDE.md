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

## Documentation Authority

1. docs/product/
2. docs/engineering/
3. docs/current/
4. prd.md (temporary until migrated)
5. README.md (setup only)

## Rules for Claude

- Never invent missing product requirements.
- If product documentation is missing, ask before implementing.
- You MAY generate docs/current by analysing the existing implementation.
- Do not rewrite architecture solely to match target documentation.
- Prefer incremental evolution over large rewrites.
