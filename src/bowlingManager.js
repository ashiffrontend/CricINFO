/**
 * Bowling Management Module
 * Gully Cricket Scorer
 * Designed & Developed by Ashif Web Studio
 * Developer: Mohammad Ashif (mohdashif.dev@gmail.com)
 */

import { Validation } from './validation.js';

export const BowlingManager = {
  /**
   * Get eligible bowlers for the next over
   */
  getEligibleBowlers(innings) {
    if (!innings || !innings.bowlers) return [];

    const lastBowler = innings.lastCompletedOverBowler || null;
    return innings.bowlers.map(b => {
      const isLastBowler = lastBowler && lastBowler.toLowerCase() === b.name.toLowerCase();
      return {
        ...b,
        canBowl: !isLastBowler || !!innings.isSuperOver,
        reason: isLastBowler ? 'Cannot bowl consecutive overs' : 'Available'
      };
    });
  },

  /**
   * Assign a new bowler for the upcoming over
   */
  setBowlerForNewOver(innings, bowlerName) {
    if (!innings || !bowlerName) return { success: false, message: 'Invalid bowler' };

    const validation = Validation.canBowlNextOver(innings, bowlerName);
    if (!validation.allowed) {
      return { success: false, message: validation.reason };
    }

    innings.currentBowlerName = bowlerName;
    return { success: true, bowler: bowlerName };
  },

  /**
   * Update bowling figures after a delivery
   */
  updateFigures(innings, {
    runsConceded = 0,
    isLegal = true,
    isWicket = false,
    extraType = null
  }) {
    const bowler = innings.bowlers.find(b => b.name === innings.currentBowlerName);
    if (!bowler) return;

    if (isLegal) {
      bowler.legalBalls += 1;
      bowler.overs = Number((Math.floor(bowler.legalBalls / 6) + (bowler.legalBalls % 6) / 10).toFixed(1));
    }

    bowler.runs += runsConceded;

    if (extraType === 'wide') {
      bowler.wides = (bowler.wides || 0) + 1;
    } else if (extraType === 'noball') {
      bowler.noBalls = (bowler.noBalls || 0) + 1;
    }

    if (isWicket) {
      bowler.wickets += 1;
    }

    // Calculate Economy Rate: Runs per 6 legal balls
    const oversFraction = bowler.legalBalls / 6;
    bowler.economy = oversFraction > 0 ? Number((bowler.runs / oversFraction).toFixed(2)) : 0.00;
  },

  /**
   * Finalize the over for the bowler & check for maiden
   */
  finishOver(innings) {
    const bowler = innings.bowlers.find(b => b.name === innings.currentBowlerName);
    if (!bowler) return;

    // Check if maiden over (6 legal balls in current over, 0 runs conceded off the bat or extras by bowler)
    const currentOverDeliveries = innings.currentOverBalls || [];
    const legalBallsInOver = currentOverDeliveries.filter(b => b.isLegal);
    const bowlerRunsInOver = currentOverDeliveries.reduce((sum, b) => {
      // Byes and Leg Byes are NOT charged to the bowler
      if (b.extra === 'bye' || b.extra === 'legbye' || b.extra === 'penalty') return sum;
      return sum + (b.runs || 0) + (b.extraRuns || 0);
    }, 0);

    if (legalBallsInOver.length === 6 && bowlerRunsInOver === 0) {
      bowler.maidens = (bowler.maidens || 0) + 1;
      console.log(`[Bowler] Maiden Over awarded to ${bowler.name}!`);
    }

    // Record last completed over's bowler to prevent consecutive overs
    innings.lastCompletedOverBowler = innings.currentBowlerName;
  }
};
