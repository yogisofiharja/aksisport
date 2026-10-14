# Firebase Realtime Database Security

**Status:** Aksi is moving to its own Firebase projects (`aksi-staging`,
`aksi-production`), whose Realtime Database rules are in the repository:
`deploy/firebase/database.rules.json` — only signed-in people can read a
live score, and only the match's scorer (the `scorerUid` in the payload)
can create, change or remove it. They are applied by hand when each
project is created (`docs/engineering/deployment.md`, "Firebase
projects"). Until an environment has moved, it still uses the shared
`poin-yuk` project described below, whose rules must stay open for the
retired standalone scorer. See `docs/current/permissions.md` for how this
was first flagged.

## The shared `poin-yuk` project

`poin-yuk`'s RTDB rules live only in the Firebase console and aren't
version-controlled or reviewable here (Aksi's own projects use
`deploy/firebase/database.rules.json` instead).

What the client code implies about the effective rules: live scores are
read and written at `sessions/{key}` with no ID token, no per-user check,
and no server-side mediation — this app's `src/sessionSync.ts` keys them
by Activity id; the retired standalone scorer (now only on the `scorer`
branch, served by Vercel) keys them by a 5-character session code. For this to have
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
- **The retired standalone scorer** (`scorer` branch, on Vercel) —
  **no sign-in exists at all**: its users are always unauthenticated as
  far as Firebase Auth is concerned. It is frozen and untouched.

Both write under the same `sessions/` path in the same Realtime
Database. **A rule that requires `auth != null` to write would silently
break the standalone scorer's live sync**, since none of its requests
carry a Firebase ID token.

## Earlier proposal for the shared `poin-yuk` project (not applied)

Superseded by giving Aksi its own projects; kept for the reasoning.

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
- unauthenticated (the standalone scorer — no `scorerUid` enforcement
  possible or attempted for that path), **or**
- the node doesn't exist yet (first write, whoever creates the
  session), **or**
- the existing node has no `scorerUid` (the standalone scorer's
  payloads), **or**
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
