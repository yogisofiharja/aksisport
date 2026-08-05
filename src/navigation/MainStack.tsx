import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ClubListScreen } from '../mobile/clubs/ClubListScreen';
import { CreateClubScreen } from '../mobile/clubs/CreateClubScreen';
import { JoinClubScreen } from '../mobile/clubs/JoinClubScreen';
import { ClubDetailScreen } from '../mobile/clubs/ClubDetailScreen';
import { ClubMembersScreen } from '../mobile/clubs/ClubMembersScreen';
import { SessionListScreen } from '../mobile/sessions/SessionListScreen';
import { SessionHistoryScreen } from '../mobile/sessions/SessionHistoryScreen';
import { CreateSessionScreen } from '../mobile/sessions/CreateSessionScreen';
import { SessionDetailScreen } from '../mobile/sessions/SessionDetailScreen';
import { AddMatchScreen } from '../mobile/activities/AddMatchScreen';
import { ActivityMatchScreen } from '../mobile/activities/ActivityMatchScreen';
import { RecurringScheduleListScreen } from '../mobile/recurringSchedules/RecurringScheduleListScreen';
import { RecurringScheduleDetailScreen } from '../mobile/recurringSchedules/RecurringScheduleDetailScreen';
import { SkillLevelsScreen } from '../mobile/profile/SkillLevelsScreen';

export type MainStackParamList = {
  ClubList: undefined;
  SkillLevels: undefined;
  CreateClub: undefined;
  JoinClub: undefined;
  ClubDetail: { clubId: string };
  ClubMembers: { clubId: string };
  SessionList: { clubId: string };
  SessionHistory: { clubId: string };
  CreateSession: { clubId: string };
  SessionDetail: { sessionId: string };
  AddMatch: { sessionId: string };
  ActivityMatch: { activityId: string };
  RecurringScheduleList: { clubId: string };
  CreateRecurringSchedule: { clubId: string };
  RecurringScheduleDetail: { clubId: string; scheduleId: string };
};

const Stack = createNativeStackNavigator<MainStackParamList>();

export function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ClubList">
        {({ navigation }) => (
          <ClubListScreen
            onOpenClub={(clubId) => navigation.navigate('ClubDetail', { clubId })}
            onCreateClub={() => navigation.navigate('CreateClub')}
            onJoinClub={() => navigation.navigate('JoinClub')}
            onOpenProfile={() => navigation.navigate('SkillLevels')}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="SkillLevels">
        {({ navigation }) => <SkillLevelsScreen onBack={() => navigation.goBack()} />}
      </Stack.Screen>

      <Stack.Screen name="CreateClub">
        {({ navigation }) => (
          <CreateClubScreen
            onBack={() => navigation.goBack()}
            onCreated={(club) => navigation.replace('ClubDetail', { clubId: club.id })}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="JoinClub">
        {({ navigation }) => (
          <JoinClubScreen
            onBack={() => navigation.goBack()}
            onJoined={(club) => navigation.replace('ClubDetail', { clubId: club.id })}
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
            onOpenRecurringSchedules={(clubId) => navigation.navigate('RecurringScheduleList', { clubId })}
            onDeleted={() => navigation.navigate('ClubList')}
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
            onDeleted={() => navigation.navigate('RecurringScheduleList', { clubId: route.params.clubId })}
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

      <Stack.Screen name="SessionDetail">
        {({ navigation, route }) => (
          <SessionDetailScreen
            sessionId={route.params.sessionId}
            onBack={() => navigation.goBack()}
            onAddMatch={(sessionId) => navigation.navigate('AddMatch', { sessionId })}
            onOpenMatch={(activityId) => navigation.navigate('ActivityMatch', { activityId })}
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
