import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Switch, ActivityIndicator } from 'react-native';
import { appAlert } from '../../design-system/feedback/appAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '../../platform/DateTimePicker';
import { Picker } from '@react-native-picker/picker';
import { useColorScheme } from 'nativewind';
import { Icon } from '../../design-system/ui/Icon';
import { Button, ButtonText } from '../../../components/ui/button';
import { Box, VStack, HStack } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import { Input, InputField } from '../../../components/ui/input';
import { Pressable } from '../../../components/ui/pressable';
import { useTranslation } from '../../i18n';
import { createSession, getSession, publishSession, updateSession } from '../../core/sessions/api';
import {
  createRecurringSchedule,
  getRecurringSchedule,
  previewSessionSync,
  syncGeneratedSessions,
  updateRecurringSchedule,
} from '../../core/recurringSchedules/api';
import { listSkillLevels } from '../../core/skillLevels/api';
import { formatSessionDateTime } from '../../core/sessions/sessionSchedule';
import { formatIDR } from '../../core/currency';
import type { PriceModel, RecurringSchedule, Session, SkillLevel } from '../../core/api/types';
import type { MatchFormat } from '../../sports/tennis/scoringEngine';
import { matchFormatSummary } from '../../core/sessions/matchFormatSummary';
import { listSportIds, getSportModule } from '../../sports/registry';
import { weekdayLabel } from '../recurringSchedules/weekday';
import { SkillLevelRangePicker, type SkillLevelRangeValue } from '../skillLevels/SkillLevelRangePicker';

type Props = {
  clubId: string;
  onBack: () => void;
  onSessionCreated: (session: Session) => void;
  onScheduleCreated: (schedule: RecurringSchedule) => void;
  // Club > Recurring Schedules > Create lands here with the toggle
  // pre-flipped; Club > Sessions > Create starts as a one-off.
  initialRecurring?: boolean;
  // Milestone 2: when set, edits this existing (Draft) Session instead of
  // creating a new one. Sport and the recurring toggle are hidden — both
  // immutable after creation (changing an ad-hoc Session's sport would
  // orphan any already-set skill level requirement, which is scoped to a
  // sport; DP-007 already treats a generated Session's schedule link as
  // fixed at creation). Submit calls updateSession() + onSessionUpdated()
  // instead of createSession()/onSessionCreated().
  editingSessionId?: string;
  onSessionUpdated?: (session: Session) => void;
  // DP-007 Schedule Editing: when set, edits this existing Recurring
  // Schedule (needs clubId, unlike editingSessionId). Same immutables as
  // Session editing — sport and the recurring toggle are hidden. After
  // saving, offers to push the Template to already-generated upcoming
  // Sessions (Session Synchronization) before calling onScheduleUpdated().
  editingScheduleId?: string;
  onScheduleUpdated?: () => void;
};

const DEFAULT_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
// 1-24 hours, hourly increments (v0.6.0) — no tournament-length Sessions yet.
const DURATION_OPTIONS_HOURS = Array.from({ length: 24 }, (_, i) => i + 1);

// Was a hardcoded 08:00 regardless of the current time — harmless most of
// the day, but if "now" is already past 08:00 (e.g. 23:37), the default
// starts_at landed in the past the instant the form opened, immediately
// failing the "date/time cannot be in the past" validation before the
// organizer had touched anything. Rounds up to the next whole hour from
// now instead — rolls into tomorrow correctly via normal Date arithmetic
// (setHours(24) auto-normalizes to 00:00 the next day).
function defaultStartsAt() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

function formatHHMM(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function activityTypeLabel(id: string, t: (key: string) => string): string {
  if (id === 'single') return t('activityTypeSingle');
  if (id === 'double') return t('activityTypeDouble');
  if (id === 'class') return t('activityTypeClass');
  return id;
}

// Milestone 2 — Preview step: read-only label/value row, same shape as
// SessionDetailScreen's Details card.
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <HStack className="justify-between">
      <Text className="text-slate-500 dark:text-slate-400">{label}</Text>
      <Text className="font-bold text-slate-900 dark:text-white">{value}</Text>
    </HStack>
  );
}

// Match Setup's numeric fields (Total Games / Target Games / Sets to Win) —
// same +/- control AddMatchScreen used to offer, just built on this
// screen's own `components/ui` primitives instead of design-system's (the
// two sets are never mixed in one file).
function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (next: number) => void }) {
  return (
    <HStack className="items-center gap-3">
      <Pressable
        onPress={() => value > min && onChange(value - 1)}
        className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 items-center justify-center active:opacity-60"
      >
        <Text className="text-lg font-bold text-slate-900 dark:text-white">−</Text>
      </Pressable>
      <Text className="w-8 text-center font-bold text-slate-900 dark:text-white">{value}</Text>
      <Pressable
        onPress={() => value < max && onChange(value + 1)}
        className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 items-center justify-center active:opacity-60"
      >
        <Text className="text-lg font-bold text-slate-900 dark:text-white">+</Text>
      </Pressable>
    </HStack>
  );
}

