import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { MatchCard } from '../../design-system/domain-ui/MatchCard';
import { ListGroup, ListRow } from '../../design-system/ui/List';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { useTranslation } from '../../i18n';
import { organizerNow } from '../../core/sessions/organizerNow';
import { liveSideScores, useLiveMatchStates } from '../../core/activities/liveScore';
import { participantLabel } from '../../core/activities/buildGeneratedMatchPayload';
import type { GeneratedMatch } from '../../core/sessions/matchGenerator';
import type { ActivityDetail, SessionParticipant } from '../../core/api/types';
import { activityParticipantNames } from './tabs/MatchesTab';

type Props = {
  participants: SessionParticipant[];
  activities: ActivityDetail[];
  courtCount: number;
  // Players a match needs (2 singles, 4 doubles).
  needed: number;
  busy: boolean;
  onOpenPlayers: () => void;
  onOpenMatches: () => void;
  onAddSuggested: (match: GeneratedMatch) => void;
};

// DP-030: what an organizer needs at a glance while a Session is In
// Progress, at the top of Details: who's here, the courts with live
// scores, who's waiting and for how long, and what to play next. A
// suggestion is only added on a tap.
export function OrganizerNowPanel({ participants, activities, courtCount, needed, busy, onOpenPlayers, onOpenMatches, onAddSuggested }: Props) {
  const { t } = useTranslation();
  // Waits are in minutes: re-render once a minute.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const panel = organizerNow({ participants, activities, courtCount, needed, now });
  const liveStates = useLiveMatchStates(panel.live.map((a) => a.id));
  const byId = new Map(participants.map((p) => [p.id, p]));
  const teamNames = (a: ActivityDetail, team: 'A' | 'B') =>
    a.participants
      .filter((p) => p.team === team)
      .map((p) => p.displayName || p.username || p.guestName)
      .join(' / ');
  const suggestionNames = (m: GeneratedMatch) => {
    const names = m.participantIds.map((id) => (byId.get(id) ? participantLabel(byId.get(id)!) : '?'));
    const half = names.length / 2;
    return `${names.slice(0, half).join(' / ')} vs ${names.slice(half).join(' / ')}`;
  };

  return (
    <View className="gap-3 p-4 rounded-xl bg-surface dark:bg-surface-dark border border-border dark:border-border-dark">
      <Text className="text-sm font-extrabold text-ink-muted dark:text-ink-muted-dark tracking-widest uppercase">{t('nowTitle')}</Text>

      <View className="flex-row gap-2">
        <Stat label={t('nowHere')} value={`${panel.checkedIn}/${panel.expected}`} />
        <Stat label={t('nowCourts')} value={`${panel.live.length}/${courtCount}`} />
        <Stat label={t('nowWaiting')} value={String(panel.waiting.length)} alert={panel.waiting.some((w) => w.long)} />
      </View>

      {panel.notHere.length > 0 && (
        <ListGroup>
          <ListRow
            icon="time-outline"
            title={t('nowNotHere', panel.notHere.length)}
            subtitle={panel.notHere.map(participantLabel).join(', ')}
            chevron
            onPress={onOpenPlayers}
          />
        </ListGroup>
      )}

      {panel.live.map((a) => {
        const live = liveSideScores(liveStates[a.id]);
        return (
          <MatchCard
            key={a.id}
            status="live"
            statusLabel={t('activityStatusLive')}
            matchup={activityParticipantNames(a)}
            sides={
              live
                ? [
                    { names: teamNames(a, 'A'), games: live.A.games, points: live.A.points, serving: live.A.serving },
                    { names: teamNames(a, 'B'), games: live.B.games, points: live.B.points, serving: live.B.serving },
                  ]
                : [{ names: teamNames(a, 'A') }, { names: teamNames(a, 'B') }]
            }
            onPress={onOpenMatches}
          />
        );
      })}
      {panel.courtsFree > 0 && <Text className="text-sm text-ink-muted dark:text-ink-muted-dark">{t('nowCourtsFree', panel.courtsFree)}</Text>}

      {panel.waiting.length > 0 && (
        <ListGroup>
          {panel.waiting.map((w) => (
            <ListRow
              key={w.participant.id}
              icon={w.long ? 'alert-circle-outline' : 'person-outline'}
              iconTone={w.long ? 'heat' : 'neutral'}
              title={participantLabel(w.participant)}
              subtitle={w.queued ? t('nowInQueue') : t('nowNoMatch')}
              aside={t('nowMinutes', w.minutes)}
            />
          ))}
        </ListGroup>
      )}

      {panel.suggestion ? (
        <View className="gap-2">
          <Text className="text-sm font-sans-semibold text-ink dark:text-ink-dark">{t('nowSuggested')}</Text>
          <Text className="text-sm text-ink-muted dark:text-ink-muted-dark">{suggestionNames(panel.suggestion)}</Text>
          <Button isDisabled={busy} onPress={() => onAddSuggested(panel.suggestion!)}>
            <ButtonText>{t('nowAddMatch')}</ButtonText>
          </Button>
        </View>
      ) : panel.nextQueued ? (
        <ListGroup>
          <ListRow
            icon="play-forward-outline"
            title={t('nowNextUp')}
            subtitle={activityParticipantNames(panel.nextQueued)}
            chevron
            onPress={onOpenMatches}
          />
        </ListGroup>
      ) : null}
    </View>
  );
}

function Stat({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <View className="flex-1 items-center py-2 rounded-lg bg-surface-sunken dark:bg-surface-sunken-dark">
      <Text className={`font-display text-xl ${alert ? 'text-heat-strong dark:text-heat-strong-dark' : 'text-ink dark:text-ink-dark'}`}>{value}</Text>
      <Text className="text-xs text-ink-muted dark:text-ink-muted-dark">{label}</Text>
    </View>
  );
}
