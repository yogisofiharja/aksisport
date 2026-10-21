import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VStack } from '../../design-system/layout/VStack';
import { Typography } from '../../design-system/ui/Typography';
import { Icon } from '../../design-system/ui/Icon';
import { Input, InputField } from '../../design-system/ui/Input';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { appAlert } from '../../design-system/feedback/appAlert';
import { useTranslation } from '../../i18n';
import { authHeader } from '../../core/api/client';
import { addGroupMembers, createGroup, getGroup, listMessageableUsers } from '../../core/messages/groups';
import { PersonAvatar } from './PersonAvatar';
import type { MessageableUser } from '../../core/api/types';
import { AppBar } from '../../design-system/layout/AppBar';

type Props = {
  // Set: add people to this group. Unset: start a new chat.
  groupId?: string;
  onBack: () => void;
  // After creating a group, or adding people.
  onDone: (groupId: string) => void;
  // New chat with just one person: their direct conversation.
  onDirect?: (userId: string) => void;
};

const MAX_MEMBERS = 50;

// Start a chat, or add people to a group (DP-021): pick people you can
// message — anyone sharing a Community with you, or you already have a
// direct conversation with. One person opens your direct conversation
// with them; two or more start a group, which needs no name.
export function GroupPeopleScreen({ groupId, onBack, onDone, onDirect }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<MessageableUser[]>([]);
  const [selected, setSelected] = useState<Record<string, MessageableUser>>({});
  // Already in the group (add mode).
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageHeaders, setImageHeaders] = useState<Record<string, string>>({});

  useEffect(() => {
    authHeader().then(setImageHeaders);
    if (groupId) {
      getGroup(groupId)
        .then((g) => setExisting(new Set(g.members.map((m) => m.userId))))
        .catch(() => {});
    }
  }, [groupId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      listMessageableUsers(query.trim())
        .then((list) => !cancelled && setPeople(list))
        .catch(() => {})
        .finally(() => !cancelled && setLoading(false));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const selectedCount = Object.keys(selected).length;
  const room = MAX_MEMBERS - (groupId ? existing.size : 1);

  function toggle(person: MessageableUser) {
    setSelected((prev) => {
      if (prev[person.userId]) {
        const { [person.userId]: _, ...rest } = prev;
        return rest;
      }
      if (Object.keys(prev).length >= room) {
        appAlert(t('groupFull'));
        return prev;
      }
      return { ...prev, [person.userId]: person };
    });
  }

  async function handleSave() {
    if (saving || selectedCount === 0) return;
    const ids = Object.keys(selected);
    if (!groupId && ids.length === 1) {
      onDirect?.(ids[0]);
      return;
    }
    setSaving(true);
    try {
      const group = groupId ? await addGroupMembers(groupId, ids) : await createGroup('', ids);
      onDone(group.id);
    } catch {
      appAlert(t('groupSaveFailed'));
    } finally {
      setSaving(false);
    }
  }

  const canSave = selectedCount > 0;
  const saveLabel = groupId ? t('groupAdd') : selectedCount >= 2 ? t('groupCreate') : t('newChatStart');

  return (
    <SafeAreaView className="flex-1 bg-ground dark:bg-ground-dark">
      <AppBar variant="form" title={groupId ? t('groupAddPeople') : t('newChat')} onClose={onBack} />

      <VStack space="md" className="px-5 pt-4">
        {!groupId && (
          <Typography variant="body" color="muted" className="text-sm">
            {t('newChatHint')}
          </Typography>
        )}
        <Input>
          <InputField value={query} onChangeText={setQuery} placeholder={t('groupSearchPeople')} autoCapitalize="none" />
        </Input>
        <Typography variant="body" color="muted" className="text-sm">
          {t('groupSelectedCount', selectedCount)}
        </Typography>
      </VStack>

      <ScrollView className="flex-1" contentContainerClassName="px-5 py-3 gap-2">
        {loading && people.length === 0 ? (
          <ActivityIndicator />
        ) : people.length === 0 ? (
          <Typography variant="body" color="muted" className="text-center py-8">
            {t('groupNoPeople')}
          </Typography>
        ) : (
          people.map((p) => {
            const name = p.displayName || p.username;
            const already = existing.has(p.userId);
            const isSelected = !!selected[p.userId];
            return (
              <Pressable
                key={p.userId}
                disabled={already}
                onPress={() => toggle(p)}
                className={`flex-row items-center gap-3 rounded-2xl p-3 bg-surface dark:bg-surface-dark active:opacity-70 ${already ? 'opacity-50' : ''}`}
              >
                <PersonAvatar userId={p.userId} name={name} hasAvatar={p.hasAvatar} headers={imageHeaders} />
                <VStack style={{ flex: 1 }}>
                  <Typography variant="body" className="font-bold" numberOfLines={1}>
                    {name}
                  </Typography>
                  <Typography variant="body" color="muted" className="text-sm">
                    {already ? t('groupAlreadyIn') : `@${p.username}`}
                  </Typography>
                </VStack>
                <View
                  className={`w-6 h-6 rounded-full items-center justify-center border-2 ${
                    isSelected ? 'bg-heat border-heat' : 'border-border-strong dark:border-border-strong-dark'
                  }`}
                >
                  {isSelected && <Icon name="checkmark" size="xs" color="onBrand" />}
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <View className="px-5 py-3 border-t border-border dark:border-border-dark">
        <Button size="xl" className="w-full" onPress={handleSave} disabled={!canSave} loading={saving}>
          <ButtonText>{saveLabel}</ButtonText>
        </Button>
      </View>
    </SafeAreaView>
  );
}
