/**
 * Ball & Over History Management Module
 * Gully Cricket Scorer
 * Designed & Developed by Ashif Web Studio
 * Developer: Mohammad Ashif (mohdashif.dev@gmail.com)
 */

export const HistoryManager = {
  /**
   * Format a delivery record
   */
  createDeliveryRecord({
    ballIndexInOver = 1,
    overNumber = 0,
    batter = '',
    bowler = '',
    runs = 0,
    extraType = null,
    extraRuns = 0,
    isLegal = true,
    isWicket = false,
    wicketType = null,
    outBatter = null,
    commentary = ''
  }) {
    let display = runs === 0 ? '·' : String(runs);
    if (extraType === 'wide') {
      display = runs > 0 ? `${1 + runs}wd` : 'wd';
    } else if (extraType === 'noball') {
      display = runs > 0 ? `${1 + runs}nb` : 'nb';
    } else if (extraType === 'bye') {
      display = `${extraRuns || 1}b`;
    } else if (extraType === 'legbye') {
      display = `${extraRuns || 1}lb`;
    } else if (isWicket) {
      display = runs > 0 ? `${runs}W` : 'W';
    }

    return {
      id: `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      ballNotation: `${overNumber}.${ballIndexInOver}`,
      overNumber,
      ballIndexInOver,
      batter,
      bowler,
      runs,
      extra: extraType,
      extraRuns,
      isLegal,
      isWicket,
      wicketType,
      outBatter,
      display,
      commentary,
      timestamp: Date.now()
    };
  },

  /**
   * Group all deliveries into completed overs
   */
  computeOverHistory(innings) {
    if (!innings || !innings.allDeliveries) return [];

    const oversMap = {};
    innings.allDeliveries.forEach(del => {
      const ovNum = del.overNumber || 0;
      if (!oversMap[ovNum]) {
        oversMap[ovNum] = {
          overNumber: ovNum,
          bowler: del.bowler,
          deliveries: [],
          runs: 0,
          wickets: 0,
          legalBalls: 0
        };
      }
      oversMap[ovNum].deliveries.push(del);
      oversMap[ovNum].runs += (del.runs || 0) + (del.extraRuns || 0);
      if (del.isWicket) oversMap[ovNum].wickets += 1;
      if (del.isLegal) oversMap[ovNum].legalBalls += 1;
    });

    return Object.values(oversMap);
  }
};
