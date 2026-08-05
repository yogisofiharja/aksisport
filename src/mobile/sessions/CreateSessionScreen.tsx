import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Switch, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
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
import { createRecurringSchedule } from '../../core/recurringSchedules/api';
import { listSkillLevels } from '../../core/skillLevels/api';
import { formatSessionDateTime } from '../../core/sessions/sessionSchedule';
import type { RecurringSchedule, Session, SkillLevel } from '../../core/api/types';
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

export function CreateSessionScreen({
  clubId,
  onBack,
  onSessionCreated,
  onScheduleCreated,
  initialRecurring,
  editingSessionId,
  onSessionUpdated,
}: Props) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isEditing = Boolean(editingSessionId);

  const sports = listSportIds();
  const [sport, setSport] = useState(sports[0] ?? 'tennis');
  const activityTypes = getSportModule(sport)?.activityTypes ?? [];
  const [activityType, setActivityType] = useState<string | undefined>(activityTypes[0]);

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('');
  const [hostPlaying, setHostPlaying] = useState(true);
  const [isRecurring, setIsRecurring] = useState(Boolean(initialRecurring));

  // Ad-hoc: a specific date. Recurring: a weekday instead.
  const [date, setDate] = useState(defaultStartsAt);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [weekday, setWeekday] = useState(6); // Saturday default
  const [generationLeadDays, setGenerationLeadDays] = useState('3');

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

  const [loadingExisting, setLoadingExisting] = useState(isEditing);

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

  type Validated = { trimmedName: string; trimmedLocation: string; parsedMaxParticipants?: number };

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
    setError(null);
    return { trimmedName, trimmedLocation, parsedMaxParticipants };
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
        const schedule = await createRecurringSchedule(
          clubId,
          sport,
          { weekday, time: formatHHMM(time), durationMinutes, timezone: DEFAULT_TIMEZONE },
          leadDays,
          {
            name: v.trimmedName,
            location: v.trimmedLocation,
            description: description.trim() || undefined,
            maxParticipants: v.parsedMaxParticipants,
            activityType,
            hostPlaying,
            ...(requireSkillLevel ? skillLevelRange : {}),
          }
        );
        onScheduleCreated(schedule);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('authGenericError'));
    } finally {
      setSubmitting(false);
    }
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
    Alert.alert(t('sessionPreviewDiscardConfirmTitle'), t('sessionPreviewDiscardConfirmDesc'), [
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

          {!isEditing && (
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
                value={description}
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

          {!isEditing && (
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
                  {Platform.OS === 'ios' && (
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
                {Platform.OS === 'ios' && (
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
                {Platform.OS === 'ios' && (
                  <Pressable className="self-end px-4 py-2" onPress={() => setShowDurationPicker(false)}>
                    <Text className="text-blue-600 font-bold">{t('recurringScheduleTimeDone')}</Text>
                  </Pressable>
                )}
              </>
            )}
          </VStack>

          <HStack className="justify-between items-center">
            <Text className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('skillLevelRequireToggleLabel')}</Text>
            <Switch value={requireSkillLevel} onValueChange={setRequireSkillLevel} />
          </HStack>

          {requireSkillLevel && (
            <SkillLevelRangePicker sport={sport} value={skillLevelRange} onChange={setSkillLevelRange} />
          )}

          {error && <Text className="text-sm text-red-500">{error}</Text>}

          <Button
            action="secondary"
            size="lg"
            isDisabled={submitting}
            className="w-full rounded-2xl bg-blue-600"
            onPress={isEditing || isRecurring ? handleSubmit : handleContinue}
          >
            <ButtonText className="text-white">
              {isEditing ? t('sessionEditSubmit') : isRecurring ? t('recurringScheduleCreateSubmit') : t('sessionContinue')}
            </ButtonText>
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
