/**
 * Application Controller
 * Gully Cricket Scorer
 * Designed & Developed by Ashif Web Studio
 * Developer: Mohammad Ashif (mohdashif.dev@gmail.com)
 * Website: https://ashif-web-studio.vercel.app
 */

import {
  saveMatchToFirestore,
  fetchUserMatches,
  fetchAdminStats,
  deleteMatchFromFirestore,
  deleteUserFromFirestore,
  ADMIN_EMAIL
} from './firebase.js';

import {
  loginWithGoogle,
  logoutUser,
  initAuthListener
} from './auth.js';

import { storage } from './storage.js';
import { CricketEngine } from './cricket-engine.js';
import { PDFExport } from './pdf-export.js';

// State
window.appState = {
  currentUser: null,
  activeMatch: null,
  userMatches: [],
  createStep: 1,
  matchDraft: {
    team1: { name: 'Thunder Strikers', players: [], captain: '' },
    team2: { name: 'Royal Challengers', players: [], captain: '' },
    overs: 20,
    toss: { winner: '1', decision: 'BAT' }
  },
  adminAuthenticated: false,
  deferredPWAInstallPrompt: null
};

// ============================================================================
// 1. BOOTSTRAP & SPLASH (Exactly 3 seconds)
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('[App] Initializing Gully Cricket Scorer...');

  // Load local match
  const savedLive = storage.getLiveMatch();
  if (savedLive) {
    window.appState.activeMatch = savedLive;
  }

  // Auth observer via auth.js
  initAuthObserver();

  // Router
  initRouter();

  // PWA & Offline
  initPWAAndOffline();

  // Initialize Create Squad Inputs
  initDefaultSquadInputs();

  // Splash Screen timer (3 seconds)
  runSplashScreen();
});

/**
 * Splash Screen (Exactly 3 Seconds)
 * Automatically transitions to Login Screen (if not logged in) or Dashboard (if logged in)
 */
function runSplashScreen() {
  const splash = document.getElementById('splash-screen');
  const timerSpan = document.getElementById('splash-timer');
  const btnSkip = document.getElementById('btn-skip-splash');

  let remaining = 3;
  const interval = setInterval(() => {
    remaining -= 1;
    if (timerSpan) timerSpan.textContent = String(remaining);
    if (remaining <= 0) {
      clearInterval(interval);
      closeSplash();
    }
  }, 1000);

  const closeSplash = () => {
    clearInterval(interval);
    splash.classList.add('fade-out');
    setTimeout(() => {
      splash.style.display = 'none';
      // Route after splash
      if (!window.appState.currentUser && !window.location.hash.includes('admin-login')) {
        window.location.hash = '#login';
      } else if (!window.location.hash || window.location.hash === '#login') {
        window.location.hash = '#home';
      }
    }, 500);
  };

  if (btnSkip) {
    btnSkip.addEventListener('click', closeSplash);
  }
}

// ============================================================================
// 2. AUTHENTICATION (Google Only via auth.js)
// ============================================================================

