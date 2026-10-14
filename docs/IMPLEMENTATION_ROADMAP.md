# Implementation Roadmap — Single Source of Truth

This is the **only** place to check what's actually been built vs. what
hasn't. It supersedes `docs/current/ARCHITECTURE_GAP_ANALYSIS.md`
(deleted — its Milestone definitions were absorbed here; it was always
a temporary planning doc by its own header, meant to be retired once
superseded).

**Keep this updated whenever a milestone's status changes.** Reverse-
engineered from what's actually shipped, never aspirational. If you
ship something that changes a status below, update this file in the
same commit.

For *why* something was built a certain way, see
`docs/AKSI_PRODUCT_DECISIONS.md` (`# Ready to Develop` = approved and
built; `# Planning` = not approved, not built). This file tracks the
UI/IA-shaped **Milestone** roadmap specifically — a different axis from
the DP-numbered product decisions, though they're cross-referenced
below.

Status legend: ✅ Done · 🚧 Partial · ⏳ Not Started

---

## Status at a glance

| # | Milestone | Status |
|---|---|---|
| 1 | Personal Context Shell | ✅ Done |
| 2 | Session Experience (lifecycle-driven) | ✅ Done |
| 3 | Community Home ("Current Focus") | ✅ Done |
| 4 | Organizer Experience | 🚧 Partial |
| 5 | Session Finance | ✅ Done |
| 6 | Communication Foundation | 🚧 Partial |

---

## Milestone 1 — Personal Context Shell

**Status: ✅ Done** — `2dc15cc`

Personal navigation (Home / Explore / Inbox / Me tabs) replacing
`ClubListScreen`-as-root. Home is "My Communities" + a cross-Club
"Attention" section. Explore and Inbox shipped as placeholders
(deliberate — real behavior for both is still `# Planning`).

## Milestone 2 — Session Experience (lifecycle-driven)

**Status: ✅ Done** — `538a4f0`, `e20589b`, `28fbb10`

The Session's own cohesive lifecycle experience (Draft → Recruiting →
Ready → Live → Completed), server-derived per DP-ARCH-003. Grew well
beyond the original scope across follow-up passes in the same
milestone track:

- Session tabs: Details, Configuration, Participants, Matches, Chat,
  Payment (the last two landed later, see Milestones 5–6 below).
- DP-005 Match Generation, including a later fairness revision
  (waiting-time tiebreak, wider eligible pool — see
  `AKSI_PRODUCT_DECISIONS.md` DP-005).
- DP-010 Session Pricing (Free / Per Person / Split Bill).
- Self-service Session editing (`EditSession`, reuses
  `CreateSessionScreen`).

## Milestone 3 — Community Home ("Current Focus")

**Status: ✅ Done** — `79604d2`

`ClubDetailScreen` replaced its static info layout with a ranked
Current Focus list (Live → Today → Next → Draft Sessions). Kept as one
enriched screen rather than a Home/Sessions/Communication tab bar
inside Community context — the original roadmap left that navigation
shape as an implementation choice.

## Milestone 4 — Organizer Experience

**Status: 🚧 Partial** — `843edf9`

Original scope: Draft → Publish → Prepare → Live Session → Complete
Session as one cohesive organizer workflow.

- **Draft Recovery** (UX-005) — ✅ done. A non-intrusive callout on
  `SessionListScreen` nudging the organizer to continue an unfinished
  Draft before creating a new one.
- **Live Session** consolidation — ✅ effectively already satisfied by
  Milestone 2's own work (Matches tab + fairness engine); no separate
  build was needed.
- **Complete** — ✅ already existed (DP-009 auto-transition), nothing
  new required.
- **Prepare** (a pre-session readiness checklist) — ⏳ **explicitly
  skipped**, not deferred by accident. It has zero definition anywhere
  in the Foundation Docs (`AKSI_UX_PRINCIPLES.md`,
  `AKSI_INFORMATION_ARCHITECTURE.md`) beyond being named as a roadmap
  step — asked the product owner what it should contain, answer was to
  skip it rather than invent a screen with no clear need.

## Milestone 5 — Session Finance

**Status: ✅ Done** — `7e5ddd3` (DP-012)

Surfaces DP-002's manual payment-confirm step as its own Payment tab.
Club bank accounts (a Club can list more than one), self-service
receipt upload, and a payment-status list visible to every member —
receipt **images** restricted server-side to the uploader + owner/admin
only. Confirm Payment moved off the Participants tab onto this tab.

## Milestone 6 — Communication Foundation

**Status: 🚧 Partial** — `4410684` (DP-011)

Original roadmap phase order: Contact Organizer → Session Communication
→ Community Communication → Direct Messages, each independently
shippable, "phased by risk."

- **Session Communication (Session Chat)** — ✅ done, DP-011. Built
  *ahead of* Contact Organizer in the original phase order — an
  explicit choice made when scoping this milestone with the product
  owner, not an oversight. Plain text + one optional image per
  message, posting closes 1 week after the Session ends, history stays
  readable forever.
- **Contact Organizer** — ✅ done, DP-013. A private, two-way,
  Session-scoped thread between one member and that Session's
  owner/admins — revised to share Session Chat's messaging engine (text
  + optional image, identical mechanics); the only real differences are
  participants and that Contact Organizer has **no posting-window
  restriction** (a thread never closes, unlike Chat's 1-week-after
  cutoff). Gave the Inbox tab its first real content (a placeholder
  since Milestone 1): every thread the caller is a party to, member or
  organizer side, most-recently-active first.
