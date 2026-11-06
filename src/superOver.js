/**
 * Super Over Management Module
 * Gully Cricket Scorer
 * Designed & Developed by Ashif Web Studio
 * Developer: Mohammad Ashif (mohdashif.dev@gmail.com)
 */

export const SuperOverManager = {
  /**
   * Initialize a Super Over between the two teams
   */
  startSuperOver(match, battingFirstTeamNumber = '2') {
    if (!match) return null;

    console.log('[SuperOver] Starting official Super Over tiebreaker!');

    const team1 = match.teamA;
    const team2 = match.teamB;

    // By cricket convention, team that batted second in main match bats first in Super Over
    const battingFirst = battingFirstTeamNumber === '2' ? team2 : team1;
    const bowlingFirst = battingFirstTeamNumber === '2' ? team1 : team2;

    const superOverInnings1 = {
      inningsNumber: 1,
      isSuperOver: true,
      battingTeamName: battingFirst.name,
      bowlingTeamName: bowlingFirst.name,
      maxOvers: 1,
      maxWickets: 2, // 2 wickets = all out in Super Over
      totalRuns: 0,
      wickets: 0,
      legalBalls: 0,
      oversBowled: '0.0',
      extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0, total: 0 },
      strikeBatterName: battingFirst.players[0]?.name || 'Batter 1',
      nonStrikeBatterName: battingFirst.players[1]?.name || 'Batter 2',
      currentBowlerName: bowlingFirst.players[0]?.name || 'Bowler 1',
      batters: battingFirst.players.slice(0, 3).map((p, idx) => ({
        name: p.name,
        status: idx < 2 ? 'batting' : 'yet_to_bat',
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        strikeRate: 0,
        dismissal: null
      })),
      bowlers: bowlingFirst.players.map(p => ({
        name: p.name,
        overs: 0,
        legalBalls: 0,
        maidens: 0,
        runs: 0,
        wickets: 0,
        economy: 0
      })),
      currentOverBalls: [],
      allDeliveries: [],
      fallOfWickets: [],
      partnerships: [{
        batter1: battingFirst.players[0]?.name || 'Batter 1',
        batter2: battingFirst.players[1]?.name || 'Batter 2',
        runs: 0,
        balls: 0
      }],
      currentOverIndex: 0,
      isCompleted: false,
      isAllOut: false
    };

    match.status = 'super_over';
    match.superOver = {
      currentInningsIndex: 0,
      innings: [superOverInnings1],
      status: 'live',
      winner: null
    };

    return match;
  },

  /**
   * Transition Super Over to 2nd innings
   */
  startSuperOverSecondInnings(match) {
    if (!match || !match.superOver) return match;

    const so = match.superOver;
    const inn1 = so.innings[0];
    inn1.isCompleted = true;

    const battingSecond = inn1.bowlingTeamName === match.teamA.name ? match.teamA : match.teamB;
    const bowlingSecond = inn1.battingTeamName === match.teamA.name ? match.teamA : match.teamB;

    const superOverInnings2 = {
      inningsNumber: 2,
      isSuperOver: true,
      battingTeamName: battingSecond.name,
      bowlingTeamName: bowlingSecond.name,
      maxOvers: 1,
      maxWickets: 2,
      target: inn1.totalRuns + 1,
      totalRuns: 0,
      wickets: 0,
      legalBalls: 0,
      oversBowled: '0.0',
      extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0, total: 0 },
      strikeBatterName: battingSecond.players[0]?.name || 'Batter 1',
      nonStrikeBatterName: battingSecond.players[1]?.name || 'Batter 2',
      currentBowlerName: bowlingSecond.players[0]?.name || 'Bowler 1',
      batters: battingSecond.players.slice(0, 3).map((p, idx) => ({
        name: p.name,
        status: idx < 2 ? 'batting' : 'yet_to_bat',
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        strikeRate: 0,
        dismissal: null
      })),
      bowlers: bowlingSecond.players.map(p => ({
        name: p.name,
        overs: 0,
        legalBalls: 0,
        maidens: 0,
        runs: 0,
        wickets: 0,
        economy: 0
      })),
      currentOverBalls: [],
      allDeliveries: [],
      fallOfWickets: [],
      partnerships: [{
        batter1: battingSecond.players[0]?.name || 'Batter 1',
        batter2: battingSecond.players[1]?.name || 'Batter 2',
        runs: 0,
        balls: 0
      }],
      currentOverIndex: 0,
      isCompleted: false,
      isAllOut: false
    };

    so.innings.push(superOverInnings2);
    so.currentInningsIndex = 1;
    return match;
  }
};
