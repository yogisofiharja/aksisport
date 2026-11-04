import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Field } from '../../../design-system/ui/Field';
import { Input, InputField } from '../../../design-system/ui/Input';
import { ListGroup, ListRow } from '../../../design-system/ui/List';
import { Sheet } from '../../../design-system/feedback/Sheet';
import { Button, ButtonText } from '../../../design-system/ui/Button';
import { useTranslation } from '../../../i18n';
import { ApiRequestError } from '../../../core/api/client';
import { addGoogleVenue, newPlacesSession, searchGooglePlaces, searchVenues } from '../../../core/venues/api';
import type { PlaceSuggestion, Venue } from '../../../core/api/types';

type Props = {
  location: string;
  venueId?: string;
  error?: string | null;
  invalid: boolean;
  onChange: (patch: { location: string; venueId?: string }) => void;
};

const SEARCH_DELAY_MS = 300;

// DP-031: where the Session is played. Typing suggests Aksi venues first;
// when none fits, Google Maps (on its own when Aksi has nothing, one tap
// otherwise). A Google pick asks the organizer to confirm the venue's
// name, then it's an Aksi venue for everyone. A name typed and left as
// is also works: the server keeps it as a venue.
export function VenueField({ location, venueId, error, invalid, onChange }: Props) {
  const { t, lang } = useTranslation();
  // Suggestions show only while the organizer is typing, not for a
  // venue already picked or loaded with the Session.
  const [typing, setTyping] = useState(false);
  const [venues, setVenues] = useState<Venue[] | null>(null);
  const [places, setPlaces] = useState<PlaceSuggestion[] | null>(null);
  const [wantGoogle, setWantGoogle] = useState(false);
  const [mapsOff, setMapsOff] = useState(false);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [confirming, setConfirming] = useState<PlaceSuggestion | null>(null);
  const [confirmName, setConfirmName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // One Google billing session per pick.
  const placesSession = useRef(newPlacesSession());

  const query = location.trim();
  const active = typing && !venueId && query.length >= 2;

  // Aksi's own venues.
  useEffect(() => {
    if (!active) {
      setVenues(null);
      return;
    }
    let live = true;
    const id = setTimeout(() => {
      searchVenues(query)
        .then((list) => live && setVenues(list))
        .catch(() => live && setVenues([]));
    }, SEARCH_DELAY_MS);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [active, query]);

  // Google, when Aksi has nothing or the organizer asked for it.
  const searchGoogle = active && !mapsOff && (wantGoogle || (venues !== null && venues.length === 0));
  useEffect(() => {
    if (!searchGoogle) {
      setPlaces(null);
      return;
    }
    let live = true;
    setLoadingPlaces(true);
    const id = setTimeout(() => {
      searchGooglePlaces(query, placesSession.current, lang)
        .then((list) => live && setPlaces(list))
        .catch((err) => {
          if (!live) return;
          if (err instanceof ApiRequestError && err.code === 'MAPS_UNAVAILABLE') setMapsOff(true);
          setPlaces([]);
        })
        .finally(() => live && setLoadingPlaces(false));
    }, SEARCH_DELAY_MS);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [searchGoogle, query, lang]);

  function pickVenue(v: Venue) {
    setTyping(false);
    setWantGoogle(false);
    onChange({ location: v.name, venueId: v.id });
  }

  async function saveGooglePick() {
    if (!confirming || !confirmName.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const v = await addGoogleVenue(confirming.placeId, confirmName.trim(), placesSession.current);
      placesSession.current = newPlacesSession();
      setConfirming(null);
      pickVenue(v);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('authGenericError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Field label={t('sessionLocationLabel')} error={error} hint={t('venueHint')}>
        <Input isInvalid={invalid}>
          <InputField
            value={location}
            onChangeText={(text) => {
              setTyping(true);
              onChange({ location: text, venueId: undefined });
            }}
            maxLength={120}
          />
        </Input>
      </Field>

      {active && (venues?.length || places?.length || loadingPlaces) ? (
        <View className="mt-2">
          <ListGroup>
            {(venues ?? []).map((v) => (
              <ListRow
                key={v.id}
                icon={v.placeId ? 'location' : 'location-outline'}
                title={v.name}
                subtitle={v.uses > 0 ? t('venueUses', v.uses) : undefined}
                onPress={() => pickVenue(v)}
              />
            ))}
            {(places ?? []).map((p) => (
              <ListRow
                key={p.placeId}
                icon="map-outline"
                title={p.name}
                subtitle={p.address}
                onPress={() => {
                  setConfirmName(p.name);
                  setSaveError(null);
                  setConfirming(p);
                }}
              />
            ))}
            {loadingPlaces ? <ActivityIndicator className="py-3" /> : null}
            {!mapsOff && !wantGoogle && venues && venues.length > 0 ? (
              <ListRow icon="search-outline" title={t('venueSearchMore', query)} onPress={() => setWantGoogle(true)} />
            ) : null}
          </ListGroup>
        </View>
      ) : null}

      <Sheet
        visible={confirming !== null}
        onClose={() => setConfirming(null)}
        title={t('venueConfirmTitle')}
        description={confirming ? confirming.address : undefined}
      >
        <Field label={t('venueNameLabel')} error={saveError}>
          <Input>
            <InputField
              value={confirmName}
              onChangeText={setConfirmName}
              placeholder={t('venueNamePlaceholder')}
              maxLength={120}
              autoFocus
            />
          </Input>
        </Field>
        <Button size="lg" className="w-full mt-4" isDisabled={!confirmName.trim()} loading={saving} onPress={saveGooglePick}>
          <ButtonText>{t('venueUse')}</ButtonText>
        </Button>
      </Sheet>
    </>
  );
}
