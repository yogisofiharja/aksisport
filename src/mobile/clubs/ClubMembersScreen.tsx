import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, ScrollView } from 'react-native';
import { appAlert } from '../../design-system/feedback/appAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Icon } from '../../design-system/ui/Icon';
import { Chip } from '../../design-system/ui/Chip';
import { PlayerCard } from '../../design-system/domain-ui/PlayerCard';
import { Button, ButtonText } from '../../../components/ui/button';
import { Box, HStack, VStack } from '../../../components/ui/box';
import { Heading, Text } from '../../../components/ui/text';
import { Input, InputField } from '../../../components/ui/input';
import { Pressable } from '../../../components/ui/pressable';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import {
  addMemberByUsername,
  changeMemberRole,
  decideJoinRequest,
  listJoinRequests,
  listMembers,
  removeMember,
} from '../../core/clubs/api';
import { searchUsers, userAvatarUrl, authHeader } from '../../core/api/client';
import { initialsFromName } from '../../core/initials';
import type { ClubJoinRequest, ClubMember, UserSummary } from '../../core/api/types';
import { ApiRequestError } from '../../core/api/client';
import { PlayerProfileSheet } from '../profiles/PlayerProfileSheet';
import { CloseOnBack } from '../../design-system/feedback/useBackToClose';

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
  // GET .../avatar is behind the same auth as every other route — fetched
  // once per mount, same convention as Session Chat/Payment's image headers.
  const [imageHeaders, setImageHeaders] = useState<Record<string, string>>({});

  useEffect(() => {
    authHeader().then(setImageHeaders);
  }, []);

  // DP-017: pending requests to join (private Communities). Only owner/
  // admins may list them, so the fetch is attempted for everyone and a
  // refusal just means "none to show".
  const [joinRequests, setJoinRequests] = useState<ClubJoinRequest[]>([]);
  const [decidingRequestId, setDecidingRequestId] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  // DP-019: the requester whose profile is open.
  const [profileRequest, setProfileRequest] = useState<ClubJoinRequest | null>(null);

  const load = useCallback(async () => {
    try {
      setMembers(await listMembers(clubId));
    } catch {
      // keep stale list
    } finally {
      setLoading(false);
    }
    try {
      setJoinRequests(await listJoinRequests(clubId));
    } catch {
      setJoinRequests([]);
    }
  }, [clubId]);

  async function handleDecide(request: ClubJoinRequest, decision: 'approve' | 'decline') {
    if (decidingRequestId) return;
    setDecidingRequestId(request.id);
    setRequestError(null);
    try {
      await decideJoinRequest(clubId, request.id, decision);
    } catch (err) {
      // Most likely the person cancelled meanwhile; reloading shows the truth.
      setRequestError(err instanceof Error ? err.message : t('authGenericError'));
    } finally {
      setDecidingRequestId(null);
      await load();
    }
  }

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
    appAlert(
      isSelf ? t('clubLeaveClub') : t('clubRemove'),
      isSelf ? t('clubLeaveConfirmDesc') : member.username,
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

  // One PlayerCard row per member: avatar with the online dot (DP-014),
  // name, @username, and the role as a tag (Owner in ink, Admin sunken).
  // Tapping a row opens the member's detail, where the role actions live.
  function renderMemberList(list: ClubMember[]) {
    return (
      <VStack className="gap-2">
        {list.map((member) => (
          <Pressable
            key={member.userId}
            onPress={() => openMemberDetail(member)}
            className="active:opacity-70"
            accessibilityRole="button"
          >
            <PlayerCard
              name={member.displayName || member.username}
              subtitle={`@${member.username}`}
              avatarSource={member.hasAvatar ? { uri: userAvatarUrl(member.userId), headers: imageHeaders } : undefined}
              isOnline={member.isOnline}
              trailing={
                member.role === 'member' ? undefined : (
                  <Chip label={roleLabel(member.role, t)} strong={member.role === 'owner'} />
                )
              }
            />
          </Pressable>
        ))}
      </VStack>
    );
  }

  function renderMemberSection(label: string, list: ClubMember[]) {
    if (list.length === 0) return null;
    return (
      <VStack className="gap-2">
        <Text className="text-xs font-bold text-ink-muted dark:text-ink-muted-dark tracking-widest uppercase">{label}</Text>
        {renderMemberList(list)}
      </VStack>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-ground dark:bg-ground-dark">
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

        {joinRequests.length > 0 && (
          <VStack className="gap-2">
            <Text className="text-xs font-bold text-ink-muted dark:text-ink-muted-dark tracking-widest uppercase">
              {t('clubJoinRequestsTitle', joinRequests.length)}
            </Text>
            {joinRequests.map((request) => (
              <Pressable
                key={request.id}
                onPress={() => setProfileRequest(request)}
                className="active:opacity-70"
                accessibilityLabel={t('playerProfileOpen')}
              >
                <PlayerCard
                  name={request.displayName || request.username}
                  subtitle={`@${request.username}`}
                  avatarSource={request.hasAvatar ? { uri: userAvatarUrl(request.userId), headers: imageHeaders } : undefined}
                  trailing={
                    <HStack className="gap-2 items-center">
                      <Button
                        variant="outline"
                        size="sm"
                        isDisabled={decidingRequestId !== null}
                        onPress={() => handleDecide(request, 'decline')}
                      >
                        <ButtonText variant="outline">{t('clubJoinRequestDecline')}</ButtonText>
                      </Button>
                      <Button size="sm" isDisabled={decidingRequestId !== null} onPress={() => handleDecide(request, 'approve')}>
                        <ButtonText>{t('clubJoinRequestApprove')}</ButtonText>
                      </Button>
                    </HStack>
                  }
                />
              </Pressable>
            ))}
            {requestError && <Text className="text-sm text-red-500">{requestError}</Text>}
          </VStack>
        )}

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
          <Text className="text-ink-muted dark:text-ink-muted-dark text-center py-6">{t('clubMembersEmpty')}</Text>
        ) : (
          <VStack className="gap-5">
            {renderMemberSection(t('clubMembersSectionOrganizers'), organizerMembers)}
            {renderMemberSection(t('clubMembersSectionMembers'), regularMembers)}
          </VStack>
        )}
      </ScrollView>

      {/* Member detail — promote/demote/remove/leave live here now. */}
      <Modal visible={selectedMember !== null} transparent animationType="slide" onRequestClose={closeMemberDetail}>
        <CloseOnBack onClose={closeMemberDetail} />
        <Pressable className="flex-1 justify-end bg-black/50 dark:bg-black/70" onPress={closeMemberDetail}>
          <Pressable className="bg-surface dark:bg-surface-dark rounded-t-3xl px-6 pt-6 pb-10 gap-4" onPress={() => {}}>
            <Box className="w-10 h-1 rounded-full bg-border-strong dark:bg-border-strong-dark self-center mb-1" />

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
                  <Box className={`rounded-full ${selectedMember.isOnline ? 'border-2 border-green-500 p-0.5' : ''}`}>
                    <Box
                      className={`w-16 h-16 rounded-full items-center justify-center overflow-hidden bg-surface-sunken dark:bg-surface-sunken-dark border-2 ${
                        selectedMember.role === 'owner' ? 'border-heat' : 'border-border-strong dark:border-border-strong-dark'
                      }`}
                    >
                      {selectedMember.hasAvatar ? (
                        <Image
                          source={{ uri: userAvatarUrl(selectedMember.userId), headers: imageHeaders }}
                          style={{ width: '100%', height: '100%' }}
                        />
                      ) : (
                        <Text className="text-lg font-extrabold text-ink-muted dark:text-ink-muted-dark">
                          {initialsFromName(selectedMember.displayName || selectedMember.username)}
                        </Text>
                      )}
                    </Box>
                  </Box>
                  <VStack className="items-center gap-1">
                    <Text className="text-lg font-black text-ink dark:text-ink-dark">
                      {selectedMember.displayName || selectedMember.username}
                    </Text>
                    <Text className="text-sm text-ink-muted dark:text-ink-muted-dark">{roleLabel(selectedMember.role, t)}</Text>
                    {selectedMember.isOnline && (
                      <Text className="text-xs font-bold text-success dark:text-success-dark dark:text-green-400">{t('memberOnline')}</Text>
                    )}
                  </VStack>

                  {modalError && <Text className="text-sm text-red-500">{modalError}</Text>}

                  {(canManage || canLeave) && (
                    <VStack className="gap-3 w-full">
                      {canManage && (
                        <Button
                          variant="outline"
                          size="lg"
                          className="w-full"
                          isDisabled={busyUserId === selectedMember.userId}
                          onPress={() =>
                            handleChangeRole(selectedMember, selectedMember.role === 'admin' ? 'member' : 'admin')
                          }
                        >
                          <ButtonText variant="outline">
                            {selectedMember.role === 'admin' ? t('clubDemote') : t('clubPromote')}
                          </ButtonText>
                        </Button>
                      )}
                      {(canManage || canLeave) && (
                        <Button
                          variant="outline"
                          action="negative"
                          size="lg"
                          className="w-full"
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
                    <Text className="text-ink-muted dark:text-ink-muted-dark font-bold">{t('clubCancel')}</Text>
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
        <CloseOnBack onClose={closeAddMember} />
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable className="flex-1 justify-end bg-black/50 dark:bg-black/70" onPress={closeAddMember}>
            <Pressable className="bg-surface dark:bg-surface-dark rounded-t-3xl px-6 pt-6 pb-10 gap-4" onPress={() => {}}>
              <Box className="w-10 h-1 rounded-full bg-border-strong dark:bg-border-strong-dark self-center mb-1" />
              <Text className="text-lg font-black text-ink dark:text-ink-dark text-center mb-1">
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
                <Text className="text-sm text-ink-muted dark:text-ink-muted-dark text-center py-2">{t('clubAddMemberSearchHint')}</Text>
              ) : addableResults.length === 0 ? (
                <Text className="text-sm text-ink-muted dark:text-ink-muted-dark text-center py-2">{t('clubAddMemberNoResults')}</Text>
              ) : (
                <ScrollView style={{ maxHeight: 320 }}>
                  <VStack className="gap-2">
                    {addableResults.map((u) => (
                      <Pressable
                        key={u.id}
                        onPress={() => handleAddUser(u)}
                        disabled={addingUserId === u.id}
                        className="flex-row items-center gap-3 px-4 py-3 rounded-xl bg-surface-sunken dark:bg-surface-sunken-dark active:opacity-60"
                      >
                        <Box className={`rounded-full ${u.isOnline ? 'border-2 border-green-500 p-0.5' : ''}`}>
                          <Box className="w-10 h-10 rounded-full items-center justify-center overflow-hidden bg-surface dark:bg-surface-dark border border-border-strong dark:border-border-strong-dark">
                            {u.hasAvatar ? (
                              <Image source={{ uri: userAvatarUrl(u.id), headers: imageHeaders }} style={{ width: '100%', height: '100%' }} />
                            ) : (
                              <Text className="text-xs font-extrabold text-ink-muted dark:text-ink-muted-dark">
                                {initialsFromName(u.displayName || u.username)}
                              </Text>
                            )}
                          </Box>
                        </Box>
                        <Text className="font-bold text-ink dark:text-ink-dark flex-1">
                          {u.displayName || u.username}
                        </Text>
                        {addingUserId === u.id && <ActivityIndicator size="small" />}
                      </Pressable>
                    ))}
                  </VStack>
                </ScrollView>
              )}

              <Pressable className="items-center py-1 active:opacity-60" onPress={closeAddMember}>
                <Text className="text-ink-muted dark:text-ink-muted-dark font-bold">{t('clubCancel')}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
      <PlayerProfileSheet
        userId={profileRequest?.userId ?? null}
        onClose={() => setProfileRequest(null)}
        actions={
          profileRequest
            ? [
                { label: t('clubJoinRequestDecline'), destructive: true, onPress: () => handleDecide(profileRequest, 'decline') },
                { label: t('clubJoinRequestApprove'), onPress: () => handleDecide(profileRequest, 'approve') },
              ]
            : undefined
        }
      />
    </SafeAreaView>
  );
}
