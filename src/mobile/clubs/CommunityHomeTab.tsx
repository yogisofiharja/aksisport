import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { Edge } from 'react-native-safe-area-context';
import { appAlert } from '../../design-system/feedback/appAlert';
import { Page } from '../../design-system/layout/Page';
import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { VStack } from '../../design-system/layout/VStack';
import { AppBar } from '../../design-system/layout/AppBar';
import { Typography } from '../../design-system/ui/Typography';
import { ListGroup, ListRow } from '../../design-system/ui/List';
import { Loading } from '../../design-system/feedback/Loading';
import { EmptyState } from '../../design-system/feedback/EmptyState';
import { Alert } from '../../design-system/feedback/Alert';
import { Sheet } from '../../design-system/feedback/Sheet';
import { SessionCard } from '../../design-system/domain-ui/SessionCard';
import { CommunityHeader } from '../../design-system/domain-ui/CommunityHeader';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import { authHeader, userAvatarUrl } from '../../core/api/client';
import { getClub, listJoinRequests, listMembers, clubAvatarUrl, removeMember, uploadClubAvatar } from '../../core/clubs/api';
import { countClubReports } from '../../core/safety/api';
import { clubLink, shareLink } from '../../platform/shareLink';
import { listSessions } from '../../core/sessions/api';
import { currentFocusBuckets } from '../../core/sessions/currentFocus';
import { shortCityName } from '../../core/locations/cityName';
import { pickImageAsDataUrl, parseDataUrl } from '../../imagePicker';
import { sessionCardProps, sessionRowProps } from '../sessions/sessionDisplay';
import type { Club, ClubMember, Session } from '../../core/api/types';
import { View } from 'react-native';

type Props = {
  clubId: string;
  edges?: Edge[];
  onBack: () => void;
  onOpenMembers: () => void;
  onOpenSession: (sessionId: string) => void;
  onOpenClubSettings: () => void;
  onOpenReports: () => void;
  // After the caller has left this Community.
  onLeft: () => void;
};

