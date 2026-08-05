import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { useColorScheme } from 'nativewind';
import { Icon } from '../../design-system/ui/Icon';
import { Button, ButtonText } from '../../../components/ui/button';
import { VStack, HStack } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import { Input, InputField } from '../../../components/ui/input';
import { Pressable } from '../../../components/ui/pressable';
import { useTranslation } from '../../i18n';
import { createSession } from '../../core/sessions/api';
import { createRecurringSchedule } from '../../core/recurringSchedules/api';
import type { RecurringSchedule, Session } from '../../core/api/types';
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
};

const DEFAULT_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
// 1-24 hours, hourly increments (v0.6.0) — no tournament-length Sessions yet.
const DURATION_OPTIONS_HOURS = Array.from({ length: 24 }, (_, i) => i + 1);

function defaultTime() {
  const d = new Date();
  d.setHours(8, 0, 0, 0);
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

export function CreateSessionScreen({ clubId, onBack, onSessionCreated, onScheduleCreated, initialRecurring }: Props) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

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
  const [date, setDate] = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [weekday, setWeekday] = useState(6); // Saturday default
  const [generationLeadDays, setGenerationLeadDays] = useState('3');

  // Both modes need a time-of-day.
  const [time, setTime] = useState(defaultTime);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [durationHours, setDurationHours] = useState(1);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const durationMinutes = durationHours * 60;
  // DP-008 v0.7.0: optional by default — the range section is hidden
  // until the organizer opts in, matching every other optional field's
  // collapsed-by-default treatment.
  const [requireSkillLevel, setRequireSkillLevel] = useState(false);
  const [skillLevelRange, setSkillLevelRange] = useState<SkillLevelRangeValue>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSelectSport(next: string) {
    setSport(next);
    setActivityType(getSportModule(next)?.activityTypes?.[0]);
  }

  function combinedStartsAt(): Date {
    const combined = new Date(date);
    combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
    return combined;
  }

  async function handleSubmit() {
    if (submitting) return;
    const trimmedName = name.trim();
    const trimmedLocation = location.trim();
    if (!trimmedName || !trimmedLocation) {
      setError(t('sessionNameLocationRequired'));
      return;
    }
    if (!activityType) {
      setError(t('sessionActivityTypeRequired'));
      return;
    }
    if (
      requireSkillLevel &&
      (!skillLevelRange.skillLevelMinId || !skillLevelRange.skillLevelMaxId || !skillLevelRange.skillLevelEnforcement)
    ) {
      setError(t('skillLevelRangeRequired'));
      return;
    }
    const trimmedMaxParticipants = maxParticipants.trim();
    let parsedMaxParticipants: number | undefined;
    if (trimmedMaxParticipants) {
      parsedMaxParticipants = Number.parseInt(trimmedMaxParticipants, 10);
      if (Number.isNaN(parsedMaxParticipants) || parsedMaxParticipants < 1) {
        setError(t('sessionMaxParticipantsInvalid'));
        return;
      }
    }
    setSubmitting(true);
    setError(null);
    try {
      if (isRecurring) {
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
            name: trimmedName,
            location: trimmedLocation,
            description: description.trim() || undefined,
            maxParticipants: parsedMaxParticipants,
            activityType,
            hostPlaying,
            ...(requireSkillLevel ? skillLevelRange : {}),
          }
        );
        onScheduleCreated(schedule);
      } else {
        const session = await createSession(clubId, sport, {
          name: trimmedName,
          location: trimmedLocation,
          description: description.trim() || undefined,
          maxParticipants: parsedMaxParticipants,
          activityType,
          hostPlaying,
          startsAt: combinedStartsAt().toISOString(),
          durationMinutes,
          ...(requireSkillLevel ? skillLevelRange : {}),
        });
        onSessionCreated(session);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('authGenericError'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
      <KeyboardAvoidingView className="flex-1" behavior="padding">
        <ScrollView contentContainerClassName="px-5 pt-4 pb-6 gap-5" keyboardShouldPersistTaps="handled">
          <Pressable className="p-2 -ml-2 active:opacity-60 self-start" onPress={onBack}>
            <Icon name="arrow-back" size="lg" />
          </Pressable>

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

          <HStack className="justify-between items-center">
            <Text className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('recurringToggleLabel')}</Text>
            <Switch value={isRecurring} onValueChange={setIsRecurring} />
          </HStack>

          {isRecurring ? (
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
              {isRecurring ? t('recurringScheduleTimeLabel') : t('sessionTimeLabel')}
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

          {isRecurring && (
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
            size="xl"
            isDisabled={submitting}
            className="w-full rounded-2xl bg-blue-600"
            onPress={handleSubmit}
          >
            <ButtonText className="text-white text-xl">
              {isRecurring ? t('recurringScheduleCreateSubmit') : t('sessionCreateSubmit')}
            </ButtonText>
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
