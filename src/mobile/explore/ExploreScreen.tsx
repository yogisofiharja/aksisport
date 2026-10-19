import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useColorScheme } from 'nativewind';
import { ScrollPage } from '../../design-system/layout/ScrollPage';
import { VStack } from '../../design-system/layout/VStack';
import { HStack } from '../../design-system/layout/HStack';
import { Typography } from '../../design-system/ui/Typography';
import { Icon } from '../../design-system/ui/Icon';
import { Button, ButtonText } from '../../design-system/ui/Button';
import { Card } from '../../design-system/ui/Card';
import { Badge } from '../../design-system/ui/Badge';
import { EmptyState } from '../../design-system/feedback/EmptyState';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../core/auth/AuthContext';
import { authHeader, updateMe } from '../../core/api/client';
import { CityPickerModal } from '../locations/CityPickerModal';
import { clubAvatarUrl, listClubsInMyCity, searchClubs } from '../../core/clubs/api';
import { initialsFromName } from '../../core/initials';
import type { ClubPreview } from '../../core/api/types';

type Props = {
  onOpenClub: (clubId: string) => void;
};

const MIN_QUERY_LENGTH = 2;

// "Kota Bukittinggi, Sumatera Barat" -> "Kota Bukittinggi": enough for a
// chip; the province is only needed to tell same-named places apart in a
// list, and nobody keeps two of those.
function shortCityName(name: string): string {
  return name.split(', ')[0];
}

