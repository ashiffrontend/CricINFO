/**
 * Authentication Module
 * Gully Cricket Scorer
 * Designed & Developed by Ashif Web Studio
 * Developer: Mohammad Ashif (mohdashif.dev@gmail.com)
 * Website: https://ashif-web-studio.vercel.app
 */

import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { auth, db, provider } from './firebase.js';

/**
 * Synchronize user document with Cloud Firestore
 *
 * Requirements Met:
 * - Saves user in Firestore under collection 'users' with document ID = currentUser.uid
 * - Document fields: uid, displayName, email, photoURL, createdAt, lastLogin, provider
 * - If user already exists in Firestore, updates ONLY lastLogin
 *
 * @param {import('firebase/auth').User} user
 */
export async function syncUserToFirestore(user) {
  if (!user || !user.uid) return;
  const userDocRef = doc(db, 'users', user.uid);
  const nowIso = new Date().toISOString();

  try {
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      // Requirement 8: If user already exists, update ONLY lastLogin
      await updateDoc(userDocRef, {
        lastLogin: nowIso
      });
      console.log('[Auth] Existing user authenticated. Updated lastLogin for UID:', user.uid);
    } else {
      // Requirement 7: New user registration with all required fields
      const newUserData = {
        uid: user.uid,
        displayName: user.displayName || 'Gully Player',
        email: user.email || '',
        photoURL: user.photoURL || '',
        createdAt: nowIso,
        lastLogin: nowIso,
        provider: 'google.com'
      };

      await setDoc(userDocRef, newUserData);
      console.log('[Auth] New user registered and saved in Firestore with UID:', user.uid);
    }
  } catch (err) {
    console.error('[Firestore User Sync Error]:', err.code || '', err.message || err);
  }
}

// Concurrency lock to prevent duplicate/rapid login calls
let activeLoginPromise = null;

/**
 * Handle Google Authentication with Popup and Redirect fallback
 *
 * Requirements Met:
 * - Uses signInWithPopup(auth, provider)
 * - Prevents multiple concurrent popup calls (resolves auth/cancelled-popup-request)
 * - Handles auth/popup-blocked gracefully with fallback to redirect flow in top-level window
 * - Logs exact Firebase error code and message to browser console
 *
 * @returns {Promise<import('firebase/auth').User|null>} The authenticated user object or null if redirect initiated
 */
export async function loginWithGoogle() {
  if (activeLoginPromise) {
    console.log('[Auth] Login already in progress. Reusing active request...');
    return activeLoginPromise;
  }

  activeLoginPromise = (async () => {
    try {
      // 1. Invoke Google popup sign-in with Firebase Auth
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // 2. Synchronize user in Firestore (Requirement 7 & 8)
      await syncUserToFirestore(user);

      return user;
    } catch (error) {
      const errorCode = error.code || 'UNKNOWN_AUTH_ERROR';
      const errorMessage = error.message || error.toString();

      // If a popup was cancelled because another was initiated or handled, treat gracefully
      if (errorCode === 'auth/cancelled-popup-request') {
        console.warn('[Auth] Previous popup request cancelled by user interaction.');
        return null;
      }

      // Requirement 21: Log exact Firebase error code and message in console
      if (errorCode === 'auth/unauthorized-domain') {
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        console.warn(`[Firebase Auth Warning] Domain "${host}" is not authorized. Add "${host}" to Firebase Console -> Authentication -> Settings -> Authorized domains (or test on Vercel at https://cric-info-eta.vercel.app).`);
      } else {
        console.error(`[Firebase Auth Error] Code: ${errorCode} | Message: ${errorMessage}`);
      }

      // If popup was blocked by browser in a top-level window, automatically fall back to signInWithRedirect
      if (errorCode === 'auth/popup-blocked' && typeof window !== 'undefined' && window.self === window.top) {
        console.warn('[Auth] Popup blocked in top window. Falling back to signInWithRedirect...');
        await signInWithRedirect(auth, provider);
        return null;
      }

      throw error;
    } finally {
      activeLoginPromise = null;
    }
  })();

  return activeLoginPromise;
}

/**
 * Handle User Logout
 *
 * Requirements Met:
 * - Signs out current user from Firebase Auth
 * - Terminates active session and notifies auth listeners
 *
 * @returns {Promise<void>}
 */
export async function logoutUser() {
  try {
    await signOut(auth);
    console.log('[Auth] User successfully signed out from Firebase.');
  } catch (error) {
    console.error(`[Firebase Logout Error] Code: ${error.code} | Message: ${error.message}`);
    throw error;
  }
}

/**
 * Persistent Authentication Observer & Route Guard
 *
 * Requirements Met:
 * - Requirement 9: Uses onAuthStateChanged() to keep login persistent across sessions.
 * - Requirement 10: Automatically redirects:
 *     Not Logged In -> Login Page (#login)
 *     Logged In -> Dashboard (#home)
 *
 * @param {Function} [onUserChanged] Optional callback invoked with the current user or null
 * @returns {import('firebase/auth').Unsubscribe} Unsubscribe function for listener cleanup
 */
export function initAuthListener(onUserChanged) {
  // Check if returning from a Google redirect sign-in
  if (typeof window !== 'undefined') {
    getRedirectResult(auth).then(async (result) => {
      if (result && result.user) {
        await syncUserToFirestore(result.user);
        console.log('[Auth] Google redirect sign-in processed for:', result.user.email);
      }
    }).catch((err) => {
      if (err.code && err.code !== 'auth/popup-closed-by-user') {
        console.warn('[Auth] getRedirectResult status:', err.code, err.message);
      }
    });
  }

  return onAuthStateChanged(auth, (user) => {
    const currentHash = window.location.hash;

    if (user) {
      console.log(`[Auth] Persistent session active for: ${user.email} (UID: ${user.uid})`);
      if (typeof onUserChanged === 'function') {
        onUserChanged(user);
      }

      // Requirement 10: If logged in and currently on login page or empty hash, redirect to Dashboard
      if (currentHash === '#login' || currentHash === '' || currentHash === '#') {
        window.location.hash = '#home';
      }
    } else {
      console.log('[Auth] No active authenticated session.');
      if (typeof onUserChanged === 'function') {
        onUserChanged(null);
      }

      // Requirement 10: If not logged in and trying to access protected views, redirect to Login Page
      // Allow access to hidden #admin-login if admin passcode is being used
      if (currentHash !== '#login' && !currentHash.includes('admin-login')) {
        window.location.hash = '#login';
      }
    }
  });
}
