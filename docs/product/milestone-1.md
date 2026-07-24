# Milestone 1

Defines the exact scope of AKSI Milestone 1 (MVP). This is the
implementation contract — features not listed here are not part of
Milestone 1, regardless of how much of them already exists in code.

Built from `docs/product/{vision,principles,domain,roadmap}.md`,
`docs/current/*`, and `docs/engineering/*`. Nothing here is invented.
Ambiguities found while writing the first revision were surfaced
rather than decided unilaterally, then resolved by product review —
see "Resolved Decisions" at the end.

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
  created with their participants already chosen).
- Start a match they're a checked-in participant of.
- Score the match (singles or doubles, any supported format).
- Watch a live match in progress as a checked-in participant who
  isn't the scorer (read-only — see Live Match Viewer below).
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
progress.

**Live Match Viewer (required for Milestone 1)**: a checked-in
participant who is not the assigned scorer must be able to open the
session, open the in-progress activity, and watch the score update in
real time. Read-only — only the assigned scorer may modify the score.
This does not exist yet (`docs/current/navigation.md`,
`SessionDetailScreen` currently has no action for a `live` activity)
and is treated as a missing MVP feature, not a future enhancement.

Security hardening of who is *allowed* to write to a live match
(RTDB rules) is explicitly **not** part of this — see Technical
Requirements and `docs/current/firebase-security.md`/`ADR-001`.

### Player Profile

Username and display name, established at sign-up, used to identify
people throughout the app (participant lists, "(You)" labeling). No
dedicated profile screen — this is data, not a UI surface, in
Milestone 1.

### Settings

Exactly three controls, reachable from the club/session/activity
navigation (currently not reachable from anywhere in it — see Release
Checklist):

- Theme
- Language (English / Bahasa Indonesia)
- Logout

Nothing else. Any other preference (notifications, voice/announcement
settings, etc.) is out of scope for Milestone 1 regardless of whether
it already exists as a component elsewhere (e.g. the legacy
`SettingsModal`'s TTS voice picker).

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
  not current scope).
- Firebase RTDB security hardening (rules requiring scorer
  authorization to write). Current fully-open realtime access is
  sufficient for Milestone 1. Deferred to Milestone 2, after the
  scoring-device authentication design (`ADR-001`) is implemented —
  see `docs/current/firebase-security.md`.
- Offline/resume recovery for in-progress matches. Milestone 1 assumes
  an active network connection while scoring — see Technical
  Requirements.

---

## Technical Requirements

- Mobile-first: Expo dev client, **both iOS and Android required.**
  iOS is verified on a physical device; Android is not yet verified on
  any device or emulator — iOS-only is not sufficient to call
  Milestone 1 complete.
- Firebase Auth for identity.
- Go + Gin backend, PostgreSQL for durable data, forward-only migrations.
- Firebase Realtime Database for live match sync. **No security rules
  required for Milestone 1** — current fully-open access is accepted
  as sufficient; hardening is Milestone 2 (`ADR-001`).
- Expo / React Native / TypeScript throughout.
- **No offline tolerance requirement.** Milestone 1 assumes an active
  network connection for the duration of scoring a match. The
  Activity-based match flow (`ActivityMatchScreen`) has no local
  persistence today — an app kill or network loss mid-match loses
  score progress (nothing is written to Postgres until `complete`).
  This is an accepted MVP limitation, not a gap to close now. Mitigate
  with a warning, not a fix — see Release Checklist. Full offline/resume
  recovery moves to Milestone 2.

---

## Release Checklist

- [ ] Build the Live Match Viewer: from a session, open a `live`
      activity as a checked-in non-scorer participant and watch score
      updates in real time, read-only. (`SessionDetailScreen`
      currently has no action at all for a `live` activity.)
- [ ] Add a warning before leaving an in-progress scoring screen,
      informing the scorer that progress may be interrupted without a
      network connection. (Offline/resume recovery itself is out of
      scope — Milestone 2.)
- [ ] Build a Settings screen with exactly Theme, Language, Logout,
      reachable from the club/session/activity navigation.
- [ ] Android build verified on a physical device or emulator —
      required, not optional, for Milestone 1.
- [ ] Backend deployed somewhere reachable outside a private dev VM.
- [ ] Mobile distribution mechanism decided (EAS build + TestFlight /
      Play Console, vs. continuing manual on-device builds).
- [ ] Regression pass confirming full tennis feature parity (all
      formats, both deuce modes, singles + doubles, undo, voice
      announcements) on the Activity-based flow specifically, not just
      the legacy flow it was ported from.
- [ ] All product decisions in this document confirmed by product
      review, not just engineering read of existing docs.

Explicitly **not** on this checklist, by decision (see Resolved
Decisions): Firebase RTDB security rules, offline/resume recovery.

---

## Definition of Done

Milestone 1 is done when every item in Success Criteria works
end-to-end on a real device without developer intervention (no manual
database edits, no directly-invoked API calls), the Release Checklist
is fully checked, and the Out of Scope list has been explicitly
confirmed rather than assumed.

---

## Resolved Decisions

The four open questions from the previous revision of this document,
and the two implementation gaps found while writing it, were resolved
by product review as follows. Recorded here for traceability; the
resolutions are already reflected in the sections above.

1. **RTDB security** — not required for Milestone 1. Current
   fully-open realtime access is sufficient. Hardening moves to
   Milestone 2, after the scoring-device authentication design
   (`ADR-001`) is implemented.
2. **Mobile spectator view** — required for Milestone 1. A checked-in
   participant must be able to open an activity, open a live match,
   and watch the score update in real time. Only the assigned scorer
   may modify it.
3. **Android** — required. Milestone 1 targets both iOS and Android;
   iOS-only is not sufficient.
4. **Settings** — scoped to exactly Theme, Language, Logout. Nothing else.
5. **Live Match Viewer** (implementation gap) — treated as a missing
   MVP feature, added to Milestone 1 (see Success Criteria, Realtime,
   Release Checklist).
6. **Offline/resume** (implementation gap) — not a Milestone 1
   requirement. MVP assumes an active network connection while
   scoring. A warning before leaving an in-progress scoring screen is
   the Milestone 1 mitigation; full offline/resume recovery moves to
   Milestone 2.
