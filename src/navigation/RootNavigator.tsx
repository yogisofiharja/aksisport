import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../core/auth/AuthContext';
import { AuthStack } from './AuthStack';
import { MainStack } from './MainStack';
import { CompleteProfileScreen } from '../mobile/auth/CompleteProfileScreen';
import { VerifyEmailScreen } from '../mobile/auth/VerifyEmailScreen';
import { linking, restoreIntendedUrl } from './linking';
import { PushSync } from '../mobile/notifications/PushSync';
import { LiveSync } from '../core/live/LiveSync';

export function RootNavigator() {
  const { firebaseUser, initializing, needsProfile, needsEmail } = useAuth();

  if (initializing) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 dark:bg-slate-900">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Keyed on which stack is showing, so the container remounts when the
  // user signs in or out and re-reads the address bar — which is what
  // lets restoreIntendedUrl() send a just-signed-in visitor to the link
  // they originally opened. It must run before that remount, hence here
  // in render rather than in an effect.
  const signedIn = Boolean(firebaseUser) && !needsProfile && !needsEmail;
  if (signedIn) restoreIntendedUrl();

  return (
    <NavigationContainer
      key={signedIn ? 'main' : 'auth'}
      linking={linking}
      documentTitle={{ formatter: () => 'Aksi' }}
    >
      {!firebaseUser ? (
        <AuthStack />
      ) : needsProfile ? (
        <CompleteProfileScreen />
      ) : needsEmail ? (
        // DP-015: a new account confirms its email before anything else.
        <VerifyEmailScreen />
      ) : (
        <>
          <MainStack />
          <PushSync />
          <LiveSync />
        </>
      )}
    </NavigationContainer>
  );
}
