import { Platform } from 'react-native';
import { reportCrash } from './reportCrash';

// Errors that escape React rendering: thrown in event handlers, timers
// and promises nobody awaited. Rendering errors are caught by
// CrashBoundary instead. Call once, at start-up.
export function installCrashHandlers() {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return;
    window.addEventListener('error', (event) => {
      reportCrash('uncaught', event.error ?? event.message);
    });
    window.addEventListener('unhandledrejection', (event) => {
      reportCrash('unhandledRejection', event.reason);
    });
    return;
  }

  // React Native's global handler. The previous one is kept: in a release
  // build it is what closes the app after a fatal error.
  const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (!errorUtils) return;
  const previous = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    reportCrash('uncaught', error);
    previous(error, isFatal);
  });
}

type ErrorUtilsLike = {
  getGlobalHandler: () => (error: unknown, isFatal?: boolean) => void;
  setGlobalHandler: (handler: (error: unknown, isFatal?: boolean) => void) => void;
};
