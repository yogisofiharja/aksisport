# UI Architecture Roadmap

This roadmap defines the order in which the AKSI UI architecture should evolve.

Each phase should be completed, reviewed, and merged independently.

**This is the single source of truth for phase order and scope.** Migration strategy, safety rules, and execution guidance live in [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) — that document does not redefine phases.

---

# Phase 1 — Foundation

- Design Tokens
- Theme
- Colors
- Typography
- Spacing
- Radius
- Elevation

Status: Planned

---

# Phase 2 — Layout

- Page
- ScrollPage
- ModalPage
- Stack
- HStack
- VStack
- Section
- Container

Status: Planned

---

# Phase 3 — Core Components

- Typography
- Icon
- Button
- Card
- Badge
- Divider
- Input

Status: Planned

Scope note: `Avatar` and `Chip` were originally listed here but have zero
current consumers anywhere in the codebase (verified during Phase 3
planning). Building them now would be a speculative abstraction, contrary
to DESIGN_PHILOSOPHY.md's "build only what is needed" principle. Moved to
Optional — see below.

---

# Phase 4 — Feedback Components

- Empty State
- Loading State
- Skeleton
- Dialog
- Bottom Sheet
- Toast

Status: Planned

---

# Phase 5 — Domain UI

- ClubCard
- PlayerCard
- MatchCard
- SessionCard
- ActivityCard
- LeaderboardCard

Status: Planned

---

# Phase 6 — Screen Migration

Migrate existing screens to use:

- Layout primitives
- Core Components
- Domain UI

Remove duplicated layouts and styles.

Status: Planned

---

# Phase 7 — Polish

- Motion
- Accessibility improvements
- Performance optimization
- Visual consistency review

Status: Planned

---

# Optional — Implement When First Required

Components with no current or immediate consumer in the codebase. Do not
build ahead of need — implement only once a real screen requires one.

- **Avatar** — no screen currently displays a user photo/initials circle
  (`ClubMembersScreen` shows plain name rows).
- **Chip** — the closest existing visual (`AddMatchScreen`'s participant
  selection pills) is bespoke match-assignment logic, not a generic
  reusable chip.

---

# Definition of Done

A phase is complete when:

- All code compiles
- UI Review Checklist passes
- Documentation updated (if required)
- No regressions introduced
- Ready for production