export function CreateSessionScreen({
  clubId,
  onBack,
  onSessionCreated,
  onScheduleCreated,
  initialRecurring,
  editingSessionId,
  onSessionUpdated,
  editingScheduleId,
  onScheduleUpdated,
}: Props) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isEditing = Boolean(editingSessionId);
  const isEditingSchedule = Boolean(editingScheduleId);

  const sports = listSportIds();
  const [sport, setSport] = useState(sports[0] ?? 'tennis');
  const activityTypes = getSportModule(sport)?.activityTypes ?? [];
  const [activityType, setActivityType] = useState<string | undefined>(activityTypes[0]);

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('');
  const [hostPlaying, setHostPlaying] = useState(true);
  const [isRecurring, setIsRecurring] = useState(Boolean(initialRecurring) || isEditingSchedule);

  // Ad-hoc: a specific date. Recurring: a weekday instead.
  const [date, setDate] = useState(defaultStartsAt);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [weekday, setWeekday] = useState(6); // Saturday default
  const [generationLeadDays, setGenerationLeadDays] = useState('3');
  // Kept as loaded when editing a Schedule — re-saving from a phone in
  // another timezone must not silently shift every future occurrence.
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);

  // Both modes need a time-of-day.
  const [time, setTime] = useState(defaultStartsAt);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [durationHours, setDurationHours] = useState(1);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const durationMinutes = durationHours * 60;
  // DP-008 v0.7.0: optional by default — the range section is hidden
  // until the organizer opts in, matching every other optional field's
  // collapsed-by-default treatment.
  const [requireSkillLevel, setRequireSkillLevel] = useState(false);
  const [skillLevelRange, setSkillLevelRange] = useState<SkillLevelRangeValue>({});
  // Payments: "free" by default — pricePerPerson/totalPrice are plain
  // text inputs (kept as strings, parsed on validate, same convention as
  // maxParticipants) since only one is ever relevant, depending on
  // priceModel.
  const [priceModel, setPriceModel] = useState<PriceModel>('free');
  const [pricePerPerson, setPricePerPerson] = useState('');
  const [totalPrice, setTotalPrice] = useState('');
  // Match Setup: how matches generated from this Session are scored —
  // defined once here instead of being reconfigured every time a match is
  // generated (AddMatchScreen now just reads session.defaultMatchFormat/
  // defaultSingleDeuce). Same defaults AddMatchScreen used to seed itself
  // with, so a Session that never touches this section behaves exactly as
  // before.
  const [matchFormat, setMatchFormat] = useState<MatchFormat>({ type: 'open' });
  const [singleDeuceSuddenDeath, setSingleDeuceSuddenDeath] = useState(true);
  // Preview-only — resolves skillLevelRange's ids to names, same data
  // SkillLevelRangePicker fetches internally for its own pickers but
  // doesn't expose back to the caller.
  const [sportLevels, setSportLevels] = useState<SkillLevel[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Milestone 2: ad-hoc creation only (not editing, not recurring — a
  // Recurring Schedule has no draft/publish lifecycle at all, DP-007).
  // "Continue" validates and moves here instead of saving immediately —
  // nothing is persisted until Save as Draft/Publish is tapped from this
  // screen; Discard just navigates back, no API call, since there's
  // nothing to delete yet.
  const [showPreview, setShowPreview] = useState(false);

  const [loadingExisting, setLoadingExisting] = useState(isEditing || isEditingSchedule);

  useEffect(() => {
    if (!editingSessionId) return;
    setLoadingExisting(true);
    getSession(editingSessionId)
      .then((sess) => {
        setSport(sess.sport);
        setActivityType(sess.activityType);
        setName(sess.name ?? '');
        setLocation(sess.location ?? '');
        setDescription(sess.description ?? '');
        setMaxParticipants(sess.maxParticipants != null ? String(sess.maxParticipants) : '');
        setHostPlaying(sess.hostPlaying);
        setPriceModel(sess.priceModel);
        setPricePerPerson(sess.pricePerPerson != null ? String(sess.pricePerPerson) : '');
        setTotalPrice(sess.totalPrice != null ? String(sess.totalPrice) : '');
        if (sess.defaultMatchFormat) setMatchFormat(sess.defaultMatchFormat as MatchFormat);
        if (sess.defaultSingleDeuce != null) setSingleDeuceSuddenDeath(sess.defaultSingleDeuce);
        if (sess.startsAt) {
          const startsAt = new Date(sess.startsAt);
          setDate(startsAt);
          setTime(startsAt);
        }
        if (sess.durationMinutes) setDurationHours(sess.durationMinutes / 60);
        if (sess.skillLevelMinId && sess.skillLevelMaxId) {
          setRequireSkillLevel(true);
          setSkillLevelRange({
            skillLevelMinId: sess.skillLevelMinId,
            skillLevelMaxId: sess.skillLevelMaxId,
            skillLevelEnforcement: sess.skillLevelEnforcement,
          });
        }
      })
      .catch(() => {
        setError(t('authGenericError'));
      })
      .finally(() => setLoadingExisting(false));
  }, [editingSessionId]);

  useEffect(() => {
    if (!editingScheduleId) return;
    setLoadingExisting(true);
    getRecurringSchedule(clubId, editingScheduleId)
      .then((sched) => {
        setSport(sched.sport);
        setActivityType(sched.activityType);
        setName(sched.name ?? '');
        setLocation(sched.location ?? '');
        setDescription(sched.description ?? '');
        setMaxParticipants(sched.maxParticipants != null ? String(sched.maxParticipants) : '');
        setHostPlaying(sched.hostPlaying);
        setPriceModel(sched.priceModel);
        setPricePerPerson(sched.pricePerPerson != null ? String(sched.pricePerPerson) : '');
        setTotalPrice(sched.totalPrice != null ? String(sched.totalPrice) : '');
        if (sched.defaultMatchFormat) setMatchFormat(sched.defaultMatchFormat as MatchFormat);
        if (sched.defaultSingleDeuce != null) setSingleDeuceSuddenDeath(sched.defaultSingleDeuce);
        setWeekday(sched.recurrenceRule.weekday);
        const [hours, minutes] = sched.recurrenceRule.time.split(':').map(Number);
        const ruleTime = new Date();
        ruleTime.setHours(hours, minutes, 0, 0);
        setTime(ruleTime);
        setDurationHours(sched.recurrenceRule.durationMinutes / 60);
        setTimezone(sched.recurrenceRule.timezone);
        setGenerationLeadDays(String(sched.generationLeadDays));
        if (sched.skillLevelMinId && sched.skillLevelMaxId) {
          setRequireSkillLevel(true);
          setSkillLevelRange({
            skillLevelMinId: sched.skillLevelMinId,
            skillLevelMaxId: sched.skillLevelMaxId,
            skillLevelEnforcement: sched.skillLevelEnforcement,
          });
        }
      })
      .catch(() => {
        setError(t('authGenericError'));
      })
      .finally(() => setLoadingExisting(false));
  }, [clubId, editingScheduleId]);

  // Preview-only lookup for skillLevelRange's ids — only needed once the
  // requirement is actually on.
  useEffect(() => {
    if (!requireSkillLevel) return;
    listSkillLevels(sport)
      .then(setSportLevels)
      .catch(() => setSportLevels([]));
  }, [sport, requireSkillLevel]);

  function handleSelectSport(next: string) {
    setSport(next);
    setActivityType(getSportModule(next)?.activityTypes?.[0]);
  }

  function combinedStartsAt(): Date {
    const combined = new Date(date);
    combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
    return combined;
  }

  type Validated = {
    trimmedName: string;
    trimmedLocation: string;
    parsedMaxParticipants?: number;
    parsedPricePerPerson?: number;
    parsedTotalPrice?: number;
  };

  // Shared by every save path (edit, recurring, ad-hoc create/preview) —
  // previously duplicated inline in handleSubmit only, now also needed by
  // the preview step's own Save as Draft/Publish actions.
  function validate(): Validated | null {
    const trimmedName = name.trim();
    const trimmedLocation = location.trim();
    if (!trimmedName || !trimmedLocation) {
      setError(t('sessionNameLocationRequired'));
      return null;
    }
    if (!activityType) {
      setError(t('sessionActivityTypeRequired'));
      return null;
    }
    if (
      requireSkillLevel &&
      (!skillLevelRange.skillLevelMinId || !skillLevelRange.skillLevelMaxId || !skillLevelRange.skillLevelEnforcement)
    ) {
      setError(t('skillLevelRangeRequired'));
      return null;
    }
    const trimmedMaxParticipants = maxParticipants.trim();
    let parsedMaxParticipants: number | undefined;
    if (trimmedMaxParticipants) {
      parsedMaxParticipants = Number.parseInt(trimmedMaxParticipants, 10);
      if (Number.isNaN(parsedMaxParticipants) || parsedMaxParticipants < 1) {
        setError(t('sessionMaxParticipantsInvalid'));
        return null;
      }
    }
    // Recurring has no single literal date (a weekday rule generates
    // future occurrences) — the past check only applies to a concrete
    // ad-hoc date, which covers both create and edit.
    if (!isRecurring && combinedStartsAt().getTime() < Date.now()) {
      setError(t('sessionStartsAtPast'));
      return null;
    }
    let parsedPricePerPerson: number | undefined;
    let parsedTotalPrice: number | undefined;
    if (priceModel === 'per_person') {
      parsedPricePerPerson = Number.parseInt(pricePerPerson.trim(), 10);
      if (Number.isNaN(parsedPricePerPerson) || parsedPricePerPerson <= 0) {
        setError(t('sessionPricePerPersonInvalid'));
        return null;
      }
    } else if (priceModel === 'split_bill') {
      parsedTotalPrice = Number.parseInt(totalPrice.trim(), 10);
      if (Number.isNaN(parsedTotalPrice) || parsedTotalPrice <= 0) {
        setError(t('sessionTotalPriceInvalid'));
        return null;
      }
    }
    setError(null);
    return { trimmedName, trimmedLocation, parsedMaxParticipants, parsedPricePerPerson, parsedTotalPrice };
  }

  function buildSessionPayload(v: Validated) {
    return {
      name: v.trimmedName,
      location: v.trimmedLocation,
      description: description.trim() || undefined,
      maxParticipants: v.parsedMaxParticipants,
      activityType,
      hostPlaying,
      startsAt: combinedStartsAt().toISOString(),
      durationMinutes,
      priceModel,
      pricePerPerson: v.parsedPricePerPerson,
      totalPrice: v.parsedTotalPrice,
      defaultMatchFormat: matchFormat,
      defaultSingleDeuce: singleDeuceSuddenDeath,
      ...(requireSkillLevel ? skillLevelRange : {}),
    };
  }

  // Edit and Recurring Schedule creation still save directly — only
  // ad-hoc creation goes through the preview step below.
  async function handleSubmit() {
    if (submitting) return;
    const v = validate();
    if (!v) return;
    setSubmitting(true);
    setError(null);
    try {
      if (editingSessionId) {
        const updated = await updateSession(editingSessionId, buildSessionPayload(v));
        onSessionUpdated?.(updated);
      } else if (isRecurring) {
        const leadDays = Number.parseInt(generationLeadDays, 10);
        if (Number.isNaN(leadDays) || leadDays < 0) {
          setError(t('recurringScheduleLeadDaysInvalid'));
          setSubmitting(false);
          return;
        }
        const recurrenceRule = { weekday, time: formatHHMM(time), durationMinutes, timezone };
        const template = {
          name: v.trimmedName,
          location: v.trimmedLocation,
          description: description.trim() || undefined,
          maxParticipants: v.parsedMaxParticipants,
          activityType,
          hostPlaying,
          priceModel,
          pricePerPerson: v.parsedPricePerPerson,
          totalPrice: v.parsedTotalPrice,
          defaultMatchFormat: matchFormat,
          defaultSingleDeuce: singleDeuceSuddenDeath,
          ...(requireSkillLevel ? skillLevelRange : {}),
        };
        if (editingScheduleId) {
          await updateRecurringSchedule(clubId, editingScheduleId, {
            ...template,
            recurrenceRule,
            generationLeadDays: leadDays,
          });
          await offerSessionSync(editingScheduleId);
          return;
        }
        const schedule = await createRecurringSchedule(clubId, sport, recurrenceRule, leadDays, template);
        onScheduleCreated(schedule);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('authGenericError'));
    } finally {
      setSubmitting(false);
    }
  }

  // DP-007 Session Synchronization. The Schedule is already saved by the
  // time this runs, so declining (or a failed preview) still leaves future
  // occurrences on the new Template — only the already-generated upcoming
  // Sessions are the organizer's call. Nothing to ask when there are none.
  async function offerSessionSync(scheduleId: string) {
    let counts = { updated: 0, skippedEdited: 0 };
    try {
      counts = await previewSessionSync(clubId, scheduleId);
    } catch {
      // Fall through with zero counts: the save itself succeeded.
    }
    if (counts.updated === 0) {
      onScheduleUpdated?.();
      return;
    }
    const desc =
      t('recurringScheduleSyncDesc', counts.updated) +
      (counts.skippedEdited > 0 ? ` ${t('recurringScheduleSyncSkippedDesc', counts.skippedEdited)}` : '');
    appAlert(t('recurringScheduleSyncTitle'), desc, [
      { text: t('recurringScheduleSyncDecline'), style: 'cancel', onPress: () => onScheduleUpdated?.() },
      {
        text: t('recurringScheduleSyncConfirm'),
        onPress: async () => {
          try {
            await syncGeneratedSessions(clubId, scheduleId);
            onScheduleUpdated?.();
          } catch (err) {
            setError(err instanceof Error ? err.message : t('authGenericError'));
          }
        },
      },
    ]);
  }

  function handleContinue() {
    if (submitting) return;
    if (!validate()) return;
    setShowPreview(true);
  }

  async function doSaveAsDraft() {
    if (submitting) return;
    const v = validate();
    if (!v) return;
    setSubmitting(true);
    setError(null);
    try {
      const session = await createSession(clubId, sport, buildSessionPayload(v));
      onSessionCreated(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('authGenericError'));
    } finally {
      setSubmitting(false);
    }
  }

  async function doPublishNew() {
    if (submitting) return;
    const v = validate();
    if (!v) return;
    setSubmitting(true);
    setError(null);
    try {
      const session = await createSession(clubId, sport, buildSessionPayload(v));
      const published = await publishSession(session.id);
      onSessionCreated(published);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('authGenericError'));
    } finally {
      setSubmitting(false);
    }
  }

  // Nothing has been saved yet at this point — Discard is just leaving,
  // no API call. Confirmed anyway so an accidental tap doesn't silently
  // lose everything just typed in.
  function handleDiscardPreview() {
    appAlert(t('sessionPreviewDiscardConfirmTitle'), t('sessionPreviewDiscardConfirmDesc'), [
      { text: t('clubCancel'), style: 'cancel' },
      { text: t('sessionDiscard'), style: 'destructive', onPress: onBack },
    ]);
  }

  if (loadingExisting) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900 items-center justify-center">
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (showPreview) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
        <ScrollView contentContainerClassName="px-5 pt-4 pb-6 gap-5">
          <Pressable className="p-2 -ml-2 active:opacity-60 self-start" onPress={() => setShowPreview(false)}>
            <Icon name="arrow-back" size="lg" />
          </Pressable>

          <VStack className="gap-1">
            <Box className="bg-blue-100 dark:bg-blue-900/30 rounded-full px-2.5 py-1 self-start mb-1">
              <Text className="text-xs font-extrabold text-blue-700 dark:text-blue-300 tracking-wide">
                {t('sessionStatusDraft').toUpperCase()}
              </Text>
            </Box>
            <Text className="text-2xl font-black text-slate-900 dark:text-white">{name.trim()}</Text>
            {location.trim() && (
              <HStack className="items-center gap-1">
                <Icon name="location-outline" size="xs" color="muted" />
                <Text className="text-slate-500 dark:text-slate-400">{location.trim()}</Text>
              </HStack>
            )}
          </VStack>

          <Box className="bg-white dark:bg-slate-800 rounded-2xl p-4 gap-3">
            <VStack className="gap-2">
              <DetailRow label={t('sessionSportLabel')} value={sport === 'tennis' ? t('sportTennis') : sport} />
              {activityType && <DetailRow label={t('sessionActivityTypeLabel')} value={activityTypeLabel(activityType, t)} />}
              <DetailRow label={t('sessionDateLabel')} value={formatSessionDateTime(combinedStartsAt().toISOString()) ?? ''} />
              <DetailRow label={t('sessionDurationLabel')} value={t('sessionDurationHours', durationHours)} />
              <DetailRow
                label={t('sessionPreviewMaxParticipantsLabel')}
                value={maxParticipants.trim() ? maxParticipants.trim() : t('sessionPreviewCapacityUnlimited')}
              />
              <DetailRow
                label={t('sessionPriceLabel')}
                value={
                  priceModel === 'free'
                    ? t('sessionPriceFreeDisplay')
                    : priceModel === 'per_person'
                      ? (pricePerPerson.trim() ? t('sessionPricePerPersonDisplay', formatIDR(Number(pricePerPerson))) : '—')
                      : totalPrice.trim()
                        ? formatIDR(Number(totalPrice))
                        : '—'
                }
              />
              <DetailRow label={t('matchFormat')} value={matchFormatSummary(matchFormat, t)} />
              <DetailRow label={t('singleDeuce')} value={singleDeuceSuddenDeath ? t('sessionConfigOn') : t('sessionConfigOff')} />
              {requireSkillLevel && skillLevelRange.skillLevelMinId && skillLevelRange.skillLevelMaxId && skillLevelRange.skillLevelEnforcement && (
                <>
                  <DetailRow
                    label={t('skillLevelRangeLabel')}
                    value={`${sportLevels.find((l) => l.id === skillLevelRange.skillLevelMinId)?.name ?? t('skillLevelNotSet')}–${sportLevels.find((l) => l.id === skillLevelRange.skillLevelMaxId)?.name ?? t('skillLevelNotSet')}`}
                  />
                  <DetailRow
                    label={t('skillLevelEnforcementLabel')}
                    value={
                      skillLevelRange.skillLevelEnforcement === 'strict'
                        ? t('skillLevelEnforcementStrict')
                        : t('skillLevelEnforcementGuidance')
                    }
                  />
                </>
              )}
            </VStack>
          </Box>

          {description.trim() && (
            <Box className="bg-white dark:bg-slate-800 rounded-2xl p-4 gap-1">
              <Text className="text-sm font-extrabold text-slate-400 tracking-widest uppercase">
                {t('sessionDescriptionSectionTitle')}
              </Text>
              <Text className="text-slate-700 dark:text-slate-300">{description.trim()}</Text>
            </Box>
          )}

          {error && <Text className="text-sm text-red-500">{error}</Text>}

          <VStack className="gap-3">
            <Button action="secondary" size="lg" className="w-full rounded-2xl bg-blue-600" isDisabled={submitting} onPress={doPublishNew}>
              <ButtonText className="text-white">{t('sessionPublish')}</ButtonText>
            </Button>
            <Text className="text-center text-xs font-bold text-slate-400">{t('commonOr')}</Text>
            <Button
              variant="outline"
              action="secondary"
              size="lg"
              className="w-full rounded-2xl"
              isDisabled={submitting}
              onPress={doSaveAsDraft}
            >
              <ButtonText variant="outline" action="secondary">
                {t('sessionSaveAsDraft')}
              </ButtonText>
            </Button>

            <Box className="h-px bg-slate-200 dark:bg-slate-700 my-1" />

            <Pressable className="items-center py-2 active:opacity-60" onPress={handleDiscardPreview} disabled={submitting}>
              <Text className="text-red-500 font-bold">{t('sessionDiscard')}</Text>
            </Pressable>
          </VStack>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
      <KeyboardAvoidingView className="flex-1" behavior="padding">
        <ScrollView contentContainerClassName="px-5 pt-4 pb-6 gap-5" keyboardShouldPersistTaps="handled">
          <Pressable className="p-2 -ml-2 active:opacity-60 self-start" onPress={onBack}>
            <Icon name="arrow-back" size="lg" />
          </Pressable>

          {!isEditing && !isEditingSchedule && (
            <VStack className="gap-2">
              <Text className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('sessionSportLabel')}</Text>
              <HStack className="gap-2 flex-wrap">
                {sports.map((id) => (
                  <Pressable
                    key={id}
                    className={`px-3 py-2 rounded-full ${id === sport ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                    onPress={() => handleSelectSport(id)}
                  >
                    <Text className={id === sport ? 'text-white font-bold' : 'text-slate-600 dark:text-slate-300'}>
                      {id === 'tennis' ? t('sportTennis') : id}
                    </Text>
                  </Pressable>
                ))}
              </HStack>
            </VStack>
          )}

          <VStack className="gap-2">
            <Text className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('sessionActivityTypeLabel')}</Text>
            <HStack className="gap-2 flex-wrap">
              {activityTypes.map((id) => (
                <Pressable
                  key={id}
                  className={`px-3 py-2 rounded-full ${id === activityType ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                  onPress={() => setActivityType(id)}
                >
                  <Text className={id === activityType ? 'text-white font-bold' : 'text-slate-600 dark:text-slate-300'}>
                    {activityTypeLabel(id, t)}
                  </Text>
                </Pressable>
              ))}
            </HStack>
          </VStack>

          <VStack className="gap-2">
            <Text className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('sessionNamePlaceholder')}</Text>
            <Input>
              <InputField value={name} onChangeText={setName} maxLength={80} />
            </Input>
          </VStack>

          <VStack className="gap-2">
            <Text className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('sessionLocationPlaceholder')}</Text>
            <Input>
              <InputField value={location} onChangeText={setLocation} maxLength={120} />
            </Input>
          </VStack>

          <VStack className="gap-2">
            <Text className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('sessionDescriptionLabel')}</Text>
            <Input className="h-auto items-start py-2">
              <InputField
                // Uncontrolled deliberately — this screen is one large
                // component with 20+ pieces of state, so every keystroke
                // re-renders the whole form. A controlled `value` here
                // would feed that re-render straight back into the native
                // text view on every character; on iOS specifically that
                // redundant round-trip through a multiline UITextView is
                // a known source of a visible flash (the native keystroke
                // paints instantly, then React's controlled update
                // repaints it a beat later). defaultValue lets the native
                // view own the text entirely — React only observes via
                // onChangeText, never writes back — so there's nothing
                // left to cause a second paint. Safe here specifically
                // because description is only ever set programmatically
                // once, in the edit-mode load effect above, which
                // completes before this form is ever rendered
                // (loadingExisting gates it) — nothing resets this field
                // after first mount.
                defaultValue={description}
                onChangeText={setDescription}
                placeholder={t('sessionDescriptionPlaceholder')}
                multiline
                numberOfLines={3}
                maxLength={500}
                textAlignVertical="top"
              />
            </Input>
          </VStack>

          <VStack className="gap-2">
            <Text className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('sessionMaxParticipantsLabel')}</Text>
            <Input>
              <InputField
                value={maxParticipants}
                onChangeText={setMaxParticipants}
                placeholder={t('sessionMaxParticipantsPlaceholder')}
                keyboardType="number-pad"
                maxLength={3}
              />
            </Input>
          </VStack>

          <HStack className="justify-between items-center">
            <Text className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('sessionHostPlayingLabel')}</Text>
            <Switch value={hostPlaying} onValueChange={setHostPlaying} />
          </HStack>

          {!isEditing && !isEditingSchedule && (
            <HStack className="justify-between items-center">
              <Text className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('recurringToggleLabel')}</Text>
              <Switch value={isRecurring} onValueChange={setIsRecurring} />
            </HStack>
          )}

          {!isEditing && isRecurring ? (
            <VStack className="gap-2">
              <Text className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('recurringScheduleWeekdayLabel')}</Text>
              <HStack className="gap-2 flex-wrap">
                {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                  <Pressable
                    key={day}
                    className={`px-3 py-2 rounded-full ${day === weekday ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                    onPress={() => setWeekday(day)}
                  >
                    <Text className={day === weekday ? 'text-white font-bold' : 'text-slate-600 dark:text-slate-300'}>
                      {weekdayLabel(day, t)}
                    </Text>
                  </Pressable>
                ))}
              </HStack>
            </VStack>
          ) : (
            <VStack className="gap-2">
              <Text className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('sessionDateLabel')}</Text>
              <Pressable
                className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800"
                onPress={() => setShowDatePicker((shown) => !shown)}
              >
                <Text className="text-slate-900 dark:text-slate-100 font-bold">{date.toLocaleDateString()}</Text>
              </Pressable>
              {showDatePicker && (
                <>
                  <DateTimePicker
                    value={date}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    themeVariant={isDark ? 'dark' : 'light'}
                    onChange={(_, selected) => {
                      if (Platform.OS === 'android') setShowDatePicker(false);
                      if (selected) setDate(selected);
                    }}
                  />
                  {Platform.OS !== 'android' && (
                    <Pressable className="self-end px-4 py-2" onPress={() => setShowDatePicker(false)}>
                      <Text className="text-blue-600 font-bold">{t('recurringScheduleTimeDone')}</Text>
                    </Pressable>
                  )}
                </>
              )}
            </VStack>
          )}

          <VStack className="gap-2">
            <Text className="text-sm font-bold text-slate-500 dark:text-slate-400">
              {!isEditing && isRecurring ? t('recurringScheduleTimeLabel') : t('sessionTimeLabel')}
            </Text>
            <Pressable
              className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800"
              onPress={() => setShowTimePicker((shown) => !shown)}
            >
              <Text className="text-slate-900 dark:text-slate-100 font-bold">{formatHHMM(time)}</Text>
            </Pressable>
            {showTimePicker && (
              <>
                <DateTimePicker
                  value={time}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  themeVariant={isDark ? 'dark' : 'light'}
                  onChange={(_, selected) => {
                    if (Platform.OS === 'android') setShowTimePicker(false);
                    if (selected) setTime(selected);
                  }}
                />
                {Platform.OS !== 'android' && (
                  <Pressable className="self-end px-4 py-2" onPress={() => setShowTimePicker(false)}>
                    <Text className="text-blue-600 font-bold">{t('recurringScheduleTimeDone')}</Text>
                  </Pressable>
                )}
              </>
            )}
          </VStack>

          {!isEditing && isRecurring && (
            <VStack className="gap-2">
              <Text className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('recurringScheduleLeadDaysLabel')}</Text>
              <Input>
                <InputField
                  value={generationLeadDays}
                  onChangeText={setGenerationLeadDays}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </Input>
            </VStack>
          )}

          <VStack className="gap-2">
            <Text className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('sessionDurationLabel')}</Text>
            <Pressable
              className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800"
              onPress={() => setShowDurationPicker((shown) => !shown)}
            >
              <Text className="text-slate-900 dark:text-slate-100 font-bold">{t('sessionDurationHours', durationHours)}</Text>
            </Pressable>
            {showDurationPicker && (
              <>
                <Picker
                  selectedValue={durationHours}
                  onValueChange={(hours) => {
                    setDurationHours(Number(hours));
                    if (Platform.OS === 'android') setShowDurationPicker(false);
                  }}
                  style={Platform.OS === 'android' ? { color: isDark ? '#f1f5f9' : '#0f172a' } : undefined}
                  itemStyle={Platform.OS === 'ios' ? { color: isDark ? '#f1f5f9' : '#0f172a' } : undefined}
                  dropdownIconColor={isDark ? '#f1f5f9' : '#0f172a'}
                >
                  {DURATION_OPTIONS_HOURS.map((hours) => (
                    <Picker.Item
                      key={hours}
                      label={t('sessionDurationHours', hours)}
                      value={hours}
                      color={Platform.OS === 'ios' ? (isDark ? '#f1f5f9' : '#0f172a') : undefined}
                    />
                  ))}
                </Picker>
                {Platform.OS !== 'android' && (
                  <Pressable className="self-end px-4 py-2" onPress={() => setShowDurationPicker(false)}>
                    <Text className="text-blue-600 font-bold">{t('recurringScheduleTimeDone')}</Text>
                  </Pressable>
                )}
              </>
            )}
          </VStack>

          <VStack className="gap-3">
            <Text className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('matchFormat')}</Text>
            <VStack className="gap-2">
              <Pressable
                onPress={() => setMatchFormat({ type: 'open' })}
                className={`py-3 px-4 rounded-xl border-2 ${
                  matchFormat.type === 'open'
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-600'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                }`}
              >
                <Text className={matchFormat.type === 'open' ? 'text-blue-600 font-bold' : 'text-slate-600 dark:text-slate-300'}>
                  {t('formatOpen')}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setMatchFormat({ type: 'fixed-games', totalGames: 4, goldenGameOnTie: false })}
                className={`py-3 px-4 rounded-xl border-2 ${
                  matchFormat.type === 'fixed-games'
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-600'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                }`}
              >
                <Text className={matchFormat.type === 'fixed-games' ? 'text-blue-600 font-bold' : 'text-slate-600 dark:text-slate-300'}>
                  {t('formatFixedGames')}
                </Text>
              </Pressable>
              {matchFormat.type === 'fixed-games' && (
                <VStack className="gap-3 pl-2">
                  <HStack className="justify-between items-center">
                    <Text className="text-slate-500 dark:text-slate-400">{t('totalGames')}</Text>
                    <Stepper
                      value={matchFormat.totalGames}
                      min={2}
                      max={20}
                      onChange={(n) => setMatchFormat({ ...matchFormat, totalGames: n })}
                    />
                  </HStack>
                  <HStack className="justify-between items-center gap-4">
                    <VStack className="flex-1 gap-1">
                      <Text className="font-bold text-slate-900 dark:text-white">{t('goldenGame')}</Text>
                      <Text className="text-sm text-slate-500 dark:text-slate-400">{t('goldenGameDesc')}</Text>
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
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                }`}
              >
                <Text className={matchFormat.type === 'race-to' ? 'text-blue-600 font-bold' : 'text-slate-600 dark:text-slate-300'}>
                  {t('formatRaceTo')}
                </Text>
              </Pressable>
              {matchFormat.type === 'race-to' && (
                <HStack className="justify-between items-center pl-2">
                  <Text className="text-slate-500 dark:text-slate-400">{t('targetGames')}</Text>
                  <Stepper value={matchFormat.raceTo} min={1} max={20} onChange={(n) => setMatchFormat({ ...matchFormat, raceTo: n })} />
                </HStack>
              )}

              <Pressable
                onPress={() => setMatchFormat({ type: 'best-of-sets', setsToWin: 2, superTiebreak: false })}
                className={`py-3 px-4 rounded-xl border-2 ${
                  matchFormat.type === 'best-of-sets'
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-600'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                }`}
              >
                <Text className={matchFormat.type === 'best-of-sets' ? 'text-blue-600 font-bold' : 'text-slate-600 dark:text-slate-300'}>
                  {t('regularTab')}
                </Text>
              </Pressable>
              {matchFormat.type === 'best-of-sets' && (
                <VStack className="gap-3 pl-2">
                  <HStack className="justify-between items-center">
                    <Text className="text-slate-500 dark:text-slate-400">{t('setsToWin')}</Text>
                    <HStack className="gap-2">
                      {([1, 2, 3] as const).map((n) => {
                        const active = matchFormat.type === 'best-of-sets' && matchFormat.setsToWin === n;
                        return (
                          <Pressable
                            key={n}
                            onPress={() => setMatchFormat({ type: 'best-of-sets', setsToWin: n, superTiebreak: n === 1 ? false : matchFormat.superTiebreak })}
                            className={`w-9 h-9 rounded-full items-center justify-center ${active ? 'bg-blue-600' : 'bg-slate-100 dark:bg-slate-700'}`}
                          >
                            <Text className={active ? 'text-white font-bold' : 'text-slate-600 dark:text-slate-300 font-bold'}>{n}</Text>
                          </Pressable>
                        );
                      })}
                    </HStack>
                  </HStack>
                  {matchFormat.setsToWin > 1 && (
                    <HStack className="justify-between items-center gap-4">
                      <VStack className="flex-1 gap-1">
                        <Text className="font-bold text-slate-900 dark:text-white">{t('superTiebreak')}</Text>
                        <Text className="text-sm text-slate-500 dark:text-slate-400">{t('superTiebreakDesc')}</Text>
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

            <HStack className="justify-between items-center gap-4">
              <VStack className="flex-1 gap-1">
                <Text className="font-bold text-slate-900 dark:text-white">{t('singleDeuce')}</Text>
                <Text className="text-sm text-slate-500 dark:text-slate-400">{t('singleDeuceDesc')}</Text>
              </VStack>
              <Switch value={singleDeuceSuddenDeath} onValueChange={setSingleDeuceSuddenDeath} />
            </HStack>
          </VStack>

          <HStack className="justify-between items-center">
            <Text className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('skillLevelRequireToggleLabel')}</Text>
            <Switch value={requireSkillLevel} onValueChange={setRequireSkillLevel} />
          </HStack>

          {requireSkillLevel && (
            <SkillLevelRangePicker sport={sport} value={skillLevelRange} onChange={setSkillLevelRange} />
          )}

          <VStack className="gap-2">
            <Text className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('sessionPriceLabel')}</Text>
            <HStack className="gap-2 flex-wrap">
              {(['free', 'per_person', 'split_bill'] as PriceModel[]).map((model) => (
                <Pressable
                  key={model}
                  className={`px-3 py-2 rounded-full ${model === priceModel ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                  onPress={() => setPriceModel(model)}
                >
                  <Text className={model === priceModel ? 'text-white font-bold' : 'text-slate-600 dark:text-slate-300'}>
                    {model === 'free'
                      ? t('sessionPriceModelFree')
                      : model === 'per_person'
                        ? t('sessionPriceModelPerPerson')
                        : t('sessionPriceModelSplitBill')}
                  </Text>
                </Pressable>
              ))}
            </HStack>
            {priceModel === 'per_person' && (
              <Input>
                <InputField
                  value={pricePerPerson}
                  onChangeText={setPricePerPerson}
                  placeholder={t('sessionPricePerPersonPlaceholder')}
                  keyboardType="number-pad"
                  maxLength={12}
                />
              </Input>
            )}
            {priceModel === 'split_bill' && (
              <Input>
                <InputField
                  value={totalPrice}
                  onChangeText={setTotalPrice}
                  placeholder={t('sessionTotalPricePlaceholder')}
                  keyboardType="number-pad"
                  maxLength={12}
                />
              </Input>
            )}
          </VStack>

          {error && <Text className="text-sm text-red-500">{error}</Text>}

          <Button
            action="secondary"
            size="lg"
            isDisabled={submitting}
            className="w-full rounded-2xl bg-blue-600"
            onPress={isEditing || isRecurring ? handleSubmit : handleContinue}
          >
            <ButtonText className="text-white">
              {isEditing || isEditingSchedule ? t('sessionEditSubmit') : isRecurring ? t('recurringScheduleCreateSubmit') : t('sessionContinue')}
            </ButtonText>
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
