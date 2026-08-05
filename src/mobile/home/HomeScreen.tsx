import { useCallback, useState } from 'react';
import { RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { VStack } from '../../design-system/layout/VStack';
import { Typography } from '../../design-system/ui/Typography';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { Loading } from '../../design-system/feedback/Loading';
import { EmptyState } from '../../design-system/feedback/EmptyState';
import { ClubCard } from '../../design-system/domain-ui/ClubCard';
import { SessionCard } from '../../design-system/domain-ui/SessionCard';
import { useTranslation } from '../../i18n';
import { listClubs } from '../../core/clubs/api';
import { listSessions } from '../../core/sessions/api';
import { sessionDateBucket, formatSessionDateTime } from '../../core/sessions/sessionSchedule';
import { statusLabel, sessionStatusColor } from '../sessions/SessionListScreen';
import type { ClubWithRole, Session } from '../../core/api/types';
import { spacing } from '../../design-system/foundation/spacing';

type Props = {
  onOpenClub: (clubId: string) => void;
  onCreateClub: () => void;
  onJoinClub: () => void;
  onOpenSession: (sessionId: string) => void;
};

type AttentionItem = {
  session: Session;
  club: ClubWithRole;
};

function byAttentionPriority(a: AttentionItem, b: AttentionItem) {
  const aLive = a.session.status === 'in_progress';
  const bLive = b.session.status === 'in_progress';
  if (aLive !== bLive) return aLive ? -1 : 1;
  return (a.session.startsAt ?? '').localeCompare(b.session.startsAt ?? '');
}

// UX-003 (Attention Before Browsing): surface what needs attention across
// every Community the user belongs to, before "My Communities" browsing.
// Client-side N+1 fetch (1 + club count) — accepted MVP tradeoff at
// recreational-club scale; no cross-club backend endpoint exists yet.
async function loadAttention(clubs: ClubWithRole[]): Promise<AttentionItem[]> {
  const perClub = await Promise.all(
    clubs.map(async (club) => {
      try {
        const sessions = await listSessions(club.id);
        return sessions
          .filter((s) => s.status === 'in_progress' || sessionDateBucket(s) === 'today')
          .map((session) => ({ session, club }));
      } catch {
        return [];
      }
    })
  );
  return perClub.flat().sort(byAttentionPriority);
}

function roleLabel(role: ClubWithRole['role'], t: (key: string) => string) {
  return role === 'owner' ? t('clubRoleOwner') : role === 'admin' ? t('clubRoleAdmin') : t('clubRoleMember');
}

export function HomeScreen({ onOpenClub, onCreateClub, onJoinClub, onOpenSession }: Props) {
  const { t } = useTranslation();
  const [clubs, setClubs] = useState<ClubWithRole[]>([]);
  const [attention, setAttention] = useState<AttentionItem[]>([]);
  const [loading, setLoading] = useState(true);

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
      <Typography variant="display">{t('tabHome')}</Typography>

      {loading && clubs.length === 0 ? (
        <Loading />
      ) : (
        <>
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
                    onPress={() => onOpenSession(session.id)}
                  />
                ))}
              </VStack>
            </VStack>
          )}

          <VStack space="sm">
            <Typography variant="caption" color="muted">
              {t('homeMyCommunitiesTitle')}
            </Typography>
            {clubs.length === 0 ? (
              <EmptyState message={t('homeCommunitiesEmptyState')} />
            ) : (
              <VStack space="md">
                {clubs.map((club) => (
                  <ClubCard key={club.id} name={club.name} subtitle={roleLabel(club.role, t)} onPress={() => onOpenClub(club.id)} />
                ))}
              </VStack>
            )}
          </VStack>
        </>
      )}

      <VStack space="md" style={{ paddingTop: spacing.lg }}>
        <Button action="secondary" size="lg" className="w-full" onPress={onCreateClub}>
          <ButtonText>{t('homeCreateCommunity')}</ButtonText>
        </Button>
        <Button action="secondary" variant="outline" size="lg" className="w-full" onPress={onJoinClub}>
          <ButtonText action="secondary" variant="outline">
            {t('homeJoinCommunity')}
          </ButtonText>
        </Button>
      </VStack>
    </ScrollPage>
  );
}
