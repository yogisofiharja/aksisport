import { apiFetch } from '../api/client';
import type { InvitationCard, InviteCandidate, InviteLink, InviteResolution } from './types';

// DP-028: inviting friends to a Community or a Session.

export type InviteTarget = { type: 'club' | 'session'; id: string };

function base(target: InviteTarget) {
  return target.type === 'club' ? `/v1/clubs/${target.id}` : `/v1/sessions/${target.id}`;
}

// The caller's own link to the target, made on first use.
export function getInviteLink(target: InviteTarget): Promise<InviteLink> {
  return apiFetch(`${base(target)}/invite-link`);
}

// Owners/admins: every link for the target stops working; returns the
// caller's fresh one.
export function resetInviteLink(target: InviteTarget): Promise<InviteLink> {
  return apiFetch(`${base(target)}/invite-link/reset`, { method: 'POST' });
}

export function searchInviteCandidates(target: InviteTarget, q: string): Promise<InviteCandidate[]> {
  return apiFetch(`${base(target)}/invitations/candidates?q=${encodeURIComponent(q)}`);
}

export function inviteUser(target: InviteTarget, userId: string): Promise<void> {
  return apiFetch(`${base(target)}/invitations`, { method: 'POST', body: JSON.stringify({ userId }) });
}

// Opening /i/:token (signed in). Throws ApiRequestError with code
// INVITE_REVOKED once the link was reset.
export function openInvite(token: string): Promise<InviteResolution> {
  return apiFetch(`/v1/invites/${encodeURIComponent(token)}`);
}

// Home's "Invited" cards: unanswered in-app invitations.
export function listMyInvitations(): Promise<InvitationCard[]> {
  return apiFetch('/v1/me/invitations');
}

export function dismissInvitation(id: string): Promise<void> {
  return apiFetch(`/v1/invitations/${id}/dismiss`, { method: 'POST' });
}
