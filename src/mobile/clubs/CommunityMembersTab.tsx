import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { Edge } from 'react-native-safe-area-context';
import { appAlert } from '../../design-system/feedback/appAlert';
import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { VStack } from '../../design-system/layout/VStack';
import { HStack } from '../../design-system/layout/HStack';
import { AppBar } from '../../design-system/layout/AppBar';
import { Typography } from '../../design-system/ui/Typography';
import { Icon } from '../../design-system/ui/Icon';
import { IconButton } from '../../design-system/ui/IconButton';
import { Chip } from '../../design-system/ui/Chip';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { Input, InputField, InputSlot } from '../../design-system/ui/Input';
import { ListGroup, ListRow } from '../../design-system/ui/List';
import { Sheet } from '../../design-system/feedback/Sheet';
import { Loading } from '../../design-system/feedback/Loading';
import { EmptyState } from '../../design-system/feedback/EmptyState';
import { PlayerCard } from '../../design-system/domain-ui/PlayerCard';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import {
  addMemberByUsername,
  changeMemberRole,
  decideJoinRequest,
  getClub,
  listJoinRequests,
  listMembers,
  removeMember,
} from '../../core/clubs/api';
import { searchUsers, userAvatarUrl, authHeader } from '../../core/api/client';
import { timeAgo } from '../../core/notifications/text';
import type { ClubJoinRequest, ClubMember, UserSummary } from '../../core/api/types';
import { PlayerProfileSheet } from '../profiles/PlayerProfileSheet';
import { PersonAvatar } from '../messages/PersonAvatar';

type Props = {
  clubId: string;
  edges?: Edge[];
  onBack: () => void;
  /** Members or join requests changed (the tab bar's count). */
  onChanged?: () => void;
};

