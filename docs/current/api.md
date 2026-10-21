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
| POST | `/v1/users` | auth | Body `{username, displayName?, email?}`. Creates the Postgres profile, always with `emailRequired: true` (DP-015). `email`, when given, is validated (400), rejected if another account has confirmed it (409), stored as `pendingEmail`, and a confirmation code is mailed. It is omitted only when an interrupted sign-up is being completed. 409 if a profile already exists for this Firebase UID, 409 if username taken. |
| GET | `/v1/me` | auth | 404 `{"error":"profile not found","code":"PROFILE_NOT_FOUND"}` if no profile yet. |
| PATCH | `/v1/me` | profile | Body `{displayName?, cityCode?, phoneNumber?, avatarUrl?}`. `displayName` (DP-016) is trimmed and limited to 40 characters (400 beyond that); an empty string removes it, so the User is shown by username again. `cityCode` (DP-017) switches the caller's **active** town, saving it among their towns if it isn't yet; it must be a city in the reference list (400 otherwise, including empty — a town is removed with `DELETE /v1/me/cities/:code`), 409 past the 10-town limit. `GET /v1/me` returns `cityCode`/`cityName` (the active town) and `cities: [{code, name}]` (every saved town, oldest first). `email` is not accepted here — it only changes through code confirmation (see Account email below). `username` is immutable — not accepted here. `avatarUrl` is a stale, never-wired string-URL stub — see the note under "Profile pictures" below; the real path is `POST /v1/me/avatar`. |
| POST | `/v1/me/avatar` | profile | Body `{imageBase64, imageContentType}`. Self-service only — always the caller's own picture. Same size/content-type validation as every other image upload (5MB decoded cap, JPEG/PNG/WebP only). |
| GET | `/v1/users/:userId/profile` | profile | see notes | DP-019 player profile: `{id, username, displayName?, hasAvatar, isOnline, joinedAt, skillLevels: UserSkillLevel[]}` — nothing private (no email, towns). Visible to the player themself, anyone sharing a Club with them, and the owner/admins of a Club they have a pending request to join (`db.CanViewPlayerProfile`); everyone else gets the same 404 as for a player that doesn't exist. |
| GET | `/v1/users/:userId/sports/:sport/activity` | profile | see notes | DP-019 sport page: `{sport, summary: {sessionsAttended, noShows, matchesPlayed, wins, losses}, sessions: [...], matches: [...]}` — `matchesPlayed` counts completed matches, draws included; `wins`/`losses` completed matches the player's team / the other team won (a draw is neither; Unfinished and Not played never count) across every Club. Sessions: participations that were checked in/out or no-show, newest 50. Matches: completed activities the player was on a team in, newest 50, each with `team`, `won` (from the stored result's `winner`), the raw `result`, and every player's name and team. Same visibility and 404 as the profile; 404 for an unknown sport. |
| GET | `/v1/users/:userId/avatar` | profile | Serves the raw image bytes. Visible to any authenticated user with a profile — same broad visibility as the username/displayName it's paired with everywhere (search, member grids, organizer names), not scoped to a shared Club. 404 if the user has no picture. |
| GET | `/v1/me/contact-threads` | profile | DP-013 Contact Organizer's Inbox listing. See the "Conversations" subsection under Sessions below for the full shape. |
| GET | `/v1/users/search?q=` | profile | Case-insensitive substring match on `username` or `display_name`, excludes the caller, capped at 20 results ordered by `username`. Returns `[]` for `q` under 2 characters rather than erroring (avoids a near-full-table scan on a 0-1 char query). Response is the lean `UserSummary` shape (`id`/`username`/`displayName`/`hasAvatar`/`isOnline`) — unlike every other `/users`/`/me` route here, this never includes `email`/`phoneNumber`, since the caller is looking up *someone else*. Not club-scoped — `ClubMembersScreen`'s Add Member dialog filters out existing members client-side, since it already has that list loaded. |

### Account email & password recovery (DP-015)

`users.email` is the **confirmed** address; `pending_email` is one awaiting
its code; `email_required` is true for accounts created under DP-015.
`GET /v1/me` returns all three (`email`, `pendingEmail`, `emailRequired`) —
only ever to the account's own owner. Rules live in `internal/account`
(6-digit code, 15-minute TTL, 5 attempts, 1-minute resend cooldown, only
the newest code is live, codes stored hashed in `email_codes`).

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/v1/me/email` | profile | Body `{email}`. Records it as `pendingEmail` and mails a code; also how a code is re-sent. The confirmed email, if any, stays in effect. 400 invalid address, 409 already the caller's email or confirmed by another account, 429 inside the cooldown (`code: "TOO_SOON"`, with `retryAfterSeconds` so the client can count down), 502 if sending failed. Returns the updated profile. |
| POST | `/v1/me/email/verify` | profile | Body `{code}`. On a match, the pending address becomes `email` and `pendingEmail` clears; if this replaced an earlier confirmed email, a notice is mailed to that old address (best-effort). 400 for any bad code (wrong, expired, used, locked — one message). 409 if another account confirmed the same address meanwhile. |
| POST | `/v1/auth/login-identity` | none | Body `{email}` → `{loginEmail}`: the synthetic Firebase identity to sign in as. An email nobody confirmed gets a decoy identity that fails at sign-in like a wrong password, so this never reveals whether an email is registered. |
| POST | `/v1/auth/password-reset/request` | none | Body `{identifier}` (username or confirmed email). Mails a reset code to the account's confirmed email if there is one. Always 204 — unknown account, no confirmed email, and cooldown are indistinguishable from success. 503 if no Firebase service account is configured. |
| POST | `/v1/auth/password-reset/confirm` | none | Body `{identifier, code, newPassword}`. Redeems the code, then sets the Firebase password (`internal/firebaseadmin`, Identity Toolkit REST with the service account) and mails a "password changed" notice to the account's email (best-effort). 400 bad code or password under 6 characters, 502 if Firebase refuses (the code is spent — request a new one), 503 if unconfigured. |

**Email gate, enforced by the server.** An `emailRequired` account
without a confirmed email gets 403 `{code: "EMAIL_UNCONFIRMED"}` from
every profile-requiring route except `POST /v1/me/email` and
`POST /v1/me/email/verify` (`authjwt.EmailGateBlocks`, checked in
`RequireProfile`). `GET /v1/me` needs no profile middleware, so it stays
reachable. The app holds such accounts on `VerifyEmailScreen` anyway;
this stops a client that skips that screen. Older accounts are never
blocked.

### Rate limits on public routes

Routes callable without signing in are limited per client IP
(`internal/ratelimit`, fixed windows, in memory — per API process).
Beyond the limit: 429 `{code: "RATE_LIMITED", retryAfterSeconds}` with a
`Retry-After` header. The per-account limits (5 tries per code, one code
per minute) still apply underneath.

| Route | Limit per IP |
|---|---|
| `GET /v1/users/check-username` | 60 per minute |
| `POST /v1/auth/login-identity` | 20 per minute |
| `POST /v1/auth/password-reset/request` | 5 per 15 minutes |
| `POST /v1/auth/password-reset/confirm` | 10 per 15 minutes |

The client IP comes from `httpapi.ClientIPResolver`, never gin's own
guess (`SetTrustedProxies(nil)`): the TCP peer, or — only when that peer
is one of `TRUSTED_PROXIES` (default the local Caddy, `127.0.0.1,::1`) —
the header named by `CLIENT_IP_HEADER` (`CF-Connecting-IP` behind
Cloudflare). Behind Cloudflare and Caddy the peer and `X-Forwarded-For`
only ever name the proxies, so without `CLIENT_IP_HEADER` every visitor
would share one limit.

Mail goes through `internal/mail.Mailer`, chosen at startup in
`cmd/api/main.go`:

- `RESEND_API_KEY` set → `ResendMailer` (one POST to Resend's HTTP API per
  message, plain text, no SDK). The sender is `MAIL_FROM`, which must be
  on a domain verified in Resend. With `MAIL_FROM` unset it falls back to
  Resend's test sender (`onboarding@resend.dev`), which Resend only
  delivers to the account owner's own address.
- `RESEND_API_KEY` unset → `LogMailer`, which writes each message, code
  included, to the server log.

A failed send on `POST /v1/me/email` surfaces as 502 with Resend's reason
in the server log; on sign-up and on password-reset request it is logged
and the request still succeeds.

### Direct messages (DP-020)

A `conversations` row of kind `direct` (migration `0030`: `session_id`
optional, the two people as `user_low < user_high`, one conversation per
pair), messages on the same `conversation_messages` table as Session Chat.
A message's `sessionId` is `""` for a direct conversation.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/v1/me/direct-threads` | profile | Every direct conversation of the caller, most recently active first: `{otherUserId, otherUsername, otherDisplayName?, otherHasAvatar, otherIsOnline, lastMessageBody, lastMessageHasImage, lastMessageSenderId, lastMessageAt}`. |
| GET | `/v1/dm/:userId/messages` | profile | The conversation with that player, oldest first; `[]` before the first message. |
| POST | `/v1/dm/:userId/messages` | profile | Same body as Session Chat (`{body?, imageBase64?, imageContentType?}`). Creates the conversation on first message. |
| GET | `/v1/dm/messages/:messageId/image` | profile | An image from one of the caller's own direct conversations. |

