/**
 * Raw brand color values — AKSI-owned (the amber `primary` scale), not part
 * of Tailwind's default palette. The single source of truth for this scale:
 * required directly by tailwind.config.js, and imported by
 * ../colors.ts for JS-side (non-className) use.
 *
 * Plain JavaScript, not TypeScript: tailwind.config.js loads this via a
 * nested `require()`, which Tailwind's own TS config loader (jiti) does not
 * cover — jiti only transpiles the top-level config file, not files it
 * requires. See ../colors.ts for why the semantic layer that consumes this
 * file can safely stay TypeScript.
 */

module.exports = {
  50: '#fffbeb',
  100: '#fef3c7',
  400: '#fbbf24',
  500: '#f59e0b',
  600: '#d97706',
  700: '#b45309',
};
