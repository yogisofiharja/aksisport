import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, Switch } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useColorScheme } from 'nativewind';
import { Page } from '../../design-system/layout/Page';
import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { VStack } from '../../design-system/layout/VStack';
import { HStack } from '../../design-system/layout/HStack';
import { Card } from '../../design-system/ui/Card';
import { Typography } from '../../design-system/ui/Typography';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { Icon } from '../../design-system/ui/Icon';
import { Divider } from '../../design-system/ui/Divider';
import { Loading } from '../../design-system/feedback/Loading';
import { useTranslation } from '../../i18n';
import { createActivity, deleteActivity, listActivities } from '../../core/activities/api';
import { getSession, listParticipants } from '../../core/sessions/api';
import type { ActivityDetail, Session, SessionParticipant } from '../../core/api/types';
import type { MatchConfig, MatchFormat, MatchMode, Player, Team } from '../../sports/tennis/scoringEngine';
import { minParticipants } from '../../sports/tennis/rules';
import { firstCheckedInPolicy } from '../../core/sessions/scheduler';
import { availableToPlay, generateFairRound, suggestedMatchCount, type GeneratedMatch } from '../../core/sessions/matchGenerator';
import { buildGeneratedMatchPayload, participantLabel } from '../../core/activities/buildGeneratedMatchPayload';
import { webSelectStyle } from '../../platform/webSelectStyle';

type Props = {
  sessionId: string;
  onBack: () => void;
  onCreated: () => void;
};

// "Generate Matches" uses the session's own mode (single/double) and fair,
// checked-in-based selection — no participant picker, the Session already
// defines who's here. "Custom Match" keeps the original manual flow
// (including the ability to pick a *different* one-off mode than the
// Session's, e.g. a custom Singles match inside a Doubles session) — only
// offered for 'single'/'double' Sessions alongside Generate Matches; a
// 'class' Session skips the tab picker entirely and goes straight to the
// Custom Match flow, unchanged. There is no separate "one match" tab —
// that was redundant with Custom Match's own suggested pre-fill, so it
// was removed; generating just one match is simply setting the count to 1.
type GenerationTab = 'generateRound' | 'custom';

const MAX_MATCH_COUNT = 30;
const MATCH_COUNT_OPTIONS = Array.from({ length: MAX_MATCH_COUNT }, (_, i) => i + 1);

