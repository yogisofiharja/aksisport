/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'media',
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
        primary: {
          DEFAULT: '#d97706',
          50: '#fffbeb',
          100: '#fef3c7',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
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
