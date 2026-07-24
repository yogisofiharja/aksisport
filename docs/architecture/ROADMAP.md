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
- Dialog

Status: Planned

Scope note: `Skeleton`, `Bottom Sheet`, and `Toast` were originally listed
here but have zero current consumers (every loading state today is a
spinner, not a skeleton; no bottom sheet exists anywhere; errors are shown
as inline text, not a toast). Same reasoning as Avatar/Chip in Phase 3.
Moved to Optional — see below.

---

# Phase 5 — Domain UI

- ClubCard
- PlayerCard
- MatchCard
- SessionCard

Status: Planned

Scope note: `ActivityCard` was originally listed alongside `MatchCard` as a
separate item, but in this app's domain model they're the same real thing
under two names — SessionDetailScreen's activity queue row *is* the match
card (`ActivityDetail.config` is literally a `MatchConfig`). Built once, as
`MatchCard`, per MULTI_SPORT_ARCHITECTURE.md's preference for the
sport-neutral term. `LeaderboardCard` deferred — zero current consumer, no
leaderboard/ranking screen exists anywhere in the app. Moved to Optional.

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
- **Skeleton** — no skeleton-loading pattern exists anywhere; every loading
  state today is an `ActivityIndicator` spinner.
- **Bottom Sheet** — not used anywhere in the app.
- **Toast** — errors are shown as inline text under forms today, not a
  toast/snackbar.
- **LeaderboardCard** — no leaderboard/ranking screen exists anywhere in
  the app.

---

# Definition of Done

A phase is complete when:

- All code compiles
- UI Review Checklist passes
- Documentation updated (if required)
- No regressions introduced
- Ready for production