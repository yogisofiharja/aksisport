# Client-Side State Machines (Current)

Covers app/UI-level state machines not already described in
`navigation.md` (screen routing), `lifecycle-session.md`,
`lifecycle-activity.md`, or `lifecycle-match.md` (data lifecycles).

## AuthContext (`src/core/auth/AuthContext.tsx`)

```
initializing: true, firebaseUser: null, profile: null
        │
        │ Firebase onAuthStateChanged fires
        ▼
firebaseUser === null                          firebaseUser !== null
  → profile: null, needsProfile: false           → GET /v1/me
    initializing: false                              │
                                          ┌───────────┴───────────┐
                                     200 OK                  404 PROFILE_NOT_FOUND
                                          │                       │
                            profile: <data>          profile: null, needsProfile: true
                            needsProfile: false
                                          └───────────┬───────────┘
                                              initializing: false
```

`loadProfile()` failures other than `PROFILE_NOT_FOUND` are swallowed
(`.catch(() => {})` in the `onAuthStateChanged` handler) — the app
falls through to `initializing: false` with stale/no profile rather
than surfacing a network-error state. There is no retry mechanism.

`RootNavigator` reads `{ firebaseUser, initializing, needsProfile }`
directly off this state to choose Auth/CompleteProfile/Main — see
`navigation.md`.

## ActivityMatchScreen (`src/mobile/activities/ActivityMatchScreen.tsx`)

```
mount
  → loading: true
  → GET /v1/activities/:id
  → also loads the Session (its umpire) and the Club's owners/admins
  → completed: show the stored result (never the live copy)
  → unfinished (DP-025): back to the Session — it has no result screen
  → queued:    show MatchStartScreen (DP-022) — nothing is started yet
  → live, I'm the scorer: resume from the live copy (readLiveMatch) if there is
               one, else createInitialState(config)    [see lifecycle-match.md]
  → live, someone else scores: watch
  → live, either way: subscribe to the live copy (watchLive) —
      its scorerUid moves away from me (DP-023 handover) → spectator view,
        toast "<Name> is umpiring now"
      its scorerUid becomes mine → scorer, from the copy's current state
      unfinished=true and I didn't end it → back to the Session
  → loading: false

MatchStartScreen (queued): pick sides (Team A left or right, "Switch sides")
  and the first server (tap a player, or "Random": the highlight spins across
  the players — at least 16 hops, about 3 seconds, slowing down — until it
  stops on a random one (`spinSteps`); while it spins the line below says
  "Choosing who serves first…" and everything else is disabled; the name
  appears once it stops). Below the sides: "Umpire for this session · <Name>"
  (DP-023) with "Change" (owners/admins, opens UmpireSheet) or "Organizers can
  change this". Only the umpire gets "Start match"; an owner/admin who isn't
  the umpire gets "Make me umpire" instead; everyone else gets neither.
  "Start match":
  POST /start → I'm the scorer: createInitialState with the service order
  rebuilt from the chosen first server (buildServiceOrder), sides kept for the
  match. 409 (another device started first) → watch it instead, with a notice.

render branches on (loading, pendingConfig, error, matchState.isEnded):
  loading            → spinner + "activityLoading" text
  pendingConfig      → MatchStartScreen
  error || !matchState → error text + back button
  matchState.isEnded, not confirmed (DP-025)
                      → MatchFinishedScreen: winner and score. Scorer: "Confirm result"
                        (completeActivity with the state and point log) or "Undo last
                        point" (back to scoring). Others: "Waiting for the umpire to
                        confirm". The live copy keeps the finished state, with
                        confirmed=false, until then.
  matchState.isEnded, confirmed
                      → scorer, just confirmed: ResultSavedScreen — "Share result",
                        "Set up next match" (the Session's first queued match, replacing
                        this screen with its start screen; hidden if none is queued),
                        "Back to session" (goBack to the Matches tab if that's the
                        previous screen, else replace with SessionDetail { tab:
                        'matches' }). Both clear the live copy.
                      → otherwise (opened later, or watched to the end):
                        MatchResultScreen — winner, score, "Share result", back.
  else                → MobileMatchScreen (live scoring UI); the scorer's ⋯ opens
                        Match options (MatchOptionsSheet, DP-023/DP-025): for an
                        umpire who isn't an organizer, "Need a break or leaving
                        early?" naming the organizers to ask; then "End match early"
                        → Dialog "End this match now?" (Keep playing / End match) →
                        POST /end-early with the score so far, the live copy marked
                        unfinished, back to the Session.
```

`MobileMatchScreen` has two modes (DP-022), both with Team A on the side
`teamASide` says (part of the live copy, so spectators see the same
sides):
- **normal** (default): portrait, in the app's look — a top row with the
  chevron back (leaves the screen; a live match keeps going) and, for a
  spectator, the LIVE badge with "Umpire: <name>"; on the right the tools
  (voice, point log, Focus mode, and the scorer's ⋯ Match options); a
  games/sets card; the two teams as tappable cards side by side (server
  marked with a ball and "SERVING"); then Undo;
- **focus**: landscape, the full-screen court — each half a giant tap
  target, score box at the top with Leave focus mode on its left and
  voice/point log/Match options on its right, Undo on the net, the LIVE
  badge at the bottom for spectators.
There is no button that ends a match with a result before it is decided
(the old press-and-hold End was removed): a match finishes on its last
point, or the umpire ends it early as Unfinished from Match options.
On iOS/Android the mode is remembered (`aksi.scoringFocusMode`) and the
phone is locked to the mode's orientation while the screen is open,
unlocked on leaving. On web, Focus mode is offered only where full screen
and `screen.orientation.lock` exist on a touch device (Android browsers):
entering it requests full screen then locks landscape, and the court
covers the whole viewport (`position: fixed`, outside the app's 520px
column); leaving it, or leaving full screen with the browser's gesture,
returns to normal mode. Web always opens in normal mode (full screen must
start from a tap). Which side serves comes from
`getServerTeam` (the server's team, looked up by player id).

The screen doesn't re-check `activities.status` after the initial load;
it trusts local `matchState` for the rest of the screen's life.
`startedRef`/`completedRef` guards exist only to prevent duplicate
network calls (React effect double-invocation in dev), not to represent
additional UI states.

## The retired standalone scorer

The original scorer (`ScoringFlow`: setup → lineup → match → final →
history, local-only, no sign-in) is no longer in this codebase. It is
frozen on the `scorer` branch, served by Vercel. Session matches use
`ActivityMatchScreen` above; its live copy in Firebase RTDB is
`sessionSync.ts`'s `LiveMatchPayload`.
