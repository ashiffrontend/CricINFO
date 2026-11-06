/**
 * Batting Management Module
 * Gully Cricket Scorer
 * Designed & Developed by Ashif Web Studio
 * Developer: Mohammad Ashif (mohdashif.dev@gmail.com)
 */

export const BattingManager = {
  /**
   * Get list of remaining available batsmen in the Playing XI
   */
  getAvailableBatsmen(innings) {
    if (!innings || !innings.batters) return [];
    return innings.batters.filter(b => b.status === 'yet_to_bat');
  },

  /**
   * Get the next batsman in line automatically from Playing XI batting order
   */
  getNextBatsmanInLine(innings) {
    const available = BattingManager.getAvailableBatsmen(innings);
    return available.length > 0 ? available[0].name : null;
  },

  /**
   * Update active striker's stats after scoring
   */
  updateStrikerScore(innings, runs = 0, isLegal = true) {
    const batter = innings.batters.find(b => b.name === innings.strikeBatterName);
    if (!batter) return;

    batter.runs += runs;
    if (isLegal) {
      batter.balls += 1;
    }

    if (runs === 4) batter.fours = (batter.fours || 0) + 1;
    if (runs === 6) batter.sixes = (batter.sixes || 0) + 1;

    batter.strikeRate = batter.balls > 0 ? Number(((batter.runs / batter.balls) * 100).toFixed(1)) : 0.0;
  },

  /**
   * Update active partnership
   */
  updatePartnership(innings, runs = 0, isLegal = true) {
    if (!innings.partnerships || innings.partnerships.length === 0) {
      innings.partnerships = [{
        batter1: innings.strikeBatterName,
        batter2: innings.nonStrikeBatterName,
        runs: 0,
        balls: 0
      }];
    }

    const currentP = innings.partnerships[innings.partnerships.length - 1];
    currentP.runs += runs;
    if (isLegal) currentP.balls += 1;
  },

  /**
   * Handle fall of a wicket and bring in the next batsman
   * @param {Object} innings
   * @param {number} totalPlayerCount
   * @param {Object} dismissalDetails
   */
  processWicket(innings, totalPlayerCount = 11, {
    outPosition = 'strike',
    dismissalType = 'Bowled',
    fielder = null,
    nextBatterName = null
  }) {
    const isStrikerOut = outPosition === 'strike';
    const outBatterName = isStrikerOut ? innings.strikeBatterName : innings.nonStrikeBatterName;

    // 1. Mark dismissed batsman
    const dismissed = innings.batters.find(b => b.name === outBatterName);
    if (dismissed) {
      dismissed.status = 'out';
      dismissed.dismissal = dismissalType;
      dismissed.bowler = (dismissalType === 'Run Out' || dismissalType === 'Retired Hurt') ? null : innings.currentBowlerName;
      dismissed.fielder = fielder;
    }

    // 2. Increment wickets
    innings.wickets += 1;

    // 3. Record Fall of Wickets
    innings.fallOfWickets.push({
      wicketNumber: innings.wickets,
      score: innings.totalRuns,
      overs: innings.oversBowled,
      batterName: outBatterName
    });

    // 4. Check if All Out (10 wickets for 11 players, or N-1 wickets)
    const maxWickets = Math.max(1, totalPlayerCount - 1);
    if (innings.wickets >= maxWickets) {
      innings.isAllOut = true;
      console.log(`[Batting] All Out! ${innings.wickets} wickets fell.`);
      return { isAllOut: true, nextBatter: null };
    }

    // 5. Assign Next Batsman
    let newBatter = nextBatterName || BattingManager.getNextBatsmanInLine(innings);
    if (newBatter) {
      const bObj = innings.batters.find(b => b.name === newBatter);
      if (bObj) {
        bObj.status = 'batting';
        if (isStrikerOut) {
          innings.strikeBatterName = newBatter;
        } else {
          innings.nonStrikeBatterName = newBatter;
        }
      }
    }

    // 6. Start new partnership
    innings.partnerships.push({
      batter1: innings.strikeBatterName,
      batter2: innings.nonStrikeBatterName,
      runs: 0,
      balls: 0
    });

    return {
      isAllOut: false,
      nextBatter: newBatter,
      outBatter: outBatterName
    };
  }
};
