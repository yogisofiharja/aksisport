import { useState, type ReactNode } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import { Alert } from '../../../design-system/feedback/Alert';
import { Field, FieldError, FormSection, SelectField, SwitchField } from '../../../design-system/ui/Field';
import { Input, InputField, InputSlot } from '../../../design-system/ui/Input';
import { ListRow } from '../../../design-system/ui/List';
import { Segmented } from '../../../design-system/ui/Segmented';
import { Stepper } from '../../../design-system/ui/Stepper';
import { useTranslation } from '../../../i18n';
import { digitsOnly, formatThousands } from '../../../core/currency';
import { listSportIds, getSportModule } from '../../../sports/registry';
import { firstScheduledSession } from '../../../core/recurringSchedules/firstSession';
import { hhmm, shortDate, type SessionFormErrors, type SessionFormField, type SessionFormValues } from '../../../core/sessions/sessionForm';
import type { PriceModel, SkillLevel, SkillLevelEnforcement } from '../../../core/api/types';
import type { MatchFormat } from '../../../sports/tennis/scoringEngine';
import { weekdayLabel } from '../../recurringSchedules/weekday';
import { activityTypeLabel, sportLabel } from '../sessionDisplay';
import { DateTimeSheet, OptionSheet } from './PickerSheets';

type Props = {
  values: SessionFormValues;
  update: (patch: Partial<SessionFormValues>) => void;
  errors: SessionFormErrors;
  levels: SkillLevel[];
  // Sport and the recurring switch are fixed once created.
  editing: boolean;
  // Where each field sits, so a failed Continue can scroll to the first error.
  onFieldLayout: (field: SessionFormField, y: number) => void;
};

const DURATION_HOURS = Array.from({ length: 24 }, (_, i) => i + 1);
// Monday first, as on the canvas; values are RecurrenceRule weekdays (0 = Sunday).
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];
const MAX_LEAD_DAYS = 30;

type Picker = 'sport' | 'date' | 'time' | 'duration' | 'levelMin' | 'levelMax' | null;
type FormatType = MatchFormat['type'];

