import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Icon } from '../../design-system/ui/Icon';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import { useLiveEvents } from '../../core/live/live';
import { conversationImageUrl, getGroup, listGroupMessages, sendGroupMessage } from '../../core/messages/groups';
import { groupLabel } from '../../core/messages/groupLabel';
import { ChatRoom } from './ChatRoom';
import type { GroupChat } from '../../core/api/types';

type Props = {
  groupId: string;
  onBack: () => void;
  onOpenInfo: (groupId: string) => void;
};

// The group's name, or the other members' names.
export function labelFor(group: GroupChat, myUserId: string | undefined): string {
  const others = group.members.filter((m) => m.userId !== myUserId);
  return groupLabel(group.title, others.map((m) => m.displayName || m.username), others.length);
}

// A group chat (DP-021) on the shared chat screen; the header opens the
// group's info (people, name, add, leave).
export function GroupChatScreen({ groupId, onBack, onOpenInfo }: Props) {
  const { t } = useTranslation();
  const { profile: me } = useAuth();
  const [group, setGroup] = useState<GroupChat | null>(null);

  const loadGroup = useCallback(() => {
    getGroup(groupId)
      .then(setGroup)
      .catch(() => setGroup(null));
  }, [groupId]);

  useEffect(() => {
    loadGroup();
  }, [loadGroup]);

  // Name and members change while open.
  useLiveEvents((e) => {
    if (e.type === 'group.updated' && e.data?.conversationId === groupId) loadGroup();
  });

  return (
    <ChatRoom
      onBack={onBack}
      avatar={
        <View className="w-9 h-9 rounded-full items-center justify-center bg-heat-tint dark:bg-heat-tint-dark">
          <Icon name="people" size="sm" color="secondary" />
        </View>
      }
      title={group ? labelFor(group, me?.id) : ''}
      subtitle={group ? t('groupMemberCount', group.members.length) : undefined}
      onPressHeader={group ? () => onOpenInfo(groupId) : undefined}
      fetchMessages={() => listGroupMessages(groupId)}
      sendMessage={(m) => sendGroupMessage(groupId, m)}
      imageUrl={conversationImageUrl}
      isNewMessageHere={(e) => e.data?.conversationId === groupId}
      emptyText={t('groupEmpty')}
      unavailableText={t('groupUnavailable')}
    />
  );
}
