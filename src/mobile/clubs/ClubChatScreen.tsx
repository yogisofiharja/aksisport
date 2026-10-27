import { useEffect, useState } from 'react';
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
import type { Edge } from 'react-native-safe-area-context';
import type { ClubMember } from '../../core/api/types';

type Props = {
  clubId: string;
  edges?: Edge[];
  onBack: () => void;
};

// A Community's Chat tab (DP-021) on the shared chat screen: every member
// reads and posts. The bar reads "Community chat · <name> · N members";
// an owner's or admin's messages carry their role after the name. The owner and admins can delete anyone's message and
// turn the chat off (history stays readable). It never sends pushes.
export function ClubChatScreen({ clubId, edges, onBack }: Props) {
  const { t } = useTranslation();
  const { profile: me } = useAuth();
  const [clubName, setClubName] = useState('');
  const [members, setMembers] = useState<ClubMember[]>([]);
  const isOrganizer = members.some((m) => m.userId === me?.id && (m.role === 'owner' || m.role === 'admin'));
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    getClub(clubId)
      .then((c) => setClubName(c.name))
      .catch(() => {});
    listMembers(clubId)
      .then(setMembers)
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
      edges={edges}
      onBack={onBack}
      title={t('clubChatTitle')}
      subtitle={clubName ? t('clubChatContext', clubName, members.length) : undefined}
      senderRole={(senderId) => {
        const role = members.find((m) => m.userId === senderId)?.role;
        return role === 'owner' ? t('clubRoleOwner') : role === 'admin' ? t('clubRoleAdmin') : undefined;
      }}
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
