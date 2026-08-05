import { useEffect, useState } from 'react';
import { Platform, Pressable } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useColorScheme } from 'nativewind';
import { Text } from '../../../components/ui/text';
import { VStack, HStack } from '../../../components/ui/box';
import { useTranslation } from '../../i18n';
import { listSkillLevels } from '../../core/skillLevels/api';
import type { SkillLevel, SkillLevelEnforcement } from '../../core/api/types';

export type SkillLevelRangeValue = {
  skillLevelMinId?: string;
  skillLevelMaxId?: string;
  skillLevelEnforcement?: SkillLevelEnforcement;
};

type Props = {
  sport: string;
  value: SkillLevelRangeValue;
  onChange: (value: SkillLevelRangeValue) => void;
};

// DP-008: Skill Level requirement is optional as of v0.7.0 — the caller
// (CreateSessionScreen) only renders this behind a "require a skill
// level?" toggle. Once shown, min/max/enforcement are all required
// together (validated server-side by validateSkillLevelRange).
export function SkillLevelRangePicker({ sport, value, onChange }: Props) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const pickerTextColor = isDark ? '#f1f5f9' : '#0f172a';
  const [levels, setLevels] = useState<SkillLevel[]>([]);
  const [showMinPicker, setShowMinPicker] = useState(false);
  const [showMaxPicker, setShowMaxPicker] = useState(false);

  useEffect(() => {
    listSkillLevels(sport)
      .then(setLevels)
      .catch(() => setLevels([]));
  }, [sport]);

  function levelName(id?: string): string {
    return levels.find((level) => level.id === id)?.name ?? t('skillLevelNotSet');
  }

  function pickMin(id: string) {
    onChange({ ...value, skillLevelMinId: id, skillLevelEnforcement: value.skillLevelEnforcement ?? 'guidance' });
  }

  function pickMax(id: string) {
    onChange({ ...value, skillLevelMaxId: id, skillLevelEnforcement: value.skillLevelEnforcement ?? 'guidance' });
  }

  function pickEnforcement(mode: SkillLevelEnforcement) {
    onChange({ ...value, skillLevelEnforcement: mode });
  }

  return (
    <VStack className="gap-3">
      <Text className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('skillLevelRangeLabel')}</Text>

      <VStack className="gap-2">
        <Text className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('skillLevelMinLabel')}</Text>
        <Pressable
          className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800"
          onPress={() => setShowMinPicker((shown) => !shown)}
        >
          <Text className="text-slate-900 dark:text-slate-100 font-bold">{levelName(value.skillLevelMinId)}</Text>
        </Pressable>
        {showMinPicker && (
          <>
            <Picker
              selectedValue={value.skillLevelMinId}
              onValueChange={(id) => {
                if (id) pickMin(String(id));
                if (Platform.OS === 'android') setShowMinPicker(false);
              }}
              style={Platform.OS === 'android' ? { color: pickerTextColor } : undefined}
              itemStyle={Platform.OS === 'ios' ? { color: pickerTextColor } : undefined}
              dropdownIconColor={pickerTextColor}
            >
              {levels.map((level) => (
                <Picker.Item key={level.id} label={level.name} value={level.id} color={Platform.OS === 'ios' ? pickerTextColor : undefined} />
              ))}
            </Picker>
            {Platform.OS === 'ios' && (
              <Pressable className="self-end px-4 py-2" onPress={() => setShowMinPicker(false)}>
                <Text className="text-blue-600 font-bold">{t('recurringScheduleTimeDone')}</Text>
              </Pressable>
            )}
          </>
        )}
      </VStack>

      <VStack className="gap-2">
        <Text className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('skillLevelMaxLabel')}</Text>
        <Pressable
          className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800"
          onPress={() => setShowMaxPicker((shown) => !shown)}
        >
          <Text className="text-slate-900 dark:text-slate-100 font-bold">{levelName(value.skillLevelMaxId)}</Text>
        </Pressable>
        {showMaxPicker && (
          <>
            <Picker
              selectedValue={value.skillLevelMaxId}
              onValueChange={(id) => {
                if (id) pickMax(String(id));
                if (Platform.OS === 'android') setShowMaxPicker(false);
              }}
              style={Platform.OS === 'android' ? { color: pickerTextColor } : undefined}
              itemStyle={Platform.OS === 'ios' ? { color: pickerTextColor } : undefined}
              dropdownIconColor={pickerTextColor}
            >
              {levels.map((level) => (
                <Picker.Item key={level.id} label={level.name} value={level.id} color={Platform.OS === 'ios' ? pickerTextColor : undefined} />
              ))}
            </Picker>
            {Platform.OS === 'ios' && (
              <Pressable className="self-end px-4 py-2" onPress={() => setShowMaxPicker(false)}>
                <Text className="text-blue-600 font-bold">{t('recurringScheduleTimeDone')}</Text>
              </Pressable>
            )}
          </>
        )}
      </VStack>

      <VStack className="gap-2">
        <Text className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('skillLevelEnforcementLabel')}</Text>
        <HStack className="gap-2">
          {(['strict', 'guidance'] as SkillLevelEnforcement[]).map((mode) => {
            const selected = (value.skillLevelEnforcement ?? 'guidance') === mode;
            return (
              <Pressable
                key={mode}
                className={`flex-1 py-2 rounded-xl items-center border-[1.5px] ${selected ? 'bg-blue-600 border-blue-600' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'}`}
                onPress={() => pickEnforcement(mode)}
              >
                <Text className={selected ? 'text-white font-bold' : 'text-slate-900 dark:text-slate-50 font-bold'}>
                  {mode === 'strict' ? t('skillLevelEnforcementStrict') : t('skillLevelEnforcementGuidance')}
                </Text>
              </Pressable>
            );
          })}
        </HStack>
      </VStack>
    </VStack>
  );
}
