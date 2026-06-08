import { initializeApp, getApps, getApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';

// Standard Firebase config structure.
// Users can configure this via environment variables or direct replacement.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "mock-api-key-replace-me",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "mock-auth-domain-replace-me",
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL || "https://mock-database-url.firebaseio.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "mock-project-id",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "mock-storage-bucket",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "mock-messaging-sender-id",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "mock-app-id"
};

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase Auth with appropriate persistence per platform
const auth = (() => {
  try {
    if (Platform.OS === 'web') {
      // On Web, use standard browser persistence (IndexedDB/LocalStorage)
      return FirebaseAuth.initializeAuth(app, {
        persistence: [
          FirebaseAuth.indexedDBLocalPersistence,
          FirebaseAuth.browserLocalPersistence,
          FirebaseAuth.browserSessionPersistence
        ]
      });
    } else {
      // On Native, use AsyncStorage persistence
      const getReactNativePersistence = (FirebaseAuth as any).getReactNativePersistence;
      if (getReactNativePersistence) {
        return FirebaseAuth.initializeAuth(app, {
          persistence: getReactNativePersistence(AsyncStorage)
        });
      }
    }
    return FirebaseAuth.getAuth(app);
  } catch (error) {
    // If auth is already initialized or initializeAuth fails
    return FirebaseAuth.getAuth(app);
  }
})();

// Initialize other Firebase services
const db = getFirestore(app);
const rtdb = getDatabase(app);
const storage = getStorage(app);

export { app, auth, db, rtdb, storage };
export default app;
