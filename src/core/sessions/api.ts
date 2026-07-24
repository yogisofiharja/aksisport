import { apiFetch } from '../api/client';
import type { Session, SessionParticipant, SessionStatus } from '../api/types';

export function createSession(
  clubId: string,
  sport: string,
  options?: { name?: string; location?: string; courtCount?: number; maxParticipants?: number; defaultMatchFormat?: unknown }
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
    status?: SessionStatus;
    maxParticipants?: number;
    defaultMatchFormat?: unknown;
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

export function registerForSession(sessionId: string): Promise<SessionParticipant> {
  return apiFetch(`/v1/sessions/${sessionId}/register`, { method: 'POST' });
}

export function checkIn(sessionId: string): Promise<SessionParticipant> {
  return apiFetch(`/v1/sessions/${sessionId}/checkin`, { method: 'POST' });
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
