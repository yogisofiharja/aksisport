import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth } from '../../firebase';
import { resolveLoginIdentity } from '../api/client';

// Firebase Auth requires an email-shaped identifier for password auth.
// Usernames never need to resolve as real mail — Firebase only checks syntax.
const SYNTHETIC_EMAIL_DOMAIN = 'accounts.aksi.app';

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

// Recovers the username from a Firebase user's synthetic email — used to
// resume profile creation if sign-up succeeded on Firebase but the
// POST /v1/users call never completed (e.g. app killed mid-signup).
export function emailToUsername(email: string | null | undefined): string | null {
  if (!email || !email.endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`)) return null;
  return email.slice(0, -(SYNTHETIC_EMAIL_DOMAIN.length + 1));
}

export async function signUp(username: string, password: string) {
  if (!auth) throw new Error('Firebase auth is not configured');
  return createUserWithEmailAndPassword(auth, usernameToEmail(username), password);
}

// `identifier` is a username or a confirmed email (DP-015). Firebase only
// knows the synthetic identity, so an email is first resolved to it by
// the server.
export async function signIn(identifier: string, password: string) {
  if (!auth) throw new Error('Firebase auth is not configured');
  const trimmed = identifier.trim();
  const loginEmail = trimmed.includes('@') ? (await resolveLoginIdentity(trimmed)).loginEmail : usernameToEmail(trimmed);
  return signInWithEmailAndPassword(auth, loginEmail, password);
}

export async function signOutUser() {
  if (!auth) return;
  return signOut(auth);
}
