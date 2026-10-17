const primaryTokens = require('./src/design-system/foundation/tokens/colors');

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
        background: {
          DEFAULT: '#0f1021',
          muted: '#1a1c33',
        },
        foreground: '#1f2937',
        muted: '#58657a',
        'app-border': '#263054',
        // Single source of truth: src/design-system/foundation/tokens/colors.js
        // (also imported directly by the Design System's colors.ts).
        primary: {
          DEFAULT: primaryTokens[600],
          ...primaryTokens,
        },
        secondary: '#64748b',
        accent: {
          DEFAULT: '#ffd000',
          soft: '#fff5c2',
        },
        destructive: {
          DEFAULT: '#c02828',
          soft: '#fee2e2',
        },
        success: '#0f9b8e',
      },
    },
  },
  plugins: [],
};
