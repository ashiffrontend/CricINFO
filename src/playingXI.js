/**
 * Playing XI System Module
 * Gully Cricket Scorer
 * Designed & Developed by Ashif Web Studio
 * Developer: Mohammad Ashif (mohdashif.dev@gmail.com)
 */

import { Validation } from './validation.js';

export const PlayingXISystem = {
  /**
   * Build an official 11-player Playing XI squad
   */
  createPlayingXI({
    name = 'Team',
    players = [],
    captain = '',
    viceCaptain = '',
    wicketKeeper = ''
  }) {
    // Validate squad
    const val = Validation.validateSquad(players, name, 2, 11);
    if (!val.valid) {
      console.warn(`[PlayingXI] Warning for ${name}:`, val.errors);
    }

    const assignedCaptain = captain || players[0]?.name || 'Player 1';
    const assignedViceCaptain = viceCaptain || players[1]?.name || 'Player 2';
    const assignedKeeper = wicketKeeper || players[2]?.name || 'Player 3';

    const formattedPlayers = players.map((p, idx) => {
      const pName = (typeof p === 'string' ? p : p.name || `Player ${idx + 1}`).trim();
      return {
        id: `player_${idx + 1}_${Math.random().toString(36).substr(2, 5)}`,
        name: pName,
        number: idx + 1,
        isCaptain: pName === assignedCaptain,
        isViceCaptain: pName === assignedViceCaptain,
        isKeeper: pName === assignedKeeper
      };
    });

    return {
      name,
      captain: assignedCaptain,
      viceCaptain: assignedViceCaptain,
      wicketKeeper: assignedKeeper,
      players: formattedPlayers,
      count: formattedPlayers.length
    };
  },

  /**
   * Verify team roster has no internal or cross-team duplicates
   */
  verifyTeams(team1, team2) {
    const val1 = Validation.validateSquad(team1.players, team1.name);
    const val2 = Validation.validateSquad(team2.players, team2.name);

    const errors = [...val1.errors, ...val2.errors];

    // Check cross-team name conflicts if desired
    const t1Names = new Set(team1.players.map(p => (p.name || p).trim().toLowerCase()));
    team2.players.forEach(p => {
      const n = (p.name || p).trim().toLowerCase();
      if (t1Names.has(n)) {
        // Cross-team duplicate (warning in gully cricket, but highlighted)
        console.warn(`[PlayingXI] Note: Player name "${p.name || p}" exists in both teams.`);
      }
    });

    return {
      valid: val1.valid && val2.valid,
      errors
    };
  }
};
