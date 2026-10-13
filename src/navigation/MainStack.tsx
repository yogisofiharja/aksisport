import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PersonalTabs } from './PersonalTabs';
import { CreateClubScreen } from '../mobile/clubs/CreateClubScreen';
import { ClubDetailScreen } from '../mobile/clubs/ClubDetailScreen';
import { ClubMembersScreen } from '../mobile/clubs/ClubMembersScreen';
import { ClubSettingsScreen } from '../mobile/clubs/ClubSettingsScreen';
import { SessionListScreen } from '../mobile/sessions/SessionListScreen';
import { SessionHistoryScreen } from '../mobile/sessions/SessionHistoryScreen';
import { CreateSessionScreen } from '../mobile/sessions/CreateSessionScreen';
import { SessionDetailScreen } from '../mobile/sessions/SessionDetailScreen';
import { AddMatchScreen } from '../mobile/activities/AddMatchScreen';
import { ActivityMatchScreen } from '../mobile/activities/ActivityMatchScreen';
import { RecurringScheduleListScreen } from '../mobile/recurringSchedules/RecurringScheduleListScreen';
import { RecurringScheduleDetailScreen } from '../mobile/recurringSchedules/RecurringScheduleDetailScreen';
import { SettingsScreen } from '../mobile/me/SettingsScreen';

export type MainStackParamList = {
  Personal: undefined;
  Settings: undefined;
  CreateClub: undefined;
  ClubDetail: { clubId: string };
  ClubMembers: { clubId: string };
  ClubSettings: { clubId: string };
  SessionList: { clubId: string };
  SessionHistory: { clubId: string };
  MySessionHistory: undefined;
  CreateSession: { clubId: string };
  EditSession: { sessionId: string };
  SessionDetail: { sessionId: string; openContactWith?: string };
  AddMatch: { sessionId: string };
  ActivityMatch: { activityId: string };
  RecurringScheduleList: { clubId: string };
  CreateRecurringSchedule: { clubId: string };
  RecurringScheduleDetail: { clubId: string; scheduleId: string };
  EditRecurringSchedule: { clubId: string; scheduleId: string };
};

const Stack = createNativeStackNavigator<MainStackParamList>();

