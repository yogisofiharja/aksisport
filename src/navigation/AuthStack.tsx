import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SignUpScreen } from '../mobile/auth/SignUpScreen';
import { LoginScreen } from '../mobile/auth/LoginScreen';
import { ForgotPasswordScreen } from '../mobile/auth/ForgotPasswordScreen';

export type AuthStackParamList = {
  SignUp: undefined;
  Login: undefined;
  ForgotPassword: undefined;
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
      <Stack.Screen name="ForgotPassword">
        {({ navigation }) => <ForgotPasswordScreen onBackToLogin={() => navigation.navigate('Login')} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
