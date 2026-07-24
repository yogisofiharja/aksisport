# Firebase Realtime Database Security (Current + Proposal)

**Status: proposal only. Nothing in this document has been implemented.**
See `docs/current/permissions.md` for how this was first flagged.

## Current state

No `database.rules.json` (or equivalent) exists anywhere in this
repository, and no `firebase.json` either — RTDB rules for this
project, whatever they are, live only in the Firebase console and
aren't version-controlled or reviewable here.

What the client code implies about the effective rules: `src/sessionSync.ts`
reads and writes `sessions/{code}` with no ID token, no per-user check,
and no server-side mediation — `pushSessionState`/`subscribeToSession`
just call `set`/`onValue` on a path built from the 5-character code
alone (`src/sessionSync.ts`, `generateSessionCode`). For this to have
worked in testing throughout this migration (live score sync between
devices), the actual configured rules must currently allow open
read/write on `sessions/{code}` to anyone who has the code — codes
being the only "secret." This is inferred from observed behavior, not
read directly from the Firebase console (out of this repo's reach) —
worth confirming against the console directly before treating it as
fact.

## Why this matters

Per `docs/product/domain.md`'s Scoring Permission rules: "Only one
scorer can edit the score. Everyone else has read-only access." This
is currently a **client-side convention only** —
`ActivityMatchScreen` includes a `scorerUid` field in what it pushes,
but nothing rejects a write from a non-scorer client. Anyone who
obtains a session code (e.g. by guessing one of the ~40 billion
5-character combinations, or more realistically by a QR code being
shared beyond its intended audience) can currently overwrite live
match state for that session.

## Complication: web and mobile share this database differently

This is the main reason to review before implementing, not just ship
a rule:

- **Mobile** (`ActivityMatchScreen`) — user is always signed in via
  Firebase Auth (mandatory before reaching any screen that scores a
  match, see `docs/current/navigation.md`). `auth.uid` is reliably
  available.
- **Web** (`ScoringFlow` via `App.tsx`) — **no sign-in exists at all**.
  `src/firebase.ts` initializes `auth` from the same app instance, but
  nothing on web ever calls `signIn`/`signUp` — web users are always
  anonymous/unauthenticated as far as Firebase Auth is concerned. Web
  is explicitly frozen/untouched by this migration (see
  `docs/current/architecture.md`).

Both currently write to the same `sessions/{code}` path shape via the
same `SessionPayload` type (`activityId`/`scorerUid` are optional
precisely so both flows can share it — see
`docs/current/state-machines.md`). **A rule that requires
`auth != null` to write would silently break web's live-sync/share
feature entirely**, since no web request will ever carry a Firebase
ID token.

## Proposed ruleset (for review — do not apply yet)

```json
{
  "rules": {
    "sessions": {
      "$code": {
        ".read": true,
        ".write": "auth == null || !data.exists() || data.child('scorerUid').val() === auth.uid || !data.child('scorerUid').exists()"
      }
    }
  }
}
```

Mechanism: read stays open (spectators/QR viewers never sign in
either, on either platform). Write is allowed if:
- unauthenticated (web — no `scorerUid` enforcement possible or
  attempted for that path), **or**
- the node doesn't exist yet (first write, whoever creates the
  session), **or**
- the existing node has no `scorerUid` (payloads without it — legacy
  `ScoringFlow` sessions on mobile, if any old clients remain), **or**
- the caller's `auth.uid` matches the stored `scorerUid`.

This closes the gap for `ActivityMatchScreen` sessions specifically
(the only flow that actually sets `scorerUid` and has a signed-in
user) without breaking web. It is **not** a strong guarantee — a
malicious signed-in mobile user could still write to a session they
were never a participant of, as long as they know the code and no
scorer has claimed it yet (`data.exists()` false or no `scorerUid`
set). Closing that gap fully would require the write to check the
caller is an actual participant of the corresponding Activity, which
RTDB rules can't verify against Postgres — would need either (a) the
Go backend to mint a scoped custom token on `/start`, or (b) moving
live sync off RTDB entirely (see `docs/archive/prd.md`'s deferred "self-hosted
replacement" idea, out of scope here).

## Options for review, not a decision made here

1. **Ship the rule above as-is** — meaningfully better than today (an
   idle/unclaimed session or any web session is still open, but an
   actively-scored mobile Activity session is protected once claimed).
2. **Wait and design a stronger mechanism** (custom token minted on
   `/start`, scoped to that specific `activityId`) before touching
   rules at all — more correct, more work, blocks on backend changes.
3. **Split the RTDB path** by flow (e.g. `activities/{activityId}`
   for mobile, keep `sessions/{code}` for legacy/web) so mobile can
   get a strict `auth.uid`-only rule with zero risk to web — cleanest
   long-term separation, but is a client-side change to
   `sessionSync.ts` and every caller, not just a rules file.

No action taken pending a decision on which of these (or something
else) to pursue.