Who may message whom: an existing conversation, or the DP-019 profile
rule (`db.CanViewPlayerProfile`); otherwise 404 "player not found". 400
for messaging yourself.

### Live connection, read receipts, unread counts (DP-021)

One WebSocket per signed-in app: `GET /v1/live?token=<Firebase ID
token>` (a browser can't put an Authorization header on a WebSocket, so
the token is in the query; the request logger skips this path so it never
reaches the logs). Same profile and email-gate checks as every other
route; web pages may connect only from `ALLOWED_ORIGINS`. The server pings
every 25 seconds (Cloudflare closes connections idle for ~100). Events are
JSON `{type, data}`:

| Event | Data | Sent to |
|---|---|---|
| `message.created` | `{conversationId, kind, sessionId, message}` | everyone in the conversation, sender included |
| `read` | `{conversationId, userId, lastReadAt}` | everyone in the conversation |
| `typing` | `{conversationId, userId, name}` | everyone in the conversation but the typist |
| `notification.created` | — | the recipients of a new DP-018 notification |

The only thing a client sends is `{"type":"typing","conversationId"}`,
relayed only if the sender belongs in the conversation. "Everyone in the
conversation" (`db.ConversationParticipantIDs`): the two people of a
direct conversation; a Contact Organizer thread's member plus the
Session's Club owner/admins; every member of the Session's Club for
Session Chat (owner/admins only while the Session is a Draft).

The hub (`internal/live`) is in-memory, per process. Running more than
one API process needs a shared broker (e.g. Postgres LISTEN/NOTIFY)
behind `Hub.Publish` first.

