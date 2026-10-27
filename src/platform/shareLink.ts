import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';

// Where the web app lives — the origin every shareable link points at.
// In a browser that is simply wherever the app is running (so staging
// links stay on staging); the native apps have no origin of their own and
// use EXPO_PUBLIC_APP_URL, defaulting to production.
function appOrigin(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin;
  return (process.env.EXPO_PUBLIC_APP_URL || 'https://app.aksisport.com').replace(/\/$/, '');
}

// The link a Community is shared by (DP-017). The path matches the
// ClubDetail route in navigation/linking.ts.
export function clubLink(clubId: string): string {
  return `${appOrigin()}/clubs/${clubId}`;
}

// The link a Session is shared by. The path matches the SessionDetail
// route in navigation/linking.ts.
export function sessionLink(sessionId: string): string {
  return `${appOrigin()}/sessions/${sessionId}`;
}

// An invite link (DP-028). The path matches the Invite route in
// navigation/linking.ts.
export function inviteLink(token: string): string {
  return `${appOrigin()}/i/${token}`;
}

// The link without the scheme, for showing ("app.aksisport.com/i/k7Qp…").
export function displayLink(url: string): string {
  return url.replace(/^https?:\/\//, '');
}

// Copy link (DP-028): true when it reached the clipboard.
export async function copyLink(url: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(url);
    return true;
  } catch {
    return false;
  }
}

export type ShareOutcome = 'shared' | 'copied' | 'failed';

// Hands a link to the platform's own share sheet where there is one
// (native, and browsers that implement the Web Share API — mostly phones),
// otherwise copies it to the clipboard. 'copied' is the one outcome the
// caller has to tell the person about; a share sheet speaks for itself,
// and dismissing it is not a failure.
export async function shareLink(url: string, title: string): Promise<ShareOutcome> {
  if (Platform.OS !== 'web') {
    try {
      await Share.share(Platform.OS === 'ios' ? { url, message: title } : { message: `${title}\n${url}` });
      return 'shared';
    } catch {
      return 'failed';
    }
  }
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, url });
      return 'shared';
    } catch (err) {
      // AbortError: the person closed the sheet. Anything else: fall
      // through to copying.
      if (err instanceof Error && err.name === 'AbortError') return 'shared';
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
