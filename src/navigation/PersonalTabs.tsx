import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColorScheme } from 'nativewind';
import { Icon } from '../design-system/ui/Icon';
import { theme } from '../design-system/foundation/theme';
import { useTranslation } from '../i18n';
import { HomeScreen } from '../mobile/home/HomeScreen';
import { ExploreScreen } from '../mobile/explore/ExploreScreen';
import { InboxScreen } from '../mobile/inbox/InboxScreen';
import { MeScreen } from '../mobile/me/MeScreen';
import type { MainStackParamList } from './MainStack';

export type PersonalTabParamList = {
  Home: undefined;
  Explore: undefined;
  Inbox: undefined;
  Me: undefined;
};

const Tab = createBottomTabNavigator<PersonalTabParamList>();

export function PersonalTabs() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = theme[mode];
  // Home/Me push onto the parent stack (Community entry, CreateClub/
  // JoinClub, SkillLevels, Settings) — those routes don't exist on this
  // tab navigator, so use the parent stack's navigation directly rather
  // than each tab screen's own scoped `navigation` prop (react-navigation's
  // runtime `navigate` bubbles to ancestors either way; this keeps it typed).
  const rootNavigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        // Blue (brand.secondary), not amber (brand.primary) — matches the
        // accent already used by Create/Join buttons, Create Session, and
        // selected skill-level chips throughout the app.
        tabBarActiveTintColor: palette.brand.secondary,
        tabBarInactiveTintColor: palette.text.muted,
        tabBarStyle: { backgroundColor: palette.surface, borderTopColor: palette.border },
      }}
    >
      <Tab.Screen
        name="Home"
        options={{
          tabBarLabel: t('tabHome'),
          tabBarIcon: ({ focused }) => <Icon name={focused ? 'home' : 'home-outline'} color={focused ? 'secondary' : 'muted'} />,
        }}
      >
        {() => (
          <HomeScreen
            onOpenClub={(clubId) => rootNavigation.navigate('ClubDetail', { clubId })}
            onCreateClub={() => rootNavigation.navigate('CreateClub')}
            onJoinClub={() => rootNavigation.navigate('JoinClub')}
            onOpenSession={(sessionId) => rootNavigation.navigate('SessionDetail', { sessionId })}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="Explore"
        options={{
          tabBarLabel: t('tabExplore'),
          tabBarIcon: ({ focused }) => <Icon name={focused ? 'compass' : 'compass-outline'} color={focused ? 'secondary' : 'muted'} />,
        }}
        component={ExploreScreen}
      />

      <Tab.Screen
        name="Inbox"
        options={{
          tabBarLabel: t('tabInbox'),
          tabBarIcon: ({ focused }) => <Icon name={focused ? 'mail' : 'mail-outline'} color={focused ? 'secondary' : 'muted'} />,
        }}
        component={InboxScreen}
      />

      <Tab.Screen
        name="Me"
        options={{
          tabBarLabel: t('tabMe'),
          tabBarIcon: ({ focused }) => (
            <Icon name={focused ? 'person-circle' : 'person-circle-outline'} color={focused ? 'secondary' : 'muted'} />
          ),
        }}
      >
        {() => <MeScreen onOpenSettings={() => rootNavigation.navigate('Settings')} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
