import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { apiUrl, authHeader } from '../api/client';
import { createCrashThrottle, describeError, type CrashKind } from './crashFilter';

// Sends app crashes to POST /v1/client-errors, which forwards them to the
// team's alert chat. Development builds don't send: the red error screen
// already shows them to the person who caused them.

let currentScreen: string | undefined;
const allow = createCrashThrottle();

// Kept up to date by the navigation container, so a report names the
// screen it came from.
export function setCurrentScreen(name: string | undefined) {
  currentScreen = name;
}

export function reportCrash(kind: CrashKind, error: unknown): void {
  if (__DEV__) return;
  const { message, stack } = describeError(error);
  if (!allow(message, Date.now())) return;
  void send({
    kind,
    message,
    stack,
    platform: Platform.OS,
    appVersion: Constants.expoConfig?.version ?? '',
    screen: currentScreen ?? '',
  });
}

// Never throws and never retries: a failed report is not worth a second
// failure.
async function send(report: Record<string, string>) {
  try {
    const headers = {
      'Content-Type': 'application/json',
      ...(await authHeader().catch(() => ({}))),
    };
    await fetch(apiUrl('/v1/client-errors'), {
      method: 'POST',
      headers,
      body: JSON.stringify(report),
      // Lets the request finish if the page is being closed or reloaded.
      keepalive: true,
    });
  } catch {
    // Offline, API down, or no API URL configured.
  }
}
