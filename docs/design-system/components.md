# Aksi Sport — Components

Component specs from the Aksi Sport design system (Claude Design,
https://claude.ai/artifact/YSa2PzfDcgixW3tStAbBzW), one section per
component. The `ak-` class names refer to the design system's own preview
CSS; in the app each component maps to the file named in its section and in
`codebase.md`.

## Actions

### Button

Buttons start an action; heat with ink text is the one primary action per screen. In code: `ui/Button.tsx` (`variant` + `action`).

#### Variants
| Class | `ui/Button` props | Use |
| --- | --- | --- |
| `ak-btn--primary` | `variant="solid" action="primary"` | The main action: Join session, Publish, Check in. `heat` fill, `on-heat` (ink) label. One per screen. |
| `ak-btn--secondary` | `variant="solid" action="secondary"` | A strong second action, often organizer-only: Generate matches. `asphalt` fill. |
| `ak-btn--outline` | `variant="outline"` | Neutral actions: Share, Edit. `border-strong` outline. |
| `ak-btn--ghost` | `variant="ghost"` | Low-weight actions in headers: See all. `heat-strong` text. |
| `ak-btn--danger` | `variant="outline" action="negative"` | Destructive entry points. The confirm inside a Dialog uses `ak-btn--danger-solid`. |

Sizes: `ak-btn--sm` (32px, inside cards only), default (44px), `ak-btn--lg` (52px, sticky bottom CTA). `ak-btn--block` fills the width; on mobile, primary actions at the bottom of a screen are always block.

#### IconButton and FAB
- `ak-icon-btn`: 44×44 round hit area, 24px icon, for app-bar actions. Always has `aria-label`. `--filled` for icons over photos or busy backgrounds. In code: a new `IconButton` beside `ui/Button.tsx`, with `accessibilityLabel`.
- `ak-fab`: one extended floating button for the screen's create action (New session on a Community). Sits 16px above the tab bar, right-aligned. Never on a screen that already has a sticky action bar. In code: `ui/Fab.tsx` (heat, ink label, 56px, shadow); the screen pads its content so the last card scrolls clear of it.

#### Rules
- Never white text on heat: it is 3.6:1. Ink on heat is 5.2:1 and is the brand look.
- Labels are verbs in sentence case, two or three words. Indonesian copy follows the same rule ("Gabung sesi"); never fix a button width.
- Pressed state on touch (`active:` classes on `Pressable`), never hover-only. Hover is a bonus on desktop web.
- Disabled shows why nearby ("Session full"), not just a grey button.

### ActionBar

The action bar pins the screen's primary action to the bottom, above the safe area. It replaces the tab bar on detail screens.

- `surface` with a `border` top, 12px padding plus `useSafeAreaInsets().bottom`. Use `KeyboardAvoidingView` so it rides above the keyboard on forms.
- Left: the deciding fact (price, spots left, start time) with the number in the display face. Right: one `lg` primary button. Or a single block button when there is nothing to add.
- The action follows the viewer's state: Request to join → Pay → Check in → Open matches. Never two primary buttons.
- Content above it gets bottom padding equal to the bar's height so nothing hides behind it.

## Forms

### Input

A text input collects one line (or a few, as Textarea) with a visible label and an optional hint. In code: `ui/Input.tsx`.

#### Parts
- `ak-field`: label, control, `ak-hint`. 48px tall controls.
- `ak-field__affix`: a fixed prefix such as `Rp`; the value stays formatted with period thousands.
- `ak-search`: a borderless sunken search bar with a leading icon, for Explore and member search. 44px.
- Textarea: the same field with `<textarea>`; grows from 96px.

#### Rules
- Outline is `border-strong` (3:1) so the control is findable; focus switches it to `heat` with the focus ring.
- `ak-field--error` turns the outline and hint `danger`; the hint says how to fix it, in the user's terms.
- Labels sit above, never placeholder-only. Placeholders show an example, in `ink-muted`.
- Input text is 16px (`text-base`): on the web build, iOS Safari zooms the page into anything smaller.
- No browser focus ring on the web build (`global.css`): the field's own border shows focus.
- Set `keyboardType` (`number-pad`, `email-address`, `phone-pad`), `autoComplete` and `textContentType` so the right keyboard and autofill appear.

### Select

A select trigger shows the current choice; tapping it opens the options in a bottom Sheet on mobile.

- Looks like an Input (48px, `border-strong`), with a chevron. Placeholder state in `ink-muted`.
- Mobile and web-on-phone: open a Sheet with radio rows (see Checkbox). The app already has `platform/webSelectStyle.ts` for web; keep the Sheet on phones.
- More than ~10 options (cities, provinces): open a full-height Sheet with a search bar at the top.
- Build it as an app `SelectField`: the trigger is a `Pressable`, the options a Sheet with radio rows.

### Checkbox

Checkboxes toggle independent options; radios pick one of a few. In code: new `ui/Checkbox.tsx` and `ui/Radio.tsx` on `Pressable` (the gluestack-era `@react-native-aria/checkbox` and `radio` packages are already installed if wanted).

- 22px box, 44px row: the whole row (label and helper text) is the tap target.
- Checked: `heat` fill with an `on-heat` tick; radio: `heat` dot on surface. Unchecked outline `border-strong`.
- Helper text under the label in `caption` style.
- For on/off settings that apply immediately, use a Switch instead. For 2–4 short exclusive options at the top of a form, use the Segmented control.

### Switch

A switch turns a setting on or off immediately, with no Save button. In code: React Native `Switch` with `trackColor` / `thumbColor` from `foundation/colors.ts`, or an app component for the exact look.

- 48×28 track: when on, `ink` with a `ball` thumb in light mode and `ball` with an ink (#131315) thumb in dark mode (keeping heat for the one action on a screen); `border-strong` when off (surface thumb).
- Label on the left, switch on the right, inside a List; helper text in `caption`.
- Used for the per-kind notification settings (DP-018) and Community options like turning Community chat off.

## Navigation

### AppBar

The app bar sits at the top of every screen: back, title, up to two actions.

- Detail (`ak-appbar`): 56px, back on the left, title (with an optional subtitle such as the Community name), actions on the right. Title truncates; never two lines.
- Large (`ak-appbar--large`): root tab screens (Home, Explore, Inbox, Me). Title in the display face at 30px, actions above it on the right.
- Background `ground` with a `border` hairline; it stays put while content scrolls.
- Overflow actions (Edit, Duplicate, Cancel session) go behind the "more" button into an action Sheet, not a dropdown.
- Pad the top by `useSafeAreaInsets().top`. In code: `layout/AppBar.tsx` (`root`, `stack`, `form`; `tone="dark"` for live scoring). The redesign canvas sets the root title at 34px Saira italic and puts a form screen's ✕ Close on the left.

### TabBar

The tab bar is the app's root navigation: Home, Explore, Inbox and Me (Milestone 1), and inside a Community its own four tabs: Home, Sessions, Chat and Members.

- Active tab: `ink` label, `heat-strong` icon, and a short heat bar above it leaning at `slant-lean`, a nod to the mark.
- Unread count: a heat badge with ink numerals, ringed in `surface`. Show numbers up to 99, then "99+".
- Icons are 24px outline, 1.75 stroke; the active icon does not switch to a filled style.
- Four tabs, always labelled. No tab is ever hidden based on role.

In code: `layout/TabBar.tsx` — `TabBarView` draws the bar from a list of tabs, padded by `useSafeAreaInsets().bottom`; `TabBar` adapts it as the bottom tab navigator's `tabBar` in `navigation/PersonalTabs.tsx`, and `mobile/clubs/CommunityScreen.tsx` uses `TabBarView` directly. Detail screens are pushed on a Stack above the tabs, so it hides there and the ActionBar takes over.

### Tabs

Tabs switch between views of one thing. In code: an app `Tabs` component (underline tabs in a horizontal `ScrollView`) and a `Segmented` control, both new in `src/design-system/ui`.

#### Underline tabs
- For the Session tabs: Details, Configuration, Participants, Matches, Chat, Payment. Scroll horizontally; never wrap or squeeze.
- Selected: `ink` label with a 3px `heat` bar. Others `ink-muted`. 44px tall.
- An unread count sits after the label as a heat count.
- Sticky under the app bar while the content scrolls.

#### Segmented control
- `ak-segmented`: 2–4 equal options that filter one list (Upcoming / Past / Drafts) or pick a mode (Singles / Doubles).
- Selected segment is raised on `surface`; the track is `surface-sunken`.

## Status

### StatusPill

A status pill names one lifecycle state of a Session or participant, with colour and a dot.

#### States
| Class | State | Tokens |
| --- | --- | --- |
| `ak-pill--draft` | Draft (organizer only) | `surface-sunken` / `ink-muted` |
| `ak-pill--recruiting` | Recruiting, Requested, Waitlist | `info-tint` / `info` |
| `ak-pill--ready` | Ready, Registered, Paid, Checked in | `success-tint` / `success` |
| `ak-pill--full` | Full | `asphalt` / `on-asphalt` |
| `ak-pill--live` | In progress (shown as "Live") | `heat` / `on-heat`, pulsing dot |
| `ak-pill--completed` | Completed, Checked out | outline in `border`, `ink-muted` |
| `ak-pill--cancelled` | Cancelled, No show | `danger-tint` / `danger` |

#### Rules
- Heat is reserved for Live. A screen with one heat pill tells you where the action is.
- The label is always present; colour is never the only signal.
- The pulse stops under `prefers-reduced-motion`.

In code: `ui/Badge.tsx`, with one `action` per state added.

### Chip

Chips filter a list or label a person or thing; count badges show unread numbers. In code: tags and counts extend `ui/Badge.tsx`; the filter chip is a new `Pressable` component.

- Filter chip (`ak-chip`): 36px, `border-strong` outline; selected flips to an `ink` fill with surface text. Rows scroll horizontally.
- Tag (`ak-chip--tag`): static label for skill level per sport, role (Admin, Owner). Not tappable.
- Count (`ak-badge-count`): `heat` with ink numerals for unread; `--muted` for plain totals. Cap at 99+.
- `ak-dot`: an 8px heat dot for "new" with no number. Give it an accessible label.
- Lifecycle states use StatusPill, not chips.

## Content

### SessionCard

A session card summarizes one Session in a list: sport, status, name, when, where, price and who is in.

#### Anatomy
1. Overline: Sport · Activity Type, `ink-muted`.
2. StatusPill, top right.
3. Title in the display face (`title` style).
4. Meta lines with 16px icons: date and time, venue, price.
5. Footer above a `border` rule: slot count (tabular numerals), avatar stack, one small action.

#### Variants
- Default: `ak-card ak-session`.
- `ak-session--live`: heat border and a leaning heat bar in the corner, cut at `slant-lean`. Only for In progress.

The consumer provides the data and one action that fits the viewer's state (Join, Pay, Check in, Open matches).

In code: `domain-ui/SessionCard.tsx`, following the redesign canvas (eyebrow date · time, footer price and capacity with an ink bar; see `codebase.md`). Home's "Right now" adds `variant="hero"` (the live Session as an asphalt card with heat cuts, Live pill and Open) and `variant="row"` (day block, name, "19:00 · venue · Community", status pill) for a `ListGroup`.

### ListItem

A list item is one row: lead (avatar or icon tile), title and subtitle, trailing meta or action. Rows sit in an `ak-list` group.

- Minimum 56px tall; the whole row is the tap target when it navigates (chevron trail).
- Lead: Avatar for people, a 40px `surface-sunken` icon tile for settings.
- Trail: time + unread count (Inbox), a value + chevron (settings), or one small button (Confirm payment).
- `--unread` bolds the title. `--danger` for Log out, Leave community.
- Swipe actions are not used; long-press opens an action Sheet (report, delete), matching chat messages.
- In code: `ui/List.tsx` — `ListGroup` (the card with hairlines between rows; draws nothing when all its rows are hidden) and `ListRow` (icon tile in neutral, heat, success or info, or any `leading` node; title, subtitle and a small meta line; trailing node and chevron; `danger`). `framed="light"` / `"dark"` makes one row a card on its own (First run's Find a community is the dark one). Used on Home, Me, Settings, Notifications and Inbox; Members, Payment and `PlayerCard` have not moved onto it yet. Long lists use `FlatList`.

### Chat

Chat covers Session Chat, Contact Organizer, direct, group and Community chats (DP-011, DP-013, DP-021): one screen, one set of parts.

- Others' messages: `surface` bubble with a `border`, author name in `heat-strong` (group chats only), avatar on the last message of a run.
- Own messages: `heat-tint` bubble, right-aligned, no avatar. Ink text stays 15:1 in both themes.
- Meta (time, "edited") inside the bubble at 11px; "Seen" / "Seen by N" under your latest message; "… is typing" at the bottom.
- One optional image per message, rounded 10px, above the text.
- Long-press a message opens an action Sheet: Edit (15 min), Delete for me, Delete for everyone (60 h), Report.
- Composer: photo button, auto-growing field on `surface-sunken`, heat send button. When posting is closed, replace it with an info Alert.

### Scoreboard

The scoreboard shows a live match: teams, set scores and the current game, on asphalt.

- Always `asphalt` so it reads as a broadcast panel in both themes.
- Set cells in `on-asphalt` on a faint cell; the leading side's game cell is `heat` with ink numerals, the other side dim.
- The serving side carries a `ball` dot; the other side keeps an empty dot so names stay aligned.
- All numerals use the display face with tabular numerals so scores never jump.

Match rows (the same component, on surface): one line per side with a small muted "VS" between; a finished match shows each side's score, the winner in 700 ink (a draw: "DRAW · 22:05", both sides in ink, with Share); an **Unfinished** match (DP-025) shows its score with both sides in ink, "UNFINISHED · 21:25" as the eyebrow, and no Share.

In code: `domain-ui/MatchCard.tsx`.

### Avatar

An avatar shows a person by photo or initials, with an optional online ring.

- Sizes: `ak-avatar--sm` 28px (stacks, chat), default 40px (lists), `ak-avatar--lg` 64px (profile).
- `ak-avatar--online` draws the DP-014 online ring in `success`, separated from the photo by a `surface` gap.
- `ak-avatar-stack` overlaps small avatars by 8px for participant previews; end with a `+N` avatar.
- Initials use the display face, two letters, uppercase. The consumer provides the `<img>` (with `alt` = display name) or the initials.

In code: a new `ui/Avatar.tsx` (image or initials) with an `online` prop; `domain-ui/PlayerCard.tsx` uses it.

## Feedback

### Alert

An alert is an inline banner inside a screen that explains a state or asks for attention. In code: `feedback/Alert.tsx` (inline banner; not the `appAlert` host, which becomes the Toast), with `tone` info / heat / danger, and `onPress` to make the whole banner the tap target with a chevron (a Community's "2 people want to join · Review").

| Variant | When |
| --- | --- |
| `ak-alert--heat` | Something for the organizer to act on: receipts to confirm, join requests, Draft Recovery. One per screen, usually first. |
| `ak-alert--info` | Rules and timing: check-in window, posting closed. |
| `ak-alert--success` | Confirmation that stays on the screen (registered, paid). |
| `ak-alert--danger` | A blocking state: cancelled, removed, payment rejected. |

- Text is `ink` on the tint; only the icon carries the colour.
- One action at most, as an underlined link. Use `role="alert"` for danger, `role="status"` otherwise.
- Momentary confirmations ("Message deleted") are Toasts, not Alerts.

### Toast

A toast confirms something that just happened and disappears after ~4 seconds. In code: restyle the existing `feedback/appAlert.tsx` host.

- Always `asphalt` with `on-asphalt` text, in both themes, so it stands apart from content.
- At most one action (Undo, Retry) in `heat-on-asphalt`. With an action, keep it up for 6 seconds.
- Position: bottom centre, 16px above the tab bar or action bar; full width minus 16px gutters on phones, 360px max on desktop.
- Success icon is a `ball` tick; errors use a heat warning icon.
- Never put information a person must keep in a toast; use an Alert.
- Setup: `<Toaster position="bottom-center" />` once in the root layout, styled with the asphalt background and `heat-on-asphalt` action through its `toastOptions` styles.

### Progress

Progress bars show how full or how paid a Session is; skeletons hold the shape of content while it loads. In code: new `feedback/Progress.tsx`; skeletons replace spinners in `feedback/Loading.tsx` where content has a known shape.

- 8px bar on `surface-sunken`: `heat` for spots filled, `--success` for paid. Always with a label and a tabular count above it; the bar is never the only signal.
- Skeletons copy the real layout (card, list rows) in `surface-sunken` blocks with a slow fade, stopped under reduced motion. Show them after 300ms, not instantly.
- Pull-to-refresh and spinners: a 20px heat spinner, only for actions under 2 seconds.

### EmptyState

An empty state fills a screen or list that has nothing yet, says why, and offers the next step.

- Art from the Illustration set (`no-sessions`, `no-messages`, `no-results`, `no-notifications`, `offline`, `no-members`), shown at 120 × 90. Never people or photos.
- Title in the display face, italic: what's missing, plainly ("No sessions yet", "No messages").
- One sentence on what to do, then at most one primary button. If the viewer can't act (a player in an empty Community), no button.
- Search with no results is quieter: no art, "No Communities match 'Bekasi'" and a "Clear search" ghost button.

### Illustration

Spot illustrations for empty, success and waiting states, drawn only from the brand's shapes: heat-tint blocks, heat bars leaning at `slant-cut` (33°), one optic-yellow `ball`, and ink lines.

#### The set
| Name | Use |
| --- | --- |
| `no-sessions` | Community or schedule with no Sessions |
| `no-messages` | Empty Inbox, a chat with no messages |
| `no-results` | Search or filters found nothing |
| `no-notifications` | Notifications page is empty |
| `offline` | No connection, failed to load (with a Retry button) |
| `success` | Joined, paid, confirmed; full-screen or Sheet confirmations |
| `pending` | Join request sent, waiting for approval or payment confirmation |
| `match-won` | Match result, Session completed summary |
| `no-members` | Community with no members besides the owner |

#### Rules
- 160 × 120 viewBox; show at 120 × 90 in an EmptyState, up to 160 × 120 on a full-screen confirmation. One per screen.
- Always sits above a title in the display face; it never carries meaning on its own, so mark it decorative (`accessible={false}` on native, `aria-hidden` on web).
- Colours follow the theme: use the `-light` file in Daylight and `-dark` in Floodlight, or render the shapes with theme colours (see below).
- No people, faces or mascots; no more than one ball; heat bars always lean the same way as the mark.
- New art follows the recipe: one tint block for the ground, one subject in heat, one ball accent, ink only for thin lines.

#### In the app
Each file is a few plain shapes, so the cleanest route in Expo is one React component per illustration with `react-native-svg`, filling shapes from the theme (`heat`, `heat-tint`, `ball`, `ink`, `surface-sunken`) so one component covers both themes. `react-native-svg-transformer` can also import the files directly; then pick the file by colour scheme.

## Overlays

### Sheet

A bottom sheet slides up from the bottom for choices, confirmations with detail, and short forms. It is the default overlay on mobile. In code: a new `feedback/Sheet.tsx` on React Native `Modal`, the way `locations/CityPickerModal.tsx` works today; no new dependency.

- `surface`, top corners `radius-lg`, `shadow-lg`, over a `scrim`. A grip at the top; swipe down or tap the scrim to close.
- Title in the display face, one-line description, then content, then actions stacked: primary block button first, ghost "Not now" under it.
- Max 88% of the screen; longer content scrolls inside. Pad the bottom by the safe-area inset.
- Uses: Select options, action menus ("more" in the app bar, long-press on a message), Join request, filters, city picker (full height with search).
- Closing never needs the top of the screen: swipe down, tap the scrim, Android back or browser back.

#### Closing and cancelling
- The button that dismisses a sheet says **Close** (an action menu) or a plain decline such as **Not now** (a sheet that asks something). It **never says "Cancel"**: in Aksi, cancel always means cancelling something real, such as a Session or a join request.
- Close is an outlined block button at the very bottom of the sheet.
- Destructive options (Cancel session, Remove member, Leave community) go last in an action menu, in their own group set apart by a thick `surface-sunken` divider, in `danger` with a `danger-tint` icon tile and a one-line consequence ("Notifies all players. Asks you to confirm."). Tapping one opens a Dialog; nothing happens from the sheet itself.

### Dialog

A dialog interrupts to confirm one irreversible action. In code: `feedback/Dialog.tsx`.

- Only for destructive or irreversible confirms: Cancel session, Remove member, Delete for everyone, Block. Everything else is a Sheet.
- Title is the question; description says the consequence in one or two sentences, with numbers ("All 5 players will be notified").
- Two buttons side by side: the safe choice (`outline`) left, the destructive verb (`ak-btn--danger-solid`) right. Labels repeat the verb, never "Yes / No".
- Centered, max 340px, `radius-lg`, over the `scrim`. Focus starts on the safe button.

## Screens

### ScreenSessionDetail

A composed Session detail screen showing how the parts fit on a 390px phone: AppBar, Tabs, StatusPill and tags, a ListItem group for the facts, a Progress card for spots, and the ActionBar.

This is a reference layout, not a component to import. Copy the structure; keep the order: status first, then when / where / price, then who, then the description, with the action pinned at the bottom.

## Assets

### Illustrations

Nine spot illustrations, each in a Daylight (`-light`) and Floodlight (`-dark`) file. 160 × 120 SVG, flat fills, no strokes outside the ink lines.

Light files use heat-tint #ffe9e0, ink #131315 and surface-sunken #f2efec; dark files swap those for #3a1a0e, #f4f2ef and #222226. Heat #f9440e and ball #dcf23a stay the same in both. Usage rules: see the Illustration component.

### Logos

The Aksi mark (slanted "A") and the stacked lockup (mark over the "aksi" wordmark), each in three inks. All are transparent PNGs, 1254px (lockup) and 1024px (mark).

| File | Ink | Use on |
| --- | --- | --- |
| `aksi-lockup-ink.png`, `aksi-mark-ink.png` | #131315 (`ink`, light theme) | `ground`, `surface`, `heat` |
| `aksi-lockup-heat.png`, `aksi-mark-heat.png` | Urban Heat (`heat`) | `ground`, `surface`, `asphalt` |
| `aksi-lockup-white.png`, `aksi-mark-white.png` | #FEFFFF | `asphalt`, dark theme, photos |

The white files look empty on a light tile: they are there. The heat mark file is #F45125, slightly off the lockup's #F9440E; it should be re-exported. Vector (SVG) masters are still needed for crisp small sizes.
