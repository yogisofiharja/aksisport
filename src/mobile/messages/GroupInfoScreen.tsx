import { useCallback, useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { HStack } from '../../design-system/layout/HStack';
import { VStack } from '../../design-system/layout/VStack';
import { Typography } from '../../design-system/ui/Typography';
import { Icon } from '../../design-system/ui/Icon';
import { Card } from '../../design-system/ui/Card';
import { Input, InputField } from '../../design-system/ui/Input';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { Loading } from '../../design-system/feedback/Loading';
import { appAlert } from '../../design-system/feedback/appAlert';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import { authHeader } from '../../core/api/client';
import { useLiveEvents } from '../../core/live/live';
import { getGroup, removeGroupMember, renameGroup } from '../../core/messages/groups';
import { PersonAvatar } from './PersonAvatar';
import { PlayerProfileSheet } from '../profiles/PlayerProfileSheet';
import { labelFor } from './GroupChatScreen';
import type { GroupChat } from '../../core/api/types';
import { AppBar } from '../../design-system/layout/AppBar';

type Props = {
  groupId: string;
  onBack: () => void;
  onAddPeople: (groupId: string) => void;
  // After leaving the group.
  onLeft: () => void;
};

// A group's info (DP-021): who is in it; its creator renames it and adds
// or removes people; anyone leaves.
export function GroupInfoScreen({ groupId, onBack, onAddPeople, onLeft }: Props) {
  const { t } = useTranslation();
  const { profile: me } = useAuth();
  const [group, setGroup] = useState<GroupChat | null>(null);
  const [failed, setFailed] = useState(false);
  const [title, setTitle] = useState('');
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [imageHeaders, setImageHeaders] = useState<Record<string, string>>({});

  useEffect(() => {
    authHeader().then(setImageHeaders);
  }, []);

  const load = useCallback(() => {
    getGroup(groupId)
      .then((g) => {
        setGroup(g);
        setTitle(g.title);
      })
      .catch(() => setFailed(true));
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useLiveEvents((e) => {
    if (e.type === 'group.updated' && e.data?.conversationId === groupId) load();
  });

  const isCreator = !!group && group.createdBy === me?.id;

  // The name is optional; saving it empty goes back to members' names.
  function handleRename() {
    const trimmed = title.trim();
    if (!group || trimmed === group.title) return;
    renameGroup(groupId, trimmed)
      .then(load)
      .catch(() => appAlert(t('groupSaveFailed')));
  }

  function handleRemove(userId: string, name: string) {
    appAlert(t('groupRemoveConfirm', name), undefined, [
      { text: t('clubCancel'), style: 'cancel' },
      {
        text: t('groupRemove'),
        style: 'destructive',
        onPress: () =>
          removeGroupMember(groupId, userId)
            .then(load)
            .catch(() => appAlert(t('groupSaveFailed'))),
      },
    ]);
  }

  function handleLeave() {
    if (!me) return;
    appAlert(t('groupLeaveConfirm'), undefined, [
      { text: t('clubCancel'), style: 'cancel' },
      {
        text: t('groupLeave'),
        style: 'destructive',
        onPress: () =>
          removeGroupMember(groupId, me.id)
            .then(onLeft)
            .catch(() => appAlert(t('groupSaveFailed'))),
      },
    ]);
  }

  return (
    <ScrollPage gap="lg" appBar={<AppBar title={t('groupInfoTitle')} onBack={onBack} />}>

      {failed ? (
        <Typography variant="body" color="muted">
          {t('groupUnavailable')}
        </Typography>
      ) : !group ? (
        <Loading />
      ) : (
        <>
          {isCreator ? (
            <VStack space="sm">
              <Typography variant="overline" color="muted">
                {t('groupName')}
              </Typography>
              <HStack space="sm" className="items-center">
                <Input className="flex-1" style={{ flex: 1 }}>
                  <InputField
                    value={title}
                    onChangeText={setTitle}
                    maxLength={60}
                    placeholder={t('groupNamePlaceholder')}
                    onSubmitEditing={handleRename}
                  />
                </Input>
                <Button onPress={handleRename} disabled={title.trim() === group.title}>
                  <ButtonText>{t('groupSaveName')}</ButtonText>
                </Button>
              </HStack>
            </VStack>
          ) : (
            <Typography variant="heading">{labelFor(group, me?.id)}</Typography>
          )}

          <VStack space="sm">
            <HStack className="justify-between items-center">
              <Typography variant="overline" color="muted">
                {t('groupMemberCount', group.members.length)}
              </Typography>
              {isCreator && group.members.length < 50 && (
                <Pressable onPress={() => onAddPeople(groupId)} className="flex-row items-center gap-1 active:opacity-60">
                  <Icon name="person-add-outline" size="sm" color="secondary" />
                  <Typography variant="body" color="secondary" className="font-bold">
                    {t('groupAddPeople')}
                  </Typography>
                </Pressable>
              )}
            </HStack>
            {group.members.map((m) => {
              const name = m.displayName || m.username;
              const isMe = m.userId === me?.id;
              return (
                <Card key={m.userId} pressable={!isMe} onPress={() => !isMe && setProfileUserId(m.userId)}>
                  <HStack className="items-center" space="md">
                    <PersonAvatar userId={m.userId} name={name} hasAvatar={m.hasAvatar} headers={imageHeaders} />
                    <VStack style={{ flex: 1 }}>
                      <Typography variant="body" className="font-bold" numberOfLines={1}>
                        {isMe ? `${name} (${t('sessionYou')})` : name}
                      </Typography>
                      <Typography variant="body" color="muted" className="text-sm">
                        {m.userId === group.createdBy ? t('groupCreator') : `@${m.username}`}
                      </Typography>
                    </VStack>
                    {isCreator && !isMe && (
                      <Pressable onPress={() => handleRemove(m.userId, name)} hitSlop={8} className="p-1 active:opacity-60">
                        <Icon name="close-circle-outline" size="md" color="muted" />
                      </Pressable>
                    )}
                  </HStack>
                </Card>
              );
            })}
          </VStack>

          <Pressable className="items-center py-3 active:opacity-60" onPress={handleLeave}>
            <Typography variant="body" color="destructive" className="font-bold">
              {t('groupLeave')}
            </Typography>
          </Pressable>
        </>
      )}
      <PlayerProfileSheet userId={profileUserId} onClose={() => setProfileUserId(null)} />
    </ScrollPage>
  );
}
