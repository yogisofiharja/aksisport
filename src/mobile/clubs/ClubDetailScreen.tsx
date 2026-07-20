import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, ButtonText } from '../../../components/ui/button';
import { Box, HStack, VStack } from '../../../components/ui/box';
import { Heading, Text } from '../../../components/ui/text';
import { Pressable } from '../../../components/ui/pressable';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import { deleteClub, getClub, listMembers, regenerateInviteCode } from '../../core/clubs/api';
import type { Club } from '../../core/api/types';

type Props = {
  clubId: string;
  onBack: () => void;
  onOpenMembers: (clubId: string) => void;
  onOpenSessions: (clubId: string) => void;
  onDeleted: () => void;
};

export function ClubDetailScreen({ clubId, onBack, onOpenMembers, onOpenSessions, onDeleted }: Props) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [club, setClub] = useState<Club | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [clubResult, members] = await Promise.all([getClub(clubId), listMembers(clubId)]);
      setClub(clubResult);
      setIsOwner(members.some((m) => m.userId === profile?.id && m.role === 'owner'));
    } catch {
      // leave stale state; user can back out and retry
    } finally {
      setLoading(false);
    }
  }, [clubId, profile?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleRegenerate() {
    if (busy) return;
    setBusy(true);
    try {
      const updated = await regenerateInviteCode(clubId);
      setClub(updated);
    } finally {
      setBusy(false);
    }
  }

  function handleDelete() {
    Alert.alert(t('clubDeleteConfirmTitle'), t('clubDeleteConfirmDesc'), [
      { text: t('clubCancel'), style: 'cancel' },
      {
        text: t('clubConfirm'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await deleteClub(clubId);
            onDeleted();
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  if (loading || !club) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900 items-center justify-center">
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
      <ScrollView contentContainerClassName="px-5 pt-4 pb-6 gap-5">
        <Pressable className="p-2 -ml-2 active:opacity-60 self-start" onPress={onBack}>
          <Ionicons name="arrow-back" size={24} />
        </Pressable>

        <VStack className="gap-1">
          <Heading size="2xl">{club.name}</Heading>
          {club.description && <Text className="text-slate-500 dark:text-slate-400">{club.description}</Text>}
        </VStack>

        <Box className="bg-white dark:bg-slate-800 rounded-2xl p-4">
          <HStack className="justify-between items-center">
            <VStack className="gap-1">
              <Text className="text-xs font-extrabold text-slate-400 tracking-widest uppercase">{t('clubInviteCodeLabel')}</Text>
              <Text className="text-2xl font-black tracking-[4px]">{club.inviteCode}</Text>
            </VStack>
            {isOwner && (
              <Pressable className="p-2 active:opacity-60" onPress={handleRegenerate} disabled={busy}>
                <Ionicons name="refresh" size={22} />
              </Pressable>
            )}
          </HStack>
        </Box>

        <Button action="secondary" size="xl" className="w-full rounded-2xl bg-blue-600" onPress={() => onOpenSessions(clubId)}>
          <ButtonText className="text-white text-lg">{t('sessionListTitle')}</ButtonText>
        </Button>

        <Button action="secondary" variant="outline" size="xl" className="w-full rounded-2xl" onPress={() => onOpenMembers(clubId)}>
          <ButtonText className="text-lg">{t('clubMembersTitle')}</ButtonText>
        </Button>

        {isOwner && (
          <Pressable className="items-center py-3" onPress={handleDelete} disabled={busy}>
            <Text className="text-red-500 font-bold">{t('clubDeleteClub')}</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
