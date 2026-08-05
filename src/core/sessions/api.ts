import { apiFetch } from '../api/client';
import type { Session, SessionParticipant, SessionStatus, SkillLevelEnforcement } from '../api/types';

export function createSession(
  clubId: string,
  sport: string,
  options?: {
    name?: string;
    location?: string;
    description?: string;
    courtCount?: number;
    maxParticipants?: number;
    defaultMatchFormat?: unknown;
    activityType?: string;
    startsAt?: string;
    durationMinutes?: number;
    skillLevelMinId?: string;
    skillLevelMaxId?: string;
    skillLevelEnforcement?: SkillLevelEnforcement;
    hostPlaying?: boolean;
  }
): Promise<Session> {
  return apiFetch(`/v1/clubs/${clubId}/sessions`, {
    method: 'POST',
    body: JSON.stringify({ sport, ...options }),
  });
}

export function listSessions(clubId: string): Promise<Session[]> {
  return apiFetch(`/v1/clubs/${clubId}/sessions`);
}

export function getSession(sessionId: string): Promise<Session> {
  return apiFetch(`/v1/sessions/${sessionId}`);
}

export function updateSession(
  sessionId: string,
  updates: {
    name?: string;
    location?: string;
    description?: string;
    status?: SessionStatus;
    maxParticipants?: number;
    defaultMatchFormat?: unknown;
    activityType?: string;
    startsAt?: string;
    durationMinutes?: number;
    skillLevelMinId?: string;
    skillLevelMaxId?: string;
    skillLevelEnforcement?: SkillLevelEnforcement;
    hostPlaying?: boolean;
  }
): Promise<Session> {
  return apiFetch(`/v1/sessions/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

// DP-001: named wrappers over the same generic PATCH updateSession already
// uses — no new routes, the server validates the transition itself
// (draft->open->in_progress->completed, cancelled from any non-terminal
// state). Named here for call-site clarity, same reasoning as checkIn
// already being a named wrapper rather than a raw PATCH call.
export function publishSession(sessionId: string): Promise<Session> {
  return updateSession(sessionId, { status: 'open' });
}

export function startSession(sessionId: string): Promise<Session> {
  return updateSession(sessionId, { status: 'in_progress' });
}

export function completeSession(sessionId: string): Promise<Session> {
  return updateSession(sessionId, { status: 'completed' });
}

export function cancelSession(sessionId: string): Promise<Session> {
  return updateSession(sessionId, { status: 'cancelled' });
}

export function listParticipants(sessionId: string): Promise<SessionParticipant[]> {
  return apiFetch(`/v1/sessions/${sessionId}/participants`);
}

// DP-002 Join Approval: this is the "request to join" action — creates a
// 'requested' row, not an immediate join. See approveParticipant/
// confirmParticipantPayment for the rest of the chain.
export function registerForSession(sessionId: string): Promise<SessionParticipant> {
  return apiFetch(`/v1/sessions/${sessionId}/register`, { method: 'POST' });
}

// Owner/admin approves a 'requested' join request, moving it to
// 'waitlist' (approved, slot not yet claimed).
export function approveParticipant(sessionId: string, userId: string): Promise<SessionParticipant> {
  return apiFetch(`/v1/sessions/${sessionId}/participants/${userId}/approve`, { method: 'POST' });
}

// Owner/admin confirms payment was received (outside the app — no
// payment gateway), moving a 'waitlist' participant to 'registered'.
export function confirmParticipantPayment(sessionId: string, userId: string): Promise<SessionParticipant> {
  return apiFetch(`/v1/sessions/${sessionId}/participants/${userId}/confirm-payment`, { method: 'POST' });
}

// Owner/admin removes a participant entirely (e.g. declining a join
// request) — a hard delete, unlike Cancel/NoShow.
export function deleteParticipant(sessionId: string, userId: string): Promise<void> {
  return apiFetch(`/v1/sessions/${sessionId}/participants/${userId}`, { method: 'DELETE' });
}

export function checkIn(sessionId: string): Promise<SessionParticipant> {
  return apiFetch(`/v1/sessions/${sessionId}/checkin`, { method: 'POST' });
}

// Owner/admin checking in another club member on their behalf (e.g. a
// walk-in who hasn't opened the app) — same upsert as self check-in.
export function checkInParticipant(sessionId: string, userId: string): Promise<SessionParticipant> {
  return apiFetch(`/v1/sessions/${sessionId}/participants/${userId}/checkin`, { method: 'POST' });
}

// DP-002: self-service, mirrors checkIn exactly — acts on the caller.
export function checkOut(sessionId: string): Promise<SessionParticipant> {
  return apiFetch(`/v1/sessions/${sessionId}/checkout`, { method: 'POST' });
}

export function cancelParticipation(sessionId: string): Promise<SessionParticipant> {
  return apiFetch(`/v1/sessions/${sessionId}/cancel`, { method: 'POST' });
}

// DP-002: owner/admin only — marking someone else's absence isn't self-service.
export function markNoShow(sessionId: string, userId: string): Promise<SessionParticipant> {
  return apiFetch(`/v1/sessions/${sessionId}/participants/${userId}/no-show`, { method: 'POST' });
}

export function addGuestParticipant(sessionId: string, guestName: string): Promise<SessionParticipant> {
  return apiFetch(`/v1/sessions/${sessionId}/participants`, {
    method: 'POST',
    body: JSON.stringify({ guestName }),
  });
}
