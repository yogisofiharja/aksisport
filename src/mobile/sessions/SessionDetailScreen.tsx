import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView } from 'react-native';
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
import { addGuestParticipant, checkIn, getSession, listParticipants, publishSession } from '../../core/sessions/api';
import { listMembers } from '../../core/clubs/api';
import { listActivities } from '../../core/activities/api';
import type { ActivityDetail, Session, SessionParticipant } from '../../core/api/types';

type Props = {
  sessionId: string;
  onBack: () => void;
  onAddMatch: (sessionId: string) => void;
  onOpenMatch: (activityId: string) => void;
};

function activityParticipantNames(activity: ActivityDetail): string {
  const names = (team: 'A' | 'B') =>
    activity.participants.filter((p) => p.team === team).map((p) => p.displayName || p.username || p.guestName).join(' / ');
  return `${names('A')} vs ${names('B')}`;
}

export function SessionDetailScreen({ sessionId, onBack, onAddMatch, onOpenMatch }: Props) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [session, setSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [activities, setActivities] = useState<ActivityDetail[]>([]);
  const [isOwnerOrAdmin, setIsOwnerOrAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [guestName, setGuestName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const sess = await getSession(sessionId);
      const [parts, members, acts] = await Promise.all([
        listParticipants(sessionId),
        listMembers(sess.clubId),
        listActivities(sessionId),
      ]);
      setSession(sess);
      setParticipants(parts);
      setActivities(acts);
      const myRole = members.find((m) => m.userId === profile?.id)?.role;
      setIsOwnerOrAdmin(myRole === 'owner' || myRole === 'admin');
    } catch {
      // leave stale state; user can back out and retry
    } finally {
      setLoading(false);
    }
  }, [sessionId, profile?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const myParticipant = participants.find((p) => p.userId === profile?.id);

  async function handleCheckIn() {
    if (busy) return;
    setBusy(true);
    try {
      await checkIn(sessionId);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function handlePublish() {
    if (busy) return;
    setBusy(true);
    try {
      await publishSession(sessionId);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function handleAddGuest() {
    const name = guestName.trim();
    if (!name || busy) return;
    setBusy(true);
    setError(null);
    try {
      await addGuestParticipant(sessionId, name);
      setGuestName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('authGenericError'));
    } finally {
      setBusy(false);
    }
  }

  if (loading || !session) {
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
          <Icon name="arrow-back" size="lg" />
        </Pressable>

        <VStack className="gap-1">
          <Heading size="2xl">{session.name || session.sport}</Heading>
          {session.location && <Text className="text-slate-500 dark:text-slate-400">{session.location}</Text>}
        </VStack>

        {/* DP-001: a draft session is invisible to members until published
            — minimal affordance so the create-session flow isn't a dead
            end; not the full Draft-editing experience described in the
            product decision (courts/pricing/duplicate), just the one
            action needed to avoid silently breaking session creation. */}
        {isOwnerOrAdmin && session.status === 'draft' && (
          <Box className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-4 gap-3">
            <Text className="text-sm text-amber-800 dark:text-amber-300">{t('sessionDraftNotice')}</Text>
            <Button size="sm" className="rounded-xl bg-amber-600" isDisabled={busy} onPress={handlePublish}>
              <ButtonText className="text-white">{t('sessionPublish')}</ButtonText>
            </Button>
          </Box>
        )}

        {!myParticipant || myParticipant.status !== 'checked_in' ? (
          <Button action="secondary" size="xl" className="w-full rounded-2xl bg-blue-600" isDisabled={busy} onPress={handleCheckIn}>
            <ButtonText className="text-white text-lg">{t('sessionCheckIn')}</ButtonText>
          </Button>
        ) : (
          <Box className="bg-teal-100 dark:bg-teal-900/30 rounded-2xl p-4 items-center">
            <Text className="text-teal-700 dark:text-teal-400 font-bold">{t('sessionCheckedIn')}</Text>
          </Box>
        )}

        <VStack className="gap-2">
          <Text className="text-sm font-extrabold text-slate-400 tracking-widest uppercase">
            {t('sessionParticipantsTitle')}
          </Text>
          {participants.map((p) => (
            <Box key={p.id} className="bg-white dark:bg-slate-800 rounded-2xl p-4">
              <HStack className="justify-between items-center">
                <Text className="font-bold text-slate-900 dark:text-white">
                  {p.displayName || p.username || p.guestName}
                  {p.userId === profile?.id ? ` (${t('sessionYou')})` : ''}
                </Text>
                <Text className="text-xs text-slate-400">
                  {p.status === 'checked_in' ? t('sessionCheckedIn') : t('sessionRegistered')}
                </Text>
              </HStack>
            </Box>
          ))}
        </VStack>

        <VStack className="gap-2">
          <HStack className="justify-between items-center">
            <Text className="text-sm font-extrabold text-slate-400 tracking-widest uppercase">
              {t('activityQueueTitle')}
            </Text>
            {isOwnerOrAdmin && (
              <Pressable onPress={() => onAddMatch(sessionId)} className="active:opacity-60">
                <Text className="text-sm font-bold text-blue-600">{t('activityAdd')}</Text>
              </Pressable>
            )}
          </HStack>
          {activities.length === 0 ? (
            <Text className="text-slate-500 dark:text-slate-400">{t('activityEmptyQueue')}</Text>
          ) : (
            activities.map((a) => {
              const canStart =
                a.status === 'queued' &&
                myParticipant?.status === 'checked_in' &&
                a.participants.some((p) => p.userId === profile?.id);
              // Any checked-in participant of the session (not just this
              // match's own players) can watch — matches domain.md's Member
              // permission to "watch live score."
              const canWatch = a.status === 'live' && myParticipant?.status === 'checked_in';
              const isLiveScorer = a.status === 'live' && a.scorerUserId === profile?.id;
              return (
                <Box key={a.id} className="bg-white dark:bg-slate-800 rounded-2xl p-4">
                  <HStack className="justify-between items-center gap-3">
                    <VStack className="flex-1 gap-1">
                      <Text className="font-bold text-slate-900 dark:text-white">{activityParticipantNames(a)}</Text>
                      {a.status === 'live' ? (
                        <HStack className="items-center gap-1.5">
                          <Box className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          <Text className="text-xs font-extrabold text-red-500 tracking-wide">
                            {t('activityStatusLive').toUpperCase()}
                          </Text>
                        </HStack>
                      ) : (
                        <Text className="text-xs text-slate-400">
                          {a.status === 'queued' ? t('activityStatusQueued') : t('activityStatusCompleted')}
                        </Text>
                      )}
                    </VStack>
                    {canStart && (
                      <Button size="sm" className="rounded-xl bg-amber-600" onPress={() => onOpenMatch(a.id)}>
                        <ButtonText className="text-white">{t('activityStart')}</ButtonText>
                      </Button>
                    )}
                    {canWatch && (
                      <Button size="sm" className="rounded-xl bg-red-600" onPress={() => onOpenMatch(a.id)}>
                        <ButtonText className="text-white">{isLiveScorer ? t('activityResume') : t('activityWatch')}</ButtonText>
                      </Button>
                    )}
                  </HStack>
                </Box>
              );
            })
          )}
        </VStack>

        {isOwnerOrAdmin && (
          <VStack className="gap-2 pt-2">
            <Text className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('sessionAddGuest')}</Text>
            <HStack className="gap-2">
              <Input className="flex-1">
                <InputField
                  placeholder={t('sessionAddGuestPlaceholder')}
                  value={guestName}
                  onChangeText={setGuestName}
                  onSubmitEditing={handleAddGuest}
                />
              </Input>
              <Button action="secondary" className="rounded-xl bg-blue-600" onPress={handleAddGuest}>
                <ButtonText className="text-white">{t('sessionAdd')}</ButtonText>
              </Button>
            </HStack>
            {error && <Text className="text-sm text-red-500">{error}</Text>}
          </VStack>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
