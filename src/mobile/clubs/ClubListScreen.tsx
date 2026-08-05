import { useCallback, useState } from 'react';
import { Pressable, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { VStack } from '../../design-system/layout/VStack';
import { HStack } from '../../design-system/layout/HStack';
import { Typography } from '../../design-system/ui/Typography';
import { Icon } from '../../design-system/ui/Icon';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { Loading } from '../../design-system/feedback/Loading';
import { EmptyState } from '../../design-system/feedback/EmptyState';
import { ClubCard } from '../../design-system/domain-ui/ClubCard';
import { useTranslation } from '../../i18n';
import { listClubs } from '../../core/clubs/api';
import type { ClubWithRole } from '../../core/api/types';
import { spacing } from '../../design-system/foundation/spacing';

type Props = {
  onOpenClub: (clubId: string) => void;
  onCreateClub: () => void;
  onJoinClub: () => void;
  onOpenProfile: () => void;
};

export function ClubListScreen({ onOpenClub, onCreateClub, onJoinClub, onOpenProfile }: Props) {
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

  function roleLabel(role: ClubWithRole['role']) {
    return role === 'owner' ? t('clubRoleOwner') : role === 'admin' ? t('clubRoleAdmin') : t('clubRoleMember');
  }

  return (
    <ScrollPage gap="lg" refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <HStack className="justify-between items-center">
        <Typography variant="display">{t('clubListTitle')}</Typography>
        <Pressable className="p-2 active:opacity-60" onPress={onOpenProfile}>
          <Icon name="person-circle-outline" size="lg" />
        </Pressable>
      </HStack>

      {loading && clubs.length === 0 ? (
        <Loading />
      ) : clubs.length === 0 ? (
        <EmptyState message={t('clubEmptyState')} />
      ) : (
        <VStack space="md">
          {clubs.map((club) => (
            <ClubCard key={club.id} name={club.name} subtitle={roleLabel(club.role)} onPress={() => onOpenClub(club.id)} />
          ))}
        </VStack>
      )}

      <VStack space="md" style={{ paddingTop: spacing.lg }}>
        <Button action="secondary" size="xl" className="w-full" onPress={onCreateClub}>
          <ButtonText className="text-lg">{t('clubCreate')}</ButtonText>
        </Button>
        <Button action="secondary" variant="outline" size="xl" className="w-full" onPress={onJoinClub}>
          <ButtonText action="secondary" variant="outline" className="text-lg">
            {t('clubJoin')}
          </ButtonText>
        </Button>
      </VStack>
    </ScrollPage>
  );
}
