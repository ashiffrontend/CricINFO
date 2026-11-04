/**
 * Cricket Engine & Rules State Machine
 * Gully Cricket Scorer
 * Designed & Developed by Ashif Web Studio
 * Developer: Mohammad Ashif (mohdashif.dev@gmail.com)
 */

export class CricketEngine {
  /**
   * Initialize a new cricket match instance
   */
  static createNewMatch({
    format = 'Limited Overs',
    playerCount = 11,
    overs = 20,
    venue = 'Gully Arena',
    ballType = 'Tennis (Heavy)',
    teamA = { name: 'Team A', players: [] },
    teamB = { name: 'Team B', players: [] },
    toss = { winner: 'A', decision: 'BAT' },
    openers = null
  }) {
    const isTest = format === 'Test Match' || overs === 'test';
    const isUnlimited = overs === 'unlimited';
    const parsedOvers = (isTest || isUnlimited) ? 999 : Number(overs);

    // Determine batting & bowling teams based on toss
    const teamABatsFirst = (toss.winner === 'A' && toss.decision === 'BAT') ||
                           (toss.winner === 'B' && toss.decision === 'BOWL');

    const battingTeam = teamABatsFirst ? teamA : teamB;
    const bowlingTeam = teamABatsFirst ? teamB : teamA;

    const matchId = 'match_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

    const firstInnings = CricketEngine.createInningsState(
      battingTeam,
      bowlingTeam,
      1,
      parsedOvers,
      openers
    );

    return {
      id: matchId,
      format,
      playerCount,
      overs: parsedOvers,
      displayOvers: (isTest ? 'Test' : (isUnlimited ? 'Unlimited' : overs)),
      venue,
      ballType,
      teamA,
      teamB,
      toss,
      status: 'live', // live, completed, tied, draw, no_result
      currentInningsIndex: 0,
      innings: [firstInnings],
      result: null,
      superOver: null,
      historyStack: [],
      redoStack: [],
      playerOfTheMatch: null,
      startTime: Date.now(),
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Helper to initialize an innings structure
   */
  static createInningsState(battingTeam, bowlingTeam, inningsNum, maxOvers, openers = null) {
    const batters = battingTeam.players.map(p => ({
      name: p.name,
      isCaptain: !!p.isCaptain,
      isKeeper: !!p.isKeeper,
      status: 'yet_to_bat', // yet_to_bat, batting, out, retired
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      strikeRate: 0,
      dismissal: null,
      bowler: null,
      fielder: null
    }));

    const bowlers = bowlingTeam.players.map(p => ({
      name: p.name,
      overs: 0,
      balls: 0,
      legalBalls: 0,
      maidens: 0,
      runs: 0,
      wickets: 0,
      economy: 0,
      wides: 0,
      noBalls: 0
    }));

    // Choose strike and non-strike batters
    const strikeBatter = openers?.strike || batters[0]?.name || 'Batter 1';
    const nonStrikeBatter = openers?.nonStrike || (batters[1]?.name || 'Batter 2');
    const openingBowler = openers?.bowler || bowlers[0]?.name || 'Bowler 1';

    // Set statuses
    const b1 = batters.find(b => b.name === strikeBatter);
    if (b1) b1.status = 'batting';
    const b2 = batters.find(b => b.name === nonStrikeBatter);
    if (b2) b2.status = 'batting';

    return {
      inningsNumber: inningsNum,
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
      currentBowlerName: openingBowler,
      batters,
      bowlers,
      currentOverBalls: [],
      allDeliveries: [],
      fallOfWickets: [],
      partnerships: [
        {
          batter1: strikeBatter,
          batter2: nonStrikeBatter,
          runs: 0,
          balls: 0
        }
      ],
      currentOverIndex: 0,
      isDeclared: false,
      isAllOut: false,
      isCompleted: false
    };
  }

  /**
   * Record a standard delivery (0, 1, 2, 3, 4, 5, 6 runs)
   */
  static recordDelivery(match, runs = 0) {
    const innings = match.innings[match.currentInningsIndex];
    if (!innings || innings.isCompleted) return match;

    // Save snapshot for Undo
    match.historyStack.push(JSON.parse(JSON.stringify(CricketEngine.getMatchSnapshot(match))));
    match.redoStack = []; // Clear redo on new action

    const isBoundary4 = runs === 4;
    const isBoundary6 = runs === 6;

    // 1. Update Innings total runs & balls
    innings.totalRuns += runs;
    innings.legalBalls += 1;

    // 2. Update Strike Batter
    const batter = innings.batters.find(b => b.name === innings.strikeBatterName);
    if (batter) {
      batter.runs += runs;
      batter.balls += 1;
      if (isBoundary4) batter.fours += 1;
      if (isBoundary6) batter.sixes += 1;
      batter.strikeRate = Number(((batter.runs / Math.max(1, batter.balls)) * 100).toFixed(1));
    }

    // 3. Update Current Bowler
    const bowler = innings.bowlers.find(b => b.name === innings.currentBowlerName);
    if (bowler) {
      bowler.runs += runs;
      bowler.legalBalls += 1;
      bowler.overs = Number((Math.floor(bowler.legalBalls / 6) + (bowler.legalBalls % 6) / 10).toFixed(1));
      bowler.economy = Number((bowler.runs / Math.max(0.166, bowler.legalBalls / 6)).toFixed(2));
    }

    // 4. Update Current Partnership
    const currentPartnership = innings.partnerships[innings.partnerships.length - 1];
    if (currentPartnership) {
      currentPartnership.runs += runs;
      currentPartnership.balls += 1;
    }

    // 5. Add ball to Current Over and Deliveries
    const ballObj = {
      ballNumber: innings.legalBalls,
      overNumber: Math.floor((innings.legalBalls - 1) / 6) + 1,
      bowler: innings.currentBowlerName,
      batter: innings.strikeBatterName,
      runs,
      extra: null,
      isLegal: true,
      display: runs === 0 ? '·' : String(runs),
      commentary: CricketEngine.generateCommentary(runs, innings.strikeBatterName, innings.currentBowlerName)
    };

    innings.currentOverBalls.push(ballObj);
    innings.allDeliveries.push(ballObj);

    // 6. Update overs bowled string
    innings.oversBowled = `${Math.floor(innings.legalBalls / 6)}.${innings.legalBalls % 6}`;

    // 7. Check if target reached in 2nd Innings
    if (match.currentInningsIndex === 1 && match.innings[0]) {
      const target = match.innings[0].totalRuns + 1;
      if (innings.totalRuns >= target) {
        CricketEngine.concludeMatch(match, `${innings.battingTeamName} won by ${match.playerCount - 1 - innings.wickets} wickets!`);
        return match;
      }
    }

    // 8. Rotate Strike on odd runs (1, 3, 5)
    if (runs % 2 !== 0) {
      CricketEngine.swapStrike(innings);
    }

    // 9. Check End of Over
    if (innings.legalBalls % 6 === 0) {
      CricketEngine.completeOver(innings, match);
    }

    // 10. Check if all overs bowled
    if (innings.legalBalls >= innings.maxOvers * 6) {
      CricketEngine.completeInnings(match);
    }

    return match;
  }

  /**
   * Record Extra Delivery (Wide, No Ball, Bye, Leg Bye, Penalty)
   */
  static recordExtra(match, extraType, additionalRuns = 0) {
    const innings = match.innings[match.currentInningsIndex];
    if (!innings || innings.isCompleted) return match;

    match.historyStack.push(JSON.parse(JSON.stringify(CricketEngine.getMatchSnapshot(match))));
    match.redoStack = [];

    const bowler = innings.bowlers.find(b => b.name === innings.currentBowlerName);
    const batter = innings.batters.find(b => b.name === innings.strikeBatterName);

    let isLegal = false;
    let extraRuns = 0;
    let ballDisplay = '';

    if (extraType === 'wide') {
      isLegal = false;
      extraRuns = 1 + additionalRuns;
      innings.extras.wides += extraRuns;
      innings.totalRuns += extraRuns;
      if (bowler) {
        bowler.wides += 1;
        bowler.runs += extraRuns;
        bowler.economy = Number((bowler.runs / Math.max(0.166, bowler.legalBalls / 6)).toFixed(2));
      }
      ballDisplay = additionalRuns > 0 ? `${1 + additionalRuns}wd` : 'wd';
    } else if (extraType === 'noball') {
      isLegal = false;
      extraRuns = 1 + additionalRuns;
      innings.extras.noBalls += 1;
      innings.totalRuns += extraRuns;
      if (bowler) {
        bowler.noBalls += 1;
        bowler.runs += extraRuns;
        bowler.economy = Number((bowler.runs / Math.max(0.166, bowler.legalBalls / 6)).toFixed(2));
      }
      if (batter && additionalRuns > 0) {
        batter.runs += additionalRuns;
        batter.strikeRate = Number(((batter.runs / Math.max(1, batter.balls)) * 100).toFixed(1));
      }
      ballDisplay = additionalRuns > 0 ? `${1 + additionalRuns}nb` : 'nb';
    } else if (extraType === 'bye' || extraType === 'legbye') {
      isLegal = true;
      extraRuns = additionalRuns || 1;
      if (extraType === 'bye') innings.extras.byes += extraRuns;
      if (extraType === 'legbye') innings.extras.legByes += extraRuns;

      innings.totalRuns += extraRuns;
      innings.legalBalls += 1;
      if (batter) batter.balls += 1;
      if (bowler) {
        bowler.legalBalls += 1;
        bowler.overs = Number((Math.floor(bowler.legalBalls / 6) + (bowler.legalBalls % 6) / 10).toFixed(1));
        bowler.economy = Number((bowler.runs / Math.max(0.166, bowler.legalBalls / 6)).toFixed(2));
      }
      ballDisplay = extraType === 'bye' ? `${extraRuns}b` : `${extraRuns}lb`;
    } else if (extraType === 'penalty') {
      extraRuns = 5;
      innings.extras.penalty += 5;
      innings.totalRuns += 5;
      ballDisplay = '+5P';
    }

    innings.extras.total += extraRuns;

    // Update partnership
    const currentPartnership = innings.partnerships[innings.partnerships.length - 1];
    if (currentPartnership) {
      currentPartnership.runs += extraRuns;
      if (isLegal) currentPartnership.balls += 1;
    }

    const ballObj = {
      ballNumber: innings.legalBalls,
      overNumber: Math.floor((innings.legalBalls) / 6) + 1,
      bowler: innings.currentBowlerName,
      batter: innings.strikeBatterName,
      runs: additionalRuns,
      extra: extraType,
      extraRuns,
      isLegal,
      display: ballDisplay,
      commentary: `${extraType.toUpperCase()}! ${extraRuns} run(s) awarded.`
    };

    innings.currentOverBalls.push(ballObj);
    innings.allDeliveries.push(ballObj);

    innings.oversBowled = `${Math.floor(innings.legalBalls / 6)}.${innings.legalBalls % 6}`;

    // Rotate strike on odd additional runs
    if (additionalRuns % 2 !== 0) {
      CricketEngine.swapStrike(innings);
    }

    // Check target in 2nd innings
    if (match.currentInningsIndex === 1 && match.innings[0]) {
      const target = match.innings[0].totalRuns + 1;
      if (innings.totalRuns >= target) {
        CricketEngine.concludeMatch(match, `${innings.battingTeamName} won by ${match.playerCount - 1 - innings.wickets} wickets!`);
        return match;
      }
    }

    if (isLegal && innings.legalBalls % 6 === 0) {
      CricketEngine.completeOver(innings, match);
    }

    if (innings.legalBalls >= innings.maxOvers * 6) {
      CricketEngine.completeInnings(match);
    }

    return match;
  }

  /**
   * Record a Wicket Dismissal
   */
  static recordWicket(match, {
    dismissalType = 'Bowled',
    outBatter = 'strike', // 'strike' or 'nonstrike'
    fielder = null,
    nextBatter = null,
    runsCompleted = 0
  }) {
    const innings = match.innings[match.currentInningsIndex];
    if (!innings || innings.isCompleted) return match;

    match.historyStack.push(JSON.parse(JSON.stringify(CricketEngine.getMatchSnapshot(match))));
    match.redoStack = [];

    const isStrikeOut = outBatter === 'strike';
    const outBatterName = isStrikeOut ? innings.strikeBatterName : innings.nonStrikeBatterName;

    // 1. Add completed runs (e.g. on run out)
    if (runsCompleted > 0) {
      innings.totalRuns += runsCompleted;
    }

    // 2. Mark legal delivery (unless run out on wide/no-ball)
    const isLegal = dismissalType !== 'Wide Run Out';
    if (isLegal) {
      innings.legalBalls += 1;
    }

    // 3. Increment wickets count
    innings.wickets += 1;

    // 4. Update Dismissed Batter
    const dismissed = innings.batters.find(b => b.name === outBatterName);
    if (dismissed) {
      dismissed.status = 'out';
      if (isLegal) dismissed.balls += 1;
      dismissed.runs += (isStrikeOut ? runsCompleted : 0);
      dismissed.dismissal = dismissalType;
      dismissed.bowler = (dismissalType === 'Run Out' || dismissalType === 'Retired Hurt') ? null : innings.currentBowlerName;
      dismissed.fielder = fielder;
      dismissed.strikeRate = Number(((dismissed.runs / Math.max(1, dismissed.balls)) * 100).toFixed(1));
    }

    // 5. Update Bowler Stats (Run out does not count toward bowler wickets)
    const bowler = innings.bowlers.find(b => b.name === innings.currentBowlerName);
    if (bowler) {
      if (isLegal) bowler.legalBalls += 1;
      if (dismissalType !== 'Run Out' && dismissalType !== 'Retired Hurt') {
        bowler.wickets += 1;
      }
      bowler.runs += runsCompleted;
      bowler.overs = Number((Math.floor(bowler.legalBalls / 6) + (bowler.legalBalls % 6) / 10).toFixed(1));
      bowler.economy = Number((bowler.runs / Math.max(0.166, bowler.legalBalls / 6)).toFixed(2));
    }

    // 6. Record Fall of Wickets
    innings.fallOfWickets.push({
      wicketNumber: innings.wickets,
      score: innings.totalRuns,
      overs: `${Math.floor(innings.legalBalls / 6)}.${innings.legalBalls % 6}`,
      batterName: outBatterName
    });

    // 7. Add Ball
    const ballObj = {
      ballNumber: innings.legalBalls,
      overNumber: Math.floor(innings.legalBalls / 6) + 1,
      bowler: innings.currentBowlerName,
      batter: innings.strikeBatterName,
      runs: runsCompleted,
      isWicket: true,
      dismissalType,
      outBatterName,
      display: runsCompleted > 0 ? `${runsCompleted}W` : 'W',
      commentary: `OUT! ${outBatterName} is dismissed (${dismissalType}). Wicket #${innings.wickets} falls!`
    };

    innings.currentOverBalls.push(ballObj);
    innings.allDeliveries.push(ballObj);
    innings.oversBowled = `${Math.floor(innings.legalBalls / 6)}.${innings.legalBalls % 6}`;

    // 8. Check if All Out (wickets >= players - 1)
    const maxWickets = Math.max(1, match.playerCount - 1);
    if (innings.wickets >= maxWickets) {
      innings.isAllOut = true;
      CricketEngine.completeInnings(match);
      return match;
    }

    // 9. Assign Next Batter
    if (nextBatter) {
      const nextB = innings.batters.find(b => b.name === nextBatter);
      if (nextB) {
        nextB.status = 'batting';
        if (isStrikeOut) {
          innings.strikeBatterName = nextBatter;
        } else {
          innings.nonStrikeBatterName = nextBatter;
        }
      }
    }

    // 10. Start fresh partnership
    innings.partnerships.push({
      batter1: innings.strikeBatterName,
      batter2: innings.nonStrikeBatterName,
      runs: 0,
      balls: 0
    });

    // Check end of over
    if (isLegal && innings.legalBalls % 6 === 0) {
      CricketEngine.completeOver(innings, match);
    }

    if (innings.legalBalls >= innings.maxOvers * 6) {
      CricketEngine.completeInnings(match);
    }

    return match;
  }

  /**
   * Swap strike between the two active batters
   */
  static swapStrike(innings) {
    const temp = innings.strikeBatterName;
    innings.strikeBatterName = innings.nonStrikeBatterName;
    innings.nonStrikeBatterName = temp;
  }

  /**
   * Handle completion of an over (6 legal balls)
   */
  static completeOver(innings, match) {
    // Check if maiden over
    const bowler = innings.bowlers.find(b => b.name === innings.currentBowlerName);
    const ballsInOver = innings.currentOverBalls.filter(b => b.isLegal);
    const runsInOver = innings.currentOverBalls.reduce((acc, b) => acc + (b.runs || 0) + (b.extraRuns || 0), 0);
    if (ballsInOver.length === 6 && runsInOver === 0 && bowler) {
      bowler.maidens += 1;
    }

    // Swap strike at the end of every over
    CricketEngine.swapStrike(innings);

    // Reset current over visual balls array for next over
    innings.currentOverIndex += 1;
    innings.currentOverBalls = [];
  }

  /**
   * Conclude an Innings & transition or finish match
   */
  static completeInnings(match) {
    const currentInnings = match.innings[match.currentInningsIndex];
    currentInnings.isCompleted = true;

    // If 1st innings finished -> setup 2nd innings
    if (match.currentInningsIndex === 0) {
      const battingFirstTeam = currentInnings.battingTeamName === match.teamA.name ? match.teamA : match.teamB;
      const bowlingFirstTeam = currentInnings.bowlingTeamName === match.teamA.name ? match.teamA : match.teamB;

      const secondInnings = CricketEngine.createInningsState(
        bowlingFirstTeam, // Batting second
        battingFirstTeam, // Bowling second
        2,
        match.overs
      );

      match.innings.push(secondInnings);
      match.currentInningsIndex = 1;
      console.log('[CricketEngine] Innings 1 ended. Target set to:', currentInnings.totalRuns + 1);
    } else {
      // 2nd Innings finished -> Determine Final Result!
      const inn1 = match.innings[0];
      const inn2 = match.innings[1];

      if (inn2.totalRuns > inn1.totalRuns) {
        const wicketsRemaining = (match.playerCount - 1) - inn2.wickets;
        CricketEngine.concludeMatch(match, `${inn2.battingTeamName} won by ${wicketsRemaining} wicket(s)!`);
      } else if (inn2.totalRuns < inn1.totalRuns) {
        const margin = inn1.totalRuns - inn2.totalRuns;
        CricketEngine.concludeMatch(match, `${inn1.battingTeamName} won by ${margin} run(s)!`);
      } else {
        // TIE!
        match.status = 'tied';
        match.result = {
          winner: 'TIE',
          summary: 'Match Tied! Scores are level at ' + inn1.totalRuns + ' runs.',
          isTie: true
        };
      }
    }
  }

  /**
   * Conclude Match and calculate Player of the Match
   */
  static concludeMatch(match, summaryText) {
    match.status = 'completed';
    match.result = {
      summary: summaryText,
      completedAt: new Date().toISOString()
    };
    match.playerOfTheMatch = CricketEngine.calculatePlayerOfTheMatch(match);
  }

  /**
   * Calculate Player of the Match based on MVP performance index
   */
  static calculatePlayerOfTheMatch(match) {
    const scores = {};

    match.innings.forEach(inn => {
      // Batting contributions: 1 pt per run, +10 for 50, +20 for 100, +2 per six, +1 per four
      inn.batters.forEach(b => {
        if (!scores[b.name]) scores[b.name] = 0;
        let pts = b.runs + (b.sixes * 2) + b.fours;
        if (b.runs >= 50) pts += 10;
        if (b.runs >= 100) pts += 20;
        scores[b.name] += pts;
      });

      // Bowling contributions: 25 pts per wicket, +5 for maiden, economy bonus
      inn.bowlers.forEach(bw => {
        if (!scores[bw.name]) scores[bw.name] = 0;
        let pts = (bw.wickets * 25) + (bw.maidens * 10);
        if (bw.legalBalls >= 12 && bw.economy < 6.0) pts += 10;
        scores[bw.name] += pts;
      });
    });

    let topPlayer = 'All-Rounder';
    let maxPoints = -1;

    for (const [player, pts] of Object.entries(scores)) {
      if (pts > maxPoints) {
        maxPoints = pts;
        topPlayer = player;
      }
    }

    return topPlayer;
  }

  /**
   * Undo Last Action
   */
  static undo(match) {
    if (!match.historyStack || match.historyStack.length === 0) return match;
    const previousSnapshot = match.historyStack.pop();
    match.redoStack.push(JSON.parse(JSON.stringify(CricketEngine.getMatchSnapshot(match))));

    Object.assign(match, previousSnapshot);
    return match;
  }

  /**
   * Redo Ball
   */
  static redo(match) {
    if (!match.redoStack || match.redoStack.length === 0) return match;
    const nextSnapshot = match.redoStack.pop();
    match.historyStack.push(JSON.parse(JSON.stringify(CricketEngine.getMatchSnapshot(match))));

    Object.assign(match, nextSnapshot);
    return match;
  }

  /**
   * Create snapshot for undo/redo
   */
  static getMatchSnapshot(match) {
    const { historyStack, redoStack, ...rest } = match;
    return rest;
  }

  /**
   * Generate realistic ball commentary text
   */
  static generateCommentary(runs, batter, bowler) {
    const comments = {
      0: [
        `${bowler} bowls a good length delivery, defended solidly by ${batter}.`,
        `Dot ball! Excellent tight line outside off stump from ${bowler}.`,
        `Beaten outside off! ${bowler} extracts sharp bounce past ${batter}'s bat.`,
        `Pushed gently to mid-on, no run taken.`
      ],
      1: [
        `${batter} guides it into the gap for a quick single.`,
        `Tapped towards point, brisk running between the wickets.`,
        `Flicked off the pads to deep square leg for one run.`
      ],
      2: [
        `${batter} punches through the covers, excellent hustle for a brace!`,
        `Driven into the deep outfield, they come back comfortably for two.`
      ],
      3: [
        `Terrific placement and aggressive running! Three runs added to the total.`
      ],
      4: [
        `FOUR! Cracked through the covers with pure authority by ${batter}!`,
        `FOUR! Short delivery punished ruthlessly to the square leg fence!`,
        `FOUR! Edged past the keeper and races away to the third-man boundary!`
      ],
      6: [
        `SIX! High, handsome, and into the stands! What a massive strike from ${batter}!`,
        `SIX! Dispatched over long-on with magnificent timing! That is huge!`,
        `SIX! Hooked off the front foot straight into the crowd! Pure class!`
      ]
    };

    const list = comments[runs] || [`${runs} run(s) scored.`];
    return list[Math.floor(Math.random() * list.length)];
  }
}
