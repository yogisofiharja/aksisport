import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, KeyboardAvoidingView, Platform, RefreshControl, ScrollView } from 'react-native';
import { appAlert } from '../../design-system/feedback/appAlert';
import { Icon } from '../../design-system/ui/Icon';
import { Box, HStack, VStack } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import { Input, InputField } from '../../../components/ui/input';
import { Pressable } from '../../../components/ui/pressable';
import { useTranslation } from '../../i18n';
import { authHeader } from '../../core/api/client';
import { pickImageAsDataUrl, parseDataUrl } from '../../imagePicker';
import {
  DELETE_FOR_EVERYONE_WINDOW_MS,
  EDIT_WINDOW_MS,
  deleteMessage,
  editMessage,
  listConversationReads,
  markConversationRead,
} from '../../core/messages/api';
import { sendLive, useLiveEvents } from '../../core/live/live';
import { ReportSheet, type ReportTarget } from '../safety/ReportSheet';
import type { ConversationMessage, ConversationRead } from '../../core/api/types';

type Props = {
  // Where a message's image is served from — differs by kind of
  // conversation (Session Chat / Contact Organizer vs direct messages).
  imageUrl: (messageId: string) => string;
  messages: ConversationMessage[];
  loading: boolean;
  onRefresh: () => void;
  myUserId: string;
  canPost: boolean;
  closedNotice: string;
  emptyText: string;
  placeholder: string;
  onSend: (body: string, image?: { base64: string; contentType: string }) => Promise<void>;
  // How read receipts read under your latest message (DP-021): "Seen" in a
  // one-to-one conversation, "Seen by N" where there are more people.
  receipts?: 'direct' | 'group';
};

// Shared by DP-011 Session Chat and DP-013 Contact Organizer — the two
// share one messaging engine server-side; this is the one presentational
// piece they share client-side too. What differs between callers is
// entirely in props: which messages, whether posting is currently open,
// and where a send actually goes.
const MAX_BODY_LENGTH = 2000;

type PendingImage = { base64: string; contentType: string; dataUrl: string };

function messageAuthorName(m: ConversationMessage) {
  return m.senderDisplayName || m.senderUsername;
}

// Typing shows for this long after the last signal; senders repeat it
// every few seconds while they type.
const TYPING_SHOW_MS = 5000;
const TYPING_SEND_EVERY_MS = 3000;

function formatMessageTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ConversationThread({ imageUrl, messages, loading, onRefresh, myUserId, canPost, closedNotice, emptyText, placeholder, onSend, receipts = 'group' }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [sending, setSending] = useState(false);
  const [imageHeaders, setImageHeaders] = useState<Record<string, string>>({});
  const scrollRef = useRef<ScrollView>(null);

  // DP-021: live updates, read receipts and typing. The conversation is
  // known from its messages — before the first one there is nothing to
  // read or receive yet.
  const conversationId = useMemo(() => messages.find((m) => m.conversationId)?.conversationId, [messages]);
  const lastMessageId = messages.length > 0 ? messages[messages.length - 1].id : undefined;
  const [reads, setReads] = useState<ConversationRead[]>([]);
  const [typing, setTyping] = useState<Record<string, { name: string; until: number }>>({});
  const lastTypingSent = useRef(0);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  // The message being edited in the compose bar, if any (DP-021).
  const [editing, setEditing] = useState<ConversationMessage | null>(null);

  useEffect(() => {
    setReads([]);
    if (!conversationId) return;
    listConversationReads(conversationId).then(setReads).catch(() => {});
  }, [conversationId]);

  // Reading the screen marks the conversation read — on each new message,
  // and on coming back to the app.
  useEffect(() => {
    if (!conversationId) return;
    const mark = () => {
      if (AppState.currentState === 'active') markConversationRead(conversationId).catch(() => {});
    };
    mark();
    const sub = AppState.addEventListener('change', (state) => state === 'active' && mark());
    return () => sub.remove();
  }, [conversationId, lastMessageId]);

  useLiveEvents((e) => {
    if (!conversationId || e.data?.conversationId !== conversationId) return;
    if (e.type === 'message.created') {
      const senderId = e.data.message?.senderId;
      setTyping((prev) => {
        const { [senderId]: _, ...rest } = prev;
        return rest;
      });
      if (!messages.some((m) => m.id === e.data.message?.id)) onRefresh();
    } else if (e.type === 'message.removed' || e.type === 'message.updated') {
      onRefresh();
    } else if (e.type === 'read') {
      setReads((prev) => [...prev.filter((r) => r.userId !== e.data.userId), { userId: e.data.userId, lastReadAt: e.data.lastReadAt }]);
    } else if (e.type === 'typing' && e.data.userId !== myUserId) {
      setTyping((prev) => ({ ...prev, [e.data.userId]: { name: e.data.name, until: Date.now() + TYPING_SHOW_MS } }));
    }
  });

  // Let typing indicators lapse.
  const typingCount = Object.keys(typing).length;
  useEffect(() => {
    if (typingCount === 0) return;
    const id = setInterval(() => {
      setTyping((prev) => {
        const now = Date.now();
        const kept = Object.fromEntries(Object.entries(prev).filter(([, v]) => v.until > now));
        return Object.keys(kept).length === Object.keys(prev).length ? prev : kept;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [typingCount]);

  // Long-press a message (DP-021), WhatsApp's rules: your own can be
  // edited for 15 minutes and deleted for everyone for about 2½ days; any
  // can be deleted for you; someone else's can be reported.
  function handleMessageLongPress(m: ConversationMessage) {
    const isMine = m.senderId === myUserId;
    const age = Date.now() - new Date(m.createdAt).getTime();
    const gone = m.deleted || m.removed;
    const canDeleteForEveryone = isMine && !gone && age < DELETE_FOR_EVERYONE_WINDOW_MS;
    // At most three buttons per prompt: Android's alert shows no more.
    const buttons: Parameters<typeof appAlert>[2] = [];
    if (isMine && !gone && canPost && age < EDIT_WINDOW_MS) {
      buttons.push({ text: t('chatEdit'), onPress: () => startEditing(m) });
    }
    buttons.push({ text: t('chatDelete'), style: 'destructive', onPress: () => askDelete(m, canDeleteForEveryone) });
    if (!isMine && !gone) {
      buttons.push({
        text: t('chatReportMessage'),
        style: 'destructive',
        onPress: () => setReportTarget({ kind: 'message', messageId: m.id, name: messageAuthorName(m) }),
      });
    }
    buttons.push({ text: t('clubCancel'), style: 'cancel' });
    appAlert(t('chatMessageActions'), undefined, buttons);
  }

  function askDelete(m: ConversationMessage, canDeleteForEveryone: boolean) {
    const run = (scope: 'me' | 'everyone') =>
      deleteMessage(m.id, scope)
        .then(onRefresh)
        .catch(() => appAlert(t('chatEditFailed')));
    appAlert(t('chatDeleteTitle'), undefined, [
      ...(canDeleteForEveryone ? [{ text: t('chatDeleteForEveryone'), style: 'destructive' as const, onPress: () => run('everyone') }] : []),
      { text: t('chatDeleteForMe'), style: 'destructive', onPress: () => run('me') },
      { text: t('clubCancel'), style: 'cancel' },
    ]);
  }

  function startEditing(m: ConversationMessage) {
    setEditing(m);
    setPendingImage(null);
    setDraft(m.body);
  }

  function stopEditing() {
    setEditing(null);
    setDraft('');
  }

  function handleDraftChange(text: string) {
    setDraft(text);
    const now = Date.now();
    if (conversationId && text.trim() && now - lastTypingSent.current > TYPING_SEND_EVERY_MS) {
      lastTypingSent.current = now;
      sendLive({ type: 'typing', conversationId });
    }
  }

  // "Seen" under your own latest message, when it is the last one.
  const seenLabel = useMemo(() => {
    const last = messages[messages.length - 1];
    if (!last || last.senderId !== myUserId) return null;
    const sentAt = new Date(last.createdAt).getTime();
    const seenBy = reads.filter((r) => r.userId !== myUserId && new Date(r.lastReadAt).getTime() >= sentAt);
    if (seenBy.length === 0) return null;
    return receipts === 'direct' ? t('chatSeen') : t('chatSeenByCount', seenBy.length);
  }, [messages, reads, myUserId, receipts, t]);

  const typingNames = Object.values(typing).map((v) => v.name);
  const typingLabel =
    typingNames.length === 0 ? null : typingNames.length === 1 ? t('chatTyping', typingNames[0]) : t('chatTypingMany', typingNames.length);

  // GET .../conversation-messages/:id/image is behind the same auth as
  // every other route — fetched once per mount, same convention
  // throughout the app.
  useEffect(() => {
    authHeader().then(setImageHeaders);
  }, []);

  // Best-effort "jump to latest" — not chat-app-grade (no distinction
  // between "user is reading history" and "new message arrived while
  // scrolled up"), acceptable for this scale.
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: false });
  }, [messages.length, typingLabel !== null]);

  async function handlePickImage(source: 'camera' | 'gallery') {
    const dataUrl = await pickImageAsDataUrl(source);
    if (!dataUrl) return;
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) return;
    setPendingImage({ ...parsed, dataUrl });
  }

  function handleAttach() {
    appAlert(t('sessionChatAttachImageTitle'), undefined, [
      { text: t('sessionChatAttachCamera'), onPress: () => handlePickImage('camera') },
      { text: t('sessionChatAttachGallery'), onPress: () => handlePickImage('gallery') },
      { text: t('clubCancel'), style: 'cancel' },
    ]);
  }

  async function handleSend() {
    const trimmed = draft.trim();
    if (editing) {
      if ((!trimmed && !editing.hasImage) || sending) return;
      setSending(true);
      try {
        if (trimmed !== editing.body) {
          await editMessage(editing.id, trimmed);
          onRefresh();
        }
        stopEditing();
      } catch {
        appAlert(t('chatEditFailed'));
      } finally {
        setSending(false);
      }
      return;
    }
    if ((!trimmed && !pendingImage) || sending) return;
    setSending(true);
    try {
      await onSend(trimmed, pendingImage ? { base64: pendingImage.base64, contentType: pendingImage.contentType } : undefined);
      setDraft('');
      setPendingImage(null);
    } catch {
      // leave the draft/pending image intact so the sender can retry
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerClassName="px-5 py-4 gap-3"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
      >
        {messages.length === 0 && !loading ? (
          <VStack className="items-center py-16 gap-3">
            <Icon name="chatbubbles-outline" size="xl" color="muted" />
            <Text className="text-slate-500 dark:text-slate-400 text-center">{emptyText}</Text>
          </VStack>
        ) : (
          messages.map((m) => {
            const isMine = m.senderId === myUserId;
            return (
              // Yours on the right, everyone else's on the left — like any
              // chat app. Your own name isn't repeated over your messages.
              <VStack key={m.id} className={`gap-0.5 ${isMine ? 'items-end' : 'items-start'}`}>
                <HStack className="items-baseline gap-2" style={{ maxWidth: '85%' }}>
                  {!isMine && (
                    <Text className="text-xs font-bold text-slate-500 dark:text-slate-400" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {messageAuthorName(m)}
                    </Text>
                  )}
                  <Text className="text-xs text-slate-400 dark:text-slate-500">
                    {m.edited && !m.deleted && !m.removed ? `${t('chatEdited')} · ` : ''}
                    {formatMessageTime(m.createdAt)}
                  </Text>
                </HStack>
                {m.removed || m.deleted ? (
                  <Pressable onLongPress={() => handleMessageLongPress(m)} delayLongPress={400} style={{ maxWidth: '85%' }}>
                    <Box className="rounded-2xl px-4 py-2.5 border border-slate-200 dark:border-slate-700">
                      <Text className="italic text-slate-500 dark:text-slate-400">
                        {m.removed ? t('chatMessageRemoved') : isMine ? t('chatYouDeleted') : t('chatMessageDeleted')}
                      </Text>
                    </Box>
                  </Pressable>
                ) : (
                  <Pressable onLongPress={() => handleMessageLongPress(m)} delayLongPress={400} style={{ maxWidth: '85%' }}>
                    <Box
                      className={`rounded-2xl overflow-hidden ${isMine ? 'rounded-br-md' : 'rounded-bl-md'} ${
                        isMine ? 'bg-blue-600' : 'bg-white dark:bg-slate-800'
                      } ${m.body ? 'px-4 py-2.5' : m.hasImage ? 'p-1' : 'px-4 py-2.5'}`}
                    >
                      {m.hasImage && (
                        <Image
                          source={{ uri: imageUrl(m.id), headers: imageHeaders }}
                          style={{ width: 220, height: 220, borderRadius: 12, marginBottom: m.body ? 6 : 0 }}
                          resizeMode="cover"
                        />
                      )}
                      {m.body ? <Text className={isMine ? 'text-white' : 'text-slate-900 dark:text-white'}>{m.body}</Text> : null}
                    </Box>
                  </Pressable>
                )}
              </VStack>
            );
          })
        )}
        {seenLabel && (
          <Text className="text-xs text-slate-400 dark:text-slate-500 self-end -mt-2">{seenLabel}</Text>
        )}
        {typingLabel && <Text className="text-xs italic text-slate-500 dark:text-slate-400">{typingLabel}</Text>}
      </ScrollView>

      {canPost ? (
        <VStack className="border-t border-slate-200 dark:border-slate-700">
          {editing && (
            <HStack className="px-5 pt-3 items-center gap-2">
              <Icon name="create-outline" size="sm" color="secondary" />
              <VStack className="flex-1">
                <Text className="text-xs font-bold text-blue-600">{t('chatEditing')}</Text>
                <Text className="text-xs text-slate-500 dark:text-slate-400" numberOfLines={1}>
                  {editing.body}
                </Text>
              </VStack>
              <Pressable className="p-2 active:opacity-60" onPress={stopEditing}>
                <Icon name="close-circle" size="md" color="muted" />
              </Pressable>
            </HStack>
          )}
          {pendingImage && (
            <HStack className="px-5 pt-3 items-center gap-2">
              <Box className="rounded-xl overflow-hidden">
                <Image source={{ uri: pendingImage.dataUrl }} style={{ width: 56, height: 56 }} resizeMode="cover" />
              </Box>
              <Pressable className="p-2 active:opacity-60" onPress={() => setPendingImage(null)}>
                <Icon name="close-circle" size="md" color="muted" />
              </Pressable>
            </HStack>
          )}
          <HStack className="px-5 py-3 gap-2 items-end">
            <Pressable
              className={`w-11 h-11 rounded-full items-center justify-center bg-slate-100 dark:bg-slate-800 ${editing ? 'opacity-40' : ''}`}
              onPress={handleAttach}
              disabled={!!editing}
            >
              <Icon name="image-outline" size="md" color="muted" />
            </Pressable>
            <Input className="flex-1" style={{ flex: 1 }}>
              <InputField
                value={draft}
                onChangeText={handleDraftChange}
                // Web: Enter sends, Shift+Enter starts a new line — like any
                // chat app on a computer. Phones keep the return key as a new
                // line and send with the button.
                onKeyPress={(e: any) => {
                  if (Platform.OS !== 'web') return;
                  const ev = e.nativeEvent;
                  if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={placeholder}
                multiline
                maxLength={MAX_BODY_LENGTH}
                style={{ height: 44 }}
              />
            </Input>
            <Pressable
              className={`w-11 h-11 rounded-full items-center justify-center ${
                draft.trim() || pendingImage ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'
              }`}
              onPress={handleSend}
              disabled={(!draft.trim() && !pendingImage) || sending}
            >
              {sending ? <ActivityIndicator size="small" color="#ffffff" /> : (
                <Icon name="send" size="md" color={draft.trim() || pendingImage ? 'onBrand' : 'muted'} />
              )}
            </Pressable>
          </HStack>
        </VStack>
      ) : (
        <Box className="px-5 py-3 border-t border-slate-200 dark:border-slate-700">
          <Text className="text-sm text-slate-500 dark:text-slate-400 text-center">{closedNotice}</Text>
        </Box>
      )}
      <ReportSheet target={reportTarget} onClose={() => setReportTarget(null)} />
    </KeyboardAvoidingView>
  );
}
