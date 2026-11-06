/**
 * Official Cricket Strike Rotation Manager
 * Gully Cricket Scorer
 * Designed & Developed by Ashif Web Studio
 * Developer: Mohammad Ashif (mohdashif.dev@gmail.com)
 */

export const StrikeManager = {
  /**
   * Swap strike between the two current active batters
   */
  swapStrike(innings) {
    if (!innings) return;
    const previousStriker = innings.strikeBatterName;
    innings.strikeBatterName = innings.nonStrikeBatterName;
    innings.nonStrikeBatterName = previousStriker;
    console.log(`[Strike] Rotated: Striker is now ${innings.strikeBatterName}, Non-striker is ${innings.nonStrikeBatterName}`);
  },

  /**
   * Determine strike rotation after a standard delivery or extras
   * Official Cricket Rules:
   * - 0, 2, 4, 6: Striker remains on strike
   * - 1, 3, 5: Strike changes (odd runs)
   * - Wide: Striker remains, UNLESS odd running runs completed (e.g. wide + 1 run)
   * - No Ball: Striker remains, UNLESS odd batsman runs completed (e.g. 1nb, 3nb)
   * - Byes & Leg Byes: Odd runs change strike (1b, 3b), Even runs keep strike (2b, 4b)
   */
  handleDeliveryStrike(innings, runs = 0, extraType = null, extraRuns = 0) {
    if (!innings) return;

    if (!extraType) {
      // Standard runs from bat: odd runs rotate strike
      if (runs % 2 !== 0) {
        StrikeManager.swapStrike(innings);
      }
      return;
    }

    if (extraType === 'wide') {
      // Wide award is 1 run to team extras.
      // If batsmen ran additional runs (runs > 0), odd running runs rotate strike!
      if (runs > 0 && runs % 2 !== 0) {
        StrikeManager.swapStrike(innings);
      }
      return;
    }

    if (extraType === 'noball') {
      // No ball award is 1 run to team extras.
      // Batsman runs (runs > 0): odd runs rotate strike!
      if (runs > 0 && runs % 2 !== 0) {
        StrikeManager.swapStrike(innings);
      }
      return;
    }

    if (extraType === 'bye' || extraType === 'legbye') {
      // Byes and Leg Byes: runs completed by physical running
      const runningRuns = runs > 0 ? runs : extraRuns;
      if (runningRuns % 2 !== 0) {
        StrikeManager.swapStrike(innings);
      }
      return;
    }

    if (extraType === 'penalty') {
      // Penalty runs awarded to team total, does not rotate batsman strike
      return;
    }
  },

  /**
   * Automatic strike rotation at the completion of an over (6 legal balls)
   * Cricket Rule: At the end of every over, the batsmen switch ends!
   */
  handleEndOfOver(innings) {
    if (!innings) return;
    StrikeManager.swapStrike(innings);
    console.log(`[Strike] End of Over: Batsmen crossed ends. Strike is with ${innings.strikeBatterName}`);
  },

  /**
   * Handle strike assignment when a wicket falls
   * @param {Object} innings
   * @param {string} outPosition 'strike' | 'nonstrike'
   * @param {string} newBatterName Name of incoming batter
   * @param {boolean} crossedWhetherDidCross If batsmen crossed (e.g. during run out or catch prior to 2022 law change)
   */
  handleWicket(innings, outPosition = 'strike', newBatterName = '', crossed = false) {
    if (!innings || !newBatterName) return;

    const isStrikerOut = outPosition === 'strike';

    if (isStrikerOut) {
      // Under modern ICC/MCC Laws, incoming batter always takes strike on catches and normal dismissals,
      // unless batsmen crossed on a run-out.
      if (crossed) {
        innings.strikeBatterName = innings.nonStrikeBatterName;
        innings.nonStrikeBatterName = newBatterName;
      } else {
        innings.strikeBatterName = newBatterName;
      }
    } else {
      // Non-striker was out
      if (crossed) {
        innings.nonStrikeBatterName = innings.strikeBatterName;
        innings.strikeBatterName = newBatterName;
      } else {
        innings.nonStrikeBatterName = newBatterName;
      }
    }

    console.log(`[Strike] Wicket fall handled. Striker: ${innings.strikeBatterName}, Non-Striker: ${innings.nonStrikeBatterName}`);
  }
};
