import { apiFetch } from '../api/client';
import type { Session, SessionParticipant, SessionStatus } from '../api/types';

export function createSession(
  clubId: string,
  sport: string,
  options?: { name?: string; location?: string; courtCount?: number }
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
  updates: { name?: string; location?: string; status?: SessionStatus }
): Promise<Session> {
  return apiFetch(`/v1/sessions/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
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

export function addGuestParticipant(sessionId: string, guestName: string): Promise<SessionParticipant> {
  return apiFetch(`/v1/sessions/${sessionId}/participants`, {
    method: 'POST',
    body: JSON.stringify({ guestName }),
  });
}
