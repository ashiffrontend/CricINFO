/**
 * Cricket Rules & Scoring Validation Module
 * Gully Cricket Scorer
 * Designed & Developed by Ashif Web Studio
 * Developer: Mohammad Ashif (mohdashif.dev@gmail.com)
 */

export const Validation = {
  /**
   * Validate squad configuration
   */
  validateSquad(players, teamName = 'Team', minPlayers = 2, maxPlayers = 11) {
    const errors = [];
    if (!players || !Array.isArray(players)) {
      errors.push(`${teamName}: Invalid players array.`);
      return { valid: false, errors };
    }

    if (players.length < minPlayers) {
      errors.push(`${teamName}: Minimum ${minPlayers} players required (has ${players.length}).`);
    }

    if (players.length > maxPlayers) {
      errors.push(`${teamName}: Maximum ${maxPlayers} players allowed in Playing XI.`);
    }

    // Check duplicate names
    const names = new Set();
    players.forEach((p, idx) => {
      const name = (typeof p === 'string' ? p : p.name || '').trim().toLowerCase();
      if (!name) {
        errors.push(`${teamName}: Player #${idx + 1} cannot have an empty name.`);
      } else if (names.has(name)) {
        errors.push(`${teamName}: Duplicate player name "${p.name || p}". Each player must have a unique name.`);
      } else {
        names.add(name);
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Validate if bowler is eligible to bowl the next over
   * Rule: A bowler cannot bowl two consecutive overs!
   */
  canBowlNextOver(innings, bowlerName) {
    if (!innings || !bowlerName) return { allowed: false, reason: 'Invalid parameters.' };

    // In a super over, tournament rules allow 1 bowler for the entire over
    if (innings.isSuperOver) {
      return { allowed: true };
    }

    // Check last completed over's bowler
    const lastOverBowler = innings.lastCompletedOverBowler || null;
    if (lastOverBowler && lastOverBowler.toLowerCase() === bowlerName.trim().toLowerCase()) {
      return {
        allowed: false,
        reason: `${bowlerName} just bowled the previous over. Cricket rules prohibit consecutive overs by the same bowler.`
      };
    }

    // Check if bowler belongs to bowling squad
    const exists = innings.bowlers.some(b => b.name.toLowerCase() === bowlerName.trim().toLowerCase());
    if (!exists) {
      return {
        allowed: false,
        reason: `${bowlerName} is not in the bowling team's Playing XI.`
      };
    }

    return { allowed: true };
  },

  /**
   * Validate if a player is available to bat next
   */
  isBatterAvailable(innings, batterName) {
    if (!innings || !batterName) return false;
    const batter = innings.batters.find(b => b.name.toLowerCase() === batterName.trim().toLowerCase());
    if (!batter) return false;
    // Must be 'yet_to_bat' (not currently batting and not out)
    return batter.status === 'yet_to_bat';
  },

  /**
   * Validate delivery scoring input
   */
  validateDelivery(innings) {
    if (!innings) return { allowed: false, reason: 'No active innings.' };
    if (innings.isCompleted) return { allowed: false, reason: 'Innings is already completed.' };
    if (innings.isAllOut) return { allowed: false, reason: 'Batting team is all out.' };
    if (innings.legalBalls >= innings.maxOvers * 6) {
      return { allowed: false, reason: 'All overs have been bowled.' };
    }
    return { allowed: true };
  }
};
