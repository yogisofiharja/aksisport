/**
 * Raw brand color values — AKSI-owned (the blue `primary` scale), not part
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

// Blue, not amber (2026-10-15): the app uses no orange anywhere.
module.exports = {
  50: '#eff6ff',
  100: '#dbeafe',
  400: '#60a5fa',
  500: '#3b82f6',
  600: '#2563eb',
  700: '#1d4ed8',
};
