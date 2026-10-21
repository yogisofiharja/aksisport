// Home's root app bar: "Sunday 19 Oct" / "Minggu 19 Okt" over
// "Hi, Yogi".
export function homeDateLine(now: Date, lang: 'en' | 'id'): string {
  return now
    .toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
    .replace(',', '');
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}
