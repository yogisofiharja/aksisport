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
| View a player profile or sport page (DP-019) | the player themself, anyone sharing a club with them, or an owner/admin of a club they have a pending request to join |
| Direct message a player (DP-020) | anyone allowed to view their profile, or anyone who already has a conversation with them — but not someone you blocked (DP-021) |
| Edit a message (DP-021) | its sender, within 15 minutes |
| Delete a message for everyone (DP-021) | its sender, within 60 hours |
| Delete a message for yourself (DP-021) | anyone in its conversation |
| Start a group chat; add people to one (DP-021) | anyone; only people they could direct message and haven't blocked (or been blocked by); adding is for the group's creator |
| Name, rename or unname a group, remove someone from it (DP-021) | the group's creator (passes to the longest-standing member if the creator leaves) |
| Leave a group (DP-021) | any member |
| Read and post in Community chat (DP-021) | every member of the Community, while the chat is on |
| Turn Community chat off/on, remove any message in it (DP-021) | that Community's owner/admins |
| Block a player (DP-021) | anyone you could direct message |
| Report a player (DP-021) | anyone you could direct message |
| Report a message (DP-021) | anyone in its conversation, except its sender |
| See a Community's reports, dismiss one (DP-021) | that Community's owner/admins |
| Remove a reported message (DP-021) | owner/admins of the Community whose Session conversation (Session Chat or Contact Organizer) it was posted in; never a direct message |
| Change a club's location or visibility (DP-017) | `owner` only, same as any other club update |
| Create session, update session, add guest participant | `owner` or `admin` (`isOwnerOrAdmin`) |
| View session, list sessions, register, check in, view participants | any member |
| Create activity (`POST /v1/sessions/:id/activities`) | `owner` or `admin` |
| View activity/activities | any member of the parent club |
| Make someone the Session's umpire (`PUT /v1/sessions/:id/umpire`, DP-023) | `owner` or `admin` — a checked-in participant, or themselves |
| Start, complete or end early an activity | **not role-based** — the Session's umpire only, see below |
| Manage Club bank accounts (create/update/delete) | `owner` only |
| List Club bank accounts | any member |
| Confirm payment (a player's row ⋯ on Players, DP-024) | `owner` or `admin` |
| Upload a payment receipt | self only — no organizer-uploads-for-someone-else path |
| View a payment receipt image | **not role-based alone** — see below |

`docs/archive/prd.md`'s Club Roles section lists Admin as able to "Assign scorer" —
DP-023 makes this per Session: owners/admins choose the Session's
**umpire** (`PUT /v1/sessions/:id/umpire`), who scores every match of
it (see `lifecycle-activity.md`).

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

- **Start, complete, end early** (`POST /v1/activities/:id/start`,
  `/complete`, `/end-early`): the caller must be the Session's umpire
  (`sessions.umpire_user_id`, the creator by default) — nobody else, not
  the match's players and not the Club's owner/admins. An owner/admin
  who wants to score takes the umpire role first (reclaim). The app
  mirrors this: only the umpire sees Start and scoring controls.
- **Assign the umpire** (`PUT /v1/sessions/:id/umpire`): `owner`/`admin`
  only; the target is a `checked_in` participant of the Session or the
  caller themselves; not on a Completed or Cancelled Session. The umpire
  can't hand the role on; the app tells a non-organizer umpire whom to
  ask (Match options).

## Sole-owner protection

`DELETE /v1/clubs/:clubId/members/:userId` refuses (409) if the target
is the club's only `owner`. There is no ownership-transfer endpoint —
if a sole owner wants to leave, another member must first be promoted
to `admin`... but promotion (`PATCH .../members/:userId`) explicitly
only accepts `role: "member" | "admin"`, never `"owner"`. **As
implemented, there is no way to create a second owner or transfer
ownership at all** — a club's owner is permanent once set at creation.

## Live match (Firebase RTDB)

See `firebase-security.md`. In Aksi's own Firebase projects the rules
(`deploy/firebase/database.rules.json`) let only the live copy's
`scorerUid` write to it. An umpire handover (DP-023) moves `scorerUid`
to the new umpire from the server, with the service account, so the
rules stay as they are.
