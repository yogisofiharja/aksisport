# Architecture Gap Analysis — Foundation Documents Migration

Status: Temporary engineering document. Exists only while the app
migrates toward the Foundation Documents below. Delete once the
roadmap in this file is complete and `docs/current/` is regenerated to
match.

Foundation Documents (authoritative target, per `CLAUDE.md`):

- `docs/AKSI_PRODUCT_DECISIONS.md` (domain/business rules)
- `docs/AKSI_UX_PRINCIPLES.md` (UX philosophy)
- `docs/AKSI_INFORMATION_ARCHITECTURE.md` (navigation/IA)

Current implementation, for reference: `docs/current/navigation.md`,
`architecture.md`, `repository-map.md`, `permissions.md`,
`state-machines.md`, `lifecycle-*.md`.

This document does not propose a rewrite. Per DP-ARCH-001, the goal is
to identify what already satisfies the Foundation Documents, what
needs a small adjustment, and what requires a real milestone —
nothing here is a mandate to implement.

---

## 1. Current Implementation, in one paragraph

The mobile app is a single linear `native-stack` navigator
(`MainStack`) with **no tabs and no Personal/Community split**.
`ClubListScreen` is the app's root screen after auth — every session
opens with a list of the user's clubs, not a personal home. Every
other screen requires a `clubId` (or something scoped under one) to
exist at all: `ClubDetail → SessionList → SessionDetail →
AddMatch/ActivityMatch`. There is no cross-club view of anything, no
messaging of any kind, no "Explore," and the one settings/profile
surface that exists (`SettingsModal`) is unreachable from the app's
real navigation tree. The domain model itself (`Club → Session →
Activity → Match`, sport-module ownership, participant lifecycle) is
in good shape and largely matches `AKSI_PRODUCT_DECISIONS.md` already
— the gap is almost entirely in **navigation, information
architecture, and the Personal-World concept**, which did not exist
as a product requirement until now.

---

## 2. Gap Analysis by Area

### 2.1 Navigation & Screen Hierarchy

**Target** (`AKSI_INFORMATION_ARCHITECTURE.md`): two contexts —
Personal (Home/Explore/Inbox/Me) and Community (Home/Sessions/
Communication, entered intentionally) — each with its own tab-bar
navigation, plus Objects (Session, Activity, Member, Recurring
Schedule) opened within a context without changing it.

**Current**: one stack, no tabs, no Personal Context at all.
`ClubListScreen` (a Community *collection*, not a Home) is the root.
Opening a club **is** the only navigation model that exists.

Classification: **Category C.** This is the central mismatch the rest
of this document flows from — it isn't fixable as a small patch,
since the app currently has nowhere to put "Home / Explore / Inbox /
Me" without a new top-level navigator.

### 2.2 Personal Context

**Target**: default entry point; owns My Activities/Home, Explore,
Inbox, Me/Profile; a user should be able to see "what needs my
attention" across every Community they belong to before entering any
one of them (UX-001, UX-003, UX-009).

**Current**: does not exist. There is no cross-club aggregation
anywhere in the client or the API — every list endpoint
(`GET /v1/clubs/:id/sessions`, etc.) is club-scoped. The closest thing
to "Me" is `SkillLevelsScreen`, reachable only via a header icon on
`ClubListScreen`, and `SettingsModal`, reachable only from the legacy
`ScoringFlow`/`MobileSetupScreen` path that isn't wired into
`MainStack` at all.

Classification: **Category C.**

### 2.3 Community Context / Community Home ("Current Focus")

**Target**: entering a Community is a deliberate mode switch; Home
inside it should surface the Session needing attention (Today /
Next / Live / Draft) rather than a static info page (UX-003, UX-006,
"Current Focus").

**Current**: `ClubDetailScreen` is a static club-info hub — club name,
member count/actions, a "Sessions" button, settings/delete actions
for owners. It does not rank or surface any specific Session; the
organizer/member has to go into `SessionList` and read status pills
to find out what needs attention.

Classification: **Category C**, but low-risk relative to 2.1/2.2 —
the data needed (session list, statuses, `starts_at`) already exists
client-side (`deriveStatus.ts`, `sessionSchedule.ts`); this is a
screen redesign, not new data plumbing.

