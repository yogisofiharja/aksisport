import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { HStack } from '../../design-system/layout/HStack';
import { VStack } from '../../design-system/layout/VStack';
import { Typography } from '../../design-system/ui/Typography';
import { Icon } from '../../design-system/ui/Icon';
import { useTranslation } from '../../i18n';
import { getLocations, type Locations } from '../../core/locations/api';
import type { City, Province } from '../../core/api/types';

type Props = {
  visible: boolean;
  title: string;
  // The city currently chosen, shown with a check mark.
  selectedCode?: string;
  onSelect: (city: City) => void;
  onClose: () => void;
  // When given, a "remove" row is offered while a city is selected.
  onClear?: () => void;
};

const MIN_QUERY_LENGTH = 2;

// Picks one of Indonesia's cities/regencies (DP-017) — used wherever a
// place is asked for (a User's town, a Community's location), so the same
// place is always the same value rather than one of several spellings.
//
// Two ways through the 514 of them: type a name to search every province
// at once, or pick a province and then a city within it. The list comes
// from the server once and is filtered on the device.
export function CityPickerModal({ visible, title, selectedCode, onSelect, onClose, onClear }: Props) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [locations, setLocations] = useState<Locations | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [province, setProvince] = useState<Province | null>(null);

  // Every opening starts from the top: no leftover search or province.
  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setProvince(null);
    setFailed(false);
    let cancelled = false;
    getLocations()
      .then((loaded) => {
        if (!cancelled) setLocations(loaded);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const provinceName = useMemo(() => {
    const names: Record<string, string> = {};
    locations?.provinces.forEach((p) => {
      names[p.code] = p.name;
    });
    return names;
  }, [locations]);

  const trimmed = query.trim().toLowerCase();
  const isSearching = trimmed.length >= MIN_QUERY_LENGTH;

  const cities = useMemo(() => {
    if (!locations) return [];
    if (isSearching) {
      return locations.cities.filter(
        (c) => c.name.toLowerCase().includes(trimmed) || (provinceName[c.provinceCode] ?? '').toLowerCase().includes(trimmed)
      );
    }
    if (province) return locations.cities.filter((c) => c.provinceCode === province.code);
    return [];
  }, [locations, isSearching, trimmed, province, provinceName]);

  const showingProvinces = !isSearching && !province;

  function row(key: string, label: string, sublabel: string | undefined, trailing: 'chevron' | 'check' | 'none', onPress: () => void) {
    return (
      <Pressable key={key} onPress={onPress} className="px-5 py-3 active:opacity-60 border-b border-slate-200 dark:border-slate-800">
        <HStack className="justify-between items-center" space="md">
          <VStack space="xs" style={{ flex: 1 }}>
            <Typography variant="body" className="font-semibold">
              {label}
            </Typography>
            {sublabel ? (
              <Typography variant="body" color="muted" className="text-sm">
                {sublabel}
              </Typography>
            ) : null}
          </VStack>
          {trailing === 'chevron' && <Icon name="chevron-forward" size="sm" color="muted" />}
          {trailing === 'check' && <Icon name="checkmark" size="sm" color="secondary" />}
        </HStack>
      </Pressable>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* Same centred column as the app itself on a wide browser window. */}
      <View className="flex-1 bg-slate-200 dark:bg-black">
        <SafeAreaView className="flex-1 w-full self-center bg-slate-50 dark:bg-slate-900" style={{ maxWidth: 520 }}>
          <VStack space="md" className="px-5 pt-4 pb-3">
            <HStack className="justify-between items-center">
              <Typography variant="title">{title}</Typography>
              <Pressable onPress={onClose} hitSlop={8} className="p-2 -mr-2 active:opacity-60" accessibilityLabel={t('cityPickerClose')}>
                <Icon name="close" size="lg" />
              </Pressable>
            </HStack>
            <HStack className="items-center rounded-2xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4" space="sm">
              <Icon name="search" size="sm" color="muted" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t('cityPickerSearchPlaceholder')}
                placeholderTextColor={isDark ? '#64748b' : '#9ca3af'}
                autoCapitalize="none"
                autoCorrect={false}
                className="flex-1 font-semibold text-gray-900 dark:text-slate-100"
                style={{ height: 48, fontSize: 16 }}
              />
              {query.length > 0 && (
                <Pressable onPress={() => setQuery('')} hitSlop={8} className="active:opacity-60" accessibilityLabel={t('exploreClearSearch')}>
                  <Icon name="close-circle" size="sm" color="muted" />
                </Pressable>
              )}
            </HStack>
            {!isSearching && province && (
              <Pressable onPress={() => setProvince(null)} className="active:opacity-60 self-start">
                <HStack space="xs" className="items-center">
                  <Icon name="chevron-back" size="sm" color="secondary" />
                  <Typography variant="body" className="font-bold text-blue-600 dark:text-blue-400">
                    {province.name}
                  </Typography>
                </HStack>
              </Pressable>
            )}
            {showingProvinces && locations && (
              <Typography variant="caption" color="muted">
                {t('cityPickerChooseProvince')}
              </Typography>
            )}
          </VStack>

          {failed ? (
            <Typography variant="body" color="muted" className="px-5">
              {t('cityPickerLoadFailed')}
            </Typography>
          ) : !locations ? (
            <ActivityIndicator size="large" style={{ marginTop: 32 }} />
          ) : showingProvinces ? (
            <FlatList
              data={locations.provinces}
              keyExtractor={(p) => p.code}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                onClear && selectedCode ? (
                  <Pressable onPress={onClear} className="px-5 py-3 active:opacity-60 border-b border-slate-200 dark:border-slate-800">
                    <Typography variant="body" color="destructive" className="font-semibold">
                      {t('cityPickerRemove')}
                    </Typography>
                  </Pressable>
                ) : null
              }
              renderItem={({ item }) => row(item.code, item.name, undefined, 'chevron', () => setProvince(item))}
            />
          ) : cities.length === 0 ? (
            <Typography variant="body" color="muted" className="px-5">
              {t('cityPickerNoMatch', query.trim())}
            </Typography>
          ) : (
            <FlatList
              data={cities}
              keyExtractor={(c) => c.code}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) =>
                row(
                  item.code,
                  item.name,
                  isSearching ? provinceName[item.provinceCode] : undefined,
                  item.code === selectedCode ? 'check' : 'none',
                  () => onSelect(item)
                )
              }
            />
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}
