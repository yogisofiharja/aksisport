import { apiFetch, apiUrl } from '../api/client';
import type {
  Club,
  ClubBankAccount,
  ClubJoinRequest,
  ClubMember,
  ClubPreview,
  ClubRole,
  ClubVisibility,
  ClubWithRole,
} from '../api/types';

export function createClub(
  name: string,
  details: { cityCode: string; visibility: ClubVisibility; description?: string }
): Promise<Club> {
  return apiFetch('/v1/clubs', {
    method: 'POST',
    body: JSON.stringify({ name, ...details }),
  });
}

// --- Discovery & joining (DP-017) ---

// Communities whose name, city or province contains `query`. The server answers
// [] under two characters.
export function searchClubs(query: string): Promise<ClubPreview[]> {
  return apiFetch(`/v1/clubs/search?q=${encodeURIComponent(query)}`);
}

// Communities in the caller's own city that they haven't joined — what
// Explore shows before a search is typed. [] if they have set no city.
export function listClubsInMyCity(): Promise<ClubPreview[]> {
  return apiFetch('/v1/clubs/in-my-city');
}

// Open to anyone signed in, member or not.
export function getClubPreview(clubId: string): Promise<ClubPreview> {
  return apiFetch(`/v1/clubs/${clubId}/preview`);
}

// Public Community: the caller becomes a member (viewerRole is set in the
// answer). Private: a join request is recorded (viewerRequestPending).
export function joinClub(clubId: string): Promise<ClubPreview> {
  return apiFetch(`/v1/clubs/${clubId}/join`, { method: 'POST' });
}

export function cancelJoinRequest(clubId: string): Promise<void> {
  return apiFetch(`/v1/clubs/${clubId}/join-request`, { method: 'DELETE' });
}

// Owner/admin only.
export function listJoinRequests(clubId: string): Promise<ClubJoinRequest[]> {
  return apiFetch(`/v1/clubs/${clubId}/join-requests`);
}

export function decideJoinRequest(clubId: string, requestId: string, decision: 'approve' | 'decline'): Promise<void> {
  return apiFetch(`/v1/clubs/${clubId}/join-requests/${requestId}/${decision}`, { method: 'POST' });
}

export function listClubs(): Promise<ClubWithRole[]> {
  return apiFetch('/v1/clubs');
}

export function getClub(clubId: string): Promise<Club> {
  return apiFetch(`/v1/clubs/${clubId}`);
}

export function updateClub(
  clubId: string,
  updates: { name?: string; description?: string; cityCode?: string; visibility?: ClubVisibility }
): Promise<Club> {
  return apiFetch(`/v1/clubs/${clubId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export function deleteClub(clubId: string): Promise<void> {
  return apiFetch(`/v1/clubs/${clubId}`, { method: 'DELETE' });
}

// Owner-only to set — see clubs_handler.go's POST /clubs/:clubId/avatar.
export function uploadClubAvatar(clubId: string, image: { base64: string; contentType: string }): Promise<Club> {
  return apiFetch(`/v1/clubs/${clubId}/avatar`, {
    method: 'POST',
    body: JSON.stringify({ imageBase64: image.base64, imageContentType: image.contentType }),
  });
}

// Not fetched via apiFetch — a URL for an `<Image>` source (with
// authHeader() as its request headers), same convention as
// participantReceiptUrl/conversationMessageImageUrl.
export function clubAvatarUrl(clubId: string): string {
  return apiUrl(`/v1/clubs/${clubId}/avatar`);
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
