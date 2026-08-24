import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Page } from '../../design-system/layout/Page';
import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { VStack } from '../../design-system/layout/VStack';
import { HStack } from '../../design-system/layout/HStack';
import { Typography } from '../../design-system/ui/Typography';
import { Icon } from '../../design-system/ui/Icon';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { Loading } from '../../design-system/feedback/Loading';
import { EmptyState } from '../../design-system/feedback/EmptyState';
import { SessionCard } from '../../design-system/domain-ui/SessionCard';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import { authHeader } from '../../core/api/client';
import { getClub, listMembers, clubAvatarUrl, uploadClubAvatar } from '../../core/clubs/api';
import { listSessions } from '../../core/sessions/api';
import { formatSessionDateTime } from '../../core/sessions/sessionSchedule';
import { currentFocusSessions } from '../../core/sessions/currentFocus';
import { initialsFromName } from '../../core/initials';
import { pickImageAsDataUrl, parseDataUrl } from '../../imagePicker';
import { statusLabel, sessionStatusColor } from '../sessions/SessionListScreen';
import type { Club, Session } from '../../core/api/types';

type Props = {
  clubId: string;
  onBack: () => void;
  onOpenMembers: (clubId: string) => void;
  onOpenSessions: (clubId: string) => void;
  onOpenSession: (sessionId: string) => void;
  onOpenRecurringSchedules: (clubId: string) => void;
  onOpenClubSettings: (clubId: string) => void;
};

export function ClubDetailScreen({
  clubId,
  onBack,
  onOpenMembers,
  onOpenSessions,
  onOpenSession,
  onOpenRecurringSchedules,
  onOpenClubSettings,
}: Props) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [club, setClub] = useState<Club | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [isOwnerOrAdmin, setIsOwnerOrAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  // GET .../avatar is behind the same auth as every other route — fetched
  // once per mount, same convention as ClubMembersScreen/SessionChat's own
  // image headers.
  const [imageHeaders, setImageHeaders] = useState<Record<string, string>>({});

  useEffect(() => {
    authHeader().then(setImageHeaders);
  }, []);

  const load = useCallback(async () => {
    try {
      const [clubResult, members, sessionsResult] = await Promise.all([
        getClub(clubId),
        listMembers(clubId),
        listSessions(clubId),
      ]);
      setClub(clubResult);
      setSessions(sessionsResult);
      setIsOwner(members.some((m) => m.userId === profile?.id && m.role === 'owner'));
      // Recurring Schedules is an organizer-only management surface
      // (DP-007) — owner or admin, same as who can create Sessions.
      setIsOwnerOrAdmin(members.some((m) => m.userId === profile?.id && (m.role === 'owner' || m.role === 'admin')));
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
    Alert.alert(t('sessionChatAttachImageTitle'), undefined, [
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

  if (loading || !club) {
    return (
      <Page>
        <Loading fullScreen />
      </Page>
    );
  }

  const focus = currentFocusSessions(sessions);

  return (
    <ScrollPage>
      <HStack className="justify-between items-center">
        <Pressable className="p-2 -ml-2 active:opacity-60 self-start" onPress={onBack}>
          <Icon name="arrow-back" size="lg" />
        </Pressable>
        {isOwner && (
          <Pressable className="p-2 -mr-2 active:opacity-60" onPress={() => onOpenClubSettings(clubId)}>
            <Icon name="settings-outline" size="lg" />
          </Pressable>
        )}
      </HStack>

      <HStack space="md" className="items-center">
        <Pressable onPress={isOwner ? handleChangeAvatar : undefined} disabled={!isOwner || uploadingAvatar} className="active:opacity-70">
          <View className="w-20 h-20 rounded-full items-center justify-center overflow-hidden bg-slate-100 dark:bg-slate-700 border-2 border-blue-500">
            {club.hasAvatar ? (
              <Image source={{ uri: clubAvatarUrl(clubId), headers: imageHeaders }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <Typography variant="body" className="text-xl font-extrabold text-slate-600 dark:text-slate-300">
                {initialsFromName(club.name)}
              </Typography>
            )}
          </View>
        </Pressable>
        <VStack space="xs" style={{ flex: 1 }}>
          <Typography variant="display">{club.name}</Typography>
          {club.description && (
            <Typography variant="body" color="muted">
              {club.description}
            </Typography>
          )}
        </VStack>
      </HStack>

      <VStack space="sm">
        <Typography variant="caption" color="muted">
          {t('clubCurrentFocusTitle')}
        </Typography>
        {focus.length === 0 ? (
          <EmptyState message={isOwnerOrAdmin ? t('clubCurrentFocusEmptyOrganizer') : t('clubCurrentFocusEmpty')} />
        ) : (
          <VStack space="md">
            {focus.map((session) => (
              <SessionCard
                key={session.id}
                title={session.name ?? club.name}
                dateTime={formatSessionDateTime(session.startsAt)}
                status={statusLabel(session.lifecycleStatus, t)}
                statusAction={sessionStatusColor(session.lifecycleStatus)}
                joinedCount={session.status === 'draft' ? undefined : session.joinedCount}
                maxParticipants={session.maxParticipants}
                onPress={() => onOpenSession(session.id)}
              />
            ))}
          </VStack>
        )}
      </VStack>

      <Button action="secondary" size="xl" className="w-full" onPress={() => onOpenSessions(clubId)}>
        <ButtonText className="text-lg">{t('sessionListTitle')}</ButtonText>
      </Button>

      <Button action="secondary" variant="outline" size="xl" className="w-full" onPress={() => onOpenMembers(clubId)}>
        <ButtonText action="secondary" variant="outline" className="text-lg">
          {t('clubMembersTitle')}
        </ButtonText>
      </Button>

      {isOwnerOrAdmin && (
        <Button action="secondary" variant="outline" size="xl" className="w-full" onPress={() => onOpenRecurringSchedules(clubId)}>
          <ButtonText action="secondary" variant="outline" className="text-lg">
            {t('recurringScheduleListTitle')}
          </ButtonText>
        </Button>
      )}

    </ScrollPage>
  );
}
