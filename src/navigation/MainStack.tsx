import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ClubListScreen } from '../mobile/clubs/ClubListScreen';
import { CreateClubScreen } from '../mobile/clubs/CreateClubScreen';
import { JoinClubScreen } from '../mobile/clubs/JoinClubScreen';
import { ClubDetailScreen } from '../mobile/clubs/ClubDetailScreen';
import { ClubMembersScreen } from '../mobile/clubs/ClubMembersScreen';
import { SessionListScreen } from '../mobile/sessions/SessionListScreen';
import { CreateSessionScreen } from '../mobile/sessions/CreateSessionScreen';
import { SessionDetailScreen } from '../mobile/sessions/SessionDetailScreen';
import { AddMatchScreen } from '../mobile/activities/AddMatchScreen';
import { ActivityMatchScreen } from '../mobile/activities/ActivityMatchScreen';

export type MainStackParamList = {
  ClubList: undefined;
  CreateClub: undefined;
  JoinClub: undefined;
  ClubDetail: { clubId: string };
  ClubMembers: { clubId: string };
  SessionList: { clubId: string };
  CreateSession: { clubId: string };
  SessionDetail: { sessionId: string };
  AddMatch: { sessionId: string };
  ActivityMatch: { activityId: string };
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
          />
        )}
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
            onDeleted={() => navigation.navigate('ClubList')}
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
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="CreateSession">
        {({ navigation, route }) => (
          <CreateSessionScreen
            clubId={route.params.clubId}
            onBack={() => navigation.goBack()}
            onCreated={(session) => navigation.replace('SessionDetail', { sessionId: session.id })}
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
