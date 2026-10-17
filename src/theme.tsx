import AsyncStorage from '@react-native-async-storage/async-storage';
import { colorScheme as nwColorScheme, useColorScheme as nwUseColorScheme } from 'nativewind';
import { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

export type ThemePreference = 'light' | 'dark' | 'system';

type ThemeContextValue = {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeContextValue>({
  preference: 'system',
  setPreference: () => {},
  isDark: false,
});

const STORAGE_KEY = 'theme_preference';

function isPreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

// Web: dark mode is the `dark` class on <html> (tailwind.config.js
// `darkMode: 'class'`), so "system" has to be resolved here — NativeWind's
// own 'system' just removes the class, which would always show light.
const systemDarkQuery =
  Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

function applyPreference(p: ThemePreference) {
  if (Platform.OS === 'web') {
    const mode = p === 'system' ? (systemDarkQuery?.matches ? 'dark' : 'light') : p;
    // Set the class directly too: NativeWind only toggles it once its CSS
    // (which carries the darkMode flag) has loaded.
    document.documentElement.classList.toggle('dark', mode === 'dark');
    nwColorScheme.set(mode);
  } else {
    nwColorScheme.set(p);
  }
}

// Web keeps AsyncStorage in localStorage, which can be read synchronously:
// the saved choice is applied before the first paint, so the page never
// flashes the other theme.
function initialPreference(): ThemePreference {
  if (Platform.OS !== 'web') return 'system';
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return isPreference(saved) ? saved : 'system';
  } catch {
    return 'system';
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    const p = initialPreference();
    if (Platform.OS === 'web') applyPreference(p);
    return p;
  });
  const { colorScheme } = nwUseColorScheme();

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (isPreference(saved)) {
        applyPreference(saved);
        setPreferenceState(saved);
      }
    });
  }, []);

  // Following the system on web: track the OS setting as it changes.
  useEffect(() => {
    if (preference !== 'system' || !systemDarkQuery) return;
    const onChange = () => applyPreference('system');
    systemDarkQuery.addEventListener('change', onChange);
    return () => systemDarkQuery.removeEventListener('change', onChange);
  }, [preference]);

  function setPreference(p: ThemePreference) {
    setPreferenceState(p);
    applyPreference(p);
    AsyncStorage.setItem(STORAGE_KEY, p);
  }

  return (
    <ThemeContext.Provider value={{ preference, setPreference, isDark: colorScheme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
