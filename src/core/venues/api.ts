import { apiFetch } from '../api/client';
import type { PlaceSuggestion, Venue } from '../api/types';

// DP-031. Aksi's own venues whose name contains `query` (2+ characters):
// the caller's town first, then the most used.
export function searchVenues(query: string): Promise<Venue[]> {
  return apiFetch(`/v1/venues?q=${encodeURIComponent(query)}`);
}

// Google Maps suggestions, through the API (the key stays on the server).
// `session` groups one picking session's searches for Google's billing.
// Fails with code MAPS_UNAVAILABLE when the server has no key.
export function searchGooglePlaces(query: string, session: string, lang: 'en' | 'id'): Promise<PlaceSuggestion[]> {
  return apiFetch(`/v1/venues/google?q=${encodeURIComponent(query)}&session=${encodeURIComponent(session)}&lang=${lang}`);
}

// Adds a picked Google place under the name the organizer confirmed, or
// returns the Aksi venue it already is.
export function addGoogleVenue(placeId: string, name: string, sessionToken: string): Promise<Venue> {
  return apiFetch('/v1/venues', { method: 'POST', body: JSON.stringify({ placeId, name, sessionToken }) });
}

// "Open in Google Maps": directions to the exact place. A plain link,
// no key and no cost.
export function googleMapsUrl(name: string, placeId: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${encodeURIComponent(placeId)}`;
}

// The map on a Session (web): Maps Embed, free and unlimited, drawn from
// the place ID alone. Undefined without the browser key.
export function googleMapsEmbedUrl(placeId: string): string | undefined {
  const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_EMBED_KEY;
  if (!key) return undefined;
  return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=place_id:${encodeURIComponent(placeId)}`;
}

// A random token for one picking session.
export function newPlacesSession(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
