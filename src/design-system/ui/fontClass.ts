/**
 * React Native picks a font file by family name, so with the Aksi Sport
 * fonts a weight class (`font-bold`) on its own does nothing useful: web
 * fakes the bold, iOS may ignore it. `withFontFamily` turns a className's
 * weight into the matching family instead:
 *
 * - Plus Jakarta Sans (the default): `font-medium` → `font-sans-medium`,
 *   `font-semibold` → `font-sans-semibold`, `font-bold` / `font-extrabold`
 *   / `font-black` → `font-sans-bold` (700 is the heaviest text weight).
 * - Saira (`font-display`, `font-display-hero`): one weight each, so weight
 *   classes are dropped.
 *
 * An explicit family class in the string (`font-sans-semibold`,
 * `font-display`) wins over the default; the last one counts, so a caller's
 * className overrides a component's base classes.
 */

const WEIGHT_FAMILY: Record<string, string> = {
  'font-thin': 'font-sans',
  'font-light': 'font-sans',
  'font-normal': 'font-sans',
  'font-medium': 'font-sans-medium',
  'font-semibold': 'font-sans-semibold',
  'font-bold': 'font-sans-bold',
  'font-extrabold': 'font-sans-bold',
  'font-black': 'font-sans-bold',
};

const FAMILY = /^font-(sans|display)(-[a-z]+)?$/;

export function withFontFamily(className: string, defaultFamily = 'font-sans'): string {
  let family = defaultFamily;
  let weight: string | undefined;
  const rest: string[] = [];
  for (const token of className.split(/\s+/)) {
    if (!token) continue;
    if (FAMILY.test(token)) {
      family = token;
      weight = undefined; // a family set after a weight replaces it
    } else if (token in WEIGHT_FAMILY) {
      weight = token;
    } else {
      rest.push(token);
    }
  }
  if (weight && family.startsWith('font-sans')) family = WEIGHT_FAMILY[weight];
  return [family, ...rest].join(' ');
}

// Size, alignment and other non-colour `text-*` utilities.
const TEXT_NOT_COLOR = /^text-(xs|sm|base|lg|[0-9]*xl|\[\d|left|right|center|justify|start|end|wrap|nowrap|ellipsis|clip)/;

/** Whether a className sets its own text colour (`text-on-heat`, `text-white/70`, `dark:text-ink-dark`). */
export function hasTextColor(className: string): boolean {
  return className
    .split(/\s+/)
    .some((token) => {
      const t = token.replace(/^(dark:|active:)+/, '');
      return t.startsWith('text-') && !TEXT_NOT_COLOR.test(t);
    });
}
