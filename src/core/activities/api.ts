import { apiFetch } from '../api/client';
import type { Activity, ActivityDetail } from '../api/types';

export type ActivityParticipantInput = { userId?: string; guestName?: string; team?: 'A' | 'B' };

export function createActivity(
  sessionId: string,
  config: unknown,
  participants: ActivityParticipantInput[]
): Promise<ActivityDetail> {
  return apiFetch(`/v1/sessions/${sessionId}/activities`, {
    method: 'POST',
    body: JSON.stringify({ config, participants }),
  });
}

export function listActivities(sessionId: string): Promise<ActivityDetail[]> {
  return apiFetch(`/v1/sessions/${sessionId}/activities`);
}

export function getActivity(activityId: string): Promise<ActivityDetail> {
  return apiFetch(`/v1/activities/${activityId}`);
}

export function startActivity(activityId: string): Promise<Activity> {
  return apiFetch(`/v1/activities/${activityId}/start`, { method: 'POST' });
}

export function completeActivity(activityId: string, result: unknown, pointLog?: unknown): Promise<Activity> {
  return apiFetch(`/v1/activities/${activityId}/complete`, {
    method: 'POST',
    body: JSON.stringify({ result, pointLog }),
  });
}

// DP-025 End match early: the umpire saves a live match as Unfinished
// with the score so far.
export function endActivityEarly(activityId: string, result: unknown, pointLog?: unknown): Promise<Activity> {
  return apiFetch(`/v1/activities/${activityId}/end-early`, {
    method: 'POST',
    body: JSON.stringify({ result, pointLog }),
  });
}

// Only a queued (not yet started) match can be deleted — used by the
// Regenerate-matches flow to clear the upcoming queue before generating a
// fresh fair round.
export function deleteActivity(activityId: string): Promise<void> {
  return apiFetch(`/v1/activities/${activityId}`, { method: 'DELETE' });
}
