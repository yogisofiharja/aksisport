import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../core/auth/AuthContext';
import { useTranslation } from '../../i18n';
import { listSessionMessages, sendSessionMessage } from '../../core/sessions/api';
import { isWithinChatWindow } from '../../core/sessions/sessionSchedule';
import { ConversationThread } from './ConversationThread';
import type { ConversationMessage, Session } from '../../core/api/types';

type Props = {
  sessionId: string;
  session: Session;
};

// DP-011 Session Chat — the group thread, visible to and postable by
// everyone who can already see the Session. Shares its messaging engine
// with DP-013 Contact Organizer (see ConversationThread); what's specific
// to Chat is just who the participants are (everyone) and the 1-week
// posting window below.
const POLL_INTERVAL_MS = 5000;

export function SessionChat({ sessionId, session }: Props) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  // DP-011: posting closes 1 week after the Session ends; history stays
  // readable forever. The server (sessionChatWindowOpen) is the actual
  // enforcement — this only drives the compose bar's own UI.
  const canPost = isWithinChatWindow(session);

  const load = useCallback(async () => {
    try {
      setMessages(await listSessionMessages(sessionId));
    } catch {
      // keep the stale list; the next poll or pull-to-refresh retries
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  async function handleSend(body: string, image?: { base64: string; contentType: string }) {
    const message = await sendSessionMessage(sessionId, { body: body || undefined, image });
    setMessages((prev) => [...prev, message]);
  }

  return (
    <ConversationThread
      sessionId={sessionId}
      messages={messages}
      loading={loading}
      onRefresh={load}
      myUserId={profile?.id ?? ''}
      canPost={canPost}
      closedNotice={t('sessionChatClosedNotice')}
      emptyText={t('sessionChatEmpty')}
      placeholder={t('sessionChatPlaceholder')}
      onSend={handleSend}
    />
  );
}
