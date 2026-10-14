import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useLiveConnected, useLiveEvents } from '../live/live';
import { getUnreadMessageCount } from './api';

const POLL_MS = 60_000;

// Unread messages across Inbox's conversations (DP-021) — the Inbox tab's
// badge. Re-counted when a message arrives or a conversation is read over
// the live connection, on returning to the app, and once a minute while
// the connection is down.
export function useUnreadMessageCount(myUserId: string | undefined): number {
  const [count, setCount] = useState(0);
  const connected = useLiveConnected();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(() => {
    if (!myUserId) return;
    getUnreadMessageCount()
      .then((r) => setCount(r.count))
      .catch(() => {});
  }, [myUserId]);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (state) => state === 'active' && refresh());
    return () => {
      sub.remove();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [refresh]);

  // Coming (back) online may have missed events.
  useEffect(() => {
    if (connected) {
      refresh();
      return;
    }
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [connected, refresh]);

  useLiveEvents((e) => {
    const counts =
      (e.type === 'message.created' && e.data?.kind !== 'session_chat' && e.data?.message?.senderId !== myUserId) ||
      (e.type === 'read' && e.data?.userId === myUserId);
    if (!counts) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(refresh, 300);
  });

  return count;
}
