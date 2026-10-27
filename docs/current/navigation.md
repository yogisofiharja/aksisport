# Navigation (Current)

Describes the actual `src/navigation/` implementation, mobile only.
Matches `docs/AKSI_INFORMATION_ARCHITECTURE.md`'s Personal Context
(Home/Explore/Inbox/Me) as of Milestone 1 — Personal Context Shell;
Community Context is still a single flat stack (Milestones 2/3 reshape
that side).

## Top level — `RootNavigator.tsx`

```
initializing (Firebase auth state loading)
  → ActivityIndicator, nothing else

!firebaseUser
  → AuthStack

firebaseUser && needsProfile
  → CompleteProfileScreen (no navigator, standalone)

firebaseUser && needsEmail
  → VerifyEmailScreen (no navigator, standalone)

firebaseUser && !needsProfile && !needsEmail
  → MainStack
```

`needsProfile` comes from `AuthContext`: true when `GET /v1/me` returns
404 `PROFILE_NOT_FOUND` (Firebase account exists, Postgres profile
doesn't — e.g. app was killed mid-signup). `needsEmail` (DP-015) is true
for an account created with `emailRequired` that has no confirmed email
yet: the app stays on the confirmation step (enter the code, re-send it,
or correct the address; Log Out is the only other exit).

## AuthStack (native-stack, `headerShown: false`)

- **Login** (initial route) → SignUp, ForgotPassword. The identifier
  field takes a username or a confirmed email; the password field has a
  show/hide toggle.
- **SignUp** → Login. Username, email, password.
- **ForgotPassword** → Login. Three steps in one screen: username or
  email → code + new password → done.

## App bar

The navigators draw no headers; every screen draws its own
`AppBar` (`design-system/layout/AppBar.tsx`), picked by where it sits:

- **root** — the four tabs: Home (date line over "Hi, <first name>", the
  bell), Explore, Inbox (new chat), Me (settings gear, no title).
- **stack** — everything pushed from another screen: back is always the
  chevron, a 17px title with a context line, at most two icons or ⋯.
  The Session screen's context line is "Wed 22 Oct · 19:00 · <Community>";
  chats put the avatar before the title and open the person or group
  from it; Notifications has "Mark all read" as a text action.
- **form** — create and edit (new Community, new/edit Session or
  Recurring Schedule, Add match, display name, email, new chat / add
  people): ✕ Close on the left.
- **dark** — the live scoring screen.

The auth screens (Log in, Sign up, Confirm email, Complete profile) keep
their own layouts; Forgot password has a stack bar back to Log in.

## MainStack (native-stack, `headerShown: false`)

Initial route is `Personal` (a bottom-tab navigator, see below).

**The Community route** (`ClubDetail`, `/clubs/:clubId`) renders
`ClubEntryScreen`, which first asks `GET /v1/clubs/:clubId/preview` how
the caller relates to the Community (DP-017):

- a member → `CommunityScreen`: the Community's four tabs (IA v1.1.0),
  Home · Sessions · Chat · Members, the same for every role, drawn with
  the app's `TabBarView` (heat count on Chat for unread Community chat
  messages, and on Members for an owner/admin's pending join requests).
  The tabs are state inside this one screen, not a navigator, so
  switching never builds history: back from any tab goes to the main
  Home (`Personal` › `Home`). The open tab is kept in the route
  (`/clubs/:clubId?tab=members`). The older per-tab addresses
  (`/clubs/:clubId/members`, `/chat`, `/sessions`) still work —
  notifications link to Members — and open the Community on that tab.
  Settings stays behind the ⋯ menu, never a tab;
- anyone else → `ClubPreviewScreen`: picture, name, Public/Private,
  location, member count, description, and one action — "Join community"
  (public; joining swaps to the home in place) or "Request to join"
  (private; then a "Request sent" state with "Cancel request");
- an unknown id → a "Community not found" page.

This is what a shared link opens. The Community's Home tab and
`ClubPreviewScreen` both have a share icon (`src/platform/shareLink.ts`:
the native share sheet, the browser's where it has one, otherwise the
link is copied and a notice says so).
`ClubMembersScreen` lists those requests above the member list with
Approve / Decline; tapping a request opens the requester's player profile
(`PlayerProfileSheet`, DP-019: picture, name, username, online, joined
date, skill level per sport) with the same two actions. On a Session's
Players tab, owner/admins tap any player's row for the same
sheet — the Session's sport first, a within/outside-range badge when the
Session has a level range, and Approve/Decline for a pending request. `CreateClubScreen` asks for a location and a "Private
community" switch; `ClubSettingsScreen` (owner) edits both under "Finding
& joining".

**Settings** (`SettingsScreen`): Display theme (Light / Dark / System)
and Language (English / Bahasa Indonesia) as `Segmented` controls that
apply at once; "Notifications & privacy" rows — Notifications ("3 of 4
kinds on") and Blocked players (the count); Log out as a danger row; then
"Aksi · version <app.json version>".

**Notifications** (DP-018). `HomeScreen`'s app bar has a bell
(`useNotificationBell`) with a heat dot while any are unread, re-counted
on focus and every minute while Home is showing; it pushes `Notifications`
(`/notifications`, `NotificationsScreen`): every notification, newest
first, in two `ListGroup`s, "Unread · n" (bold, heat icon tile, heat
dot) and "Earlier" (time ago for a week, then "14 Oct", with the year
when it isn't this year); "Mark all read" is the AppBar's text action; and —
when this device hasn't allowed notifications yet — an info `Alert` to
turn them on (or say they are blocked).
Opening one marks it read and goes to its `path` (`useLinkTo`).
`PushSync` (mounted with `MainStack`) re-registers the device on
sign-in and on language change, and handles taps: while an Aksi tab is
open the service worker (`public/sw.js`) tells it where to go; otherwise
a new tab opens at the path with `?notif=<id>`, marked read on arrival.
Sign-out unregisters the device first. Permission is first offered right
after joining or asking to join a Community, or asking to join a Session
(`offerPush`); "Not now" is remembered on the device. Settings has a
**Notifications** row opening `NotificationSettings`
(`/settings/notifications`): four switches (Community join requests,
Session join requests, Payments, Session reminders), saved as they're
flipped. A notification about a Session opens it on the tab it concerns
(`?tab=participants|payment|matches` → `SessionDetail`'s `initialTab`; `participants` and `payment` both open Players). On the phone apps push reports itself
unsupported until expo-notifications is set up (`src/platform/push.ts`).

**Player profile, sport page, direct messages** (DP-019, DP-020).
`PlayerProfileSheet` (bottom sheet) has a **Chat** button in its header
(pushes `DirectMessage`, `/messages/:userId`) and lists every sport; tapping
one pushes `PlayerSport` (`/players/:userId/sports/:sport`,
`PlayerSportScreen`): level, five summary tiles (sessions, matches —
completed, draws included —, wins, win rate = wins ÷ (wins + losses), so
draws don't count, and no-shows), matches (vs, partner, score via the sport module's
`formatResult`, won/lost, date and Community) and Sessions (attended or
no-show). The Me tab's sport cards push the same screen for yourself; the
pencil on a card still edits the level in place. `DirectMessageScreen`
uses the shared `ConversationThread` (now taking an `imageUrl` function
instead of a Session id), polls every 5 seconds, and its header opens the
other person's profile sheet. Inbox lists direct conversations first under
"Messages", then the Contact Organizer threads.

**Live messaging** (DP-021). `LiveSync` (mounted next to `PushSync`)
keeps one WebSocket open while signed in (`src/core/live/live.ts`:
reconnects with back-off, and at once on returning to the app).
`ConversationThread` marks its conversation read on each new message,
re-fetches when a `message.created` for it arrives, sends typing every 3
seconds while the draft changes, shows "… is typing" for 5 seconds after
the last signal, and shows "Seen" (direct) or "Seen by N" (others) under
your own latest message. Your messages sit on the right (blue, no name
over them), everyone else's on the left with their name. On web, Enter sends and Shift+Enter adds a new
line (phones keep return as a new line). Chat screens poll every 5 seconds only while the
connection is down (30 otherwise). Inbox rows and the organizer's Contact
Organizer list show unread counts (`UnreadCount`); the Inbox tab shows the
total (`useUnreadMessageCount`); a Session's Chat tab shows its own
(`useSessionChatUnread`). The bell re-counts on `notification.created`.

**Blocking and reporting** (DP-021). `PlayerProfileSheet` has Block /
Unblock and Report under the levels (not on your own profile).
`DirectMessageScreen`'s header has a ⋮ menu with the same; while you
have blocked the person the compose bar is replaced by a notice. In any
chat, long-pressing a message opens a menu (at most three buttons, for
Android): Edit (own, within 15 minutes — the text goes into the compose
bar under an "Editing message" strip, photo button disabled), Delete
(then "Delete for everyone" for your own within 60 hours, and "Delete for
me"), and Report message (someone else's). Deleted messages show "This
message was deleted" / "You deleted this message"; edited ones show
"Edited" before the time.
`ReportSheet` (`src/mobile/safety/`) asks for a reason. Settings has a
Privacy section with Blocked players (`BlockedPlayers`,
`/settings/blocked`). The Community page shows owner/admins a "N reports
to review" callout when there are any and a Reports button, both opening
`ClubReports` (`/clubs/:clubId/reports`): each report with the reported
person (tap for their profile), where it happened, who reported it, the
message copy and the reason, with Remove message (when allowed) and
Dismiss.

**Chats** (DP-020, DP-021). Private chats (`DirectMessage`,
`/messages/:userId`), group chats (`GroupChat`, `/groups/:groupId`) and
Community chat (`ClubChat`, `/clubs/:clubId/chat`) are one screen,
`ChatRoom` (`src/mobile/messages/`), configured with a header and where
messages load from and go to; it wraps the shared `ConversationThread`
(also used inside a Session for Session Chat and Contact Organizer). It
owns loading, the polling fallback and catching a chat's first message
live; all images load from `/v1/conversation-messages/:id/image`.

Inbox's compose icon (pencil on paper) opens `NewChat` (`/messages/new`,
`GroupPeopleScreen`): search people you can message and tick them; one
opens the private chat, two or more create an unnamed group.
`GroupAddPeople` (`/groups/:groupId/add`) is the same screen adding to a
group. Groups show as their name or their members' names (`groupLabel`).
`GroupInfo` (`/groups/:groupId/info`, from the chat's header): optional
name (creator), people (tap for a profile; × to remove, creator), Add
people (creator), Leave group. The Community page has a **Community
chat** button with an unread count; owner/admins get a ⋮ menu to turn it
off/on, and "Delete for everyone" on anyone's message.

**The city picker** (`src/mobile/locations/CityPickerModal.tsx`) is the
one way a place is chosen anywhere — a Community's location and a User's
town. A full-screen modal over `GET /v1/locations` (fetched once per app
run, `core/locations/api.ts`): type two or more characters to search all
514 cities/regencies by city or province name, or pick one of the 38
provinces and then a city within it.
Community/Object screens are still one flat stack, pushed on top of
`Personal` — pushing a native-stack screen naturally covers the tab
bar, which is what makes "entering a Community" feel like a context
switch (`AKSI_INFORMATION_ARCHITECTURE.md`'s "Enter Context" rule)
without any extra code.

```
Personal (initial) — see PersonalTabs below
  ├─→ CreateClub          → replaces with ClubDetail on success
  ├─→ Settings            → goBack() (opened from the Me tab)
  └─→ ClubDetail { clubId, tab? }   (CommunityScreen: Home · Sessions · Chat · Members;
        │                            ClubMembers / ClubChat / SessionList render the same
        │                            screen on that tab)
        ├─→ ClubSettings { clubId }       (owner-only; Bank Accounts + Danger Zone/Delete Community)
        ├─→ ClubReports { clubId }        (owner/admin)
        ├─→ RecurringScheduleList { clubId }
        ├─→ CreateSession { clubId }      → replaces with SessionDetail on success
        └─→ SessionDetail { sessionId }   (from Home's Current Focus or the Sessions tab)
                    ├─→ AddMatch { sessionId }        → goBack() on success
                    ├─→ ActivityMatch { activityId }  → Result saved (DP-025): "Back to session"
                    │                                   goBack()s to the Matches tab if that's where
                    │                                   it came from, else replaces with SessionDetail
                    │                                   { tab: 'matches' }; "Set up next match"
                    │                                   replaces with ActivityMatch for the next
                    │                                   queued match. Finished matches in the list
                    │                                   show their score and a Share button (DP-026),
                    │                                   and open their result (Share, back) at any time.
                    └─→ EditSession { sessionId }     → goBack() on save (Milestone 2,
                                                          Draft only — see lifecycle-session.md)
```

`EditSession` reuses `CreateSessionScreen` in an "edit mode" (`editingSessionId` prop) rather than a
separate component — same form, pre-filled from the existing (Draft) Session, sport/recurring-toggle
hidden (both immutable after creation), submits via `updateSession()` instead of `createSession()`.

Every screen that isn't the initial route is reached via
`navigation.navigate` (pushes) or `navigation.replace` (create/join
flows, so the form screen isn't left in the back stack). "Back" is
always `navigation.goBack()`. Deleting a Club (`ClubSettings`'s
`onDeleted`)
navigates back to `Personal` rather than `goBack()`, since there's no
longer a `ClubList` route to land on.

**Community — Home tab** (`CommunityHomeTab`): the dark AppBar (back,
share, ⋯) over `CommunityHeader` — the Community's picture or initials
(tappable to change only for the owner, `POST
/v1/clubs/:clubId/avatar`), the name, "<city> · Public/Private", the
description, and up to three members' avatars stacked with "N members",
which opens the Members tab. For an owner/admin, callouts follow: "N
people want to join · Review" (opens Members) and "N reports to review"
(opens `ClubReports`). Then **Current Focus** (Milestone 3), ranked by
`currentFocusBuckets` (`src/core/sessions/currentFocus.ts`, shared with
the main Home per UX-015): a live Session as its `SessionCard` (heat
border, players, Open matches), then today's Sessions, the single
soonest upcoming one and every Draft (owner/admin only — `listSessions`
excludes Drafts for a plain member server-side, DP-001) as compact rows
in one `ListGroup` (day block, name, "19:00 · 6/12 players", status
pill). Empty state text differs for an owner/admin ("create a session
to get started") vs. a member. The ⋯ menu is a Sheet: Settings (owner),
Reports (owner/admin), Leave community (everyone but the owner, with a
confirmation; the owner can only delete the Community, in Settings).

**ClubSettings** (Milestone 5, DP-012; renamed from an earlier
`ClubBankAccounts`-only pass once Delete Community moved here too):
reached from the Home tab's ⋯ menu — shown only when the caller is the
Club's owner (`isOwner`, not `isOwnerOrAdmin`; matches every other
Club-level setting's permission). `ClubSettingsScreen.tsx` holds two
sections: **Bank Accounts** (a plain list-plus-modal-form, mirrors
`ClubMembersScreen`'s Add Member modal shape — a Club can list more
than one; every priced Session's Players tab reads this same list),
and a **Danger Zone** at the bottom with Delete Community — kept off
the Community's Home deliberately, so it's never a low-friction link on
the screen an owner sees every time they open their Club.

## PersonalTabs (`src/navigation/PersonalTabs.tsx`, bottom-tabs, `headerShown: false`)

The app's Personal Context — always the post-auth entry point
(`MainStack`'s `Personal` route). Four tabs:

- **Home** (`HomeScreen`) — the root AppBar ("Thursday 22 Oct" over
  "Hi, <first name>", the bell). "Right now" first: what needs attention
  across every Community the user belongs to — a live Session as the dark
  `SessionCard variant="hero"` (Live pill, name, "Community · venue",
  Open), then today's, the next and draft Sessions as compact rows in one
  `ListGroup` (`variant="row"`: day block, name, "19:00 · venue ·
  Community", status pill). Ranked with the same Live → Today →
  Next (single soonest upcoming, per Club) → Draft priority as
  Community Home's own Current Focus (`currentFocusBuckets`,
  `src/core/sessions/currentFocus.ts` — shared by both screens per
  UX-015's Consistent Mental Model, rather than each screen inventing
  its own ranking), just merged across every Club instead of scoped to
  one. Client-side aggregation over `listClubs()` + per-club
  `listSessions()`; no dedicated cross-club backend endpoint yet.
  Tapping a Session pushes `SessionDetail` directly. Then "My
  communities" with "Find more" (→ Explore): a horizontal row of
  `ClubCard` tiles (club picture if set, else initials; name; the user's
  role · city) ending in a dashed "New community" tile that pushes
  `CreateClub`; a tile pushes `ClubDetail`. Joining a Community is done
  from Explore or a shared link (DP-017, see below), not from here.
  **First run**: with no Community yet (after a successful load), Home
  instead shows "Welcome to Aksi" as the date line, an illustrated "Find
  your people" card, a dark "Find a community" card (→ Explore), "Start a
  community" (→ `CreateClub`) and a line saying a shared community link
  lands right on that community.
- **Explore** (`ExploreScreen`) — Community search (DP-017). A search
  field queries `GET /v1/clubs/search` from two characters, 300ms after
  the last keystroke. Each result card shows the Community's picture,
  name, **location**, member count, a "Private" badge where it applies,
  and "Joined"/"Requested" if that describes the caller. Tapping one
  pushes `ClubDetail` (Join lives on the Community page, never on the
  row). Before a search is typed, the active town is one filled chip
  under the search field: tapping it opens the city picker, and the town
  picked is saved and made active. Below it, "Communities in <town> ·
  <count>" (`GET /v1/clubs/in-my-city`: Communities in the caller's
  active town that they haven't joined; with none, an illustrated
  EmptyState). With no town at all, a card
  invites them to choose one instead. At the bottom, "Can't find yours?
  Start a community" pushes `CreateClub`.
- **Inbox** (`InboxScreen`) — two `ListGroup` sections. "Messages":
  direct conversations (DP-020) and groups (DP-021) together, most
  recently active first; each row has the avatar (a success ring when
  the person is online; two overlapping initials for a group), the
  name, the time (`inboxTime`: today's time, "Yesterday", the weekday,
  then the date), the last message ("You: …" for your own) and the
  unread `CountBadge`. "Session conversations": every Contact Organizer
  thread (DP-013) the caller is a party to, either as the member (their
  own thread) or as an owner/admin (any member's thread on a Session in
  a Club they run), most-recently-active first, `listMyContactThreads()`
  (`GET /v1/me/contact-threads`), with "<Session> · <last message>"
  under the party's name. With no conversations at all, an illustrated
  EmptyState ("No messages yet"). Tapping a Session row pushes `SessionDetail` with
  `openContactWith: memberUserId` set, which auto-opens
  `SessionContactOrganizer`'s modal straight into that thread instead of
  the session's own Details tab.
- **Me** (`MeScreen`) — a root AppBar with only the settings gear
  (pushes `Settings`). A profile header: the user's own picture (76px;
  tap to change — camera/gallery, self-service only, `POST
  /v1/me/avatar`), the name, "@username · active town", and "Edit
  profile", which pushes `EditDisplayName` (`DisplayNameScreen`, DP-016 —
  set, change, or clear the display name). For an account with no
  confirmed email, a reminder card that can be dismissed (remembered per
  user on the device). "My sports": a `SportCard` per sport, two to a row,
  the first in asphalt — the level (or "Not set") and "23 matches · 14
  won · 61%" from the sport page's summary (`GET` player sport activity,
  DP-019; win rate is wins over wins and losses, `core/players/winRate`).
  The card pushes `PlayerSport` for the user; its pencil opens a Sheet of
  that sport's levels as chips (DP-008), saved on tap. Then one
  `ListGroup`: Session history (pushes `MySessionHistory`,
  `SessionHistoryScreen` with no `clubId`: every past Session the user
  joined, across all Clubs, DP-009), My towns (the towns, active one
  marked, under it; opens a Sheet — DP-017: every saved town with a radio
  mark on the active one, tap another to make it active, × to remove one,
  "Add a town" opens the city picker; all save at once), and Account &
  email ("<email> · confirmed" or "Not set"; pushes `AccountEmail`, the
  same two-step confirmation as the sign-up gate).

Tab screens navigate onto the *parent* `MainStack` (e.g. `ClubDetail`,
`Settings`) via `useNavigation<NativeStackNavigationProp<MainStackParamList>>()`
inside `PersonalTabs.tsx`, not their own tab-scoped `navigation` prop —
those routes don't exist on the tab navigator itself.

## Not present

- No browsing of Communities by distance, popularity or category —
  Explore lists the caller's own city and answers a typed
  query.
- No cross-club data beyond Home's attention section and Me's Session
  History — no aggregated feed.

## Web

Web renders the same `RootNavigator` as native — same stacks, tabs and
screens. `src/navigation/linking.ts` maps every screen to a URL (`/`,
`/explore`, `/inbox`, `/me`, `/clubs/:clubId`, `/clubs/:clubId/sessions`,
`/sessions/:sessionId`, `/clubs/:clubId/schedules/:scheduleId`, …), so
refresh, the browser back button and pasted links work. A page opened
directly gets Home placed underneath it, so in-app back arrows have
somewhere to go. A signed-out visitor opening a deep URL lands on Login
and is taken to that URL after signing in (`restoreIntendedUrl()`).

The original standalone scorer is no longer in this codebase; it is
served from the frozen `scorer` branch on Vercel only.
