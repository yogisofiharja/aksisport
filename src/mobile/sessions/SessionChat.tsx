import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, RefreshControl, ScrollView } from 'react-native';
import { Icon } from '../../design-system/ui/Icon';
import { Box, HStack, VStack } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import { Input, InputField } from '../../../components/ui/input';
import { Pressable } from '../../../components/ui/pressable';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import { authHeader } from '../../core/api/client';
import { listSessionMessages, sendSessionMessage, sessionMessageImageUrl } from '../../core/sessions/api';
import { isWithinChatWindow } from '../../core/sessions/sessionSchedule';
import { pickImageAsDataUrl } from '../../imagePicker';
import type { Session, SessionMessage } from '../../core/api/types';

type Props = {
  sessionId: string;
  session: Session;
};

// DP-011 Session Chat. This app has no live push/sync anywhere yet (every
// other screen just refetches on focus/pull-to-refresh) — a short poll
// while this tab is mounted is the pragmatic MVP stand-in for near-real-
// time delivery, not a step toward websockets.
const POLL_INTERVAL_MS = 5000;
const MAX_BODY_LENGTH = 2000;

type PendingImage = { base64: string; contentType: string; dataUrl: string };

function messageAuthorName(m: SessionMessage) {
  return m.displayName || m.username;
}

function formatMessageTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// pickImageAsDataUrl always returns "data:<contentType>;base64,<payload>" —
// split back into the two pieces the API actually wants (it stores/serves
// the content type separately, never re-derives it from the payload).
function parseDataUrl(dataUrl: string): { base64: string; contentType: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { contentType: match[1], base64: match[2] };
}

export function SessionChat({ sessionId, session }: Props) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [sending, setSending] = useState(false);
  const [imageHeaders, setImageHeaders] = useState<Record<string, string>>({});
  const scrollRef = useRef<ScrollView>(null);
  // DP-011: posting closes 1 week after the Session ends; history stays
  // readable forever. The server (sessionChatWindowOpen) is the actual
  // enforcement — this only drives the compose bar's own UI.
  const canPost = isWithinChatWindow(session);

  // GET .../messages/:id/image is behind the same auth as every other
  // route — React Native's Image supports request headers on a network
  // source, same bearer token apiFetch already uses. Fetched once per
  // mount; a chat left open past the token's ~1hr lifetime may see
  // images stop loading, an accepted MVP gap.
  useEffect(() => {
    authHeader().then(setImageHeaders);
  }, []);

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

  // Best-effort "jump to latest" — not chat-app-grade (no distinction
  // between "user is reading history" and "new message arrived while
  // scrolled up"), acceptable for this scale.
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: false });
  }, [messages.length]);

  async function handlePickImage(source: 'camera' | 'gallery') {
    const dataUrl = await pickImageAsDataUrl(source);
    if (!dataUrl) return;
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) return;
    setPendingImage({ ...parsed, dataUrl });
  }

  function handleAttach() {
    Alert.alert(t('sessionChatAttachImageTitle'), undefined, [
      { text: t('sessionChatAttachCamera'), onPress: () => handlePickImage('camera') },
      { text: t('sessionChatAttachGallery'), onPress: () => handlePickImage('gallery') },
      { text: t('clubCancel'), style: 'cancel' },
    ]);
  }

  async function handleSend() {
    const trimmed = draft.trim();
    if ((!trimmed && !pendingImage) || sending) return;
    setSending(true);
    try {
      const message = await sendSessionMessage(sessionId, {
        body: trimmed || undefined,
        image: pendingImage ? { base64: pendingImage.base64, contentType: pendingImage.contentType } : undefined,
      });
      setMessages((prev) => [...prev, message]);
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
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        {messages.length === 0 && !loading ? (
          <VStack className="items-center py-16 gap-3">
            <Icon name="chatbubbles-outline" size="xl" color="muted" />
            <Text className="text-slate-500 dark:text-slate-400 text-center">{t('sessionChatEmpty')}</Text>
          </VStack>
        ) : (
          messages.map((m) => {
            const isMine = m.userId === profile?.id;
            return (
              <VStack key={m.id} className="gap-0.5">
                <HStack className="justify-between items-baseline gap-2">
                  <Text className="text-xs font-bold text-slate-500 dark:text-slate-400" numberOfLines={1}>
                    {isMine ? t('sessionYou') : messageAuthorName(m)}
                  </Text>
                  <Text className="text-xs text-slate-400 dark:text-slate-500">{formatMessageTime(m.createdAt)}</Text>
                </HStack>
                <Box
                  className={`rounded-2xl overflow-hidden self-start ${
                    isMine ? 'bg-blue-600' : 'bg-white dark:bg-slate-800'
                  } ${m.body ? 'px-4 py-2.5' : m.hasImage ? 'p-1' : 'px-4 py-2.5'}`}
                  style={{ maxWidth: '85%' }}
                >
                  {m.hasImage && (
                    <Image
                      source={{ uri: sessionMessageImageUrl(sessionId, m.id), headers: imageHeaders }}
                      style={{ width: 220, height: 220, borderRadius: 12, marginBottom: m.body ? 6 : 0 }}
                      resizeMode="cover"
                    />
                  )}
                  {m.body ? <Text className={isMine ? 'text-white' : 'text-slate-900 dark:text-white'}>{m.body}</Text> : null}
                </Box>
              </VStack>
            );
          })
        )}
      </ScrollView>

      {canPost ? (
        <VStack className="border-t border-slate-200 dark:border-slate-700">
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
            <Pressable className="w-11 h-11 rounded-full items-center justify-center bg-slate-100 dark:bg-slate-800" onPress={handleAttach}>
              <Icon name="image-outline" size="md" color="muted" />
            </Pressable>
            <Input className="flex-1" style={{ flex: 1 }}>
              <InputField
                value={draft}
                onChangeText={setDraft}
                placeholder={t('sessionChatPlaceholder')}
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
          <Text className="text-sm text-slate-500 dark:text-slate-400 text-center">{t('sessionChatClosedNotice')}</Text>
        </Box>
      )}
    </KeyboardAvoidingView>
  );
}
