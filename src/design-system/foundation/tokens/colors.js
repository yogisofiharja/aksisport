/**
 * Raw colour values: the Aksi Sport palette (Claude Design, "Aksi Sport"
 * design system), each colour a light/dark pair. The single source of
 * truth for colour: required directly by tailwind.config.js, which turns
 * every entry into a class pair (`bg-heat` / `dark:bg-heat-dark`), and
 * imported by ../colors.ts for JS-side (non-className) use.
 *
 * Plain JavaScript, not TypeScript: tailwind.config.js loads this via a
 * nested `require()`, which Tailwind's own TS config loader (jiti) does not
 * cover — jiti only transpiles the top-level config file, not files it
 * requires.
 */

module.exports = {
  heat: { light: '#f9440e', dark: '#f9440e' },
  heatStrong: { light: '#c2330a', dark: '#ff6a3d' },
  heatTint: { light: '#ffe9e0', dark: '#3a1a0e' },
  onHeat: { light: '#131315', dark: '#131315' },
  ink: { light: '#131315', dark: '#f4f2ef' },
  inkMuted: { light: '#5f5a55', dark: '#a19c96' },
  inkFaint: { light: '#9a948e', dark: '#6b6660' },
  ground: { light: '#faf8f6', dark: '#0e0e10' },
  surface: { light: '#ffffff', dark: '#18181b' },
  surfaceSunken: { light: '#f2efec', dark: '#222226' },
  asphalt: { light: '#131315', dark: '#26262b' },
  onAsphalt: { light: '#f4f2ef', dark: '#f4f2ef' },
  heatOnAsphalt: { light: '#ff6a3d', dark: '#ff6a3d' },
  border: { light: '#e4dfda', dark: '#2e2e33' },
  borderStrong: { light: '#9a948e', dark: '#77716b' },
  ball: { light: '#dcf23a', dark: '#dcf23a' },
  success: { light: '#0e7c4a', dark: '#34d399' },
  successTint: { light: '#e3f3ea', dark: '#0f2a1e' },
  info: { light: '#1d4ed8', dark: '#93c5fd' },
  infoTint: { light: '#e6eefd', dark: '#14213d' },
  danger: { light: '#b42318', dark: '#f87171' },
  dangerTint: { light: '#fde8e6', dark: '#3a1414' },
};
