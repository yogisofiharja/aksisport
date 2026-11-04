import { apiFetch } from '../api/client';
import type { Attendance, SessionParticipant } from '../api/types';

// DP-029. Your own record: every Community, every Session.
export function getMyAttendance(): Promise<Attendance> {
  return apiFetch('/v1/me/attendance');
}

// Organizers only: someone connected to this Community. Counts cover
// every Community, the Sessions only this one.
export function getPersonAttendance(clubId: string, userId: string): Promise<Attendance> {
  return apiFetch(`/v1/clubs/${clubId}/people/${userId}/attendance`);
}

// Organizers only, for 7 days after a completed Session ends.
export function correctAttendance(sessionId: string, participantId: string, attended: boolean): Promise<SessionParticipant> {
  return apiFetch(`/v1/sessions/${sessionId}/participants/${participantId}/attendance`, {
    method: 'POST',
    body: JSON.stringify({ attended }),
  });
}
