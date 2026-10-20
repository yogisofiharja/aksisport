// "Bukittinggi, Sumatera Barat" -> "Bukittinggi": enough for a
// chip or a card; the province is only needed to tell same-named places
// apart in a list, and nobody keeps two of those.
export function shortCityName(name: string): string {
  return name.split(', ')[0];
}
