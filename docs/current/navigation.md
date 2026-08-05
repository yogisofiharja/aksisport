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

firebaseUser && !needsProfile
  → MainStack
```

`needsProfile` comes from `AuthContext`: true when `GET /v1/me` returns
404 `PROFILE_NOT_FOUND` (Firebase account exists, Postgres profile
doesn't — e.g. app was killed mid-signup).

## AuthStack (native-stack, `headerShown: false`)

- **Login** (initial route) → SignUp
- **SignUp** → Login

## MainStack (native-stack, `headerShown: false`)

Initial route is `Personal` (a bottom-tab navigator, see below).
Community/Object screens are still one flat stack, pushed on top of
`Personal` — pushing a native-stack screen naturally covers the tab
bar, which is what makes "entering a Community" feel like a context
switch (`AKSI_INFORMATION_ARCHITECTURE.md`'s "Enter Context" rule)
without any extra code.

```
Personal (initial) — see PersonalTabs below
  ├─→ CreateClub          → replaces with ClubDetail on success
  ├─→ JoinClub            → replaces with ClubDetail on success
  ├─→ Settings            → goBack() (opened from the Me tab)
  └─→ ClubDetail { clubId }
        ├─→ ClubMembers { clubId }
        └─→ SessionList { clubId }
              ├─→ CreateSession { clubId }   → replaces with SessionDetail on success
              └─→ SessionDetail { sessionId }
                    ├─→ AddMatch { sessionId }        → goBack() on success
                    ├─→ ActivityMatch { activityId }  → goBack() on done
                    └─→ EditSession { sessionId }     → goBack() on save (Milestone 2,
                                                          Draft only — see lifecycle-session.md)
```

`EditSession` reuses `CreateSessionScreen` in an "edit mode" (`editingSessionId` prop) rather than a
separate component — same form, pre-filled from the existing (Draft) Session, sport/recurring-toggle
hidden (both immutable after creation), submits via `updateSession()` instead of `createSession()`.

Every screen that isn't the initial route is reached via
`navigation.navigate` (pushes) or `navigation.replace` (create/join
flows, so the form screen isn't left in the back stack). "Back" is
always `navigation.goBack()`. Deleting a Club (`ClubDetail`'s
`onDeleted`) navigates back to `Personal` rather than `goBack()`, since
there's no longer a `ClubList` route to land on.

## PersonalTabs (`src/navigation/PersonalTabs.tsx`, bottom-tabs, `headerShown: false`)

The app's Personal Context — always the post-auth entry point
(`MainStack`'s `Personal` route). Four tabs:

- **Home** (`HomeScreen`) — "My Communities" (the former `ClubList`
  content: list of the user's clubs, Create/Join buttons) plus an
  "Attention" section surfacing any Live or today's-date Session
  across every Community the user belongs to (client-side aggregation
  over `listClubs()` + per-club `listSessions()`; no dedicated
  cross-club backend endpoint yet). Tapping a club pushes `ClubDetail`
  on the parent `MainStack`; tapping an attention item pushes
  `SessionDetail` directly.
- **Explore** (`ExploreScreen`) — placeholder empty state. Real
  discovery behavior is Planning-only in `AKSI_PRODUCT_DECISIONS.md`.
- **Inbox** (`InboxScreen`) — placeholder empty state. No Communication
  data model exists yet.
- **Me** (`MeScreen`) — identity header (username/display name) with a
  gear icon at top-right pushing `Settings` (Theme, Language, Logout;
  supersedes the legacy `SettingsModal` for the authenticated flow).
  Below it, a "Sports" section: one non-interactive card per sport
  (sport name + current level, or "Not set") with a small edit icon
  that expands the card in place to a level-picker (chips), the same
  interaction the now-retired standalone `SkillLevelsScreen` used to
  provide via navigation — fully absorbed into `MeScreen` itself, no
  separate screen/route anymore. Tapping the edit icon is a temporary
  destination; product intent is for the card to eventually open a
  per-sport detail/statistics screen instead, which doesn't exist yet
  (statistics are out of scope) — when that lands, this inline editor
  may move there or stay as a quick-edit affordance.

Tab screens navigate onto the *parent* `MainStack` (e.g. `ClubDetail`,
`Settings`) via `useNavigation<NativeStackNavigationProp<MainStackParamList>>()`
inside `PersonalTabs.tsx`, not their own tab-scoped `navigation` prop —
those routes don't exist on the tab navigator itself.

## Not present

- No tabs inside Community Context yet — `ClubDetail` is still a
  single static screen, not its own Home/Sessions/Communication tab
  bar (Milestone 3).
- No real Explore discovery or Inbox content — both are placeholders.
- No cross-club data beyond Home's attention section — no history,
  no aggregated feed.
- The legacy `SettingsModal` (theme, language, TTS voice) still exists
  unchanged, but only for `MobileSetupScreen` or the legacy
  `ScoringFlow`, which remains unreachable from `MainStack`.

## Web

Web has no navigation library and no screens under `src/navigation/`
or `src/mobile/{auth,clubs,sessions,activities}/`. `App.tsx` renders
`src/mobile/ScoringFlow.tsx` directly, which is its own internal
`useState<AppScreen>` machine — see `docs/current/state-machines.md`.
