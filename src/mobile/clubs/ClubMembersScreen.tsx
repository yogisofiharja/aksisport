import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, ButtonText } from '../../../components/ui/button';
import { Box, HStack, VStack } from '../../../components/ui/box';
import { Heading, Text } from '../../../components/ui/text';
import { Input, InputField } from '../../../components/ui/input';
import { Pressable } from '../../../components/ui/pressable';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import { addMemberByUsername, changeMemberRole, listMembers, removeMember } from '../../core/clubs/api';
import type { ClubMember } from '../../core/api/types';
import { ApiRequestError } from '../../core/api/client';

type Props = {
  clubId: string;
  onBack: () => void;
};

function roleLabel(role: ClubMember['role'], t: (key: string) => string) {
  if (role === 'owner') return t('clubRoleOwner');
  if (role === 'admin') return t('clubRoleAdmin');
  return t('clubRoleMember');
}

export function ClubMembersScreen({ clubId, onBack }: Props) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUsername, setNewUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setMembers(await listMembers(clubId));
    } catch {
      // keep stale list
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const isOwner = members.some((m) => m.userId === profile?.id && m.role === 'owner');

  async function handleAddMember() {
    const username = newUsername.trim().toLowerCase();
    if (!username) return;
    setError(null);
    try {
      await addMemberByUsername(clubId, username);
      setNewUsername('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('authGenericError'));
    }
  }

  async function handleChangeRole(member: ClubMember, role: 'member' | 'admin') {
    setBusyUserId(member.userId);
    try {
      await changeMemberRole(clubId, member.userId, role);
      await load();
    } finally {
      setBusyUserId(null);
    }
  }

  function handleRemove(member: ClubMember) {
    const isSelf = member.userId === profile?.id;
    Alert.alert(
      isSelf ? t('clubLeaveClub') : t('clubRemove'),
      member.username,
      [
        { text: t('clubCancel'), style: 'cancel' },
        {
          text: t('clubConfirm'),
          style: 'destructive',
          onPress: async () => {
            setBusyUserId(member.userId);
            try {
              await removeMember(clubId, member.userId);
              await load();
              if (isSelf) onBack();
            } catch (err) {
              if (err instanceof ApiRequestError) setError(err.message);
            } finally {
              setBusyUserId(null);
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
      <ScrollView contentContainerClassName="px-5 pt-4 pb-6 gap-5">
        <Pressable className="p-2 -ml-2 active:opacity-60 self-start" onPress={onBack}>
          <Ionicons name="arrow-back" size={24} />
        </Pressable>

        <Heading size="2xl">{t('clubMembersTitle')}</Heading>

        {loading ? (
          <Box className="items-center py-10">
            <ActivityIndicator size="large" />
          </Box>
        ) : (
          <VStack className="gap-2">
            {members.map((member) => (
              <Box key={member.userId} className="bg-white dark:bg-slate-800 rounded-2xl p-4">
                <HStack className="justify-between items-center">
                  <VStack className="gap-1 flex-1">
                    <Text className="font-bold text-slate-900 dark:text-white">
                      {member.displayName || member.username}
                    </Text>
                    <Text className="text-xs text-slate-400">{roleLabel(member.role, t)}</Text>
                  </VStack>
                  {isOwner && member.role !== 'owner' && (
                    <HStack className="gap-3">
                      <Pressable
                        disabled={busyUserId === member.userId}
                        onPress={() => handleChangeRole(member, member.role === 'admin' ? 'member' : 'admin')}
                      >
                        <Text className="text-blue-600 dark:text-blue-400 font-bold text-sm">
                          {member.role === 'admin' ? t('clubDemote') : t('clubPromote')}
                        </Text>
                      </Pressable>
                      <Pressable disabled={busyUserId === member.userId} onPress={() => handleRemove(member)}>
                        <Text className="text-red-500 font-bold text-sm">{t('clubRemove')}</Text>
                      </Pressable>
                    </HStack>
                  )}
                  {member.userId === profile?.id && member.role !== 'owner' && (
                    <Pressable disabled={busyUserId === member.userId} onPress={() => handleRemove(member)}>
                      <Text className="text-red-500 font-bold text-sm">{t('clubLeaveClub')}</Text>
                    </Pressable>
                  )}
                </HStack>
              </Box>
            ))}
          </VStack>
        )}

        {isOwner && (
          <VStack className="gap-2 pt-2">
            <Text className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('clubAddMember')}</Text>
            <HStack className="gap-2">
              <Input className="flex-1">
                <InputField
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder={t('clubAddMemberPlaceholder')}
                  value={newUsername}
                  onChangeText={setNewUsername}
                  onSubmitEditing={handleAddMember}
                />
              </Input>
              <Button action="secondary" className="rounded-xl bg-blue-600" onPress={handleAddMember}>
                <ButtonText className="text-white">{t('clubAdd')}</ButtonText>
              </Button>
            </HStack>
            {error && <Text className="text-sm text-red-500">{error}</Text>}
          </VStack>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