export function MainStack() {
  return (
    <Stack.Navigator initialRouteName="Personal" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Personal" component={PersonalTabs} />

      <Stack.Screen name="Settings">
        {({ navigation }) => <SettingsScreen onBack={() => navigation.goBack()} />}
      </Stack.Screen>

      <Stack.Screen name="CreateClub">
        {({ navigation }) => (
          <CreateClubScreen
            onBack={() => navigation.goBack()}
            onCreated={(club) => navigation.replace('ClubDetail', { clubId: club.id })}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="ClubDetail">
        {({ navigation, route }) => (
          <ClubDetailScreen
            clubId={route.params.clubId}
            onBack={() => navigation.goBack()}
            onOpenMembers={(clubId) => navigation.navigate('ClubMembers', { clubId })}
            onOpenSessions={(clubId) => navigation.navigate('SessionList', { clubId })}
            onOpenSession={(sessionId) => navigation.navigate('SessionDetail', { sessionId })}
            onOpenRecurringSchedules={(clubId) => navigation.navigate('RecurringScheduleList', { clubId })}
            onOpenClubSettings={(clubId) => navigation.navigate('ClubSettings', { clubId })}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="ClubSettings">
        {({ navigation, route }) => (
          <ClubSettingsScreen
            clubId={route.params.clubId}
            onBack={() => navigation.goBack()}
            onDeleted={() => navigation.navigate('Personal')}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="RecurringScheduleList">
        {({ navigation, route }) => (
          <RecurringScheduleListScreen
            clubId={route.params.clubId}
            onBack={() => navigation.goBack()}
            onOpenSchedule={(scheduleId) => navigation.navigate('RecurringScheduleDetail', { clubId: route.params.clubId, scheduleId })}
            onCreateSchedule={() => navigation.navigate('CreateRecurringSchedule', { clubId: route.params.clubId })}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="CreateRecurringSchedule">
        {({ navigation, route }) => (
          <CreateSessionScreen
            clubId={route.params.clubId}
            initialRecurring
            onBack={() => navigation.goBack()}
            onSessionCreated={(session) => navigation.replace('SessionDetail', { sessionId: session.id })}
            onScheduleCreated={(schedule) =>
              navigation.replace('RecurringScheduleDetail', { clubId: route.params.clubId, scheduleId: schedule.id })
            }
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="RecurringScheduleDetail">
        {({ navigation, route }) => (
          <RecurringScheduleDetailScreen
            clubId={route.params.clubId}
            scheduleId={route.params.scheduleId}
            onBack={() => navigation.goBack()}
            onEdit={() => navigation.navigate('EditRecurringSchedule', route.params)}
            onDeleted={() => navigation.navigate('RecurringScheduleList', { clubId: route.params.clubId })}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="EditRecurringSchedule">
        {({ navigation, route }) => (
          <CreateSessionScreen
            clubId={route.params.clubId}
            editingScheduleId={route.params.scheduleId}
            onBack={() => navigation.goBack()}
            onSessionCreated={() => {}}
            onScheduleCreated={() => {}}
            onScheduleUpdated={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="ClubMembers">
        {({ navigation, route }) => (
          <ClubMembersScreen clubId={route.params.clubId} onBack={() => navigation.goBack()} />
        )}
      </Stack.Screen>

      <Stack.Screen name="SessionList">
        {({ navigation, route }) => (
          <SessionListScreen
            clubId={route.params.clubId}
            onBack={() => navigation.goBack()}
            onOpenSession={(sessionId) => navigation.navigate('SessionDetail', { sessionId })}
            onCreateSession={() => navigation.navigate('CreateSession', { clubId: route.params.clubId })}
            onOpenHistory={() => navigation.navigate('SessionHistory', { clubId: route.params.clubId })}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="SessionHistory">
        {({ navigation, route }) => (
          <SessionHistoryScreen
            clubId={route.params.clubId}
            onBack={() => navigation.goBack()}
            onOpenSession={(sessionId) => navigation.navigate('SessionDetail', { sessionId })}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="MySessionHistory">
        {({ navigation }) => (
          <SessionHistoryScreen
            onBack={() => navigation.goBack()}
            onOpenSession={(sessionId) => navigation.navigate('SessionDetail', { sessionId })}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="CreateSession">
        {({ navigation, route }) => (
          <CreateSessionScreen
            clubId={route.params.clubId}
            onBack={() => navigation.goBack()}
            onSessionCreated={(session) => navigation.replace('SessionDetail', { sessionId: session.id })}
            onScheduleCreated={(schedule) =>
              navigation.replace('RecurringScheduleDetail', { clubId: route.params.clubId, scheduleId: schedule.id })
            }
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="EditSession">
        {({ navigation, route }) => (
          <CreateSessionScreen
            // Unused in edit mode — CreateSessionScreen resolves clubId
            // itself from the fetched Session (editingSessionId is set).
            clubId=""
            editingSessionId={route.params.sessionId}
            onBack={() => navigation.goBack()}
            onSessionCreated={() => {}}
            onScheduleCreated={() => {}}
            onSessionUpdated={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="SessionDetail">
        {({ navigation, route }) => (
          <SessionDetailScreen
            sessionId={route.params.sessionId}
            openContactWith={route.params.openContactWith}
            onBack={() => navigation.goBack()}
            onAddMatch={(sessionId) => navigation.navigate('AddMatch', { sessionId })}
            onOpenMatch={(activityId) => navigation.navigate('ActivityMatch', { activityId })}
            onEdit={(sessionId) => navigation.navigate('EditSession', { sessionId })}
            onDiscarded={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="AddMatch">
        {({ navigation, route }) => (
          <AddMatchScreen
            sessionId={route.params.sessionId}
            onBack={() => navigation.goBack()}
            onCreated={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="ActivityMatch">
        {({ navigation, route }) => (
          <ActivityMatchScreen activityId={route.params.activityId} onDone={() => navigation.goBack()} />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
