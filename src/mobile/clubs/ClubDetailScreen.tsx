import { useCallback, useState } from 'react';
import { Alert, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Page } from '../../design-system/layout/Page';
import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { VStack } from '../../design-system/layout/VStack';
import { HStack } from '../../design-system/layout/HStack';
import { Typography } from '../../design-system/ui/Typography';
import { Icon } from '../../design-system/ui/Icon';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { Card } from '../../design-system/ui/Card';
import { Loading } from '../../design-system/feedback/Loading';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import { deleteClub, getClub, listMembers, regenerateInviteCode } from '../../core/clubs/api';
import type { Club } from '../../core/api/types';

type Props = {
  clubId: string;
  onBack: () => void;
  onOpenMembers: (clubId: string) => void;
  onOpenSessions: (clubId: string) => void;
  onDeleted: () => void;
};

export function ClubDetailScreen({ clubId, onBack, onOpenMembers, onOpenSessions, onDeleted }: Props) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [club, setClub] = useState<Club | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [clubResult, members] = await Promise.all([getClub(clubId), listMembers(clubId)]);
      setClub(clubResult);
      setIsOwner(members.some((m) => m.userId === profile?.id && m.role === 'owner'));
    } catch {
      // leave stale state; user can back out and retry
    } finally {
      setLoading(false);
    }
  }, [clubId, profile?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleRegenerate() {
    if (busy) return;
    setBusy(true);
    try {
      const updated = await regenerateInviteCode(clubId);
      setClub(updated);
    } finally {
      setBusy(false);
    }
  }

  function handleDelete() {
    Alert.alert(t('clubDeleteConfirmTitle'), t('clubDeleteConfirmDesc'), [
      { text: t('clubCancel'), style: 'cancel' },
      {
        text: t('clubConfirm'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await deleteClub(clubId);
            onDeleted();
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  if (loading || !club) {
    return (
      <Page>
        <Loading fullScreen />
      </Page>
    );
  }

  return (
    <ScrollPage>
      <Pressable className="p-2 -ml-2 active:opacity-60 self-start" onPress={onBack}>
        <Icon name="arrow-back" size="lg" />
      </Pressable>

      <VStack space="xs">
        <Typography variant="display">{club.name}</Typography>
        {club.description && (
          <Typography variant="body" color="muted">
            {club.description}
          </Typography>
        )}
      </VStack>

      <Card>
        <HStack className="justify-between">
          <VStack space="xs">
            <Typography variant="caption" color="muted">
              {t('clubInviteCodeLabel')}
            </Typography>
            <Typography variant="title" color="default" className="tracking-[4px]">
              {club.inviteCode}
            </Typography>
          </VStack>
          {isOwner && (
            <Pressable className="p-2 active:opacity-60" onPress={handleRegenerate} disabled={busy}>
              <Icon name="refresh" size="lg" />
            </Pressable>
          )}
        </HStack>
      </Card>

      <Button action="secondary" size="xl" className="w-full" onPress={() => onOpenSessions(clubId)}>
        <ButtonText className="text-lg">{t('sessionListTitle')}</ButtonText>
      </Button>

      <Button action="secondary" variant="outline" size="xl" className="w-full" onPress={() => onOpenMembers(clubId)}>
        <ButtonText action="secondary" variant="outline" className="text-lg">
          {t('clubMembersTitle')}
        </ButtonText>
      </Button>

      {isOwner && (
        <Pressable className="items-center py-3" onPress={handleDelete} disabled={busy}>
          <Typography variant="body" color="destructive" className="font-bold">
            {t('clubDeleteClub')}
          </Typography>
        </Pressable>
      )}
    </ScrollPage>
  );
}
