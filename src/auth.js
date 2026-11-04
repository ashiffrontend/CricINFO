/**
 * Authentication Module
 * Gully Cricket Scorer
 * Designed & Developed by Ashif Web Studio
 * Developer: Mohammad Ashif (mohdashif.dev@gmail.com)
 * Website: https://ashif-web-studio.vercel.app
 */

import {
  signInWithPopup,
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
 * Handle Google Authentication with Popup
 *
 * Requirements Met:
 * - Uses signInWithPopup(auth, provider)
 * - Saves user in Firestore under collection 'users' with document ID = currentUser.uid
 * - Document fields: uid, displayName, email, photoURL, createdAt, lastLogin, provider
 * - If user already exists in Firestore, updates ONLY lastLogin
 * - If signInWithPopup fails, logs the exact Firebase error code and message to browser console
 *
 * @returns {Promise<import('firebase/auth').User>} The authenticated user object
 */
export async function loginWithGoogle() {
  try {
    // 1. Invoke Google popup sign-in with Firebase Auth
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // 2. Reference the user document using currentUser.uid
    const userDocRef = doc(db, 'users', user.uid);
    const nowIso = new Date().toISOString();

    // 3. Check whether this user document already exists in Firestore
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

    return user;
  } catch (error) {
    // Requirement 21: Log exact Firebase error code and message in console
    const errorCode = error.code || 'UNKNOWN_AUTH_ERROR';
    const errorMessage = error.message || error.toString();
    console.error(`[Firebase Auth Error] Code: ${errorCode} | Message: ${errorMessage}`);
    throw error;
  }
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
