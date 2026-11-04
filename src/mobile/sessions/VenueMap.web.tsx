import { createElement } from 'react';
import { View } from 'react-native';
import { googleMapsEmbedUrl } from '../../core/venues/api';

// DP-031, web: Google's Maps Embed of the venue, drawn from its place ID
// alone (free, no limit). Nothing without the browser key.
export function VenueMap({ placeId, name }: { placeId: string; name: string }) {
  const src = googleMapsEmbedUrl(placeId);
  if (!src) return null;
  return (
    <View className="mt-2 overflow-hidden rounded-xl border border-border dark:border-border-dark" style={{ height: 180 }}>
      {createElement('iframe', {
        src,
        title: name,
        loading: 'lazy',
        referrerPolicy: 'no-referrer-when-downgrade',
        style: { border: 0, width: '100%', height: '100%' },
        allowFullScreen: true,
      })}
    </View>
  );
}
