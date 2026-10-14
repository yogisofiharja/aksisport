# Permissions (Current)

All permission logic lives server-side, in `server/internal/httpapi/`.
There is no client-side permission model beyond conditionally hiding
buttons based on the same data the server would check (e.g.
`SessionDetailScreen` only renders "Start" when it thinks the rule
would pass) — the server is always the actual enforcement point, and
re-checks independently.

## Layers, from outermost in

1. **Valid Firebase ID token** (`RequireAuth`) — required by every
   route except `GET /healthz`, `GET /v1/users/check-username`, and the
   DP-015 routes for people who cannot sign in (`POST /v1/auth/login-identity`,
   `POST /v1/auth/password-reset/request`, `.../confirm`). Those public
   routes are rate limited per client IP instead — see
   `docs/current/api.md`, "Rate limits on public routes".
2. **Existing Postgres profile** (`RequireProfile`) — required by every
   route except `POST /v1/users` and `GET /v1/me` (which exist
   specifically to create/check that profile). `RequireProfile` also
   enforces the DP-015 email gate: an account that must confirm its email
   and hasn't gets 403 `EMAIL_UNCONFIRMED` everywhere except the two
   routes that confirm it.
3. **Club membership** — required for almost everything else. Checked
   via `club_members` row lookup (`requireMember` / `requireSessionAccess`
   / `requireActivityAccess`, which all resolve up to a club membership
   check). No membership → 403 "not a member of this club" (clubs) or
   403 "not a member of this club" (sessions/activities, same message
   reused).
4. **Role within that club** — `owner` / `admin` / `member`, stored per
   `(club_id, user_id)` in `club_members.role`. No cross-club roles —
   being an owner of one club has no effect on another.

**Exception to layer 3**: `GET /v1/users/search` requires a profile
(layer 2) but no club membership at all — any user with a profile can
search any other user by username/display name, regardless of whether
they share a club. It exists specifically to back `ClubMembersScreen`'s
Add Member dialog; "is this person already a member of *this* club" is
filtered client-side afterward, not by the search endpoint itself.

**Also outside layer 3 (DP-017)**: Community discovery is open to any
user with a profile, member or not — `GET /v1/clubs/search`,
`GET /v1/clubs/:clubId/preview`, `GET /v1/clubs/:clubId/avatar`,
`GET /v1/clubs/in-my-city`, `POST /v1/clubs/:clubId/join`, and
`DELETE /v1/clubs/:clubId/join-request` — as is the reference list of
provinces and cities, `GET /v1/locations`.
What they expose is deliberately limited to the `ClubPreview` shape (name,
picture, description, city, visibility, member count); everything
else about a Club still requires membership. A private Club is findable
and previewable like a public one — only joining is gated.

## Role capabilities (as enforced, not as documented in `docs/archive/prd.md`)

| Action | Required role |
|---|---|
| Update club, delete club, add/remove members, change member roles | `owner` only — `isOwnerOrAdmin` is **not** used here, `requireMember`'s `isOwner` bool is checked directly |
| Remove self from a club | any role (member can always remove themselves) |
| List, approve, or decline join requests (DP-017) | `owner` or `admin` (`requireOwnerOrAdmin`) |
| Change a club's location or visibility (DP-017) | `owner` only, same as any other club update |
| Create session, update session, add guest participant | `owner` or `admin` (`isOwnerOrAdmin`) |
| View session, list sessions, register, check in, view participants | any member |
| Create activity (`POST /v1/sessions/:id/activities`) | `owner` or `admin` |
| View activity/activities | any member of the parent club |
| Start an activity | **partly role-based** — see below |
| Complete an activity | **not role-based** — see below |
| Manage Club bank accounts (create/update/delete) | `owner` only |
| List Club bank accounts | any member |
| Confirm payment (Milestone 5, moved from the badge to the Payment tab) | `owner` or `admin` |
| Upload a payment receipt | self only — no organizer-uploads-for-someone-else path |
| View a payment receipt image | **not role-based alone** — see below |

`docs/archive/prd.md`'s Club Roles section lists Admin as able to "Assign scorer" —
there is no assign-scorer endpoint; the closest actual behavior is
that starting an activity makes the starter the scorer (see
`lifecycle-activity.md`). Owner/admin can trigger this administratively
on any queued match (see below); a regular member can only trigger it
for a match they're actually playing in.

## Payment receipt visibility (Milestone 5, DP-012)

`GET /v1/sessions/:id/participants/:participantId/receipt` passes
`requireSessionAccess` (layer 3 — any Club member can reach the route at
all) but then applies an **additional identity check** that has no
equivalent anywhere else in this domain: the caller must be either
`owner`/`admin` of the parent Club, **or** the participant who uploaded
that specific receipt (`session_participants.user_id` matches the
caller's own id). Every other Club member who passes layer 3 gets 403.
This is deliberately stricter than every other participant-scoped read
in the app (e.g. the participant list itself, or DP-011 Chat messages),
where "any Club member" is sufficient — payment receipts are the one
piece of Session data that isn't shared with the whole roster, only
with the two parties who need it (the payer, and whoever confirms
payment). Everyone else still sees that participant's `status`
(paid/awaiting) via the normal participant list — just never the image.

## Activity-specific rules

- **Start** (`POST /v1/activities/:id/start`): caller must be a
  **checked-in participant of that specific activity** — i.e. present
  in `activity_participants` for this activity AND their
  `session_participants.status = 'checked_in'` for the parent session —
  **or** `owner`/`admin` of the parent club. The role check is an
  `isOwnerOrAdmin(role)` bypass added around the checked-in-participant
  check (`dbpkg.IsCheckedInActivityParticipant`) — an owner/admin can
  start any queued match in the session even if they're not one of its
  players, becoming its scorer (e.g. scoring on behalf of players
  without the app). A regular member who isn't one of the activity's
  participants still cannot start it.
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
