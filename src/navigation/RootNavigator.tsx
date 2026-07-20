import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../core/auth/AuthContext';
import { AuthStack } from './AuthStack';
import { MainStack } from './MainStack';
import { CompleteProfileScreen } from '../mobile/auth/CompleteProfileScreen';

export function RootNavigator() {
  const { firebaseUser, initializing, needsProfile } = useAuth();

  if (initializing) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 dark:bg-slate-900">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!firebaseUser ? <AuthStack /> : needsProfile ? <CompleteProfileScreen /> : <MainStack />}
    </NavigationContainer>
  );
}
