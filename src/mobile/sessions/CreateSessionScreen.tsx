import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePreventRemove, useNavigation } from '@react-navigation/native';
import { appAlert } from '../../design-system/feedback/appAlert';
import { Dialog } from '../../design-system/feedback/Dialog';
import { Loading } from '../../design-system/feedback/Loading';
import { ActionBar } from '../../design-system/layout/ActionBar';
import { AppBar } from '../../design-system/layout/AppBar';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { FieldError } from '../../design-system/ui/Field';
import { useTranslation } from '../../i18n';
import { createSession, getSession, publishSession, updateSession } from '../../core/sessions/api';
import { getClub } from '../../core/clubs/api';
import {
  createRecurringSchedule,
  getRecurringSchedule,
  previewSessionSync,
  syncGeneratedSessions,
  updateRecurringSchedule,
} from '../../core/recurringSchedules/api';
import { listSkillLevels } from '../../core/skillLevels/api';
import {
  SESSION_FORM_FIELDS,
  combinedStartsAt,
  hhmm,
  templatePayload,
  validateSessionForm,
  type SessionFormErrors,
  type SessionFormField,
  type SessionFormValues,
} from '../../core/sessions/sessionForm';
import type { RecurringSchedule, Session, SkillLevel } from '../../core/api/types';
import type { MatchFormat } from '../../sports/tennis/scoringEngine';
import { listSportIds, getSportModule } from '../../sports/registry';
import { SessionForm } from './form/SessionForm';
import { SessionCheck } from './form/SessionCheck';
import { ScheduleCheck } from './form/ScheduleCheck';

type Props = {
  clubId: string;
  onBack: () => void;
  onSessionCreated: (session: Session) => void;
  onScheduleCreated: (schedule: RecurringSchedule) => void;
  // Club > Recurring Schedules > Create lands here with the switch
  // pre-flipped; Club > Sessions > Create starts as a one-off.
  initialRecurring?: boolean;
  // Milestone 2: when set, edits this existing Session instead of creating
  // a new one. Sport and the recurring switch are hidden — both immutable
  // after creation (a skill level requirement is scoped to a sport; DP-007
  // treats a generated Session's schedule link as fixed). Edit skips the
  // check screen and saves directly.
  editingSessionId?: string;
  onSessionUpdated?: (session: Session) => void;
  // DP-007 Schedule Editing: when set, edits this Recurring Schedule
  // (needs clubId). Same immutables. After saving, offers to push the
  // Template to already-generated upcoming Sessions (Session
  // Synchronization) before calling onScheduleUpdated().
  editingScheduleId?: string;
  onScheduleUpdated?: () => void;
};

const DEFAULT_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

// The next whole hour from now (rolls into tomorrow late at night), so a
// fresh form never starts in the past.
function defaultStartsAt() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

function initialValues(recurring: boolean): SessionFormValues {
  const sport = listSportIds()[0] ?? 'tennis';
  const start = defaultStartsAt();
  return {
    sport,
    activityType: getSportModule(sport)?.activityTypes?.[0],
    name: '',
    location: '',
    description: '',
    maxParticipants: '',
    hostPlaying: true,
    isRecurring: recurring,
    date: start,
    time: start,
    durationHours: 1,
    weekday: 6, // Saturday
    leadDays: 3,
    timezone: DEFAULT_TIMEZONE,
    requireSkillLevel: false,
    priceModel: 'free',
    pricePerPerson: '',
    totalPrice: '',
    matchFormat: { type: 'open' },
    singleDeuce: true,
  };
}

// The fields shared by a Session and a Schedule, read back into the form.
function templateValues(src: Session | RecurringSchedule): Partial<SessionFormValues> {
  return {
    sport: src.sport,
    activityType: src.activityType,
    name: src.name ?? '',
    location: src.location ?? '',
    description: src.description ?? '',
    maxParticipants: src.maxParticipants != null ? String(src.maxParticipants) : '',
    hostPlaying: src.hostPlaying,
    priceModel: src.priceModel,
    pricePerPerson: src.pricePerPerson != null ? String(src.pricePerPerson) : '',
    totalPrice: src.totalPrice != null ? String(src.totalPrice) : '',
    ...(src.defaultMatchFormat ? { matchFormat: src.defaultMatchFormat as MatchFormat } : {}),
    ...(src.defaultSingleDeuce != null ? { singleDeuce: src.defaultSingleDeuce } : {}),
    ...(src.skillLevelMinId && src.skillLevelMaxId
      ? {
          requireSkillLevel: true,
          skillLevelMinId: src.skillLevelMinId,
          skillLevelMaxId: src.skillLevelMaxId,
          skillLevelEnforcement: src.skillLevelEnforcement,
        }
      : {}),
  };
}

