# ADR-001: Scoring Device Authentication

## Status

**Target** — not implemented. This ADR records a decision about the
long-term direction; it does not describe current behavior and does
not authorize any code change. See "Current Implementation" below for
what actually exists today, and `docs/current/firebase-security.md`
for the fuller current-state writeup and the interim options this ADR
supersedes with a chosen direction.

## Context

Live match scoring syncs through Firebase Realtime Database
(`sessions/{code}`, see `docs/current/architecture.md` and
`docs/current/state-machines.md`). Two independent flows write to the
same path shape:

- **Mobile** (`ActivityMatchScreen`) — the user is always signed in
  via Firebase Authentication before reaching this screen
  (`docs/current/navigation.md`'s `AuthStack` gate). `auth.uid` is
  always available.
- **Web** (`ScoringFlow`) — intentionally has no sign-in at all. This
  is deliberate, not an oversight: web is frozen/untouched by the Aksi
  migration (`docs/current/architecture.md`), and its whole value
  proposition is zero-friction scoring — open the page, get a code,
  start scoring, no account needed.

Both flows currently write to `sessions/{code}` with no server-side
enforcement of who's allowed to write (`docs/current/firebase-security.md`).
That document proposed a stopgap `scorerUid`-based rule keyed on
`auth.uid`, but flagged that any rule requiring `auth != null` would
break web outright, since web requests never carry a Firebase ID
token.

## Decision

Stop modeling this as "authenticated user vs. anonymous user." Model
it instead as: **every device that is actively scoring a match holds a
temporary scoring credential, whether or not it's signed into a full
Aksi account.**

Concretely, the target mechanism:

1. **The web scorer is a temporary scoring device, not an anonymous
   user.** It doesn't need — and should never be pushed toward
   needing — a real account just to keep scoring working. The
   credential it holds is scoped to *one match*, not to an identity.
2. **The backend issues a temporary scoring token** (or equivalent
   mechanism — e.g. a Firebase custom token minted with narrow custom
   claims, short expiry, scoped to a specific session code / activity
   id) at the point scoring begins:
   - Mobile: issued when `POST /v1/activities/:id/start` succeeds
     (the caller is already a verified checked-in participant at that
     point — the token is a natural byproduct of that check, not a
     new authorization decision).
   - Web: issued by an equivalent "create a scoring session" call that
     doesn't require a Postgres profile or Firebase account at all —
     preserving today's zero-friction entry point.
3. **Firebase Security Rules validate that token**, not permanent
   user identity — e.g. `auth.token.sessionCode ===
   $code`/`auth.token.activityId === $id` instead of comparing against
   a stored `scorerUid`. A device holding a valid, unexpired token for
   *this* session can write to it; nothing else can, regardless of
   whether it's "logged in" in the Aksi-account sense.
4. This directly closes the gap `docs/current/firebase-security.md`
   couldn't close with a `scorerUid`-only rule: today, any client that
   knows a session code and has *some* Firebase Auth session (any
   account) can claim an unclaimed session as scorer. A scoped token
   tied to a specific session/activity at issuance time removes that
   window entirely, for both platforms uniformly.

## Consequences

**Positive**

- Web keeps its frictionless, no-signup scoring experience — this was
  the non-negotiable constraint that made the simpler
  "`auth != null`" rule unworkable.
- Mobile and web converge on the *same* security mechanism instead of
  needing platform-specific rules or a split RTDB path
  (`docs/current/firebase-security.md`'s Option 3) — one rule, one
  mental model.
- The credential is scoped to exactly what it needs to authorize (one
  session/match), which is a tighter guarantee than "any signed-in
  user who got there first," the gap in the current `scorerUid`
  proposal.

**Negative / cost**

- Requires new backend work: a token-issuing endpoint (or extending
  `/start` and its web equivalent), token expiry/refresh handling for
  long matches, and a new RTDB rules shape built around custom claims
  instead of `auth.uid`.
- Firebase custom tokens (if that's the chosen mechanism) require the
  Admin SDK to mint — the backend currently deliberately avoids the
  Firebase Admin SDK (`docs/current/architecture.md`: ID-token
  verification only, no Admin SDK, no server-side Firebase
  credentials). This ADR's mechanism would be the first thing to
  require adding it.
- More moving parts than the `docs/current/firebase-security.md`
  stopgap rule — not something to build until it's prioritized.

## Alternatives considered

See `docs/current/firebase-security.md`'s three options for the fuller
comparison. This ADR selects a variant of its Option 2 (a stronger,
purpose-built mechanism) over Option 1 (ship the `scorerUid` rule
as-is — rejected as a permanent solution because it still requires
`auth != null` and therefore still excludes web) and Option 3 (split
RTDB paths by platform — rejected because it solves the access-control
problem by fragmenting the data model instead of by fixing the
credential model, and would still need *some* answer to "how does web
prove it's allowed to write" underneath it).

## Not decided here

- Exact token mechanism (Firebase custom token vs. a different
  short-lived credential scheme) — "or equivalent mechanism" is left
  open deliberately.
- Token lifetime / refresh behavior for matches longer than one token's TTL.
- Whether this replaces or coexists with the interim `scorerUid` rule
  proposed in `docs/current/firebase-security.md` as a stepping stone.
- Timeline — this is a target direction, not scheduled work.
