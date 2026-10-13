import { Platform } from 'react-native';
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
const linking: LinkingOptions<LinkableParamList> = {
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

// The address the browser was opened at, read once before any navigator
// mounts (the signed-out stack immediately rewrites the URL to /login).
// A visitor who had to sign in first is taken there afterwards instead of
// being dropped on Home. Consumed by the first signed-in mount, so a later
// sign-out/sign-in in the same tab starts from Home as usual.
let intendedUrl: string | null = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : null;

function takeIntendedUrl(): string | null {
  const url = intendedUrl;
  intendedUrl = null;
  return url;
}

// Built once: NavigationContainer expects a stable `linking` object.
const signedInLinking: LinkingOptions<LinkableParamList> = {
  ...linking,
  getInitialURL: () => takeIntendedUrl() ?? window.location.href,
};

export function linkingFor(signedIn: boolean): LinkingOptions<LinkableParamList> {
  return Platform.OS === 'web' && signedIn ? signedInLinking : linking;
}
