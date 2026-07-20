import { Platform } from 'react-native';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { Database, getDatabase } from 'firebase/database';
import { Auth, getAuth, initializeAuth } from 'firebase/auth';
// getReactNativePersistence is exported by the RN runtime build (which Metro correctly
// resolves via the "react-native" package export condition) but is missing from the
// package's static type declarations, which resolve to a platform-generic .d.ts — hence
// the type-only import below instead of pulling it in through the main import above.
// @ts-expect-error — see comment above; the symbol exists at runtime.
import { getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
const databaseURL = process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL;

let app: FirebaseApp | null = null;
let db: Database | null = null;
let auth: Auth | null = null;

if (apiKey) {
  app =
    getApps().length === 0
      ? initializeApp({
          apiKey,
          authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
          databaseURL,
          projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
          storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
          appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
        })
      : getApps()[0];

  if (databaseURL) {
    db = getDatabase(app);
  }

  auth =
    Platform.OS === 'web'
      ? getAuth(app)
      : initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
}

export { db, auth };
export const isFirebaseReady = Boolean(db);
export const isAuthReady = Boolean(auth);
