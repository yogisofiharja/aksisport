import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { VStack } from '../../design-system/layout/VStack';
import { useNotificationBell } from '../notifications/NotificationBell';
import { useAuth } from '../../core/auth/AuthContext';
import { homeDateLine, firstName } from './homeDisplay';
import { Typography } from '../../design-system/ui/Typography';
import { Loading } from '../../design-system/feedback/Loading';
import { EmptyState } from '../../design-system/feedback/EmptyState';
import { Icon } from '../../design-system/ui/Icon';
import { SessionCard } from '../../design-system/domain-ui/SessionCard';
import { ClubCard } from '../../design-system/domain-ui/ClubCard';
import { useTranslation } from '../../i18n';
import { authHeader } from '../../core/api/client';
import { listClubs, clubAvatarUrl } from '../../core/clubs/api';
import { listSessions } from '../../core/sessions/api';
import { currentFocusBuckets } from '../../core/sessions/currentFocus';
import { sessionCardProps } from '../sessions/sessionDisplay';
import { shortCityName } from '../../core/locations/cityName';
import type { ClubWithRole, Session } from '../../core/api/types';
import { AppBar } from '../../design-system/layout/AppBar';

function roleLabel(role: ClubWithRole['role'], t: (key: string) => string) {
  if (role === 'owner') return t('clubRoleOwner');
  if (role === 'admin') return t('clubRoleAdmin');
  return t('clubRoleMember');
}

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
  const { t, lang } = useTranslation();
  const { profile } = useAuth();
  const bell = useNotificationBell(onOpenNotifications);
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
    <ScrollPage
      gap="lg"
      appBar={
        <AppBar
          variant="root"
          dateLine={homeDateLine(new Date(), lang)}
          title={t('homeGreeting', firstName(profile?.displayName || profile?.username || ''))}
          actions={[bell]}
        />
      }
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >

      {loading && clubs.length === 0 ? (
        <Loading />
      ) : (
        <>
          {/* My Communities — leads Home (above Attention): the user's own
              set of Communities is who they are before what's happening
              right now — as a row of ClubCard tiles (role · city). Creating
              a Community starts here too — a "New" tile at the end of the
              row, where people look for their Communities. */}
          <VStack space="sm">
            <Typography variant="overline" color="muted">
              {t('homeMyCommunitiesTitle')}
            </Typography>
            {clubs.length === 0 && <EmptyState message={t('homeCommunitiesEmptyState')} />}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {clubs.map((club) => (
                <ClubCard
                  key={club.id}
                  variant="tile"
                  name={club.name}
                  hasAvatar={club.hasAvatar}
                  avatarSource={club.hasAvatar ? { uri: clubAvatarUrl(club.id), headers: imageHeaders } : undefined}
                  roleLabel={roleLabel(club.role, t)}
                  cityName={club.cityName ? shortCityName(club.cityName) : undefined}
                  onPress={() => onOpenClub(club.id)}
                />
              ))}
              <Pressable
                className="w-[100px] p-3.5 rounded-xl items-center justify-center gap-1.5 border-2 border-dashed border-border-strong dark:border-border-strong-dark active:opacity-70"
                onPress={onCreateClub}
                accessibilityRole="button"
              >
                <Icon name="add" size="lg" color="default" />
                <Typography variant="label" className="text-center">
                  {t('homeNewCommunity')}
                </Typography>
              </Pressable>
            </ScrollView>
          </VStack>

          {attention.length > 0 && (
            <VStack space="sm">
              <Typography variant="overline" color="muted">
                {t('homeAttentionTitle')}
              </Typography>
              <VStack space="sm">
                {attention.map(({ session, club }) => (
                  <SessionCard
                    key={session.id}
                    {...sessionCardProps({ ...session, name: session.name ?? club.name }, t, lang, club.name)}
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
