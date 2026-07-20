import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SignUpScreen } from '../mobile/auth/SignUpScreen';
import { LoginScreen } from '../mobile/auth/LoginScreen';

export type AuthStackParamList = {
  SignUp: undefined;
  Login: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Login">
      <Stack.Screen name="Login">
        {({ navigation }) => <LoginScreen onNavigateToSignUp={() => navigation.navigate('SignUp')} />}
      </Stack.Screen>
      <Stack.Screen name="SignUp">
        {({ navigation }) => <SignUpScreen onNavigateToLogin={() => navigation.navigate('Login')} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
