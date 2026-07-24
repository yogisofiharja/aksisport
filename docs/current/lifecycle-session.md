# Session Lifecycle (Current)

Two separate state machines exist under "session": the session itself,
and each participant's status within it. `prd.md` describes a target
that doesn't fully match what's implemented — differences are called
out below.

## Session status

Column: `sessions.status`, `CHECK IN ('open','in_progress','completed')`,
default `'open'`.

```
open  ⇄  in_progress  ⇄  completed
```

All three are reachable from each other — there is **no enforced
transition order**. The only way status changes is an explicit
`PATCH /v1/sessions/:id { status }` by the session's club owner/admin
(`UpdateSession` in `server/internal/db/sessions.go`). **Nothing in the
codebase changes session status automatically** — starting an
activity, completing a match, or checking players in has no effect on
`sessions.status`. No mobile screen currently exposes a control to
change it either (`SessionDetailScreen` never calls `updateSession`).

## Session participant status

Column: `session_participants.status`,
`CHECK IN ('registered','checked_in','participated')`, default
`'registered'`.

```
registered → checked_in → participated   (per prd.md's target)

registered → checked_in                   (as actually implemented)
```

- `RegisterParticipant` (`POST /v1/sessions/:id/register`) inserts with
  `status='registered'` if no row exists; no-op if one already does
  (`ON CONFLICT ... DO NOTHING`).
- `CheckIn` (`POST /v1/sessions/:id/checkin`) upserts to
  `status='checked_in', checked_in_at=now()` — auto-registers first if
  the caller had no row at all (one tap covers both steps).
- `AddGuestParticipant` (owner/admin action) inserts a guest directly
  at `status='checked_in'` — guests skip `'registered'` entirely.
- **`'participated'` is declared in the DB `CHECK` constraint and in
  the TypeScript type (`ParticipantStatus` in `src/core/api/types.ts`)
  but no code path ever sets it.** There is no "mark as participated"
  endpoint, and completing an activity does not update
  `session_participants.status` for anyone in it. As implemented, a
  participant's status is permanently either `registered` or
  `checked_in`.

## Mobile UI reflection

`SessionDetailScreen.tsx` shows a single "Check In" button when
`myParticipant?.status !== 'checked_in'`, and a static "Checked in"
badge otherwise — it has no concept of `'participated'`.