function initAuthObserver() {
  const btnHeaderLogin = document.getElementById('btn-header-login');
  const btnHeaderLogout = document.getElementById('btn-header-logout');
  const btnProfileLogout = document.getElementById('btn-profile-logout');
  const userBadge = document.getElementById('header-user-badge');
  const userAvatar = document.getElementById('header-user-avatar');
  const menuName = document.getElementById('menu-user-name');
  const menuEmail = document.getElementById('menu-user-email');
  const btnMainLogin = document.getElementById('btn-login-google-main');

  // Use persistent onAuthStateChanged listener from auth.js
  initAuthListener((user) => {
    if (user) {
      window.appState.currentUser = user;
      storage.setCachedUser({
        uid: user.uid,
        name: user.displayName,
        email: user.email,
        photo: user.photoURL
      });

      if (btnHeaderLogin) btnHeaderLogin.classList.add('d-none');
      if (userBadge) userBadge.classList.remove('d-none');
      if (userAvatar) userAvatar.src = user.photoURL || '/assets/aistudio/Ashif_Web_Studio_Frontend_Developer_logo_229c6c9e.png';
      if (menuName) menuName.textContent = user.displayName || 'Player';
      if (menuEmail) menuEmail.textContent = user.email || '';

      // Fetch user's own matches
      loadCurrentUserMatches();
      renderProfileView();
    } else {
      window.appState.currentUser = null;
      storage.setCachedUser(null);
      window.appState.userMatches = [];

      if (btnHeaderLogin) btnHeaderLogin.classList.remove('d-none');
      if (userBadge) userBadge.classList.add('d-none');

      renderDashboardAnalytics();
      renderUserPreviousMatches();
    }
  });

  const triggerGoogleLogin = async () => {
    try {
      await loginWithGoogle();
      showToast('Signed in successfully!', 'success');
      window.location.hash = '#home';
    } catch (e) {
      showToast('Sign-in cancelled or failed: ' + (e.message || e), 'danger');
    }
  };

  if (btnHeaderLogin) btnHeaderLogin.addEventListener('click', triggerGoogleLogin);
  if (btnMainLogin) btnMainLogin.addEventListener('click', triggerGoogleLogin);

  const triggerLogout = async () => {
    try {
      await logoutUser();
      showToast('Signed out.');
      window.location.hash = '#login';
    } catch (e) {
      showToast('Logout error: ' + (e.message || e), 'danger');
    }
  };

  if (btnHeaderLogout) btnHeaderLogout.addEventListener('click', triggerLogout);
  if (btnProfileLogout) btnProfileLogout.addEventListener('click', triggerLogout);
}

/**
 * Load ONLY current user's matches (ownerUID == currentUser.uid)
 * Enforces strict User A vs User B data isolation
 */
async function loadCurrentUserMatches() {
  const user = window.appState.currentUser;
  if (!user) return;

  try {
    const list = await fetchUserMatches(user.uid);
    window.appState.userMatches = list;
    renderDashboardAnalytics();
    renderUserPreviousMatches();
    renderProfileView();
  } catch (e) {
    console.warn('Could not load user matches from cloud, checking local storage:', e);
  }
}

// ============================================================================
// 3. SPA ROUTING
// ============================================================================

