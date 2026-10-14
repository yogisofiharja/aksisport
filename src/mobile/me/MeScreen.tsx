import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { appAlert } from '../../design-system/feedback/appAlert';
import { useFocusEffect } from '@react-navigation/native';
import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { VStack } from '../../design-system/layout/VStack';
import { HStack } from '../../design-system/layout/HStack';
import { Typography } from '../../design-system/ui/Typography';
import { Icon } from '../../design-system/ui/Icon';
import { Card } from '../../design-system/ui/Card';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import { addMyCity, authHeader, removeMyCity, updateMe, uploadMyAvatar, userAvatarUrl } from '../../core/api/client';
import { Badge } from '../../design-system/ui/Badge';
import { CityPickerModal } from '../locations/CityPickerModal';
import { listMySkillLevels, listSkillLevels, setMySkillLevel } from '../../core/skillLevels/api';
import { listSportIds } from '../../sports/registry';
import { initialsFromName } from '../../core/initials';
import { pickImageAsDataUrl, parseDataUrl } from '../../imagePicker';
import { storageGet, storageSave } from '../../storage';
import type { SkillLevel, UserSkillLevel } from '../../core/api/types';

type Props = {
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onOpenEmail: () => void;
  onOpenDisplayName: () => void;
  onOpenSport: (sport: string) => void;
};

// DP-008: only the sport name is translated — level names are data-driven
// from the API, no per-level i18n keys.
function sportLabel(sport: string, t: (key: string) => string) {
  return sport === 'tennis' ? t('sportTennis') : sport;
}

