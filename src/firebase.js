/**
 * Firebase Service Module
 * Gully Cricket Scorer
 * Designed & Developed by Ashif Web Studio
 * Developer: Mohammad Ashif (mohdashif.dev@gmail.com)
 */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import {
  initializeFirestore,
  doc,
  getDoc,
  setDoc,
  getDocFromServer,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';

import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App & Services
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);

export const ADMIN_EMAIL = 'mohdashif.dev@gmail.com';

/**
 * Standardized Firestore error handler conforming to FirestoreErrorInfo spec
 */
export function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      providerInfo: auth.currentUser?.providerData?.map(p => ({
        providerId: p.providerId,
        email: p.email
      })) || []
    },
    operationType,
    path
  };
  console.error('[Firestore Error]:', JSON.stringify(errInfo));
  return errInfo;
}

/**
 * Test connectivity on app boot per Firebase integration guidelines
 */
export async function testFirebaseConnection() {
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('the client is offline (timeout)')), 4000)
    );
    await Promise.race([
      getDocFromServer(doc(db, 'test', 'connection')),
      timeoutPromise
    ]);
    console.log('[Firebase] Connected to Firestore successfully.');
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[Firebase] Firestore client is running in offline mode.');
    } else {
      console.log('[Firebase] Handshake complete.');
    }
  }
}

/**
 * Sign in using Google Auth Popup
 * Updates users collection with uid, name, email, photo, createdAt, lastLogin
 */
export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    const userDocRef = doc(db, 'users', user.uid);
    const nowIso = new Date().toISOString();

    // Check if user already exists
    let existingData = {};
    try {
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        existingData = snap.data();
      }
    } catch (e) {
      // offline or permission
    }

    const userData = {
      uid: user.uid,
      name: user.displayName || 'Gully Player',
      email: user.email || '',
      photo: user.photoURL || '',
      createdAt: existingData.createdAt || nowIso,
      lastLogin: nowIso,
      role: user.email === ADMIN_EMAIL ? 'admin' : (existingData.role || 'user')
    };

    try {
      await setDoc(userDocRef, userData, { merge: true });
      // Log login event
      const logRef = doc(collection(db, 'login_logs'));
      await setDoc(logRef, {
        id: logRef.id,
        uid: user.uid,
        email: user.email || '',
        timestamp: nowIso
      });
    } catch (e) {
      handleFirestoreError(e, 'write', 'users/' + user.uid);
    }

    return userData;
  } catch (err) {
    console.error('Google Sign-in failed:', err);
    throw err;
  }
}

/**
 * Sign out current user
 */
export async function logoutUser() {
  return signOut(auth);
}

/**
 * Save or update match in Firestore
 */
export async function saveMatchToFirestore(matchData) {
  if (!matchData || !matchData.id) return null;
  const matchDocRef = doc(db, 'matches', matchData.id);
  const nowIso = new Date().toISOString();

  const payload = {
    ...matchData,
    userId: auth.currentUser ? auth.currentUser.uid : (matchData.userId || 'guest_user'),
    creatorEmail: auth.currentUser ? auth.currentUser.email : (matchData.creatorEmail || 'guest@gullycricket.local'),
    updatedAt: nowIso,
    createdAt: matchData.createdAt || nowIso
  };

  try {
    await setDoc(matchDocRef, payload, { merge: true });
    console.log('[Firestore] Match synced successfully:', matchData.id);
    return payload;
  } catch (err) {
    handleFirestoreError(err, 'write', 'matches/' + matchData.id);
    return null;
  }
}

/**
 * Fetch matches from Firestore
 */
export async function fetchMatchesFromFirestore(limitCount = 50) {
  try {
    let snapshot;
    try {
      const q = query(collection(db, 'matches'), orderBy('updatedAt', 'desc'), limit(limitCount));
      snapshot = await getDocs(q);
    } catch (orderErr) {
      snapshot = await getDocs(query(collection(db, 'matches'), limit(limitCount)));
    }
    const matches = [];
    snapshot.forEach(docSnap => {
      matches.push({ id: docSnap.id, ...docSnap.data() });
    });
    return matches;
  } catch (err) {
    handleFirestoreError(err, 'list', 'matches');
    return [];
  }
}

/**
 * Delete a match from Firestore
 */
export async function deleteMatchFromFirestore(matchId) {
  try {
    await deleteDoc(doc(db, 'matches', matchId));
    console.log('[Firestore] Match deleted:', matchId);
    return true;
  } catch (err) {
    handleFirestoreError(err, 'delete', 'matches/' + matchId);
    return false;
  }
}

/**
 * Fetch Admin Dashboard Statistics
 */
export async function fetchAdminStats() {
  try {
    const [usersSnap, matchesSnap, loginsSnap] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'matches')),
      getDocs(collection(db, 'login_logs'))
    ]);

    const users = [];
    usersSnap.forEach(d => users.push(d.data()));

    const matches = [];
    let liveCount = 0;
    let completedCount = 0;

    matchesSnap.forEach(d => {
      const data = d.data();
      matches.push({ id: d.id, ...data });
      if (data.status === 'live') liveCount++;
      if (data.status === 'completed') completedCount++;
    });

    const logins = [];
    loginsSnap.forEach(d => logins.push(d.data()));

    // Today logins count
    const todayStr = new Date().toISOString().split('T')[0];
    const todayLogins = logins.filter(l => l.timestamp && l.timestamp.startsWith(todayStr)).length;

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
    console.warn('[Admin] Could not load all firestore tables, using local fallback:', err);
    return null;
  }
}

/**
 * Delete a user from users collection (Admin only)
 */
export async function deleteUserFromFirestore(userId) {
  try {
    await deleteDoc(doc(db, 'users', userId));
    return true;
  } catch (err) {
    handleFirestoreError(err, 'delete', 'users/' + userId);
    return false;
  }
}

/**
 * Check if current user is admin
 */
export function isUserAdmin(user) {
  if (!user) return false;
  return user.email === ADMIN_EMAIL;
}
