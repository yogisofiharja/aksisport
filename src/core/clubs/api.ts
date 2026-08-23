import { apiFetch } from '../api/client';
import type { Club, ClubBankAccount, ClubMember, ClubRole, ClubWithRole } from '../api/types';

export function createClub(name: string, description?: string): Promise<Club> {
  return apiFetch('/v1/clubs', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
}

export function listClubs(): Promise<ClubWithRole[]> {
  return apiFetch('/v1/clubs');
}

export function getClub(clubId: string): Promise<Club> {
  return apiFetch(`/v1/clubs/${clubId}`);
}

export function updateClub(clubId: string, updates: { name?: string; description?: string }): Promise<Club> {
  return apiFetch(`/v1/clubs/${clubId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export function deleteClub(clubId: string): Promise<void> {
  return apiFetch(`/v1/clubs/${clubId}`, { method: 'DELETE' });
}

export function listMembers(clubId: string): Promise<ClubMember[]> {
  return apiFetch(`/v1/clubs/${clubId}/members`);
}

export function addMemberByUsername(clubId: string, username: string): Promise<ClubMember> {
  return apiFetch(`/v1/clubs/${clubId}/members`, {
    method: 'POST',
    body: JSON.stringify({ username }),
  });
}

export function changeMemberRole(clubId: string, userId: string, role: Exclude<ClubRole, 'owner'>): Promise<ClubMember> {
  return apiFetch(`/v1/clubs/${clubId}/members/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export function removeMember(clubId: string, userId: string): Promise<void> {
  return apiFetch(`/v1/clubs/${clubId}/members/${userId}`, { method: 'DELETE' });
}

// Milestone 5 (Session Finance) — a Club can list more than one bank
// account. Listed by any member; managed (create/update/delete) by the
// owner only, same permission level as every other Club-level setting.
export function listClubBankAccounts(clubId: string): Promise<ClubBankAccount[]> {
  return apiFetch(`/v1/clubs/${clubId}/bank-accounts`);
}

export function createClubBankAccount(
  clubId: string,
  account: { bankName: string; accountNumber: string; accountName: string }
): Promise<ClubBankAccount> {
  return apiFetch(`/v1/clubs/${clubId}/bank-accounts`, {
    method: 'POST',
    body: JSON.stringify(account),
  });
}

export function updateClubBankAccount(
  clubId: string,
  accountId: string,
  updates: { bankName?: string; accountNumber?: string; accountName?: string }
): Promise<ClubBankAccount> {
  return apiFetch(`/v1/clubs/${clubId}/bank-accounts/${accountId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export function deleteClubBankAccount(clubId: string, accountId: string): Promise<void> {
  return apiFetch(`/v1/clubs/${clubId}/bank-accounts/${accountId}`, { method: 'DELETE' });
}
