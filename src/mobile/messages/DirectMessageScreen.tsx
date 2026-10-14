import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HStack } from '../../design-system/layout/HStack';
import { VStack } from '../../design-system/layout/VStack';
import { Typography } from '../../design-system/ui/Typography';
import { Icon } from '../../design-system/ui/Icon';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import { authHeader, getPlayerProfile, userAvatarUrl } from '../../core/api/client';
import { directMessageImageUrl, listDirectMessages, sendDirectMessage } from '../../core/messages/api';
import { initialsFromName } from '../../core/initials';
import { ConversationThread } from '../sessions/ConversationThread';
import { usePollInterval, useLiveEvents } from '../../core/live/live';
import { PlayerProfileSheet } from '../profiles/PlayerProfileSheet';
import { appAlert } from '../../design-system/feedback/appAlert';
import { blockUser, unblockUser } from '../../core/safety/api';
import { ReportSheet, type ReportTarget } from '../safety/ReportSheet';
import type { ConversationMessage, PlayerProfile } from '../../core/api/types';

type Props = {
  userId: string;
  onBack: () => void;
};


// A direct conversation with one player (DP-020): text and images, on the
// same engine and screen parts as Session Chat. There is no posting
// window — like Contact Organizer, it never closes.
export function DirectMessageScreen({ userId, onBack }: Props) {
  const { t } = useTranslation();
  const { profile: me } = useAuth();
  const [other, setOther] = useState<PlayerProfile | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [imageHeaders, setImageHeaders] = useState<Record<string, string>>({});
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  useEffect(() => {
    authHeader().then(setImageHeaders);
    getPlayerProfile(userId)
      .then(setOther)
      .catch(() => {});
  }, [userId]);

  const load = useCallback(async () => {
    try {
      setMessages(await listDirectMessages(userId));
      setUnavailable(false);
    } catch {
      // Not allowed to message this person (no shared Community), or
      // offline: say so only if nothing has loaded.
      setUnavailable((was) => was || messages.length === 0);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // New messages arrive over the live connection (ConversationThread
  // re-fetches on each); polling is the fallback.
  const pollInterval = usePollInterval();
  useEffect(() => {
    load();
    const interval = setInterval(load, pollInterval);
    return () => clearInterval(interval);
  }, [load, pollInterval]);

  // The very first message from them: there is no conversation on screen
  // yet for ConversationThread to match, so watch for it here.
  useLiveEvents((e) => {
    if (e.type === 'message.created' && e.data?.kind === 'direct' && e.data?.message?.senderId === userId && messages.length === 0) {
      load();
    }
  });

  async function handleSend(body: string, image?: { base64: string; contentType: string }) {
    const message = await sendDirectMessage(userId, { body: body || undefined, image });
    setMessages((prev) => [...prev, message]);
  }

  const name = other ? other.displayName || other.username : '';
  const blocked = other?.blockedByMe ?? false;

  // DP-021: block / unblock and report, from the header.
  function setBlocked(value: boolean) {
    if (!other) return;
    (value ? blockUser(userId) : unblockUser(userId)).then(() => setOther({ ...other, blockedByMe: value })).catch(() => {});
  }

  function handleMenu() {
    if (!other) return;
    appAlert(name, undefined, [
      blocked
        ? { text: t('blockUnblock'), onPress: () => setBlocked(false) }
        : {
            text: t('blockPlayer'),
            style: 'destructive',
            onPress: () =>
              appAlert(t('blockConfirmTitle', name), t('blockConfirmBody'), [
                { text: t('clubCancel'), style: 'cancel' },
                { text: t('blockPlayer'), style: 'destructive', onPress: () => setBlocked(true) },
              ]),
          },
      { text: t('reportPlayer'), style: 'destructive', onPress: () => setReportTarget({ kind: 'user', userId, name }) },
      { text: t('clubCancel'), style: 'cancel' },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
      <HStack className="items-center px-4 pt-3 pb-3 border-b border-slate-200 dark:border-slate-800" space="sm">
        <Pressable className="p-2 -ml-2 active:opacity-60" onPress={onBack}>
          <Icon name="arrow-back" size="lg" />
        </Pressable>
        <Pressable className="flex-row items-center gap-3 active:opacity-70" style={{ flex: 1 }} onPress={() => setShowProfile(true)}>
          <View className={`rounded-full ${other?.isOnline ? 'border-2 border-green-500 p-0.5' : ''}`}>
            <View className="w-9 h-9 rounded-full items-center justify-center overflow-hidden bg-slate-100 dark:bg-slate-700">
              {other?.hasAvatar ? (
                <Image source={{ uri: userAvatarUrl(userId), headers: imageHeaders }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <Typography variant="body" className="text-xs font-extrabold text-slate-600 dark:text-slate-300">
                  {initialsFromName(name || '?')}
                </Typography>
              )}
            </View>
          </View>
          <VStack style={{ flex: 1 }}>
            <Typography variant="body" className="font-bold" numberOfLines={1}>
              {name}
            </Typography>
            {other && (
              <Typography variant="body" color="muted" className="text-xs">
                @{other.username}
                {other.isOnline ? ` · ${t('playerProfileOnline')}` : ''}
              </Typography>
            )}
          </VStack>
        </Pressable>
        {other && (
          <Pressable className="p-2 -mr-2 active:opacity-60" onPress={handleMenu} hitSlop={4}>
            <Icon name="ellipsis-vertical" size="lg" />
          </Pressable>
        )}
      </HStack>

      {unavailable && messages.length === 0 && !loading ? (
        <Typography variant="body" color="muted" className="px-5 pt-6">
          {t('directMessageUnavailable')}
        </Typography>
      ) : (
        <View style={{ flex: 1 }}>
          <ConversationThread
            imageUrl={directMessageImageUrl}
            messages={messages}
            loading={loading}
            onRefresh={load}
            myUserId={me?.id ?? ''}
            canPost={!blocked}
            closedNotice={t('blockedNotice', name)}
            emptyText={t('directMessageEmpty', name)}
            placeholder={t('sessionChatPlaceholder')}
            onSend={handleSend}
            receipts="direct"
          />
        </View>
      )}
      <PlayerProfileSheet
        userId={showProfile ? userId : null}
        onClose={() => {
          setShowProfile(false);
          // Blocking may have changed in the sheet.
          getPlayerProfile(userId).then(setOther).catch(() => {});
        }}
      />
      <ReportSheet target={reportTarget} onClose={() => setReportTarget(null)} />
    </SafeAreaView>
  );
}
