# API Guidelines (Target)

For the actual current endpoint list, see `docs/current/api.md` — this
document is the convention to follow for *new* endpoints, formalizing
what the existing ones already do consistently.

## URL structure

Resource-oriented, nested under their parent when access is scoped to
it:

```
/v1/clubs/:clubId/sessions          (nested — a session belongs to a club)
/v1/sessions/:id                     (flat — once you have the id, no need to repeat clubId)
/v1/sessions/:id/activities
/v1/activities/:id/start             (action-suffixed for state transitions, not a new verb/method)
```

Keep this pattern: nest under the parent for creation/listing, flatten
to `/v1/<resource>/:id` for direct access once an id is known, and use
a trailing action segment (`/start`, `/complete`, `/join`) for state
transitions rather than modeling them as a generic `PATCH` with a
status field, when the transition has real business logic attached
(auth checks, side effects) beyond "set a column."

## Auth layering

Every new route should compose from the same three checks already
established, in order — see `docs/current/permissions.md`:

1. `RequireAuth` — valid Firebase token.
2. `RequireProfile` — Postgres profile exists (skip only for the two
   routes whose job is to create/check that profile).
3. A resource-scoped check (`requireMember` / `requireSessionAccess` /
   `requireActivityAccess`-style helper) — write a new one following
   the same shape if a new aggregate needs it, rather than inlining
   the membership lookup in the handler.

## Request/response conventions

- JSON in, JSON out. Field names `camelCase` on the wire (Go struct
  tags translate from Go's `PascalCase`).
- Optional fields: `omitempty` + pointer types (`*string`, `*time.Time`)
  in Go, `field?:` in TypeScript. Keep them symmetric.
- Sport-specific or otherwise schema-flexible data (activity `config`/`result`)
  stays opaque `JSONB` server-side, never parsed or validated in Go —
  see `architecture.md`'s `SportModule` contract for why. Don't add
  server-side validation of these blobs' internal shape; that's the
  client-side sport module's job.
- Errors: `{"error": "<message>"}`, plus `code` only when the client
  needs to branch on it programmatically (today: `PROFILE_NOT_FOUND`).
  Don't add a `code` for errors the client only displays as text.

## Status codes

Follow what's already consistent: `201` on resource creation, `200` on
reads/updates/actions, `204` on delete, `400` bad input, `401` auth
failure, `403` authenticated-but-not-permitted, `404` not found, `409`
conflict (state-transition guard failed, uniqueness violation).

## Pagination

Not implemented anywhere today — every list endpoint returns the full
set (see `docs/current/api.md`). This is fine at current data volumes
(one user's clubs/sessions/activities). **Target, not urgent**: if any
list endpoint's result set could realistically grow past a few
hundred rows (most plausible candidate: `GET /v1/activities` once a
history/filter endpoint exists per `docs/product/roadmap.md` Phase 4),
add simple `limit`/`offset` query params then — don't add pagination
to endpoints that don't need it yet.

## Versioning

`/v1` prefix is already in place for exactly this purpose. No action
needed until a breaking change is actually required — then add `/v2`
for the changed routes only, not a wholesale bump.
