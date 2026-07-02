import AsyncStorage from '@react-native-async-storage/async-storage';
import { colorScheme as nwColorScheme, useColorScheme as nwUseColorScheme } from 'nativewind';
import { createContext, useContext, useEffect, useState } from 'react';

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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const { colorScheme } = nwUseColorScheme();

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(saved => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        applyPreference(saved);
        setPreferenceState(saved);
      }
    });
  }, []);

  function applyPreference(p: ThemePreference) {
    nwColorScheme.set(p === 'system' ? 'system' : p);
  }

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
