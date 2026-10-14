import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HStack } from '../../design-system/layout/HStack';
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

type Props = {
  // Set: add people to this group. Unset: start a new group.
  groupId?: string;
  onBack: () => void;
  // After creating a group, or adding people.
  onDone: (groupId: string) => void;
};

const MAX_MEMBERS = 50;

// Start a group chat, or add people to one (DP-021): name it (new groups
// only) and pick people you can message — anyone sharing a Community
// with you, or you already have a direct conversation with.
export function GroupPeopleScreen({ groupId, onBack, onDone }: Props) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
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
    if (saving || selectedCount === 0 || (!groupId && !title.trim())) return;
    setSaving(true);
    try {
      const ids = Object.keys(selected);
      const group = groupId ? await addGroupMembers(groupId, ids) : await createGroup(title.trim(), ids);
      onDone(group.id);
    } catch {
      appAlert(t('groupSaveFailed'));
    } finally {
      setSaving(false);
    }
  }

  const canSave = selectedCount > 0 && (groupId || title.trim().length > 0);

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
      <HStack className="items-center px-4 pt-3 pb-3 border-b border-slate-200 dark:border-slate-800" space="sm">
        <Pressable className="p-2 -ml-2 active:opacity-60" onPress={onBack}>
          <Icon name="arrow-back" size="lg" />
        </Pressable>
        <Typography variant="title" style={{ flex: 1 }}>
          {groupId ? t('groupAddPeople') : t('groupNew')}
        </Typography>
      </HStack>

      <VStack space="md" className="px-5 pt-4">
        {!groupId && (
          <Input>
            <InputField value={title} onChangeText={setTitle} placeholder={t('groupNamePlaceholder')} maxLength={60} />
          </Input>
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
                className={`flex-row items-center gap-3 rounded-2xl p-3 bg-white dark:bg-slate-800 active:opacity-70 ${already ? 'opacity-50' : ''}`}
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
                    isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-slate-600'
                  }`}
                >
                  {isSelected && <Icon name="checkmark" size="xs" color="onBrand" />}
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <View className="px-5 py-3 border-t border-slate-200 dark:border-slate-800">
        <Button action="secondary" size="xl" className="w-full" onPress={handleSave} disabled={!canSave || saving}>
          {saving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <ButtonText className="text-lg">{groupId ? t('groupAdd') : t('groupCreate')}</ButtonText>
          )}
        </Button>
      </View>
    </SafeAreaView>
  );
}
