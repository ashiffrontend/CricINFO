/**
 * Match Lifecycle & Rules Engine
 * Gully Cricket Scorer
 * Designed & Developed by Ashif Web Studio
 * Developer: Mohammad Ashif (mohdashif.dev@gmail.com)
 */

import { PlayingXISystem } from './playingXI.js';
import { StatsCalculator } from './stats.js';

export const MatchEngine = {
  /**
   * Execute true 50/50 random coin toss
   */
  executeToss(callingTeamNumber = '1', callChoice = 'Heads', team1Name = 'Team 1', team2Name = 'Team 2') {
    // True 50/50 random result
    const isHeads = Math.random() < 0.5;
    const outcome = isHeads ? 'Heads' : 'Tails';

    const isWinnerCaller = outcome.toLowerCase() === callChoice.toLowerCase();
    const winningTeamNumber = isWinnerCaller ? callingTeamNumber : (callingTeamNumber === '1' ? '2' : '1');
    const winningTeamName = winningTeamNumber === '1' ? team1Name : team2Name;

    return {
      outcome, // 'Heads' or 'Tails'
      winningTeamNumber, // '1' or '2'
      winningTeamName,
      callChoice,
      callingTeamNumber,
      timestamp: Date.now()
    };
  },

  /**
   * Initialize a new match
   */
  createNewMatch({
    format = 'Limited Overs',
    overs = 20,
    venue = 'Gully Turf Arena',
    team1 = { name: 'Thunder Strikers', players: [] },
    team2 = { name: 'Royal Challengers', players: [] },
    toss = { winner: '1', decision: 'BAT' },
    openers = null
  }) {
    // 1. Build Playing XI for each team
    const teamA = PlayingXISystem.createPlayingXI({
      name: team1.name,
      players: team1.players,
      captain: team1.captain,
      viceCaptain: team1.viceCaptain,
      wicketKeeper: team1.wicketKeeper
    });

    const teamB = PlayingXISystem.createPlayingXI({
      name: team2.name,
      players: team2.players,
      captain: team2.captain,
      viceCaptain: team2.viceCaptain,
      wicketKeeper: team2.wicketKeeper
    });

    // 2. Determine who bats first based on toss
    // If team 1 won and chose BAT -> team 1 bats first
    // If team 1 won and chose BOWL -> team 2 bats first
    // If team 2 won and chose BAT -> team 2 bats first
    // If team 2 won and chose BOWL -> team 1 bats first
    const team1BatsFirst = (toss.winner === '1' && toss.decision === 'BAT') ||
                           (toss.winner === '2' && toss.decision === 'BOWL');

    const battingFirst = team1BatsFirst ? teamA : teamB;
    const bowlingFirst = team1BatsFirst ? teamB : teamA;

    const matchId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // 3. Create first innings
    const firstInnings = MatchEngine.createInningsState(
      battingFirst,
      bowlingFirst,
      1,
      Number(overs) || 20,
      openers
    );

    return {
      id: matchId,
      format,
      overs: Number(overs) || 20,
      venue,
      teamA,
      teamB,
      toss: {
        winner: toss.winner,
        decision: toss.decision,
        outcome: toss.outcome || 'Heads'
      },
      status: 'live', // 'live', 'completed', 'tied', 'super_over', 'paused', 'abandoned'
      currentInningsIndex: 0,
      innings: [firstInnings],
      superOver: null,
      result: null,
      historyStack: [],
      redoStack: [],
      playerOfTheMatch: null,
      createdAt: new Date().toISOString()
    };
  },

  /**
   * Helper to build a clean innings state
   */
  createInningsState(battingTeam, bowlingTeam, inningsNumber = 1, maxOvers = 20, openers = null) {
    const batters = battingTeam.players.map((p, idx) => ({
      name: p.name,
      number: idx + 1,
      isCaptain: !!p.isCaptain,
      isViceCaptain: !!p.isViceCaptain,
      isKeeper: !!p.isKeeper,
      status: idx < 2 ? 'batting' : 'yet_to_bat',
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      strikeRate: 0,
      dismissal: null,
      bowler: null,
      fielder: null
    }));

    const bowlers = bowlingTeam.players.map((p, idx) => ({
      name: p.name,
      number: idx + 1,
      overs: 0,
      legalBalls: 0,
      maidens: 0,
      runs: 0,
      wickets: 0,
      economy: 0,
      wides: 0,
      noBalls: 0
    }));

    const strikeBatter = openers?.strike || batters[0]?.name || 'Batter 1';
    const nonStrikeBatter = openers?.nonStrike || (batters[1]?.name || 'Batter 2');
    const currentBowler = openers?.bowler || bowlers[0]?.name || 'Bowler 1';

    return {
      inningsNumber,
      battingTeamName: battingTeam.name,
      bowlingTeamName: bowlingTeam.name,
      maxOvers,
      totalRuns: 0,
      wickets: 0,
      legalBalls: 0,
      oversBowled: '0.0',
      extras: {
        wides: 0,
        noBalls: 0,
        byes: 0,
        legByes: 0,
        penalty: 0,
        total: 0
      },
      strikeBatterName: strikeBatter,
      nonStrikeBatterName: nonStrikeBatter,
      currentBowlerName: currentBowler,
      lastCompletedOverBowler: null,
      batters,
      bowlers,
      currentOverBalls: [],
      allDeliveries: [],
      fallOfWickets: [],
      partnerships: [{
        batter1: strikeBatter,
        batter2: nonStrikeBatter,
        runs: 0,
        balls: 0
      }],
      currentOverIndex: 0,
      isCompleted: false,
      isAllOut: false
    };
  },

  /**
   * Conclude match and compute final MVP Player of the Match
   */
  concludeMatch(match, summaryText) {
    match.status = 'completed';
    match.result = {
      summary: summaryText,
      completedAt: new Date().toISOString()
    };
    match.playerOfTheMatch = StatsCalculator.calculatePlayerOfTheMatch(match);
  },

  /**
   * RESTART CONTROLS (Point 15 in Prompt)
   */

  /**
   * 1. Restart current over (reverts all deliveries bowled in current over)
   */
  restartCurrentOver(match) {
    const innings = match.status === 'super_over' ?
      match.superOver.innings[match.superOver.currentInningsIndex] :
      match.innings[match.currentInningsIndex];

    if (!innings || !innings.currentOverBalls || innings.currentOverBalls.length === 0) {
      return { success: false, message: 'No balls have been bowled in this over yet.' };
    }

    const ballsToUndo = innings.currentOverBalls.length;
    import('./undoManager.js').then(({ UndoManager }) => {
      for (let i = 0; i < ballsToUndo; i++) {
        UndoManager.undo(match);
      }
    });

    return { success: true, message: `Current over restarted (${ballsToUndo} ball(s) reset).` };
  },

  /**
   * 2. Restart current innings (resets current innings back to 0/0)
   */
  restartCurrentInnings(match) {
    const idx = match.currentInningsIndex;
    const currentInnings = match.innings[idx];
    if (!currentInnings) return { success: false, message: 'Innings not found.' };

    const battingTeam = currentInnings.battingTeamName === match.teamA.name ? match.teamA : match.teamB;
    const bowlingTeam = currentInnings.bowlingTeamName === match.teamA.name ? match.teamA : match.teamB;

    const freshInnings = MatchEngine.createInningsState(
      battingTeam,
      bowlingTeam,
      idx + 1,
      match.overs
    );

    if (idx === 1 && match.innings[0]) {
      freshInnings.target = match.innings[0].totalRuns + 1;
    }

    match.innings[idx] = freshInnings;
    match.historyStack = [];
    match.redoStack = [];
    match.status = 'live';

    return { success: true, message: `Innings #${idx + 1} has been completely reset.` };
  },

  /**
   * 3. Restart entire match (resets both innings back to post-toss state)
   */
  restartEntireMatch(match) {
    if (!match) return { success: false };

    const team1BatsFirst = (match.toss.winner === '1' && match.toss.decision === 'BAT') ||
                           (match.toss.winner === '2' && match.toss.decision === 'BOWL');

    const battingFirst = team1BatsFirst ? match.teamA : match.teamB;
    const bowlingFirst = team1BatsFirst ? match.teamB : match.teamA;

    const freshFirstInnings = MatchEngine.createInningsState(
      battingFirst,
      bowlingFirst,
      1,
      match.overs
    );

    match.currentInningsIndex = 0;
    match.innings = [freshFirstInnings];
    match.superOver = null;
    match.status = 'live';
    match.result = null;
    match.playerOfTheMatch = null;
    match.historyStack = [];
    match.redoStack = [];

    return { success: true, message: 'Match restarted from ball one!' };
  }
};
