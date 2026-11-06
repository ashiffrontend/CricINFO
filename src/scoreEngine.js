/**
 * Core Ball Scoring Engine
 * Gully Cricket Scorer
 * Designed & Developed by Ashif Web Studio
 * Developer: Mohammad Ashif (mohdashif.dev@gmail.com)
 */

import { Validation } from './validation.js';
import { StrikeManager } from './strikeManager.js';
import { BowlingManager } from './bowlingManager.js';
import { BattingManager } from './battingManager.js';
import { HistoryManager } from './historyManager.js';
import { UndoManager } from './undoManager.js';

export const ScoreEngine = {
  /**
   * Record a normal delivery off the bat (0, 1, 2, 3, 4, 5, 6 runs)
   */
  scoreRuns(match, runs = 0) {
    const innings = ScoreEngine.getActiveInnings(match);
    const val = Validation.validateDelivery(innings);
    if (!val.allowed) return { success: false, reason: val.reason };

    // Capture Undo Snapshot
    UndoManager.captureSnapshot(match);

    // 1. Update Innings totals
    innings.totalRuns += runs;
    innings.legalBalls += 1;

    // 2. Update Batter figures
    BattingManager.updateStrikerScore(innings, runs, true);

    // 3. Update Bowler figures
    BowlingManager.updateFigures(innings, {
      runsConceded: runs,
      isLegal: true,
      isWicket: false
    });

    // 4. Update Partnership
    BattingManager.updatePartnership(innings, runs, true);

    // 5. Update overs display
    innings.oversBowled = `${Math.floor(innings.legalBalls / 6)}.${innings.legalBalls % 6}`;

    // 6. Record delivery history
    const ballIdx = (innings.legalBalls - 1) % 6 + 1;
    const overNum = Math.floor((innings.legalBalls - 1) / 6) + 1;
    const delivery = HistoryManager.createDeliveryRecord({
      ballIndexInOver: ballIdx,
      overNumber: overNum,
      batter: innings.strikeBatterName,
      bowler: innings.currentBowlerName,
      runs,
      isLegal: true,
      commentary: ScoreEngine.getBallCommentary(runs, innings.strikeBatterName, innings.currentBowlerName)
    });

    innings.currentOverBalls.push(delivery);
    innings.allDeliveries.push(delivery);

    // 7. Check if target reached in 2nd innings
    const matchFinished = ScoreEngine.checkTargetReached(match, innings);
    if (matchFinished) return { success: true, match, matchFinished: true };

    // 8. Rotate strike according to cricket rules (odd runs: 1, 3, 5)
    StrikeManager.handleDeliveryStrike(innings, runs, null, 0);

    // 9. Check End of Over (6 legal balls)
    let isOverFinished = false;
    if (innings.legalBalls % 6 === 0) {
      isOverFinished = true;
      ScoreEngine.handleEndOfOver(innings, match);
    }

    // 10. Check All Overs Bowled
    if (innings.legalBalls >= innings.maxOvers * 6) {
      ScoreEngine.completeInnings(match);
    }

    return {
      success: true,
      match,
      isOverFinished,
      delivery
    };
  },

  /**
   * Record Extra delivery (Wide, No Ball, Bye, Leg Bye, Penalty)
   */
  scoreExtra(match, extraType, additionalRuns = 0) {
    const innings = ScoreEngine.getActiveInnings(match);
    const val = Validation.validateDelivery(innings);
    if (!val.allowed) return { success: false, reason: val.reason };

    UndoManager.captureSnapshot(match);

    let isLegal = false;
    let extraRuns = 0;
    let bowlerRunsConceded = 0;
    let batterRuns = 0;

    if (extraType === 'wide') {
      isLegal = false;
      extraRuns = 1 + additionalRuns;
      bowlerRunsConceded = extraRuns;
      innings.extras.wides = (innings.extras.wides || 0) + extraRuns;
    } else if (extraType === 'noball') {
      isLegal = false;
      extraRuns = 1;
      batterRuns = additionalRuns;
      bowlerRunsConceded = 1 + additionalRuns;
      innings.extras.noBalls = (innings.extras.noBalls || 0) + 1;
      if (additionalRuns > 0) {
        BattingManager.updateStrikerScore(innings, additionalRuns, false);
      }
    } else if (extraType === 'bye') {
      isLegal = true;
      extraRuns = additionalRuns || 1;
      bowlerRunsConceded = 0; // Byes are NOT bowler's runs
      innings.extras.byes = (innings.extras.byes || 0) + extraRuns;
      BattingManager.updateStrikerScore(innings, 0, true); // counts ball faced
    } else if (extraType === 'legbye') {
      isLegal = true;
      extraRuns = additionalRuns || 1;
      bowlerRunsConceded = 0; // Leg Byes are NOT bowler's runs
      innings.extras.legByes = (innings.extras.legByes || 0) + extraRuns;
      BattingManager.updateStrikerScore(innings, 0, true);
    } else if (extraType === 'penalty') {
      isLegal = false;
      extraRuns = 5;
      bowlerRunsConceded = 0;
      innings.extras.penalty = (innings.extras.penalty || 0) + 5;
    }

    const totalAdded = extraRuns + (extraType === 'noball' ? batterRuns : 0);
    innings.totalRuns += totalAdded;
    innings.extras.total = (innings.extras.total || 0) + extraRuns;

    if (isLegal) {
      innings.legalBalls += 1;
    }

    innings.oversBowled = `${Math.floor(innings.legalBalls / 6)}.${innings.legalBalls % 6}`;

    // Update Bowler
    BowlingManager.updateFigures(innings, {
      runsConceded: bowlerRunsConceded,
      isLegal,
      extraType
    });

    // Update Partnership
    BattingManager.updatePartnership(innings, totalAdded, isLegal);

    // Delivery history
    const ballIdx = isLegal ? ((innings.legalBalls - 1) % 6 + 1) : (innings.currentOverBalls.length + 1);
    const overNum = Math.floor(innings.legalBalls / 6) + 1;
    const delivery = HistoryManager.createDeliveryRecord({
      ballIndexInOver: ballIdx,
      overNumber: overNum,
      batter: innings.strikeBatterName,
      bowler: innings.currentBowlerName,
      runs: additionalRuns,
      extraType,
      extraRuns,
      isLegal,
      commentary: `${extraType.toUpperCase()}! ${totalAdded} run(s) added.`
    });

    innings.currentOverBalls.push(delivery);
    innings.allDeliveries.push(delivery);

    // Check target in 2nd innings
    const matchFinished = ScoreEngine.checkTargetReached(match, innings);
    if (matchFinished) return { success: true, match, matchFinished: true };

    // Strike rotation rules
    StrikeManager.handleDeliveryStrike(innings, additionalRuns, extraType, extraRuns);

    // Check end of over
    let isOverFinished = false;
    if (isLegal && innings.legalBalls % 6 === 0) {
      isOverFinished = true;
      ScoreEngine.handleEndOfOver(innings, match);
    }

    if (innings.legalBalls >= innings.maxOvers * 6) {
      ScoreEngine.completeInnings(match);
    }

    return {
      success: true,
      match,
      isOverFinished,
      delivery
    };
  },

  /**
   * Record a Wicket Dismissal
   */
  scoreWicket(match, {
    dismissalType = 'Bowled',
    outPosition = 'strike',
    fielder = null,
    nextBatter = null,
    runsCompleted = 0
  } = {}) {
    const innings = ScoreEngine.getActiveInnings(match);
    const val = Validation.validateDelivery(innings);
    if (!val.allowed) return { success: false, reason: val.reason };

    UndoManager.captureSnapshot(match);

    const isLegal = dismissalType !== 'Wide Run Out' && dismissalType !== 'No Ball Run Out';
    if (runsCompleted > 0) {
      innings.totalRuns += runsCompleted;
    }

    if (isLegal) {
      innings.legalBalls += 1;
      innings.oversBowled = `${Math.floor(innings.legalBalls / 6)}.${innings.legalBalls % 6}`;
    }

    // Process bowler wicket stats (Run Out doesn't count for bowler)
    const countsForBowler = dismissalType !== 'Run Out' && dismissalType !== 'Retired Hurt';
    BowlingManager.updateFigures(innings, {
      runsConceded: runsCompleted,
      isLegal,
      isWicket: countsForBowler
    });

    // Process wicket in batting manager
    const playerCount = innings.isSuperOver ? 3 : (match.playerCount || 11);
    const wicketResult = BattingManager.processWicket(innings, playerCount, {
      outPosition,
      dismissalType,
      fielder,
      nextBatterName: nextBatter
    });

    // Record delivery
    const ballIdx = isLegal ? ((innings.legalBalls - 1) % 6 + 1) : (innings.currentOverBalls.length + 1);
    const overNum = Math.floor(innings.legalBalls / 6) + 1;
    const delivery = HistoryManager.createDeliveryRecord({
      ballIndexInOver: ballIdx,
      overNumber: overNum,
      batter: innings.strikeBatterName,
      bowler: innings.currentBowlerName,
      runs: runsCompleted,
      isLegal,
      isWicket: true,
      wicketType: dismissalType,
      outBatter: wicketResult.outBatter,
      commentary: `OUT! ${wicketResult.outBatter} is out (${dismissalType}). Wicket #${innings.wickets}!`
    });

    innings.currentOverBalls.push(delivery);
    innings.allDeliveries.push(delivery);

    // If all out, conclude innings immediately!
    if (wicketResult.isAllOut) {
      innings.isAllOut = true;
      ScoreEngine.completeInnings(match);
      return { success: true, match, isAllOut: true };
    }

    // Assign strike for next batter
    if (wicketResult.nextBatter) {
      StrikeManager.handleWicket(innings, outPosition, wicketResult.nextBatter, false);
    }

    // Check target in 2nd innings
    const matchFinished = ScoreEngine.checkTargetReached(match, innings);
    if (matchFinished) return { success: true, match, matchFinished: true };

    // Check end of over
    let isOverFinished = false;
    if (isLegal && innings.legalBalls % 6 === 0) {
      isOverFinished = true;
      ScoreEngine.handleEndOfOver(innings, match);
    }

    if (innings.legalBalls >= innings.maxOvers * 6) {
      ScoreEngine.completeInnings(match);
    }

    return {
      success: true,
      match,
      isOverFinished,
      delivery,
      nextBatter: wicketResult.nextBatter
    };
  },

  /**
   * Handle completion of an over
   */
  handleEndOfOver(innings, match) {
    BowlingManager.finishOver(innings);
    StrikeManager.handleEndOfOver(innings);
    innings.currentOverIndex = (innings.currentOverIndex || 0) + 1;
    innings.currentOverBalls = [];
    console.log(`[ScoreEngine] Over #${innings.currentOverIndex} completed.`);
  },

  /**
   * Get the current active innings object (supporting standard innings or Super Over)
   */
  getActiveInnings(match) {
    if (!match) return null;
    if (match.status === 'super_over' && match.superOver) {
      return match.superOver.innings[match.superOver.currentInningsIndex];
    }
    return match.innings[match.currentInningsIndex];
  },

  /**
   * Check if chasing team has achieved the target in 2nd innings
   */
  checkTargetReached(match, innings) {
    if (match.status === 'super_over') {
      const so = match.superOver;
      if (so.currentInningsIndex === 1 && so.innings[0]) {
        const target = so.innings[0].totalRuns + 1;
        if (innings.totalRuns >= target) {
          match.status = 'completed';
          so.status = 'completed';
          match.result = {
            winner: innings.battingTeamName,
            summary: `${innings.battingTeamName} won the Super Over!`
          };
          return true;
        }
      }
      return false;
    }

    if (match.currentInningsIndex === 1 && match.innings[0]) {
      const target = match.innings[0].totalRuns + 1;
      if (innings.totalRuns >= target) {
        const remainingWickets = (match.playerCount || 11) - 1 - innings.wickets;
        match.status = 'completed';
        innings.isCompleted = true;
        match.result = {
          winner: innings.battingTeamName,
          margin: `${remainingWickets} wicket${remainingWickets === 1 ? '' : 's'}`,
          summary: `${innings.battingTeamName} won by ${remainingWickets} wicket${remainingWickets === 1 ? '' : 's'}!`
        };
        return true;
      }
    }
    return false;
  },

  /**
   * Complete Innings transition
   */
  completeInnings(match) {
    if (match.status === 'super_over') {
      const so = match.superOver;
      if (so.currentInningsIndex === 0) {
        // Super over 1st innings complete -> start 2nd innings
        import('./superOver.js').then(({ SuperOverManager }) => {
          SuperOverManager.startSuperOverSecondInnings(match);
        });
      } else {
        // Super over 2nd innings complete -> resolve winner or tie
        const inn1 = so.innings[0];
        const inn2 = so.innings[1];
        so.status = 'completed';
        match.status = 'completed';

        if (inn2.totalRuns > inn1.totalRuns) {
          match.result = { winner: inn2.battingTeamName, summary: `${inn2.battingTeamName} won the Super Over!` };
        } else if (inn2.totalRuns < inn1.totalRuns) {
          match.result = { winner: inn1.battingTeamName, summary: `${inn1.battingTeamName} won the Super Over!` };
        } else {
          match.status = 'tied';
          match.result = { winner: 'TIE', isTie: true, summary: 'Super Over Tied! Scores level.' };
        }
      }
      return;
    }

    const currentInnings = match.innings[match.currentInningsIndex];
    currentInnings.isCompleted = true;

    if (match.currentInningsIndex === 0) {
      // 1st Innings ended -> setup 2nd innings
      const battingFirstTeam = currentInnings.battingTeamName === match.teamA.name ? match.teamA : match.teamB;
      const bowlingFirstTeam = currentInnings.bowlingTeamName === match.teamA.name ? match.teamA : match.teamB;

      import('./matchEngine.js').then(({ MatchEngine }) => {
        const secondInnings = MatchEngine.createInningsState(
          bowlingFirstTeam,
          battingFirstTeam,
          2,
          match.overs
        );
        secondInnings.target = currentInnings.totalRuns + 1;
        match.innings.push(secondInnings);
        match.currentInningsIndex = 1;
        console.log(`[ScoreEngine] Target for 2nd innings: ${secondInnings.target}`);
      });
    } else {
      // 2nd Innings ended -> determine match result or TIE
      const inn1 = match.innings[0];
      const inn2 = match.innings[1];

      if (inn2.totalRuns > inn1.totalRuns) {
        const remainingWickets = (match.playerCount || 11) - 1 - inn2.wickets;
        match.status = 'completed';
        match.result = {
          winner: inn2.battingTeamName,
          summary: `${inn2.battingTeamName} won by ${remainingWickets} wicket${remainingWickets === 1 ? '' : 's'}!`
        };
      } else if (inn2.totalRuns < inn1.totalRuns) {
        const margin = inn1.totalRuns - inn2.totalRuns;
        match.status = 'completed';
        match.result = {
          winner: inn1.battingTeamName,
          summary: `${inn1.battingTeamName} won by ${margin} run${margin === 1 ? '' : 's'}!`
        };
      } else {
        // EXACT TIE DETECTED
        match.status = 'tied';
        match.result = {
          winner: 'TIE',
          isTie: true,
          summary: `MATCH TIED! Both teams scored exactly ${inn1.totalRuns} runs.`
        };
      }
    }
  },

  /**
   * Commentary generator
   */
  getBallCommentary(runs, batter, bowler) {
    const list = {
      0: [`Defended solidly by ${batter}.`, `Good length delivery from ${bowler}, dot ball.`, `Beaten outside off stump!`],
      1: [`Quick single taken by ${batter}.`, `Pushed into the gap for 1 run.`, `Tapped toward point, brisk running.`],
      2: [`Punched through covers, they hustle back for a brace!`, `Nicely placed in the outfield, two runs.`],
      3: [`Superb placement and aggressive running! Three runs.`],
      4: [`FOUR! Smashed to the boundary by ${batter}!`, `FOUR! Pierces the infield with magnificent timing!`],
      6: [`SIX! High, handsome and into the crowd! What a hit from ${batter}!`, `SIX! Colossal strike over long-on!`]
    };
    const c = list[runs] || [`${runs} run(s) scored.`];
    return c[Math.floor(Math.random() * c.length)];
  }
};
