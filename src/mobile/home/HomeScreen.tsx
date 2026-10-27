import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { VStack } from '../../design-system/layout/VStack';
import { HStack } from '../../design-system/layout/HStack';
import { AppBar } from '../../design-system/layout/AppBar';
import { useNotificationBell } from '../notifications/NotificationBell';
import { Typography } from '../../design-system/ui/Typography';
import { ListGroup } from '../../design-system/ui/List';
import { Loading } from '../../design-system/feedback/Loading';
import { SessionCard } from '../../design-system/domain-ui/SessionCard';
import { ClubCard } from '../../design-system/domain-ui/ClubCard';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import { authHeader } from '../../core/api/client';
import { listClubs, clubAvatarUrl } from '../../core/clubs/api';
import { listMyJoinedSessions, listSessions } from '../../core/sessions/api';
import { sessionDateBucket } from '../../core/sessions/sessionSchedule';
import { dismissInvitation, listMyInvitations } from '../../core/invites/api';
import type { InvitationCard } from '../../core/invites/types';
import { InviteCard } from '../../design-system/domain-ui/InviteCard';
import { inviteCardLines } from './inviteCardLines';
import { currentFocusBuckets } from '../../core/sessions/currentFocus';
import { sessionHeroProps, sessionRowProps } from '../sessions/sessionDisplay';
import { shortCityName } from '../../core/locations/cityName';
import { homeDateLine, firstName } from './homeDisplay';
import type { ClubWithRole, Session } from '../../core/api/types';
import { FirstRunHome } from './FirstRunHome';

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
  onOpenExplore: () => void;
  onOpenInvite: (invite: InvitationCard) => void;
};

