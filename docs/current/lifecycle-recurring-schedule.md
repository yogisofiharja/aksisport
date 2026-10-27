# Recurring Schedule Lifecycle (Current)

Implements DP-007 (`docs/AKSI_PRODUCT_DECISIONS.md`): generation, Schedule
editing, and Session Synchronization (optionally pushing an edited
Template to already-generated Sessions).

## Recurring Schedule status

Column: `recurring_schedules.status`, `CHECK IN ('active', 'paused')`,
default `'active'`.

```
active <---> paused
```

No `deleted` status — deleting a Recurring Schedule is a real row delete
(`DELETE FROM recurring_schedules`), not a state transition. This
deliberately leaves generated Sessions with a now-dangling-but-preserved
provenance link: `sessions.recurring_schedule_id` is `ON DELETE SET NULL`,
so the Sessions themselves are untouched, they just lose the back-reference
to the (now gone) schedule that made them.

## Occurrence, not a stored entity

DP-007 explicitly treats "occurrence" as an internal implementation
detail, not a first-class domain object — there is no `occurrences` table.
An occurrence is a computed point in time (`internal/scheduling.DueOccurrences`
/ `OccurrencesInRange`, pure functions over the schedule's `recurrence_rule`
+ `generation_lead_days` + `generation_time` + `end_date`). Its state is
inferred, not stored:

- **pending** — no matching row anywhere.
- **generated** — a `sessions` row exists with this `(recurring_schedule_id, starts_at)`.
- **skipped** — a `recurring_schedule_skips` row exists with this
  `(recurring_schedule_id, occurrence_starts_at)` — written either before
  generation (organizer pre-emptively skips a future occurrence) or after
  (organizer deletes an already-generated Session), both through the same
  `POST .../occurrences/skip` endpoint. This is deliberately **not**
  represented as `Session.status = 'cancelled'` — DP-007 treats "this
  occurrence should never have produced a Session" as a different business
  event from "this Session existed and was cancelled," and Session
  Lifecycle (`lifecycle-session.md`) is not extended with a "deleted"
  state to represent it.

## Generation

`internal/scheduling.GenerateDueSessions`, called on every tick of an
in-process `time.Ticker` in `cmd/api/main.go` (interval:
`RECURRING_SCHEDULE_GENERATION_INTERVAL_MINUTES`, default 15 — no cron
library, no second deployment process exists in this repo). For every
`active`, non-past-`end_date` Schedule:

1. `DueOccurrences` computes every occurrence whose generation moment
   (`occurrence time − generation_lead_days`, at `generation_time` or the
   occurrence's own time-of-day) is on or before now. Both the occurrence
   time and its generation moment strictly increase per weekly step, so
   this loop is naturally bounded and naturally does catch-up: a tick after
   any gap (including server downtime) just returns every occurrence
   that's become due since the last successful tick, with no separate
   recovery path — this is the "eventually consistent" behavior DP-007
   requires.
2. Each due occurrence is filtered against `HandledOccurrences` (existing
   Session or skip tombstone) and, if unhandled, generates a Session via
   the same `db.CreateSession` ad-hoc creation uses — Template fields
   (sport/name/location/courtCount/maxParticipants/defaultMatchFormat/
   activityType/skillLevel*) copied as-is, `starts_at` set to the
   occurrence's own timestamp, `duration_minutes` set from the parsed
   Recurrence Rule's own `durationMinutes` (mandatory, v0.5.1 — same value
   used to compute every occurrence, not settable per-occurrence),
   `status` set to `'open'` explicitly (skips the `'draft'` default, so
   generated Sessions auto-publish immediately per DP-007).
3. `sessions_recurring_schedule_occurrence_uniq` (a partial unique index on
   `(recurring_schedule_id, starts_at)`) is the actual idempotency
   guarantee — a concurrent or duplicate generation attempt for the same
   occurrence hits this constraint and is logged, not fatal.

**Manual generation**: `POST .../occurrences/generate`
(`scheduling.GenerateOccurrenceNow`) lets an organizer generate one
occurrence immediately from the "Upcoming" list (a "Generate" button next
to any `pending` occurrence), bypassing the lead-time gate — otherwise
subject to the same invariants (must be a real occurrence of the Recurrence
Rule, rejected if already skipped, idempotent if already generated). Shares
the same session-creation code path as the automatic ticker.

## Session's `starts_at` and `duration_minutes`

`starts_at` (`0007_recurring_schedules.up.sql`) and `duration_minutes`
(`0009_session_duration.up.sql`, DP-009) are **core Session properties**,
not Organizer Preferences (DP-004) and not owned by Recurring Schedule —
ad-hoc Sessions set both at creation (mandatory as of v0.5.1) or edit them
via `PATCH /v1/sessions/:id`; generated Sessions have both populated from
the occurrence timestamp and the Recurrence Rule's own `durationMinutes`.
Same fields, two sources. `CreateSessionScreen` unifies ad-hoc and
recurring creation behind one "Make this recurring" switch. With it on,
Date becomes **Every** (Mon–Sun), then Time | Duration, then **Open days
ahead** (a stepper, default 3, 0–30: "Each session is published this
many days before it starts, so players can join."), then a note
computed from those three (`core/recurringSchedules/firstSession.ts`,
mirroring the server's first occurrence): "First session: Sat 24 Oct,
07:00. It opens on Wed 21 Oct." — or "It opens as soon as you create the
schedule." when that moment has already passed.

## Editing and Session Synchronization

`RecurringScheduleDetailScreen`'s "Edit Schedule" opens
`CreateSessionScreen` in schedule-edit mode (`editingScheduleId`, route
`EditRecurringSchedule`) — same form as creation, minus the sport picker
and the recurring toggle, both fixed after creation. Saving calls
`PATCH /v1/clubs/:clubId/recurring-schedules/:id` with the Template, the
Recurrence Rule (the stored timezone is kept, not replaced by the
device's), and the lead days. That PATCH never touches existing Sessions.

Sync is a separate, organizer-confirmed step right after the save:

1. `GET .../sync-sessions` (`db.PreviewSessionSync`) returns
   `{updated, skippedEdited}` — what a sync would do now.
2. If `updated` is 0 the screen just closes. Otherwise an alert states
   both counts; "Update sessions" calls `POST .../sync-sessions`
   (`db.SyncGeneratedSessions`), "Keep as is" closes without syncing.

Which Sessions are eligible (`syncEligibleSessions`): generated by this
Schedule, `starts_at > now()`, `status IN ('draft', 'open')`. Of those,
the ones with `edited_after_generation = true` are counted as
`skippedEdited` and left alone; the rest get every Template column
overwritten from the Schedule row (NULLs included) in one statement.
`starts_at` and `duration_minutes` are never written, so editing a
Schedule's weekday/time/duration only changes occurrences generated
later.

`sessions.edited_after_generation` (`0023_session_edited_after_generation`)
is set by `db.UpdateSession` when a PATCH on a generated Session carries
any Template field (`SessionUpdate.TouchesTemplate()`), and is never
cleared. A status change or a reschedule alone doesn't set it. Sessions
generated before this migration start at `false`, so hand edits made to
them earlier are not detected.

Known limits, as implemented:

- Like `PATCH /sessions/:id`, a sync that changes `host_playing` does not
  add or remove the host as a participant on existing Sessions.
- The Schedule PATCH uses `COALESCE`, so an edit cannot clear an optional
  field (max participants, description, Skill Level requirement) back to
  empty — same limitation as Session editing.
- Changing the weekday or time leaves already-generated Sessions at their
  old slot while new occurrences are computed from the new rule, so a
  week can end up with both until the organizer skips or cancels one.