### 2.4 Objects, Not Destinations (Members, Settings)

**Target**: Members and Settings are Objects opened contextually, not
permanent navigation destinations (UX-014, IA "Screen Ownership").

**Current**: already true for Members — `ClubMembersScreen` is opened
from `ClubDetailScreen`, not from a tab. **Not true for Settings** —
`SettingsModal` exists but has no reachable entry point in `MainStack`
at all today.

Classification: **Category A** for Members. **Category B** for
Settings — re-wiring an existing, working component into a reachable
place (e.g. from a future "Me" screen or Community Home) is a small
fix, not a redesign.

### 2.5 Session Ownership (Participants / Activities / Communication / Finance / History)

**Target** (`AKSI_INFORMATION_ARCHITECTURE.md`, "Screen Ownership"):
Session owns Participants, Activities, Session Communication, Finance,
History.

**Current**:
- Participants — implemented (DP-002 full lifecycle).
- Activities — implemented (DP-005/DP-006).
- History — implemented, but **only Club-scoped** (`SessionHistoryScreen`,
  v0.6.3); the cross-Community "everywhere I've played" view described
  in DP-009 doesn't exist and structurally *can't* until 2.2 exists.
- Communication — **does not exist**. No messaging of any kind
  anywhere in the codebase.
- Finance — **does not exist as a Session sub-object**. A manual
  payment-confirm action exists (DP-002's Waitlist → Registered step,
  buried in the participant-approval UI), but there's no dedicated
  Finance area a participant or organizer can open.

Classification: Participants/Activities = **Category A**. Club-scoped
History = **Category A**; cross-Community History = **Category C**
(blocked on 2.2). Communication = **Category C** (entirely new
capability). Finance = **Category B** (the underlying data/flow
exists — DP-002's manual confirm — this is surfacing it as its own
place, not building new business logic).

### 2.6 Communication (platform-wide)

**Target**: Communication is a platform capability with four contexts
— User↔User (DMs), Community, Session, Contact Organizer (UX-010, IA).

**Current**: zero implementation. No chat/message table, no DM
concept, no "contact organizer" affordance anywhere in
`server/internal/` or `src/`.

Classification: **Category C.** Entirely new domain surface — not a
navigation gap, an actual new feature area. Note this is not currently
listed under `AKSI_PRODUCT_DECISIONS.md`'s "Ready to Develop" — the
UX/IA docs describe it as a permanent structural capability, but no
DP exists yet defining its data model or rules. Flagging this
discrepancy rather than assuming scope.

### 2.7 Explore / Activity First Discovery

**Target**: Explore is a permanent, primary navigation destination;
discovery starts from activities/sessions, not from Communities
(UX-008).

**Current**: no discovery screen of any kind. The only way to
associate with a Community is `CreateClubScreen` or `JoinClubScreen`
(5-character invite code, text entry only — no QR, no shareable link).
This was previously scoped as "Club Discovery," a Phase 5 / Planning
item in `docs/product/roadmap.md` and remains **Planning**, not
**Ready to Develop**, in `AKSI_PRODUCT_DECISIONS.md` today. The
Foundation Docs elevate "Explore" to a permanent tab, which is an IA
decision, not automatically an approval to build full discovery
(search/nearby/public listings) — those specifics are still
Planning-only per Product Decisions.

Classification: **Category C** for the Explore tab existing at all
(even as a minimal placeholder, it needs the Personal shell from 2.2).
Full discovery *behavior* stays out of scope until promoted out of
Planning — do not build search/nearby/ranking speculatively.

### 2.8 Draft Recovery

**Target**: proactively encourage continuing an existing Draft Session
over creating a new one (UX-005).

**Current**: Draft is a real, persisted Session status (DP-001) and is
visible as a status pill inside `SessionListScreen`'s existing list —
but it's passive. Nothing proactively surfaces "you have an unfinished
draft" before or during session creation.

Classification: **Category B.** The underlying state already exists;
this is a surfacing/UX enhancement on top of it, not new plumbing.
Depends on 2.3 (needs a Community Home to surface it from).

### 2.9 Domain Boundaries & Component Ownership