export function MeScreen({ onOpenSettings, onOpenHistory, onOpenEmail, onOpenDisplayName, onOpenSport }: Props) {
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

  // DP-015: an account with no confirmed email gets a reminder it can
  // dismiss. Remembered per user on this device; starts hidden until the
  // stored answer is read, so a dismissed reminder never flashes.
  const reminderKey = profile ? `aksi.emailReminderDismissed.${profile.id}` : null;
  const [reminderDismissed, setReminderDismissed] = useState(true);
  useEffect(() => {
    if (!reminderKey) return;
    storageGet(reminderKey)
      .then((value) => setReminderDismissed(value === '1'))
      .catch(() => setReminderDismissed(false));
  }, [reminderKey]);

  // DP-017: the User's towns — several kept, one active. Every change
  // saves at once; the profile is the only state.
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [townError, setTownError] = useState<string | null>(null);

  async function changeTowns(action: () => Promise<unknown>) {
    setShowCityPicker(false);
    setTownError(null);
    try {
      await action();
      await refreshProfile();
    } catch (err) {
      setTownError(err instanceof Error ? err.message : t('authGenericError'));
    }
  }

  function dismissReminder() {
    setReminderDismissed(true);
    if (reminderKey) storageSave(reminderKey, '1').catch(() => {});
  }

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
    appAlert(t('sessionChatAttachImageTitle'), undefined, [
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
          <Pressable className="p-2 -mr-2 active:opacity-60" onPress={onOpenSettings}>
            <Icon name="settings-outline" size="lg" />
          </Pressable>
        </HStack>
      </HStack>

      <VStack space="sm">
        <Typography variant="caption" color="muted">
          {t('meAccountTitle')}
        </Typography>
        {!profile?.email && !reminderDismissed && (
          <Card>
            <HStack className="justify-between items-start" space="md">
              <VStack space="xs" style={{ flex: 1 }}>
                <Typography variant="body" className="font-bold">
                  {t('meEmailReminderTitle')}
                </Typography>
                <Typography variant="body" color="muted">
                  {t('meEmailReminderDesc')}
                </Typography>
              </VStack>
              <Pressable className="p-1 active:opacity-60" onPress={dismissReminder} hitSlop={8} accessibilityLabel={t('meEmailReminderDismiss')}>
                <Icon name="close" size="sm" color="muted" />
              </Pressable>
            </HStack>
          </Card>
        )}
        <Card pressable onPress={onOpenDisplayName}>
          <HStack className="justify-between items-center" space="md">
            <VStack space="xs" style={{ flex: 1 }}>
              <Typography variant="body" className="font-bold">
                {t('displayNameLabel')}
              </Typography>
              <Typography variant="body" color={profile?.displayName ? 'default' : 'muted'} numberOfLines={1}>
                {profile?.displayName ?? t('meEmailNotSet')}
              </Typography>
            </VStack>
            <Typography variant="body" className="font-bold text-blue-600 dark:text-blue-400">
              {profile?.displayName ? t('meEmailChange') : t('meEmailAdd')}
            </Typography>
          </HStack>
        </Card>
        <Card>
          <VStack space="sm">
            <VStack space="xs">
              <Typography variant="body" className="font-bold">
                {t('townsLabel')}
              </Typography>
              <Typography variant="body" color="muted" className="text-sm">
                {t('townsHint')}
              </Typography>
            </VStack>
            {(profile?.cities ?? []).map((city) => {
              const active = city.code === profile?.cityCode;
              return (
                <HStack key={city.code} className="items-center" space="sm">
                  <Pressable
                    style={{ flex: 1 }}
                    className="active:opacity-60"
                    disabled={active}
                    onPress={() => changeTowns(() => updateMe({ cityCode: city.code }))}
                    accessibilityLabel={active ? undefined : t('townsMakeActive', city.name)}
                  >
                    <HStack className="items-center" space="sm">
                      <Icon name={active ? 'radio-button-on' : 'radio-button-off'} size="sm" color={active ? 'secondary' : 'muted'} />
                      <Typography variant="body" style={{ flex: 1 }} numberOfLines={1}>
                        {city.name}
                      </Typography>
                      {active && <Badge action="info" text={t('townsActiveBadge')} />}
                    </HStack>
                  </Pressable>
                  <Pressable
                    onPress={() => changeTowns(() => removeMyCity(city.code))}
                    hitSlop={8}
                    className="p-1 active:opacity-60"
                    accessibilityLabel={t('townsRemove', city.name)}
                  >
                    <Icon name="close" size="sm" color="muted" />
                  </Pressable>
                </HStack>
              );
            })}
            <Pressable onPress={() => setShowCityPicker(true)} className="active:opacity-60 self-start">
              <HStack className="items-center" space="xs">
                <Icon name="add" size="sm" color="secondary" />
                <Typography variant="body" className="font-bold text-blue-600 dark:text-blue-400">
                  {t('townsAdd')}
                </Typography>
              </HStack>
            </Pressable>
            {townError && (
              <Typography variant="body" color="destructive" className="text-sm">
                {townError}
              </Typography>
            )}
          </VStack>
        </Card>
        <Card pressable onPress={onOpenEmail}>
          <HStack className="justify-between items-center" space="md">
            <VStack space="xs" style={{ flex: 1 }}>
              <Typography variant="body" className="font-bold">
                {t('authEmail')}
              </Typography>
              <Typography variant="body" color={profile?.email ? 'default' : 'muted'} numberOfLines={1}>
                {profile?.email ?? t('meEmailNotSet')}
              </Typography>
            </VStack>
            <Typography variant="body" className="font-bold text-blue-600 dark:text-blue-400">
              {profile?.email ? t('meEmailChange') : t('meEmailAdd')}
            </Typography>
          </HStack>
        </Card>
      </VStack>

      <VStack space="sm">
        <Typography variant="caption" color="muted">
          {t('meSportsTitle')}
        </Typography>
        <VStack space="md">
          {sports.map((sport) => {
            const mine = myLevels.find((l) => l.sport === sport);
            const expanded = expandedSport === sport;
            return (
              // Tapping the card opens your own page for that sport
              // (history, DP-019); the pencil still edits the level here.
              <Card key={sport} pressable onPress={() => onOpenSport(sport)}>
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

      <CityPickerModal
        visible={showCityPicker}
        title={t('townsAdd')}
        onSelect={(city) => changeTowns(() => addMyCity(city.code))}
        onClose={() => setShowCityPicker(false)}
      />
    </ScrollPage>
  );
}
