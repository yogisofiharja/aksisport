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
import { createActivity, listActivities } from '../../core/activities/api';
import { getSession, listParticipants } from '../../core/sessions/api';
import type { ActivityDetail, Session, SessionParticipant } from '../../core/api/types';
import type { MatchConfig, MatchFormat, MatchMode, Player, Team } from '../../sports/tennis/scoringEngine';
import { minParticipants } from '../../sports/tennis/rules';
import { firstCheckedInPolicy } from '../../core/sessions/scheduler';
import { availableToPlay, generateFairRound, suggestedMatchCount, type GeneratedMatch } from '../../core/sessions/matchGenerator';
import { buildGeneratedMatchPayload, buildServiceOrder, participantLabel } from '../../core/activities/buildGeneratedMatchPayload';

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

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (next: number) => void }) {
  return (
    <HStack space="sm">
      <Pressable
        onPress={() => value > min && onChange(value - 1)}
        className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 items-center justify-center active:opacity-60"
      >
        <Typography variant="label" className="text-lg">
          −
        </Typography>
      </Pressable>
      <Typography variant="label" className="w-8 text-center">
        {value}
      </Typography>
      <Pressable
        onPress={() => value < max && onChange(value + 1)}
        className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 items-center justify-center active:opacity-60"
      >
        <Typography variant="label" className="text-lg">
          +
        </Typography>
      </Pressable>
    </HStack>
  );
}

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

  // Custom Match's own mode — user-changeable, seeded from the Session's
  // mode but not locked to it (unlike Generate Matches, which always uses
  // the Session's own mode).
  const [customMode, setCustomMode] = useState<MatchMode>('single');
  const [assignedOrder, setAssignedOrder] = useState<string[]>([]);
  const [firstServerId, setFirstServerId] = useState<string | null>(null);
  const [suggestionReason, setSuggestionReason] = useState<string | null>(null);

  const [matchFormat, setMatchFormat] = useState<MatchFormat>({ type: 'open' });
  const [singleDeuceSuddenDeath, setSingleDeuceSuddenDeath] = useState(true);
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
      setFirstServerId(suggestion.participantIds[0] ?? null);
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
        // DP-004: seed the format picker from the session's default, if
        // one is set. Opaque on the wire — cast, not validated, matching
        // how Activity.config is already treated everywhere else.
        if (sess.defaultMatchFormat) {
          setMatchFormat(sess.defaultMatchFormat as MatchFormat);
        }
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

  // Memoized on participants/activities specifically (not recomputed every
  // render) — the round preview below uses Math.random() to break
  // fairness ties, so if these were re-derived on every render (e.g.
  // toggling the deuce switch), the preview would re-shuffle for no reason.
  const checkedIn = useMemo(() => participants.filter((p) => p.status === 'checked_in'), [participants]);
  const busyActivities = useMemo(() => activities.filter((a) => a.status === 'queued' || a.status === 'live'), [activities]);

  const round = useMemo(
    () => generateFairRound(checkedIn, busyActivities, activities, needed, matchCount),
    [checkedIn, busyActivities, activities, needed, matchCount]
  );
  const availableCount = availableToPlay(checkedIn, busyActivities).length;

  function findCheckedIn(id: string): SessionParticipant | undefined {
    return checkedIn.find((p) => p.id === id);
  }

  function matchLabel(m: GeneratedMatch): string {
    const names = m.participantIds.map((id) => participantLabel(findCheckedIn(id) ?? ({} as SessionParticipant)));
    if (needed === 2) return `${names[0]} ${t('activityVersus')} ${names[1]}`;
    return `${names[0]} / ${names[1]} ${t('activityVersus')} ${names[2]} / ${names[3]}`;
  }

  // --- Custom Match (original manual flow, unchanged logic) ---
  const perTeam = customMode === 'double' ? 2 : 1;
  const maxAssigned = minParticipants(customMode);
  const isFull = assignedOrder.length === maxAssigned;
  const canCreateCustom = isFull && Boolean(firstServerId) && !submitting;

  function getSide(id: string): 'A' | 'B' | null {
    const idx = assignedOrder.indexOf(id);
    if (idx === -1) return null;
    return idx < perTeam ? 'A' : 'B';
  }

  function handleModeChange(next: MatchMode) {
    if (next === customMode) return;
    setCustomMode(next);
    setAssignedOrder([]);
    setFirstServerId(null);
    applySuggestion(next, participants, activities, session?.sport ?? 'tennis');
  }

  function handleTap(id: string) {
    setSuggestionReason(null);
    if (assignedOrder.includes(id)) {
      setAssignedOrder((prev) => prev.filter((p) => p !== id));
      if (firstServerId === id) setFirstServerId(null);
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
      const assigned = assignedOrder.map((id) => checkedIn.find((p) => p.id === id)!);
      const players: Player[] = assigned.map((p, i) => ({
        id: p.id,
        name: participantLabel(p),
        team: (i < perTeam ? 'A' : 'B') as Team,
      }));
      const config: MatchConfig = {
        mode: customMode,
        deuceMode: singleDeuceSuddenDeath ? 'singleDeuceSuddenDeath' : 'standard',
        players,
        serviceOrderPlayerIds: buildServiceOrder(players, firstServerId!),
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

  // --- Generate Matches (fair, checked-in-based, organizer-sized batch) ---
  async function handleGenerateRound() {
    if (round.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      // Sequential, not Promise.all — keeps queue order matching the
      // previewed order (created_at determines display order).
      for (const m of round) {
        const { config, participants: parts } = buildGeneratedMatchPayload(m, sessionMode, matchFormat, singleDeuceSuddenDeath, checkedIn);
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

      <Typography variant="display">{t('activityAddTitle')}</Typography>

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
              className={`flex-1 py-2.5 rounded-xl items-center ${tab === value ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}
              onPress={() => setTab(value)}
            >
              <Typography variant="label" className={tab === value ? 'text-white' : ''} color={tab === value ? 'default' : 'muted'}>
                {label}
              </Typography>
            </Pressable>
          ))}
        </HStack>
      )}

      {tab === 'generateRound' && (
        <>
          <Card padding="none">
            <Typography variant="caption" color="muted" className="px-5 pt-4 pb-2">
              {t('activityMatchCountLabel')}
            </Typography>
            <Divider />
            <VStack className="px-5 py-4" space="xs">
              <Pressable
                className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800"
                onPress={() => setShowMatchCountPicker((shown) => !shown)}
              >
                <Typography variant="label">{t('activityMatchCountValue', matchCount)}</Typography>
              </Pressable>
              {showMatchCountPicker && (
                <>
                  <Picker
                    selectedValue={matchCount}
                    onValueChange={(next) => {
                      setMatchCount(Number(next));
                      if (Platform.OS === 'android') setShowMatchCountPicker(false);
                    }}
                    style={Platform.OS === 'android' ? { color: isDark ? '#f1f5f9' : '#0f172a' } : undefined}
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
                      <Typography variant="label" className="text-blue-600">
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

          <Card padding="none">
            <Typography variant="caption" color="muted" className="px-5 pt-4 pb-2">
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
            <Typography variant="caption" color="muted" className="px-5 pt-4 pb-2">
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
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-600'
                      : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600'
                  }`}
                >
                  <Typography variant="label" className={customMode === m ? 'text-blue-600' : ''}>
                    {modeLabel(m)}
                  </Typography>
                </Pressable>
              ))}
            </HStack>
          </Card>

          <Card padding="none">
            <HStack className="px-5 pt-4 pb-2 justify-between items-center">
              <Typography variant="caption" color="muted">
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
            {checkedIn.length === 0 ? (
              <Typography variant="body" color="muted" className="px-5 py-4">
                {t('activityNoCheckedIn')}
              </Typography>
            ) : (
              <HStack className="px-5 py-4 flex-wrap gap-2" space="sm" style={{ flexWrap: 'wrap' }}>
                {checkedIn.map((p) => {
                  const side = getSide(p.id);
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => handleTap(p.id)}
                      className={`px-4 py-2.5 rounded-full border-[1.5px] ${
                        side === 'A'
                          ? 'bg-blue-600 border-blue-600'
                          : side === 'B'
                            ? 'bg-red-600 border-red-600'
                            : 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600'
                      }`}
                    >
                      <Typography variant="label" className={side ? 'text-white' : ''}>
                        {participantLabel(p)}
                      </Typography>
                    </Pressable>
                  );
                })}
              </HStack>
            )}
            {!isFull && assignedOrder.length > 0 && (
              <Typography variant="body" className="px-5 pb-4 text-sm text-amber-600">
                {t('activityNeedParticipants', maxAssigned, customMode, assignedOrder.length)}
              </Typography>
            )}
          </Card>

          {isFull && (
            <Card padding="none">
              <Typography variant="caption" color="muted" className="px-5 pt-4 pb-2">
                {t('firstServer')}
              </Typography>
              <Divider />
              <HStack className="px-5 py-4 flex-wrap gap-2" space="sm" style={{ flexWrap: 'wrap' }}>
                {assignedOrder.map((id) => {
                  const p = checkedIn.find((cp) => cp.id === id)!;
                  const active = firstServerId === id;
                  return (
                    <Pressable
                      key={id}
                      onPress={() => setFirstServerId(id)}
                      className={`px-4 py-2.5 rounded-full border-[1.5px] ${
                        active ? 'bg-teal-600 border-teal-600' : 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600'
                      }`}
                    >
                      <Typography variant="label" className={active ? 'text-white' : ''}>
                        {participantLabel(p)}
                      </Typography>
                    </Pressable>
                  );
                })}
              </HStack>
            </Card>
          )}
        </>
      )}

      <Card padding="none">
        <Typography variant="caption" color="muted" className="px-5 pt-4 pb-2">
          {t('matchFormat')}
        </Typography>
        <Divider />
        <VStack className="px-5 py-4 gap-2" space="sm">
          <Pressable
            onPress={() => setMatchFormat({ type: 'open' })}
            className={`py-3 px-4 rounded-xl border-2 ${
              matchFormat.type === 'open'
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-600'
                : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600'
            }`}
          >
            <Typography variant="label" className={matchFormat.type === 'open' ? 'text-blue-600' : ''}>
              {t('formatOpen')}
            </Typography>
          </Pressable>

          <Pressable
            onPress={() => setMatchFormat({ type: 'fixed-games', totalGames: 4, goldenGameOnTie: false })}
            className={`py-3 px-4 rounded-xl border-2 ${
              matchFormat.type === 'fixed-games'
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-600'
                : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600'
            }`}
          >
            <Typography variant="label" className={matchFormat.type === 'fixed-games' ? 'text-blue-600' : ''}>
              {t('formatFixedGames')}
            </Typography>
          </Pressable>
          {matchFormat.type === 'fixed-games' && (
            <VStack className="gap-3 pl-2" space="sm">
              <HStack className="justify-between items-center">
                <Typography variant="label">{t('totalGames')}</Typography>
                <Stepper
                  value={matchFormat.totalGames}
                  min={2}
                  max={20}
                  onChange={(n) => setMatchFormat({ ...matchFormat, totalGames: n })}
                />
              </HStack>
              <HStack className="justify-between items-center gap-4">
                <VStack className="flex-1 gap-1" space="xs" style={{ flex: 1 }}>
                  <Typography variant="label">{t('goldenGame')}</Typography>
                  <Typography variant="body" color="muted" className="text-sm">
                    {t('goldenGameDesc')}
                  </Typography>
                </VStack>
                <Switch
                  value={matchFormat.goldenGameOnTie}
                  onValueChange={(v) => setMatchFormat({ ...matchFormat, goldenGameOnTie: v })}
                />
              </HStack>
            </VStack>
          )}

          <Pressable
            onPress={() => setMatchFormat({ type: 'race-to', raceTo: 4 })}
            className={`py-3 px-4 rounded-xl border-2 ${
              matchFormat.type === 'race-to'
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-600'
                : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600'
            }`}
          >
            <Typography variant="label" className={matchFormat.type === 'race-to' ? 'text-blue-600' : ''}>
              {t('formatRaceTo')}
            </Typography>
          </Pressable>
          {matchFormat.type === 'race-to' && (
            <VStack className="gap-3 pl-2" space="sm">
              <HStack className="justify-between items-center">
                <Typography variant="label">{t('targetGames')}</Typography>
                <Stepper value={matchFormat.raceTo} min={1} max={20} onChange={(n) => setMatchFormat({ ...matchFormat, raceTo: n })} />
              </HStack>
            </VStack>
          )}

          <Pressable
            onPress={() => setMatchFormat({ type: 'best-of-sets', setsToWin: 2, superTiebreak: false })}
            className={`py-3 px-4 rounded-xl border-2 ${
              matchFormat.type === 'best-of-sets'
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-600'
                : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600'
            }`}
          >
            <Typography variant="label" className={matchFormat.type === 'best-of-sets' ? 'text-blue-600' : ''}>
              {t('regularTab')}
            </Typography>
          </Pressable>
          {matchFormat.type === 'best-of-sets' && (
            <VStack className="gap-3 pl-2" space="sm">
              <HStack className="justify-between items-center">
                <Typography variant="label">{t('setsToWin')}</Typography>
                <HStack space="sm">
                  {([1, 2, 3] as const).map((n) => {
                    const active = matchFormat.type === 'best-of-sets' && matchFormat.setsToWin === n;
                    return (
                      <Pressable
                        key={n}
                        onPress={() => setMatchFormat({ type: 'best-of-sets', setsToWin: n, superTiebreak: n === 1 ? false : matchFormat.superTiebreak })}
                        className={`w-9 h-9 rounded-full items-center justify-center ${active ? 'bg-blue-600' : 'bg-slate-100 dark:bg-slate-700'}`}
                      >
                        <Typography variant="label" className={active ? 'text-white' : ''}>
                          {n}
                        </Typography>
                      </Pressable>
                    );
                  })}
                </HStack>
              </HStack>
              {matchFormat.setsToWin > 1 && (
                <HStack className="justify-between items-center gap-4">
                  <VStack className="flex-1 gap-1" space="xs" style={{ flex: 1 }}>
                    <Typography variant="label">{t('superTiebreak')}</Typography>
                    <Typography variant="body" color="muted" className="text-sm">
                      {t('superTiebreakDesc')}
                    </Typography>
                  </VStack>
                  <Switch
                    value={matchFormat.superTiebreak}
                    onValueChange={(v) => setMatchFormat({ ...matchFormat, superTiebreak: v })}
                  />
                </HStack>
              )}
            </VStack>
          )}
        </VStack>
      </Card>

      <Card padding="none">
        <HStack className="px-5 py-4 justify-between items-center gap-4">
          <VStack className="flex-1 gap-1" space="xs" style={{ flex: 1 }}>
            <Typography variant="label">{t('singleDeuce')}</Typography>
            <Typography variant="body" color="muted" className="text-sm">
              {t('singleDeuceDesc')}
            </Typography>
          </VStack>
          <Switch value={singleDeuceSuddenDeath} onValueChange={setSingleDeuceSuddenDeath} />
        </HStack>
      </Card>

      {error && (
        <Typography variant="body" color="destructive" className="text-sm">
          {error}
        </Typography>
      )}

      {tab === 'generateRound' && (
        <Button size="xl" action="secondary" isDisabled={round.length === 0} loading={submitting} className="w-full" onPress={handleGenerateRound}>
          <ButtonText action="secondary">{t('activityGenerateMatchesSubmit')}</ButtonText>
        </Button>
      )}
      {tab === 'custom' && (
        <Button size="xl" action="secondary" isDisabled={!canCreateCustom} loading={submitting} className="w-full" onPress={handleSubmitCustom}>
          <ButtonText action="secondary">{t('activityCreate')}</ButtonText>
        </Button>
      )}
    </ScrollPage>
  );
}