**Target** (DP-ARCH-002): Sport Module owns sport-specific rules;
Session owns organizer intent; each stays in its own boundary.

**Current**: matches well. `src/sports/tennis/rules.ts` owns
`minParticipants`; `activity_type` is Sport-Module-owned per Session
row; `src/core/sessions/` owns organizer-intent fields. No screen
reaches into another domain's internals.

Classification: **Category A.**

### 2.10 State Management / Backend-Owned Derived State

**Target** (DP-ARCH-003): "Business state shared across multiple
clients should be derived by the backend... Examples: Session
lifecycle." Derived values should not be persisted unless required.

**Current**: `docs/engineering/architecture.md` documents, as a
**deliberate, already-made decision**, that Recruiting/Ready/Full
derivation stays **client-side** (`src/core/sessions/deriveStatus.ts`),
specifically to avoid duplicating the Sport-Engine's
`minParticipants` rule server-side. This is a direct textual conflict
with DP-ARCH-003's own example list, which names "Session lifecycle"
as backend-derived.

Classification: **Category C**, but small and self-contained —
either (a) move the derivation server-side (the backend already has
every input it needs: participant count, status, and it could import
the same rule the client uses today), which is genuinely a small,
isolated change, not a navigation-scale milestone; or (b) explicitly
amend DP-ARCH-003 to carve out an exception for Sport-Engine-dependent
derivations. This is a product/architecture decision, not an
engineering-autonomy one (`AKSI_PRODUCT_DECISIONS.md`'s own rule: "not
here to ask whether an approved feature should be implemented" doesn't
apply when two approved documents disagree with each other) —
recommend flagging for an explicit decision rather than silently
picking one.

### 2.11 Terminology: "Club" vs. "Community"

**Target**: `AKSI_PRODUCT_DECISIONS.md`'s Core Domain section and both
new Foundation Docs consistently say **Community** — "Communities
organize: Recurring Schedules, Sessions," "Community Context,"
"Community Collection."

**Current**: the entire codebase says **Club** — `ClubListScreen`,
`club_members` table, `/v1/clubs` routes, `docs/product/domain.md`'s
"Club Roles" (Owner/Admin/Member). This is pervasive, not cosmetic:
every screen title, route name, DB table, and API path uses the old
term.