// Explore (DP-017): find a Community.
//
// Before anything is typed, it lists the Communities in the person's own
// town (a city picked from the reference list) that they haven't joined —
// or, if they have set no town, invites them to pick one right here.
// Typing two or more characters switches to search by name or location,
// with results appearing after a short pause.
//
// Every Community is shown with its location, so two with similar names
// can be told apart. Tapping one opens it: members land on its home,
// everyone else on its preview with the option to join.
export function ExploreScreen({ onOpenClub }: Props) {
  const { t } = useTranslation();
  const { profile, refreshProfile } = useAuth();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ClubPreview[]>([]);
  // The query the current `results` answer — so "no matches" is only
  // shown for what was actually searched, never for text still being typed.
  const [answeredQuery, setAnsweredQuery] = useState('');
  const [searching, setSearching] = useState(false);
  // null until the first answer, so the empty message doesn't flash.
  const [inTown, setInTown] = useState<ClubPreview[] | null>(null);
  const [imageHeaders, setImageHeaders] = useState<Record<string, string>>({});

  useEffect(() => {
    authHeader().then(setImageHeaders);
  }, []);

  const town = profile?.cityName;
  const cityCode = profile?.cityCode;
  const [showCityPicker, setShowCityPicker] = useState(false);

  // On every focus, not just mount: the person may come back from joining
  // one of the Communities listed. Re-runs when the town changes too.
  useFocusEffect(
    useCallback(() => {
      if (!cityCode) {
        setInTown(null);
        return;
      }
      listClubsInMyCity()
        .then(setInTown)
        .catch(() => {
          // keep what's showing; the next focus retries
        });
    }, [cityCode])
  );

  // Switching to a town (saved or newly picked) makes it the active one;
  // a newly picked town is also saved, so it's one tap away next time.
  async function switchTown(code: string) {
    setShowCityPicker(false);
    if (code === cityCode) return;
    setInTown(null);
    try {
      await updateMe({ cityCode: code });
      await refreshProfile();
    } catch {
      // the active town stays as it was
    }
  }

  const trimmed = query.trim();
  const isSearching = trimmed.length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    if (!isSearching) {
      setResults([]);
      setAnsweredQuery('');
      setSearching(false);
      return;
    }
    setSearching(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const found = await searchClubs(trimmed);
        if (cancelled) return;
        setResults(found);
        setAnsweredQuery(trimmed);
      } catch {
        // keep whatever is on screen; typing again retries
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, isSearching]);

  function renderClub(club: ClubPreview) {
    return (
      <Card key={club.id} pressable onPress={() => onOpenClub(club.id)}>
        <HStack space="md" className="items-center">
          <View className="w-12 h-12 rounded-full items-center justify-center overflow-hidden bg-surface-sunken dark:bg-surface-sunken-dark">
            {club.hasAvatar ? (
              <Image source={{ uri: clubAvatarUrl(club.id), headers: imageHeaders }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <Typography variant="body" className="font-extrabold text-ink-muted dark:text-ink-muted-dark">
                {initialsFromName(club.name)}
              </Typography>
            )}
          </View>
          <VStack space="xs" style={{ flex: 1 }}>
            <Typography variant="body" className="text-lg font-bold" numberOfLines={1}>
              {club.name}
            </Typography>
            <HStack space="xs" className="items-center">
              <Icon name="location-outline" size="xs" color="muted" />
              <Typography variant="body" color="muted" className="text-sm" numberOfLines={1} style={{ flex: 1 }}>
                {club.cityName ?? t('clubLocationNotSet')}
              </Typography>
            </HStack>
            <Typography variant="body" color="muted" className="text-sm">
              {t('clubMemberCount', club.memberCount)}
            </Typography>
          </VStack>
          <VStack space="xs" style={{ alignItems: 'flex-end' }}>
            {club.viewerRole ? (
              <Badge action="success" text={t('clubJoinedBadge')} />
            ) : club.viewerRequestPending ? (
              <Badge action="muted" text={t('clubRequestedBadge')} />
            ) : null}
            {club.visibility === 'private' && <Badge action="muted" text={t('clubPrivateBadge')} />}
          </VStack>
        </HStack>
      </Card>
    );
  }

  return (
    <ScrollPage gap="lg" keyboardShouldPersistTaps="handled">
      <Typography variant="heading">{t('exploreTitle')}</Typography>

      <HStack className="items-center rounded-2xl border border-border-strong dark:border-border-strong-dark bg-surface dark:bg-surface-dark px-4" space="sm">
        <Icon name="search" size="sm" color="muted" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('exploreSearchPlaceholder')}
          placeholderTextColor={isDark ? '#64748b' : '#9ca3af'}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          className="flex-1 font-semibold text-ink dark:text-ink-dark"
          style={{ height: 48, fontSize: 16 }}
        />
        {searching ? (
          <ActivityIndicator size="small" />
        ) : query.length > 0 ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8} className="active:opacity-60" accessibilityLabel={t('exploreClearSearch')}>
            <Icon name="close-circle" size="sm" color="muted" />
          </Pressable>
        ) : null}
      </HStack>

      {isSearching ? (
        answeredQuery === trimmed && results.length === 0 ? (
          <EmptyState message={t('exploreNoResults', trimmed)} />
        ) : (
          <VStack space="md">{results.map(renderClub)}</VStack>
        )
      ) : !town ? (
        <Card>
          <VStack space="md">
            <VStack space="xs">
              <Typography variant="body" className="font-bold">
                {t('exploreSetTownTitle')}
              </Typography>
              <Typography variant="body" color="muted">
                {t('exploreSetTownDesc')}
              </Typography>
            </VStack>
            <Button size="lg" className="w-full" onPress={() => setShowCityPicker(true)}>
              <ButtonText>{t('exploreSetTownAction')}</ButtonText>
            </Button>
          </VStack>
        </Card>
      ) : (
        <VStack space="sm">
          <Typography variant="overline" color="muted">
            {t('exploreInTownTitle', town)}
          </Typography>
          {/* The person's saved towns, the active one highlighted — going
              home or coming back is one tap. */}
          <HStack className="flex-wrap gap-2">
            {(profile?.cities ?? []).map((city) => {
              const active = city.code === cityCode;
              return (
                <Pressable
                  key={city.code}
                  onPress={() => switchTown(city.code)}
                  disabled={active}
                  className={`px-3 py-2 rounded-full ${active ? 'bg-ink dark:bg-ink-dark' : 'bg-surface-sunken dark:bg-surface-sunken-dark'} active:opacity-70`}
                >
                  <Typography variant="body" className={active ? 'text-sm font-sans-bold text-surface dark:text-surface-dark' : 'text-sm font-semibold text-ink-muted dark:text-ink-muted-dark'}>
                    {shortCityName(city.name)}
                  </Typography>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setShowCityPicker(true)}
              className="px-3 py-2 rounded-full border border-dashed border-border-strong dark:border-border-strong-dark active:opacity-70"
              accessibilityLabel={t('townsAdd')}
            >
              <HStack className="items-center" space="xs">
                <Icon name="add" size="xs" color="muted" />
                <Typography variant="body" color="muted" className="text-sm font-semibold">
                  {t('exploreOtherTown')}
                </Typography>
              </HStack>
            </Pressable>
          </HStack>
          {inTown === null ? null : inTown.length === 0 ? (
            <EmptyState message={t('exploreInTownEmpty', town)} />
          ) : (
            <VStack space="md">{inTown.map(renderClub)}</VStack>
          )}
        </VStack>
      )}

      <CityPickerModal
        visible={showCityPicker}
        title={t('townTitle')}
        selectedCode={cityCode}
        onSelect={(city) => switchTown(city.code)}
        onClose={() => setShowCityPicker(false)}
      />
    </ScrollPage>
  );
}
