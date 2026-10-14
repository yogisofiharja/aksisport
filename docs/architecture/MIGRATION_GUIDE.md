# Migration Guide

This document defines the strategy, safety rules, and execution guidance for migrating from the current UI architecture to the AKSI Design System.

**Phase order and scope are defined in [ROADMAP.md](./ROADMAP.md).** This document does not redefine phases — it defines how each phase should be executed safely.

---

# Objectives

Reduce duplication.

Improve consistency.

Preserve functionality.

Avoid large refactors.

---

# Rules

Every migration should:

Compile successfully.

Be independently reviewable.

Avoid changing business logic.

Avoid redesigning screens.

---

# Behavior-Heavy Screens

Some existing screens carry real logic alongside their styling, not just presentation. These require extra care during migration.

Known behavior-heavy screens:

* `src/mobile/MobileMatchScreen.tsx` — locks screen orientation to landscape and hides the status bar during live scoring.
* `src/mobile/activities/ActivityMatchScreen.tsx` — drives text-to-speech announcement timing tied to match state changes, and the live score sync.

When migrating these screens:

* Migrate presentation only (`className`, style values, layout markup).
* Preserve behavior exactly — orientation locking, TTS timing, and state transitions must not change.
* Avoid logic refactoring in the same change as a styling migration. If a logic change is genuinely needed, do it as a separate, independently reviewed change.

---

# Risk-Based Screen Migration Order

Screen migration (see Screen Migration phase in [ROADMAP.md](./ROADMAP.md)) proceeds in stages, ordered from lowest to highest regression risk:

1. Simple CRUD screens
2. Dashboard
3. Club screens
4. Profile
5. Settings
6. Match Scoring
7. Legacy scoring flow

Note: as of this writing, the current codebase does not yet have Dashboard or Profile screens — the existing screens are Club (`src/mobile/clubs/`), Session (`src/mobile/sessions/`), and Activity/Match (`src/mobile/activities/`) CRUD screens. Stages 2 and 4 apply once those screens exist; in the meantime, stage 1 covers the Club and Session screens, and stages 6–7 map to the behavior-heavy screens listed above.

This ordering exists specifically to defer the behavior-heavy screens (stages 6–7) to last, so any regression surfaces against a smaller, more isolated change rather than being entangled with the bulk of the CRUD-screen migration.

---

# Dialog vs. Alert.alert

Phase 4 introduced `Dialog` (`src/design-system/feedback/Dialog.tsx`) to unify the app's confirm-dialog implementations. It is **not** a blanket replacement for every `Alert.alert` call site. Distinguish:

* **Workflow confirmations** (End Match, End Session, Leave Screen, and similar in-app decisions) — migrate to `Dialog`.
* **System-style confirmations or platform-native interactions** — `Alert.alert` may still be the right choice; a native OS dialog is sometimes the correct UX, not a gap to close.

Apply this distinction at each Phase 6 call site individually rather than converting every `Alert.alert` on sight.

---

# Migration Checklist

Before merging:

UI unchanged

Business logic unchanged

Dark mode works

Accessibility works

Performance maintained

No duplicated code introduced

---

# Completion Criteria

The migration is complete when:

All reusable UI comes from the Design System.

Legacy styling is removed.

No duplicated components remain.

The application behaves exactly as before.