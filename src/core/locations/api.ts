import { apiFetch } from '../api/client';
import type { City, Province } from '../api/types';

export type Locations = { provinces: Province[]; cities: City[] };

let cached: Promise<Locations> | null = null;

// Indonesia's provinces and cities/regencies (DP-017) — reference data
// that only changes with a server migration, so it is fetched once per
// app run and shared by every city picker. A failed fetch is not cached,
// so the next picker to open tries again.
export function getLocations(): Promise<Locations> {
  if (!cached) {
    cached = apiFetch<Locations>('/v1/locations').catch((err) => {
      cached = null;
      throw err;
    });
  }
  return cached;
}
