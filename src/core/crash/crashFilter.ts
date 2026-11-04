// Pure helpers for crash reporting: no React Native imports, so they run
// under vitest.

export type CrashKind = 'render' | 'uncaught' | 'unhandledRejection';

export type CrashDetails = { message: string; stack: string };

// Anything can be thrown; reduce it to a message and a stack.
export function describeError(error: unknown): CrashDetails {
  if (error instanceof Error) {
    return { message: error.message || error.name || 'Error', stack: error.stack ?? '' };
  }
  if (typeof error === 'string') return { message: error, stack: '' };
  try {
    return { message: JSON.stringify(error) ?? String(error), stack: '' };
  } catch {
    return { message: String(error), stack: '' };
  }
}

// Decides which reports go out. A crash in a render loop or a timer can
// fire hundreds of times a second: the same message is sent at most once
// a minute, and one app run sends at most `maxPerRun` reports in all. The
// server groups repeats across players too; this keeps one phone from
// using up the rate limit.
export function createCrashThrottle(maxPerRun = 20, repeatMs = 60_000) {
  const lastSent = new Map<string, number>();
  let sent = 0;
  return (message: string, now: number): boolean => {
    if (sent >= maxPerRun) return false;
    const key = message.split('\n')[0].slice(0, 200);
    const last = lastSent.get(key);
    if (last !== undefined && now - last < repeatMs) return false;
    lastSent.set(key, now);
    sent += 1;
    return true;
  };
}
