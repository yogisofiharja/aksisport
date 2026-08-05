import { apiFetch } from '../api/client';
import type { OccurrencePreview, RecurrenceRule, RecurringSchedule, Session, SkillLevelEnforcement } from '../api/types';

export function createRecurringSchedule(
  clubId: string,
  sport: string,
  recurrenceRule: RecurrenceRule,
  generationLeadDays: number,
  options?: {
    name?: string;
    location?: string;
    description?: string;
    courtCount?: number;
    maxParticipants?: number;
    defaultMatchFormat?: unknown;
    activityType?: string;
    generationTime?: string;
    endDate?: string;
    skillLevelMinId?: string;
    skillLevelMaxId?: string;
    skillLevelEnforcement?: SkillLevelEnforcement;
    hostPlaying?: boolean;
  }
): Promise<RecurringSchedule> {
  return apiFetch(`/v1/clubs/${clubId}/recurring-schedules`, {
    method: 'POST',
    body: JSON.stringify({ sport, recurrenceRule, generationLeadDays, ...options }),
  });
}

export function listRecurringSchedules(clubId: string): Promise<RecurringSchedule[]> {
  return apiFetch(`/v1/clubs/${clubId}/recurring-schedules`);
}

export function getRecurringSchedule(clubId: string, scheduleId: string): Promise<RecurringSchedule> {
  return apiFetch(`/v1/clubs/${clubId}/recurring-schedules/${scheduleId}`);
}

export function updateRecurringSchedule(
  clubId: string,
  scheduleId: string,
  updates: {
    name?: string;
    location?: string;
    description?: string;
    courtCount?: number;
    maxParticipants?: number;
    defaultMatchFormat?: unknown;
    activityType?: string;
    recurrenceRule?: RecurrenceRule;
    generationLeadDays?: number;
    generationTime?: string;
    endDate?: string;
    skillLevelMinId?: string;
    skillLevelMaxId?: string;
    skillLevelEnforcement?: SkillLevelEnforcement;
    hostPlaying?: boolean;
  }
): Promise<RecurringSchedule> {
  return apiFetch(`/v1/clubs/${clubId}/recurring-schedules/${scheduleId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export function pauseRecurringSchedule(clubId: string, scheduleId: string): Promise<RecurringSchedule> {
  return apiFetch(`/v1/clubs/${clubId}/recurring-schedules/${scheduleId}/pause`, { method: 'POST' });
}

export function resumeRecurringSchedule(clubId: string, scheduleId: string): Promise<RecurringSchedule> {
  return apiFetch(`/v1/clubs/${clubId}/recurring-schedules/${scheduleId}/resume`, { method: 'POST' });
}

export function deleteRecurringSchedule(clubId: string, scheduleId: string): Promise<void> {
  return apiFetch(`/v1/clubs/${clubId}/recurring-schedules/${scheduleId}`, { method: 'DELETE' });
}

// Unifies "skip a future occurrence before it's generated" and "delete an
// already-generated Session" — DP-007 treats both as the same business
// event (skipping an occurrence), not two separate features.
export function skipOccurrence(clubId: string, scheduleId: string, occurrenceStartsAt: string): Promise<void> {
  return apiFetch(`/v1/clubs/${clubId}/recurring-schedules/${scheduleId}/occurrences/skip`, {
    method: 'POST',
    body: JSON.stringify({ occurrenceStartsAt }),
  });
}

// Manual override of the automatic ticker — generates this occurrence
// right now, without waiting for its Generation Policy lead time to elapse.
export function generateOccurrence(clubId: string, scheduleId: string, occurrenceStartsAt: string): Promise<Session> {
  return apiFetch(`/v1/clubs/${clubId}/recurring-schedules/${scheduleId}/occurrences/generate`, {
    method: 'POST',
    body: JSON.stringify({ occurrenceStartsAt }),
  });
}

export function listOccurrences(
  clubId: string,
  scheduleId: string,
  range?: { from?: string; to?: string }
): Promise<OccurrencePreview[]> {
  const params = new URLSearchParams();
  if (range?.from) params.set('from', range.from);
  if (range?.to) params.set('to', range.to);
  const query = params.toString();
  return apiFetch(`/v1/clubs/${clubId}/recurring-schedules/${scheduleId}/occurrences${query ? `?${query}` : ''}`);
}
