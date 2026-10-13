import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../core/auth/AuthContext';
import { AuthStack } from './AuthStack';
import { MainStack } from './MainStack';
import { CompleteProfileScreen } from '../mobile/auth/CompleteProfileScreen';
import { linkingFor } from './linking';

export function RootNavigator() {
  const { firebaseUser, initializing, needsProfile } = useAuth();

  if (initializing) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 dark:bg-slate-900">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Keyed on which stack is showing, so the container remounts when the
  // user signs in or out and re-reads its starting URL — that is what
  // lets linkingFor() send a just-signed-in visitor to the link they
  // originally opened.
  const signedIn = Boolean(firebaseUser) && !needsProfile;

  return (
    <NavigationContainer
      key={signedIn ? 'main' : 'auth'}
      linking={linkingFor(signedIn)}
      documentTitle={{ formatter: () => 'Aksi' }}
    >
      {!firebaseUser ? <AuthStack /> : needsProfile ? <CompleteProfileScreen /> : <MainStack />}
    </NavigationContainer>
  );
}
