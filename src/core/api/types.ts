export type UserProfile = {
  id: string;
  username: string;
  displayName?: string;
  email?: string;
  phoneNumber?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type ApiError = {
  error: string;
  code?: string;
};

export type Club = {
  id: string;
  name: string;
  description?: string;
  inviteCode: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
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
  role: ClubRole;
  joinedAt: string;
};

// DP-001: 'draft' (explicit, pre-publish) and 'cancelled' (explicit,
// terminal) added. 'open' covers what DP-001 calls Recruiting/Ready/Full —
// those are a derived display layer over 'open', not stored — see
// core/sessions/deriveStatus.ts.
export type SessionStatus = 'draft' | 'open' | 'in_progress' | 'completed' | 'cancelled';

export type Session = {
  id: string;
  clubId: string;
  sport: string;
  name?: string;
  location?: string;
  courtCount: number;
  status: SessionStatus;
  // DP-003: minimum is owned by the Sport Engine; Session only defines the
  // maximum. Nullable — no screen sets this yet.
  maxParticipants?: number;
  // DP-004: seeds a new match's format picker. Opaque, same as
  // Activity.config — only the relevant sports/<name>/ module reads it.
  defaultMatchFormat?: unknown;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

// DP-002: 'participated' removed — declared in the original schema but
// never set by any code path; not part of the five-state model.
export type ParticipantStatus = 'registered' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';

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
