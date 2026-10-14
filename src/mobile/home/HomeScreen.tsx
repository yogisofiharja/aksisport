import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, RefreshControl, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { VStack } from '../../design-system/layout/VStack';
import { HStack } from '../../design-system/layout/HStack';
import { NotificationBell } from '../notifications/NotificationBell';
import { Typography } from '../../design-system/ui/Typography';
import { Loading } from '../../design-system/feedback/Loading';
import { EmptyState } from '../../design-system/feedback/EmptyState';
import { Icon } from '../../design-system/ui/Icon';
import { SessionCard } from '../../design-system/domain-ui/SessionCard';
import { useTranslation } from '../../i18n';
import { authHeader } from '../../core/api/client';
import { listClubs, clubAvatarUrl } from '../../core/clubs/api';
import { listSessions } from '../../core/sessions/api';
import { formatSessionDateTime } from '../../core/sessions/sessionSchedule';
import { currentFocusBuckets } from '../../core/sessions/currentFocus';
import { initialsFromName } from '../../core/initials';
import { statusLabel, sessionStatusColor } from '../sessions/SessionListScreen';
import type { ClubWithRole, Session } from '../../core/api/types';

type Props = {
  onOpenNotifications: () => void;
  onOpenClub: (clubId: string) => void;
  onCreateClub: () => void;
  onOpenSession: (sessionId: string) => void;
};

type AttentionItem = {
  session: Session;
  club: ClubWithRole;
};

function byStartsAtAsc(a: AttentionItem, b: AttentionItem) {
  return (a.session.startsAt ?? '').localeCompare(b.session.startsAt ?? '');
}

// UX-003 (Attention Before Browsing) + UX-015 (Consistent Mental Model):
// surface what needs attention across every Community the user belongs
// to, ranked the same way Community Home ranks its own Current Focus
// (Live, Today, the single soonest upcoming Session per Club, then
// Drafts), just merged across every Club instead of scoped to one.
// Client-side N+1 fetch (1 + club count) — accepted MVP tradeoff at
// recreational-club scale; no cross-club backend endpoint exists yet.
async function loadAttention(clubs: ClubWithRole[]): Promise<AttentionItem[]> {
  const perClub = await Promise.all(
    clubs.map(async (club) => {
      try {
        const sessions = await listSessions(club.id);
        const buckets = currentFocusBuckets(sessions);
        return {
          live: buckets.live.map((session) => ({ session, club })),
          today: buckets.today.map((session) => ({ session, club })),
          next: buckets.next.map((session) => ({ session, club })),
          drafts: buckets.drafts.map((session) => ({ session, club })),
        };
      } catch {
        return { live: [], today: [], next: [], drafts: [] };
      }
    })
  );
  const live = perClub.flatMap((r) => r.live);
  const today = perClub.flatMap((r) => r.today).sort(byStartsAtAsc);
  const next = perClub.flatMap((r) => r.next).sort(byStartsAtAsc);
  const drafts = perClub.flatMap((r) => r.drafts).sort(byStartsAtAsc);
  return [...live, ...today, ...next, ...drafts];
}

export function HomeScreen({ onOpenNotifications, onOpenClub, onOpenSession, onCreateClub }: Props) {
  const { t } = useTranslation();
  const [clubs, setClubs] = useState<ClubWithRole[]>([]);
  const [attention, setAttention] = useState<AttentionItem[]>([]);
  const [loading, setLoading] = useState(true);
  // GET .../avatar is behind the same auth as every other route — fetched
  // once per mount, same convention as ClubMembersScreen/SessionChat's own
  // image headers.
  const [imageHeaders, setImageHeaders] = useState<Record<string, string>>({});

  useEffect(() => {
    authHeader().then(setImageHeaders);
  }, []);

  const load = useCallback(async () => {
    try {
      const result = await listClubs();
      setClubs(result);
      setAttention(await loadAttention(result));
    } catch {
      // stays stale; user can pull to refresh
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <ScrollPage gap="lg" refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <HStack className="justify-between items-center">
        <Typography variant="display">{t('tabHome')}</Typography>
        <NotificationBell onPress={onOpenNotifications} />
      </HStack>

      {loading && clubs.length === 0 ? (
        <Loading />
      ) : (
        <>
          {/* My Communities — leads Home (above Attention): the user's own
              set of Communities is who they are before what's happening
              right now, same circle-avatar-grid convention as
              ClubMembersScreen's member grid (UX-015 consistency). Creating
              a Community starts here too — a "New" tile at the end of the
              grid, where people look for their Communities. */}
          <VStack space="sm">
            <Typography variant="caption" color="muted">
              {t('homeMyCommunitiesTitle')}
            </Typography>
            {clubs.length === 0 && <EmptyState message={t('homeCommunitiesEmptyState')} />}
            <HStack className="flex-wrap" style={{ rowGap: 20, alignItems: 'flex-start' }}>
                {clubs.map((club) => (
                  <Pressable
                    key={club.id}
                    className="w-1/4 items-center px-1 active:opacity-70"
                    onPress={() => onOpenClub(club.id)}
                  >
                    <View className="w-16 h-16 rounded-full items-center justify-center overflow-hidden bg-slate-100 dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600">
                      {club.hasAvatar ? (
                        <Image
                          source={{ uri: clubAvatarUrl(club.id), headers: imageHeaders }}
                          style={{ width: '100%', height: '100%' }}
                        />
                      ) : (
                        <Typography variant="body" className="text-base font-extrabold text-slate-600 dark:text-slate-300">
                          {initialsFromName(club.name)}
                        </Typography>
                      )}
                    </View>
                    <Typography
                      variant="body"
                      className="text-xs font-bold text-slate-900 dark:text-white text-center mt-1"
                      numberOfLines={2}
                    >
                      {club.name}
                    </Typography>
                  </Pressable>
                ))}
                <Pressable
                  className="w-1/4 items-center px-1 active:opacity-70"
                  onPress={onCreateClub}
                  accessibilityLabel={t('homeNewCommunity')}
                >
                  <View className="w-16 h-16 rounded-full items-center justify-center border-2 border-dashed border-blue-400 dark:border-blue-500">
                    <Icon name="add" size="lg" color="secondary" />
                  </View>
                  <Typography variant="body" className="text-xs font-bold text-blue-600 dark:text-blue-400 text-center mt-1" numberOfLines={2}>
                    {t('homeNewCommunity')}
                  </Typography>
                </Pressable>
              </HStack>
          </VStack>

          {attention.length > 0 && (
            <VStack space="sm">
              <Typography variant="caption" color="muted">
                {t('homeAttentionTitle')}
              </Typography>
              <VStack space="md">
                {attention.map(({ session, club }) => (
                  <SessionCard
                    key={session.id}
                    title={session.name ?? club.name}
                    subtitle={club.name}
                    dateTime={formatSessionDateTime(session.startsAt)}
                    status={statusLabel(session.lifecycleStatus, t)}
                    statusAction={sessionStatusColor(session.lifecycleStatus)}
                    joinedCount={session.status === 'draft' ? undefined : session.joinedCount}
                    maxParticipants={session.maxParticipants}
                    onPress={() => onOpenSession(session.id)}
                  />
                ))}
              </VStack>
            </VStack>
          )}
        </>
      )}
    </ScrollPage>
  );
}
