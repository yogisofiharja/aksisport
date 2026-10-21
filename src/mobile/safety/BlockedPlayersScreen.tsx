import { useCallback, useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { VStack } from '../../design-system/layout/VStack';
import { HStack } from '../../design-system/layout/HStack';
import { Typography } from '../../design-system/ui/Typography';
import { Card } from '../../design-system/ui/Card';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { Loading } from '../../design-system/feedback/Loading';
import { EmptyState } from '../../design-system/feedback/EmptyState';
import { useTranslation } from '../../i18n';
import { authHeader, userAvatarUrl } from '../../core/api/client';
import { listMyBlocks, unblockUser } from '../../core/safety/api';
import { initialsFromName } from '../../core/initials';
import type { BlockedUser } from '../../core/api/types';
import { AppBar } from '../../design-system/layout/AppBar';

type Props = {
  onBack: () => void;
};

// Settings › Blocked players (DP-021): everyone you blocked, and where
// blocking is undone.
export function BlockedPlayersScreen({ onBack }: Props) {
  const { t } = useTranslation();
  const [blocks, setBlocks] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageHeaders, setImageHeaders] = useState<Record<string, string>>({});

  useEffect(() => {
    authHeader().then(setImageHeaders);
  }, []);

  const load = useCallback(async () => {
    try {
      setBlocks(await listMyBlocks());
    } catch {
      // stays stale
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleUnblock(userId: string) {
    setBlocks((prev) => prev.filter((b) => b.userId !== userId));
    await unblockUser(userId).catch(load);
  }

  return (
    <ScrollPage gap="lg" appBar={<AppBar title={t('blockedPlayersTitle')} onBack={onBack} />}>
      <Typography variant="body" color="muted">
        {t('blockedPlayersExplainer')}
      </Typography>

      {loading && blocks.length === 0 ? (
        <Loading />
      ) : blocks.length === 0 ? (
        <EmptyState message={t('blockedPlayersEmpty')} />
      ) : (
        <VStack space="md">
          {blocks.map((b) => {
            const name = b.displayName || b.username;
            return (
              <Card key={b.userId}>
                <HStack className="items-center" space="md">
                  <View className="w-10 h-10 rounded-full items-center justify-center overflow-hidden bg-surface-sunken dark:bg-surface-sunken-dark">
                    {b.hasAvatar ? (
                      <Image source={{ uri: userAvatarUrl(b.userId), headers: imageHeaders }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <Typography variant="body" className="text-sm font-extrabold text-ink-muted dark:text-ink-muted-dark">
                        {initialsFromName(name)}
                      </Typography>
                    )}
                  </View>
                  <VStack style={{ flex: 1 }}>
                    <Typography variant="body" className="font-bold" numberOfLines={1}>
                      {name}
                    </Typography>
                    <Typography variant="body" color="muted" className="text-sm">
                      @{b.username}
                    </Typography>
                  </VStack>
                  <Button size="sm" variant="outline" onPress={() => handleUnblock(b.userId)}>
                    <ButtonText variant="outline">
                      {t('blockUnblock')}
                    </ButtonText>
                  </Button>
                </HStack>
              </Card>
            );
          })}
        </VStack>
      )}
    </ScrollPage>
  );
}
