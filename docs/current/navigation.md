# Navigation (Current)

Not the target Today/Play/Me tab bar in `docs/product/navigation.md` —
this describes the actual `src/navigation/` implementation, mobile only.

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

Single linear stack, no tabs. Screens and how they're reached:

```
ClubList (initial)
  ├─→ CreateClub          → replaces with ClubDetail on success
  ├─→ JoinClub            → replaces with ClubDetail on success
  └─→ ClubDetail { clubId }
        ├─→ ClubMembers { clubId }
        └─→ SessionList { clubId }
              ├─→ CreateSession { clubId }   → replaces with SessionDetail on success
              └─→ SessionDetail { sessionId }
                    ├─→ AddMatch { sessionId }        → goBack() on success
                    └─→ ActivityMatch { activityId }  → goBack() on done
```

Every screen that isn't the initial route is reached via
`navigation.navigate` (pushes) or `navigation.replace` (create/join
flows, so the form screen isn't left in the back stack). "Back" is
always `navigation.goBack()`.

## Not present

- No bottom tabs, no "Today"/"Play"/"Me" concept.
- No profile/settings screen reachable from `MainStack` — the existing
  `SettingsModal` (theme, language, TTS voice) is only reachable from
  `MobileSetupScreen`, which is part of the legacy `ScoringFlow` and is
  not wired into `MainStack` at all.
- No cross-club view of any kind — every screen below `ClubList`
  requires a `clubId` or something scoped under one.

## Web

Web has no navigation library and no screens under `src/navigation/`
or `src/mobile/{auth,clubs,sessions,activities}/`. `App.tsx` renders
`src/mobile/ScoringFlow.tsx` directly, which is its own internal
`useState<AppScreen>` machine — see `docs/current/state-machines.md`.
