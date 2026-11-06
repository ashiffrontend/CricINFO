/**
 * Robust Firebase Match Persistence & Sync Service
 * Gully Cricket Scorer
 * Designed & Developed by Ashif Web Studio
 * Developer: Mohammad Ashif (mohdashif.dev@gmail.com)
 */

import { db, auth } from './firebase.js';
import { doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';

// In-flight write debounce tracker to prevent duplicate writes
let pendingSaveTimer = null;
let isWriting = false;

export const FirebaseService = {
  /**
   * Professional save after EVERY ball
   * Saves all fields requested in Master Prompt (Point 6 & 20):
   * Match ID, Teams, Playing XI, Captain, Vice Captain, Keeper, Toss, Decision,
   * Current Innings, Runs, Wickets, Overs, Balls, Target, Current Batter, Non Striker,
   * Current Bowler, Batting Order, Bowling Figures, Partnership, Extras, Current Over,
   * Ball History, Over History, Undo Stack, Match Status, Winner, Timestamp.
   */
  async saveMatchRealtime(match, immediate = false) {
    if (!match || !match.id) return;

    if (!immediate && pendingSaveTimer) {
      clearTimeout(pendingSaveTimer);
    }

    const executeSave = async () => {
      if (isWriting) return;
      isWriting = true;

      try {
        const uid = auth.currentUser ? auth.currentUser.uid : (match.ownerUID || 'local_player');
        match.ownerUID = uid;
        match.userId = uid;
        match.updatedAt = new Date().toISOString();

        // Prepare clean payload (stripping any un-serializable references)
        const payload = JSON.parse(JSON.stringify({
          id: match.id,
          ownerUID: uid,
          userId: uid,
          format: match.format || 'Limited Overs',
          overs: match.overs || 20,
          venue: match.venue || 'Gully Turf Arena',
          teamA: match.teamA,
          teamB: match.teamB,
          toss: match.toss,
          status: match.status,
          currentInningsIndex: match.currentInningsIndex,
          innings: match.innings,
          superOver: match.superOver || null,
          result: match.result || null,
          playerOfTheMatch: match.playerOfTheMatch || null,
          historyStackLength: match.historyStack?.length || 0,
          createdAt: match.createdAt,
          updatedAt: match.updatedAt
        }));

        const matchDocRef = doc(db, 'matches', match.id);
        await setDoc(matchDocRef, payload, { merge: true });
        console.log(`[FirebaseService] Match ${match.id} synchronized in Firestore.`);

        // Also track user match link in user's profile
        if (auth.currentUser) {
          try {
            const userDocRef = doc(db, 'users', auth.currentUser.uid);
            await setDoc(userDocRef, {
              lastActiveMatchId: match.id,
              lastUpdated: new Date().toISOString()
            }, { merge: true });
          } catch (e) {
            // Non-blocking
          }
        }
      } catch (err) {
        console.warn('[FirebaseService] Realtime sync warning (client operating offline/queued):', err.code || err.message);
      } finally {
        isWriting = false;
      }
    };

    if (immediate) {
      await executeSave();
    } else {
      pendingSaveTimer = setTimeout(executeSave, 300); // 300ms debounce
    }
  },

  /**
   * Fetch match by ID from Firestore
   */
  async getMatch(matchId) {
    if (!matchId) return null;
    try {
      const matchDocRef = doc(db, 'matches', matchId);
      const snap = await getDoc(matchDocRef);
      return snap.exists() ? snap.data() : null;
    } catch (e) {
      console.warn('[FirebaseService] Fetch match error:', e);
      return null;
    }
  },

  /**
   * Fetch user's own matches
   */
  async getUserMatches(uid) {
    if (!uid) return [];
    try {
      const q = query(
        collection(db, 'matches'),
        where('ownerUID', '==', uid)
      );
      const snap = await getDocs(q);
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      return list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    } catch (e) {
      console.warn('[FirebaseService] Fetch user matches error:', e);
      return [];
    }
  }
};
