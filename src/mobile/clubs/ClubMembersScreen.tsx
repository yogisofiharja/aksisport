import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Icon } from '../../design-system/ui/Icon';
import { Button, ButtonText } from '../../../components/ui/button';
import { Box, HStack, VStack } from '../../../components/ui/box';
import { Heading, Text } from '../../../components/ui/text';
import { Input, InputField } from '../../../components/ui/input';
import { Pressable } from '../../../components/ui/pressable';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import { addMemberByUsername, changeMemberRole, listMembers, removeMember } from '../../core/clubs/api';
import { searchUsers } from '../../core/api/client';
import type { ClubMember, UserSummary } from '../../core/api/types';
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

// Same avatar-circle convention as Session's participant/organizer cards
// (initials only — no avatarUrl on ClubMember/UserSummary yet, same
// reasoning noted there).
function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const second = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + second).toUpperCase();
}

export function ClubMembersScreen({ clubId, onBack }: Props) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  // Club-member search — filters the grid below, club-scoped only (not
  // the same as the "add member" dialog's search, which looks up any
  // app user).
  const [memberSearch, setMemberSearch] = useState('');
  // Member detail — tapping a circle opens this instead of always-visible
  // inline row actions, same "tap for a detail sheet" pattern as
  // Session's participant-placeholder modal.
  const [selectedMember, setSelectedMember] = useState<ClubMember | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  // Add Member dialog — owner only, replaces the old always-visible
  // exact-username form at the bottom of the screen.
  const [showAddMember, setShowAddMember] = useState(false);
  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState<UserSummary[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [addMemberError, setAddMemberError] = useState<string | null>(null);
  const [addingUserId, setAddingUserId] = useState<string | null>(null);

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

  // Debounced search-as-you-type inside the Add Member dialog — a fresh
  // request per keystroke would be wasteful. Below 2 characters mirrors
  // the server's own minimum (it returns [] rather than erroring, but no
  // reason to even ask).
  useEffect(() => {
    const q = userQuery.trim();
    if (q.length < 2) {
      setUserResults([]);
      setSearchingUsers(false);
      return;
    }
    setSearchingUsers(true);
    const timer = setTimeout(() => {
      searchUsers(q)
        .then(setUserResults)
        .catch(() => setUserResults([]))
        .finally(() => setSearchingUsers(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [userQuery]);

  function openMemberDetail(member: ClubMember) {
    setModalError(null);
    setSelectedMember(member);
  }

  function closeMemberDetail() {
    setSelectedMember(null);
    setModalError(null);
  }

  async function handleChangeRole(member: ClubMember, role: 'member' | 'admin') {
    setBusyUserId(member.userId);
    setModalError(null);
    try {
      await changeMemberRole(clubId, member.userId, role);
      await load();
      closeMemberDetail();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : t('authGenericError'));
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
              closeMemberDetail();
              if (isSelf) onBack();
            } catch (err) {
              if (err instanceof ApiRequestError) setModalError(err.message);
            } finally {
              setBusyUserId(null);
            }
          },
        },
      ]
    );
  }

  function openAddMember() {
    setUserQuery('');
    setUserResults([]);
    setAddMemberError(null);
    setShowAddMember(true);
  }

  function closeAddMember() {
    setShowAddMember(false);
  }

  async function handleAddUser(user: UserSummary) {
    setAddingUserId(user.id);
    setAddMemberError(null);
    try {
      await addMemberByUsername(clubId, user.username);
      await load();
      closeAddMember();
    } catch (err) {
      setAddMemberError(err instanceof Error ? err.message : t('authGenericError'));
    } finally {
      setAddingUserId(null);
    }
  }

  const existingMemberIds = new Set(members.map((m) => m.userId));
  const addableResults = userResults.filter((u) => !existingMemberIds.has(u.id));

  const filteredMembers = members.filter((m) => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return true;
    return (m.displayName || m.username).toLowerCase().includes(q) || m.username.toLowerCase().includes(q);
  });
  // Owner/admin ("organizers") always list before plain members — same
  // top-to-bottom precedence the rest of the app gives elevated roles.
  const organizerMembers = filteredMembers.filter((m) => m.role === 'owner' || m.role === 'admin');
  const regularMembers = filteredMembers.filter((m) => m.role === 'member');

  // Same avatar-circle grid as Session's Participants — a fixed 4-per-row
  // grid (w-1/4 per tile, not the wrap-by-available-width tiles Session
  // uses) rather than a flat row list. Horizontal spacing comes from each
  // tile's own padding, not a columnGap on the wrapper — a columnGap
  // alongside four exact 25%-wide tiles would push the row past 100% and
  // break the "exactly 4 per row" layout.
  function renderMemberGrid(list: ClubMember[]) {
    return (
      <HStack className="flex-wrap" style={{ rowGap: 20 }}>
        {list.map((member) => (
          <Pressable
            key={member.userId}
            className="w-1/4 items-center px-1 active:opacity-70"
            onPress={() => openMemberDetail(member)}
          >
            <Box
              className={`w-16 h-16 rounded-full items-center justify-center bg-slate-100 dark:bg-slate-700 border-2 ${
                member.role === 'owner' ? 'border-blue-500' : 'border-slate-300 dark:border-slate-600'
              }`}
            >
              <Text className="text-base font-extrabold text-slate-600 dark:text-slate-300">
                {initialsFromName(member.displayName || member.username)}
              </Text>
            </Box>
            <Text className="text-xs font-bold text-slate-900 dark:text-white text-center mt-1" numberOfLines={2}>
              {member.displayName || member.username}
            </Text>
          </Pressable>
        ))}
      </HStack>
    );
  }

  function renderMemberSection(label: string, list: ClubMember[]) {
    if (list.length === 0) return null;
    return (
      <VStack className="gap-2">
        <Text className="text-xs font-bold text-slate-400 tracking-widest uppercase">{label}</Text>
        {renderMemberGrid(list)}
      </VStack>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
      <ScrollView contentContainerClassName="px-5 pt-4 pb-6 gap-5">
        <Pressable className="p-2 -ml-2 active:opacity-60 self-start" onPress={onBack}>
          <Icon name="arrow-back" size="lg" />
        </Pressable>

        <HStack className="justify-between items-center">
          <Heading size="2xl">{t('clubMembersTitle')}</Heading>
          {isOwner && (
            <Pressable onPress={openAddMember} className="p-2 active:opacity-60" hitSlop={8}>
              <Icon name="person-add-outline" size="lg" color="brand" />
            </Pressable>
          )}
        </HStack>

        <Input>
          <InputField
            autoCapitalize="none"
            placeholder={t('clubMembersSearchPlaceholder')}
            value={memberSearch}
            onChangeText={setMemberSearch}
          />
        </Input>

        {loading ? (
          <Box className="items-center py-10">
            <ActivityIndicator size="large" />
          </Box>
        ) : filteredMembers.length === 0 ? (
          <Text className="text-slate-500 dark:text-slate-400 text-center py-6">{t('clubMembersEmpty')}</Text>
        ) : (
          <VStack className="gap-5">
            {renderMemberSection(t('clubMembersSectionOrganizers'), organizerMembers)}
            {renderMemberSection(t('clubMembersSectionMembers'), regularMembers)}
          </VStack>
        )}
      </ScrollView>

      {/* Member detail — promote/demote/remove/leave live here now. */}
      <Modal visible={selectedMember !== null} transparent animationType="slide" onRequestClose={closeMemberDetail}>
        <Pressable className="flex-1 justify-end bg-black/50 dark:bg-black/70" onPress={closeMemberDetail}>
          <Pressable className="bg-white dark:bg-slate-800 rounded-t-3xl px-6 pt-6 pb-10 gap-4" onPress={() => {}}>
            <Box className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600 self-center mb-1" />

            {selectedMember && (() => {
              const isSelf = selectedMember.userId === profile?.id;
              // Same rule the old inline row actions used: only the owner
              // can promote/demote/remove someone else (not admins —
              // matches permissions.md), and the owner's own row is never
              // manageable this way. Leaving is separately available to
              // anyone viewing their own row, except the owner (who can't
              // leave their own club).
              const canManage = isOwner && selectedMember.role !== 'owner';
              const canLeave = isSelf && selectedMember.role !== 'owner';
              return (
                <VStack className="gap-4 items-center">
                  <Box
                    className={`w-16 h-16 rounded-full items-center justify-center bg-slate-100 dark:bg-slate-700 border-2 ${
                      selectedMember.role === 'owner' ? 'border-blue-500' : 'border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    <Text className="text-lg font-extrabold text-slate-600 dark:text-slate-300">
                      {initialsFromName(selectedMember.displayName || selectedMember.username)}
                    </Text>
                  </Box>
                  <VStack className="items-center gap-1">
                    <Text className="text-lg font-black text-slate-900 dark:text-white">
                      {selectedMember.displayName || selectedMember.username}
                    </Text>
                    <Text className="text-sm text-slate-400">{roleLabel(selectedMember.role, t)}</Text>
                  </VStack>

                  {modalError && <Text className="text-sm text-red-500">{modalError}</Text>}

                  {(canManage || canLeave) && (
                    <VStack className="gap-3 w-full">
                      {canManage && (
                        <Button
                          variant="outline"
                          action="secondary"
                          size="lg"
                          className="w-full rounded-2xl"
                          isDisabled={busyUserId === selectedMember.userId}
                          onPress={() =>
                            handleChangeRole(selectedMember, selectedMember.role === 'admin' ? 'member' : 'admin')
                          }
                        >
                          <ButtonText variant="outline" action="secondary">
                            {selectedMember.role === 'admin' ? t('clubDemote') : t('clubPromote')}
                          </ButtonText>
                        </Button>
                      )}
                      {(canManage || canLeave) && (
                        <Button
                          variant="outline"
                          action="negative"
                          size="lg"
                          className="w-full rounded-2xl"
                          isDisabled={busyUserId === selectedMember.userId}
                          onPress={() => handleRemove(selectedMember)}
                        >
                          <ButtonText variant="outline" action="negative">
                            {isSelf ? t('clubLeaveClub') : t('clubRemove')}
                          </ButtonText>
                        </Button>
                      )}
                    </VStack>
                  )}

                  <Pressable className="items-center py-1 active:opacity-60" onPress={closeMemberDetail}>
                    <Text className="text-slate-400 font-bold">{t('clubCancel')}</Text>
                  </Pressable>
                </VStack>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add Member — owner only, search any app user, existing members
          filtered out client-side (already have that list loaded). */}
      <Modal visible={showAddMember} transparent animationType="slide" onRequestClose={closeAddMember}>
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable className="flex-1 justify-end bg-black/50 dark:bg-black/70" onPress={closeAddMember}>
            <Pressable className="bg-white dark:bg-slate-800 rounded-t-3xl px-6 pt-6 pb-10 gap-4" onPress={() => {}}>
              <Box className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600 self-center mb-1" />
              <Text className="text-lg font-black text-slate-900 dark:text-white text-center mb-1">
                {t('clubAddMember')}
              </Text>
              <Input>
                <InputField
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder={t('clubAddMemberSearchPlaceholder')}
                  value={userQuery}
                  onChangeText={setUserQuery}
                />
              </Input>

              {addMemberError && <Text className="text-sm text-red-500">{addMemberError}</Text>}

              {searchingUsers ? (
                <Box className="items-center py-4">
                  <ActivityIndicator />
                </Box>
              ) : userQuery.trim().length < 2 ? (
                <Text className="text-sm text-slate-400 text-center py-2">{t('clubAddMemberSearchHint')}</Text>
              ) : addableResults.length === 0 ? (
                <Text className="text-sm text-slate-400 text-center py-2">{t('clubAddMemberNoResults')}</Text>
              ) : (
                <ScrollView style={{ maxHeight: 320 }}>
                  <VStack className="gap-2">
                    {addableResults.map((u) => (
                      <Pressable
                        key={u.id}
                        onPress={() => handleAddUser(u)}
                        disabled={addingUserId === u.id}
                        className="flex-row items-center gap-3 px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 active:opacity-60"
                      >
                        <Box className="w-10 h-10 rounded-full items-center justify-center bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600">
                          <Text className="text-xs font-extrabold text-slate-600 dark:text-slate-300">
                            {initialsFromName(u.displayName || u.username)}
                          </Text>
                        </Box>
                        <Text className="font-bold text-slate-900 dark:text-white flex-1">
                          {u.displayName || u.username}
                        </Text>
                        {addingUserId === u.id && <ActivityIndicator size="small" />}
                      </Pressable>
                    ))}
                  </VStack>
                </ScrollView>
              )}

              <Pressable className="items-center py-1 active:opacity-60" onPress={closeAddMember}>
                <Text className="text-slate-400 font-bold">{t('clubCancel')}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
