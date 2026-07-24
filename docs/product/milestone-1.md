# Milestone 1

Defines the exact scope of AKSI Milestone 1 (MVP). This is the
implementation contract — features not listed here are not part of
Milestone 1, regardless of how much of them already exists in code.

Built from `docs/product/{vision,principles,domain,roadmap}.md`,
`docs/current/*`, and `docs/engineering/*`. Nothing here is invented;
where the source documents left something ambiguous, it's marked as an
Open Question below rather than decided unilaterally.

---

## Goal

Let an existing club take a group of players from "we have a session
scheduled" to "we played and recorded a tennis match" entirely through
their own phones — organizing the session, checking in, playing, and
scoring a live match together — without any player ever sharing a
device or the club needing anything outside the app to run a session.

---

## Target User

**Is**: a member of an existing (or newly created) informal tennis
club — a group of friends, a workplace group, a community club — who
wants to organize sessions and score matches on their own devices
instead of a single shared phone or a paper scoresheet.

**Is NOT**:
- A solo player with no club — there is no personal/club-less play by
  design (`docs/product/domain.md`: "no personal or automatically
  created clubs").
- A tournament organizer — no bracket/ranking tooling exists or is
  planned for Milestone 1.
- A Padel or other non-tennis player — only Tennis is implemented
  (`docs/product/roadmap.md` Phase 5).
- An anonymous, no-signup scorer — that's the existing, separate,
  frozen web product (`ScoringFlow`/`poin-yuk.vercel.app`), not this
  milestone.

---

## Success Criteria

What a user must be able to do, end to end, on a real device:

- Create an account (username + password).
- Create a club, or join one with an invite code.
- View the club's sessions.
- Check in to a session.
- Be added as a participant to a match by the session's
  owner/admin (there is no self-service "join a match" — matches are
  created with their participants already chosen; see Open Questions).
- Start a match they're a checked-in participant of.
- Score the match (singles or doubles, any supported format).
- Finish the match (automatically, by format rule, or manually).
- See the result immediately after the match ends.

Deliberately excluded from this list even though the words appear
elsewhere in product docs: **match history** and **player statistics**
(`docs/product/roadmap.md`'s "Initial Problems We Solve" names both as
problems the overall product/Version 1 solves, but `domain.md`
explicitly states "Statistics: Not part of MVP," and history is its
own later phase — see Out of Scope).

---

## In Scope

### Authentication

Firebase Auth, username + password only (synthetic email under the
hood). Sign up, log in, session persists across app restart.

### Clubs

Create a club, join by invite code. Owner can update/delete the club,
regenerate the invite code, add members by username, promote/demote
member ↔ admin, remove members. Roles: Owner / Admin / Member,
enforced server-side. No personal or auto-created clubs.

### Sessions

Owner/admin creates a session (sport, name, location, court count).
Members view/list sessions in their club. Members self-register and
self check-in. Owner/admin can add a walk-in guest (no account)
directly as checked-in.

### Activities

Owner/admin creates a match ("Activity") by picking participants from
the checked-in list and a tennis format/deuce configuration — it
starts `queued`. Any checked-in participant of that specific match can
start it, which makes them the scorer. Only the current scorer can
mark it complete.

### Matches

Full tennis rules: singles and doubles, all four match formats (open,
fixed-games, race-to, best-of-sets with optional super-tiebreak), both
deuce modes (standard, single-deuce sudden death), tiebreak at 6-6,
server rotation, undo.

### Live Scoring

Tap-to-score interface, voice announcements of score after each point
and at match end, native share of the result.

### Realtime

Live score sync via Firebase Realtime Database while a match is in
progress, for devices holding the session's join code. **As currently
implemented, this only reaches the scorer's own device** — see the gap
noted in Open Questions before treating "realtime" as meaning
multi-device spectating on mobile.

### Player Profile

Username and display name, established at sign-up, used to identify
people throughout the app (participant lists, "(You)" labeling). No
dedicated profile screen — this is data, not a UI surface, in
Milestone 1.

### Settings

Language (English / Bahasa Indonesia) exists as a component. Not
currently reachable from anywhere in the club/session/activity
navigation — see Open Questions.

---

## Out of Scope

- Visitor mode / unauthenticated preview (`docs/product/principles.md`:
  explicit future milestone, "auth remains mandatory in Phase 1").
- Today / Play / Me tab navigation (`docs/product/navigation.md` is a
  target, already clarified elsewhere as "the long-term destination
  rather than an immediate migration," not Milestone 1).
- Cross-club feed of any kind.
- Match/session history browsing (`docs/product/roadmap.md` Phase 4 —
  not started).
- Statistics, rankings, leaderboards, achievements.
- Notifications.
- Payments, reservations.
- Tournament brackets/management, automatic player rotation.
- Match timer, match duration tracking.
- Multi-sport beyond Tennis (Padel is Phase 5).
- Public club directory / club discovery.
- AI features (not mentioned anywhere in product or engineering docs).
- Club ownership transfer (explicitly deferred to a future
  permissions/admin system).
- Scorer transfer mid-match (explicitly called an upcoming feature,
  not current scope — see Open Questions for the related permissions question).

---

## Technical Requirements

- Mobile-first: Expo dev client. iOS verified on a physical device;
  **Android not yet verified on any device or emulator.**
- Firebase Auth for identity.
- Go + Gin backend, PostgreSQL for durable data, forward-only migrations.
- Firebase Realtime Database for live match sync.
- Expo / React Native / TypeScript throughout.
- **Offline tolerance: not currently met.** The Activity-based match
  flow (`ActivityMatchScreen`) has no local persistence — an app
  kill or crash mid-match loses all score progress (it isn't written
  to Postgres until `complete`, and isn't cached locally the way the
  legacy `ScoringFlow` is via `src/persistence.ts`). If offline
  tolerance is a hard Milestone 1 requirement, this is unbuilt work,
  not a minor gap.

---

## Release Checklist

- [ ] Firebase RTDB security rules — currently fully open to anyone
      holding a session code (`docs/current/firebase-security.md`,
      `ADR-001`). No rules are applied yet.
- [ ] **Decision needed**: is hardened scorer-permission enforcement
      required to ship Milestone 1, or can it ship with today's
      client-side-only convention? (See Open Questions.)
- [ ] Mobile spectator/watch flow for checked-in participants who
      aren't the scorer — currently there is no way to view a live
      match on mobile except as the scorer themselves.
- [ ] Offline/resume tolerance for in-progress matches (see Technical
      Requirements).
- [ ] Settings (language) reachable from the club/session navigation —
      currently orphaned inside the legacy, unreachable-on-mobile
      `ScoringFlow`.
- [ ] Android build verified on a physical device.
- [ ] Backend deployed somewhere reachable outside a private dev VM.
- [ ] Mobile distribution mechanism decided (EAS build + TestFlight /
      Play Console, vs. continuing manual on-device builds).
- [ ] Regression pass confirming full tennis feature parity (all
      formats, both deuce modes, singles + doubles, undo, voice
      announcements) on the Activity-based flow specifically, not just
      the legacy flow it was ported from.
- [ ] All product decisions in this document confirmed by product
      review, not just engineering read of existing docs.

---

## Definition of Done

Milestone 1 is done when every item in Success Criteria works
end-to-end on a real device without developer intervention (no manual
database edits, no directly-invoked API calls), the Release Checklist
is fully checked, and the Out of Scope list has been explicitly
confirmed rather than assumed.

---

## Open Questions

Surfacing rather than guessing, per instructions:

1. **Is scorer-permission enforcement (RTDB rules) required for
   Milestone 1?** `docs/product/roadmap.md` Phase 3 lists "Scorer
   permissions" alongside "Move Tennis scoring into Sport Engine" as
   one phase — but a separate instruction called scorer *transfer*
   "an upcoming feature, not a bug," which reads as deferred. It's not
   clear whether permission *enforcement* (distinct from *transfer*)
   is meant to ship with Milestone 1 or move with transfer into a
   later milestone.
2. **Is mobile spectator viewing of a live match in scope?**
   `docs/product/domain.md`'s Member role explicitly lists "Watch live
   score" as a permission, and it's technically live in RTDB — but no
   screen currently exposes it on mobile (only the scorer's own device
   shows the live match). Not named as postponed anywhere, but also
   never explicitly scoped as Milestone 1 work.
3. **Does Milestone 1 require Android**, or is an iOS-only first
   release acceptable given "mobile-first" doesn't specify which
   platform first?
4. **Is a minimal Settings entry point (at least language switching)
   required in Milestone 1's navigation**, or is defaulting to English
   with no in-app way to switch acceptable until the target Me tab
   exists?
