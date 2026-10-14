import { useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { startLive, stopLive } from './live';

// Keeps the live connection (DP-021) open while someone is signed in.
// Renders nothing; mounted next to PushSync.
export function LiveSync() {
  const { profile } = useAuth();
  useEffect(() => {
    if (!profile?.id) return;
    startLive();
    return () => stopLive();
  }, [profile?.id]);
  return null;
}
