import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon } from '../../design-system/ui/Icon';
import { useAuth } from '../../core/auth/AuthContext';
import type { MainStackParamList } from '../../navigation/MainStack';
import { HStack } from '../../design-system/layout/HStack';
import { VStack } from '../../design-system/layout/VStack';
import { Typography } from '../../design-system/ui/Typography';
import { Badge } from '../../design-system/ui/Badge';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { useTranslation } from '../../i18n';
import { authHeader, getPlayerProfile, userAvatarUrl } from '../../core/api/client';
import { initialsFromName } from '../../core/initials';
import { listSportIds } from '../../sports/registry';
import type { PlayerProfile, SkillLevel } from '../../core/api/types';

export type ProfileSheetAction = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

type Props = {
  // The player to show; null closes the sheet.
  userId: string | null;
  onClose: () => void;
  // Opened from a Session: its sport is listed first, and with a level
  // range the sheet says whether the player is within it.
  sport?: string;
  levelRange?: { min: SkillLevel; max: SkillLevel };
  // E.g. Approve / Decline on a pending request. Each closes the sheet.
  actions?: ProfileSheetAction[];
};

function sportLabel(sport: string, t: (key: string) => string) {
  return sport === 'tennis' ? t('sportTennis') : sport;
}

// A player's profile (DP-019): picture, name, username, online, when they
// joined, and their skill level in every sport. A Chat button at the top
// opens a direct conversation (DP-020); each sport opens that sport's page
// with the player's history. Used by organizers deciding on a request to
// join, and from a direct conversation's header.
export function PlayerProfileSheet({ userId, onClose, sport, levelRange, actions }: Props) {
  const { t, lang } = useTranslation();
  const { profile: me } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [failed, setFailed] = useState(false);
  const [imageHeaders, setImageHeaders] = useState<Record<string, string>>({});

  useEffect(() => {
    authHeader().then(setImageHeaders);
  }, []);

  useEffect(() => {
    setProfile(null);
    setFailed(false);
    if (!userId) return;
    let cancelled = false;
    getPlayerProfile(userId)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Every sport the app knows, the Session's own first, each with the
  // player's level or "not set".
  const sports = listSportIds().sort((a, b) => (a === sport ? -1 : b === sport ? 1 : 0));
  const name = profile ? profile.displayName || profile.username : '';

  return (
    <Modal visible={userId !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/50 dark:bg-black/70" onPress={onClose}>
        <Pressable
          className="w-full self-center bg-white dark:bg-slate-800 rounded-t-3xl px-6 pt-6 pb-10 gap-5"
          style={{ maxWidth: 520 }}
          onPress={() => {}}
        >
          <View className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600 self-center" />

          {failed ? (
            <Typography variant="body" color="muted" style={{ textAlign: 'center' }}>
              {t('playerProfileUnavailable')}
            </Typography>
          ) : !profile ? (
            <ActivityIndicator size="large" />
          ) : (
            <>
              <HStack space="md" className="items-center">
                <View className={`rounded-full ${profile.isOnline ? 'border-2 border-green-500 p-0.5' : ''}`}>
                  <View className="w-16 h-16 rounded-full items-center justify-center overflow-hidden bg-slate-100 dark:bg-slate-700">
                    {profile.hasAvatar ? (
                      <Image source={{ uri: userAvatarUrl(profile.id), headers: imageHeaders }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <Typography variant="body" className="text-lg font-extrabold text-slate-600 dark:text-slate-300">
                        {initialsFromName(name)}
                      </Typography>
                    )}
                  </View>
                </View>
                <VStack space="xs" style={{ flex: 1 }}>
                  <HStack className="items-center justify-between" space="sm">
                    <Typography variant="title" numberOfLines={1} style={{ flex: 1 }}>
                      {name}
                    </Typography>
                    {profile.id !== me?.id && (
                      <Pressable
                        onPress={() => {
                          onClose();
                          navigation.navigate('DirectMessage', { userId: profile.id });
                        }}
                        className="flex-row items-center gap-1 px-3 py-1.5 rounded-full bg-blue-600 active:opacity-70"
                        accessibilityLabel={t('playerProfileChat')}
                      >
                        <Icon name="chatbubble-ellipses-outline" size="xs" color="onBrand" />
                        <Typography variant="body" className="text-sm font-bold text-white">
                          {t('playerProfileChat')}
                        </Typography>
                      </Pressable>
                    )}
                  </HStack>
                  <Typography variant="body" color="muted" className="text-sm">
                    @{profile.username}
                    {profile.isOnline ? ` · ${t('playerProfileOnline')}` : ''}
                  </Typography>
                  <Typography variant="body" color="muted" className="text-sm">
                    {t('playerProfileJoined', new Date(profile.joinedAt).toLocaleDateString(lang, { month: 'long', year: 'numeric' }))}
                  </Typography>
                </VStack>
              </HStack>

              <VStack space="sm">
                <Typography variant="caption" color="muted">
                  {t('playerProfileSkillLevels')}
                </Typography>
                {sports.map((s) => {
                  const level = profile.skillLevels.find((l) => l.sport === s);
                  const inRange =
                    s === sport && levelRange && level
                      ? level.skillLevelRank >= levelRange.min.rank && level.skillLevelRank <= levelRange.max.rank
                      : undefined;
                  return (
                    <Pressable
                      key={s}
                      onPress={() => {
                        onClose();
                        navigation.navigate('PlayerSport', { userId: profile.id, sport: s });
                      }}
                      className="flex-row justify-between items-center gap-3 py-2 active:opacity-60"
                      accessibilityLabel={t('playerProfileOpenSport', sportLabel(s, t))}
                    >
                      <Typography variant="body" className="font-semibold">
                        {sportLabel(s, t)}
                      </Typography>
                      <HStack space="sm" className="items-center">
                        <Typography variant="body" color={level ? 'default' : 'muted'}>
                          {level ? level.skillLevelName : t('skillLevelNotSet')}
                        </Typography>
                        {s === sport && levelRange && (
                          <Badge
                            action={inRange ? 'success' : 'warning'}
                            text={
                              inRange
                                ? t('playerProfileInRange')
                                : level
                                  ? t('playerProfileOutOfRange', levelRange.min.name, levelRange.max.name)
                                  : t('playerProfileRangeUnknown')
                            }
                          />
                        )}
                        <Icon name="chevron-forward" size="sm" color="muted" />
                      </HStack>
                    </Pressable>
                  );
                })}
              </VStack>

              {actions && actions.length > 0 && (
                <HStack space="md">
                  {actions.map((a) => (
                    <Button
                      key={a.label}
                      action={a.destructive ? 'negative' : 'secondary'}
                      variant={a.destructive ? 'outline' : 'solid'}
                      className="flex-1"
                      onPress={() => {
                        onClose();
                        a.onPress();
                      }}
                    >
                      <ButtonText action={a.destructive ? 'negative' : 'secondary'} variant={a.destructive ? 'outline' : 'solid'}>
                        {a.label}
                      </ButtonText>
                    </Button>
                  ))}
                </HStack>
              )}
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
