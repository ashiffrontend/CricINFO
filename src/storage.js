/**
 * Storage & Offline Sync Module
 * Gully Cricket Scorer
 * Designed & Developed by Ashif Web Studio
 */

const STORAGE_KEY_LIVE_MATCH = 'gully_cricket_live_match_v1';
const STORAGE_KEY_MATCHES = 'gully_cricket_matches_archive_v1';
const STORAGE_KEY_PLAYERS = 'gully_cricket_players_v1';
const STORAGE_KEY_TEAMS = 'gully_cricket_teams_v1';
const STORAGE_KEY_SERIES = 'gully_cricket_series_v1';
const STORAGE_KEY_THEME = 'gully_cricket_theme_v1';
const STORAGE_KEY_USER = 'gully_cricket_user_v1';

export const storage = {
  // Active Match
  getLiveMatch() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_LIVE_MATCH);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  setLiveMatch(match) {
    try {
      if (!match) {
        localStorage.removeItem(STORAGE_KEY_LIVE_MATCH);
      } else {
        localStorage.setItem(STORAGE_KEY_LIVE_MATCH, JSON.stringify(match));
      }
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  },

  clearLiveMatch() {
    localStorage.removeItem(STORAGE_KEY_LIVE_MATCH);
  },

  // Matches Archive
  getAllMatches() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_MATCHES);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  saveMatch(match) {
    const list = this.getAllMatches();
    const index = list.findIndex(m => m.id === match.id);
    if (index >= 0) {
      list[index] = match;
    } else {
      list.unshift(match);
    }
    try {
      localStorage.setItem(STORAGE_KEY_MATCHES, JSON.stringify(list));
    } catch (e) {
      console.warn('Match archive save error:', e);
    }
    return list;
  },

  deleteMatch(matchId) {
    const list = this.getAllMatches().filter(m => m.id !== matchId);
    localStorage.setItem(STORAGE_KEY_MATCHES, JSON.stringify(list));
    return list;
  },

  // Series / Tournaments
  getAllSeries() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_SERIES);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  saveSeries(series) {
    const list = this.getAllSeries();
    const idx = list.findIndex(s => s.id === series.id);
    if (idx >= 0) {
      list[idx] = series;
    } else {
      list.unshift(series);
    }
    localStorage.setItem(STORAGE_KEY_SERIES, JSON.stringify(list));
    return list;
  },

  // Theme Setting
  getTheme() {
    return localStorage.getItem(STORAGE_KEY_THEME) || 'light';
  },

  setTheme(theme) {
    localStorage.setItem(STORAGE_KEY_THEME, theme);
  },

  // User Profile Cache
  getCachedUser() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_USER);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  setCachedUser(user) {
    if (!user) {
      localStorage.removeItem(STORAGE_KEY_USER);
    } else {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    }
  }
};
