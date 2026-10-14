import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Icon } from '../../design-system/ui/Icon';
import { appAlert } from '../../design-system/feedback/appAlert';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import { useLiveEvents } from '../../core/live/live';
import { getClub, listMembers } from '../../core/clubs/api';
import {
  conversationImageUrl,
  getClubChat,
  listClubChatMessages,
  removeClubChatMessage,
  sendClubChatMessage,
  setClubChatEnabled,
} from '../../core/messages/groups';
import { ChatRoom } from '../messages/ChatRoom';

type Props = {
  clubId: string;
  onBack: () => void;
};

// A Community's chat (DP-021) on the shared chat screen: every member
// reads and posts. The owner and admins can delete anyone's message and
// turn the chat off (history stays readable). It never sends pushes.
export function ClubChatScreen({ clubId, onBack }: Props) {
  const { t } = useTranslation();
  const { profile: me } = useAuth();
  const [clubName, setClubName] = useState('');
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    getClub(clubId)
      .then((c) => setClubName(c.name))
      .catch(() => {});
    listMembers(clubId)
      .then((members) => setIsOrganizer(members.some((m) => m.userId === me?.id && (m.role === 'owner' || m.role === 'admin'))))
      .catch(() => {});
    getClubChat(clubId)
      .then((s) => setEnabled(s.enabled))
      .catch(() => {});
  }, [clubId, me?.id]);

  useLiveEvents((e) => {
    if (e.type === 'club.chat.updated' && e.data?.clubId === clubId) setEnabled(!!e.data.enabled);
  });

  function handleMenu() {
    appAlert(t('clubChatTitle'), undefined, [
      {
        text: enabled ? t('clubChatTurnOff') : t('clubChatTurnOn'),
        style: enabled ? 'destructive' : 'default',
        onPress: () =>
          setClubChatEnabled(clubId, !enabled)
            .then(() => setEnabled(!enabled))
            .catch(() => appAlert(t('reportActionFailed'))),
      },
      { text: t('clubCancel'), style: 'cancel' },
    ]);
  }

  return (
    <ChatRoom
      onBack={onBack}
      avatar={
        <View className="w-9 h-9 rounded-full items-center justify-center bg-amber-100 dark:bg-amber-900">
          <Icon name="chatbubbles" size="sm" color="brand" />
        </View>
      }
      title={t('clubChatTitle')}
      subtitle={clubName}
      onMenu={isOrganizer ? handleMenu : undefined}
      fetchMessages={() => listClubChatMessages(clubId)}
      sendMessage={(m) => sendClubChatMessage(clubId, m)}
      imageUrl={conversationImageUrl}
      isNewMessageHere={(e) => e.data?.kind === 'club' && e.data?.clubId === clubId}
      canPost={enabled}
      closedNotice={isOrganizer ? t('clubChatOffOrganizer') : t('clubChatOff')}
      emptyText={t('clubChatEmpty')}
      unavailableText={t('clubChatEmpty')}
      onModeratorRemove={isOrganizer ? (messageId) => removeClubChatMessage(clubId, messageId) : undefined}
    />
  );
}
