import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HStack } from '../../design-system/layout/HStack';
import { VStack } from '../../design-system/layout/VStack';
import { Typography } from '../../design-system/ui/Typography';
import { Icon } from '../../design-system/ui/Icon';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import { usePollInterval, useLiveEvents, type LiveEvent } from '../../core/live/live';
import { ConversationThread } from '../sessions/ConversationThread';
import type { ConversationMessage } from '../../core/api/types';

type OutgoingImage = { base64: string; contentType: string };

type Props = {
  onBack: () => void;
  // Header: picture, name, a line under it; tapping opens details; ⋮ menu.
  avatar: ReactNode;
  title: string;
  subtitle?: string;
  onPressHeader?: () => void;
  onMenu?: () => void;
  // Where this chat's messages come from and go to.
  fetchMessages: () => Promise<ConversationMessage[]>;
  sendMessage: (message: { body?: string; image?: OutgoingImage }) => Promise<ConversationMessage>;
  imageUrl: (messageId: string) => string;
  // Before the first message there is no conversation on screen for the
  // thread to match live events against: says whether one belongs here.
  isNewMessageHere: (event: LiveEvent) => boolean;
  canPost?: boolean;
  closedNotice?: string;
  emptyText: string;
  // Shown instead of the thread when messages can't be loaded at all
  // (e.g. not allowed in this chat).
  unavailableText: string;
  receipts?: 'direct' | 'group';
  onModeratorRemove?: (messageId: string) => Promise<void>;
  // Sheets and dialogs that belong to this chat.
  children?: ReactNode;
};

// One chat screen for every kind of conversation people open by itself
// (DP-020, DP-021): a direct message, a group, a Community's chat. Only
// the header and where messages are loaded from and sent to differ; the
// thread, live updates, polling fallback, read receipts, typing, editing,
// deleting and reporting are all the same machine.
export function ChatRoom({
  onBack,
  avatar,
  title,
  subtitle,
  onPressHeader,
  onMenu,
  fetchMessages,
  sendMessage,
  imageUrl,
  isNewMessageHere,
  canPost = true,
  closedNotice = '',
  emptyText,
  unavailableText,
  receipts = 'group',
  onModeratorRemove,
  children,
}: Props) {
  const { t } = useTranslation();
  const { profile: me } = useAuth();
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  // The latest fetch function without re-subscribing on every render.
  const fetchRef = useRef(fetchMessages);
  fetchRef.current = fetchMessages;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const load = useCallback(async () => {
    try {
      setMessages(await fetchRef.current());
      setUnavailable(false);
    } catch {
      // Say so only if nothing has loaded; otherwise keep what's there.
      setUnavailable((was) => was || messagesRef.current.length === 0);
    } finally {
      setLoading(false);
    }
  }, []);
  // New messages arrive over the live connection (the thread re-fetches on
  // each); polling is the fallback.
  const pollInterval = usePollInterval();
  useEffect(() => {
    load();
    const interval = setInterval(load, pollInterval);
    return () => clearInterval(interval);
  }, [load, pollInterval]);

  useLiveEvents((e) => {
    if (e.type === 'message.created' && messages.length === 0 && isNewMessageHere(e)) load();
  });

  async function handleSend(body: string, image?: OutgoingImage) {
    const message = await sendMessage({ body: body || undefined, image });
    setMessages((prev) => [...prev, message]);
  }

  return (
    <SafeAreaView className="flex-1 bg-ground dark:bg-ground-dark">
      <HStack className="items-center px-4 pt-3 pb-3 border-b border-border dark:border-border-dark" space="sm">
        <Pressable className="p-2 -ml-2 active:opacity-60" onPress={onBack}>
          <Icon name="arrow-back" size="lg" />
        </Pressable>
        <Pressable
          className="flex-row items-center gap-3 active:opacity-70"
          style={{ flex: 1 }}
          onPress={onPressHeader}
          disabled={!onPressHeader}
        >
          {avatar}
          <VStack style={{ flex: 1 }}>
            <Typography variant="body" className="font-bold" numberOfLines={1}>
              {title}
            </Typography>
            {subtitle ? (
              <Typography variant="body" color="muted" className="text-xs" numberOfLines={1}>
                {subtitle}
              </Typography>
            ) : null}
          </VStack>
        </Pressable>
        {onMenu && (
          <Pressable className="p-2 -mr-2 active:opacity-60" onPress={onMenu} hitSlop={4}>
            <Icon name="ellipsis-vertical" size="lg" />
          </Pressable>
        )}
      </HStack>

      {unavailable && messages.length === 0 && !loading ? (
        <Typography variant="body" color="muted" className="px-5 pt-6">
          {unavailableText}
        </Typography>
      ) : (
        <View style={{ flex: 1 }}>
          <ConversationThread
            imageUrl={imageUrl}
            messages={messages}
            loading={loading}
            onRefresh={load}
            myUserId={me?.id ?? ''}
            canPost={canPost}
            closedNotice={closedNotice}
            emptyText={emptyText}
            placeholder={t('sessionChatPlaceholder')}
            onSend={handleSend}
            receipts={receipts}
            onModeratorRemove={onModeratorRemove}
          />
        </View>
      )}
      {children}
    </SafeAreaView>
  );
}
