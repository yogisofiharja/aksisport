# Activity Lifecycle (Current)

Column: `activities.status`, `CHECK IN ('queued','live','completed','unfinished')`
(`'unfinished'` since migration 0040), default `'queued'`.

```
queued → live → completed
              ↘ unfinished   (End match early, DP-025)
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

`POST /v1/activities/:id/start`. Only the Session's **umpire**
(`sessions.umpire_user_id`, DP-023) may start a match — 403 for anyone
else, including the match's own players and the Community's
owners/admins. The umpire is the Session's creator by default
(`CreateSession` sets it to `created_by`; migration 0039 backfilled
existing Sessions the same way); owners/admins hand it over with
`PUT /v1/sessions/:id/umpire` (see `api.md`).

Before that check, the handler requires matches to be open
(`db.MatchesOpen`, DP-022): the Session is `in_progress`, or it is
`open` and now is at or after `starts_at` minus
`MATCH_EARLY_START_MINUTES`. Starting one on an `open` Session moves the
Session to `in_progress`.

`StartActivity`: `UPDATE activities SET status='live',
scorer_user_id=$umpire, started_at=now() WHERE id=$1 AND
status='queued'`. Zero rows → 404 (no such activity) or 409 (not
`queued`).

In the app only the umpire sees Start on queued rows and a start action
in the bottom bar (`core/sessions/umpire.ts` `umpireStart`: "Start my
match" when their own match is next, otherwise "Start next match" once a
court is free). Everyone else opening a queued match sees the start
screen with the umpire's name and no Start; an owner/admin who isn't the
umpire gets **Make me umpire** there instead. `ActivityMatchScreen`
still treats a 409 from `/start` as "already started, watch it".

## live (in progress)

Score updates during this phase go through Firebase RTDB
(`src/sessionSync.ts`), **not** the Postgres API — `activities.config`,
`result`, `point_log` are not touched again until completion. See
`lifecycle-match.md` for what happens client-side during this phase,
and `firebase-security.md` for the live copy's write rule.

**Handover mid-match** (DP-023): `PUT /v1/sessions/:id/umpire` sets
`scorer_user_id` to the new umpire on every `live` match of the Session
(`db.SetSessionUmpire`, one transaction) and, when the server has a
service account and `FIREBASE_DATABASE_URL`, rewrites each live copy's
`scorerUid` to the new umpire's Firebase uid
(`firebaseadmin.LiveMatches.SetScorer`, admin REST call; the database
rules are unchanged). Every device on the match screen follows the live
copy (`ActivityMatchScreen` `watchLive`): the old umpire's device turns
into the spectator view with the toast "<Name> is umpiring now"; the new
umpire's device, if it is watching, starts scoring from the current
state, and otherwise picks it up from the live copy when it opens the
match.

## live → completed (complete)

`POST /v1/activities/:id/complete`, caller must be the Session's current
umpire (403 otherwise). `CompleteActivity`: `UPDATE activities SET
status='completed', result=$body.result, point_log=COALESCE($body.pointLog,
point_log), completed_at=now() WHERE id=$1 AND status='live'` — same
404-vs-409 disambiguation as start. `result` is required in the
request body (400 if empty); `pointLog` is optional and, if omitted,
leaves the column at its default `'[]'`.

`ActivityMatchScreen` calls this only from **Confirm result** (DP-025),
never on the final point: a match that ends on the court shows **Match
finished** to its scorer (Confirm result / Undo last point) and stays
`live` until confirmed, its finished state kept in the live copy, so
reopening the match shows Match finished again. A `completedRef` keeps
it from firing twice; a failed call shows an error and can be retried.
The live payload's `confirmed` flag tells spectators, who see the final
score with "Waiting for the umpire to confirm" until then.

**Not implemented**: no automatic top-up/regeneration of the next
queued activity on completion (mentioned in earlier planning, no code
exists for it).

## live → unfinished (End match early)

`POST /v1/activities/:id/end-early` (DP-025), the Session's umpire only.
Body `{result, pointLog?}` like complete. `EndActivityEarly` sets
`status='unfinished'`, the score so far as `result`, `completed_at=now()`
— only from `live` (409 otherwise). The umpire reaches it from the
scoring screen's ⋯ **Match options** › End match early, behind a
confirm Dialog; afterwards their device and any device watching (the
live copy's `unfinished` flag) go back to the Session — no Result saved.
An Unfinished match shows in the Matches/Results list with its score and
"Unfinished", no winner and no Share, and it doesn't open. It counts as
neither a win nor a loss: player stats read `status='completed'` only.
DP-027 (Session-end cleanup, not built yet) is to reuse this status.

## completed / unfinished (terminal)

No further transitions. `GET /v1/sessions/:id/activities` and `GET
/v1/activities/:id` still return completed activities (ordered after
`live`/`queued` in the list endpoint), but there is no dedicated
history view — see `docs/current/api.md`'s note that no
`GET /v1/activities?userId=&clubId=&sport=` filter endpoint exists.
