import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../../design-system/ui/Icon';
import { Button, ButtonText } from '../../../components/ui/button';
import { HStack, VStack } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import { Input, InputField } from '../../../components/ui/input';
import { Pressable } from '../../../components/ui/pressable';
import { useTranslation } from '../../i18n';
import { createClub } from '../../core/clubs/api';
import type { City, Club } from '../../core/api/types';
import { CityPickerModal } from '../locations/CityPickerModal';
import { Switch } from '../../design-system/ui/Switch';

type Props = {
  onBack: () => void;
  onCreated: (club: Club) => void;
};

export function CreateClubScreen({ onBack, onCreated }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  // DP-017: where the Community is (a city picked from the reference
  // list, shown in search results), and whether joining needs approval.
  // Public unless the owner says otherwise.
  const [city, setCity] = useState<City | null>(null);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!name.trim() || !city || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const club = await createClub(name.trim(), {
        cityCode: city.code,
        visibility: isPrivate ? 'private' : 'public',
        description: description.trim() || undefined,
      });
      onCreated(club);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('authGenericError'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-ground dark:bg-ground-dark">
      <KeyboardAvoidingView className="flex-1" behavior="padding">
        <ScrollView contentContainerClassName="px-5 pt-4 pb-6 gap-5" keyboardShouldPersistTaps="handled">
          <Pressable className="p-2 -ml-2 active:opacity-60 self-start" onPress={onBack}>
            <Icon name="arrow-back" size="lg" />
          </Pressable>

          <VStack className="gap-2">
            <Text className="text-sm font-bold text-ink-muted dark:text-ink-muted-dark">{t('clubNamePlaceholder')}</Text>
            <Input>
              <InputField value={name} onChangeText={setName} maxLength={80} />
            </Input>
          </VStack>

          <VStack className="gap-2">
            <Text className="text-sm font-bold text-ink-muted dark:text-ink-muted-dark">{t('clubLocationLabel')}</Text>
            <Pressable
              className="flex-row items-center justify-between px-4 py-3 rounded-2xl border border-border-strong dark:border-border-strong-dark bg-surface dark:bg-surface-dark active:opacity-70"
              onPress={() => setShowCityPicker(true)}
            >
              <Text className={city ? 'font-semibold text-ink dark:text-ink-dark' : 'font-semibold text-ink-faint dark:text-ink-faint-dark'}>
                {city ? city.name : t('clubLocationPlaceholder')}
              </Text>
              <Icon name="chevron-forward" size="sm" color="muted" />
            </Pressable>
            <Text className="text-xs text-ink-muted dark:text-ink-muted-dark">{t('clubLocationHint')}</Text>
          </VStack>

          <VStack className="gap-2">
            <Text className="text-sm font-bold text-ink-muted dark:text-ink-muted-dark">{t('clubDescriptionPlaceholder')}</Text>
            <Input>
              <InputField value={description} onChangeText={setDescription} maxLength={200} />
            </Input>
          </VStack>

          <VStack className="gap-1">
            <HStack className="justify-between items-center">
              <Text className="text-sm font-bold text-ink-muted dark:text-ink-muted-dark">{t('clubPrivateToggleLabel')}</Text>
              <Switch value={isPrivate} onValueChange={setIsPrivate} />
            </HStack>
            <Text className="text-xs text-ink-muted dark:text-ink-muted-dark">{isPrivate ? t('clubPrivateJoinHint') : t('clubPublicJoinHint')}</Text>
          </VStack>

          {error && <Text className="text-sm text-red-500">{error}</Text>}

          <Button
            size="xl"
            isDisabled={!name.trim() || !city || submitting}
            className="w-full"
            onPress={handleSubmit}
          >
            <ButtonText>{t('clubCreateSubmit')}</ButtonText>
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
      <CityPickerModal
        visible={showCityPicker}
        title={t('clubLocationLabel')}
        selectedCode={city?.code}
        onSelect={(picked) => {
          setCity(picked);
          setShowCityPicker(false);
        }}
        onClose={() => setShowCityPicker(false)}
      />
    </SafeAreaView>
  );
}