export function AddMatchScreen({ sessionId, onBack, onCreated }: Props) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [session, setSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [activities, setActivities] = useState<ActivityDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<GenerationTab>('generateRound');
  const [matchCount, setMatchCount] = useState(4);
  const [showMatchCountPicker, setShowMatchCountPicker] = useState(false);
  // Generate Matches can also replace whatever's already queued in the
  // same action, instead of requiring a separate trip to
  // SessionDetailScreen's Regenerate link first — only offered when
  // there's actually a queue to replace. Deleting only ever touches
  // 'queued' matches (never live/completed), same as Regenerate.
  const [removeExisting, setRemoveExisting] = useState(false);
  // Bumped by the "Regenerate" preview action — not read inside the round
  // useMemo below, only listed as a dependency, purely to force a fresh
  // Math.random() shuffle without the organizer having to touch Match
  // Count or any other real input first.
  const [shuffleSeed, setShuffleSeed] = useState(0);

  // Custom Match's own mode — user-changeable, seeded from the Session's
  // mode but not locked to it (unlike Generate Matches, which always uses
  // the Session's own mode).
  const [customMode, setCustomMode] = useState<MatchMode>('single');
  const [assignedOrder, setAssignedOrder] = useState<string[]>([]);
  const [suggestionReason, setSuggestionReason] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // DP-005: suggest, never auto-create — this only pre-fills the same
  // participant-picker the organizer already reviews and can override.
  // Custom Match only — Generate Matches uses fair selection instead
  // (core/sessions/matchGenerator.ts), a deliberately different, stronger
  // rule than firstCheckedInPolicy's "earliest checked-in, no fairness."
  function applySuggestion(nextMode: MatchMode, parts: SessionParticipant[], acts: ActivityDetail[], sportId: string) {
    const suggestion = firstCheckedInPolicy.suggestNextMatch({
      checkedIn: parts.filter((p) => p.status === 'checked_in'),
      busyActivities: acts.filter((a) => a.status === 'queued' || a.status === 'live'),
      sport: sportId,
      mode: nextMode,
    });
    if (suggestion) {
      setAssignedOrder(suggestion.participantIds);
      setSuggestionReason(suggestion.reason);
    } else {
      setSuggestionReason(null);
    }
  }

  useEffect(() => {
    Promise.all([listParticipants(sessionId), getSession(sessionId), listActivities(sessionId)])
      .then(([parts, sess, acts]) => {
        setParticipants(parts);
        setActivities(acts);
        setSession(sess);
        const initialMode: MatchMode = sess.activityType === 'double' ? 'double' : 'single';
        setCustomMode(initialMode);
        setTab(sess.activityType === 'single' || sess.activityType === 'double' ? 'generateRound' : 'custom');
        setMatchCount(Math.min(MAX_MATCH_COUNT, suggestedMatchCount(sess.durationMinutes)));
        applySuggestion(initialMode, parts, acts, sess.sport);
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  const generationEligible = session?.activityType === 'single' || session?.activityType === 'double';
  const sessionMode: MatchMode = session?.activityType === 'double' ? 'double' : 'single';
  const needed = minParticipants(sessionMode);

  // Match Setup — configured once on the Session (CreateSessionScreen /
  // its Configuration tab), not reconfigured here every time a match is
  // generated. Undefined means a Session created before Match Setup
  // existed; the fallbacks match what this screen used to hardcode.
  const matchFormat: MatchFormat = (session?.defaultMatchFormat as MatchFormat) ?? { type: 'open' };
  const singleDeuceSuddenDeath = session?.defaultSingleDeuce ?? true;

  const queuedActivities = useMemo(() => activities.filter((a) => a.status === 'queued'), [activities]);
  const hasQueuedMatches = queuedActivities.length > 0;

  // Eligible for planning: a claimed spot (registered or checked_in), not
  // checked_in alone — matches can be planned before anyone's physically
  // checked in (core/sessions/matchGenerator.ts's module comment).
  // Actually starting a match still requires its own players be checked
  // in (SessionDetailScreen's canStart), unaffected by this.
  const schedulable = useMemo(
    () => participants.filter((p) => p.status === 'registered' || p.status === 'checked_in'),
    [participants]
  );
  // When "remove existing matches" is on, the preview (and the eventual
  // submit) treats already-queued matches as if they're already gone —
  // their players become available again, and those matches no longer
  // count toward anyone's play count/last-played for fairness purposes,
  // since they're about to be deleted and never actually happen.
  const effectiveActivities = useMemo(
    () => (removeExisting ? activities.filter((a) => a.status !== 'queued') : activities),
    [activities, removeExisting]
  );
  const busyActivities = useMemo(
    () => effectiveActivities.filter((a) => a.status === 'queued' || a.status === 'live'),
    [effectiveActivities]
  );

  const round = useMemo(
    () => generateFairRound(schedulable, busyActivities, effectiveActivities, needed, matchCount),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schedulable, busyActivities, effectiveActivities, needed, matchCount, shuffleSeed]
  );
  const availableCount = availableToPlay(schedulable, busyActivities).length;

  function findSchedulable(id: string): SessionParticipant | undefined {
    return schedulable.find((p) => p.id === id);
  }

  function matchLabel(m: GeneratedMatch): string {
    const names = m.participantIds.map((id) => participantLabel(findSchedulable(id) ?? ({} as SessionParticipant)));
    if (needed === 2) return `${names[0]} ${t('activityVersus')} ${names[1]}`;
    return `${names[0]} / ${names[1]} ${t('activityVersus')} ${names[2]} / ${names[3]}`;
  }

  // --- Custom Match (original manual flow, unchanged logic) ---
  const perTeam = customMode === 'double' ? 2 : 1;
  const maxAssigned = minParticipants(customMode);
  const isFull = assignedOrder.length === maxAssigned;
  const canCreateCustom = isFull && !submitting;

  function getSide(id: string): 'A' | 'B' | null {
    const idx = assignedOrder.indexOf(id);
    if (idx === -1) return null;
    return idx < perTeam ? 'A' : 'B';
  }

  function handleModeChange(next: MatchMode) {
    if (next === customMode) return;
    setCustomMode(next);
    setAssignedOrder([]);
    applySuggestion(next, participants, activities, session?.sport ?? 'tennis');
  }

  function handleTap(id: string) {
    setSuggestionReason(null);
    if (assignedOrder.includes(id)) {
      setAssignedOrder((prev) => prev.filter((p) => p !== id));
      return;
    }
    if (isFull) return;
    setAssignedOrder((prev) => [...prev, id]);
  }

  async function handleSubmitCustom() {
    if (!canCreateCustom) return;
    setSubmitting(true);
    setError(null);
    try {
      const assigned = assignedOrder.map((id) => schedulable.find((p) => p.id === id)!);
      const players: Player[] = assigned.map((p, i) => ({
        id: p.id,
        name: participantLabel(p),
        team: (i < perTeam ? 'A' : 'B') as Team,
      }));
      const config: MatchConfig = {
        mode: customMode,
        deuceMode: singleDeuceSuddenDeath ? 'singleDeuceSuddenDeath' : 'standard',
        players,
        matchFormat,
      };
      const participantInputs = assigned.map((p, i) => ({
        userId: p.userId,
        guestName: p.userId ? undefined : p.guestName,
        team: (i < perTeam ? 'A' : 'B') as Team,
      }));
      await createActivity(sessionId, config, participantInputs);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('authGenericError'));
    } finally {
      setSubmitting(false);
    }
  }

  // --- Generate Matches (fair, registered-or-checked-in pool, organizer-sized batch) ---
  async function handleGenerateRound() {
    if (round.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      // "Remove existing matches" was already factored into the round
      // preview above (effectiveActivities excludes queued matches) — the
      // actual deletion happens here, right before creating the
      // replacement batch, so a failure partway through creation doesn't
      // leave the queue in a half-deleted state with no replacement.
      if (removeExisting) {
        for (const a of queuedActivities) {
          await deleteActivity(a.id);
        }
      }
      // Sequential, not Promise.all — keeps queue order matching the
      // previewed order (created_at determines display order).
      for (const m of round) {
        const { config, participants: parts } = buildGeneratedMatchPayload(m, sessionMode, matchFormat, singleDeuceSuddenDeath, schedulable);
        await createActivity(sessionId, config, parts);
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('authGenericError'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !session) {
    return (
      <Page>
        <Loading fullScreen />
      </Page>
    );
  }

  const modeLabel = (m: MatchMode) => (m === 'single' ? t('single') : t('double'));

  return (
    <ScrollPage keyboardAvoiding gap="lg">
      <Pressable className="p-2 -ml-2 active:opacity-60 self-start" onPress={onBack}>
        <Icon name="arrow-back" size="lg" />
      </Pressable>

      <Typography variant="heading">{t('activityAddTitle')}</Typography>

      {generationEligible && (
        <HStack className="gap-2" space="sm">
          {(
            [
              ['generateRound', t('activityGenerateMatchesTab')],
              ['custom', t('activityCustomMatchTab')],
            ] as const
          ).map(([value, label]) => (
            <Pressable
              key={value}
              className={`flex-1 py-2.5 rounded-xl items-center ${tab === value ? 'bg-ink dark:bg-ink-dark' : 'bg-surface-sunken dark:bg-surface-sunken-dark'}`}
              onPress={() => setTab(value)}
            >
              <Typography variant="label" className={tab === value ? 'text-surface dark:text-surface-dark' : ''} color={tab === value ? 'default' : 'muted'}>
                {label}
              </Typography>
            </Pressable>
          ))}
        </HStack>
      )}

      {tab === 'generateRound' && (
        <>
          <Card padding="none">
            <Typography variant="overline" color="muted" className="px-5 pt-4 pb-2">
              {t('activityMatchCountLabel')}
            </Typography>
            <Divider />
            <VStack className="px-5 py-4" space="xs">
              {Platform.OS !== 'web' && (
                <Pressable
                  className="px-4 py-3 rounded-xl bg-surface-sunken dark:bg-surface-sunken-dark"
                  onPress={() => setShowMatchCountPicker((shown) => !shown)}
                >
                  <Typography variant="label">{t('activityMatchCountValue', matchCount)}</Typography>
                </Pressable>
              )}
              {(Platform.OS === 'web' || showMatchCountPicker) && (
                <>
                  <Picker
                    selectedValue={matchCount}
                    onValueChange={(next) => {
                      setMatchCount(Number(next));
                      if (Platform.OS === 'android') setShowMatchCountPicker(false);
                    }}
                    style={Platform.OS === 'android' ? { color: isDark ? '#f1f5f9' : '#0f172a' } : webSelectStyle(isDark)}
                    itemStyle={Platform.OS === 'ios' ? { color: isDark ? '#f1f5f9' : '#0f172a' } : undefined}
                    dropdownIconColor={isDark ? '#f1f5f9' : '#0f172a'}
                  >
                    {MATCH_COUNT_OPTIONS.map((n) => (
                      <Picker.Item
                        key={n}
                        label={t('activityMatchCountValue', n)}
                        value={n}
                        color={Platform.OS === 'ios' ? (isDark ? '#f1f5f9' : '#0f172a') : undefined}
                      />
                    ))}
                  </Picker>
                  {Platform.OS === 'ios' && (
                    <Pressable className="self-end px-4 py-2" onPress={() => setShowMatchCountPicker(false)}>
                      <Typography variant="label" className="text-heat-strong dark:text-heat-strong-dark">
                        {t('recurringScheduleTimeDone')}
                      </Typography>
                    </Pressable>
                  )}
                </>
              )}
              <Typography variant="body" color="muted" className="text-sm">
                {t('activityMatchCountHint')}
              </Typography>
            </VStack>
          </Card>

          {hasQueuedMatches && (
            <Card padding="none">
              <HStack className="px-5 py-4 justify-between items-center gap-4">
                <VStack className="flex-1 gap-1" space="xs" style={{ flex: 1 }}>
                  <Typography variant="label">{t('activityRemoveExistingLabel')}</Typography>
                  <Typography variant="body" color="muted" className="text-sm">
                    {t('activityRemoveExistingDesc', queuedActivities.length)}
                  </Typography>
                </VStack>
                <Switch value={removeExisting} onValueChange={setRemoveExisting} />
              </HStack>
            </Card>
          )}

          <Card padding="none">
            <Typography variant="overline" color="muted" className="px-5 pt-4 pb-2">
              {t('activityGenerateMatchesPreviewTitle')}
            </Typography>
            <Divider />
            {availableCount < needed ? (
              <Typography variant="body" color="muted" className="px-5 py-4">
                {t('activityGenerateMatchesEmpty')}
              </Typography>
            ) : (
              <VStack className="px-5 py-4" space="sm">
                <Typography variant="body" className="text-sm font-bold">
                  {t('activityGenerateMatchesCount', round.length)}
                </Typography>
                {round.map((m, i) => (
                  <Typography key={i} variant="body">
                    {matchLabel(m)}
                  </Typography>
                ))}
                <Typography variant="body" color="muted" className="text-sm">
                  {t('activityFairnessNote')}
                </Typography>
              </VStack>
            )}
          </Card>
        </>
      )}

      {tab === 'custom' && (
        <>
          <Card padding="none">
            <Typography variant="overline" color="muted" className="px-5 pt-4 pb-2">
              {t('matchType')}
            </Typography>
            <Divider />
            <HStack className="px-5 py-4 gap-3" space="md">
              {(['single', 'double'] as const).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => handleModeChange(m)}
                  className={`flex-1 py-4 rounded-xl items-center border-2 ${
                    customMode === m
                      ? 'bg-heat-tint dark:bg-heat-tint-dark border-heat'
                      : 'bg-surface dark:bg-surface-dark border-border dark:border-border-dark'
                  }`}
                >
                  <Typography variant="label" className={customMode === m ? 'text-heat-strong dark:text-heat-strong-dark' : ''}>
                    {modeLabel(m)}
                  </Typography>
                </Pressable>
              ))}
            </HStack>
          </Card>

          <Card padding="none">
            <HStack className="px-5 pt-4 pb-2 justify-between items-center">
              <Typography variant="overline" color="muted">
                {t('activityPickParticipants')}
              </Typography>
              <Typography variant="label" color="muted">
                {assignedOrder.length} / {maxAssigned}
              </Typography>
            </HStack>
            {suggestionReason && (
              <Typography variant="body" className="px-5 pb-2 text-sm text-teal-600 dark:text-teal-400">
                {t('schedulerSuggested')}: {t(suggestionReason)}
              </Typography>
            )}
            <Divider />
            {schedulable.length === 0 ? (
              <Typography variant="body" color="muted" className="px-5 py-4">
                {t('activityNoCheckedIn')}
              </Typography>
            ) : (
              <HStack className="px-5 py-4 flex-wrap gap-2" space="sm" style={{ flexWrap: 'wrap' }}>
                {schedulable.map((p) => {
                  const side = getSide(p.id);
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => handleTap(p.id)}
                      className={`px-4 py-2.5 rounded-full border-[1.5px] ${
                        side === 'A'
                          ? 'bg-ink dark:bg-ink-dark border-ink dark:border-ink-dark'
                          : side === 'B'
                            ? 'bg-red-600 border-red-600'
                            : 'bg-surface-sunken dark:bg-surface-sunken-dark border-border dark:border-border-dark'
                      }`}
                    >
                      <Typography variant="label" className={side ? 'text-surface dark:text-surface-dark' : ''}>
                        {participantLabel(p)}
                      </Typography>
                    </Pressable>
                  );
                })}
              </HStack>
            )}
            {!isFull && assignedOrder.length > 0 && (
              <Typography variant="body" className="px-5 pb-4 text-sm text-heat-strong dark:text-heat-strong-dark">
                {t('activityNeedParticipants', maxAssigned, customMode, assignedOrder.length)}
              </Typography>
            )}
          </Card>

        </>
      )}

      {error && (
        <Typography variant="body" color="destructive" className="text-sm">
          {error}
        </Typography>
      )}

      {tab === 'generateRound' && (
        <HStack className="gap-3" space="sm">
          <Button
            size="xl"
            variant="outline"
            isDisabled={round.length === 0 || submitting}
            className="flex-1"
            onPress={() => setShuffleSeed((s) => s + 1)}
          >
            <ButtonText variant="outline">
              {t('activityRegeneratePreview')}
            </ButtonText>
          </Button>
          <Button
            size="xl"
            isDisabled={round.length === 0}
            loading={submitting}
            className="flex-1"
            onPress={handleGenerateRound}
          >
            <ButtonText>{t('activityApproveMatches')}</ButtonText>
          </Button>
        </HStack>
      )}
      {tab === 'custom' && (
        <Button size="xl" isDisabled={!canCreateCustom} loading={submitting} className="w-full" onPress={handleSubmitCustom}>
          <ButtonText>{t('activityCreate')}</ButtonText>
        </Button>
      )}
    </ScrollPage>
  );
}