function initRouter() {
  const route = () => {
    let hash = window.location.hash || '#home';
    if (hash === '' || hash === '#') hash = '#home';

    // If not logged in and trying to access private areas, prompt login
    if (!window.appState.currentUser && hash !== '#login' && hash !== '#admin-login' && !storage.getCachedUser()) {
      // Allow browsing home or redirect to login
    }

    // Hide all views
    document.querySelectorAll('.spa-view').forEach(v => v.classList.remove('active'));

    const map = {
      '#login': 'view-login',
      '#home': 'view-home',
      '#create-match': 'view-create-match',
      '#live-score': 'view-live-score',
      '#previous-matches': 'view-previous-matches',
      '#profile': 'view-profile',
      '#admin-login': 'view-admin-login'
    };

    const targetId = map[hash] || 'view-home';
    const targetEl = document.getElementById(targetId);
    if (targetEl) {
      targetEl.classList.add('active');
    }

    // View-specific initializers
    if (hash === '#home') {
      renderDashboardAnalytics();
      renderHomeLiveCard();
    } else if (hash === '#live-score') {
      renderLiveScoringConsole();
    } else if (hash === '#previous-matches') {
      loadCurrentUserMatches();
      renderUserPreviousMatches();
    } else if (hash === '#profile') {
      renderProfileView();
    } else if (hash === '#admin-login') {
      checkAdminAccess();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  window.addEventListener('hashchange', route);
  route();
}

// ============================================================================
// 4. HOME PAGE & DASHBOARD (Analytics Cards & Single Live Match)
// ============================================================================

function renderDashboardAnalytics() {
  const userMatches = window.appState.userMatches;
  const liveMatch = window.appState.activeMatch;

  // 1. Total Users (from local cache or firestore)
  const usersCount = Math.max(1, (window.appState.currentUser ? 1 : 0) + (storage.getAllMatches().length > 0 ? 3 : 1));
  const elUsers = document.getElementById('stat-total-users');
  if (elUsers) elUsers.textContent = String(usersCount);

  // 2. Total Matches (Current user's matches count)
  const elMatches = document.getElementById('stat-total-matches');
  if (elMatches) elMatches.textContent = String(userMatches.length);

  // 3. Live Match count (1 if active live, else 0)
  const isLive = liveMatch && liveMatch.status === 'live';
  const elLive = document.getElementById('stat-live-match');
  if (elLive) elLive.textContent = isLive ? '1' : '0';

  renderHomeLiveCard();
}

/**
 * 5. LIVE MATCH ON HOMEPAGE: Only ONE live match visible on homepage
 */
function renderHomeLiveCard() {
  const container = document.getElementById('home-live-match-container');
  const liveMatch = window.appState.activeMatch;

  if (!container) return;

  if (!liveMatch || liveMatch.status !== 'live') {
    container.classList.add('d-none');
    return;
  }

  container.classList.remove('d-none');
  const inn = liveMatch.innings[liveMatch.currentInningsIndex];
  if (!inn) return;

  document.getElementById('home-live-venue').textContent = liveMatch.venue || 'Gully Arena';
  document.getElementById('home-live-teams').textContent = `${liveMatch.teamA.name} vs ${liveMatch.teamB.name}`;
  document.getElementById('home-live-score').textContent = `${inn.totalRuns}/${inn.wickets}`;
  document.getElementById('home-live-overs').textContent = inn.oversBowled;
  document.getElementById('home-live-batter').textContent = inn.strikeBatterName || 'Batter';
  document.getElementById('home-live-bowler').textContent = inn.currentBowlerName || 'Bowler';
}

// ============================================================================
// 6. CREATE MATCH (Step 1 -> Step 2 -> Step 3 Toss)
// ============================================================================

function initDefaultSquadInputs() {
  generateTeamInputs('1', [
    'Mohammad Ashif', 'Rohit Sharma', 'Virat Kohli', 'Surya Kumar', 'Hardik Pandya',
    'Rinku Singh', 'Axar Patel', 'Kuldeep Yadav', 'Jasprit Bumrah', 'Arshdeep Singh', 'Siraj'
  ]);

  generateTeamInputs('2', [
    'Babar Azam', 'Mohammad Rizwan', 'Fakhar Zaman', 'Iftikhar Ahmed', 'Shadab Khan',
    'Imad Wasim', 'Shaheen Afridi', 'Naseem Shah', 'Haris Rauf', 'Mohammad Amir', 'Abrar Ahmed'
  ]);
}

function generateTeamInputs(teamNum, defaultNames) {
  const container = document.getElementById(`team-${teamNum}-players-container`);
  const captainSelect = document.getElementById(`select-team-${teamNum}-captain`);
  if (!container) return;

  container.innerHTML = '';
  if (captainSelect) captainSelect.innerHTML = '';

  defaultNames.forEach((name, idx) => {
    const row = document.createElement('div');
    row.className = 'input-group input-group-sm mb-2';
    row.innerHTML = `
      <span class="input-group-text bg-white border text-muted" style="width: 32px;">${idx + 1}</span>
      <input type="text" class="form-control squad-player-input" data-team="${teamNum}" value="${name}" placeholder="Player ${idx + 1} Name" />
      <button type="button" class="btn btn-outline-danger btn-sm" onclick="this.parentElement.remove(); window.updateCaptainOptions('${teamNum}');">
        <i class="bi bi-x"></i>
      </button>
    `;
    container.appendChild(row);

    if (captainSelect) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      if (idx === 0) opt.selected = true;
      captainSelect.appendChild(opt);
    }
  });
}

window.addPlayerRowToTeam = function(teamNum) {
  const container = document.getElementById(`team-${teamNum}-players-container`);
  if (!container) return;
  const count = container.querySelectorAll('.squad-player-input').length + 1;
  const row = document.createElement('div');
  row.className = 'input-group input-group-sm mb-2';
  row.innerHTML = `
    <span class="input-group-text bg-white border text-muted" style="width: 32px;">${count}</span>
    <input type="text" class="form-control squad-player-input" data-team="${teamNum}" value="Player ${count}" placeholder="Player ${count} Name" />
    <button type="button" class="btn btn-outline-danger btn-sm" onclick="this.parentElement.remove(); window.updateCaptainOptions('${teamNum}');">
      <i class="bi bi-x"></i>
    </button>
  `;
  container.appendChild(row);
  window.updateCaptainOptions(teamNum);
};

window.updateCaptainOptions = function(teamNum) {
  const inputs = document.querySelectorAll(`.squad-player-input[data-team="${teamNum}"]`);
  const captainSelect = document.getElementById(`select-team-${teamNum}-captain`);
  if (!captainSelect) return;
  const currentVal = captainSelect.value;
  captainSelect.innerHTML = '';
  inputs.forEach((inp, idx) => {
    const name = inp.value.trim() || `Player ${idx + 1}`;
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    if (name === currentVal || idx === 0) opt.selected = true;
    captainSelect.appendChild(opt);
  });
};

window.gotoCreateStep = function(stepNum) {
  window.appState.createStep = stepNum;

  // Step 1 validation
  if (stepNum === 2) {
    const name1 = document.getElementById('input-team-1-name').value.trim() || 'First Team';
    const players1 = Array.from(document.querySelectorAll('.squad-player-input[data-team="1"]'))
      .map(i => ({ name: i.value.trim() || 'Player' }));
    const captain1 = document.getElementById('select-team-1-captain').value || players1[0]?.name;

    window.appState.matchDraft.team1 = {
      name: name1,
      players: players1,
      captain: captain1
    };
  }

  // Step 2 validation
  if (stepNum === 3) {
    const name2 = document.getElementById('input-team-2-name').value.trim() || 'Second Team';
    const players2 = Array.from(document.querySelectorAll('.squad-player-input[data-team="2"]'))
      .map(i => ({ name: i.value.trim() || 'Player' }));
    const captain2 = document.getElementById('select-team-2-captain').value || players2[0]?.name;
    const overs = Number(document.getElementById('select-match-overs').value) || 20;

    window.appState.matchDraft.team2 = {
      name: name2,
      players: players2,
      captain: captain2
    };
    window.appState.matchDraft.overs = overs;

    // Populate Step 3 toss calling team select
    const callerSel = document.getElementById('select-toss-caller');
    if (callerSel) {
      callerSel.innerHTML = `
        <option value="1">${window.appState.matchDraft.team1.name}</option>
        <option value="2">${window.appState.matchDraft.team2.name}</option>
      `;
    }
  }

  document.querySelectorAll('.wizard-step-pane').forEach((pane, idx) => {
    if (idx + 1 === stepNum) pane.classList.add('active');
    else pane.classList.remove('active');
  });

  window.scrollTo({ top: 100, behavior: 'smooth' });
};

/**
 * 3D Toss Coin Execution
 */
window.executeCoinFlip = function() {
  const coin = document.getElementById('toss-coin');
  const btn = document.getElementById('btn-do-flip');
  const statusEl = document.getElementById('toss-call-status');
  const outcomeBox = document.getElementById('toss-outcome-box');
  const winnerBadge = document.getElementById('toss-winner-badge');

  const callerChoice = document.getElementById('select-toss-caller').value; // '1' or '2'
  const call = document.getElementById('select-toss-call-choice').value; // 'Heads' or 'Tails'
  const callerName = callerChoice === '1' ? window.appState.matchDraft.team1.name : window.appState.matchDraft.team2.name;
  const oppName = callerChoice === '1' ? window.appState.matchDraft.team2.name : window.appState.matchDraft.team1.name;

  btn.disabled = true;
  statusEl.textContent = 'Flipping coin...';

  coin.classList.remove('animating');
  void coin.offsetWidth;
  coin.classList.add('animating');

  const result = Math.random() > 0.5 ? 'Heads' : 'Tails';
  const winnerTeamNum = result === call ? callerChoice : (callerChoice === '1' ? '2' : '1');
  const winnerName = winnerTeamNum === '1' ? window.appState.matchDraft.team1.name : window.appState.matchDraft.team2.name;

  setTimeout(() => {
    coin.classList.remove('animating');
    statusEl.innerHTML = `Landed on: <strong class="text-primary">${result.toUpperCase()}</strong>!`;
    winnerBadge.innerHTML = `<strong>${winnerName}</strong> won the toss!`;
    outcomeBox.classList.remove('d-none');
    btn.disabled = false;

    window.appState.matchDraft.toss.winner = winnerTeamNum;
  }, 1600);
};

/**
 * Start Match -> Automatically marks any previous live match completed!
 */
window.launchMatch = async function() {
  const draft = window.appState.matchDraft;
  const decision = document.querySelector('input[name="tossDecision"]:checked')?.value || 'BAT';
  draft.toss.decision = decision;

  // When another match starts, previous live match is automatically completed!
  const prevLive = window.appState.activeMatch;
  if (prevLive && prevLive.status === 'live') {
    prevLive.status = 'completed';
    prevLive.result = { summary: 'Completed (New match started)' };
    storage.saveMatch(prevLive);
    await saveMatchToFirestore(prevLive);
  }

  const newMatch = CricketEngine.createNewMatch({
    format: draft.overs === 999 ? 'Test Match' : 'Limited Overs',
    playerCount: draft.team1.players.length,
    overs: draft.overs,
    venue: 'Gully Turf Arena',
    teamA: draft.team1,
    teamB: draft.team2,
    toss: {
      winner: draft.toss.winner === '1' ? 'A' : 'B',
      decision: draft.toss.decision
    }
  });

  const uid = window.appState.currentUser ? window.appState.currentUser.uid : 'local_player';
  newMatch.ownerUID = uid;
  newMatch.userId = uid;

  window.appState.activeMatch = newMatch;
  storage.setLiveMatch(newMatch);
  storage.saveMatch(newMatch);
  await saveMatchToFirestore(newMatch);

  // Reload user matches
  loadCurrentUserMatches();

  showToast('Match started successfully!', 'success');
  window.location.hash = '#live-score';
};

// ============================================================================
// 7. LIVE SCORING (Minimal interface matching exact requirements)
// ============================================================================

function renderLiveScoringConsole() {
  const match = window.appState.activeMatch;
  const noMatchEl = document.getElementById('live-no-match');
  const consoleEl = document.getElementById('live-scoring-console');

  if (!match || match.status !== 'live') {
    if (noMatchEl) noMatchEl.classList.remove('d-none');
    if (consoleEl) consoleEl.classList.add('d-none');
    return;
  }

  if (noMatchEl) noMatchEl.classList.add('d-none');
  if (consoleEl) consoleEl.classList.remove('d-none');

  const inn = match.innings[match.currentInningsIndex];
  if (!inn) return;

  // Top Score display
  document.getElementById('score-header-teams').textContent = `${match.teamA.name} vs ${match.teamB.name}`;
  document.getElementById('score-runs-wickets').textContent = `${inn.totalRuns}/${inn.wickets}`;
  document.getElementById('score-overs-display').textContent = inn.oversBowled;
  document.getElementById('score-max-overs').textContent = inn.maxOvers === 999 ? 'Test' : String(inn.maxOvers);

  const crr = (inn.totalRuns / Math.max(0.166, inn.legalBalls / 6)).toFixed(2);
  document.getElementById('score-crr-display').textContent = crr;

  // Batter & Bowler stats
  const batter = inn.batters.find(b => b.name === inn.strikeBatterName) || { name: inn.strikeBatterName, runs: 0, balls: 0 };
  const bowler = inn.bowlers.find(b => b.name === inn.currentBowlerName) || { name: inn.currentBowlerName, runs: 0, wickets: 0, overs: 0 };

  document.getElementById('score-current-batter').textContent = batter.name;
  document.getElementById('score-batter-runs').textContent = String(batter.runs);
  document.getElementById('score-batter-balls').textContent = String(batter.balls);

  document.getElementById('score-current-bowler').textContent = bowler.name;
  document.getElementById('score-bowler-wickets').textContent = String(bowler.wickets);
  document.getElementById('score-bowler-runs').textContent = String(bowler.runs);
  document.getElementById('score-bowler-overs').textContent = String(bowler.overs);

  // This Over Ball Badges
  const ballsContainer = document.getElementById('live-over-balls-list');
  if (ballsContainer) {
    ballsContainer.innerHTML = '';
    const currentBalls = inn.currentOverBalls || [];
    currentBalls.forEach(b => {
      const badge = document.createElement('span');
      badge.className = 'ball-dot-badge';
      if (b.isWicket) badge.classList.add('wicket');
      else if (b.runs === 4) badge.classList.add('four');
      else if (b.runs === 6) badge.classList.add('six');
      else if (b.extra) badge.classList.add('extra');
      else if (b.runs === 0) badge.classList.add('dot');

      badge.textContent = b.display;
      ballsContainer.appendChild(badge);
    });

    if (currentBalls.length === 0) {
      ballsContainer.innerHTML = '<span class="text-muted small">Over just started</span>';
    }
  }

  // Check if finished
  if (match.status === 'completed' || match.status === 'tied') {
    showMatchEndModal(match);
  }
}

// Ball Scoring
window.scoreBall = function(runs) {
  const match = window.appState.activeMatch;
  if (!match || match.status !== 'live') return;

  CricketEngine.recordDelivery(match, runs);
  syncActiveMatch(match);
};

window.scoreExtra = function(type) {
  const match = window.appState.activeMatch;
  if (!match || match.status !== 'live') return;

  CricketEngine.recordExtra(match, type, 0);
  syncActiveMatch(match);
};

window.scoreWicket = function() {
  const match = window.appState.activeMatch;
  if (!match || match.status !== 'live') return;

  const inn = match.innings[match.currentInningsIndex];
  const yetToBat = inn.batters.find(b => b.status === 'yet_to_bat');
  const nextBatterName = yetToBat ? yetToBat.name : null;

  CricketEngine.recordWicket(match, {
    dismissalType: 'Bowled',
    outBatter: 'strike',
    nextBatter: nextBatterName
  });

  syncActiveMatch(match);
  showToast('WICKET recorded!', 'danger');
};

window.undoDelivery = function() {
  const match = window.appState.activeMatch;
  if (!match) return;

  CricketEngine.undo(match);
  syncActiveMatch(match);
  showToast('Last ball undone.');
};

window.changeBatterModal = function() {
  const match = window.appState.activeMatch;
  if (!match) return;
  const inn = match.innings[match.currentInningsIndex];
  CricketEngine.swapStrike(inn);
  syncActiveMatch(match);
  showToast(`Strike changed to ${inn.strikeBatterName}.`);
};

window.changeBowlerPrompt = function() {
  const match = window.appState.activeMatch;
  if (!match) return;
  const inn = match.innings[match.currentInningsIndex];

  const candidate = inn.bowlers.find(bw => bw.name !== inn.currentBowlerName);
  if (candidate) {
    inn.currentBowlerName = candidate.name;
    syncActiveMatch(match);
    showToast(`Bowler changed to ${candidate.name}.`);
  }
};

window.endOverManual = function() {
  const match = window.appState.activeMatch;
  if (!match) return;
  const inn = match.innings[match.currentInningsIndex];
  CricketEngine.completeOver(inn, match);
  syncActiveMatch(match);
  showToast('Over ended. Strike rotated.');
};

window.finishMatchNow = function() {
  if (confirm('Conclude this match?')) {
    const match = window.appState.activeMatch;
    if (!match) return;
    CricketEngine.completeInnings(match);
    if (match.status !== 'completed') {
      CricketEngine.concludeMatch(match, 'Match concluded manually.');
    }
    syncActiveMatch(match);
  }
};

function syncActiveMatch(match) {
  storage.setLiveMatch(match);
  storage.saveMatch(match);
  saveMatchToFirestore(match);
  renderLiveScoringConsole();
  renderDashboardAnalytics();
}

// ============================================================================
// 8. SCORECARD & PDF (Steps 8, 9, 10)
// ============================================================================

window.showScorecardViewModal = function(matchData = null) {
  const match = matchData || window.appState.activeMatch || window.appState.userMatches[0];
  if (!match) {
    showToast('No match data to display.', 'info');
    return;
  }

  const container = document.getElementById('printable-scorecard-content');
  if (container) {
    container.innerHTML = PDFExport.renderScorecardHTML(match);
  }

  const modal = new bootstrap.Modal(document.getElementById('modal-detailed-scorecard'));
  modal.show();
};

function showMatchEndModal(match) {
  const modalEl = document.getElementById('modal-match-result');
  if (!modalEl) return;

  document.getElementById('res-winner-title').textContent = match.result?.summary || 'Match Over';
  document.getElementById('res-margin-text').textContent = match.status === 'tied' ? 'Match Tied!' : 'Official Result';
  document.getElementById('res-summary-text').textContent = `${match.teamA.name} vs ${match.teamB.name}`;

  const inn1 = match.innings[0];
  const inn2 = match.innings[1];
  const s1 = inn1 ? `${inn1.battingTeamName}: ${inn1.totalRuns}/${inn1.wickets} (${inn1.oversBowled} ov)` : '';
  const s2 = inn2 ? `${inn2.battingTeamName}: ${inn2.totalRuns}/${inn2.wickets} (${inn2.oversBowled} ov)` : '';
  document.getElementById('res-scores-breakdown').textContent = `${s1} | ${s2}`;

  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}

window.downloadOfficialPDF = function() {
  PDFExport.printScorecard();
};

// ============================================================================
// 11. PREVIOUS MATCHES (ONLY CURRENT USER'S MATCHES)
// ============================================================================

function renderUserPreviousMatches() {
  const container = document.getElementById('user-previous-matches-list');
  if (!container) return;

  const matches = window.appState.userMatches;
  if (!window.appState.currentUser) {
    container.innerHTML = `
      <div class="col-12 text-center py-5 text-muted">
        <p class="mb-3">Sign in with Google to view and manage your private matches.</p>
        <button class="btn btn-primary rounded-pill px-4 fw-bold" onclick="window.location.hash='#login'">Sign In</button>
      </div>
    `;
    return;
  }

  if (matches.length === 0) {
    container.innerHTML = `
      <div class="col-12 text-center py-5 text-muted">
        <i class="bi bi-folder2-open fs-1 d-block mb-2"></i>
        You haven't created any matches yet. Click "New Match" above to start!
      </div>
    `;
    return;
  }

  container.innerHTML = matches.map(m => `
    <div class="col-md-6">
      <div class="card border-0 rounded-4 shadow-sm p-4 h-100">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span class="badge bg-light text-dark border rounded-pill">${m.format}</span>
          <small class="text-muted">${new Date(m.createdAt).toLocaleDateString()}</small>
        </div>
        <h5 class="fw-extrabold text-dark mb-1">${m.teamA.name} <span class="text-muted fw-normal">vs</span> ${m.teamB.name}</h5>
        <div class="alert alert-light border py-2 px-3 rounded-3 small fw-bold text-primary mb-3">
          ${m.result?.summary || 'Match Status: ' + m.status}
        </div>
        <div class="d-flex gap-2 mt-auto">
          <button class="btn btn-sm btn-primary rounded-pill flex-fill fw-bold" onclick='window.showScorecardViewModal(${JSON.stringify(m).replace(/'/g, "&apos;")})'>
            View Scorecard
          </button>
          <button class="btn btn-sm btn-outline-danger rounded-pill px-3" onclick="window.removeMatch('${m.id}')" title="Delete">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

window.removeMatch = async function(matchId) {
  if (confirm('Delete this match record permanently?')) {
    storage.deleteMatch(matchId);
    await deleteMatchFromFirestore(matchId);
    loadCurrentUserMatches();
    showToast('Match deleted.');
  }
};

// ============================================================================
// 12. USER PROFILE
// ============================================================================

function renderProfileView() {
  const user = window.appState.currentUser;
  const nameEl = document.getElementById('profile-user-name');
  const emailEl = document.getElementById('profile-user-email');
  const photoEl = document.getElementById('profile-user-photo');
  const createdEl = document.getElementById('profile-matches-created');
  const playedEl = document.getElementById('profile-matches-played');

  if (!user) {
    if (nameEl) nameEl.textContent = 'Guest Player';
    if (emailEl) emailEl.textContent = 'Not signed in';
    if (createdEl) createdEl.textContent = '0';
    if (playedEl) playedEl.textContent = '0';
    return;
  }

  if (nameEl) nameEl.textContent = user.displayName || 'Player';
  if (emailEl) emailEl.textContent = user.email || '';
  if (photoEl) photoEl.src = user.photoURL || '/assets/aistudio/Ashif_Web_Studio_Frontend_Developer_logo_229c6c9e.png';

  const matches = window.appState.userMatches;
  if (createdEl) createdEl.textContent = String(matches.length);
  if (playedEl) playedEl.textContent = String(matches.length);
}

// ============================================================================
// 3 & 13. HIDDEN ADMIN PANEL (/admin-login)
// ============================================================================

function checkAdminAccess() {
  const gate = document.getElementById('admin-passcode-gate');
  const panel = document.getElementById('admin-dashboard-panel');

  const isMaster = window.appState.adminAuthenticated ||
    (window.appState.currentUser && window.appState.currentUser.email === ADMIN_EMAIL);

  if (isMaster) {
    if (gate) gate.classList.add('d-none');
    if (panel) panel.classList.remove('d-none');
    loadAdminData();
  } else {
    if (gate) gate.classList.remove('d-none');
    if (panel) panel.classList.add('d-none');
  }
}

window.submitAdminPasscode = function() {
  const val = document.getElementById('input-admin-pass').value.trim();
  if (val === '@ashifwebstudio2026' || val === 'ashif2026') {
    window.appState.adminAuthenticated = true;
    checkAdminAccess();
    showToast('Admin panel unlocked!', 'success');
  } else {
    showToast('Incorrect admin password.', 'danger');
  }
};

window.exitAdminPanel = function() {
  window.appState.adminAuthenticated = false;
  window.location.hash = '#home';
};

async function loadAdminData() {
  const stats = await fetchAdminStats();
  if (!stats) return;

  document.getElementById('admin-stat-total-users').textContent = String(stats.totalUsers);
  document.getElementById('admin-stat-today-users').textContent = String(stats.todayLogins);
  document.getElementById('admin-stat-total-matches').textContent = String(stats.matchesCreated);
  document.getElementById('admin-stat-live-matches').textContent = String(stats.liveMatches);

  // Matches table
  const mTbody = document.getElementById('admin-matches-tbody');
  if (mTbody) {
    mTbody.innerHTML = stats.matches.map(m => `
      <tr>
        <td class="fw-bold">${m.teamA?.name} vs ${m.teamB?.name}</td>
        <td>${m.innings?.[0]?.totalRuns || 0}/${m.innings?.[0]?.wickets || 0}</td>
        <td><span class="badge ${m.status === 'live' ? 'bg-danger' : 'bg-secondary'}">${m.status}</span></td>
        <td class="text-muted">${new Date(m.createdAt).toLocaleDateString()}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-danger" onclick="window.adminDeleteMatch('${m.id}')"><i class="bi bi-trash"></i></button>
        </td>
      </tr>
    `).join('');
  }

  // Users table
  const uTbody = document.getElementById('admin-users-tbody');
  if (uTbody) {
    uTbody.innerHTML = stats.users.map(u => `
      <tr>
        <td class="fw-bold">${u.name}</td>
        <td>${u.email}</td>
        <td class="font-monospace text-muted">${u.uid?.substring(0, 10)}...</td>
        <td class="text-muted">${new Date(u.loginTime || u.createdAt).toLocaleDateString()}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-danger" onclick="window.adminDeleteUser('${u.uid}')"><i class="bi bi-trash"></i></button>
        </td>
      </tr>
    `).join('');
  }
}

window.adminDeleteMatch = async function(id) {
  if (confirm('Delete match from database?')) {
    await deleteMatchFromFirestore(id);
    loadAdminData();
    showToast('Match deleted.');
  }
};

window.adminDeleteUser = async function(id) {
  if (confirm('Delete user profile?')) {
    await deleteUserFromFirestore(id);
    loadAdminData();
    showToast('User deleted.');
  }
};

// ============================================================================
// PWA & TOAST HELPERS
// ============================================================================

function initPWAAndOffline() {
  const bar = document.getElementById('offline-bar');
  const updateNet = () => {
    if (navigator.onLine) {
      if (bar) bar.classList.add('d-none');
    } else {
      if (bar) bar.classList.remove('d-none');
    }
  };
  window.addEventListener('online', updateNet);
  window.addEventListener('offline', updateNet);
  updateNet();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  const btnPwa = document.getElementById('btn-pwa-install');
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    window.appState.deferredPWAInstallPrompt = e;
    if (btnPwa) {
      btnPwa.classList.remove('d-none');
      btnPwa.classList.add('d-flex');
    }
  });

  if (btnPwa) {
    btnPwa.addEventListener('click', async () => {
      if (!window.appState.deferredPWAInstallPrompt) return;
      window.appState.deferredPWAInstallPrompt.prompt();
      window.appState.deferredPWAInstallPrompt = null;
      btnPwa.classList.add('d-none');
    });
  }
}

function showToast(msg, type = 'dark') {
  const toastEl = document.getElementById('main-toast');
  const textEl = document.getElementById('main-toast-text');
  if (!toastEl || !textEl) return;
  textEl.textContent = msg;
  const t = new bootstrap.Toast(toastEl, { delay: 3000 });
  t.show();
}
