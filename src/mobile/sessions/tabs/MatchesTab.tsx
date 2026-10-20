import { MatchCard, MatchWatchLink } from '../../../design-system/domain-ui/MatchCard';
import { HStack, VStack } from '../../../../components/ui/box';
import { Text } from '../../../../components/ui/text';
import { Button, ButtonText } from '../../../../components/ui/button';
import { Pressable } from '../../../../components/ui/pressable';
import { useTranslation } from '../../../i18n';
import { matchFormatSummary } from '../../../core/sessions/matchFormatSummary';
import type { MatchConfig, MatchFormat, MatchState } from '../../../sports/tennis/scoringEngine';
import type { ActivityDetail, SessionParticipant } from '../../../core/api/types';

type Props = {
  activities: ActivityDetail[];
  isPublished: boolean;
  isOwnerOrAdmin: boolean;
  isSessionActive: boolean;
  matchesOpen: boolean;
  canRegenerate: boolean;
  busy: boolean;
  myUserId?: string;
  myParticipant?: SessionParticipant;
  onRegenerate: () => void;
  onAddMatch: () => void;
  onOpenMatch: (activityId: string) => void;
};

export function activityParticipantNames(activity: ActivityDetail): string {
  const names = (team: 'A' | 'B') =>
    activity.participants.filter((p) => p.team === team).map((p) => p.displayName || p.username || p.guestName).join(' / ');
  return `${names('A')} vs ${names('B')}`;
}

// A live match's format, short enough for its card's eyebrow:
// "Race To 4", "Fixed Games 6"; other formats use the full summary.
function matchFormatShort(format: MatchFormat, t: (key: string, ...args: any[]) => string): string {
  if (format.type === 'race-to') return `${t('formatRaceTo')} ${format.raceTo}`;
  if (format.type === 'fixed-games') return `${t('formatFixedGames')} ${format.totalGames}`;
  return matchFormatSummary(format, t);
}

export function MatchesTab({
  activities,
  isPublished,
  isOwnerOrAdmin,
  isSessionActive,
  matchesOpen,
  canRegenerate,
  busy,
  myUserId,
  myParticipant,
  onRegenerate,
  onAddMatch,
  onOpenMatch,
}: Props) {
  const { t } = useTranslation();
  const queuedActivities = activities.filter((a) => a.status === 'queued');

  if (!isPublished) {
    return (
      <VStack className="gap-2">
        <Text className="text-ink-muted dark:text-ink-muted-dark">{t('sessionMatchesUnavailableDraft')}</Text>
      </VStack>
    );
  }

  return (
    <VStack className="gap-2">
      <HStack className="justify-between items-center mb-1">
        <Text className="text-sm font-extrabold text-ink-muted dark:text-ink-muted-dark tracking-widest uppercase">{t('activityQueueTitle')}</Text>
        {isOwnerOrAdmin && isSessionActive && (
          <HStack className="gap-1">
            {canRegenerate && (
              <Pressable onPress={onRegenerate} className="px-3 py-2 active:opacity-60" disabled={busy} hitSlop={4}>
                <Text className="text-sm font-bold text-heat-strong dark:text-heat-strong-dark">{t('activityRegenerateMatches')}</Text>
              </Pressable>
            )}
            <Pressable onPress={onAddMatch} className="px-3 py-2 active:opacity-60" hitSlop={4}>
              <Text className="text-sm font-bold text-heat-strong dark:text-heat-strong-dark">{t('activityAdd')}</Text>
            </Pressable>
          </HStack>
        )}
      </HStack>
      {activities.length === 0 ? (
        <Text className="text-ink-muted dark:text-ink-muted-dark">{t('activityEmptyQueue')}</Text>
      ) : (
        activities.map((a) => {
          // Owner/admin can start any queued match administratively, once
          // matches are open (DP-022). A player starts their own from the
          // screen's bottom action, Start my match (DP-024).
          const canStart = matchesOpen && a.status === 'queued' && isOwnerOrAdmin;
          // Any checked-in participant of the session can watch.
          const canWatch = isSessionActive && a.status === 'live' && myParticipant?.status === 'checked_in';
          const isLiveScorer = a.status === 'live' && a.scorerUserId === myUserId;
          // A finished match opens its result (score, Share) at any time;
          // the row shows each side's score, winner in bold. The result is
          // the tennis MatchState (the only Sport Module today): set
          // scores, or games when no set was completed.
          const isFinished = a.status === 'completed';
          const isMine = a.participants.some((p) => p.userId === myUserId);
          const teamNames = (team: 'A' | 'B') =>
            a.participants
              .filter((p) => p.team === team)
              .map((p) => p.displayName || p.username || p.guestName)
              .join(' / ');
          const result = isFinished ? (a.result as Partial<MatchState> | undefined) : undefined;
          const sideScore = (team: 'A' | 'B') =>
            result?.completedSets?.length ? result.completedSets.map((set) => set[team]).join(' ') : result?.games?.[team];
          const config = a.config as Partial<MatchConfig> | undefined;
          return (
            <MatchCard
              key={a.id}
              status={a.status}
              matchup={activityParticipantNames(a)}
              queueNumber={a.status === 'queued' ? queuedActivities.indexOf(a) + 1 : undefined}
              isMine={isMine}
              // No live score is loaded here (it streams to the match screen
              // only), so a live card shows the matchup.
              sides={
                a.status === 'live'
                  ? undefined
                  : [
                      { names: teamNames('A'), games: sideScore('A'), winner: result?.winner === 'A' },
                      { names: teamNames('B'), games: sideScore('B'), winner: result?.winner === 'B' },
                    ]
              }
              statusLabel={
                a.status === 'queued'
                  ? t('activityStatusQueued')
                  : a.status === 'live'
                    ? config?.matchFormat
                      ? matchFormatShort(config.matchFormat, t)
                      : t('activityStatusLive')
                    : a.completedAt
                      ? new Date(a.completedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
                      : t('activityStatusCompleted')
              }
              onPress={isFinished ? () => onOpenMatch(a.id) : undefined}
              action={
                canStart ? (
                  <Button size="sm" onPress={() => onOpenMatch(a.id)}>
                    <ButtonText>{t('activityStart')}</ButtonText>
                  </Button>
                ) : canWatch ? (
                  <MatchWatchLink label={isLiveScorer ? t('activityResume') : t('activityWatch')} onPress={() => onOpenMatch(a.id)} />
                ) : undefined
              }
            />
          );
        })
      )}
    </VStack>
  );
}