Classification: **Category B for user-facing copy** (screen titles,
labels — cheap, low-risk, high clarity value). **Category C /
explicitly out-of-scope for now for the data layer** (renaming
`club_members`, `/v1/clubs/*`, Go package/handler names) — per
DP-ARCH-001 ("preserve working functionality," "prefer incremental
migration"), a full backend rename is unnecessary churn with real
regression risk (migrations, every client call site) for something
that's purely a label. Recommend: rename in UI copy now; leave
internal identifiers (`club_id`, `/v1/clubs`) alone until/unless a
concrete reason forces the deeper rename.

### 2.12 Documentation Conflicts (`docs/product/`)

Now that the Foundation Documents exist, several `docs/product/*.md`
files actively **contradict** them rather than merely predating them:

- `docs/product/navigation.md` — describes "Today / Play / Me" tabs.
  Directly superseded by `AKSI_INFORMATION_ARCHITECTURE.md`'s
  Personal Navigation (Home/Explore/Inbox/Me) and Community Navigation
  (Home/Sessions/Communication).
- `docs/product/principles.md` — states "there are no personal
  sessions or personal activities, and no 'My Club' abstraction."
  Directly contradicted by UX-001 (Personal First) and the entire
  Personal Context concept.
- `docs/product/context.md` — defines Context as "Identity + Time +
  Club + Activity + Permissions + Device," a different model than the
  new Personal/Community Context split.
- `docs/product/interaction.md` — mostly subsumed by
  `AKSI_UX_PRINCIPLES.md` (One Primary Action, Progressive Disclosure
  already restated there); two rules ("Preserve momentum," "Never
  interrupt live play") are live-match-specific and not covered by the
  new UX doc — worth relocating rather than deleting.
- `docs/product/domain.md` and `docs/product/roadmap.md` — largely
  still accurate (Club Roles' capabilities, Tennis Module scope, MVP
  exclusions) and not contradicted, just due for the Club→Community
  terminology pass once 2.11 is decided.

Classification: **Category D.** Per `CLAUDE.md`'s documentation
responsibilities ("remove obsolete documentation whenever appropriate"),
`navigation.md`, `principles.md`, and `context.md` should be retired
(their content is now fully owned by the Foundation Docs).
`interaction.md`'s two live-match rules should move into
`docs/current/lifecycle-match.md` or `docs/engineering/` rather than
be lost. This is a documentation-only cleanup with no code impact —
flagged here for approval alongside the rest, but it is by far the
lowest-risk item in this document.

---

## 3. Summary Table

| Area | Classification | Blocking dependency |
|---|---|---|
| Personal Context / tab shell | C | — (root dependency for almost everything below) |
| Community Home / Current Focus | C | Personal shell (nav container) |
| Members as Object | A | — |
| Settings reachability | B | — |
| Session: Participants/Activities/Club-scoped History | A | — |
| Session: cross-Community History | C | Personal Context |
| Session: Communication | C | New domain — needs a DP first |
| Session: Finance | B | — |
| Platform Communication | C | New domain — needs a DP first |
| Explore tab (shell only) | C | Personal shell |
| Explore (real discovery behavior) | Planning — not in scope | Product decision to promote out of Planning |
| Draft Recovery surfacing | B | Community Home |
| Sport Module / Session domain boundaries | A | — |
| Backend-owned derived lifecycle state | C (small) | Product/architecture decision (2.10) |
| "Club" → "Community" UI copy | B | — |
| "Club" → "Community" data layer | Out of scope for now | — |
| `docs/product/` conflicting docs | D | — |

---

## 4. Proposed Roadmap

Dependency-driven, not feature-driven — ordered so nothing is built on
a shell that doesn't exist yet. Revised per user feedback
(2026-08-05): documentation/terminology housekeeping is no longer a
gated milestone, Communication and Finance move later, and two new
milestones — Session Experience and Organizer Experience — are added as
first-class, cohesive pieces of work rather than being spread across
unrelated milestones.

### Pre-work — Documentation & Terminology Housekeeping (not a milestone)

Folded into Milestone 1's kickoff rather than tracked as a gated step:

- Retire/merge `docs/product/navigation.md`, `principles.md`,
  `context.md` (superseded by the Foundation Docs); relocate
  `interaction.md`'s two live-match rules into
  `docs/current/lifecycle-match.md` or `docs/engineering/`.
- Rename user-facing strings/screen titles from Club to Community
  (2.11). Internal identifiers (DB columns, routes, Go packages) stay
  untouched — no reason to take on migration/API-contract risk for a
  label.

No separate size/risk/dependency tracking — this is cleanup done
alongside Milestone 1, not before it.

### Milestone 1 — Personal Context Shell
- **Objective**: introduce the app's first tab-bar navigator. Personal
  Nav: Home, Explore, Inbox, Me. Home becomes the true post-auth entry
  point, replacing `ClubListScreen`-as-root, and its primary
  responsibilities are explicitly **"My Communities"** (today's
  `ClubListScreen`, repositioned as the entry point into Community
  Context rather than the app root) **and** attention-surfacing across
  every Community the user belongs to (UX-001, UX-003). Me hosts the
  existing `SettingsModal` and `SkillLevelsScreen` (reuse, not rebuild
  — DP-ARCH-001). Explore and Inbox can ship as minimal/placeholder
  screens initially — Explore's real discovery behavior stays Planning
  (2.7); Inbox has no backing data yet (2.6) so it starts as an empty
  state.
- **Why first**: this is the dependency root for nearly everything
  else in the IA — nothing else has anywhere to live without it.
- **Size**: L.
- **Dependencies**: none (housekeeping above proceeds alongside it).
- **Risks**: changes the app's root navigation — needs careful
  regression-testing of the auth → Home transition, `needsProfile`
  gate, etc. No existing deep-link/notification targets to migrate
  (none exist today per `navigation.md`).
- **User-visible improvement**: the app finally has a personal home,
  with "My Communities" as an explicit, first-class destination inside
  it — first real step toward UX-001/UX-003/UX-009.

### Milestone 2 — Session Experience (lifecycle-driven)
- **Objective**: give the Session its own cohesive experience across
  its full lifecycle — Draft → Recruiting → Ready → Live → Completed
  — rather than a single detail screen with status pills bolted on.
  Each state gets its own clear presentation and "what happens next"
  framing (UX-006 Context Before Navigation, UX-015 Consistent Mental
  Model), reusing the derived-state data that already exists
  (`deriveStatus.ts`, `sessionSchedule.ts`). This is the lifecycle
  vocabulary that Milestone 3 (Community Home) and Milestone 4
  (Organizer Experience) both build on. **Deliberate UX decision**: the
  Session itself is the overview — there is intentionally no separate
  Overview tab; the Session's landing page evolves through its
  lifecycle instead of pointing to a summary elsewhere.
- **Why next**: called out explicitly as one of the major UX decisions
  from the Information Architecture discussions — worth its own
  cohesive milestone rather than being spread thin across Community
  Home and Organizer Experience.
- **Size**: L.
- **Dependencies**: none structurally (works within the existing
  Community → Session navigation path) — sequenced here because
  Milestones 3 and 4 depend on the lifecycle model it establishes.
- **Risks**: low on data (nothing new to plumb), moderate on UI scope
  — touches the Session's primary screen substantially. Worth
  resolving 2.10 (backend- vs. client-owned lifecycle derivation)
  before or alongside this milestone, since this is exactly where that
  derivation logic gets touched anyway (see the independent item
  below).
- **User-visible improvement**: a Session always makes its current
  state and next action obvious, for organizers and members alike.

### Milestone 3 — Community Home ("Current Focus")
- **Objective**: replace `ClubDetailScreen`'s static info layout with
  a Current Focus workspace that ranks and surfaces Today/Next/Live/
  Draft Sessions using the lifecycle language established in
  Milestone 2. Community Home becomes the workspace that surfaces
  Current Focus and provides access to Community capabilities
  (Sessions, Communication, Members) — described here in terms of
  product responsibility, not a specific navigation implementation
  (tabs, stack, or otherwise left to implementation).
- **Why next**: needs both the tab-bar container pattern proven out in
  Milestone 1 and the lifecycle model from Milestone 2 to know what to
  rank and how to present it.
- **Size**: M.
- **Dependencies**: Milestones 1 and 2.
- **Risks**: low — UI composition over already-derived data.
- **User-visible improvement**: organizers/members immediately see
  what needs attention on entering a Community, instead of hunting
  through a session list.

### Milestone 4 — Organizer Experience
- **Objective**: a dedicated, cohesive organizer-side workflow across
  Draft → Publish → Prepare → Live Session → Complete Session, instead
  of these steps being scattered across unrelated screens. Draft
  includes proactive Draft Recovery (UX-005 — surfacing an unfinished
  Draft Session before the organizer starts a new one, folded into
  this milestone rather than tracked separately). Prepare is a new
  concept — a pre-session checklist/readiness view — that doesn't
  exist today. Live Session consolidates the existing Generate
  Matches/Custom Match/Regenerate flow into a single organizer-focused
  view. Complete reuses the existing auto-transition/manual-complete
  behavior (DP-009).
- **Why next**: builds directly on Milestone 2's lifecycle model and
  Milestone 3's Community Home as the organizer's natural staging
  area; makes session organization "effortless" as its own explicit
  goal rather than an incidental side effect of other milestones.
- **Size**: L.
- **Dependencies**: Milestones 2 and 3.
- **Risks**: moderate — "Prepare" is new UI/UX territory, not a reuse
  of an existing screen; the rest is consolidation of existing, working
  flows.
- **User-visible improvement**: organizers get one coherent path
  through running a Session instead of assembling it from separate
  screens.

### Milestone 5 — Session Finance
- **Objective**: surface the existing DP-002 manual payment-confirm
  flow as its own Session-owned area instead of inline participant-row
  actions.
- **Why later**: useful, but not as foundational as the navigation
  redesign or the Session experience itself — moved back per feedback.
- **Size**: S–M.
- **Dependencies**: Milestones 2 and 4 (Session-level contextual
  navigation and the organizer workflow it plugs into).
- **Risks**: low — reorganizes existing, working backend logic.
- **User-visible improvement**: organizers get a real "who's paid"
  view instead of scanning participant rows.

### Milestone 6 — Communication Foundation
- **Objective**: introduce Communication as a real domain, phased by
  risk: Contact Organizer (single Session-scoped affordance) → Session
  Communication → Community Communication → direct messages. Each
  phase independently shippable.
- **Why last**: genuinely new scope (2.6) that depends on Personal
  Context, Community Context, and the Session experience all being
  stable first — moved back per feedback rather than introduced while
  navigation is still in flux. Also needs a Product Decision (data
  model, moderation, notification rules) before engineering starts;
  not currently in `AKSI_PRODUCT_DECISIONS.md`'s Ready to Develop.
- **Size**: L overall (per phase, likely M each).
- **Dependencies**: Milestones 1, 3, and 4 (needs Personal/Community/
  Session/Organizer touchpoints to attach entry points to, per UX-010's
  "communication is always attached to something"); a new DP promoting
  this out of the current documentation gap.
- **Risks**: highest in this roadmap — new data model, potential
  moderation/abuse surface, push notification design.
- **User-visible improvement**: players can finally reach an organizer
  or each other inside the app.
- **Rollout order, considered and confirmed** (2026-08-05): evaluated
  swapping to Contact Organizer → Community Communication → Session
  Communication → DMs (Community's durability as the more foundational
  context, per the Community First principle) against keeping Contact
  Organizer → Session Communication → Community Communication → DMs.
  Kept the latter. Reasoning: audience size and lifespan should grow
  one dimension at a time — Contact Organizer → Session Communication
  only grows the audience from one person to one Session's small,
  time-boxed participant list, reusing nearly the same underlying
  thread-on-an-object primitive; jumping to Community Communication
  next is the bigger leap either way (larger, non-time-boxed
  membership, real moderation/notification-fatigue surface), so it's
  safer to validate the message primitive twice at small scale before
  exposing it to a persistent, larger audience. Session-day logistics
  are also a concrete, everyday pain point every single session, while
  a Community-wide channel launched before that habit exists risks
  feeling like an empty room. A "build the general primitive at
  Community scope first" argument is real but not preferred here — it
  risks over-sizing the design for an audience/scale not yet validated;
  incrementally growing scope while reusing the same message-thread
  shape gets the same architectural generality without that bet.

### Independent — Backend-Owned Lifecycle Derivation (engineering-only, no fixed position)
- **Objective**: resolve 2.10 — either move Recruiting/Ready/Full
  derivation server-side, or formally amend DP-ARCH-003 to note the
  Sport-Engine-dependent exception. Requires a product/architecture
  decision first (this isn't an engineering-autonomy call, since it
  involves two Foundation-adjacent documents disagreeing).
- **Size**: S (once the decision is made).
- **Dependencies**: none — can run in parallel with any milestone, but
  recommended around Milestone 2 since that's when this exact logic is
  next touched anyway.
- **Risks**: low, self-contained.
- **User-visible improvement**: none directly; closes a documentation/
  implementation inconsistency.

---

## 5. Explicitly Not Proposed

- Full Club→Community rename of the data layer (2.11) — deferred
  indefinitely per DP-ARCH-001 unless a concrete need forces it.
- Real Explore/discovery behavior (search, nearby, public listings) —
  stays Planning until promoted in `AKSI_PRODUCT_DECISIONS.md`.
- Any Communication data model/UI specifics — Milestone 4 needs its
  own Product Decision before implementation, not just this audit.
- Deep-link/QR/shareable-link invitations — not raised by the
  Foundation Docs beyond mentioning them as IA entry points; current
  code-based invite flow is left as is.

**Planning phase frozen 2026-08-05.** Roadmap approved by the user
after two refinement passes — see `AKSI_PRODUCT_DECISIONS_CHANGELOG.md`-
style history: v1 (initial), v2 (Communication/Finance moved later,
Session Experience and Organizer Experience added), v3 (Milestone 3
reworded to product responsibility rather than nav implementation,
Milestone 2's "no separate Overview tab" decision documented,
Milestone 4 renamed Organizer Journey → Organizer Experience,
Milestone 6's rollout order evaluated and confirmed). Ready to begin
implementation with Milestone 1.
