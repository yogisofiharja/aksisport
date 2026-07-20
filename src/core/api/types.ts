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

export type SessionStatus = 'open' | 'in_progress' | 'completed';

export type Session = {
  id: string;
  clubId: string;
  sport: string;
  name?: string;
  location?: string;
  courtCount: number;
  status: SessionStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type ParticipantStatus = 'registered' | 'checked_in' | 'participated';

export type SessionParticipant = {
  id: string;
  sessionId: string;
  userId?: string;
  guestName?: string;
  username?: string;
  displayName?: string;
  status: ParticipantStatus;
  checkedInAt?: string;
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
