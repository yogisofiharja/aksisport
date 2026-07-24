# Archive

Historical planning documents, moved here from the repository root so that
only `CLAUDE.md` and `README.md` remain at top level. Nothing here is
authoritative — see `docs/product/`, `docs/engineering/`, `docs/current/`
for current decisions and state. Documentation Authority order is defined
in `docs/decisions/Documentation_Update_Project_Decision.md`.

## `prd.md`

Frozen v1.0 product requirements doc. **Largely, not fully, migrated** —
`docs/product/roadmap.md`, `docs/product/terminology.md`, and
`docs/engineering/technical-direction.md` explicitly carry over its
wording verbatim (each says "Migrated from `prd.md`"). `docs/product/vision.md`
and `docs/product/principles.md` diverge from this document's Vision and
Product Principles sections — that appears to be a deliberate revision, not
an oversight, but wasn't confirmed as such when this archive was created.

Two sections have **no home in any current doc**: "Product Pillars" (Club,
Session, Player Identity, Live Gameplay, History, Insights) and "Club
Settings" (default sport, match format, tiebreak/deuce rule, language,
timezone — a per-club preferences concept that doesn't exist anywhere in
the current implementation or product docs). Neither was silently merged
into `docs/product/` as part of this archive — that would be inventing
product scope. Flagged for a deliberate decision instead: adopt into
`docs/product/domain.md`, or explicitly treat as superseded.

"Live Match Preferences" (announcer voice, speed, keep-screen-awake, sound,
vibration, display options) is *not* an oversight — `docs/product/milestone-1.md`'s
Settings section explicitly addresses and scopes this out already
("Any other preference... is out of scope for Milestone 1... e.g. the
legacy `SettingsModal`'s TTS voice picker").

## `poinyuk-legacy-roadmap.md`, `poinyuk-legacy-plan.md`, `poinyuk-legacy-overview.txt`

Pre-Aksi planning and build history for the original single-device,
no-account, web-only PoinYuk tennis scorer (`src/scoring.ts` — a path that
no longer exists, relocated to `src/sports/tennis/scoringEngine.ts`).
All milestones in these documents are marked complete. They describe an
app shape (no accounts, device-local history, anyone-can-score session
sharing) that the current Club/Session/Activity/Match model has since
superseded for mobile — though the frozen web `ScoringFlow` this history
describes is still live today, unrelated to the Aksi migration.

Kept for historical reference only — do not treat as describing current
or target behavior. See `docs/current/architecture.md` and
`docs/current/repository-map.md` for what's actually true today.
