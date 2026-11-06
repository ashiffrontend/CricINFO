/**
 * Offline Storage & Automatic Match Recovery Module
 * Gully Cricket Scorer
 * Designed & Developed by Ashif Web Studio
 * Developer: Mohammad Ashif (mohdashif.dev@gmail.com)
 */

const STORAGE_KEYS = {
  ACTIVE_MATCH: 'gully_cricket_active_match_v2',
  SAVED_MATCHES: 'gully_cricket_saved_matches_v2',
  PENDING_SYNC: 'gully_cricket_offline_sync_queue_v2',
  CACHED_USER: 'gully_cricket_cached_user_v2'
};

export const OfflineStorage = {
  /**
   * Save active live match to LocalStorage
   */
  saveLiveMatch(match) {
    if (!match) {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_MATCH);
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_MATCH, JSON.stringify(match));
    } catch (e) {
      console.warn('[OfflineStorage] LocalStorage quota exceeded or error:', e);
    }
  },

  /**
   * Recover active live match after browser refresh or closing
   */
  getLiveMatch() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ACTIVE_MATCH);
      if (!data) return null;
      const parsed = JSON.parse(data);
      console.log(`[OfflineStorage] Auto-recovered active match: ${parsed.id}`);
      return parsed;
    } catch (e) {
      console.warn('[OfflineStorage] Recovery error:', e);
      return null;
    }
  },

  /**
   * Clear active match
   */
  clearLiveMatch() {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_MATCH);
  },

  /**
   * Archive match in local records
   */
  archiveMatch(match) {
    if (!match || !match.id) return;
    try {
      const existing = OfflineStorage.getArchivedMatches();
      const idx = existing.findIndex(m => m.id === match.id);
      if (idx >= 0) {
        existing[idx] = match;
      } else {
        existing.unshift(match);
      }
      localStorage.setItem(STORAGE_KEYS.SAVED_MATCHES, JSON.stringify(existing));
    } catch (e) {
      console.warn('[OfflineStorage] Archive save error:', e);
    }
  },

  /**
   * Get all locally archived matches
   */
  getArchivedMatches() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SAVED_MATCHES);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  /**
   * User cache
   */
  getCachedUser() {
    try {
      const u = localStorage.getItem(STORAGE_KEYS.CACHED_USER);
      return u ? JSON.parse(u) : null;
    } catch (e) {
      return null;
    }
  },

  setCachedUser(user) {
    if (!user) {
      localStorage.removeItem(STORAGE_KEYS.CACHED_USER);
    } else {
      localStorage.setItem(STORAGE_KEYS.CACHED_USER, JSON.stringify(user));
    }
  }
};
