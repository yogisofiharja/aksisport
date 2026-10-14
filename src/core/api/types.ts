// A notification as its recipient reads it (DP-018). Its text is
// rendered on the device from type + params (core/notifications/text.ts);
// path is the app address it opens.
export type AppNotification = {
  id: string;
  type: string;
  params: Record<string, string>;
  path: string;
  createdAt: string;
  readAt?: string;
};

export type UserProfile = {
  id: string;
  username: string;
  displayName?: string;
  // DP-015. `email` is the *confirmed* address — set only once its code
  // has been entered. `pendingEmail` is one still awaiting its code.
  // `emailRequired` is true for accounts created under DP-015, which must
  // confirm an email before using the app; older accounts are only
  // reminded.
  email?: string;
  pendingEmail?: string;
  emailRequired: boolean;
  // DP-017: the city or regency the User says they are in, picked from
  // the reference list; cityName is its display form ("Kota Bandung, Jawa
  // Barat"). Used to list Communities there in Explore.
  cityCode?: string;
  cityName?: string;
  // Every town the User keeps (where they live, a hometown, …), oldest
  // first. The active one (cityCode) is always among them.
  cities: { code: string; name: string }[];
  phoneNumber?: string;
  avatarUrl?: string;
  hasAvatar: boolean;
  // Derived from recent activity (no push/websocket presence exists in
  // this app) — see isOnlineExpr in server's internal/db/users.go.
  isOnline: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ApiError = {
  error: string;
  code?: string;
  // Sent with code "TOO_SOON" (DP-015 resend cooldown): how long until a
  // new confirmation code can be requested.
  retryAfterSeconds?: number;
};

// Reference data (DP-017): Indonesia's provinces and their cities/
// regencies. "City" means a kota or a kabupaten — `name` says which
// ("Kota Bandung", "Kabupaten Bandung"). Codes are official region codes.
export type Province = { code: string; name: string };
export type City = { code: string; provinceCode: string; name: string };

// DP-017: "public" — anyone joins instantly; "private" — joining creates
// a request an owner/admin approves.
export type ClubVisibility = 'public' | 'private';

export type Club = {
  id: string;
  name: string;
  description?: string;
  // The city or regency the Community is in, picked from the reference
  // list; cityName is its display form ("Kota Bandung, Jawa Barat").
  // Missing only on Communities created before DP-017.
  cityCode?: string;
  cityName?: string;
  visibility: ClubVisibility;
  inviteCode: string;
  hasAvatar: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

// What anyone signed in may see of a Community they are not necessarily
// in (DP-017) — Explore results and the page behind a shared link.
// viewerRole / viewerRequestPending describe the *caller's* relation to
// it: a role means they are a member, pending means they asked to join a
// private Community and are waiting.
export type ClubPreview = {
  id: string;
  name: string;
  description?: string;
  cityCode?: string;
  cityName?: string;
  visibility: ClubVisibility;
  hasAvatar: boolean;
  memberCount: number;
  viewerRole?: ClubRole;
  viewerRequestPending: boolean;
};

// A pending request to join a private Community, as its owner/admins see it.
export type ClubJoinRequest = {
  id: string;
  clubId: string;
  userId: string;
  username: string;
  displayName?: string;
  hasAvatar: boolean;
  createdAt: string;
};

// Milestone 5 (Session Finance) — a Club can list more than one of these
// (e.g. a BCA and a Mandiri account). Plain display fields, no payment
// processor integration.
export type ClubBankAccount = {
  id: string;
  clubId: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  createdAt: string;
};

export type ClubRole = 'owner' | 'admin' | 'member';

export type ClubWithRole = Club & {
  role: ClubRole;
};

export type ClubMember = {
  clubId: string;
  userId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  hasAvatar: boolean;
  isOnline: boolean;
  role: ClubRole;
  joinedAt: string;
};

// Lean, public-safe shape returned by user search — no email/phone,
// unlike a full profile.
export type UserSummary = {
  id: string;
  username: string;
  displayName?: string;
  hasAvatar: boolean;
  isOnline: boolean;
};

// DP-001: 'draft' (explicit, pre-publish) and 'cancelled' (explicit,
// terminal) added. 'open' covers what DP-001 calls Recruiting/Ready/Full —
// those are a derived sub-state of 'open', never persisted (see
// DerivedSessionStatus below).
export type SessionStatus = 'draft' | 'open' | 'in_progress' | 'completed' | 'cancelled';

// DP-001's resolved lifecycle state — 'open' expands into its derived
// sub-state (recruiting/ready/full), everything else passes through
// SessionStatus unchanged. Resolved server-side (DP-ARCH-003) and
// returned as Session.lifecycleStatus below; the client no longer derives
// this itself (the former core/sessions/deriveStatus.ts is retired).
export type DerivedSessionStatus = 'draft' | 'recruiting' | 'ready' | 'full' | 'in_progress' | 'completed' | 'cancelled';

export type Session = {
  id: string;
  clubId: string;
  sport: string;
  // Mandatory at creation as of v0.6.0.
  name?: string;
  location?: string;
  // Free text, optional — not part of the mandatory-at-creation set.
  description?: string;
  courtCount: number;
  status: SessionStatus;
  // DP-003: minimum is owned by the Sport Engine; Session only defines the
  // maximum. Nullable — no screen sets this yet.
  maxParticipants?: number;
  // DP-004: seeds a new match's format picker. Opaque, same as
  // Activity.config — only the relevant sports/<name>/ module reads it.
  defaultMatchFormat?: unknown;
  // Match Setup's other half — deuce rule for matches generated from this
  // Session. Undefined means "not configured yet" (a Session created
  // before Match Setup existed); callers building a match fall back to
  // true, matching the old hardcoded AddMatchScreen default.
  defaultSingleDeuce?: boolean;
  // Opaque, Sport-Module-owned (e.g. tennis: 'single'|'double'|'class') —
  // distinct from defaultMatchFormat, which seeds a match's *scoring*
  // format, not this. Mandatory at creation as of DP-009/v0.5.1.
  activityType?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  // DP-007: a core Session property, not an Organizer Preference — set
  // directly for ad-hoc Sessions, populated from the computed occurrence
  // timestamp for Sessions generated by a Recurring Schedule. Mandatory at
  // creation as of DP-009/v0.5.1.
  startsAt?: string;
  // DP-009: required together with startsAt as of v0.5.1.
  durationMinutes?: number;
  // Nil for ad-hoc Sessions. Set on generation; DP-007 — generated Sessions
  // become independent after creation, this is provenance, not ownership.
  recurringScheduleId?: string;
  // DP-008: Skill Level requirement — mandatory on every Session as of v0.5.1.
  skillLevelMinId?: string;
  skillLevelMaxId?: string;
  skillLevelEnforcement?: SkillLevelEnforcement;
  // Whether the organizer (createdBy) intends to play, not just run, this
  // Session — mandatory at creation as of v0.6.1. When true, the host is
  // auto-checked-in as a participant on creation.
  hostPlaying: boolean;
  // Price (Payments) — optional cost to join, "free" by default.
  // pricePerPerson only meaningful for "per_person"; totalPrice only
  // meaningful for "split_bill" (the per-person share is computed
  // client-side from totalPrice/joinedCount, never stored — it would go
  // stale the moment another participant joins or leaves).
  priceModel: PriceModel;
  pricePerPerson?: number;
  totalPrice?: number;
  // Computed, not stored — DP-002 headcount (registered/checked_in/
  // checked_out; cancelled/no_show excluded). Populated by GET endpoints only.
  joinedCount: number;
  // Resolved server-side (DP-001/DP-ARCH-003) — see DerivedSessionStatus.
  lifecycleStatus: DerivedSessionStatus;
};

export type PriceModel = 'free' | 'per_person' | 'split_bill';

// DP-002: 'participated' removed — declared in the original schema but
// never set by any code path; not part of the five-state model.
// 'requested'/'waitlist' added (v0.9.0, Join Approval): requested
// (self-service join request) --organizer approves--> waitlist (approved,
// slot not yet claimed) --organizer confirms payment--> registered
// (slot claimed) --self check-in--> checked_in. Organizer-initiated
// actions (Host Playing auto-checkin, "check in a member," guest add)
// bypass this chain entirely and go straight to checked_in.
export type ParticipantStatus =
  | 'requested'
  | 'waitlist'
  | 'registered'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'
  | 'no_show';

export type SessionParticipant = {
  id: string;
  sessionId: string;
  userId?: string;
  guestName?: string;
  username?: string;
  displayName?: string;
  status: ParticipantStatus;
  checkedInAt?: string;
  checkedOutAt?: string;
  joinedAt: string;
  // Milestone 5 — a bool, never the image bytes (only ever fetched one
  // at a time via participantReceiptUrl, and only by the uploader
  // themselves or an owner/admin).
  hasReceipt: boolean;
};

export type ActivityStatus = 'queued' | 'live' | 'completed';

export type ActivityParticipant = {
  id: string;
  activityId: string;
  userId?: string;
  guestName?: string;
  username?: string;
  displayName?: string;
  team?: 'A' | 'B';
  slotOrder: number;
};

// config/result are opaque to core — only the relevant sports/<name>/
// module knows how to build and read them (see sports/tennis/scoringEngine.ts).
export type Activity = {
  id: string;
  sessionId: string;
  sport: string;
  activityType: string;
  status: ActivityStatus;
  scorerUserId?: string;
  config: unknown;
  result?: unknown;
  pointLog: unknown;
  createdBy: string;
  queuePosition?: number;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
};

export type ActivityDetail = Activity & {
  participants: ActivityParticipant[];
};

// DP-011 Session Chat and DP-013 Contact Organizer share one messaging
// engine server-side (conversations/conversation_messages) — the only
// real differences are participants and whether a posting window
// applies, so both return this same shape. senderUsername/
// senderDisplayName are denormalized from a join server-side, not stored
// on the row itself. hasImage is a bool, never the raw bytes — the image
// itself is only ever fetched one at a time via
// conversationMessageImageUrl(), so polling a conversation never
// re-transfers image data already on screen.
export type ConversationMessage = {
  id: string;
  conversationId: string;
  sessionId: string;
  senderId: string;
  senderUsername: string;
  senderDisplayName?: string;
  body: string;
  hasImage: boolean;
  createdAt: string;
  // Removed by a Community's owner/admin after a report (DP-021).
  removed: boolean;
  // Edited by its sender (DP-021).
  edited: boolean;
  // Deleted for everyone by its sender (DP-021).
  deleted: boolean;
};

// One row in a Contact Organizer thread listing — the organizer's
// per-Session view, or the cross-Session Inbox. needsReply is relative to
// the caller: true when the last message came from the other side of
// this specific thread.
export type SessionContactThread = {
  sessionId: string;
  sessionName?: string;
  clubId: string;
  clubName: string;
  memberUserId: string;
  memberUsername: string;
  memberDisplayName?: string;
  lastMessageBody: string;
  lastMessageSenderId: string;
  lastMessageAt: string;
  // The latest message was deleted or removed (DP-021).
  lastMessageDeleted: boolean;
  needsReply: boolean;
  conversationId: string;
  // Messages from the other side the caller hasn't read (DP-021).
  unreadCount: number;
};

// How far one person has read a conversation (DP-021) — read receipts.
export type ConversationRead = {
  userId: string;
  lastReadAt: string;
};

// DP-007: MVP recurrence shape is weekly-only (an engineering default, not
// product-specified) — one weekday + time + duration per Schedule. Multiple
// weekly slots require multiple Schedules.
export type RecurrenceRule = {
  weekday: number; // 0=Sunday .. 6=Saturday
  time: string; // "HH:MM"
  durationMinutes: number;
  timezone: string; // IANA name, e.g. "Asia/Jakarta"
};

export type RecurringScheduleStatus = 'active' | 'paused';

// Template fields mirror DP-004's Organizer Preferences — deliberately no
// start time, that's a core Session property produced per-occurrence from
// recurrenceRule, not part of the Template.
export type RecurringSchedule = {
  id: string;
  clubId: string;
  sport: string;
  name?: string;
  location?: string;
  description?: string;
  courtCount: number;
  maxParticipants?: number;
  defaultMatchFormat?: unknown;
  defaultSingleDeuce?: boolean;
  activityType?: string;
  recurrenceRule: RecurrenceRule;
  generationLeadDays: number;
  generationTime?: string; // "HH:MM"; unset means the occurrence's own time is used
  status: RecurringScheduleStatus;
  endDate?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  // DP-008: Skill Level requirement — mandatory on every Template as of v0.5.1.
  skillLevelMinId?: string;
  skillLevelMaxId?: string;
  skillLevelEnforcement?: SkillLevelEnforcement;
  // Same as Session's own field — copied onto each generated Session.
  hostPlaying: boolean;
  // Price (Payments), same as Session's own field — copied onto each
  // generated Session.
  priceModel: PriceModel;
  pricePerPerson?: number;
  totalPrice?: number;
};

// A Session in the Player's own cross-Club history (DP-009) — carries its
// Club's name, since it's shown outside any one Club.
export type JoinedSession = Session & { clubName: string };

// DP-007 Session Synchronization: `updated` Sessions take the Template's
// values; `skippedEdited` were edited by hand after generation and keep
// their own.
export type SessionSyncCounts = {
  updated: number;
  skippedEdited: number;
};

export type OccurrenceStatus = 'pending' | 'generated' | 'skipped';

export type OccurrencePreview = {
  startsAt: string;
  status: OccurrenceStatus;
};

// DP-008: the Level Scale is owned by the Sport Module (DP-ARCH-002),
// scoped per sport — not one list shared across all sports.
export type SkillLevel = {
  id: string;
  sport: string;
  slug: string;
  name: string;
  rank: number;
};

// One of the caller's direct-message conversations (DP-020), for Inbox.
export type DirectThread = {
  otherUserId: string;
  otherUsername: string;
  otherDisplayName?: string;
  otherHasAvatar: boolean;
  otherIsOnline: boolean;
  lastMessageBody: string;
  lastMessageHasImage: boolean;
  lastMessageSenderId: string;
  lastMessageAt: string;
  lastMessageDeleted: boolean;
  conversationId: string;
  unreadCount: number;
};

// A player's history in one sport, across every Community (DP-019).
export type PlayerSportActivity = {
  sport: string;
  summary: { sessionsAttended: number; noShows: number; matchesPlayed: number; wins: number };
  sessions: {
    sessionId: string;
    sessionName?: string;
    clubName: string;
    startsAt?: string;
    outcome: 'attended' | 'no_show';
  }[];
  matches: {
    activityId: string;
    sessionName?: string;
    clubName: string;
    completedAt?: string;
    team: 'A' | 'B' | '';
    won?: boolean;
    // The sport's own stored end state — interpreted by its Sport Module.
    result?: unknown;
    players: { name: string; team: 'A' | 'B' }[];
  }[];
};

// What organizers see of a player who asked to join (DP-019) — no email,
// towns or anything else private.
export type PlayerProfile = {
  id: string;
  username: string;
  displayName?: string;
  hasAvatar: boolean;
  isOnline: boolean;
  joinedAt: string;
  skillLevels: UserSkillLevel[];
  // Whether you have blocked this player (DP-021).
  blockedByMe: boolean;
};

// DP-021 blocking and reporting.
export type BlockedUser = {
  userId: string;
  username: string;
  displayName?: string;
  hasAvatar: boolean;
  blockedAt: string;
};

export type ClubReport = {
  id: string;
  reporterId: string;
  reporterUsername: string;
  reporterDisplayName?: string;
  reportedUserId: string;
  reportedUsername: string;
  reportedDisplayName?: string;
  reason: string;
  createdAt: string;
  // The reported message as it was when reported; absent for a report
  // about a person.
  message?: {
    id?: string;
    body: string;
    hasImage: boolean;
    conversationKind: 'session_chat' | 'session_contact' | 'direct';
    sessionId?: string;
    sessionName?: string;
    removed: boolean;
    canRemove: boolean;
  };
};

// A player's self-reported level for one sport — exactly one per
// (user, sport). skillLevel* fields are denormalized so the client never
// needs a second lookup to render e.g. "Tennis: Intermediate".
export type UserSkillLevel = {
  userId: string;
  sport: string;
  skillLevelId: string;
  skillLevelSlug: string;
  skillLevelName: string;
  skillLevelRank: number;
  updatedAt: string;
};

export type SkillLevelEnforcement = 'strict' | 'guidance';

// DP-021 step 3: group chats and Community chat.
export type GroupMember = {
  userId: string;
  username: string;
  displayName?: string;
  hasAvatar: boolean;
};

export type GroupChat = {
  id: string;
  title: string;
  // Manages the group: rename, add and remove people.
  createdBy?: string;
  createdAt: string;
  members: GroupMember[];
};

// One group in Inbox.
export type GroupThread = {
  conversationId: string;
  // "" when unnamed: shown by memberNames (DP-021).
  title: string;
  memberCount: number;
  // Up to four other members' names, oldest member first.
  memberNames: string[];
  lastMessageBody: string;
  lastMessageHasImage: boolean;
  lastMessageDeleted: boolean;
  lastMessageSenderId?: string;
  lastMessageSenderUsername?: string;
  lastMessageSenderDisplayName?: string;
  lastActivityAt: string;
  unreadCount: number;
};

// Someone you can start a conversation or group with.
export type MessageableUser = GroupMember;

export type ClubChatState = {
  enabled: boolean;
  unreadCount: number;
};
