import type { LinkingOptions, NavigatorScreenParams } from '@react-navigation/native';
import type { AuthStackParamList } from './AuthStack';
import type { MainStackParamList } from './MainStack';
import type { PersonalTabParamList } from './PersonalTabs';

type LinkableParamList = AuthStackParamList &
  Omit<MainStackParamList, 'Personal'> & { Personal: NavigatorScreenParams<PersonalTabParamList> };

// URL <-> screen mapping. Mostly for the browser, where it is what makes
// refresh, the back button and a pasted link land on the right screen;
// native ignores it until deep links are configured. Screen names are
// shared by AuthStack and MainStack — only one is mounted at a time, and
// a path that doesn't match the mounted one falls back to its first
// screen (so a signed-out visitor opening /sessions/… gets Login).
export const linking: LinkingOptions<LinkableParamList> = {
  prefixes: [],
  config: {
    // A page opened straight from a URL (refresh, pasted link) would
    // otherwise be the only screen on the stack, leaving every in-app
    // back arrow and every "save, then go back" with nowhere to go.
    // Putting Home underneath gives them a destination.
    initialRouteName: 'Personal',
    screens: {
      Login: 'login',
      SignUp: 'signup',
      Personal: {
        screens: {
          Home: '',
          Explore: 'explore',
          Inbox: 'inbox',
          Me: 'me',
        },
      },
      Settings: 'settings',
      MySessionHistory: 'history',
      CreateClub: 'clubs/new',
      ClubDetail: 'clubs/:clubId',
      ClubMembers: 'clubs/:clubId/members',
      ClubSettings: 'clubs/:clubId/settings',
      SessionList: 'clubs/:clubId/sessions',
      SessionHistory: 'clubs/:clubId/sessions/past',
      CreateSession: 'clubs/:clubId/sessions/new',
      RecurringScheduleList: 'clubs/:clubId/schedules',
      CreateRecurringSchedule: 'clubs/:clubId/schedules/new',
      RecurringScheduleDetail: 'clubs/:clubId/schedules/:scheduleId',
      EditRecurringSchedule: 'clubs/:clubId/schedules/:scheduleId/edit',
      SessionDetail: 'sessions/:sessionId',
      EditSession: 'sessions/:sessionId/edit',
      AddMatch: 'sessions/:sessionId/matches/new',
      ActivityMatch: 'matches/:activityId',
    },
  },
};
