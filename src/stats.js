/**
 * Cricket Statistics & Analytics Module
 * Gully Cricket Scorer
 * Designed & Developed by Ashif Web Studio
 * Developer: Mohammad Ashif (mohdashif.dev@gmail.com)
 */

export const StatsCalculator = {
  /**
   * Current Run Rate (CRR)
   */
  calculateCRR(runs = 0, legalBalls = 0) {
    if (legalBalls <= 0) return '0.00';
    const overs = legalBalls / 6;
    return (runs / overs).toFixed(2);
  },

  /**
   * Required Run Rate (RRR)
   */
  calculateRRR(targetRuns = 0, currentRuns = 0, remainingBalls = 0) {
    const needed = targetRuns - currentRuns;
    if (needed <= 0) return '0.00';
    if (remainingBalls <= 0) return '∞';
    const oversRemaining = remainingBalls / 6;
    return (needed / oversRemaining).toFixed(2);
  },

  /**
   * Calculate MVP Player of the Match Index
   */
  calculatePlayerOfTheMatch(match) {
    if (!match || !match.innings) return 'All-Rounder';

    const scores = {};

    match.innings.forEach(inn => {
      // Batting contributions:
      // 1 pt per run, +10 for 50, +20 for 100, +2 per 6, +1 per 4, strike rate multiplier
      (inn.batters || []).forEach(b => {
        if (!scores[b.name]) scores[b.name] = 0;
        let pts = (b.runs || 0) + ((b.sixes || 0) * 2) + (b.fours || 0);
        if (b.runs >= 50) pts += 10;
        if (b.runs >= 100) pts += 20;
        if (b.balls >= 10 && b.strikeRate >= 150) pts += 8;
        scores[b.name] += pts;
      });

      // Bowling contributions:
      // 25 pts per wicket, 10 pts per maiden, bonus for sub-6 economy
      (inn.bowlers || []).forEach(bw => {
        if (!scores[bw.name]) scores[bw.name] = 0;
        let pts = ((bw.wickets || 0) * 25) + ((bw.maidens || 0) * 12);
        if (bw.legalBalls >= 12 && bw.economy < 6.0) pts += 10;
        if (bw.legalBalls >= 6 && bw.economy < 5.0) pts += 5;
        scores[bw.name] += pts;
      });
    });

    let topPlayer = 'Player of the Match';
    let maxScore = -1;

    for (const [name, pts] of Object.entries(scores)) {
      if (pts > maxScore) {
        maxScore = pts;
        topPlayer = name;
      }
    }

    return topPlayer;
  }
};
