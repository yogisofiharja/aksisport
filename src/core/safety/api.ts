import { apiFetch } from '../api/client';
import type { BlockedUser, ClubReport } from '../api/types';

// DP-021 step 2: blocking (silent, undone from Settings) and reporting
// (to the owner/admins of the Communities a report concerns).

export function blockUser(userId: string): Promise<void> {
  return apiFetch(`/v1/users/${userId}/block`, { method: 'PUT' });
}

export function unblockUser(userId: string): Promise<void> {
  return apiFetch(`/v1/users/${userId}/block`, { method: 'DELETE' });
}

export function listMyBlocks(): Promise<BlockedUser[]> {
  return apiFetch('/v1/me/blocks');
}

export function reportUser(userId: string, reason: string): Promise<void> {
  return apiFetch('/v1/reports', { method: 'POST', body: JSON.stringify({ userId, reason }) });
}

export function reportMessage(messageId: string, reason: string): Promise<void> {
  return apiFetch('/v1/reports', { method: 'POST', body: JSON.stringify({ messageId, reason }) });
}

export function listClubReports(clubId: string): Promise<ClubReport[]> {
  return apiFetch(`/v1/clubs/${clubId}/reports`);
}

export function countClubReports(clubId: string): Promise<{ count: number }> {
  return apiFetch(`/v1/clubs/${clubId}/reports/count`);
}

export function dismissReport(clubId: string, reportId: string): Promise<void> {
  return apiFetch(`/v1/clubs/${clubId}/reports/${reportId}/dismiss`, { method: 'POST' });
}

export function removeReportedMessage(clubId: string, reportId: string): Promise<void> {
  return apiFetch(`/v1/clubs/${clubId}/reports/${reportId}/remove-message`, { method: 'POST' });
}
