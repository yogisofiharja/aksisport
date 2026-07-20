import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './src/theme';
import { LanguageProvider } from './src/i18n';
import { AuthProvider } from './src/core/auth/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ScoringFlow } from './src/mobile/ScoringFlow';

export default function App() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <ThemeProvider>
          <AuthProvider>
            {Platform.OS !== 'web' ? <RootNavigator /> : <ScoringFlow />}
          </AuthProvider>
        </ThemeProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
