import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getAnalytics, isSupported } from 'firebase/analytics';

// Live Firebase configuration
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAnoDdt5S8ZBXa7CsQ_vDoeyfz9e2LS8VU",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "velicham-tharaam-ad249.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://velicham-tharaam-ad249-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "velicham-tharaam-ad249",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "velicham-tharaam-ad249.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1001442811628",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1001442811628:web:b656fec5d3ce52e2fc0fc9",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-1ER0DQ4MYR"
};

export const isLiveFirebaseConfigured = true;

// Initialize Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);

// Initialize Analytics conditionally (safe for all browser environments)
if (typeof window !== 'undefined') {
  isSupported().then(yes => {
    if (yes) {
      getAnalytics(app);
    }
  }).catch(() => {});
}
