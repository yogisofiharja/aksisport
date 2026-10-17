const aksi = require('./src/design-system/foundation/tokens/colors');

// Every palette entry becomes two classes: the light value under its
// kebab-case name and the dark value under `<name>-dark`, used as
// `bg-surface dark:bg-surface-dark`.
const kebab = (s) => s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
const aksiColors = {};
for (const [name, value] of Object.entries(aksi)) {
  aksiColors[kebab(name)] = value.light;
  aksiColors[`${kebab(name)}-dark`] = value.dark;
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  // 'class', not 'media': the app's own Light / Dark / Follow device setting
  // (src/theme.tsx) decides, and on web toggles the `dark` class on <html>.
  darkMode: 'class',
  content: [
    './App.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        ...aksiColors,
        // Transitional: the old `primary-*` classes (Button, Typography,
        // components/ui/button) mapped onto the heat colours until those
        // components move to the palette names directly.
        primary: {
          DEFAULT: aksi.heat.light,
          50: aksi.heatTint.light,
          100: aksi.heatTint.light,
          400: aksi.heatOnAsphalt.light,
          500: aksi.heat.light,
          600: aksi.heat.light,
          700: aksi.heatStrong.light,
        },
      },
      // React Native picks a font file by family name, so each weight is
      // its own family (loaded in App.tsx).
      fontFamily: {
        sans: ['PlusJakartaSans-Regular'],
        'sans-medium': ['PlusJakartaSans-Medium'],
        'sans-semibold': ['PlusJakartaSans-SemiBold'],
        'sans-bold': ['PlusJakartaSans-Bold'],
        display: ['Saira-Bold'],
        'display-hero': ['Saira-ExtraBoldItalic'],
      },
    },
  },
  plugins: [],
};
