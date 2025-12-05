import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyDNXm5xKNvOa3SLDQVcLuK88UowTyV3ZRY",
  authDomain: "pbp-week-10.firebaseapp.com",
  projectId: "pbp-week-10",
  storageBucket: "pbp-week-10.firebasestorage.app",
  messagingSenderId: "1023835274226",
  appId: "1:1023835274226:web:f73e48e39bbe92d195496b",
  measurementId: "G-NMHM4BGDFV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});
const db = getFirestore(app);

// Initialize Analytics only if supported (browser environment)
let analytics = null;
isSupported().then((supported) => {
  if (supported) {
    analytics = getAnalytics(app);
  }
});

export { app, auth, analytics, db };