// The create / edit Session and Schedule form (Aksi redesign › Create a
// session), one scrolling column: what, where and when, the two switches,
// players, how matches are played, who can join, price, notes. With
// "Make this recurring" on, Date becomes "Every" (a weekday), and "Open
// days ahead" with the first Session's date follow. Problems show under
// their field (`errors`), never in a banner.
export function SessionForm({ values: v, update, errors, levels, editing, onFieldLayout }: Props) {
  const { t, lang } = useTranslation();
  const [picker, setPicker] = useState<Picker>(null);
  const sports = listSportIds();
  const activityTypes = getSportModule(v.sport)?.activityTypes ?? [];
  const err = (field: SessionFormField) => (errors[field] ? t(errors[field]!) : null);
  const at = (field: SessionFormField) => (e: LayoutChangeEvent) => onFieldLayout(field, e.nativeEvent.layout.y);
  const levelName = (id?: string) => levels.find((l) => l.id === id)?.name ?? t('skillLevelNotSet');

  const first = v.isRecurring ? firstScheduledSession(v.weekday, v.time.getHours(), v.time.getMinutes(), v.leadDays) : null;

  function setFormat(type: FormatType) {
    if (type === v.matchFormat.type) return;
    const next: MatchFormat =
      type === 'fixed-games'
        ? { type, totalGames: 4, goldenGameOnTie: false }
        : type === 'race-to'
          ? { type, raceTo: 4 }
          : type === 'best-of-sets'
            ? { type, setsToWin: 2, superTiebreak: false }
            : { type: 'open' };
    update({ matchFormat: next });
  }

  return (
    <View className="gap-4">
      {editing ? null : (
        <ListRow
          framed="light"
          title={t('sessionSportLabel')}
          trailing={<Text className="text-base font-sans-bold text-ink dark:text-ink-dark">{sportLabel(v.sport, t)}</Text>}
          chevron
          onPress={() => setPicker('sport')}
        />
      )}

      <View onLayout={at('activityType')}>
        <Field label={t('sessionActivityTypeLabel')} error={err('activityType')}>
          <Segmented<string>
            options={activityTypes.map((id) => ({ value: id, label: activityTypeLabel(id, t) }))}
            value={v.activityType ?? ''}
            onChange={(id) => update({ activityType: id })}
          />
        </Field>
      </View>

      <View onLayout={at('name')}>
        <Field label={t('sessionNameLabel')} error={err('name')}>
          <Input isInvalid={Boolean(errors.name)}>
            <InputField value={v.name} onChangeText={(name) => update({ name })} maxLength={80} />
          </Input>
        </Field>
      </View>

      <View onLayout={at('location')}>
        <Field label={t('sessionLocationLabel')} error={err('location')}>
          <Input isInvalid={Boolean(errors.location)}>
            <InputField value={v.location} onChangeText={(location) => update({ location })} maxLength={120} />
          </Input>
        </Field>
      </View>

      {v.isRecurring ? (
        <>
          <Field label={t('recurringEvery')}>
            <Segmented<string>
              options={WEEKDAYS.map((day) => ({ value: String(day), label: weekdayLabel(day, t) }))}
              value={String(v.weekday)}
              onChange={(day) => update({ weekday: Number(day) })}
            />
          </Field>
          <Row>
            <SelectField label={t('sessionTimeLabel')} value={hhmm(v.time)} onPress={() => setPicker('time')} className="flex-1" />
            <SelectField
              label={t('sessionDurationLabel')}
              value={t('sessionDurationShort', v.durationHours)}
              onPress={() => setPicker('duration')}
              className="flex-1"
            />
          </Row>
          <StepperRow
            label={t('recurringScheduleLeadDaysLabel')}
            hint={t('recurringScheduleLeadDaysHint')}
            value={v.leadDays}
            min={0}
            max={MAX_LEAD_DAYS}
            onChange={(leadDays) => update({ leadDays })}
          />
          {first ? (
            <Alert
              tone="info"
              icon="information-circle-outline"
              title={t('recurringFirstSession', shortDate(first.startsAt, lang), hhmm(first.startsAt))}
            >
              {first.opensNow ? t('recurringOpensNow') : t('recurringOpensOn', shortDate(first.opensAt, lang))}
            </Alert>
          ) : null}
        </>
      ) : (
        <View onLayout={at('date')} className="gap-1.5">
          <Row>
            <SelectField
              label={t('sessionDateLabel')}
              value={shortDate(v.date, lang)}
              onPress={() => setPicker('date')}
              isInvalid={Boolean(errors.date)}
              className="flex-[1.4]"
            />
            <SelectField
              label={t('sessionTimeLabel')}
              value={hhmm(v.time)}
              onPress={() => setPicker('time')}
              isInvalid={Boolean(errors.date)}
              className="flex-1"
            />
            <SelectField
              label={t('sessionDurationLabel')}
              value={t('sessionDurationShort', v.durationHours)}
              onPress={() => setPicker('duration')}
              className="flex-1"
            />
          </Row>
          {errors.date ? <FieldError>{t(errors.date)}</FieldError> : null}
        </View>
      )}

      {editing ? null : (
        <SwitchField
          label={t('recurringToggleLabel')}
          hint={t(v.isRecurring ? 'recurringToggleHintOn' : 'recurringToggleHintOff')}
          value={v.isRecurring}
          onValueChange={(isRecurring) => update({ isRecurring })}
        />
      )}
      <SwitchField
        label={t('sessionHostPlayingLabel')}
        hint={t('sessionHostPlayingHint')}
        value={v.hostPlaying}
        onValueChange={(hostPlaying) => update({ hostPlaying })}
      />

      <View onLayout={at('maxParticipants')}>
        <Field label={t('sessionPlayersLabel')} hint={t('sessionPlayersHint')} error={err('maxParticipants')}>
          <Input isInvalid={Boolean(errors.maxParticipants)}>
            <InputField
              value={v.maxParticipants}
              onChangeText={(maxParticipants) => update({ maxParticipants: digitsOnly(maxParticipants) })}
              placeholder={t('sessionMaxParticipantsPlaceholder')}
              keyboardType="number-pad"
              maxLength={3}
            />
          </Input>
        </Field>
      </View>

      <FormSection title={t('sessionFormMatchesTitle')}>
        <Field label={t('matchFormat')}>
          <Segmented<FormatType>
            options={[
              { value: 'open', label: t('formatOpen') },
              { value: 'fixed-games', label: t('formatFixedShort') },
              { value: 'race-to', label: t('formatRaceTo') },
              { value: 'best-of-sets', label: t('regularTab') },
            ]}
            value={v.matchFormat.type}
            onChange={setFormat}
          />
        </Field>
        {v.matchFormat.type === 'fixed-games' ? (
          <>
            <StepperRow
              label={t('totalGames')}
              value={v.matchFormat.totalGames}
              min={2}
              max={20}
              onChange={(totalGames) => v.matchFormat.type === 'fixed-games' && update({ matchFormat: { ...v.matchFormat, totalGames } })}
            />
            <SwitchField
              label={t('goldenGame')}
              hint={t('goldenGameDesc')}
              value={v.matchFormat.goldenGameOnTie}
              onValueChange={(goldenGameOnTie) =>
                v.matchFormat.type === 'fixed-games' && update({ matchFormat: { ...v.matchFormat, goldenGameOnTie } })
              }
            />
          </>
        ) : null}
        {v.matchFormat.type === 'race-to' ? (
          <StepperRow
            label={t('targetGames')}
            value={v.matchFormat.raceTo}
            min={1}
            max={20}
            onChange={(raceTo) => v.matchFormat.type === 'race-to' && update({ matchFormat: { ...v.matchFormat, raceTo } })}
          />
        ) : null}
        {v.matchFormat.type === 'best-of-sets' ? (
          <>
            <Field label={t('setsToWin')}>
              <Segmented<string>
                options={['1', '2', '3'].map((n) => ({ value: n, label: n }))}
                value={String(v.matchFormat.setsToWin)}
                onChange={(n) => {
                  if (v.matchFormat.type !== 'best-of-sets') return;
                  const setsToWin = Number(n) as 1 | 2 | 3;
                  update({ matchFormat: { ...v.matchFormat, setsToWin, superTiebreak: setsToWin === 1 ? false : v.matchFormat.superTiebreak } });
                }}
              />
            </Field>
            {v.matchFormat.setsToWin > 1 ? (
              <SwitchField
                label={t('superTiebreak')}
                hint={t('superTiebreakDesc')}
                value={v.matchFormat.superTiebreak}
                onValueChange={(superTiebreak) =>
                  v.matchFormat.type === 'best-of-sets' && update({ matchFormat: { ...v.matchFormat, superTiebreak } })
                }
              />
            ) : null}
          </>
        ) : null}
        <SwitchField
          label={t('singleDeuce')}
          hint={t('singleDeuceDesc')}
          value={v.singleDeuce}
          onValueChange={(singleDeuce) => update({ singleDeuce })}
        />
      </FormSection>

      <FormSection title={t('sessionFormWhoTitle')}>
        <SwitchField
          label={t('skillLevelRequireToggleLabel')}
          value={v.requireSkillLevel}
          onValueChange={(requireSkillLevel) =>
            update(
              requireSkillLevel
                ? { requireSkillLevel, skillLevelEnforcement: v.skillLevelEnforcement ?? 'guidance' }
                : { requireSkillLevel }
            )
          }
        />
        {v.requireSkillLevel ? (
          <View onLayout={at('skillLevel')} className="gap-4">
            <View className="gap-1.5">
              <Row>
                <SelectField
                  label={t('skillLevelFrom')}
                  value={levelName(v.skillLevelMinId)}
                  onPress={() => setPicker('levelMin')}
                  isInvalid={Boolean(errors.skillLevel) && !v.skillLevelMinId}
                  className="flex-1"
                />
                <SelectField
                  label={t('skillLevelTo')}
                  value={levelName(v.skillLevelMaxId)}
                  onPress={() => setPicker('levelMax')}
                  isInvalid={Boolean(errors.skillLevel) && !v.skillLevelMaxId}
                  className="flex-1"
                />
              </Row>
              {errors.skillLevel ? <FieldError>{t(errors.skillLevel)}</FieldError> : null}
            </View>
            <Field
              label={t('skillLevelEnforcementLabel')}
              hint={t(v.skillLevelEnforcement === 'strict' ? 'skillLevelStrictHint' : 'skillLevelGuidanceHint')}
            >
              <Segmented<SkillLevelEnforcement>
                options={[
                  { value: 'strict', label: t('skillLevelEnforcementStrict') },
                  { value: 'guidance', label: t('skillLevelEnforcementGuidance') },
                ]}
                value={v.skillLevelEnforcement ?? 'guidance'}
                onChange={(skillLevelEnforcement) => update({ skillLevelEnforcement })}
              />
            </Field>
          </View>
        ) : null}
      </FormSection>

      <FormSection title={t('sessionPriceLabel')}>
        <View onLayout={at('price')} className="gap-4">
          <Segmented<PriceModel>
            options={[
              { value: 'free', label: t('sessionPriceModelFree') },
              { value: 'per_person', label: t('sessionPriceModelPerPerson') },
              { value: 'split_bill', label: t('sessionPriceModelSplitBill') },
            ]}
            value={v.priceModel}
            onChange={(priceModel) => update({ priceModel })}
          />
          {v.priceModel === 'free' ? null : (
            <Field
              label={t(v.priceModel === 'per_person' ? 'sessionPricePerPersonPlaceholder' : 'sessionTotalPricePlaceholder')}
              hint={v.priceModel === 'split_bill' ? t('sessionSplitBillHint') : undefined}
              error={err('price')}
            >
              <Input isInvalid={Boolean(errors.price)}>
                <InputSlot className="pr-0">
                  <Text className="text-base font-sans-semibold text-ink-muted dark:text-ink-muted-dark">Rp</Text>
                </InputSlot>
                <InputField
                  value={formatThousands(v.priceModel === 'per_person' ? v.pricePerPerson : v.totalPrice)}
                  onChangeText={(text) =>
                    update(v.priceModel === 'per_person' ? { pricePerPerson: digitsOnly(text) } : { totalPrice: digitsOnly(text) })
                  }
                  keyboardType="number-pad"
                  maxLength={15}
                />
              </Input>
            </Field>
          )}
        </View>
      </FormSection>

      <FormSection title={t('sessionDescriptionSectionTitle')}>
        <Field label={t('sessionDescriptionLabel')}>
          <Input>
            <InputField
              // Uncontrolled on purpose: a controlled multiline field
              // flashes on iOS as every keystroke re-renders this large
              // form. The form remounts with the saved text (back from a
              // check screen, or once an edit has loaded).
              defaultValue={v.description}
              onChangeText={(description) => update({ description })}
              placeholder={t('sessionDescriptionPlaceholder')}
              multiline
              maxLength={500}
            />
          </Input>
        </Field>
      </FormSection>

      <OptionSheet
        visible={picker === 'sport'}
        title={t('sessionSportLabel')}
        options={sports.map((id) => ({ value: id, label: sportLabel(id, t) }))}
        value={v.sport}
        onSelect={(sport) =>
          update({ sport, activityType: getSportModule(sport)?.activityTypes?.[0], skillLevelMinId: undefined, skillLevelMaxId: undefined })
        }
        onClose={() => setPicker(null)}
      />
      <DateTimeSheet
        visible={picker === 'date'}
        mode="date"
        title={t('sessionDateLabel')}
        value={v.date}
        onChange={(date) => update({ date })}
        onClose={() => setPicker(null)}
      />
      <DateTimeSheet
        visible={picker === 'time'}
        mode="time"
        title={t('sessionTimeLabel')}
        value={v.time}
        onChange={(time) => update({ time })}
        onClose={() => setPicker(null)}
      />
      <OptionSheet
        visible={picker === 'duration'}
        title={t('sessionDurationLabel')}
        options={DURATION_HOURS.map((h) => ({ value: h, label: t('sessionDurationHours', h) }))}
        value={v.durationHours}
        onSelect={(durationHours) => update({ durationHours })}
        onClose={() => setPicker(null)}
      />
      <OptionSheet
        visible={picker === 'levelMin'}
        title={t('skillLevelFrom')}
        options={levels.map((l) => ({ value: l.id, label: l.name }))}
        value={v.skillLevelMinId}
        onSelect={(skillLevelMinId) => update({ skillLevelMinId })}
        onClose={() => setPicker(null)}
      />
      <OptionSheet
        visible={picker === 'levelMax'}
        title={t('skillLevelTo')}
        options={levels.map((l) => ({ value: l.id, label: l.name }))}
        value={v.skillLevelMaxId}
        onSelect={(skillLevelMaxId) => update({ skillLevelMaxId })}
        onClose={() => setPicker(null)}
      />
    </View>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <View className="flex-row gap-2">{children}</View>;
}

// A number changed with − / +: the label (and hint) on the left.
function StepperRow({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center gap-3 min-h-12">
      <View className="flex-1">
        <Text className="text-[15px] leading-5 font-sans-semibold text-ink dark:text-ink-dark">{label}</Text>
        {hint ? <Text className="mt-0.5 text-xs leading-4 font-sans-medium text-ink-muted dark:text-ink-muted-dark">{hint}</Text> : null}
      </View>
      <Stepper value={value} min={min} max={max} onChange={onChange} label={label} decreaseLabel={t('stepperFewer')} increaseLabel={t('stepperMore')} />
    </View>
  );
}