// A Community's Members tab (Aksi redesign › Community · Members), the same
// for every role (IA v1.1.0); organizer-only actions appear inside it.
// Owners/admins see join requests first (DP-017): "asked to join · 2 days
// ago", Approve, and Decline behind ⋯. Then "Owner & admins", then
// "Members · N"; your own row says "(you)". Tapping anyone opens their
// player profile (DP-019). A row's ⋯ holds what can be done to that
// member, as before: the owner makes someone admin or a regular member, or
// removes them (asks first); anyone but the owner can leave from their own
// row. The owner adds people from the app bar.
export function CommunityMembersTab({ clubId, edges, onBack, onChanged }: Props) {
  const { t, lang } = useTranslation();
  const { profile } = useAuth();
  const [clubName, setClubName] = useState('');
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [joinRequests, setJoinRequests] = useState<ClubJoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  // The row whose ⋯ is open: a member, or a join request.
  const [actionMember, setActionMember] = useState<ClubMember | null>(null);
  const [actionRequest, setActionRequest] = useState<ClubJoinRequest | null>(null);
  // DP-019: whose profile is open — a member, or a requester (with Approve/Decline).
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [profileRequest, setProfileRequest] = useState<ClubJoinRequest | null>(null);
  // Add member (owner): search any app user; existing members left out.
  const [showAddMember, setShowAddMember] = useState(false);
  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState<UserSummary[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [addingUserId, setAddingUserId] = useState<string | null>(null);
  // GET .../avatar is behind the same auth as every other route.
  const [imageHeaders, setImageHeaders] = useState<Record<string, string>>({});

  useEffect(() => {
    authHeader().then(setImageHeaders);
  }, []);

  const load = useCallback(async () => {
    try {
      const [list, club] = await Promise.all([listMembers(clubId), getClub(clubId)]);
      setMembers(list);
      setClubName(club.name);
    } catch {
      // keep stale list
    } finally {
      setLoading(false);
    }
    // Only owner/admins may list requests; a refusal means none to show.
    setJoinRequests(await listJoinRequests(clubId).catch(() => []));
  }, [clubId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const me = members.find((m) => m.userId === profile?.id);
  const isOwner = me?.role === 'owner';

  async function refreshAfterChange() {
    await load();
    onChanged?.();
  }

  async function handleDecide(request: ClubJoinRequest, decision: 'approve' | 'decline') {
    if (busy) return;
    setBusy(true);
    try {
      await decideJoinRequest(clubId, request.id, decision);
    } catch (err) {
      // Most likely the person cancelled meanwhile; reloading shows the truth.
      appAlert(err instanceof Error ? err.message : t('authGenericError'));
    } finally {
      setBusy(false);
      await refreshAfterChange();
    }
  }

  async function handleChangeRole(member: ClubMember, role: 'member' | 'admin') {
    setActionMember(null);
    setBusy(true);
    try {
      await changeMemberRole(clubId, member.userId, role);
      await refreshAfterChange();
    } catch (err) {
      appAlert(err instanceof Error ? err.message : t('authGenericError'));
    } finally {
      setBusy(false);
    }
  }

  function handleRemove(member: ClubMember) {
    setActionMember(null);
    const isSelf = member.userId === profile?.id;
    const name = member.displayName || member.username;
    appAlert(isSelf ? t('clubLeaveClub') : t('membersRemoveConfirmTitle', name), isSelf ? t('clubLeaveConfirmDesc') : t('membersRemoveConfirmDesc'), [
      { text: t('clubCancel'), style: 'cancel' },
      {
        text: isSelf ? t('clubLeaveClub') : t('membersRemove'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await removeMember(clubId, member.userId);
            if (isSelf) onBack();
            else await refreshAfterChange();
          } catch (err) {
            appAlert(err instanceof Error ? err.message : t('authGenericError'));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  // Debounced search-as-you-type in Add member, from 2 characters (the
  // server's own minimum).
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

  function openAddMember() {
    setUserQuery('');
    setUserResults([]);
    setShowAddMember(true);
  }

  async function handleAddUser(user: UserSummary) {
    setAddingUserId(user.id);
    try {
      await addMemberByUsername(clubId, user.username);
      setShowAddMember(false);
      await refreshAfterChange();
    } catch (err) {
      appAlert(err instanceof Error ? err.message : t('authGenericError'));
    } finally {
      setAddingUserId(null);
    }
  }

  const memberIds = new Set(members.map((m) => m.userId));
  const addableResults = userResults.filter((u) => !memberIds.has(u.id));

  const q = memberSearch.trim().toLowerCase();
  const filtered = members.filter((m) => !q || (m.displayName || m.username).toLowerCase().includes(q) || m.username.toLowerCase().includes(q));
  // Owner first, then admins, then members; you before others in a group.
  const rank = { owner: 0, admin: 1, member: 2 } as const;
  const sorted = [...filtered].sort(
    (a, b) => rank[a.role] - rank[b.role] || Number(b.userId === profile?.id) - Number(a.userId === profile?.id)
  );
  const organizers = sorted.filter((m) => m.role !== 'member');
  const regulars = sorted.filter((m) => m.role === 'member');

  // What the viewer can do to a member: the owner manages everyone but
  // themselves; anyone but the owner can leave.
  function canManage(m: ClubMember) {
    return isOwner && m.role !== 'owner';
  }
  function canLeave(m: ClubMember) {
    return m.userId === profile?.id && m.role !== 'owner';
  }

  function memberRow(m: ClubMember) {
    const name = m.displayName || m.username;
    const hasActions = canManage(m) || canLeave(m);
    return (
      <Pressable key={m.userId} onPress={() => setProfileUserId(m.userId)} accessibilityRole="button" className="active:opacity-70">
        <PlayerCard
          inList
          name={name}
          nameNote={m.userId === profile?.id ? t('membersYou') : undefined}
          subtitle={`@${m.username}`}
          avatarSource={m.hasAvatar ? { uri: userAvatarUrl(m.userId), headers: imageHeaders } : undefined}
          isOnline={m.isOnline}
          trailing={
            <HStack className="items-center" space="xs">
              {m.role !== 'member' ? (
                <Chip label={m.role === 'owner' ? t('clubRoleOwner') : t('clubRoleAdmin')} strong={m.role === 'owner'} className="self-center" />
              ) : null}
              {hasActions ? (
                <IconButton icon="ellipsis-horizontal" label={t('membersActions', name)} size="md" onPress={() => setActionMember(m)} />
              ) : null}
            </HStack>
          }
        />
      </Pressable>
    );
  }

  return (
    <ScrollPage
      gap="lg"
      edges={edges}
      keyboardShouldPersistTaps="handled"
      appBar={
        <AppBar
          context={clubName}
          largeTitle={members.length > 0 ? t('membersTitleCount', members.length) : t('clubMembersTitle')}
          onBack={onBack}
          actions={isOwner ? [{ icon: 'person-add-outline', label: t('clubAddMember'), onPress: openAddMember }] : []}
        />
      }
      refreshControl={<RefreshControl refreshing={loading && members.length > 0} onRefresh={load} />}
    >
      <Input>
        <InputSlot className="pr-0">
          <Icon name="search" size="sm" color="muted" />
        </InputSlot>
        <InputField
          autoCapitalize="none"
          placeholder={t('clubMembersSearchPlaceholder')}
          accessibilityLabel={t('clubMembersSearchPlaceholder')}
          value={memberSearch}
          onChangeText={setMemberSearch}
        />
      </Input>

      {joinRequests.length > 0 && (
        <VStack space="sm">
          <Typography variant="overline" color="brand">
            {t('clubJoinRequestsTitle', joinRequests.length)}
          </Typography>
          <ListGroup>
            {joinRequests.map((request) => {
              const name = request.displayName || request.username;
              return (
                <Pressable
                  key={request.id}
                  onPress={() => setProfileRequest(request)}
                  accessibilityRole="button"
                  accessibilityLabel={t('playerProfileOpen')}
                  className="active:opacity-70"
                >
                  <PlayerCard
                    inList
                    name={name}
                    subtitle={t('membersAskedToJoin', timeAgo(request.createdAt, t, lang))}
                    avatarSource={request.hasAvatar ? { uri: userAvatarUrl(request.userId), headers: imageHeaders } : undefined}
                    trailing={
                      <HStack className="items-center" space="xs">
                        <IconButton icon="ellipsis-horizontal" label={t('membersActions', name)} size="md" onPress={() => setActionRequest(request)} />
                        <Button size="md" isDisabled={busy} onPress={() => handleDecide(request, 'approve')}>
                          <ButtonText>{t('clubJoinRequestApprove')}</ButtonText>
                        </Button>
                      </HStack>
                    }
                  />
                </Pressable>
              );
            })}
          </ListGroup>
        </VStack>
      )}

      {loading && members.length === 0 ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <EmptyState message={t('clubMembersEmpty')} />
      ) : (
        <>
          {organizers.length > 0 && (
            <VStack space="sm">
              <Typography variant="overline" color="muted">
                {t('clubMembersSectionOrganizers')}
              </Typography>
              <ListGroup>{organizers.map(memberRow)}</ListGroup>
            </VStack>
          )}
          {regulars.length > 0 && (
            <VStack space="sm">
              <Typography variant="overline" color="muted">
                {t('membersSectionMembers', regulars.length)}
              </Typography>
              <ListGroup>{regulars.map(memberRow)}</ListGroup>
            </VStack>
          )}
        </>
      )}

      {/* A member's ⋯ */}
      <Sheet
        visible={actionMember !== null}
        onClose={() => setActionMember(null)}
        title={actionMember ? actionMember.displayName || actionMember.username : undefined}
      >
        {actionMember && (
          <ListGroup>
            <ListRow
              icon="person-outline"
              title={t('membersViewProfile')}
              chevron
              onPress={() => {
                const id = actionMember.userId;
                setActionMember(null);
                setProfileUserId(id);
              }}
            />
            {canManage(actionMember) ? (
              <ListRow
                icon={actionMember.role === 'admin' ? 'person-remove-outline' : 'shield-checkmark-outline'}
                title={actionMember.role === 'admin' ? t('membersMakeMember') : t('membersMakeAdmin')}
                onPress={() => handleChangeRole(actionMember, actionMember.role === 'admin' ? 'member' : 'admin')}
              />
            ) : null}
            {canManage(actionMember) ? (
              <ListRow icon="close-circle-outline" title={t('membersRemove')} danger onPress={() => handleRemove(actionMember)} />
            ) : null}
            {canLeave(actionMember) ? (
              <ListRow icon="exit-outline" title={t('clubLeaveClub')} danger onPress={() => handleRemove(actionMember)} />
            ) : null}
          </ListGroup>
        )}
      </Sheet>

      {/* A join request's ⋯: Decline lives here, Approve is on the row. */}
      <Sheet
        visible={actionRequest !== null}
        onClose={() => setActionRequest(null)}
        title={actionRequest ? actionRequest.displayName || actionRequest.username : undefined}
      >
        {actionRequest && (
          <ListGroup>
            <ListRow
              icon="person-outline"
              title={t('membersViewProfile')}
              chevron
              onPress={() => {
                const request = actionRequest;
                setActionRequest(null);
                setProfileRequest(request);
              }}
            />
            <ListRow
              icon="close-circle-outline"
              title={t('clubJoinRequestDecline')}
              danger
              onPress={() => {
                const request = actionRequest;
                setActionRequest(null);
                handleDecide(request, 'decline');
              }}
            />
          </ListGroup>
        )}
      </Sheet>

      {/* Add member (owner) */}
      <Sheet visible={showAddMember} onClose={() => setShowAddMember(false)} title={t('clubAddMember')}>
        <VStack space="md">
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
          {searchingUsers ? (
            <ActivityIndicator />
          ) : userQuery.trim().length < 2 ? (
            <Typography variant="body" color="muted" className="text-sm text-center">
              {t('clubAddMemberSearchHint')}
            </Typography>
          ) : addableResults.length === 0 ? (
            <Typography variant="body" color="muted" className="text-sm text-center">
              {t('clubAddMemberNoResults')}
            </Typography>
          ) : (
            <ScrollView style={{ maxHeight: 320 }}>
              <ListGroup>
                {addableResults.map((u) => (
                  <ListRow
                    key={u.id}
                    leading={<PersonAvatar userId={u.id} name={u.displayName || u.username} hasAvatar={u.hasAvatar} headers={imageHeaders} />}
                    title={u.displayName || u.username}
                    subtitle={`@${u.username}`}
                    trailing={addingUserId === u.id ? <ActivityIndicator size="small" /> : <Icon name="add" size="md" color="brand" />}
                    onPress={addingUserId ? undefined : () => handleAddUser(u)}
                  />
                ))}
              </ListGroup>
            </ScrollView>
          )}
        </VStack>
      </Sheet>

      <PlayerProfileSheet userId={profileUserId} onClose={() => setProfileUserId(null)} />
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
    </ScrollPage>
  );
}
