import { useState } from 'react';
import { MatchCard, MatchWatchLink } from '../../../design-system/domain-ui/MatchCard';
import { Switch } from '../../../design-system/ui/Switch';
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
  /** The Session's umpire (DP-023): the only one who starts matches. */
  isUmpire: boolean;
  isSessionActive: boolean;
  /** Completed: the tab is Results. */
  isCompleted: boolean;
  matchesOpen: boolean;
  canRegenerate: boolean;
  busy: boolean;
  myUserId?: string;
  myParticipant?: SessionParticipant;
  onRegenerate: () => void;
  onAddMatch: () => void;
  onOpenMatch: (activityId: string) => void;
  /** Share a finished match's card (DP-026). */
  onShareMatch: (activity: ActivityDetail) => void;
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
  isUmpire,
  isSessionActive,
  isCompleted,
  matchesOpen,
  canRegenerate,
  busy,
  myUserId,
  myParticipant,
  onRegenerate,
  onAddMatch,
  onOpenMatch,
  onShareMatch,
}: Props) {
  const { t } = useTranslation();
  // DP-026: every match by default; "My matches only" narrows the list.
  // A filter for this visit only — not saved.
  const [mineOnly, setMineOnly] = useState(false);
  const isMineMatch = (a: ActivityDetail) => a.participants.some((p) => p.userId === myUserId);
  // Results (a Completed Session): ended matches first — finished or
  // Unfinished (DP-025) — newest on top, then the rest in queue order.
  const ended = (a: ActivityDetail) => a.status === 'completed' || a.status === 'unfinished';
  const ordered = isCompleted
    ? [
        ...activities.filter(ended).sort((x, y) => (y.completedAt ?? '').localeCompare(x.completedAt ?? '')),
        ...activities.filter((a) => !ended(a)),
      ]
    : activities;
  const shown = mineOnly ? ordered.filter(isMineMatch) : ordered;
  const queuedActivities = activities.filter((a) => a.status === 'queued');
  // Only the viewer's next match is "YOUR MATCH"; their later ones are
  // ordinary queued rows with their name in bold. Once the Session is
  // Completed nothing is next: every queued row is plain.
  const myNextMatchId = isCompleted ? undefined : queuedActivities.find((a) => a.participants.some((p) => p.userId === myUserId))?.id;

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
        <Text className="text-sm font-extrabold text-ink-muted dark:text-ink-muted-dark tracking-widest uppercase">{isCompleted ? t('sessionTabResults') : t('activityQueueTitle')}</Text>
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
      {/* Always in the same place, on or off, once there are matches. */}
      {activities.length > 0 && myUserId && (
        <HStack className="justify-between items-center min-h-[44px] mb-1">
          <Text className="text-sm font-bold text-ink dark:text-ink-dark">{t('myMatchesOnly')}</Text>
          <Switch value={mineOnly} onValueChange={setMineOnly} accessibilityLabel={t('myMatchesOnly')} />
        </HStack>
      )}
      {activities.length === 0 ? (
        <Text className="text-ink-muted dark:text-ink-muted-dark">{t('activityEmptyQueue')}</Text>
      ) : (
        shown.map((a) => {
          // Only the Session's umpire starts matches, once they are open
          // (DP-022, DP-023) — not the players, not other organizers.
          const canStart = matchesOpen && a.status === 'queued' && isUmpire;
          // Any checked-in participant of the session can watch; the
          // umpire resumes theirs even when not checked in.
          const canWatch = isSessionActive && a.status === 'live' && (myParticipant?.status === 'checked_in' || isUmpire);
          const isLiveScorer = a.status === 'live' && a.scorerUserId === myUserId;
          // A finished match opens its result (score, Share) at any time;
          // the row shows each side's score, winner in bold. The result is
          // the tennis MatchState (the only Sport Module today): set
          // scores, or games when no set was completed.
          const isFinished = a.status === 'completed';
          // Stopped early (DP-025): its score so far and "Unfinished" — no
          // winner, no result to open, nothing to share.
          const isUnfinished = a.status === 'unfinished';
          const isMine = a.id === myNextMatchId;
          const me = a.participants.find((p) => p.userId === myUserId);
          const myName = me ? me.displayName || me.username || undefined : undefined;
          const teamNames = (team: 'A' | 'B') =>
            a.participants
              .filter((p) => p.team === team)
              .map((p) => p.displayName || p.username || p.guestName)
              .join(' / ');
          const result = isFinished || isUnfinished ? (a.result as Partial<MatchState> | undefined) : undefined;
          const endedAt = a.completedAt
            ? new Date(a.completedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
            : undefined;
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
              emphasis={a.status === 'queued' && !isMine && !isCompleted ? myName : undefined}
              // No live score is loaded here (it streams to the match screen
              // only), so a live card shows the matchup.
              sides={
                a.status === 'live'
                  ? undefined
                  : [
                      { names: teamNames('A'), games: sideScore('A'), winner: isFinished && result?.winner === 'A' },
                      { names: teamNames('B'), games: sideScore('B'), winner: isFinished && result?.winner === 'B' },
                    ]
              }
              statusLabel={
                a.status === 'queued'
                  ? t('activityStatusQueued')
                  : a.status === 'live'
                    ? config?.matchFormat
                      ? matchFormatShort(config.matchFormat, t)
                      : t('activityStatusLive')
                    : isUnfinished
                      ? [t('matchUnfinished'), endedAt].filter(Boolean).join(' · ')
                      : isFinished && result && !result.winner
                        ? // A Free Play match finished level (DP-025).
                          [t('matchDraw'), endedAt].filter(Boolean).join(' · ')
                        : (endedAt ?? t('activityStatusCompleted'))
              }
              onPress={isFinished ? () => onOpenMatch(a.id) : undefined}
              onShare={isFinished ? () => onShareMatch(a) : undefined}
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
