# API (Current)

Base path `/v1`, plus an unversioned `/healthz`. All request/response
bodies are JSON. Auth column: **none** = no auth; **auth** =
`RequireAuth` only (valid Firebase ID token, Postgres profile not
required); **profile** = `RequireAuth` + `RequireProfile` (Postgres
user row must exist).

CORS: `Access-Control-Allow-Origin` is a single configured value
(`ALLOWED_ORIGINS` env var), methods `GET, POST, PATCH, DELETE, OPTIONS`.

## Health

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/healthz` | none | `{"status":"ok"}` |

## Users

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/v1/users/check-username?username=` | none | `{available, reason?}`. Invalid format (not `^[a-z0-9_]{3,20}$`) returns `available:false, reason:"invalid_format"` rather than 400. |
| POST | `/v1/users` | auth | Body `{username, displayName?}`. Creates the Postgres profile. 409 if a profile already exists for this Firebase UID, 409 if username taken (only error mapping — `CreateUser`'s error isn't distinguished further). |
| GET | `/v1/me` | auth | 404 `{"error":"profile not found","code":"PROFILE_NOT_FOUND"}` if no profile yet. |
| PATCH | `/v1/me` | profile | Body `{displayName?, email?, phoneNumber?, avatarUrl?}`. `username` is immutable — not accepted here. |

## Clubs

| Method | Path | Auth | Extra check | Notes |
|---|---|---|---|---|
| POST | `/v1/clubs` | profile | — | Body `{name, description?}`. Caller becomes `owner`. |
| GET | `/v1/clubs` | profile | — | Lists clubs the caller is a member of, with role, ordered by `created_at DESC`. |
| POST | `/v1/clubs/join` | profile | — | Body `{inviteCode}`. Idempotent — already-a-member returns the club without error. |
| GET | `/v1/clubs/:clubId` | profile | member | |
| PATCH | `/v1/clubs/:clubId` | profile | owner | Body `{name?, description?}`. |
| DELETE | `/v1/clubs/:clubId` | profile | owner | Cascades `club_members`, `sessions`, etc. via FK. |
| POST | `/v1/clubs/:clubId/invite-code/regenerate` | profile | owner | |
| GET | `/v1/clubs/:clubId/members` | profile | member | |
| POST | `/v1/clubs/:clubId/members` | profile | owner | Body `{username}`. Direct-add, no invite flow. 404 if username not found, 409 if already a member. |
| PATCH | `/v1/clubs/:clubId/members/:userId` | profile | owner | Body `{role}` — `"member"` or `"admin"` only; cannot set/unset `"owner"` here. |
| DELETE | `/v1/clubs/:clubId/members/:userId` | profile | owner, or self | Removing the sole remaining owner returns 409. |

## Sessions

| Method | Path | Auth | Extra check | Notes |
|---|---|---|---|---|
| POST | `/v1/clubs/:clubId/sessions` | profile | owner/admin of club | Body `{sport, name?, location?, courtCount?}`. `sport` required. Name auto-generated (`"Session on <date>"`) if omitted. |
| GET | `/v1/clubs/:clubId/sessions` | profile | member | |
| GET | `/v1/sessions/:id` | profile | member of parent club | |
| PATCH | `/v1/sessions/:id` | profile | owner/admin | Body `{name?, location?, status?}`. `status` must be one of `open`/`in_progress`/`completed` if present. |
| GET | `/v1/sessions/:id/participants` | profile | member | |
| POST | `/v1/sessions/:id/register` | profile | member | Self-registers caller, idempotent. |
| POST | `/v1/sessions/:id/checkin` | profile | member | Self check-in; auto-registers first if no row exists yet. |
| POST | `/v1/sessions/:id/participants` | profile | owner/admin | Body `{guestName}`. Adds a guest directly as `checked_in`. |

## Activities

| Method | Path | Auth | Extra check | Notes |
|---|---|---|---|---|
| POST | `/v1/sessions/:id/activities` | profile | owner/admin | Body `{config, participants: [{userId\|guestName, team?}]}`. Creates a `queued` activity. `config`/`result` are opaque JSON, not validated server-side. |
| GET | `/v1/sessions/:id/activities` | profile | member | Ordered live → queued → completed, then `created_at ASC` within each. |
| GET | `/v1/activities/:id` | profile | member of parent club | Returns `ActivityDetail` (activity + participants). |
| POST | `/v1/activities/:id/start` | profile | checked-in participant of *this activity* | `queued → live`. Sets `scorer_user_id` = caller, `started_at` = now. 409 if not currently `queued`. |
| POST | `/v1/activities/:id/complete` | profile | current scorer only | Body `{result, pointLog?}`. `live → completed`. 403 if caller isn't `scorer_user_id`. 409 if not currently `live`. |

Not implemented: activity edit/cancel while queued (`PATCH`/`DELETE
/v1/activities/:id`), auto-generation (`POST
/v1/sessions/:id/activities/generate`), scorer transfer — all four are
mentioned in earlier planning but have no route.

## Error shape

All errors: `{"error": "<message>"}`, sometimes with a `code` field
(only `PROFILE_NOT_FOUND` currently uses this). No structured
validation-error format — bad input is a flat 400 with a short string.
