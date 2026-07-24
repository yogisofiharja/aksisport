# Permissions (Current)

All permission logic lives server-side, in `server/internal/httpapi/`.
There is no client-side permission model beyond conditionally hiding
buttons based on the same data the server would check (e.g.
`SessionDetailScreen` only renders "Start" when it thinks the rule
would pass) — the server is always the actual enforcement point, and
re-checks independently.

## Layers, from outermost in

1. **Valid Firebase ID token** (`RequireAuth`) — required by every
   route except `GET /healthz` and `GET /v1/users/check-username`.
2. **Existing Postgres profile** (`RequireProfile`) — required by every
   route except `POST /v1/users` and `GET /v1/me` (which exist
   specifically to create/check that profile).
3. **Club membership** — required for almost everything else. Checked
   via `club_members` row lookup (`requireMember` / `requireSessionAccess`
   / `requireActivityAccess`, which all resolve up to a club membership
   check). No membership → 403 "not a member of this club" (clubs) or
   403 "not a member of this club" (sessions/activities, same message
   reused).
4. **Role within that club** — `owner` / `admin` / `member`, stored per
   `(club_id, user_id)` in `club_members.role`. No cross-club roles —
   being an owner of one club has no effect on another.

## Role capabilities (as enforced, not as documented in `docs/archive/prd.md`)

| Action | Required role |
|---|---|
| Update club, delete club, regenerate invite code, add/remove members, change member roles | `owner` only — `isOwnerOrAdmin` is **not** used here, `requireMember`'s `isOwner` bool is checked directly |
| Remove self from a club | any role (member can always remove themselves) |
| Create session, update session, add guest participant | `owner` or `admin` (`isOwnerOrAdmin`) |
| View session, list sessions, register, check in, view participants | any member |
| Create activity (`POST /v1/sessions/:id/activities`) | `owner` or `admin` |
| View activity/activities | any member of the parent club |
| Start an activity | **not role-based** — see below |
| Complete an activity | **not role-based** — see below |

`docs/archive/prd.md`'s Club Roles section lists Admin as able to "Assign scorer" —
there is no assign-scorer endpoint; the closest actual behavior is
that starting an activity makes the starter the scorer (see
`lifecycle-activity.md`), which is participant-based, not
admin-triggered.

## Activity-specific rules (not role-based)

- **Start** (`POST /v1/activities/:id/start`): caller must be a
  **checked-in participant of that specific activity** — i.e. present
  in `activity_participants` for this activity AND their
  `session_participants.status = 'checked_in'` for the parent session.
  Club role is irrelevant here; an owner who isn't one of the
  activity's participants cannot start it.
- **Complete** (`POST /v1/activities/:id/complete`): caller must be
  exactly `activities.scorer_user_id` (set when the activity was
  started). No one else — not even the club owner — can complete a
  match they aren't scoring.

## Sole-owner protection

`DELETE /v1/clubs/:clubId/members/:userId` refuses (409) if the target
is the club's only `owner`. There is no ownership-transfer endpoint —
if a sole owner wants to leave, another member must first be promoted
to `admin`... but promotion (`PATCH .../members/:userId`) explicitly
only accepts `role: "member" | "admin"`, never `"owner"`. **As
implemented, there is no way to create a second owner or transfer
ownership at all** — a club's owner is permanent once set at creation.

## Live match (Firebase RTDB)

`src/sessionSync.ts` has no security rules or auth check of any kind —
`db.ts`'s Firebase Realtime Database has no documented rules file in
this repo. Any client holding a session code can read and write
`sessions/{code}`. The `scorerUid` field added to `SessionPayload` this
migration is not enforced anywhere (client or RTDB rules) — it's
present in the payload but nothing currently rejects a write from a
non-scorer.