type AttentionItem = {
  session: Session;
  club: { name: string };
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
async function loadAttention(clubs: ClubWithRole[]): Promise<{ live: AttentionItem[]; rest: AttentionItem[] }> {
  // DP-028: Sessions you play in outside your Communities (as a
  // Session-only participant) show here like any other.
  const memberOf = new Set(clubs.map((c) => c.id));
  const elsewhere = listMyJoinedSessions()
    .then((joined) => joined.filter((s) => !memberOf.has(s.clubId)))
    .catch(() => []);
  const perClub = await Promise.all([
    ...clubs.map(async (club) => {
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
    }),
    elsewhere.then((joined) => {
      const buckets = currentFocusBuckets(joined);
      const item = (session: Session) => ({ session, club: { name: joined.find((j) => j.id === session.id)?.clubName ?? '' } });
      return {
        live: buckets.live.map(item),
        today: buckets.today.map(item),
        next: joined
          .filter((s) => s.status !== 'in_progress' && s.status !== 'draft' && sessionDateBucket(s) === 'upcoming')
          .map(item),
        drafts: [],
      };
    }),
  ]);
  const live = perClub.flatMap((r) => r.live);
  const today = perClub.flatMap((r) => r.today).sort(byStartsAtAsc);
  const next = perClub.flatMap((r) => r.next).sort(byStartsAtAsc);
  const drafts = perClub.flatMap((r) => r.drafts).sort(byStartsAtAsc);
  return { live, rest: [...today, ...next, ...drafts] };
}

export function HomeScreen({ onOpenNotifications, onOpenClub, onOpenSession, onCreateClub, onOpenExplore, onOpenInvite }: Props) {
  const { t, lang } = useTranslation();
  const { profile } = useAuth();
  const bell = useNotificationBell(onOpenNotifications);
  const [clubs, setClubs] = useState<ClubWithRole[]>([]);
  const [live, setLive] = useState<AttentionItem[]>([]);
  const [rest, setRest] = useState<AttentionItem[]>([]);
  const [invites, setInvites] = useState<InvitationCard[]>([]);
  const [loading, setLoading] = useState(true);
  // Only a successful load can say "no communities": a failed one keeps
  // whatever was there and never shows the first-run page by mistake.
  const [loaded, setLoaded] = useState(false);
  // GET .../avatar is behind the same auth as every other route — fetched
  // once per mount, same convention as ClubMembersScreen/SessionChat's own
  // image headers.
  const [imageHeaders, setImageHeaders] = useState<Record<string, string>>({});

  useEffect(() => {
    authHeader().then(setImageHeaders);
  }, []);

  const load = useCallback(async () => {
    try {
      const [result, pending] = await Promise.all([listClubs(), listMyInvitations().catch(() => [] as InvitationCard[])]);
      setClubs(result);
      setInvites(pending);
      const attention = await loadAttention(result);
      setLive(attention.live);
      setRest(attention.rest);
      setLoaded(true);
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

  // First run (Aksi redesign › First run): no Community yet — and nothing
  // else to show (an invitation, a Session played outside a Community).
  const firstRun = loaded && clubs.length === 0 && invites.length === 0 && live.length + rest.length === 0;
  const [invitedBefore, invitedAfter] = t('inviteInvitedYou', '\u0000').split('\u0000');

  async function handleNotNow(invite: InvitationCard) {
    setInvites((prev) => prev.filter((i) => i.id !== invite.id));
    await dismissInvitation(invite.id).catch(() => {});
  }
  const name = firstName(profile?.displayName || profile?.username || '');

  return (
    <ScrollPage
      gap="lg"
      appBar={
        <AppBar
          variant="root"
          dateLine={firstRun ? t('homeWelcome') : homeDateLine(new Date(), lang)}
          title={name ? t('homeGreeting', name) : t('tabHome')}
          actions={[bell]}
        />
      }
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      {loading && !loaded ? (
        <Loading />
      ) : firstRun ? (
        <FirstRunHome onOpenExplore={onOpenExplore} onCreateClub={onCreateClub} />
      ) : (
        <>
          {/* DP-028: in-app invitations on top, one card each. */}
          {invites.length > 0 && (
            <VStack space="md">
              <Typography variant="overline" color="muted">
                {t('homeInvited')}
              </Typography>
              {invites.map((invite) => (
                <InviteCard
                  key={invite.id}
                  fromName={invite.fromName}
                  invitedYou={[invitedBefore, invitedAfter]}
                  title={invite.sessionName ?? invite.clubName}
                  lines={inviteCardLines(invite, t, lang)}
                  notNowLabel={t('inviteNotNow')}
                  joinLabel={t('inviteJoin')}
                  onNotNow={() => handleNotNow(invite)}
                  onJoin={() => onOpenInvite(invite)}
                />
              ))}
            </VStack>
          )}

          {/* Right now: the live Session as the dark card, then today's,
              the next per Community and drafts as rows. */}
          {live.length + rest.length > 0 && (
            <VStack space="md">
              <Typography variant="overline" color="muted">
                {t('homeRightNow')}
              </Typography>
              {live.map(({ session, club }) => (
                <SessionCard key={session.id} {...sessionHeroProps(session, t, club.name)} onPress={() => onOpenSession(session.id)} />
              ))}
              {rest.length > 0 && (
                <ListGroup>
                  {rest.map(({ session, club }) => (
                    <SessionCard
                      key={session.id}
                      {...sessionRowProps(session, t, lang, club.name)}
                      onPress={() => onOpenSession(session.id)}
                    />
                  ))}
                </ListGroup>
              )}
            </VStack>
          )}

          {/* My communities: ClubCard tiles (role · city) in a row, then
              the dashed New community tile. */}
          <VStack space="md">
            <HStack className="justify-between items-center">
              <Typography variant="overline" color="muted">
                {t('homeMyCommunitiesTitle')}
              </Typography>
              <Pressable onPress={onOpenExplore} hitSlop={8} accessibilityRole="link" className="active:opacity-60">
                <Typography variant="label" color="brand" className="text-[13px]">
                  {t('homeFindMore')}
                </Typography>
              </Pressable>
            </HStack>
            {clubs.length === 0 ? (
              <Typography variant="body" color="muted">
                {t('homeNoCommunityYet')}
              </Typography>
            ) : null}
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
              <ClubCard variant="new" name={t('homeNewCommunity')} onPress={onCreateClub} />
            </ScrollView>
          </VStack>
        </>
      )}
    </ScrollPage>
  );
}
