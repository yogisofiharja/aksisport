import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Button, ButtonText } from '../../../components/ui/button';
import { Box, HStack, VStack } from '../../../components/ui/box';
import { Heading, Text } from '../../../components/ui/text';
import { Pressable } from '../../../components/ui/pressable';
import { useTranslation } from '../../i18n';
import { listClubs } from '../../core/clubs/api';
import type { ClubWithRole } from '../../core/api/types';

type Props = {
  onOpenClub: (clubId: string) => void;
  onCreateClub: () => void;
  onJoinClub: () => void;
};

export function ClubListScreen({ onOpenClub, onCreateClub, onJoinClub }: Props) {
  const { t } = useTranslation();
  const [clubs, setClubs] = useState<ClubWithRole[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const result = await listClubs();
      setClubs(result);
    } catch {
      // stays empty; user can pull to refresh
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
      <ScrollView
        contentContainerClassName="px-5 pt-4 pb-6 gap-4"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        <Heading size="2xl">{t('clubListTitle')}</Heading>

        {loading && clubs.length === 0 ? (
          <Box className="items-center py-10">
            <ActivityIndicator size="large" />
          </Box>
        ) : clubs.length === 0 ? (
          <Text className="text-slate-500 dark:text-slate-400">{t('clubEmptyState')}</Text>
        ) : (
          <VStack className="gap-3">
            {clubs.map((club) => (
              <Pressable
                key={club.id}
                className="bg-white dark:bg-slate-800 rounded-2xl p-4 active:opacity-70"
                onPress={() => onOpenClub(club.id)}
              >
                <HStack className="justify-between items-center">
                  <VStack className="gap-1 flex-1">
                    <Text className="text-lg font-bold text-slate-900 dark:text-white">{club.name}</Text>
                    <Text className="text-sm text-slate-400">
                      {club.role === 'owner' ? t('clubRoleOwner') : club.role === 'admin' ? t('clubRoleAdmin') : t('clubRoleMember')}
                    </Text>
                  </VStack>
                </HStack>
              </Pressable>
            ))}
          </VStack>
        )}

        <VStack className="gap-3 pt-4">
          <Button action="secondary" size="xl" className="w-full rounded-2xl bg-blue-600" onPress={onCreateClub}>
            <ButtonText className="text-white text-lg">{t('clubCreate')}</ButtonText>
          </Button>
          <Button action="secondary" variant="outline" size="xl" className="w-full rounded-2xl" onPress={onJoinClub}>
            <ButtonText className="text-lg">{t('clubJoin')}</ButtonText>
          </Button>
        </VStack>
      </ScrollView>
    </SafeAreaView>
  );
}
