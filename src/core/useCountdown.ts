import { useCallback, useEffect, useState } from 'react';

// Seconds remaining until a moment set by start(seconds); 0 when idle or
// done. Counts against the wall clock rather than decrementing a number,
// so it stays right after the tab or app has been in the background.
export function useCountdown(): [number, (seconds: number) => void] {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (endsAt == null) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) setEndsAt(null);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [endsAt]);

  const start = useCallback((seconds: number) => {
    setEndsAt(Date.now() + Math.max(0, seconds) * 1000);
  }, []);

  return [secondsLeft, start];
}

// How long the server makes a caller wait between two confirmation codes
// (account.ResendCooldown) — used to start the countdown right after a
// successful send, when the server has no reason to report it.
export const RESEND_COOLDOWN_SECONDS = 60;
