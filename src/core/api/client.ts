import { auth } from '../../firebase';
import type { ApiError, SessionContactThread, UserProfile, UserSummary } from './types';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export class ApiRequestError extends Error {
  status: number;
  code?: string;
  retryAfterSeconds?: number;

  constructor(status: number, body: ApiError) {
    super(body.error || `Request failed with status ${status}`);
    this.status = status;
    this.code = body.code;
    this.retryAfterSeconds = body.retryAfterSeconds;
  }
}

// Shared by apiFetch and anything that needs to hit the API outside of
// apiFetch's own JSON request/response shape — currently just Session
// Chat's image `<Image>` tags, which need the same bearer token as a
// plain `source.headers` object (React Native's Image supports request
// headers on network sources) since GET .../messages/:id/image is behind
// the same auth as every other route.
export async function authHeader(): Promise<Record<string, string>> {
  const token = await auth?.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Resolves a path to a full API URL — for callers that need the URL
// itself rather than a fetched/parsed response, e.g. an `<Image>` source.
export function apiUrl(path: string): string {
  if (!BASE_URL) throw new Error('EXPO_PUBLIC_API_BASE_URL is not configured');
  return `${BASE_URL}${path}`;
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> | undefined),
    // Applied last, same as before this was factored out — always wins
    // over any Authorization a caller's own options.headers might set.
    ...(await authHeader()),
  };

  const response = await fetch(apiUrl(path), { ...options, headers });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiRequestError(response.status, body as ApiError);
  }
  return body as T;
}

export function checkUsername(username: string): Promise<{ available: boolean }> {
  return apiFetch(`/v1/users/check-username?username=${encodeURIComponent(username)}`);
}

// Backs "add member" search dialogs — matches username or display name,
// case-insensitive substring, excludes the caller. Server returns [] for
// queries under 2 characters rather than erroring.
export function searchUsers(query: string): Promise<UserSummary[]> {
  return apiFetch(`/v1/users/search?q=${encodeURIComponent(query)}`);
}

// `email` is the address to confirm (DP-015) — always sent by sign-up,
// omitted only when completing an interrupted sign-up, where the
// confirmation step asks for it instead.
export function createProfile(username: string, displayName?: string, email?: string): Promise<UserProfile> {
  return apiFetch('/v1/users', {
    method: 'POST',
    body: JSON.stringify({ username, displayName, email }),
  });
}

// --- Account email & password recovery (DP-015) ---

// Emails a 6-digit code to `email` and records it as the caller's pending
// address. Also how a code is re-sent.
export function requestEmailCode(email: string): Promise<UserProfile> {
  return apiFetch('/v1/me/email', { method: 'POST', body: JSON.stringify({ email }) });
}

export function confirmEmailCode(code: string): Promise<UserProfile> {
  return apiFetch('/v1/me/email/verify', { method: 'POST', body: JSON.stringify({ code }) });
}

// Which Firebase identity to sign in as for this email. Always answers —
// an email nobody confirmed gets an identity that fails like a wrong
// password — so it never reveals whether the email is registered.
export function resolveLoginIdentity(email: string): Promise<{ loginEmail: string }> {
  return apiFetch('/v1/auth/login-identity', { method: 'POST', body: JSON.stringify({ email }) });
}

// Succeeds whether or not the account exists or has a confirmed email.
export function requestPasswordReset(identifier: string): Promise<void> {
  return apiFetch('/v1/auth/password-reset/request', { method: 'POST', body: JSON.stringify({ identifier }) });
}

export function confirmPasswordReset(identifier: string, code: string, newPassword: string): Promise<void> {
  return apiFetch('/v1/auth/password-reset/confirm', {
    method: 'POST',
    body: JSON.stringify({ identifier, code, newPassword }),
  });
}

export function getMe(): Promise<UserProfile> {
  return apiFetch('/v1/me');
}

export function updateMe(updates: Partial<Pick<UserProfile, 'displayName' | 'phoneNumber' | 'avatarUrl'>>): Promise<UserProfile> {
  return apiFetch('/v1/me', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

// Self-service only — the caller sets their own profile picture, never
// someone else's. See users_handler.go's POST /me/avatar.
export function uploadMyAvatar(image: { base64: string; contentType: string }): Promise<UserProfile> {
  return apiFetch('/v1/me/avatar', {
    method: 'POST',
    body: JSON.stringify({ imageBase64: image.base64, imageContentType: image.contentType }),
  });
}

// Not fetched via apiFetch — a URL for an `<Image>` source (with
// authHeader() as its request headers), same convention as
// clubAvatarUrl/participantReceiptUrl. Visible to any authenticated user
// with a profile, not scoped to a shared Club.
export function userAvatarUrl(userId: string): string {
  return apiUrl(`/v1/users/${userId}/avatar`);
}

// DP-013 Contact Organizer's Inbox listing — every thread the caller is a
// party to, either as the member or as an owner/admin of the Session's
// Club, most-recently-active first. Backs the Inbox tab.
export function listMyContactThreads(): Promise<SessionContactThread[]> {
  return apiFetch('/v1/me/contact-threads');
}
