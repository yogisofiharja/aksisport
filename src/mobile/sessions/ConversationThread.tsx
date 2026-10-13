import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, RefreshControl, ScrollView } from 'react-native';
import { appAlert } from '../../design-system/feedback/appAlert';
import { Icon } from '../../design-system/ui/Icon';
import { Box, HStack, VStack } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import { Input, InputField } from '../../../components/ui/input';
import { Pressable } from '../../../components/ui/pressable';
import { useTranslation } from '../../i18n';
import { authHeader } from '../../core/api/client';
import { conversationMessageImageUrl } from '../../core/sessions/api';
import { pickImageAsDataUrl, parseDataUrl } from '../../imagePicker';
import type { ConversationMessage } from '../../core/api/types';

type Props = {
  sessionId: string;
  messages: ConversationMessage[];
  loading: boolean;
  onRefresh: () => void;
  myUserId: string;
  canPost: boolean;
  closedNotice: string;
  emptyText: string;
  placeholder: string;
  onSend: (body: string, image?: { base64: string; contentType: string }) => Promise<void>;
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

function formatMessageTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ConversationThread({ sessionId, messages, loading, onRefresh, myUserId, canPost, closedNotice, emptyText, placeholder, onSend }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [sending, setSending] = useState(false);
  const [imageHeaders, setImageHeaders] = useState<Record<string, string>>({});
  const scrollRef = useRef<ScrollView>(null);

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
  }, [messages.length]);

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
                      source={{ uri: conversationMessageImageUrl(sessionId, m.id), headers: imageHeaders }}
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
    </KeyboardAvoidingView>
  );
}
