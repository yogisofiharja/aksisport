import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { appAlert } from '../../design-system/feedback/appAlert';
import { useFocusEffect } from '@react-navigation/native';
import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { VStack } from '../../design-system/layout/VStack';
import { HStack } from '../../design-system/layout/HStack';
import { Typography } from '../../design-system/ui/Typography';
import { Icon } from '../../design-system/ui/Icon';
import { Card } from '../../design-system/ui/Card';
import { Chip } from '../../design-system/ui/Chip';
import { ListGroup, ListRow } from '../../design-system/ui/List';
import { Sheet } from '../../design-system/feedback/Sheet';
import { SportCard } from '../../design-system/domain-ui/SportCard';
import { getPlayerSportActivity } from '../../core/api/client';
import { winRate } from '../../core/players/winRate';
import { shortCityName } from '../../core/locations/cityName';
import type { PlayerSportActivity } from '../../core/api/types';
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
import { AppBar } from '../../design-system/layout/AppBar';

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
  const [sports] = useState(listSportIds);
  const [myLevels, setMyLevels] = useState<UserSkillLevel[]>([]);
  // The sport whose level is being changed, in a Sheet.
  const [editingSport, setEditingSport] = useState<string | null>(null);
  const [showTowns, setShowTowns] = useState(false);
  // Each sport's totals (DP-019), for "23 matches · 14 won · 61%".
  const [summaries, setSummaries] = useState<Record<string, PlayerSportActivity['summary']>>({});
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

  const myId = profile?.id;
  useFocusEffect(
    useCallback(() => {
      listMySkillLevels()
        .then(setMyLevels)
        .catch(() => {
          // keep stale state; user can retry via pull-to-refresh elsewhere
        });
      if (!myId) return;
      for (const sport of sports) {
        getPlayerSportActivity(myId, sport)
          .then((a) => setSummaries((prev) => ({ ...prev, [sport]: a.summary })))
          .catch(() => {
            // the card shows the level alone
          });
      }
    }, [myId, sports])
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

  async function handleEditLevel(sport: string) {
    setEditingSport(sport);
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
      setEditingSport(null);
    } finally {
      setBusy(false);
    }
  }

  const name = profile?.displayName || profile?.username || '?';
  const subline = [profile?.username ? `@${profile.username}` : null, profile?.cityName ? shortCityName(profile.cityName) : null]
    .filter(Boolean)
    .join(' · ');
  const towns = (profile?.cities ?? [])
    .map((city) => (city.code === profile?.cityCode ? t('meTownActive', shortCityName(city.name)) : shortCityName(city.name)))
    .join(', ');
  const editingLevel = editingSport ? myLevels.find((l) => l.sport === editingSport) : undefined;

  return (
    <ScrollPage
      gap="lg"
      appBar={<AppBar variant="root" actions={[{ icon: 'settings-outline', label: t('settingsTitle'), onPress: onOpenSettings }]} />}
    >
      {/* Profile header (Aksi redesign › Me): picture (tap to change —
          self-service only, always the caller's own), name, @username ·
          active town, Edit profile. */}
      <HStack space="lg" className="items-center">
        <Pressable
          onPress={handleChangeAvatar}
          disabled={uploadingAvatar}
          accessibilityRole="button"
          accessibilityLabel={t('meChangePhoto')}
          className="active:opacity-70"
        >
          <View className="w-[76px] h-[76px] rounded-full items-center justify-center overflow-hidden bg-asphalt dark:bg-asphalt-dark">
            {profile?.hasAvatar ? (
              <Image source={{ uri: userAvatarUrl(profile.id), headers: imageHeaders }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <Text className="font-display text-[26px] text-on-asphalt">{initialsFromName(name)}</Text>
            )}
          </View>
          <View className="absolute -right-0.5 -bottom-0.5 w-7 h-7 rounded-full items-center justify-center bg-surface dark:bg-surface-dark border border-border dark:border-border-dark">
            <Icon name="camera-outline" size="xs" />
          </View>
        </Pressable>
        <VStack style={{ flex: 1, minWidth: 0 }}>
          <Text accessibilityRole="header" numberOfLines={1} className="font-display-hero text-[28px] leading-[32px] text-ink dark:text-ink-dark">
            {name}
          </Text>
          {subline ? (
            <Typography variant="body" color="muted" className="text-sm leading-5" numberOfLines={1}>
              {subline}
            </Typography>
          ) : null}
          <Pressable onPress={onOpenDisplayName} accessibilityRole="button" hitSlop={8} className="self-start mt-1 active:opacity-60">
            <Typography variant="label" color="brand" className="text-[13px]">
              {t('meEditProfile')}
            </Typography>
          </Pressable>
        </VStack>
      </HStack>

      {/* DP-015: an account with no confirmed email gets a reminder. */}
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

      {/* My sports: the level and the totals from the sport's page
          (DP-019); the card opens that page, the pencil changes the level. */}
      <VStack space="sm">
        <Typography variant="overline" color="muted">
          {t('meMySports')}
        </Typography>
        <HStack className="flex-wrap" space="sm">
          {sports.map((sport, i) => {
            const mine = myLevels.find((l) => l.sport === sport);
            const summary = summaries[sport];
            const rate = summary ? winRate(summary) : null;
            return (
              <View key={sport} style={{ flexBasis: '48%', flexGrow: 1, maxWidth: '50%' }}>
                <SportCard
                  featured={i === 0}
                  sport={sportLabel(sport, t)}
                  level={mine ? mine.skillLevelName : t('skillLevelNotSet')}
                  matches={summary ? t('meSportMatches', summary.matchesPlayed) : undefined}
                  wins={summary ? t('meSportWon', summary.wins) : undefined}
                  winRate={rate != null ? `${rate}%` : undefined}
                  editLabel={t('meChangeLevel')}
                  onEditLevel={() => handleEditLevel(sport)}
                  onPress={() => onOpenSport(sport)}
                />
              </View>
            );
          })}
        </HStack>
      </VStack>

      <ListGroup>
        {/* DP-009: the Player's own Session History, across all Clubs. */}
        <ListRow icon="time-outline" title={t('mySessionHistoryTitle')} chevron onPress={onOpenHistory} />
        <ListRow icon="location-outline" title={t('meMyTowns')} subtitle={towns || t('meTownsNone')} chevron onPress={() => setShowTowns(true)} />
        <ListRow
          icon="mail-outline"
          title={t('meAccountEmail')}
          subtitle={profile?.email ? t('meEmailConfirmed', profile.email) : t('meEmailNotSet')}
          chevron
          onPress={onOpenEmail}
        />
      </ListGroup>

      {/* DP-017: the User's towns — several kept, one active. Every change
          saves at once. */}
      <Sheet visible={showTowns} onClose={() => setShowTowns(false)} title={t('meMyTowns')} description={t('townsHint')}>
        <VStack space="sm">
          {(profile?.cities ?? []).map((city) => {
            const active = city.code === profile?.cityCode;
            return (
              <HStack key={city.code} className="items-center" space="sm">
                <Pressable
                  style={{ flex: 1 }}
                  className="py-2 active:opacity-60"
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
          <Pressable
            onPress={() => {
              setShowTowns(false);
              setShowCityPicker(true);
            }}
            className="py-2 active:opacity-60 self-start"
          >
            <HStack className="items-center" space="xs">
              <Icon name="add" size="sm" color="secondary" />
              <Typography variant="body" className="font-bold text-heat-strong dark:text-heat-strong-dark">
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
      </Sheet>

      {/* DP-008: the player's level in one sport, picked from that sport's
          levels; saves on tap. */}
      <Sheet
        visible={editingSport !== null}
        onClose={() => setEditingSport(null)}
        title={editingSport ? `${t('meChangeLevel')} · ${sportLabel(editingSport, t)}` : undefined}
      >
        <HStack className="flex-wrap gap-2">
          {(editingSport ? levelsBySport[editingSport] ?? [] : []).map((level) => (
            <Chip
              key={level.id}
              label={level.name}
              selected={editingLevel?.skillLevelId === level.id}
              onPress={() => editingSport && !busy && handlePick(editingSport, level.id)}
            />
          ))}
        </HStack>
      </Sheet>

      <CityPickerModal
        visible={showCityPicker}
        title={t('townsAdd')}
        onSelect={(city) => changeTowns(() => addMyCity(city.code))}
        onClose={() => setShowCityPicker(false)}
      />
    </ScrollPage>
  );
}
