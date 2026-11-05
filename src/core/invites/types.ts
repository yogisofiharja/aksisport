import type { ClubPreview, PriceModel, Session, SkillLevel } from '../api/types';

export type InviteLink = {
  token: string;
  targetType: 'club' | 'session';
  targetId: string;
  clubId: string;
};

// A search result in Invite friends.
export type InviteCandidate = {
  id: string;
  username: string;
  displayName?: string;
  hasAvatar: boolean;
  avatarVersion?: number;
  // invite: can be invited · invited: already has a pending invite ·
  // in: already a member / already playing.
  state: 'invite' | 'invited' | 'in';
};

// What opening an invite link tells the app.
export type InviteResolution = {
  targetType: 'club' | 'session';
  targetId: string;
  clubId: string;
  clubName: string;
  sessionName?: string;
  startsAt?: string;
  inviterId: string;
  inviterName: string;
  // The inviter is an owner/admin now: a private Community lets them in
  // without a request.
  straightIn: boolean;
};

// One of Home's "Invited" cards.
export type InvitationCard = {
  id: string;
  fromUserId: string;
  fromName: string;
  targetType: 'club' | 'session';
  targetId: string;
  clubId: string;
  clubName: string;
  createdAt: string;
  sessionName?: string;
  startsAt?: string;
  durationMinutes?: number;
  location?: string;
  priceModel?: PriceModel;
  pricePerPerson?: number;
  totalPrice?: number;
};

// What a signed-out visitor sees of an invite link: enough to decide to
// join before making an account. `session` for a Session link.
export type InvitePreview = InviteResolution & {
  club: ClubPreview;
  session?: Session;
  organizerName?: string;
  skillLevelMin?: SkillLevel;
  skillLevelMax?: SkillLevel;
};
