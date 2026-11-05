import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SignUpScreen } from '../mobile/auth/SignUpScreen';
import { LoginScreen } from '../mobile/auth/LoginScreen';
import { ForgotPasswordScreen } from '../mobile/auth/ForgotPasswordScreen';
import { InvitePreviewScreen } from '../mobile/invites/InvitePreviewScreen';

export type AuthStackParamList = {
  SignUp: undefined;
  Login: undefined;
  ForgotPassword: undefined;
  // DP-028: an invite link opened signed out shows what it's for first.
  Invite: { token: string };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Login">
      <Stack.Screen name="Login">
        {({ navigation }) => (
          <LoginScreen
            onNavigateToSignUp={() => navigation.navigate('SignUp')}
            onForgotPassword={() => navigation.navigate('ForgotPassword')}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="SignUp">
        {({ navigation }) => <SignUpScreen onNavigateToLogin={() => navigation.navigate('Login')} />}
      </Stack.Screen>
      <Stack.Screen name="Invite">
        {({ navigation, route }) => (
          <InvitePreviewScreen
            token={route.params.token}
            onSignUp={() => navigation.navigate('SignUp')}
            onLogIn={() => navigation.navigate('Login')}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="ForgotPassword">
        {({ navigation }) => <ForgotPasswordScreen onBackToLogin={() => navigation.navigate('Login')} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