- **Community Communication** (Club-level chat) — ⏳ not started. Still
  `# Planning`. Explicitly distinct from Contact Organizer, which stays
  Session-scoped only — confirmed when scoping this milestone.
- **Direct Messages** (User↔User) — ⏳ not started. Still `# Planning`,
  and the largest remaining scope (moderation, blocking/reporting,
  discoverability). Also covers member↔member and member↔admin
  messaging generalized beyond one Session — Contact Organizer doesn't
  substitute for it.

---

## Shipped, but not tied to a Milestone number

Real, live work that fell outside the six-milestone roadmap above:

- **Club Members redesign** — `b68145f`. 4-column avatar grid, search,
  Add Member dialog backed by a new `GET /v1/users/search` endpoint.
- **Deployment infrastructure** — `c83efc1`. Production/staging on a
  single VPS (systemd + Caddy + GitHub Actions), fully separate
  environments and databases.
- **"Join with Code" removed** — part of `7e5ddd3`. Deliberate removal
  (screen, routes, invite-code display/regenerate UI). The gap it left —
  no self-service way to join — is closed by DP-017 below.
- **Player profile & direct messages (DP-019, DP-020)** — organizers
  open a profile from Session participants and Community join requests:
  picture, name, level per sport, approve/decline, and a Chat button for
  one-to-one messages (listed in Inbox). Each sport opens a page with the
  player's history across every Community; players open their own from
  the Me tab.
- **Messaging upgrades (DP-021) — built (steps 1–3).** A live
  connection (WebSocket, `/v1/live`) delivers new messages, typing, read
  receipts and new notifications at once; screens fall back to polling
  every 5 seconds while it is down (30 seconds while it is up). Unread
  counts per conversation in Inbox, a total on the Inbox tab, a count on
  a Session's Chat tab; "Seen" / "Seen by N" under your latest message;
  "… is typing". New direct and Contact Organizer messages push to
  participants who don't have Aksi open. Step 2: block or report from a
  profile or a direct conversation, report a message by long-pressing it;
  Settings › Blocked players undoes a block; a Community's owner/admins
  see its reports (callout and Reports button on the Community page) and
  can remove a reported Session message or dismiss the report. Editing
  and deleting messages, WhatsApp-style (v0.21.0 amendment). Step 3:
  a compose icon in Inbox starts a chat — one person is a private chat,
  two or more an unnamed group (up to 50; the creator may name it, adds
  and removes; anyone leaves) — all chats on one shared screen and one chat per
  Community (Community chat button with unread count on the Community
  page; owner/admins remove any message and turn it off). The live connection
  lives in one server process; running more than one API process needs a
  shared broker first (see `docs/current/api.md`).
- **Push notifications (DP-018) — steps 1 and 2 of 3 built.** Built:
  device registration in the browser (Web Push, `public/sw.js`), the
  server's notification service (Web Push + Expo delivery), the bell and
  Notifications page, the permission offer after joining a Community or
  asking to join a Session, all seven events (Community join request and
  approval, Session join request and approval, payment receipt and
  confirmation, a reminder two hours before a Session) and a switch per
  kind in Settings. Not yet: the installable web app that enables iPhone
  browsers (step 3), and push on the phone apps, which waits on
  expo-notifications and the Expo/Apple/Firebase setup.
- **Security hardening** — per-IP rate limits on the routes callable
  without signing in (username check, email login lookup, password
  reset), and the DP-015 email gate enforced by the server, not only the
  app. See `docs/current/api.md`. In production, `CLIENT_IP_HEADER` must
  be set (see `docs/engineering/deployment.md`) or every visitor shares
  one limit.
- **Community discovery & joining (DP-017)** — Communities are Public
  (join instantly) or Private (join by request, approved by an
  owner/admin). Each has a location, and a User keeps several towns with
  one active; both
  are picked from a list of Indonesia's 38 provinces and 514 cities/
  regencies kept in the database (migration `0027`), never typed.
  Communities are found through search in Explore (name, city or
  province; results show the location), through Explore's list of
  Communities in the User's own town, or through a shareable link. Search
  results and links open a preview for non-members. Owner/admins approve
  or decline requests on the Members screen.
- **Display name (DP-016)** — set, change or remove it from the Me tab's
  Account section; shown everywhere a person appears, username as the
  fallback.
- **Online Indicator (DP-014)** — a User attribute derived from recent
  request activity (no push/websocket presence infra exists), shown as
  a green outline ring on member circle avatars (Club Members grid,
  detail sheet, Add Member search).

---

## Explicitly not implemented (quick reference)

Everything below is real `# Planning` in `AKSI_PRODUCT_DECISIONS.md` —
not approved, not built, don't build it without an explicit decision
first:

- **Communication**: Community-level chat; blocking/reporting for Direct
  Messages (Session Chat, Contact Organizer and Direct Messages exist).
- **Payments**: an actual payment gateway, Membership fees, Guest fees,
  Refunds (only manual payment-confirm + informational Pricing exist).
- **Scheduler Evolution**: partner diversity, opponent diversity, skill
  balancing, court optimization (match-count balance and waiting-time
  fairness are both done).
- **Organizer Dashboard**: live participant status, court overview,
  waiting queue, Session health.
- **Player Preferences**: preferred opponent/partner skill level,
  competitive-vs-casual preference, coaching preference.
- **Attendance**: attendance history, no-show tracking, reliability
  scoring.
- **Court Management**: court assignment, booking, availability.
- **Map-Based Venue Selection**: Venue is still free text; blocked on
  provisioning a map provider API key.
- **Prepare** (Milestone 4) — see above, explicitly skipped pending a
  clearer product need.
