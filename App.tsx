import { Platform, View } from 'react-native';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './src/theme';
import { LanguageProvider } from './src/i18n';
import { AuthProvider } from './src/core/auth/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AppAlertHost } from './src/design-system/feedback/appAlert';

// One app on every platform: iOS, Android and web all render the same
// navigator and screens. (The legacy no-login scorer that web used to
// render here lives on the `scorer` branch, which is what Vercel serves.)
//
// On a wide browser window the app keeps its phone layout, centred in a
// fixed-width column, rather than stretching every screen edge to edge.
const WEB_MAX_WIDTH = 520;

// Aksi Sport type (foundation/typography.ts): one family name per weight,
// matching tailwind.config.js's `font-*` classes.
const FONTS = {
  'PlusJakartaSans-Regular': require('./assets/fonts/PlusJakartaSans-Regular.ttf'),
  'PlusJakartaSans-Medium': require('./assets/fonts/PlusJakartaSans-Medium.ttf'),
  'PlusJakartaSans-SemiBold': require('./assets/fonts/PlusJakartaSans-SemiBold.ttf'),
  'PlusJakartaSans-Bold': require('./assets/fonts/PlusJakartaSans-Bold.ttf'),
  'Saira-Bold': require('./assets/fonts/Saira-Bold.ttf'),
  'Saira-ExtraBoldItalic': require('./assets/fonts/Saira-ExtraBoldItalic.ttf'),
};

export default function App() {
  // Nothing renders until the fonts are in (or failed to load, in which
  // case text falls back to the system font), so no text flashes in the
  // wrong face.
  const [fontsLoaded, fontError] = useFonts(FONTS);
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <ThemeProvider>
          <AuthProvider>
            {Platform.OS === 'web' ? (
              <View className="flex-1 bg-slate-200 dark:bg-black">
                <View className="flex-1 w-full self-center" style={{ maxWidth: WEB_MAX_WIDTH }}>
                  <RootNavigator />
                </View>
              </View>
            ) : (
              <RootNavigator />
            )}
            <AppAlertHost />
          </AuthProvider>
        </ThemeProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
