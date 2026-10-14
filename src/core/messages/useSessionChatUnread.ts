import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { useLiveEvents } from '../live/live';

// Unread messages in a Session's Chat (DP-021) — the Chat tab's badge.
// Session Chat isn't in Inbox, so it is counted on its own. Zero while the
// tab is open: reading it there marks it read.
export function useSessionChatUnread(sessionId: string, myUserId: string | undefined, viewing: boolean): number {
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    apiFetch<{ count: number }>(`/v1/sessions/${sessionId}/chat/unread`)
      .then((r) => setCount(r.count))
      .catch(() => {});
  }, [sessionId]);

  // On opening the Session, and again on leaving the Chat tab.
  useEffect(() => {
    if (viewing) setCount(0);
    else refresh();
  }, [viewing, refresh]);

  useLiveEvents((e) => {
    if (viewing || e.type !== 'message.created' || e.data?.kind !== 'session_chat' || e.data?.sessionId !== sessionId) return;
    if (e.data?.message?.senderId !== myUserId) setCount((c) => c + 1);
  });

  return viewing ? 0 : count;
}
