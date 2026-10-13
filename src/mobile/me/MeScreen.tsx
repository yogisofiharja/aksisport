import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { VStack } from '../../design-system/layout/VStack';
import { HStack } from '../../design-system/layout/HStack';
import { Typography } from '../../design-system/ui/Typography';
import { Icon } from '../../design-system/ui/Icon';
import { Card } from '../../design-system/ui/Card';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import { authHeader, uploadMyAvatar, userAvatarUrl } from '../../core/api/client';
import { listMySkillLevels, listSkillLevels, setMySkillLevel } from '../../core/skillLevels/api';
import { listSportIds } from '../../sports/registry';
import { initialsFromName } from '../../core/initials';
import { pickImageAsDataUrl, parseDataUrl } from '../../imagePicker';
import type { SkillLevel, UserSkillLevel } from '../../core/api/types';

type Props = {
  onOpenSettings: () => void;
  onCreateClub: () => void;
  onOpenHistory: () => void;
};

// DP-008: only the sport name is translated — level names are data-driven
// from the API, no per-level i18n keys.
function sportLabel(sport: string, t: (key: string) => string) {
  return sport === 'tennis' ? t('sportTennis') : sport;
}

export function MeScreen({ onOpenSettings, onCreateClub, onOpenHistory }: Props) {
  const { t } = useTranslation();
  const { profile, refreshProfile } = useAuth();
  const sports = listSportIds();
  const [myLevels, setMyLevels] = useState<UserSkillLevel[]>([]);
  const [expandedSport, setExpandedSport] = useState<string | null>(null);
  const [levelsBySport, setLevelsBySport] = useState<Record<string, SkillLevel[]>>({});
  const [busy, setBusy] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  // GET /me/avatar is behind the same auth as every other route — fetched
  // once per mount, same convention as ClubMembersScreen/SessionChat's own
  // image headers.
  const [imageHeaders, setImageHeaders] = useState<Record<string, string>>({});

  useEffect(() => {
    authHeader().then(setImageHeaders);
  }, []);

  useFocusEffect(
    useCallback(() => {
      listMySkillLevels()
        .then(setMyLevels)
        .catch(() => {
          // keep stale state; user can retry via pull-to-refresh elsewhere
        });
    }, [])
  );

  // Self-service only — this is the user's own profile picture, never
  // reachable for anyone else's.
  function handleChangeAvatar() {
    Alert.alert(t('sessionChatAttachImageTitle'), undefined, [
      { text: t('sessionChatAttachCamera'), onPress: () => pickAndUploadAvatar('camera') },
      { text: t('sessionChatAttachGallery'), onPress: () => pickAndUploadAvatar('gallery') },
      { text: t('clubCancel'), style: 'cancel' },
    ]);
  }

  async function pickAndUploadAvatar(source: 'camera' | 'gallery') {
    const dataUrl = await pickImageAsDataUrl(source);
    if (!dataUrl) return;
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) return;
    setUploadingAvatar(true);
    try {
      await uploadMyAvatar(parsed);
      await refreshProfile();
    } catch {
      // stays on the previous picture; user can retry
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleToggleEdit(sport: string) {
    if (expandedSport === sport) {
      setExpandedSport(null);
      return;
    }
    setExpandedSport(sport);
    if (!levelsBySport[sport]) {
      const levels = await listSkillLevels(sport);
      setLevelsBySport((prev) => ({ ...prev, [sport]: levels }));
    }
  }

  async function handlePick(sport: string, skillLevelId: string) {
    if (busy) return;
    setBusy(true);
    try {
      const updated = await setMySkillLevel(sport, skillLevelId);
      setMyLevels((prev) => [updated, ...prev.filter((l) => l.sport !== sport)]);
      setExpandedSport(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollPage gap="lg">
      <HStack className="justify-between items-center">
        <HStack space="md" className="items-center">
          {/* Tap to change — self-service only, this is always the caller's
              own profile picture. */}
          <Pressable onPress={handleChangeAvatar} disabled={uploadingAvatar} className="active:opacity-70">
            <View className="w-16 h-16 rounded-full items-center justify-center overflow-hidden bg-slate-100 dark:bg-slate-700 border-2 border-blue-500">
              {profile?.hasAvatar ? (
                <Image
                  source={{ uri: userAvatarUrl(profile.id), headers: imageHeaders }}
                  style={{ width: '100%', height: '100%' }}
                />
              ) : (
                <Typography variant="body" className="text-lg font-extrabold text-slate-600 dark:text-slate-300">
                  {initialsFromName(profile?.displayName || profile?.username || '?')}
                </Typography>
              )}
            </View>
          </Pressable>
          <VStack space="xs">
            <Typography variant="display">{profile?.displayName || profile?.username}</Typography>
            {profile?.displayName && (
              <Typography variant="body" color="muted">
                @{profile.username}
              </Typography>
            )}
          </VStack>
        </HStack>
        <HStack space="sm" className="items-center">
          {/* Create Community lives here, not on Home — UX-013 (Navigation
              Follows Frequency): a deliberate, infrequent action belongs in
              secondary navigation, not sitting among Home's everyday
              browsing content. */}
          <Pressable className="p-2 active:opacity-60" onPress={onCreateClub} hitSlop={8}>
            <Icon name="add-circle-outline" size="lg" />
          </Pressable>
          <Pressable className="p-2 -mr-2 active:opacity-60" onPress={onOpenSettings}>
            <Icon name="settings-outline" size="lg" />
          </Pressable>
        </HStack>
      </HStack>

      <VStack space="sm">
        <Typography variant="caption" color="muted">
          {t('meSportsTitle')}
        </Typography>
        <VStack space="md">
          {sports.map((sport) => {
            const mine = myLevels.find((l) => l.sport === sport);
            const expanded = expandedSport === sport;
            return (
              <Card key={sport}>
                <VStack space="sm">
                  <Typography variant="title">{sportLabel(sport, t)}</Typography>
                  <HStack className="justify-between items-center">
                    <Typography variant="body" color={mine ? 'default' : 'muted'}>
                      {mine ? mine.skillLevelName : t('skillLevelNotSet')}
                    </Typography>
                    <Pressable className="p-2 -mr-2 active:opacity-60" onPress={() => handleToggleEdit(sport)} hitSlop={8}>
                      <Icon name="create-outline" size="sm" color="secondary" />
                    </Pressable>
                  </HStack>
                  {expanded && (
                    <HStack className="gap-2 flex-wrap">
                      {(levelsBySport[sport] ?? []).map((level) => {
                        const selected = mine?.skillLevelId === level.id;
                        return (
                          <Pressable
                            key={level.id}
                            disabled={busy}
                            className={`px-3 py-2 rounded-full ${selected ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                            onPress={() => handlePick(sport, level.id)}
                          >
                            <Typography variant="body" className={selected ? 'text-white font-bold' : 'text-slate-600 dark:text-slate-300'}>
                              {level.name}
                            </Typography>
                          </Pressable>
                        );
                      })}
                    </HStack>
                  )}
                </VStack>
              </Card>
            );
          })}
        </VStack>
      </VStack>

      {/* DP-009: the Player's own Session History — every Session joined,
          across all Clubs. */}
      <Card pressable onPress={onOpenHistory}>
        <HStack className="justify-between items-center">
          <Typography variant="title">{t('mySessionHistoryTitle')}</Typography>
          <Icon name="chevron-forward" size="sm" color="muted" />
        </HStack>
      </Card>
    </ScrollPage>
  );
}
