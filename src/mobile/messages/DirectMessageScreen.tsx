import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '../../i18n';
import { authHeader, getPlayerProfile } from '../../core/api/client';
import { listDirectMessages, sendDirectMessage } from '../../core/messages/api';
import { conversationImageUrl } from '../../core/messages/groups';
import { appAlert } from '../../design-system/feedback/appAlert';
import { blockUser, unblockUser } from '../../core/safety/api';
import { PlayerProfileSheet } from '../profiles/PlayerProfileSheet';
import { ReportSheet, type ReportTarget } from '../safety/ReportSheet';
import { ChatRoom } from './ChatRoom';
import { PersonAvatar } from './PersonAvatar';
import type { PlayerProfile } from '../../core/api/types';

type Props = {
  userId: string;
  onBack: () => void;
};

// A private chat with one player (DP-020) on the shared chat screen. The
// header opens their profile; its ⋮ menu blocks or reports (DP-021).
export function DirectMessageScreen({ userId, onBack }: Props) {
  const { t } = useTranslation();
  const [other, setOther] = useState<PlayerProfile | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [imageHeaders, setImageHeaders] = useState<Record<string, string>>({});
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  useEffect(() => {
    authHeader().then(setImageHeaders);
    getPlayerProfile(userId)
      .then(setOther)
      .catch(() => {});
  }, [userId]);

  const name = other ? other.displayName || other.username : '';
  const blocked = other?.blockedByMe ?? false;

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
    <ChatRoom
      onBack={onBack}
      avatar={
        <View className={`rounded-full ${other?.isOnline ? 'border-2 border-green-500 p-0.5' : ''}`}>
          <PersonAvatar userId={userId} name={name || '?'} hasAvatar={!!other?.hasAvatar} headers={imageHeaders} size={36} />
        </View>
      }
      title={name}
      subtitle={other ? `@${other.username}${other.isOnline ? ` · ${t('playerProfileOnline')}` : ''}` : undefined}
      onPressHeader={() => setShowProfile(true)}
      onMenu={other ? handleMenu : undefined}
      fetchMessages={() => listDirectMessages(userId)}
      sendMessage={(m) => sendDirectMessage(userId, m)}
      imageUrl={conversationImageUrl}
      // The very first message from them.
      isNewMessageHere={(e) => e.data?.kind === 'direct' && e.data?.message?.senderId === userId}
      canPost={!blocked}
      closedNotice={t('blockedNotice', name)}
      emptyText={t('directMessageEmpty', name)}
      unavailableText={t('directMessageUnavailable')}
      receipts="direct"
    >
      <PlayerProfileSheet
        userId={showProfile ? userId : null}
        onClose={() => {
          setShowProfile(false);
          // Blocking may have changed in the sheet.
          getPlayerProfile(userId).then(setOther).catch(() => {});
        }}
      />
      <ReportSheet target={reportTarget} onClose={() => setReportTarget(null)} />
    </ChatRoom>
  );
}
