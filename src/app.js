/**
 * Application Controller (Production Grade)
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
import { PDFExport } from './pdf-export.js';

// Modular Cricket Architecture (Points 20 & 21)
import { MatchEngine } from './matchEngine.js';
import { ScoreEngine } from './scoreEngine.js';
import { StrikeManager } from './strikeManager.js';
import { BowlingManager } from './bowlingManager.js';
import { BattingManager } from './battingManager.js';
import { PlayingXISystem } from './playingXI.js';
import { HistoryManager } from './historyManager.js';
import { UndoManager } from './undoManager.js';
import { SuperOverManager } from './superOver.js';
import { FirebaseService } from './firebaseService.js';
import { OfflineStorage } from './offlineStorage.js';
import { Validation } from './validation.js';
import { StatsCalculator } from './stats.js';
import { UIController } from './uiController.js';

// Global Application State
window.appState = {
  currentUser: null,
  activeMatch: null,
  userMatches: [],
  createStep: 1,
  matchDraft: {
    team1: { name: 'Thunder Strikers', players: [], captain: '', viceCaptain: '', wicketKeeper: '' },
    team2: { name: 'Royal Challengers', players: [], captain: '', viceCaptain: '', wicketKeeper: '' },
    overs: 20,
    toss: { winner: '1', decision: 'BAT', outcome: 'Heads' }
  },
  adminAuthenticated: false,
  deferredPWAInstallPrompt: null
};

// ============================================================================
// 1. BOOTSTRAP & SPLASH (Exactly 3 seconds)
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('[App] Initializing Gully Cricket Scorer (Professional Architecture)...');

  // Point 7: Auto-recovery from local storage on browser refresh / restart
  const recoveredMatch = OfflineStorage.getLiveMatch() || storage.getLiveMatch();
  if (recoveredMatch) {
    window.appState.activeMatch = recoveredMatch;
    console.log('[App] Match successfully recovered on load:', recoveredMatch.id);
  }

  // Auth observer
  initAuthObserver();

  // Router
  initRouter();

  // PWA & Offline listeners
  initPWAAndOffline();

  // Initialize Default Squad Inputs (11 players per team)
  initDefaultSquadInputs();

  // Splash Screen timer (3 seconds)
  runSplashScreen();
});

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
// 2. AUTHENTICATION OBSERVER
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

  initAuthListener((user) => {
    if (user) {
      window.appState.currentUser = user;
      OfflineStorage.setCachedUser({
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

      loadCurrentUserMatches();
      renderProfileView();
    } else {
      window.appState.currentUser = null;
      OfflineStorage.setCachedUser(null);
      window.appState.userMatches = [];

      if (btnHeaderLogin) btnHeaderLogin.classList.remove('d-none');
      if (userBadge) userBadge.classList.add('d-none');

      renderDashboardAnalytics();
      renderUserPreviousMatches();
    }
  });

  let isAuthInProgress = false;

  const setLoginLoading = (loading) => {
    isAuthInProgress = loading;
    if (btnMainLogin) {
      btnMainLogin.disabled = loading;
      if (loading) {
        btnMainLogin.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Connecting to Google...';
      } else {
        btnMainLogin.innerHTML = '<i class="bi bi-google fs-5"></i> Continue with Google';
      }
    }
    if (btnHeaderLogin) {
      btnHeaderLogin.disabled = loading;
    }
  };

  const triggerGoogleLogin = async () => {
    if (isAuthInProgress) return;
    setLoginLoading(true);

    const alertBox = document.getElementById('login-popup-blocked-alert');
    if (alertBox) alertBox.classList.add('d-none');
    const domainAlert = document.getElementById('login-unauthorized-domain-alert');
    if (domainAlert) domainAlert.classList.add('d-none');

    try {
      const user = await loginWithGoogle();
      if (user) {
        showToast('Signed in successfully!', 'success');
        window.location.hash = '#home';
      }
    } catch (e) {
      const code = e?.code || '';
      if (code === 'auth/popup-blocked') {
        if (alertBox) {
          alertBox.classList.remove('d-none');
          const newTabBtn = document.getElementById('btn-open-new-tab-login');
          if (newTabBtn) newTabBtn.href = window.location.href;
        }
        showToast('Pop-up blocked by browser. Please allow popups or open in a new tab.', 'warning');
      } else if (code === 'auth/unauthorized-domain') {
        if (domainAlert) {
          domainAlert.classList.remove('d-none');
          const display = document.getElementById('unauthorized-domain-display');
          if (display) display.value = window.location.hostname;
        }
        showToast(`Domain not authorized: ${window.location.hostname}. Please add it to Firebase Console.`, 'danger');
      } else if (code === 'auth/popup-closed-by-user') {
        showToast('Sign-in popup was closed.', 'info');
      } else if (code === 'auth/cancelled-popup-request') {
        console.warn('[Auth] Debounced duplicate popup request.');
      } else {
        showToast('Sign-in cancelled or failed: ' + (e.message || e), 'danger');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  window.triggerGoogleLogin = triggerGoogleLogin;
  window.retryGoogleLogin = triggerGoogleLogin;

  window.copyCurrentDomain = function() {
    const domain = window.location.hostname;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(domain).then(() => {
        showToast('Copied: ' + domain, 'success');
      }).catch(() => {
        showToast('Domain: ' + domain, 'info');
      });
    } else {
      showToast('Domain: ' + domain, 'info');
    }
  };

  window.loginAsDevPreview = function() {
    const devUser = {
      uid: 'dev-ashif-uid',
      displayName: 'Mohammad Ashif',
      email: 'mohdashif.dev@gmail.com',
      photoURL: '/assets/aistudio/Ashif_Web_Studio_Frontend_Developer_logo_229c6c9e.png',
      isDevPreview: true
    };
    window.appState.currentUser = devUser;
    OfflineStorage.setCachedUser(devUser);

    const btnHeaderLogin = document.getElementById('btn-header-login');
    const userBadge = document.getElementById('header-user-badge');
    const userAvatar = document.getElementById('header-user-avatar');
    const menuName = document.getElementById('menu-user-name');
    const menuEmail = document.getElementById('menu-user-email');

    if (btnHeaderLogin) btnHeaderLogin.classList.add('d-none');
    if (userBadge) userBadge.classList.remove('d-none');
    if (userAvatar) userAvatar.src = devUser.photoURL;
    if (menuName) menuName.textContent = devUser.displayName;
    if (menuEmail) menuEmail.textContent = devUser.email;

    loadCurrentUserMatches();
    renderProfileView();
    showToast('Signed in as Mohammad Ashif (Preview Mode)', 'success');
    window.location.hash = '#home';
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
    if (window.location.pathname.endsWith('/admin-login') && window.location.hash !== '#admin-login') {
      window.location.hash = '#admin-login';
      return;
    }
    let hash = window.location.hash || '#home';
    if (hash === '' || hash === '#') hash = '#home';

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

    if (hash === '#home') {
      renderDashboardAnalytics();
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
// 4. HOME PAGE & DASHBOARD ANALYTICS
// ============================================================================

function renderDashboardAnalytics() {
  const userMatches = window.appState.userMatches;
  const liveMatch = window.appState.activeMatch;

  const usersCount = Math.max(1, (window.appState.currentUser ? 1 : 0) + (storage.getAllMatches().length > 0 ? 3 : 1));
  const elUsers = document.getElementById('stat-total-users');
  if (elUsers) elUsers.textContent = String(usersCount);

  const elMatches = document.getElementById('stat-total-matches');
  if (elMatches) elMatches.textContent = String(userMatches.length);

  const isLive = liveMatch && (liveMatch.status === 'live' || liveMatch.status === 'super_over');
  const elLive = document.getElementById('stat-live-match');
  if (elLive) elLive.textContent = isLive ? '1' : '0';

  if (liveMatch) {
    const inn = liveMatch.status === 'super_over' ?
      liveMatch.superOver?.innings[liveMatch.superOver?.currentInningsIndex] :
      liveMatch.innings[liveMatch.currentInningsIndex];
    if (inn) UIController.syncHomepageLiveCard(liveMatch, inn);
  }
}

// ============================================================================
// 6. CREATE MATCH & PLAYING XI (Points 1 & 2 in Prompt)
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
  if (!container) return;

  container.innerHTML = '';
  defaultNames.forEach((name, idx) => {
    const row = document.createElement('div');
    row.className = 'input-group input-group-sm mb-2';
    row.innerHTML = `
      <span class="input-group-text bg-white border text-muted" style="width: 32px;">${idx + 1}</span>
      <input type="text" class="form-control squad-player-input" data-team="${teamNum}" value="${name}" placeholder="Player ${idx + 1} Name" oninput="window.updateRoleOptions('${teamNum}')" />
      <button type="button" class="btn btn-outline-danger btn-sm" onclick="this.parentElement.remove(); window.updateRoleOptions('${teamNum}');">
        <i class="bi bi-x"></i>
      </button>
    `;
    container.appendChild(row);
  });

  window.updateRoleOptions(teamNum);
}

window.addPlayerRowToTeam = function(teamNum) {
  const container = document.getElementById(`team-${teamNum}-players-container`);
  if (!container) return;
  const count = container.querySelectorAll('.squad-player-input').length + 1;
  const row = document.createElement('div');
  row.className = 'input-group input-group-sm mb-2';
  row.innerHTML = `
    <span class="input-group-text bg-white border text-muted" style="width: 32px;">${count}</span>
    <input type="text" class="form-control squad-player-input" data-team="${teamNum}" value="Player ${count}" placeholder="Player ${count} Name" oninput="window.updateRoleOptions('${teamNum}')" />
    <button type="button" class="btn btn-outline-danger btn-sm" onclick="this.parentElement.remove(); window.updateRoleOptions('${teamNum}');">
      <i class="bi bi-x"></i>
    </button>
  `;
  container.appendChild(row);
  window.updateRoleOptions(teamNum);
};

window.updateRoleOptions = function(teamNum) {
  const inputs = document.querySelectorAll(`.squad-player-input[data-team="${teamNum}"]`);
  const captainSelect = document.getElementById(`select-team-${teamNum}-captain`);
  const vcSelect = document.getElementById(`select-team-${teamNum}-vc`);
  const keeperSelect = document.getElementById(`select-team-${teamNum}-keeper`);

  const populate = (sel, defaultIdx) => {
    if (!sel) return;
    const currentVal = sel.value;
    sel.innerHTML = '';
    inputs.forEach((inp, idx) => {
      const name = inp.value.trim() || `Player ${idx + 1}`;
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      if (name === currentVal || (!currentVal && idx === defaultIdx)) opt.selected = true;
      sel.appendChild(opt);
    });
  };

  populate(captainSelect, 0);
  populate(vcSelect, 1);
  populate(keeperSelect, 2);
};

window.updateCaptainOptions = window.updateRoleOptions;

window.gotoCreateStep = function(stepNum) {
  window.appState.createStep = stepNum;

  // Step 1 validation
  if (stepNum === 2) {
    const name1 = document.getElementById('input-team-1-name').value.trim() || 'Thunder Strikers';
    const players1 = Array.from(document.querySelectorAll('.squad-player-input[data-team="1"]'))
      .map(i => ({ name: i.value.trim() || 'Player' }));
    const captain1 = document.getElementById('select-team-1-captain')?.value || players1[0]?.name;
    const vc1 = document.getElementById('select-team-1-vc')?.value || players1[1]?.name;
    const keeper1 = document.getElementById('select-team-1-keeper')?.value || players1[2]?.name;

    const val = Validation.validateSquad(players1, name1);
    if (!val.valid) {
      showToast(val.errors[0], 'danger');
      return;
    }

    window.appState.matchDraft.team1 = {
      name: name1,
      players: players1,
      captain: captain1,
      viceCaptain: vc1,
      wicketKeeper: keeper1
    };
  }

  // Step 2 validation
  if (stepNum === 3) {
    const name2 = document.getElementById('input-team-2-name').value.trim() || 'Royal Challengers';
    const players2 = Array.from(document.querySelectorAll('.squad-player-input[data-team="2"]'))
      .map(i => ({ name: i.value.trim() || 'Player' }));
    const captain2 = document.getElementById('select-team-2-captain')?.value || players2[0]?.name;
    const vc2 = document.getElementById('select-team-2-vc')?.value || players2[1]?.name;
    const keeper2 = document.getElementById('select-team-2-keeper')?.value || players2[2]?.name;
    const overs = Number(document.getElementById('select-match-overs').value) || 20;

    const val = Validation.validateSquad(players2, name2);
    if (!val.valid) {
      showToast(val.errors[0], 'danger');
      return;
    }

    window.appState.matchDraft.team2 = {
      name: name2,
      players: players2,
      captain: captain2,
      viceCaptain: vc2,
      wicketKeeper: keeper2
    };
    window.appState.matchDraft.overs = overs;

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

// ============================================================================
// 1. TOSS SYSTEM (Fixed: True 50/50, Heads & Tails, Animates Properly)
// ============================================================================

window.executeCoinFlip = function() {
  const coin = document.getElementById('toss-coin');
  const btn = document.getElementById('btn-do-flip');
  const statusEl = document.getElementById('toss-call-status');
  const outcomeBox = document.getElementById('toss-outcome-box');
  const winnerBadge = document.getElementById('toss-winner-badge');

  const callerChoice = document.getElementById('select-toss-caller').value;
  const call = document.getElementById('select-toss-call-choice').value;
  const team1Name = window.appState.matchDraft.team1.name;
  const team2Name = window.appState.matchDraft.team2.name;

  btn.disabled = true;
  statusEl.textContent = 'Flipping coin in 3D...';

  // Point 1: Execute true 50/50 toss using MatchEngine
  const tossResult = MatchEngine.executeToss(callerChoice, call, team1Name, team2Name);

  coin.className = 'toss-coin-box mx-auto';
  void coin.offsetWidth;

  if (tossResult.outcome === 'Heads') {
    coin.classList.add('animating-heads');
  } else {
    coin.classList.add('animating-tails');
  }

  setTimeout(() => {
    coin.classList.remove('animating-heads', 'animating-tails');
    coin.classList.add(tossResult.outcome === 'Heads' ? 'landed-heads' : 'landed-tails');

    statusEl.innerHTML = `Landed on: <strong class="text-primary">${tossResult.outcome.toUpperCase()}</strong>!`;
    winnerBadge.innerHTML = `<strong>${tossResult.winningTeamName}</strong> won the toss!`;
    outcomeBox.classList.remove('d-none');
    btn.disabled = false;

    window.appState.matchDraft.toss.winner = tossResult.winningTeamNumber;
    window.appState.matchDraft.toss.outcome = tossResult.outcome;
  }, 1600);
};

// ============================================================================
// 6. LAUNCH MATCH
// ============================================================================

window.launchMatch = async function() {
  const draft = window.appState.matchDraft;
  const decision = document.querySelector('input[name="tossDecision"]:checked')?.value || 'BAT';
  draft.toss.decision = decision;

  // Mark previous live match completed
  const prevLive = window.appState.activeMatch;
  if (prevLive && prevLive.status === 'live') {
    prevLive.status = 'completed';
    prevLive.result = { summary: 'Completed (New match started)' };
    OfflineStorage.archiveMatch(prevLive);
    await FirebaseService.saveMatchRealtime(prevLive, true);
  }

  // Create official match instance using MatchEngine
  const newMatch = MatchEngine.createNewMatch({
    format: draft.overs === 999 ? 'Test Match' : 'Limited Overs',
    overs: draft.overs,
    venue: 'Gully Turf Arena',
    team1: draft.team1,
    team2: draft.team2,
    toss: draft.toss
  });

  const uid = window.appState.currentUser ? window.appState.currentUser.uid : 'local_player';
  newMatch.ownerUID = uid;
  newMatch.userId = uid;

  window.appState.activeMatch = newMatch;
  OfflineStorage.saveLiveMatch(newMatch);
  storage.saveMatch(newMatch);
  await FirebaseService.saveMatchRealtime(newMatch, true);

  loadCurrentUserMatches();
  showToast('Match started! Ball 0.1 ready.', 'success');
  window.location.hash = '#live-score';
};

// ============================================================================
// 7. LIVE SCORING CONSOLE (Points 3, 4, 5, 8, 14, 18)
// ============================================================================

function renderLiveScoringConsole() {
  const match = window.appState.activeMatch;
  const noMatchEl = document.getElementById('live-no-match');
  const consoleEl = document.getElementById('live-scoring-console');

  if (!match || (match.status !== 'live' && match.status !== 'super_over')) {
    if (noMatchEl) noMatchEl.classList.remove('d-none');
    if (consoleEl) consoleEl.classList.add('d-none');
    return;
  }

  if (noMatchEl) noMatchEl.classList.add('d-none');
  if (consoleEl) consoleEl.classList.remove('d-none');

  UIController.updateLiveScoreboard(match);

  // Check if match concluded or tied
  if (match.status === 'completed') {
    showMatchEndModal(match);
  } else if (match.status === 'tied') {
    showTieMatchModal(match);
  }
}

// Scored standard delivery
window.scoreBall = function(runs) {
  const match = window.appState.activeMatch;
  if (!match || (match.status !== 'live' && match.status !== 'super_over')) return;

  const result = ScoreEngine.scoreRuns(match, runs);
  if (!result.success) {
    showToast(result.reason || 'Scoring restricted.', 'warning');
    return;
  }

  syncAndPersistMatch(match);

  if (result.isOverFinished) {
    showToast('Over completed! Strike rotated automatically.', 'info');
    window.changeBowlerPrompt();
  }
};

// Scored Extra delivery
window.scoreExtra = function(type) {
  const match = window.appState.activeMatch;
  if (!match || (match.status !== 'live' && match.status !== 'super_over')) return;

  const result = ScoreEngine.scoreExtra(match, type, 0);
  if (!result.success) {
    showToast(result.reason || 'Scoring restricted.', 'warning');
    return;
  }

  syncAndPersistMatch(match);

  if (result.isOverFinished) {
    showToast('Over completed! Strike rotated automatically.', 'info');
    window.changeBowlerPrompt();
  }
};

// Open interactive wicket dismissal dialog
window.scoreWicket = function() {
  const match = window.appState.activeMatch;
  if (!match || (match.status !== 'live' && match.status !== 'super_over')) return;

  const inn = ScoreEngine.getActiveInnings(match);
  if (!inn) return;

  // Populate dialog with current striker and non-striker names
  const strikerLabel = document.getElementById('label-out-striker');
  const nonStrikerLabel = document.getElementById('label-out-nonstriker');
  if (strikerLabel) strikerLabel.textContent = `${inn.strikeBatterName} (Striker)`;
  if (nonStrikerLabel) nonStrikerLabel.textContent = `${inn.nonStrikeBatterName} (Non-Striker)`;

  // Populate next batsman from Playing XI yet_to_bat
  const nextSelect = document.getElementById('wicket-next-batter-select');
  if (nextSelect) {
    nextSelect.innerHTML = '';
    const available = BattingManager.getAvailableBatsmen(inn);
    if (available.length === 0) {
      nextSelect.innerHTML = '<option value="">No more batsmen (All Out next)</option>';
    } else {
      available.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.name;
        opt.textContent = `${b.name} ${b.isCaptain ? '(c)' : ''} ${b.isKeeper ? '(wk)' : ''}`;
        nextSelect.appendChild(opt);
      });
    }
  }

  const modal = new bootstrap.Modal(document.getElementById('modal-wicket-details'));
  modal.show();
};

window.submitWicketFromModal = function() {
  const match = window.appState.activeMatch;
  if (!match) return;

  const modalEl = document.getElementById('modal-wicket-details');
  const modal = bootstrap.Modal.getInstance(modalEl);
  if (modal) modal.hide();

  const outPos = document.querySelector('input[name="wicketOutBatter"]:checked')?.value || 'strike';
  const dismissalType = document.getElementById('wicket-dismissal-type')?.value || 'Bowled';
  const nextBatter = document.getElementById('wicket-next-batter-select')?.value || null;

  const res = ScoreEngine.scoreWicket(match, {
    dismissalType,
    outPosition: outPos,
    nextBatter
  });

  syncAndPersistMatch(match);
  showToast(`WICKET (${dismissalType}) recorded!`, 'danger');

  if (res.isAllOut) {
    showToast('ALL OUT! Innings concluded.', 'warning');
  } else if (res.isOverFinished) {
    window.changeBowlerPrompt();
  }
};

// Point 14: Unlimited Undo
window.undoDelivery = function() {
  const match = window.appState.activeMatch;
  if (!match) return;

  const res = UndoManager.undo(match);
  if (res.success) {
    syncAndPersistMatch(match);
    showToast('Last delivery undone.');
  } else {
    showToast('No more deliveries to undo.', 'info');
  }
};

// Change batter / swap ends
window.changeBatterModal = function() {
  const match = window.appState.activeMatch;
  if (!match) return;
  const inn = ScoreEngine.getActiveInnings(match);
  if (!inn) return;

  document.getElementById('modal-swap-striker-name').textContent = inn.strikeBatterName;
  document.getElementById('modal-swap-nonstriker-name').textContent = inn.nonStrikeBatterName;

  const modal = new bootstrap.Modal(document.getElementById('modal-change-batter'));
  modal.show();
};

window.confirmSwapStrike = function() {
  const match = window.appState.activeMatch;
  if (!match) return;
  const inn = ScoreEngine.getActiveInnings(match);
  StrikeManager.swapStrike(inn);
  syncAndPersistMatch(match);

  const modalEl = document.getElementById('modal-change-batter');
  const modal = bootstrap.Modal.getInstance(modalEl);
  if (modal) modal.hide();

  showToast(`Strike swapped: ${inn.strikeBatterName} is now on strike.`);
};

// Point 4: Bowler selection with consecutive overs restriction check
window.changeBowlerPrompt = function() {
  const match = window.appState.activeMatch;
  if (!match) return;
  const inn = ScoreEngine.getActiveInnings(match);
  if (!inn) return;

  const list = document.getElementById('bowler-select-list');
  if (!list) return;

  const eligible = BowlingManager.getEligibleBowlers(inn);
  list.innerHTML = eligible.map(b => `
    <button type="button" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center py-3 ${!b.canBowl ? 'disabled text-muted bg-light' : ''}" onclick="window.selectBowler('${b.name}')">
      <div>
        <strong class="d-block">${b.name} ${b.name === inn.currentBowlerName ? '<span class="badge bg-primary ms-1">Current</span>' : ''}</strong>
        <small class="${!b.canBowl ? 'text-danger fw-bold' : 'text-muted'}">${b.reason}</small>
      </div>
      <div class="text-end small">
        <span class="tabular-nums fw-bold">${b.wickets}/${b.runs}</span> (${b.overs} ov)
      </div>
    </button>
  `).join('');

  const modal = new bootstrap.Modal(document.getElementById('modal-bowler-select'));
  modal.show();
};

window.selectBowler = function(name) {
  const match = window.appState.activeMatch;
  if (!match) return;
  const inn = ScoreEngine.getActiveInnings(match);

  const res = BowlingManager.setBowlerForNewOver(inn, name);
  if (!res.success) {
    showToast(res.message, 'danger');
    return;
  }

  syncAndPersistMatch(match);

  const modalEl = document.getElementById('modal-bowler-select');
  const modal = bootstrap.Modal.getInstance(modalEl);
  if (modal) modal.hide();

  showToast(`Bowler set to ${name} for next over.`);
};

// End Over button
window.endOverManual = function() {
  const match = window.appState.activeMatch;
  if (!match) return;
  const inn = ScoreEngine.getActiveInnings(match);

  ScoreEngine.handleEndOfOver(inn, match);
  syncAndPersistMatch(match);
  showToast('Over concluded manually. Please pick the next bowler.');
  window.changeBowlerPrompt();
};

// Finish Match Now
window.finishMatchNow = function() {
  if (confirm('Conclude this match now and compute final results?')) {
    const match = window.appState.activeMatch;
    if (!match) return;
    ScoreEngine.completeInnings(match);
    if (match.status !== 'completed' && match.status !== 'tied') {
      MatchEngine.concludeMatch(match, 'Match concluded manually.');
    }
    syncAndPersistMatch(match);
  }
};

// ============================================================================
// 15. RESTART OPTIONS CONTROLLER (Point 15 in Prompt)
// ============================================================================

window.openMatchControlsModal = function() {
  const modal = new bootstrap.Modal(document.getElementById('modal-match-controls'));
  modal.show();
};

window.confirmRestartBall = function() {
  window.undoDelivery();
  const modal = bootstrap.Modal.getInstance(document.getElementById('modal-match-controls'));
  if (modal) modal.hide();
};

window.confirmRestartOver = function() {
  if (confirm('Are you sure you want to restart this current over back to ball 0?')) {
    const match = window.appState.activeMatch;
    const res = MatchEngine.restartCurrentOver(match);
    if (res.success) {
      syncAndPersistMatch(match);
      showToast(res.message, 'warning');
    } else {
      showToast(res.message, 'info');
    }
    const modal = bootstrap.Modal.getInstance(document.getElementById('modal-match-controls'));
    if (modal) modal.hide();
  }
};

window.confirmRestartInnings = function() {
  if (confirm('WARNING: Restart this entire innings back to 0 runs, 0 wickets?')) {
    const match = window.appState.activeMatch;
    const res = MatchEngine.restartCurrentInnings(match);
    syncAndPersistMatch(match);
    showToast(res.message, 'danger');
    const modal = bootstrap.Modal.getInstance(document.getElementById('modal-match-controls'));
    if (modal) modal.hide();
  }
};

window.confirmRestartEntireMatch = function() {
  if (confirm('CRITICAL ACTION: Reset the entire match from ball one? (Toss winner is preserved)')) {
    const match = window.appState.activeMatch;
    const res = MatchEngine.restartEntireMatch(match);
    syncAndPersistMatch(match);
    showToast(res.message, 'danger');
    const modal = bootstrap.Modal.getInstance(document.getElementById('modal-match-controls'));
    if (modal) modal.hide();
  }
};

// ============================================================================
// 12 & 13. TIE MATCH & SUPER OVER (Points 12 & 13 in Prompt)
// ============================================================================

function showTieMatchModal(match) {
  const modalEl = document.getElementById('modal-tie-match');
  if (!modalEl) return;
  const inn1 = match.innings[0];
  const summaryEl = document.getElementById('tie-match-summary-text');
  if (summaryEl && inn1) {
    summaryEl.textContent = `Both teams tied with exactly ${inn1.totalRuns} runs! Choose an action below:`;
  }
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}

window.launchSuperOverFromModal = function() {
  const match = window.appState.activeMatch;
  if (!match) return;

  const modalEl = document.getElementById('modal-tie-match');
  const modal = bootstrap.Modal.getInstance(modalEl);
  if (modal) modal.hide();

  SuperOverManager.startSuperOver(match, '2');
  syncAndPersistMatch(match);
  showToast('SUPER OVER STARTED! 1 Over, 2 Wickets shootout!', 'warning');
};

window.concludeTieMatchFromModal = function() {
  const match = window.appState.activeMatch;
  if (!match) return;

  const modalEl = document.getElementById('modal-tie-match');
  const modal = bootstrap.Modal.getInstance(modalEl);
  if (modal) modal.hide();

  match.status = 'completed';
  match.result = {
    winner: 'TIE',
    summary: 'Match Finished as an Official Tie!'
  };
  syncAndPersistMatch(match);
  showMatchEndModal(match);
};

// ============================================================================
// 9 & 10. OVER HISTORY & SCORECARD BROWSER (Points 9 & 10)
// ============================================================================

window.openOverHistoryModal = function() {
  const match = window.appState.activeMatch;
  if (!match) return;
  const inn = ScoreEngine.getActiveInnings(match);
  UIController.renderOverHistoryModal(inn);
  const modal = new bootstrap.Modal(document.getElementById('modal-over-history'));
  modal.show();
};

window.showScorecardViewModal = function(matchData = null) {
  const match = matchData || window.appState.activeMatch || window.appState.userMatches[0];
  if (!match) {
    showToast('No match data to display.', 'info');
    return;
  }
  UIController.renderScorecardModal(match);
  const modal = new bootstrap.Modal(document.getElementById('modal-detailed-scorecard'));
  modal.show();
};

window.downloadOfficialPDF = function() {
  PDFExport.printScorecard();
};

function showMatchEndModal(match) {
  const modalEl = document.getElementById('modal-match-result');
  if (!modalEl) return;

  document.getElementById('res-winner-title').textContent = match.result?.summary || 'Match Over';
  document.getElementById('res-margin-text').textContent = match.result?.winner === 'TIE' ? 'Match Tied!' : 'Official Match Result';
  document.getElementById('res-summary-text').textContent = `${match.teamA.name} vs ${match.teamB.name}`;

  const inn1 = match.innings[0];
  const inn2 = match.innings[1];
  const s1 = inn1 ? `${inn1.battingTeamName}: ${inn1.totalRuns}/${inn1.wickets} (${inn1.oversBowled} ov)` : '';
  const s2 = inn2 ? `${inn2.battingTeamName}: ${inn2.totalRuns}/${inn2.wickets} (${inn2.oversBowled} ov)` : '';
  document.getElementById('res-scores-breakdown').textContent = `${s1} | ${s2}`;

  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}

// ============================================================================
// 6. SYNCHRONIZATION HELPER (Saves every ball to Local & Firestore)
// ============================================================================

function syncAndPersistMatch(match) {
  // Local instant persistence (survives refresh)
  OfflineStorage.saveLiveMatch(match);
  OfflineStorage.archiveMatch(match);
  storage.saveMatch(match);

  // Firestore debounced write after every ball
  FirebaseService.saveMatchRealtime(match);

  // UI Re-render
  UIController.updateLiveScoreboard(match);
  renderDashboardAnalytics();
}

// ============================================================================
// 11. PREVIOUS MATCHES VIEW
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
        You haven't created any matches yet. Click "Create Match" to start!
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
        <h5 class="fw-extrabold text-dark mb-1">${m.teamA?.name} <span class="text-muted fw-normal">vs</span> ${m.teamB?.name}</h5>
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
// 13. HIDDEN ADMIN PANEL (/admin-login)
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
// PWA, OFFLINE & TOAST HELPERS
// ============================================================================

function initPWAAndOffline() {
  const bar = document.getElementById('offline-bar');
  const updateNet = () => {
    if (navigator.onLine) {
      if (bar) bar.classList.add('d-none');
      // Auto-sync when reconnecting
      if (window.appState.activeMatch) {
        FirebaseService.saveMatchRealtime(window.appState.activeMatch, true);
      }
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
