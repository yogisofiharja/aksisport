# Activity Lifecycle (Current)

Column: `activities.status`, `CHECK IN ('queued','live','completed')`,
default `'queued'`.

```
queued → live → completed
```

Strictly linear, one direction, no skipping — enforced by SQL `WHERE
status = '<expected>'` on every transition (see below), not just
application-level checks.

## queued (creation)

`POST /v1/sessions/:id/activities` (owner/admin only, see
`permissions.md`). Inserts one `activities` row (`status` defaults to
`queued`) and one `activity_participants` row per entry in the request
body, all in a single transaction (`CreateActivity` in
`server/internal/db/activities.go`). `config` is stored as opaque
`JSONB` — the server never parses or validates its shape; it's built
and read entirely client-side by
`src/sports/tennis/scoringEngine.ts`/`AddMatchScreen.tsx`.

**Generation from checked-in players** (v0.8.0, DP-005 Match Generation):
there is no dedicated generation endpoint — `AddMatchScreen`'s Generate
Match/Generate Matches tabs compute fair pairings client-side
(`core/sessions/matchGenerator.ts`, fewest-played-first) from
already-fetched checked-in participants and activities, then call the
same `POST /v1/sessions/:id/activities` once per match (looped
sequentially for "Generate Matches," to keep queue order matching the
previewed order). `DELETE /v1/activities/:id` (queued-only) now exists,
added specifically for the Regenerate flow — see `api.md`.

**Still not implemented**: editing a queued activity's participants/config
in place (no `PATCH /v1/activities/:id`), `queue_position` is never
written despite the column existing.

## queued → live (start)

`POST /v1/activities/:id/start`. Requires the caller to be a
checked-in participant of *this* activity, **or** owner/admin of the
parent club (see `permissions.md`) — an owner/admin can start any
queued match administratively, becoming its scorer even if they're not
one of its players.

Before either check, the handler requires the parent Session's own
`status` be `in_progress` — 409 otherwise. Matches can be generated
(and sit `queued`) ahead of the Session actually starting (e.g. right
after Publish, well before `starts_at`), but none of them can be
*started* until the Session itself has, via DP-009's auto-start.
`SessionDetailScreen`'s `canStart` mirrors this client-side
(`session?.status === 'in_progress'`) so the Start button doesn't even
render on a not-yet-started Session's queued matches.

`StartActivity`: `UPDATE activities SET status='live',
scorer_user_id=$caller, started_at=now() WHERE id=$1 AND
status='queued'`. If the `WHERE` matches zero rows, the handler
disambiguates: activity genuinely not found → 404, activity exists but
isn't `queued` → 409. This means **the first eligible person to
successfully call `/start` becomes the scorer** — there's no separate
"assign scorer" step, and no explicit conflict handling beyond the
race being resolved by whichever request's `UPDATE` commits first.

On the client, `ActivityMatchScreen` calls `getActivity` first; if
status is already `queued`, it calls `/start` and treats a 409 as
"someone else already started it, join anyway" (catches
`ApiRequestError` with `status === 409` and proceeds without
surfacing an error).

## live (in progress)

Score updates during this phase go through Firebase RTDB
(`src/sessionSync.ts`), **not** the Postgres API — `activities.config`,
`result`, `point_log` are not touched again until completion. See
`lifecycle-match.md` for what happens client-side during this phase,
and `permissions.md` for the (currently unenforced) live-sync access
model.

There is no scorer-transfer endpoint. Whoever started the activity
remains `scorer_user_id` until it completes; if their device is lost
mid-match there's no way to hand off through the API.

## live → completed (complete)

`POST /v1/activities/:id/complete`, caller must equal
`scorer_user_id` exactly. `CompleteActivity`: `UPDATE activities SET
status='completed', result=$body.result, point_log=COALESCE($body.pointLog,
point_log), completed_at=now() WHERE id=$1 AND status='live'` — same
404-vs-409 disambiguation as start. `result` is required in the
request body (400 if empty); `pointLog` is optional and, if omitted,
leaves the column at its default `'[]'`.

`ActivityMatchScreen` calls this once, from `finalizeActivity`, guarded
by a `completedRef` so it can't fire twice for the same screen
instance. On failure it only `console.error`s — there is no retry and
no user-facing error if the complete call fails after the match has
already ended locally.

**Not implemented**: no automatic top-up/regeneration of the next
queued activity on completion (mentioned in earlier planning, no code
exists for it).

## completed (terminal)

No further transitions. `GET /v1/sessions/:id/activities` and `GET
/v1/activities/:id` still return completed activities (ordered after
`live`/`queued` in the list endpoint), but there is no dedicated
history view — see `docs/current/api.md`'s note that no
`GET /v1/activities?userId=&clubId=&sport=` filter endpoint exists.