// Create / edit a Session or a Recurring Schedule (Aksi redesign › Create
// a session): the form, then — when creating — a check screen: Check your
// session (Publish / Save as draft / Discard) or Check your schedule
// (Create schedule / Discard). Leaving with anything typed
// (✕, Android back, the browser's back) asks first.
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
  const navigation = useNavigation();
  const editing = Boolean(editingSessionId || editingScheduleId);

  const [values, setValues] = useState<SessionFormValues>(() => initialValues(Boolean(initialRecurring || editingScheduleId)));
  // What the form held when it opened (or finished loading), to tell
  // whether leaving would lose anything.
  const [baseline, setBaseline] = useState(() => JSON.stringify(values));
  const [errors, setErrors] = useState<SessionFormErrors>({});
  const [attempted, setAttempted] = useState(false);
  const [step, setStep] = useState<'form' | 'check'>('form');
  const [clubName, setClubName] = useState('');
  const [levels, setLevels] = useState<SkillLevel[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(editing);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [discardAction, setDiscardAction] = useState<(() => void) | null>(null);
  // Set once saved, so leaving afterwards isn't stopped; runs after the
  // render that lifts the guard.
  const [leave, setLeave] = useState<(() => void) | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const fieldY = useRef<Partial<Record<SessionFormField, number>>>({});

  const dirty = JSON.stringify(values) !== baseline;

  usePreventRemove(!leave && (dirty || step === 'check'), ({ data }) => {
    if (step === 'check') {
      setStep('form');
      return;
    }
    setDiscardAction(() => () => navigation.dispatch(data.action));
  });

  useEffect(() => {
    leave?.();
  }, [leave]);

  function update(patch: Partial<SessionFormValues>) {
    setValues((prev) => {
      const next = { ...prev, ...patch };
      if (attempted) setErrors(validateSessionForm(next));
      return next;
    });
  }

  function loaded(patch: Partial<SessionFormValues>) {
    setValues((prev) => {
      const next = { ...prev, ...patch };
      setBaseline(JSON.stringify(next));
      return next;
    });
  }

  useEffect(() => {
    if (editingSessionId) {
      getSession(editingSessionId)
        .then((sess) => {
          const startsAt = sess.startsAt ? new Date(sess.startsAt) : undefined;
          loaded({
            ...templateValues(sess),
            ...(startsAt ? { date: startsAt, time: startsAt } : {}),
            ...(sess.durationMinutes ? { durationHours: sess.durationMinutes / 60 } : {}),
          });
          getClub(sess.clubId)
            .then((club) => setClubName(club.name))
            .catch(() => {});
        })
        .catch(() => setSaveError(t('authGenericError')))
        .finally(() => setLoadingExisting(false));
      return;
    }
    getClub(clubId)
      .then((club) => setClubName(club.name))
      .catch(() => {});
    if (editingScheduleId) {
      getRecurringSchedule(clubId, editingScheduleId)
        .then((sched) => {
          const [hours, minutes] = sched.recurrenceRule.time.split(':').map(Number);
          const ruleTime = new Date();
          ruleTime.setHours(hours, minutes, 0, 0);
          loaded({
            ...templateValues(sched),
            isRecurring: true,
            weekday: sched.recurrenceRule.weekday,
            time: ruleTime,
            durationHours: sched.recurrenceRule.durationMinutes / 60,
            // Kept as loaded — re-saving from a phone in another timezone
            // must not shift every future occurrence.
            timezone: sched.recurrenceRule.timezone,
            leadDays: sched.generationLeadDays,
          });
        })
        .catch(() => setSaveError(t('authGenericError')))
        .finally(() => setLoadingExisting(false));
    }
  }, [clubId, editingSessionId, editingScheduleId]);

  // The sport's levels, for the From/To pickers and the check screen.
  useEffect(() => {
    if (!values.requireSkillLevel) return;
    listSkillLevels(values.sport)
      .then(setLevels)
      .catch(() => setLevels([]));
  }, [values.sport, values.requireSkillLevel]);

  function sessionPayload() {
    return {
      ...templatePayload(values),
      startsAt: combinedStartsAt(values.date, values.time).toISOString(),
      durationMinutes: values.durationHours * 60,
    };
  }

  function recurrenceRule() {
    return { weekday: values.weekday, time: hhmm(values.time), durationMinutes: values.durationHours * 60, timezone: values.timezone };
  }

  // Shows every problem under its field and scrolls to the first one.
  function checkForm(): boolean {
    const found = validateSessionForm(values);
    setAttempted(true);
    setErrors(found);
    const first = SESSION_FORM_FIELDS.find((f) => found[f]);
    if (!first) return true;
    const y = fieldY.current[first];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
    return false;
  }

  async function run(action: () => Promise<void>) {
    if (submitting) return;
    setSubmitting(true);
    setSaveError(null);
    try {
      await action();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('authGenericError'));
    } finally {
      setSubmitting(false);
    }
  }

  function handleContinue() {
    if (!checkForm()) return;
    if (editingSessionId) {
      run(async () => {
        const updated = await updateSession(editingSessionId, sessionPayload());
        setLeave(() => () => onSessionUpdated?.(updated));
      });
    } else if (editingScheduleId) {
      run(async () => {
        await updateRecurringSchedule(clubId, editingScheduleId, {
          ...templatePayload(values),
          recurrenceRule: recurrenceRule(),
          generationLeadDays: values.leadDays,
        });
        await offerSessionSync(editingScheduleId);
      });
    } else {
      setSaveError(null);
      setStep('check');
    }
  }

  // DP-007 Session Synchronization. The Schedule is already saved by the
  // time this runs, so declining (or a failed preview) still leaves future
  // occurrences on the new Template — only the already-generated upcoming
  // Sessions are the organizer's call. Nothing to ask when there are none.
  async function offerSessionSync(scheduleId: string) {
    const done = () => setLeave(() => () => onScheduleUpdated?.());
    let counts = { updated: 0, skippedEdited: 0 };
    try {
      counts = await previewSessionSync(clubId, scheduleId);
    } catch {
      // Fall through with zero counts: the save itself succeeded.
    }
    if (counts.updated === 0) {
      done();
      return;
    }
    const desc =
      t('recurringScheduleSyncDesc', counts.updated) +
      (counts.skippedEdited > 0 ? ` ${t('recurringScheduleSyncSkippedDesc', counts.skippedEdited)}` : '');
    appAlert(t('recurringScheduleSyncTitle'), desc, [
      { text: t('recurringScheduleSyncDecline'), style: 'cancel', onPress: done },
      {
        text: t('recurringScheduleSyncConfirm'),
        onPress: async () => {
          try {
            await syncGeneratedSessions(clubId, scheduleId);
            done();
          } catch (err) {
            setSaveError(err instanceof Error ? err.message : t('authGenericError'));
          }
        },
      },
    ]);
  }

  // DP-007 v0.28.0: created from its check screen, published on its own.
  function createSchedule() {
    run(async () => {
      const schedule = await createRecurringSchedule(clubId, values.sport, recurrenceRule(), values.leadDays, templatePayload(values));
      setLeave(() => () => onScheduleCreated(schedule));
    });
  }

  function create(publish: boolean) {
    run(async () => {
      const session = await createSession(clubId, values.sport, sessionPayload());
      const result = publish ? await publishSession(session.id) : session;
      setLeave(() => () => onSessionCreated(result));
    });
  }

  const discardDialog = (
    <Dialog
      visible={discardAction !== null}
      title={t(editing ? 'editDiscardTitle' : values.isRecurring ? 'scheduleDiscardTitle' : 'sessionPreviewDiscardConfirmTitle')}
      description={t(editing ? 'editDiscardDesc' : 'sessionPreviewDiscardConfirmDesc')}
      cancelLabel={t('discardKeepEditing')}
      confirmLabel={t('sessionDiscard')}
      onCancel={() => setDiscardAction(null)}
      onConfirm={() => {
        const action = discardAction;
        setDiscardAction(null);
        setLeave(() => () => action?.());
      }}
    />
  );

  if (loadingExisting) {
    return (
      <SafeAreaView className="flex-1 bg-ground dark:bg-ground-dark">
        <Loading fullScreen />
      </SafeAreaView>
    );
  }

  if (step === 'check' && values.isRecurring) {
    return (
      <>
        <ScheduleCheck
          values={values}
          clubName={clubName}
          levels={levels}
          submitting={submitting}
          error={saveError}
          onBack={() => setStep('form')}
          onCreate={createSchedule}
          onDiscard={() => setDiscardAction(() => onBack)}
        />
        {discardDialog}
      </>
    );
  }

  if (step === 'check') {
    return (
      <>
        <SessionCheck
          values={values}
          clubName={clubName}
          levels={levels}
          submitting={submitting}
          error={saveError}
          onBack={() => setStep('form')}
          onPublish={() => create(true)}
          onSaveDraft={() => create(false)}
          onDiscard={() => setDiscardAction(() => onBack)}
        />
        {discardDialog}
      </>
    );
  }

  const title = editingScheduleId
    ? 'editScheduleTitle'
    : editingSessionId
      ? 'editSessionTitle'
      : values.isRecurring
        ? 'createScheduleTitle'
        : 'createSessionTitle';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-ground dark:bg-ground-dark">
      <AppBar variant="form" title={t(title)} context={clubName || undefined} onClose={onBack} />
      <KeyboardAvoidingView className="flex-1" behavior="padding">
        <ScrollView ref={scrollRef} contentContainerClassName="px-4 pt-4 pb-6" keyboardShouldPersistTaps="handled">
          <SessionForm
            values={values}
            update={update}
            errors={errors}
            levels={levels}
            editing={editing}
            onFieldLayout={(field, y) => {
              fieldY.current[field] = y;
            }}
          />
        </ScrollView>
        <ActionBar>
          <View className="gap-1.5">
            {saveError ? <FieldError>{saveError}</FieldError> : null}
            <Button size="lg" loading={submitting} isDisabled={submitting} onPress={handleContinue}>
              <ButtonText>{t(editing ? 'sessionEditSubmit' : 'sessionContinue')}</ButtonText>
            </Button>
          </View>
        </ActionBar>
      </KeyboardAvoidingView>
      {discardDialog}
    </SafeAreaView>
  );
}