// A Community's Home tab (Aksi redesign › Community · Home): the dark
// header (picture, name, "<city> · Public", members), callouts for an
// owner/admin (join requests, reports), then Current Focus — the live
// Session as its card, everything else (today, the next one, drafts) as
// compact rows, ranked by currentFocusBuckets. Share is in the app bar;
// Settings, Reports and Leave are behind its ⋯.
export function CommunityHomeTab({
  clubId,
  edges,
  onBack,
  onOpenMembers,
  onOpenSession,
  onOpenClubSettings,
  onOpenReports,
  onLeft,
}: Props) {
  const { t, lang } = useTranslation();
  const { profile } = useAuth();
  const [club, setClub] = useState<Club | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isOwnerOrAdmin, setIsOwnerOrAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  // DP-017: how many people are waiting to be let into a private
  // Community — only meaningful (and only fetchable) for owner/admins.
  const [pendingRequests, setPendingRequests] = useState(0);
  // DP-021: reports waiting for this Community's owner/admins.
  const [openReports, setOpenReports] = useState(0);
  // GET .../avatar is behind the same auth as every other route — fetched
  // once per mount, same convention as ClubMembersScreen/SessionChat's own
  // image headers.
  const [imageHeaders, setImageHeaders] = useState<Record<string, string>>({});

  useEffect(() => {
    authHeader().then(setImageHeaders);
  }, []);

  const load = useCallback(async () => {
    try {
      const [clubResult, memberList, sessionsResult] = await Promise.all([
        getClub(clubId),
        listMembers(clubId),
        listSessions(clubId),
      ]);
      setClub(clubResult);
      setSessions(sessionsResult);
      setMembers(memberList);
      setIsOwner(memberList.some((m) => m.userId === profile?.id && m.role === 'owner'));
      // Recurring Schedules is an organizer-only management surface
      // (DP-007) — owner or admin, same as who can create Sessions.
      const organizer = memberList.some((m) => m.userId === profile?.id && (m.role === 'owner' || m.role === 'admin'));
      setIsOwnerOrAdmin(organizer);
      setPendingRequests(organizer ? (await listJoinRequests(clubId).catch(() => [])).length : 0);
      setOpenReports(organizer ? (await countClubReports(clubId).catch(() => ({ count: 0 }))).count : 0);
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

  // Owner only — enforced server-side too (clubs_handler.go), this is just
  // what keeps the tap target from ever appearing for anyone else.
  function handleChangeAvatar() {
    appAlert(t('sessionChatAttachImageTitle'), undefined, [
      { text: t('sessionChatAttachCamera'), onPress: () => pickAndUploadAvatar('camera') },
      { text: t('sessionChatAttachGallery'), onPress: () => pickAndUploadAvatar('gallery') },
      { text: t('clubCancel'), style: 'cancel' },
    ]);
  }

  async function pickAndUploadAvatar(source: 'camera' | 'gallery') {
    const dataUrl = await pickImageAsDataUrl(source);
    if (!dataUrl) return;
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) return;
    setUploadingAvatar(true);
    try {
      const updated = await uploadClubAvatar(clubId, parsed);
      setClub(updated);
    } catch {
      // stays on the previous picture; user can retry
    } finally {
      setUploadingAvatar(false);
    }
  }

  // Any member can share the Community's link (DP-017).
  async function handleShare() {
    if (!club) return;
    const outcome = await shareLink(clubLink(clubId), club.name);
    if (outcome === 'copied') appAlert(t('clubLinkCopiedTitle'), t('clubLinkCopiedDesc'));
    else if (outcome === 'failed') appAlert(t('clubLinkShareFailed'), clubLink(clubId), [{ text: t('ok') }]);
  }

  // Any member but the owner can leave, from here — the Community's own
  // home — rather than only by finding themselves in the Members grid.
  // The owner can't leave their own Community (they would have to delete
  // it, in Club Settings).
  function handleLeave() {
    if (!club || !profile) return;
    appAlert(t('clubLeaveConfirmTitle', club.name), t('clubLeaveConfirmDesc'), [
      { text: t('clubCancel'), style: 'cancel' },
      {
        text: t('clubLeaveClub'),
        style: 'destructive',
        onPress: async () => {
          try {
            await removeMember(clubId, profile.id);
            onLeft();
          } catch (err) {
            appAlert(t('clubLeaveClub'), err instanceof Error ? err.message : t('authGenericError'), [{ text: t('ok') }]);
          }
        },
      },
    ]);
  }

  if (loading || !club) {
    return (
      <Page edges={edges} appBar={<AppBar onBack={onBack} />}>
        <Loading fullScreen />
      </Page>
    );
  }

  const buckets = currentFocusBuckets(sessions);
  const rows = [...buckets.today, ...buckets.next, ...buckets.drafts];
  // Owners first, then admins, then whoever joined first.
  const roleRank = { owner: 0, admin: 1, member: 2 } as const;
  const people = [...members]
    .sort((a, b) => roleRank[a.role] - roleRank[b.role] || a.joinedAt.localeCompare(b.joinedAt))
    .slice(0, 3)
    .map((m) => ({
      name: m.displayName || m.username,
      source: m.hasAvatar ? { uri: userAvatarUrl(m.userId), headers: imageHeaders } : undefined,
    }));
  const subline = [club.cityName ? shortCityName(club.cityName) : null, t(club.visibility === 'private' ? 'clubPrivateBadge' : 'clubPublicBadge')]
    .filter(Boolean)
    .join(' · ');

  return (
    <ScrollPage
      edges={edges}
      gap="md"
      contentContainerStyle={{ paddingTop: 0 }}
      appBar={
        <AppBar
          tone="dark"
          onBack={onBack}
          actions={[{ icon: 'share-outline', label: t('clubShareLink'), onPress: handleShare }]}
          onMore={() => setMenuOpen(true)}
        />
      }
    >
      {/* The header runs edge to edge; the page gutter is undone here. */}
      <View style={{ marginHorizontal: -20 }}>
        <CommunityHeader
          name={club.name}
          subline={subline}
          description={club.description}
          logoSource={club.hasAvatar ? { uri: clubAvatarUrl(clubId), headers: imageHeaders } : undefined}
          onPressLogo={isOwner && !uploadingAvatar ? handleChangeAvatar : undefined}
          logoLabel={t('communityChangePicture')}
          people={people}
          membersLabel={t('clubMemberCount', members.length)}
          onPressMembers={onOpenMembers}
        />
      </View>

      {pendingRequests > 0 && (
        <Alert
          tone="heat"
          icon="person-add-outline"
          title={t('communityJoinRequests', pendingRequests)}
          titleSuffix={t('communityReview')}
          onPress={onOpenMembers}
        />
      )}

      {openReports > 0 && <Alert tone="danger" icon="flag-outline" title={t('clubReportsCallout', openReports)} onPress={onOpenReports} />}

      <VStack space="sm" className="mt-1">
        <Typography variant="overline" color="muted">
          {t('clubCurrentFocusTitle')}
        </Typography>
        {buckets.live.length + rows.length === 0 ? (
          <EmptyState message={isOwnerOrAdmin ? t('clubCurrentFocusEmptyOrganizer') : t('clubCurrentFocusEmpty')} />
        ) : (
          <VStack space="sm">
            {buckets.live.map((session) => (
              <SessionCard key={session.id} {...sessionCardProps(session, t, lang)} onPress={() => onOpenSession(session.id)} />
            ))}
            {rows.length > 0 && (
              <ListGroup>
                {rows.map((session) => (
                  <SessionCard key={session.id} {...sessionRowProps(session, t, lang, null)} onPress={() => onOpenSession(session.id)} />
                ))}
              </ListGroup>
            )}
          </VStack>
        )}
      </VStack>

      {/* ⋯: what isn't a tab. Settings for the owner, Reports for
          owners/admins, Leave for everyone but the owner. */}
      <Sheet visible={menuOpen} onClose={() => setMenuOpen(false)} title={club.name}>
        <ListGroup>
          {isOwner ? (
            <ListRow
              icon="settings-outline"
              title={t('clubSettingsTitle')}
              chevron
              onPress={() => {
                setMenuOpen(false);
                onOpenClubSettings();
              }}
            />
          ) : null}
          {isOwnerOrAdmin ? (
            <ListRow
              icon="flag-outline"
              title={t('clubReportsTitle')}
              subtitle={openReports > 0 ? t('clubReportsCallout', openReports) : undefined}
              chevron
              onPress={() => {
                setMenuOpen(false);
                onOpenReports();
              }}
            />
          ) : null}
          {!isOwner ? (
            <ListRow
              icon="exit-outline"
              title={t('clubLeaveClub')}
              danger
              onPress={() => {
                setMenuOpen(false);
                handleLeave();
              }}
            />
          ) : null}
        </ListGroup>
      </Sheet>
    </ScrollPage>
  );
}