Read positions are `conversation_reads (conversation_id, user_id,
last_read_at)` (migration `0031`); unread = messages from others after
your `last_read_at`.

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/v1/conversations/:id/read` | profile | Marks the conversation read up to now; announces `read`. 204. 404 if you are not in it. |
| GET | `/v1/conversations/:id/reads` | profile | `[{userId, lastReadAt}]` — read receipts. |
| GET | `/v1/me/unread-messages` | profile | `{count}` across direct conversations and Contact Organizer threads (what Inbox lists) — the Inbox tab badge. |
| GET | `/v1/sessions/:id/chat/unread` | profile | `{count}` for the Session's Chat — its Chat tab badge. `0` before anyone has posted. |

`/v1/me/direct-threads` and the Contact Organizer thread lists also return
`conversationId` and `unreadCount` per row; every message carries its
`conversationId`.

**Message pushes.** After a direct or Contact Organizer message is stored,
participants other than the sender who have no live connection open get a
push (`direct_message` / `contact_message`: sender's name and the text, or
"Sent a photo"), opening the conversation. These are pushed only — not
recorded on the Notifications page. Session Chat never pushes.

### Blocking and reporting (DP-021, step 2)

Migration `0032`: `user_blocks (blocker_id, blocked_id)`;
`conversation_messages.withheld`, `removed_at`, `removed_by`; `reports`
(reporter, reported user, optional message id plus a copy of its text,
image flag and conversation kind, reason) and `report_clubs (report_id,
club_id, resolved_at, resolved_by)`.

**Blocking is one-directional and silent.**
- The blocker can't send to the blocked player: `POST /v1/dm/:userId/messages`
  → 403 `{code: "BLOCKED"}`.
- The blocked player can still send; the message is stored `withheld`. It
  is returned to its sender as normal, and left out for the blocker
  everywhere: message lists, Inbox's latest message, unread counts, live
  events and pushes. It stays hidden after an unblock.
- Neither side's typing reaches the other. The blocker's `read` events
  and read positions are not shown to the blocked player, so "Seen" never
  appears for withheld messages.
- `GET /v1/users/:userId/profile` adds `blockedByMe`.

**A report** goes to the owner/admins of the Communities it concerns: a
message in a Session conversation → that Session's Community; a direct
message or a person → every Community both people belong to. With none,
the report is stored but reaches no one. Each Community handles it
separately (dismiss or remove takes it off that Community's list only).
A removed message keeps its row with text and image cleared and
`removed: true`; clients show "Message removed by an organizer".

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/v1/me/blocks` | profile | `[{userId, username, displayName?, hasAvatar, blockedAt}]`, newest first. |
| PUT | `/v1/users/:userId/block` | profile | 204. Same 404 as direct messages if you couldn't message them. |
| DELETE | `/v1/users/:userId/block` | profile | 204, also when not blocked. |
| POST | `/v1/reports` | profile | `{messageId, reason}` or `{userId, reason}`; reason 1–500 characters. 204. Message: 404 unless you are in its conversation; 400 for your own. Person: same rule as direct messages. |
| GET | `/v1/clubs/:clubId/reports` | owner/admin | Open reports, newest first: reporter and reported names, reason, `message?: {id?, body, hasImage, conversationKind, sessionId?, sessionName?, removed, canRemove}`. |
| GET | `/v1/clubs/:clubId/reports/count` | owner/admin | `{count}` of open reports. |
| POST | `/v1/clubs/:clubId/reports/:reportId/dismiss` | owner/admin | 204. |
| POST | `/v1/clubs/:clubId/reports/:reportId/remove-message` | owner/admin | Only when `canRemove` (posted in this Community's Session conversation, not yet removed); else 400. Removes it, closes the report for this Community, announces live `message.removed {conversationId, messageId}`. 204. |

### Editing and deleting messages (DP-021)

Migration `0033`: `conversation_messages.edited_at`, `deleted_at`;
`conversation_message_hides (message_id, user_id)` for "delete for me".
Every message carries `edited` and `deleted`; Inbox and Contact Organizer
thread rows carry `lastMessageDeleted` (deleted or removed). Hidden
messages are left out of message lists and of a thread's latest message
for that person; deleted ones don't count as unread.

| Method | Path | Auth | Notes |
|---|---|---|---|
| PATCH | `/v1/conversation-messages/:id` | profile | `{body}`. Your own message, within 15 minutes, not deleted/removed; text 1–2000 characters (may be empty for a photo). Returns the message. Announces `message.updated {conversationId, messageId}`. |
| DELETE | `/v1/conversation-messages/:id?for=everyone` | profile | Your own message, within 60 hours: clears text and image, sets `deleted`. Announces `message.updated`. 204. |
| DELETE | `/v1/conversation-messages/:id?for=me` | profile | Any message in a conversation you're in: hidden for you only. Announced only to your own devices. 204. |

403 outside the time limits or for someone else's message; 404 when not
in the conversation. Changes to a withheld message (DP-021 blocking) are
announced to its sender only.

### Group chats and Community chat (DP-021, step 3)

Migration `0034`: conversation kinds `group` (`title` — optional since
`0035` —, `created_by`,
members in `conversation_members`) and `club` (`club_id`, one per
Community); `clubs.chat_enabled`. Both use the same messages, read
receipts, typing, edit/delete and reporting as every other chat. Images
of any message: `GET /v1/conversation-messages/:id/image` (anyone in its
conversation).

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/v1/me/messageable-users?q=` | profile | People you could message — sharing a Community, or an existing direct conversation — minus blocks either way; matched on username/display name; up to 50. |
| GET | `/v1/me/groups` | profile | Your groups for Inbox, most recently active first: `{conversationId, title ("" if unnamed), memberCount, memberNames (up to four others, oldest first), lastMessage…, lastActivityAt, unreadCount}`. |
| POST | `/v1/groups` | profile | `{title?, memberIds}`: title optional (0–60 characters; `""` = unnamed), at least **two** other people (one is a direct message), everyone someone you could message, 50 at most including you. Returns the group. |
| GET | `/v1/groups/:groupId` | member | `{id, title, createdBy, createdAt, members: [{userId, username, displayName?, hasAvatar}]}`. 404 if you are not in it. |
| PATCH | `/v1/groups/:groupId` | creator | `{title}`; `""` clears the name. |
| POST | `/v1/groups/:groupId/members` | creator | `{userIds}`, same rules as creating. |
| DELETE | `/v1/groups/:groupId/members/:userId` | creator, or yourself | Remove someone, or leave. When the creator leaves, the longest-standing member who remains manages the group. |
| GET/POST | `/v1/groups/:groupId/messages` | member | Same message shapes as Session Chat. |
| GET | `/v1/clubs/:clubId/chat` | member | `{enabled, unreadCount}`. |
| PATCH | `/v1/clubs/:clubId/chat` | owner/admin | `{enabled}`. Announces `club.chat.updated {clubId, enabled}` to members. |
| GET/POST | `/v1/clubs/:clubId/chat/messages` | member | Posting while off → 403 `{code: "CHAT_OFF"}`; history stays readable. |
| DELETE | `/v1/clubs/:clubId/chat/messages/:messageId` | owner/admin | Removes any message (shown as removed by an organizer); announces `message.removed`. |

Group membership changes announce `group.updated {conversationId}` to
everyone in the group (and whoever was just removed). Group messages push
to members without Aksi open (`group_message`: the group's name or its
first three members' names, then "Name: text"); Community chat never
pushes. Inbox's unread total now includes
groups. A reported group message goes to every Community the reporter and
sender share and can't be removed by organizers; a reported Community chat
message goes to that Community and can be.

`id`s from URLs are checked for UUID format (`db.IsUUID`) before lookups,
so a malformed one is a 404 rather than a database error.

### Notifications (DP-018)

`internal/notify.Service.Send` is the one way a feature notifies people:
it records one `notifications` row per recipient (minus whoever caused
it) and, in the background, pushes to each of their devices — browsers
through Web Push (VAPID keys generated on first start, kept in
`server_keys`), phone apps through Expo's push service. A device a push
service reports gone (Web Push 404/410, Expo `DeviceNotRegistered`) is
forgotten. Push text is rendered per device in its `locale`
(`internal/notify/texts.go`); the stored row keeps only `type`, `params`
and `path`, rendered by the client.

**Events** (all seven of DP-018; nobody is told about their own action):

| Type | Sent when | To | Path |
|---|---|---|---|
| `community_join_request` | `POST /v1/clubs/:clubId/join` makes a new pending request (asking again while waiting doesn't repeat it) | the Community's owner/admins | `/clubs/:clubId/members` |
| `community_join_approved` | `POST /v1/clubs/:clubId/join-requests/:id/approve` (a decline is not announced) | the requester | `/clubs/:clubId` |
| `session_join_request` | `POST /v1/sessions/:id/register` creates a request, or re-requests after cancelling | the Community's owner/admins | `/sessions/:id?tab=participants` |
| `session_join_approved` | `POST /v1/sessions/:id/participants/:userId/approve` — paid Session: now on the waitlist, must pay; free Session: already registered (`params.claimed = "1"`, "You're in") | the player | paid: `/sessions/:id?tab=payment`; free: `/sessions/:id` |
| `payment_receipt` | `POST /v1/sessions/:id/receipt` | the Community's owner/admins | `/sessions/:id?tab=payment` |
| `payment_confirmed` | `POST /v1/sessions/:id/participants/:userId/confirm-payment` | the player | `/sessions/:id` |
| `session_reminder` | a published (`open`) Session is within 2 hours of starting — checked every minute in `cmd/api`; `sessions.reminder_sent_at` (migration `0036`) makes it once per Session; one published less than 2 hours ahead is reminded at once, with `params.minutes` the real time left | participants who are `registered` or `checked_in` | `/sessions/:id` |

Session notifications name the Session by its name, or its Community's
name when it has none (`params.session`).

**Per-kind switches** (migration `0036`, `notification_settings`; only
kinds turned off are meaningful, everything defaults on). Categories:
`community_requests` (join request/approved), `session_requests` (Session
join request/approved), `payments` (receipt/confirmed), `session_reminders`.
A kind turned off stops its **pushes** (`notify.CategoryOf` +
`db.UsersWithCategoryOff` in `Service.push`); the notification is still
recorded and listed. Message pushes (DP-021) have no switch.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/v1/push/web-public-key` | profile | `{publicKey}` — the VAPID key a browser subscribes with. |
| POST | `/v1/me/push-subscriptions` | profile | Registers this device for the caller: `{kind: "web", endpoint, keys: {p256dh, auth}, locale}` or `{kind: "expo", token, locale}`. Upsert by address: the same browser signed in as someone else moves to them. `locale` is `en` or `id`. |
| DELETE | `/v1/me/push-subscriptions` | profile | Body `{address}` (endpoint or token). Called on sign-out. |
| GET | `/v1/me/notifications?limit=` | profile | Newest first, default 50, max 200: `{id, type, params, path, createdAt, readAt?}`. |
| GET | `/v1/me/notifications/unread-count` | profile | `{count}` — the bell's badge. |
| POST | `/v1/me/notifications/:id/read` | profile | Idempotent. 404 if not the caller's. |
| POST | `/v1/me/notifications/read-all` | profile | |
| GET | `/v1/me/notification-settings` | profile | `{community_requests, session_requests, payments, session_reminders}`, each a boolean. |
| PATCH | `/v1/me/notification-settings` | profile | Any of those keys → boolean; unknown keys are a 400. Returns all four. |

### Towns (DP-017)

A User keeps up to 10 towns (`user_cities`) and has one active
(`users.city_code`, always one of them). Both routes return the updated
profile.

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/v1/me/cities` | profile | Body `{cityCode}`. Saves a town (idempotent). It becomes active only if the caller had none. 400 unknown city, 409 past the limit. |
| DELETE | `/v1/me/cities/:cityCode` | profile | Forgets a town. If it was active, the most recently saved remaining town becomes active, or none if it was the last. |

### Locations (DP-017)

Reference data: Indonesia's 38 provinces and 514 cities/regencies, seeded
by migration `0027_indonesia_cities` (official region codes; source
recorded in that file). "City" means a kota or a kabupaten — the name
says which. A User's town (`users.city_code`) and a Club's location
(`clubs.city_code`) both point at it.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/v1/locations` | profile | `{provinces: [{code, name}], cities: [{code, provinceCode, name}]}` — the whole list in one response, `Cache-Control: private, max-age=86400`. Provinces by name; cities by province, then by name ignoring the Kota/Kabupaten prefix. The city picker filters it on the device. |

### Profile pictures

Club and User both carry a real, working profile picture now — stored
directly in Postgres (`bytea`), same pattern as DP-011 Chat images and
Milestone 5 receipts (no object storage/CDN provisioned anywhere in
this app). A list/get response never embeds the bytes, only a computed
`hasAvatar` boolean; the actual image is fetched separately through its
own authenticated endpoint (`GET .../avatar`), same reasoning as
`hasReceipt`/receipt images — a polled or frequently-refetched list
response should never re-transfer image bytes for a picture already on
screen. `User.avatarUrl` / `ClubMember.avatarUrl` / `Club` having no
`avatarUrl` at all are leftovers from an earlier, never-wired
string-URL stub (nothing ever set or read it through a real upload
path) — left in place, unused, rather than ripped out as part of this
change.

### Online indicator (DP-014)

`User`/`UserSummary`/`ClubMember` all carry a computed `isOnline` bool
— `(last_active_at IS NOT NULL AND last_active_at > now() - interval
'2 minutes')`, `isOnlineExpr` in `internal/db/users.go`. No push/
websocket presence exists anywhere in this app: `last_active_at` is
stamped by `authjwt.RequireProfile` on every authenticated request,
fire-and-forget in a goroutine so it never adds latency to the request
it's riding on. 2 minutes is an engineering choice, not a persisted
online/offline state — there's no explicit "went offline" event, it
just ages out.

## Clubs

| Method | Path | Auth | Extra check | Notes |
|---|---|---|---|---|
| POST | `/v1/clubs` | profile | — | Body `{name, cityCode, description?, visibility?}`. `cityCode` (DP-017) is required and must be a city in the reference list (400 "choose a city" / "unknown city"). `visibility` is `"public"` (default) or `"private"`. Caller becomes `owner`. |
| GET | `/v1/clubs` | profile | — | Lists clubs the caller is a member of, with role, ordered by `created_at DESC`. |
| GET | `/v1/clubs/:clubId` | profile | member | The full Club, including `cityCode`, `cityName` (display form, e.g. `"Kota Bandung, Jawa Barat"`, resolved at read time) and `visibility`. Non-members use `/preview` below. |
| GET | `/v1/clubs/search?q=` | profile | — | DP-017. Clubs whose name, or whose city's or province's name, contains `q` (case-insensitive), private ones included. Clubs matching by their own name first, then larger Clubs; capped at 20. `[]` under 2 characters. Returns `ClubPreview[]`. |
| GET | `/v1/clubs/in-my-city` | profile | — | DP-017. Clubs in the caller's **active** town, excluding Clubs the caller is already in. Larger Clubs first, capped at 20. `[]` if the caller has no city. Returns `ClubPreview[]`. |
| GET | `/v1/clubs/:clubId/preview` | profile | — | DP-017. `ClubPreview`: `{id, name, description?, cityCode?, cityName?, visibility, hasAvatar, memberCount, viewerRole?, viewerRequestPending}` — nothing member-only, and no invite code. `viewerRole` is the caller's role if they are a member; `viewerRequestPending` is true while their join request waits. 404 if the Club doesn't exist. |
| POST | `/v1/clubs/:clubId/join` | profile | — | DP-017. Public Club: the caller becomes a `member`. Private Club: a pending join request is recorded. Idempotent both ways. Returns the `ClubPreview`, which says which happened. |
| DELETE | `/v1/clubs/:clubId/join-request` | profile | — | The caller withdraws their own pending request. 204 whether or not one existed. |
| GET | `/v1/clubs/:clubId/join-requests` | profile | owner/admin | Pending requests, oldest first: `{id, clubId, userId, username, displayName?, hasAvatar, createdAt}`. |
| POST | `/v1/clubs/:clubId/join-requests/:requestId/approve` | profile | owner/admin | Marks it approved and adds the requester as a `member` in one transaction. 404 if it is no longer pending (already decided, or cancelled by the requester). |
| POST | `/v1/clubs/:clubId/join-requests/:requestId/decline` | profile | owner/admin | Marks it declined. The person may request again. Same 404. |
| PATCH | `/v1/clubs/:clubId` | profile | owner | Body `{name?, description?, cityCode?, visibility?}`. Same validation as create. Switching to `"public"` leaves pending join requests pending. |
| DELETE | `/v1/clubs/:clubId` | profile | owner | Cascades `club_members`, `sessions`, etc. via FK. |
| POST | `/v1/clubs/:clubId/avatar` | profile | owner | Body `{imageBase64, imageContentType}`. Same size/content-type validation as every other image upload. See "Profile pictures" below. |
| GET | `/v1/clubs/:clubId/avatar` | profile | — | Open to any signed-in user since DP-017 (a Club's picture is part of its preview). Serves the raw image bytes. 404 if the Club has no picture. |
| GET | `/v1/clubs/:clubId/members` | profile | member | |
| POST | `/v1/clubs/:clubId/members` | profile | owner | Body `{username}`. Direct-add, no invite flow. 404 if username not found, 409 if already a member. |
| PATCH | `/v1/clubs/:clubId/members/:userId` | profile | owner | Body `{role}` — `"member"` or `"admin"` only; cannot set/unset `"owner"` here. |
| DELETE | `/v1/clubs/:clubId/members/:userId` | profile | owner, or self | Removing the sole remaining owner returns 409. |
| GET | `/v1/clubs/:clubId/bank-accounts` | profile | member | Milestone 5. Oldest-first. A Club can list more than one. |
| POST | `/v1/clubs/:clubId/bank-accounts` | profile | owner | Milestone 5. Body `{bankName, accountNumber, accountName}`, all required (400 if any is empty). |
| PATCH | `/v1/clubs/:clubId/bank-accounts/:accountId` | profile | owner | Milestone 5. Body `{bankName?, accountNumber?, accountName?}`, `COALESCE`-based partial update. 404 if the account doesn't belong to `:clubId`. |
| DELETE | `/v1/clubs/:clubId/bank-accounts/:accountId` | profile | owner | Milestone 5. 404 if the account doesn't belong to `:clubId`. |

Joining a Club by invite code — `POST /v1/clubs/join`, plus the owner-
facing `POST /v1/clubs/:clubId/invite-code/regenerate` — was removed
(both the routes and every UI entry point). Self-service joining is
planned to come back as Club search from the Explore tab instead
(currently a placeholder, see `docs/current/navigation.md`); until that
ships, a member can only be added by a Club owner/admin
(`POST /v1/clubs/:clubId/members`, by username). `clubs.invite_code`
itself is still a real, generated, `NOT NULL UNIQUE` column — nothing
touched the schema, only the application layer — it's simply unused by
any route now.

## Sessions

| Method | Path | Auth | Extra check | Notes |
|---|---|---|---|---|
| POST | `/v1/clubs/:clubId/sessions` | profile | owner/admin of club | Body `{sport, name, location, activityType, startsAt, durationMinutes, hostPlaying, skillLevelMinId?, skillLevelMaxId?, skillLevelEnforcement?, description?, courtCount?, maxParticipants?, defaultMatchFormat?, defaultSingleDeuce?}`. `sport`/`name`/`location`/`activityType`/`startsAt`/`durationMinutes`/`hostPlaying` are **mandatory** — 400 if any is missing (no more server-side auto-generated name fallback). `durationMinutes` must be a multiple of 60 between 60 and 1440 (1-24 hours) — 400 otherwise. `description` and `maxParticipants` are always optional. `hostPlaying` (DP-004): if `true`, the creator is added as a `registered` participant right after the Session is created — via `db.AddRegisteredParticipant` directly, so it bypasses the Strict Skill Level gate (`enforceStrictSkillLevel`) that a normal join would go through. Milestone 2 (revised): previously landed at `checked_in` directly; Checked In specifically means physically present, which is what the Check-In Window exists to gate, so the organizer now checks in for real like anyone else once it opens. `activityType` (opaque, Sport-Module-owned, e.g. tennis `single`/`double`/`class`) is distinct from `defaultMatchFormat`/`defaultSingleDeuce` (Match Setup, DP-005) — together these seed every match's *scoring* format/deuce rule generated from this Session, set once by `CreateSessionScreen` and read by `AddMatchScreen`, never reconfigured there. Both nullable — no CHECK constraint, validated only by the `MatchFormat` union being opaque JSONB (unvalidated server-side, same as `Activity.config`). `startsAt`+`durationMinutes` (DP-009) are core Session properties, required together. `startsAt` cannot be in the past (Milestone 2, 400 if so — mirrored client-side in `CreateSessionScreen`'s validation). `skillLevel*` (DP-008, **optional as of v0.7.0**) — `validateSkillLevelRange` allows all three unset (no requirement), but if any one is set, all three must be, 400 if partial or if the two ids don't resolve to real levels of `sport`'s own scale with `min.rank <= max.rank`. `priceModel`/`pricePerPerson`/`totalPrice` (DP-010, optional, defaults to `"free"` via `validatePriceModel`) — `"free"` needs neither amount, `"per_person"` requires a positive `pricePerPerson`, `"split_bill"` requires a positive `totalPrice`; whichever amount doesn't apply to the chosen model is silently dropped (never persisted) rather than erroring if sent anyway. |
| GET | `/v1/clubs/:clubId/sessions` | profile | member | DP-001: `draft` sessions excluded from the list unless the caller is owner/admin of the club. As of v0.6.3, each Session includes a computed `joinedCount` (DP-002 headcount: `registered`+`checked_in`+`checked_out`, via `db.CountJoinedParticipants` — one batched query, not N+1). As of Milestone 2, also includes a computed `lifecycleStatus` — DP-001's resolved lifecycle state (`draft`/`recruiting`/`ready`/`full`/`in_progress`/`completed`/`cancelled`), resolved fresh on every response, never persisted (see `docs/current/lifecycle-session.md`). |
| GET | `/v1/me/sessions` | profile | self | DP-009 cross-Club Session History. Every non-draft Session the caller has joined (participant status `registered`/`checked_in`/`checked_out`) in Clubs they still belong to, newest `startsAt` first. Each entry is a Session (with `joinedCount`/`lifecycleStatus`) plus `clubName`. Not filtered to past dates — the client buckets by local calendar day, same as the Club-scoped history. |
| GET | `/v1/sessions/:id` | profile | member of parent club | Also includes computed `joinedCount`/`lifecycleStatus`, same definitions as the list endpoint. |
| PATCH | `/v1/sessions/:id` | profile | owner/admin | Body `{name?, location?, description?, status?, maxParticipants?, defaultMatchFormat?, defaultSingleDeuce?, activityType?, startsAt?, durationMinutes?, skillLevelMinId?, skillLevelMaxId?, skillLevelEnforcement?, hostPlaying?}`. `status` is now a guarded transition — `draft→open→in_progress→completed`, `cancelled` reachable from any non-terminal state — 409 if the transition from the session's current status isn't allowed, not just a flat set of valid strings (the DP-009 auto-start/auto-transition jobs bypass this guard entirely, see below). `publishSession`/`cancelSession` in `core/sessions/api.ts` are named wrappers over this same endpoint, not separate routes. There is deliberately no `startSession`/`completeSession` wrapper — as of Milestone 2 (revised), both `in_progress` and `completed` are reached only via the DP-009 auto-start/auto-transition jobs below, never an organizer PATCH; an earlier pass of this milestone briefly added a manual Start Session action, then removed it again in favor of auto-start. All fields here are independent partial updates (unlike `POST`'s all-or-nothing mandate) — each `skillLevel*` id just needs to belong to the session's sport; `durationMinutes`, if set, is still bound-checked (multiple of 60, 60-1440); `startsAt`, if set, cannot be in the past (Milestone 2, same rule as POST). `hostPlaying`, if set, is a plain value write — no auto-checkin side effect on PATCH, unlike POST. `priceModel`/`pricePerPerson`/`totalPrice` (DP-010) via `validatePriceModelForUpdate` — omitting `priceModel` entirely leaves price untouched; sending it re-validates/normalizes the same as POST. **Known limitation, same as Skill Level**: switching `priceModel` away from `per_person`/`split_bill` doesn't clear the now-irrelevant stale amount column (COALESCE can't distinguish "omitted" from "explicitly clear"), harmless since every reader branches on `priceModel` first. `defaultMatchFormat`/`defaultSingleDeuce` (DP-005 Match Setup) — plain `COALESCE`-based partial updates, no validation beyond opaque JSONB/nullable boolean; this is how `CreateSessionScreen`'s edit mode (also reached from the ⋯ menu's Match setup sheet) changes Match Setup after creation. Response also includes `joinedCount`/`lifecycleStatus` (every Session response also carries `matchesOpenAt` — `starts_at` minus the early-start allowance, DP-022 — when it has a start time) — fixed in Milestone 2 to actually query the current participant count (previously silently returned `joinedCount: 0` on every PATCH). On a Session generated by a Recurring Schedule, a PATCH carrying any Template field sets `edited_after_generation`, which excludes it from DP-007 Session Synchronization. |
| DELETE | `/v1/sessions/:id` | profile | owner/admin | Milestone 2 — "Discard." Hard-deletes a **Draft-only** Session — `db.DeleteSession`'s query itself requires `status = 'draft'` (409 if not, 404 if the session doesn't exist at all), the only hard-delete anywhere in the Sessions domain (everything published only ever gets Cancel's soft, visible-record terminal state). Participants/Activities cascade via FK (`ON DELETE CASCADE`). `discardDraftSession()` in `core/sessions/api.ts`. |
| GET | `/v1/sessions/:id/participants` | profile | member | |
| POST | `/v1/sessions/:id/register` | profile | member | As of v0.10.0 (DP-002 Join Approval): this is the **"request to join" action** — creates a `requested` row, idempotent (no-op if a row already exists in any status — except `cancelled`: someone who cancelled their own spot may ask again, and their row starts over as a fresh request with check-in times and any earlier receipt cleared). Has a real screen now (`SessionDetailScreen`'s "Request to Join"). Strict Skill Level (`enforceStrictSkillLevel`) is enforced here — an ineligible member can't even request. |
| POST | `/v1/sessions/:id/participants/:userId/approve` | profile | owner/admin | As of v0.10.0. Moves a `requested` row to `waitlist` (approved, not yet claimed) — or, on a `free` Session, straight to `registered` (v0.24.0; migration `0037` registered any free-Session rows already on the waitlist). 409 if not currently `requested`, 404 if no row. |
| POST | `/v1/sessions/:id/participants/:userId/confirm-payment` | profile | owner/admin | As of v0.10.0. Moves a `waitlist` row to `registered` (slot claimed). No payment gateway — this just records that the organizer received payment outside the app. 409 if not currently `waitlist`, 404 if no row. Exposed in Players: an organizer's ⋯ on a waitlisted player's row (`PlayerRowSheet` → `ParticipantPayment`, DP-024). |
| POST | `/v1/sessions/:id/receipt` | profile | `requireSessionAccess` | Milestone 5. Self-service only — attaches to the caller's own participant row. Body `{imageBase64, imageContentType}`, same validation as DP-011 Chat images (`image/jpeg`/`image/png`/`image/webp`, 5MB decoded cap, 8MB request-body cap). 404 if the caller has no participant row in this Session at all. Overwrites any previous receipt — no history, no separate edit/delete route. |
| GET | `/v1/sessions/:id/participants/:participantId/receipt` | profile | `requireSessionAccess` **+ self or owner/admin** | Milestone 5. Serves the raw image bytes with its stored `Content-Type`, 404 if no receipt. Deliberately narrower than every other read in this domain: even a fellow Club member who can see the Session gets 403 unless they're the uploader themselves or owner/admin — everyone else only ever sees the participant's `status` (paid vs. awaiting) via the normal list, never this image. |
| DELETE | `/v1/sessions/:id/participants/:userId` | profile | owner/admin | As of v0.10.0. Hard-removes a participant row entirely (e.g. declining a request, or removing someone outright) — distinct from Cancel/NoShow, which record what happened. 404 if no row. Despite the path segment's name, `db.DeleteParticipant` matches on either `user_id` or the row's own `id` (Milestone 2, revised) — the same route removes a guest too, passing the guest's participant id. |
| POST | `/v1/sessions/:id/checkin` | profile | member | As of v0.10.0: no longer upserts/auto-registers — requires the caller already be `registered` (`db.SelfCheckIn`, a guarded transition; 409 if not `registered`, 404 if no row at all). Strict Skill Level is **not** re-checked here anymore — it's enforced at `/register` instead. Still gated by the Check-In Window (v0.9.0): 403 unless `now` is within `[startsAt - 1h, startsAt + durationMinutes)` — `checkInWindowOpen` in `sessions_handler.go`; no-op (unrestricted) for Sessions missing `startsAt`/`durationMinutes`. |
| POST | `/v1/sessions/:id/participants/:userId/add` | profile | owner/admin | Milestone 2 (revised). Adds an existing club member directly as `registered` — `db.AddRegisteredParticipant`, idempotent (a pre-existing row in any status is left unchanged, mirrors `RegisterParticipant`'s contract). No Check-In Window gate (roster-building, not a check-in action) and Strict Skill Level is **not** enforced (same bypass Host Playing gets). Called by `SessionDetailScreen`'s participant-placeholder "Member" option. |
| POST | `/v1/sessions/:id/checkin/:participantId` | profile | owner/admin | Milestone 2 (revised). Moves an already-`registered` participant to `checked_in` — `db.CheckInParticipantByID`, a guarded transition (409 if not currently `registered`, 404 if no row) keyed by the participant row's own id rather than `user_id`, so it works for guests too. Gated by the Check-In Window, same as `/checkin` above. This is the **only** way a participant reaches `checked_in` besides self-service `/checkin` — replaces the old `POST /v1/sessions/:id/participants/:userId/checkin` (v0.8.3, removed), which upserted straight to `checked_in` in one step. Called by the **Confirmed** section's check-in action in `SessionDetailScreen`. |
| POST | `/v1/sessions/:id/checkout` | profile | member | Self-service, mirrors `/checkin`'s shape. DP-002. As of Milestone 2 (revised): `SessionDetailScreen`'s self-service area shows a "Check Out" link once `checked_in` — auto-regenerates any still-queued match the caller was part of, same as an organizer removal (see `lifecycle-session.md`). |
| POST | `/v1/sessions/:id/cancel` | profile | member | Self-service. DP-002. As of Milestone 2 (revised): `SessionDetailScreen`'s self-service area shows a "Cancel my spot" link while `requested`/`waitlist`/`registered` (not offered once `checked_in` — Check Out is the equivalent from there). |
| POST | `/v1/sessions/:id/participants/:userId/no-show` | profile | owner/admin | Marks another participant `no_show` — not self-service, unlike checkout/cancel. DP-002. No screen calls this yet — API only. |
| POST | `/v1/sessions/:id/participants` | profile | owner/admin | Body `{guestName}`. Adds a guest directly as `registered` (via `db.AddGuestParticipant`, bypasses Requested/Waitlist) — Milestone 2 (revised): previously landed at `checked_in` directly; no longer Check-In Window gated, same reasoning as the member-add route above. Called by `SessionDetailScreen`'s participant-placeholder "Guest" option. |

`session_participants.status` now also accepts `checked_out`/`cancelled`/`no_show` alongside the original `registered`/`checked_in`, plus `requested`/`waitlist` (v0.10.0, DP-002 Join Approval) — see `lifecycle-session.md`. `participated` was dropped (never set by any code path).

Every participant read (list and single) now also includes `hasReceipt` (Milestone 5, DP-012) — a bool computed from `receipt_image_data IS NOT NULL`, never the image bytes themselves. See the receipt endpoints above for how the bytes are actually fetched, and their narrower access rule.

### Conversations — Session Chat (DP-011) & Contact Organizer (DP-013)

Both share one messaging engine server-side (`conversations` +
`conversation_messages`, `internal/db/conversations.go`) — per explicit
product direction, the only real differences are **participants** and
**whether a posting window applies**; the message mechanics (compose,
list, optional image) are identical. A `conversations` row's
`kind` is `session_chat` (shared, `member_user_id` NULL — everyone who
can already see the Session) or `session_contact` (private,
`member_user_id` set — that member, plus any owner/admin of the
Session's Club). Both are created lazily on first message, never
pre-created. Every response below is the same `ConversationMessage`
shape: `{id, conversationId, sessionId, senderId, senderUsername,
senderDisplayName?, body, hasImage, createdAt}`.

| Method | Path | Auth | Extra check | Notes |
|---|---|---|---|---|
| GET | `/v1/sessions/:id/messages` | profile | `requireSessionAccess` | The `session_chat` conversation, oldest-first, no pagination. Empty list (not an error) if nobody has posted yet. |
| POST | `/v1/sessions/:id/messages` | profile | `requireSessionAccess` + `sessionChatWindowOpen` | Body `{body?, imageBase64?, imageContentType?}` — at least one of `body`/image required, same validation as every other image upload (5MB decoded cap, 8MB request-body cap, jpeg/png/webp only). 403 once `now` is 1 week or more past `startsAt + durationMinutes` — Chat becomes permanently read-only past that point, history stays visible via GET. No editing/deleting. |
| GET | `/v1/sessions/:id/contact/:userId` | profile | `requireSessionAccess` + (self or owner/admin) | The `session_contact` conversation for that member, oldest-first. 403 if the caller is neither `:userId` themselves nor owner/admin. |
| POST | `/v1/sessions/:id/contact/:userId` | profile | `requireSessionAccess` + (self or owner/admin) | Same body shape and validation as Chat's POST above. **No posting-window check** — unlike Chat, a Contact Organizer thread never closes. A plain member can only post as themselves (`:userId` must equal their own id); an owner/admin can post into any member's thread for this Session. |
| GET | `/v1/sessions/:id/contact` | profile | `requireSessionAccess` + owner/admin | One row per member who has messaged this Session's organizers, most-recently-active first, each with a `needsReply` bool (the member's last message hasn't been answered by any organizer yet). Owner/admin only — a plain member never sees other members' threads. |
| GET | `/v1/sessions/:id/conversation-messages/:messageId/image` | profile | `requireSessionAccess` (+ self-or-owner/admin if the message belongs to a `session_contact` conversation) | Shared image-serving route for both Chat and Contact Organizer messages — access is resolved per-message from its owning conversation's `kind`. Serves raw bytes with the stored `Content-Type`, 404 if the message has no image or doesn't belong to `:id`. `Cache-Control: private, max-age=31536000, immutable`. Fetched one at a time (`<Image source={{uri, headers}}>`), never bundled into a list response. |

`GET /v1/me/contact-threads` (Users section above) is the cross-Session
Inbox listing — every `session_contact` conversation the caller is a
party to, either as the member or as an organizer, with `needsReply`
computed relative to the caller specifically (`contactThreadNeedsReply`
in `internal/db/conversations.go`).

**DP-009 auto-start / auto-transition** (no endpoint — background processes, `internal/scheduling.AutoStartDueSessions` and `AutoTransitionElapsedSessions`, both riding the same ticker as DP-007 generation): once an `open` Session's `starts_at` arrives, it's auto-started to `in_progress` (Milestone 2, revised — no manual "Start Session" action) — unless its first match already started it early (DP-022). Once `starts_at + duration_minutes` has passed, a Session still `in_progress` is set to `completed` and its queued matches to `not_played` (DP-027); the same tick saves live matches past their grace hour as `unfinished` (`scheduling.UnfinishOverdueMatches`); any other non-terminal Session (a Draft that was never published/started) is set to `cancelled`. Both write directly via `db.SetSessionStatus`, bypassing `sessionStatusTransitions` — that guard is for organizer-initiated PATCH calls only.

## Activities

| Method | Path | Auth | Extra check | Notes |
|---|---|---|---|---|
| POST | `/v1/sessions/:id/activities` | profile | owner/admin | Body `{config, participants: [{userId\|guestName, team?}]}`. Creates a `queued` activity. `config`/`result` are opaque JSON, not validated server-side. |
| GET | `/v1/sessions/:id/activities` | profile | member | Ordered live → queued → completed, then `created_at ASC` within each. |
| GET | `/v1/activities/:id` | profile | member of parent club | Returns `ActivityDetail` (activity + participants). |
| POST | `/v1/activities/:id/start` | profile | the Session's umpire (DP-023) | `queued → live`. Sets `scorer_user_id` = the umpire, `started_at` = now. 409 unless matches are open (`db.MatchesOpen`, checked first): the Session is `in_progress`, or it is `open` and now is at or after `starts_at` minus `MATCH_EARLY_START_MINUTES` (default 10, DP-022) — also 409 if the activity isn't currently `queued`. 403 for anyone but the umpire, owners/admins and the match's own players included. Starting a match on an `open` Session moves the Session to `in_progress` (`db.StartSessionEarly`, only from `open`); it still completes at `starts_at + duration_minutes`. |
| POST | `/v1/activities/:id/complete` | profile | the Session's umpire | Body `{result, pointLog?}`. `live → completed`. 403 for anyone else. 409 if not currently `live`, or once scoring has closed — an hour after a Completed Session's end (DP-027); the same for `end-early`. |
| POST | `/v1/activities/:id/end-early` | profile | the Session's umpire | DP-025 End match early. Body `{result, pointLog?}` (the score so far). `live → unfinished` — neither a win nor a loss (stats read `completed` only). 409 if not currently `live`. |
| DELETE | `/v1/activities/:id` | profile | owner/admin | As of v0.8.0. Only a `queued` match can be deleted — 409 otherwise (`db.DeleteActivity`). Used by the client's Regenerate-matches flow (`AddMatchScreen`/`SessionDetailScreen`), which deletes every currently queued match before generating a fresh fair round; not exposed as a standalone "delete this match" action anywhere in the UI yet. |

Not implemented: activity edit while queued (`PATCH /v1/activities/:id`),
auto-generation as a standalone endpoint (match generation instead
happens client-side — see DP-005's Match Generation — by calling the
existing `POST /v1/sessions/:id/activities` once per generated match).
Handing scoring over happens per Session, through its umpire (below).

### Umpire (DP-023)

| Method | Path | Auth | Extra check | Notes |
|---|---|---|---|---|
| PUT | `/v1/sessions/:id/umpire` | profile | owner/admin | Body `{userId}`. The target must be a `checked_in` participant of the Session (playing or not), or the caller themselves (reclaim, checked in or not) — 400 otherwise. 409 on a `completed` or `cancelled` Session. Sets `sessions.umpire_user_id`; every `live` match of the Session gets `scorer_user_id` = the new umpire, and its live copy in Firebase gets the new `scorerUid` (when `FIREBASE_SERVICE_ACCOUNT_FILE` and `FIREBASE_DATABASE_URL` are set). Notifies the new umpire (`umpire_assigned`, not when they took it themselves). Returns the Session. |

Every Session payload carries `umpireUserId` (the creator by default) and
`umpireName`.

## Skill Levels (DP-008)

The Level Scale is owned by the Sport Module (DP-ARCH-002) and scoped per
sport — Tennis is the only seeded sport today (`newbie` through
`advanced`). Data in `skill_levels`, not a fixed enum — adding/renaming/
reordering a sport's scale is a row change, no migration.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/v1/skill-levels?sport=` | profile | The ordered scale for one sport, lowest rank first. 400 if `sport` is omitted. |
| GET | `/v1/me/skill-levels` | profile | The caller's self-reported level for every sport they've set one for. |
| PUT | `/v1/me/skill-levels/:sport` | profile | Body `{skillLevelId}`. Self-reported only — no organizer/admin override exists anywhere. Upserts; 400 if `skillLevelId` doesn't exist or belongs to a different sport. |

## Recurring Schedules (DP-007, Milestone D.1)

Organizer-only management surface (owner/admin of the parent club — unlike
Sessions, there's no member-visible view of a Recurring Schedule itself,
only of the Sessions it generates).

| Method | Path | Auth | Extra check | Notes |
|---|---|---|---|---|
| POST | `/v1/clubs/:clubId/recurring-schedules` | profile | owner/admin | Body `{sport, name, location, activityType, recurrenceRule, generationLeadDays, hostPlaying, skillLevelMinId?, skillLevelMaxId?, skillLevelEnforcement?, description?, courtCount?, maxParticipants?, defaultMatchFormat?, defaultSingleDeuce?, generationTime?, endDate?}`. `recurrenceRule` is `{weekday, time, durationMinutes, timezone}` — weekly-only shape, an engineering default, not product-specified; `durationMinutes` must be a multiple of 60 between 60 and 1440 (1-24 hours, v0.6.0) — 400 otherwise. `name`/`location`/`activityType`/`hostPlaying` are mandatory, same as Sessions' own `POST`; the Skill Level range is optional but all-or-nothing (v0.7.0), same rule as Sessions — whichever fields are set are copied onto every generated Session. `hostPlaying` (v0.6.1): if `true`, the Schedule's creator is added as a `registered` participant on every generated Session, same bypass-Strict-Skill-Level behavior as ad-hoc creation (and same Milestone 2 revision — `registered`, not `checked_in`). `priceModel`/`pricePerPerson`/`totalPrice` (DP-010) — same optional, all-or-nothing-per-model rule as ad-hoc Sessions, copied onto every generated Session (`internal/scheduling/generate.go`). `defaultMatchFormat`/`defaultSingleDeuce` (DP-005 Match Setup) — same fields as ad-hoc Sessions, copied onto every generated Session the same way. |
| GET | `/v1/clubs/:clubId/recurring-schedules` | profile | owner/admin | |
| GET | `/v1/clubs/:clubId/recurring-schedules/:id` | profile | owner/admin | 404 if the schedule doesn't belong to `:clubId`. |
| PATCH | `/v1/clubs/:clubId/recurring-schedules/:id` | profile | owner/admin | Same body shape as create, all fields optional. Template/Recurrence Rule/Generation Policy/end date only — never touches already-generated Sessions; that is the separate `sync-sessions` step below. |
| GET | `/v1/clubs/:clubId/recurring-schedules/:id/sync-sessions` | profile | owner/admin | DP-007 Session Synchronization preview. Returns `{updated, skippedEdited}`: how many upcoming generated Sessions (`starts_at > now()`, status `draft`/`open`) a sync would overwrite, and how many it would skip because they were edited by hand. Changes nothing. |
| POST | `/v1/clubs/:clubId/recurring-schedules/:id/sync-sessions` | profile | owner/admin | Overwrites every Template field on the eligible Sessions with the Schedule's current values; never `startsAt`/`durationMinutes`. Returns the same `{updated, skippedEdited}` shape. See `docs/current/lifecycle-recurring-schedule.md`. |
| POST | `/v1/clubs/:clubId/recurring-schedules/:id/pause` | profile | owner/admin | Stops future generation; existing Sessions unchanged. |
| POST | `/v1/clubs/:clubId/recurring-schedules/:id/resume` | profile | owner/admin | |
| DELETE | `/v1/clubs/:clubId/recurring-schedules/:id` | profile | owner/admin | Preserves all generated Sessions — `sessions.recurring_schedule_id` is `ON DELETE SET NULL`. |
| POST | `/v1/clubs/:clubId/recurring-schedules/:id/occurrences/skip` | profile | owner/admin | Body `{occurrenceStartsAt}`. Unifies "skip a future occurrence" and "delete an already-generated Session for this occurrence" into one idempotent operation — writes a tombstone (`recurring_schedule_skips`) and deletes any matching generated Session. |
| POST | `/v1/clubs/:clubId/recurring-schedules/:id/occurrences/generate` | profile | owner/admin | Body `{occurrenceStartsAt}`. Manual override of the automatic ticker — generates this specific occurrence immediately, bypassing the Generation Policy's lead-time gate. 400 if `occurrenceStartsAt` isn't a real occurrence of the Schedule's Recurrence Rule, 409 if it was already skipped, idempotent (returns the existing Session) if already generated. |
| GET | `/v1/clubs/:clubId/recurring-schedules/:id/occurrences?from=&to=` | profile | owner/admin | Preview only, computed from the Recurrence Rule, not stored. Each entry: `{startsAt, status: "pending"\|"generated"\|"skipped"}`. Defaults to the next 8 weeks from now. |

Generation itself has no endpoint — it's a background process
(`internal/scheduling.GenerateDueSessions`), ticking on an in-process
timer (`RECURRING_SCHEDULE_GENERATION_INTERVAL_MINUTES`, default 15) in
`cmd/api/main.go`. See `lifecycle-recurring-schedule.md`.

## Error shape

All errors: `{"error": "<message>"}`, sometimes with a `code` field
(only `PROFILE_NOT_FOUND` currently uses this). No structured
validation-error format — bad input is a flat 400 with a short string.
