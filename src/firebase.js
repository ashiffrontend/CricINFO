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
  where,
  orderBy,
  limit,
  deleteDoc,
  updateDoc
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
 * Health check connection testing
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
 * Stores in Firestore 'users' collection: uid, name, email, photo, loginTime
 */
export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    const userDocRef = doc(db, 'users', user.uid);
    const nowIso = new Date().toISOString();

    let existingData = {};
    try {
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        existingData = snap.data();
      }
    } catch (e) {
      // offline fallback
    }

    const userData = {
      uid: user.uid,
      name: user.displayName || 'Cricket Player',
      email: user.email || '',
      photo: user.photoURL || '',
      loginTime: nowIso,
      createdAt: existingData.createdAt || nowIso,
      role: user.email === ADMIN_EMAIL ? 'admin' : (existingData.role || 'user')
    };

    try {
      await setDoc(userDocRef, userData, { merge: true });

      // Track in login_logs
      const logRef = doc(collection(db, 'login_logs'));
      await setDoc(logRef, {
        id: logRef.id,
        uid: user.uid,
        email: user.email || '',
        name: user.displayName || '',
        photo: user.photoURL || '',
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
 * Save match to Firestore
 * Automatically marks previous live match as completed when starting a new live match!
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
      snap.forEach(async d => {
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
    handleFirestoreError(err, 'write', 'matches/' + matchData.id);
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
    snapshot.forEach(d => {
      list.push({ id: d.id, ...d.data() });
    });
    // Sort descending by updatedAt / createdAt
    list.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    return list;
  } catch (err) {
    handleFirestoreError(err, 'list', 'matches');
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
    logins.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

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
    console.warn('[Admin] Admin stats fallback:', err);
    return null;
  }
}

/**
 * Delete a match
 */
export async function deleteMatchFromFirestore(matchId) {
  try {
    await deleteDoc(doc(db, 'matches', matchId));
    return true;
  } catch (err) {
    handleFirestoreError(err, 'delete', 'matches/' + matchId);
    return false;
  }
}

/**
 * Delete a user (Admin only)
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
