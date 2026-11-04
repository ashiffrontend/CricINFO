/**
 * Firebase Initialization & Services Module
 * Gully Cricket Scorer
 * Designed & Developed by Ashif Web Studio
 * Developer: Mohammad Ashif (mohdashif.dev@gmail.com)
 * Website: https://ashif-web-studio.vercel.app
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  collection,
  deleteDoc,
  updateDoc
} from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';

// 1. Firebase configuration provided by user
export const firebaseConfig = {
  apiKey: "AIzaSyB-FE89YoOxxA71iYyPsusGsayQPPXieVM",
  authDomain: "ashif-web-studio.firebaseapp.com",
  projectId: "ashif-web-studio",
  storageBucket: "ashif-web-studio.firebasestorage.app",
  messagingSenderId: "50473003726",
  appId: "1:50473003726:web:f9fcd2a57f2a7002547e9f",
  measurementId: "G-D29W046SCH"
};

// 2. Ensure initializeApp is called exactly ONCE (prevent duplicate initialization)
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// 3. Initialize Firebase Authentication instance
export const auth = getAuth(app);

// 4. Initialize Cloud Firestore database instance (configured with resilient transport)
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
});

// 5. Initialize Google Auth Provider
export const provider = new GoogleAuthProvider();
provider.setCustomParameters({
  prompt: 'select_account'
});

// 6. Initialize Firebase Analytics conditionally if supported in runtime environment
export let analytics = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
      console.log('[Firebase] Analytics initialized successfully.');
    }
  }).catch(() => {
    // Analytics optional in restricted or test environments
  });
}

// Master Admin Email
export const ADMIN_EMAIL = 'mohdashif.dev@gmail.com';

/**
 * Standardized Firestore error logger
 */
export function logFirestoreError(error, operation, path) {
  console.error(`[Firestore ${operation.toUpperCase()} Error at ${path}]:`, error.code || '', error.message || error);
}

/**
 * Save or update match in Firestore
 * Automatically marks previous live match as completed when starting a new live match
 */
export async function saveMatchToFirestore(matchData) {
  if (!matchData || !matchData.id) return null;
  const currentUid = auth.currentUser ? auth.currentUser.uid : (matchData.ownerUID || matchData.userId || 'guest_user');
  const nowIso = new Date().toISOString();

  // If this match is LIVE, automatically mark any previous live match for this user as completed
  if (matchData.status === 'live' && auth.currentUser) {
    try {
      const liveQ = query(
        collection(db, 'matches'),
        where('ownerUID', '==', currentUid),
        where('status', '==', 'live')
      );
      const snap = await getDocs(liveQ);
      snap.forEach(async (d) => {
        if (d.id !== matchData.id) {
          await updateDoc(doc(db, 'matches', d.id), {
            status: 'completed',
            updatedAt: nowIso
          });
        }
      });
    } catch (e) {
      // ignore offline query errors
    }
  }

  const matchDocRef = doc(db, 'matches', matchData.id);
  const payload = {
    ...matchData,
    ownerUID: currentUid,
    userId: currentUid,
    creatorEmail: auth.currentUser ? auth.currentUser.email : (matchData.creatorEmail || 'user@gullycricket.local'),
    updatedAt: nowIso,
    createdAt: matchData.createdAt || nowIso
  };

  try {
    await setDoc(matchDocRef, payload, { merge: true });
    console.log('[Firestore] Match saved:', matchData.id);
    return payload;
  } catch (err) {
    logFirestoreError(err, 'write', 'matches/' + matchData.id);
    return null;
  }
}

/**
 * Fetch ONLY current logged-in user's matches (ownerUID == currentUser.uid)
 * Strictly enforces user isolation: User A sees only User A matches.
 */
export async function fetchUserMatches(uid) {
  if (!uid) return [];
  try {
    const q = query(
      collection(db, 'matches'),
      where('ownerUID', '==', uid)
    );
    const snapshot = await getDocs(q);
    const list = [];
    snapshot.forEach((d) => {
      list.push({ id: d.id, ...d.data() });
    });
    // Sort descending by updatedAt / createdAt
    list.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    return list;
  } catch (err) {
    logFirestoreError(err, 'list', 'matches');
    return [];
  }
}

/**
 * Fetch Admin Stats (For Master Admin)
 */
export async function fetchAdminStats() {
  try {
    const [usersSnap, matchesSnap, loginsSnap] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'matches')),
      getDocs(collection(db, 'login_logs'))
    ]);

    const users = [];
    usersSnap.forEach((d) => users.push(d.data()));

    const matches = [];
    let liveCount = 0;
    let completedCount = 0;

    matchesSnap.forEach((d) => {
      const data = d.data();
      matches.push({ id: d.id, ...data });
      if (data.status === 'live') liveCount++;
      if (data.status === 'completed') completedCount++;
    });

    const logins = [];
    loginsSnap.forEach((d) => logins.push(d.data()));
    logins.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const todayStr = new Date().toISOString().split('T')[0];
    const todayLogins = logins.filter((l) => l.timestamp && l.timestamp.startsWith(todayStr)).length;

    return {
      totalUsers: users.length,
      todayLogins: todayLogins || logins.length,
      matchesCreated: matches.length,
      completedMatches: completedCount,
      liveMatches: liveCount,
      users,
      matches,
      logins
    };
  } catch (err) {
    console.warn('[Admin] Admin stats fallback:', err);
    return null;
  }
}

/**
 * Delete a match from Firestore
 */
export async function deleteMatchFromFirestore(matchId) {
  try {
    await deleteDoc(doc(db, 'matches', matchId));
    return true;
  } catch (err) {
    logFirestoreError(err, 'delete', 'matches/' + matchId);
    return false;
  }
}

/**
 * Delete a user from Firestore (Admin only)
 */
export async function deleteUserFromFirestore(userId) {
  try {
    await deleteDoc(doc(db, 'users', userId));
    return true;
  } catch (err) {
    logFirestoreError(err, 'delete', 'users/' + userId);
    return false;
  }
}
