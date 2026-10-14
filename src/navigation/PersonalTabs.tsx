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
import { useAuth } from '../core/auth/AuthContext';
import { useUnreadMessageCount } from '../core/messages/useUnreadMessageCount';

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
  // Home/Me push onto the parent stack (Community entry, CreateClub,
  // Settings) — those routes don't exist on this tab navigator, so use the
  // parent stack's navigation directly rather than each tab screen's own
  // scoped `navigation` prop (react-navigation's runtime `navigate` bubbles
  // to ancestors either way; this keeps it typed).
  const rootNavigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { profile } = useAuth();
  const unreadMessages = useUnreadMessageCount(profile?.id);

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
            onOpenNotifications={() => rootNavigation.navigate('Notifications')}
            onOpenClub={(clubId) => rootNavigation.navigate('ClubDetail', { clubId })}
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
      >
        {() => <ExploreScreen onOpenClub={(clubId) => rootNavigation.navigate('ClubDetail', { clubId })} />}
      </Tab.Screen>

      <Tab.Screen
        name="Inbox"
        options={{
          tabBarLabel: t('tabInbox'),
          tabBarBadge: unreadMessages > 0 ? (unreadMessages > 99 ? '99+' : unreadMessages) : undefined,
          tabBarBadgeStyle: { backgroundColor: palette.brand.secondary, color: '#ffffff', fontSize: 11 },
          tabBarIcon: ({ focused }) => <Icon name={focused ? 'mail' : 'mail-outline'} color={focused ? 'secondary' : 'muted'} />,
        }}
      >
        {() => (
          <InboxScreen
            onOpenDirectMessage={(userId) => rootNavigation.navigate('DirectMessage', { userId })}
            onOpenGroup={(groupId) => rootNavigation.navigate('GroupChat', { groupId })}
            onNewGroup={() => rootNavigation.navigate('NewGroup')}
            onOpenSession={(sessionId, memberUserId) =>
              rootNavigation.navigate('SessionDetail', { sessionId, openContactWith: memberUserId })
            }
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="Me"
        options={{
          tabBarLabel: t('tabMe'),
          tabBarIcon: ({ focused }) => (
            <Icon name={focused ? 'person-circle' : 'person-circle-outline'} color={focused ? 'secondary' : 'muted'} />
          ),
        }}
      >
        {() => (
          <MeScreen
            onOpenSettings={() => rootNavigation.navigate('Settings')}
            onCreateClub={() => rootNavigation.navigate('CreateClub')}
            onOpenHistory={() => rootNavigation.navigate('MySessionHistory')}
            onOpenEmail={() => rootNavigation.navigate('AccountEmail')}
            onOpenDisplayName={() => rootNavigation.navigate('EditDisplayName')}
            onOpenSport={(sport) => profile && rootNavigation.navigate('PlayerSport', { userId: profile.id, sport })}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
