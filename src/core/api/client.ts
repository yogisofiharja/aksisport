import { auth } from '../../firebase';
import type { ApiError, UserProfile, UserSummary } from './types';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export class ApiRequestError extends Error {
  status: number;
  code?: string;

  constructor(status: number, body: ApiError) {
    super(body.error || `Request failed with status ${status}`);
    this.status = status;
    this.code = body.code;
  }
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  if (!BASE_URL) throw new Error('EXPO_PUBLIC_API_BASE_URL is not configured');

  const token = await auth?.currentUser?.getIdToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
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

export function createProfile(username: string, displayName?: string): Promise<UserProfile> {
  return apiFetch('/v1/users', {
    method: 'POST',
    body: JSON.stringify({ username, displayName }),
  });
}

export function getMe(): Promise<UserProfile> {
  return apiFetch('/v1/me');
}

export function updateMe(updates: Partial<Pick<UserProfile, 'displayName' | 'email' | 'phoneNumber' | 'avatarUrl'>>): Promise<UserProfile> {
  return apiFetch('/v1/me', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}
