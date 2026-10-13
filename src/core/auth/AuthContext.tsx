import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '../../firebase';
import { signUp as firebaseSignUp, signIn as firebaseSignIn, signOutUser } from './firebaseAuth';
import { createProfile, getMe, ApiRequestError } from '../api/client';
import type { UserProfile } from '../api/types';

type AuthContextValue = {
  firebaseUser: FirebaseUser | null;
  profile: UserProfile | null;
  initializing: boolean;
  needsProfile: boolean;
  // DP-015: the account must confirm an email before using the app (new
  // accounts only — see UserProfile.emailRequired).
  needsEmail: boolean;
  signUp: (username: string, password: string, email: string) => Promise<void>;
  // `identifier` is a username or a confirmed email.
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [needsProfile, setNeedsProfile] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const p = await getMe();
      setProfile(p);
      setNeedsProfile(false);
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'PROFILE_NOT_FOUND') {
        setProfile(null);
        setNeedsProfile(true);
      } else {
        throw err;
      }
    }
  }, []);

  useEffect(() => {
    if (!auth) {
      setInitializing(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await loadProfile().catch(() => {});
      } else {
        setProfile(null);
        setNeedsProfile(false);
      }
      setInitializing(false);
    });
    return unsubscribe;
  }, [loadProfile]);

  const signUp = useCallback(async (username: string, password: string, email: string) => {
    await firebaseSignUp(username, password);
    const p = await createProfile(username, undefined, email);
    setProfile(p);
    setNeedsProfile(false);
  }, []);

  const signIn = useCallback(async (identifier: string, password: string) => {
    await firebaseSignIn(identifier, password);
    await loadProfile();
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await signOutUser();
    setProfile(null);
    setNeedsProfile(false);
  }, []);

  const needsEmail = Boolean(profile?.emailRequired && !profile.email);

  return (
    <AuthContext.Provider
      value={{ firebaseUser, profile, initializing, needsProfile, needsEmail, signUp, signIn, signOut, refreshProfile: loadProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
