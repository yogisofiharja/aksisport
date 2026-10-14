import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { HStack } from '../../design-system/layout/HStack';
import { VStack } from '../../design-system/layout/VStack';
import { Typography } from '../../design-system/ui/Typography';
import { Icon } from '../../design-system/ui/Icon';
import { Card } from '../../design-system/ui/Card';
import { Badge } from '../../design-system/ui/Badge';
import { EmptyState } from '../../design-system/feedback/EmptyState';
import { Loading } from '../../design-system/feedback/Loading';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import { getPlayerProfile, getPlayerSportActivity } from '../../core/api/client';
import { formatSessionDateTime } from '../../core/sessions/sessionSchedule';
import { getSportModule } from '../../sports/registry';
import type { PlayerProfile, PlayerSportActivity } from '../../core/api/types';

type Props = {
  userId: string;
  sport: string;
  onBack: () => void;
};

function sportLabel(sport: string, t: (key: string) => string) {
  return sport === 'tennis' ? t('sportTennis') : sport;
}

// One player's page for one sport (DP-019): their level, totals, and the
// Sessions and matches they took part in — across every Community, so an
// organizer can judge a newcomer from elsewhere. Opened from a player's
// profile, and from the Me tab for your own.
export function PlayerSportScreen({ userId, sport, onBack }: Props) {
  const { t } = useTranslation();
  const { profile: me } = useAuth();
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [activity, setActivity] = useState<PlayerSportActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, a] = await Promise.all([getPlayerProfile(userId), getPlayerSportActivity(userId, sport)]);
      setPlayer(p);
      setActivity(a);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [userId, sport]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const isMe = userId === me?.id;
  const level = player?.skillLevels.find((l) => l.sport === sport);
  const module = getSportModule(sport);
  const summary = activity?.summary;
  const winRate = summary && summary.matchesPlayed > 0 ? Math.round((summary.wins / summary.matchesPlayed) * 100) : null;

  const stats = summary
    ? [
        { label: t('playerSportSessions'), value: String(summary.sessionsAttended) },
        { label: t('playerSportMatches'), value: String(summary.matchesPlayed) },
        { label: t('playerSportWins'), value: String(summary.wins) },
        { label: t('playerSportWinRate'), value: winRate == null ? '—' : `${winRate}%` },
        { label: t('playerSportNoShows'), value: String(summary.noShows) },
      ]
    : [];

  return (
    <ScrollPage gap="lg" refreshControl={<RefreshControl refreshing={loading && activity !== null} onRefresh={load} />}>
      <Pressable className="p-2 -ml-2 active:opacity-60 self-start" onPress={onBack}>
        <Icon name="arrow-back" size="lg" />
      </Pressable>

      <VStack space="xs">
        <Typography variant="caption" color="muted">
          {isMe ? t('playerSportYours') : player ? player.displayName || player.username : ''}
        </Typography>
        <Typography variant="display">{sportLabel(sport, t)}</Typography>
        <Typography variant="body" color={level ? 'default' : 'muted'}>
          {level ? t('playerSportLevel', level.skillLevelName) : t('playerSportLevelNotSet')}
        </Typography>
        {isMe && (
          <Typography variant="body" color="muted" className="text-sm">
            {t('playerSportChangeLevelHint')}
          </Typography>
        )}
      </VStack>

      {loading && !activity ? (
        <Loading />
      ) : failed && !activity ? (
        <EmptyState message={t('playerProfileUnavailable')} />
      ) : (
        <>
          <View className="flex-row flex-wrap gap-2">
            {stats.map((s) => (
              <Card key={s.label} className="items-center" style={{ minWidth: 96, flexGrow: 1 }}>
                <Typography variant="title">{s.value}</Typography>
                <Typography variant="body" color="muted" className="text-xs">
                  {s.label}
                </Typography>
              </Card>
            ))}
          </View>

          <VStack space="sm">
            <Typography variant="caption" color="muted">
              {t('playerSportMatchesTitle')}
            </Typography>
            {activity && activity.matches.length === 0 ? (
              <EmptyState message={t('playerSportNoMatches')} />
            ) : (
              activity?.matches.map((m) => {
                const team = m.team === 'B' ? 'B' : 'A';
                const partners = m.players.filter((p) => p.team === team).map((p) => p.name);
                const opponents = m.players.filter((p) => p.team !== team).map((p) => p.name);
                const score = module?.formatResult?.(m.result, team);
                return (
                  <Card key={m.activityId}>
                    <VStack space="xs">
                      <HStack className="justify-between items-center" space="sm">
                        <Typography variant="body" className="font-bold" style={{ flex: 1 }} numberOfLines={1}>
                          {t('playerSportVersus', opponents.join(' & ') || '—')}
                        </Typography>
                        {m.won === true && <Badge action="success" text={t('playerSportWon')} />}
                        {m.won === false && <Badge action="error" text={t('playerSportLost')} />}
                      </HStack>
                      {score ? (
                        <Typography variant="body" className="font-semibold">
                          {score}
                        </Typography>
                      ) : null}
                      {partners.length > 1 && (
                        <Typography variant="body" color="muted" className="text-sm">
                          {t('playerSportWith', partners.filter((n) => n !== (player?.displayName || player?.username)).join(' & '))}
                        </Typography>
                      )}
                      <Typography variant="body" color="muted" className="text-xs">
                        {[formatSessionDateTime(m.completedAt), m.clubName].filter(Boolean).join(' · ')}
                      </Typography>
                    </VStack>
                  </Card>
                );
              })
            )}
          </VStack>

          <VStack space="sm">
            <Typography variant="caption" color="muted">
              {t('playerSportSessionsTitle')}
            </Typography>
            {activity && activity.sessions.length === 0 ? (
              <EmptyState message={t('playerSportNoSessions')} />
            ) : (
              activity?.sessions.map((s) => (
                <Card key={s.sessionId}>
                  <HStack className="justify-between items-center" space="sm">
                    <VStack space="xs" style={{ flex: 1 }}>
                      <Typography variant="body" className="font-bold" numberOfLines={1}>
                        {s.sessionName ?? s.clubName}
                      </Typography>
                      <Typography variant="body" color="muted" className="text-xs">
                        {[formatSessionDateTime(s.startsAt), s.clubName].filter(Boolean).join(' · ')}
                      </Typography>
                    </VStack>
                    <Badge
                      action={s.outcome === 'no_show' ? 'warning' : 'success'}
                      text={s.outcome === 'no_show' ? t('playerSportNoShowBadge') : t('playerSportAttendedBadge')}
                    />
                  </HStack>
                </Card>
              ))
            )}
          </VStack>
        </>
      )}
    </ScrollPage>
  );
}
