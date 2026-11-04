/**
 * Main Application Controller
 * Gully Cricket Scorer
 * Designed & Developed by Ashif Web Studio
 * Developer: Mohammad Ashif (mohdashif.dev@gmail.com)
 * Website: https://ashif-web-studio.vercel.app
 */

import {
  auth,
  loginWithGoogle,
  logoutUser,
  saveMatchToFirestore,
  fetchMatchesFromFirestore,
  deleteMatchFromFirestore,
  fetchAdminStats,
  deleteUserFromFirestore,
  testFirebaseConnection,
  ADMIN_EMAIL
} from './firebase.js';

import { storage } from './storage.js';
import { CricketEngine } from './cricket-engine.js';
import { CricketCharts } from './charts.js';
import { PDFExport } from './pdf-export.js';

// Global App State
window.appState = {
  currentUser: null,
  activeMatch: null,
  allMatches: [],
  wizardStep: 1,
  wizardData: {
    format: 'Limited Overs',
    playerCount: 11,
    overs: 20,
    venue: 'Gully Arena',
    ballType: 'Tennis (Heavy)',
    teamA: { name: 'Thunder Strikers', players: [] },
    teamB: { name: 'Royal Challengers', players: [] },
    toss: { winner: 'A', decision: 'BAT' }
  },
  adminLoggedIn: false,
  deferredPWAInstallPrompt: null
};

// ============================================================================
// 1. INITIALIZATION & SPLASH SCREEN
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[App] Initializing Gully Cricket Scorer...');

  // Initialize theme
  initTheme();

  // Test Firebase connection
  testFirebaseConnection();

  // Load saved matches and active match from LocalStorage
  loadLocalData();

  // Initialize Auth state observer
  initAuth();

  // Initialize Hash Navigation Router
  initRouter();

  // Initialize PWA and Offline listeners
  initPWAAndOffline();

  // Initialize Wizard default squad rows
  generateSquadInputs(11);

  // Setup Splash Screen (3-second countdown)
  initSplashScreen();

  // Sync matches with Firestore
  syncWithCloud();
});

/**
 * 3-Second Splash Screen Transition
 */
function initSplashScreen() {
  const splash = document.getElementById('splash-screen');
  const counter = document.getElementById('splash-counter');
  const btnSkip = document.getElementById('btn-skip-splash');

  if (!splash) return;

  let seconds = 3;
  const interval = setInterval(() => {
    seconds -= 1;
    if (counter) counter.textContent = String(seconds);
    if (seconds <= 0) {
      clearInterval(interval);
      hideSplash();
    }
  }, 1000);

  const hideSplash = () => {
    clearInterval(interval);
    splash.classList.add('hidden');
    setTimeout(() => {
      splash.style.display = 'none';
    }, 600);
  };

  if (btnSkip) {
    btnSkip.addEventListener('click', hideSplash);
  }
}

/**
 * Dark / Light Theme Handler
 */
function initTheme() {
  const savedTheme = storage.getTheme();
  applyTheme(savedTheme);

  const btnToggle = document.getElementById('btn-theme-toggle');
  if (btnToggle) {
    btnToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      storage.setTheme(next);
    });
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.body.className = theme === 'dark' ? 'theme-dark' : 'theme-light';
  const icon = document.querySelector('.theme-icon');
  if (icon) {
    icon.className = theme === 'dark' ? 'bi bi-sun-fill theme-icon text-warning' : 'bi bi-moon-stars-fill theme-icon';
  }
}

/**
 * Load Initial Offline Data
 */
function loadLocalData() {
  const savedMatch = storage.getLiveMatch();
  if (savedMatch) {
    window.appState.activeMatch = savedMatch;
    console.log('[App] Restored active live match:', savedMatch.id);
  }

  window.appState.allMatches = storage.getAllMatches();
  renderHomeStats();
  renderRecentMatches();
  renderHistoryList();
  renderLeaderboards();
  renderPointsTable();
}

/**
 * Sync Cloud Firestore data
 */
async function syncWithCloud() {
  try {
    const cloudMatches = await fetchMatchesFromFirestore(30);
    if (cloudMatches && cloudMatches.length > 0) {
      // Merge unique matches
      const existing = storage.getAllMatches();
      const map = new Map();
      existing.forEach(m => map.set(m.id, m));
      cloudMatches.forEach(m => map.set(m.id, m));
      const merged = Array.from(map.values()).sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
      window.appState.allMatches = merged;
      localStorage.setItem('gully_cricket_matches_archive_v1', JSON.stringify(merged));

      renderHomeStats();
      renderRecentMatches();
      renderHistoryList();
      renderLeaderboards();
    }
  } catch (e) {
    console.log('[Cloud Sync] Offline or cloud fetch skipped.');
  }
}

// ============================================================================
// 2. FIREBASE AUTH & USER PROFILE
// ============================================================================

function initAuth() {
  const btnLogin = document.getElementById('btn-login');
  const btnLogout = document.getElementById('btn-logout');
  const userMenu = document.getElementById('user-profile-menu');
  const userAvatar = document.getElementById('user-avatar');
  const userName = document.getElementById('user-display-name');
  const userEmail = document.getElementById('user-display-email');

  auth.onAuthStateChanged(user => {
    if (user) {
      window.appState.currentUser = user;
      storage.setCachedUser({
        uid: user.uid,
        name: user.displayName,
        email: user.email,
        photo: user.photoURL
      });

      if (btnLogin) btnLogin.classList.add('d-none');
      if (userMenu) userMenu.classList.remove('d-none');
      if (userAvatar) userAvatar.src = user.photoURL || '/assets/aistudio/Ashif_Web_Studio_Frontend_Developer_logo_229c6c9e.png';
      if (userName) userName.textContent = user.displayName || 'Gully Player';
      if (userEmail) userEmail.textContent = user.email || '';

      // Check if developer admin
      if (user.email === ADMIN_EMAIL) {
        window.appState.adminLoggedIn = true;
      }
    } else {
      window.appState.currentUser = null;
      storage.setCachedUser(null);
      if (btnLogin) btnLogin.classList.remove('d-none');
      if (userMenu) userMenu.classList.add('d-none');
    }
  });

  if (btnLogin) {
    btnLogin.addEventListener('click', async () => {
      try {
        await loginWithGoogle();
        showToast('Signed in successfully with Google!');
      } catch (err) {
        showToast('Login failed: ' + err.message, 'danger');
      }
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      await logoutUser();
      showToast('Signed out.');
    });
  }
}

// ============================================================================
// 3. PWA & OFFLINE CAPABILITIES
// ============================================================================

function initPWAAndOffline() {
  const banner = document.getElementById('offline-banner');

  const updateOnlineStatus = () => {
    if (navigator.onLine) {
      if (banner) banner.classList.add('d-none');
    } else {
      if (banner) banner.classList.remove('d-none');
    }
  };

  window.addEventListener('online', () => {
    updateOnlineStatus();
    showToast('Back online! Syncing match data with cloud...', 'success');
    syncWithCloud();
  });
  window.addEventListener('offline', () => {
    updateOnlineStatus();
    showToast('You are now in Offline Mode.', 'warning');
  });

  updateOnlineStatus();

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('[PWA] Service Worker registered:', reg.scope))
      .catch(err => console.warn('[PWA] Service Worker registration failed:', err));
  }

  // PWA In-App Install Prompt
  const btnInstall = document.getElementById('btn-pwa-install');
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    window.appState.deferredPWAInstallPrompt = e;
    if (btnInstall) {
      btnInstall.classList.remove('d-none');
      btnInstall.classList.add('d-flex');
    }
  });

  if (btnInstall) {
    btnInstall.addEventListener('click', async () => {
      const promptEvent = window.appState.deferredPWAInstallPrompt;
      if (!promptEvent) {
        showToast('To install on iPhone/iPad: Tap Share -> Add to Home Screen', 'info');
        return;
      }
      promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === 'accepted') {
        showToast('Gully Cricket Scorer installed successfully!', 'success');
        btnInstall.classList.add('d-none');
      }
      window.appState.deferredPWAInstallPrompt = null;
    });
  }
}

// ============================================================================
// 4. SPA ROUTER
// ============================================================================

function initRouter() {
  const handleRoute = () => {
    let hash = window.location.hash || '#home';
    if (hash === '' || hash === '#') hash = '#home';

    // Highlight active nav link
    document.querySelectorAll('.navbar-nav .nav-link').forEach(link => {
      if (link.getAttribute('href') === hash) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Hide all views and show target view
    document.querySelectorAll('.page-view').forEach(view => view.classList.remove('active'));

    const routeMap = {
      '#home': 'view-home',
      '#new-match': 'view-new-match',
      '#live': 'view-live',
      '#history': 'view-history',
      '#players': 'view-players',
      '#tournaments': 'view-tournaments',
      '#admin-login': 'view-admin'
    };

    const targetViewId = routeMap[hash] || 'view-home';
    const targetEl = document.getElementById(targetViewId);
    if (targetEl) {
      targetEl.classList.add('active');
    }

    // Contextual renders
    if (hash === '#live') {
      renderLiveConsole();
    } else if (hash === '#home') {
      renderHomeStats();
      renderRecentMatches();
    } else if (hash === '#history') {
      renderHistoryList();
    } else if (hash === '#players') {
      renderLeaderboards();
    } else if (hash === '#tournaments') {
      renderPointsTable();
    } else if (hash === '#admin-login') {
      checkAdminView();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

// ============================================================================
// 5. MATCH SETUP WIZARD (Format, Squads, Coin Toss)
// ============================================================================

window.gotoWizardStep = function(stepNum) {
  window.appState.wizardStep = stepNum;

  // Update Stepper
  document.querySelectorAll('.step-item').forEach(item => {
    const s = Number(item.dataset.step);
    if (s < stepNum) {
      item.classList.remove('active');
      item.classList.add('completed');
    } else if (s === stepNum) {
      item.classList.add('active');
      item.classList.remove('completed');
    } else {
      item.classList.remove('active', 'completed');
    }
  });

  // Panes
  document.querySelectorAll('.wizard-pane').forEach((p, idx) => {
    if (idx + 1 === stepNum) {
      p.classList.add('active');
    } else {
      p.classList.remove('active');
    }
  });

  window.scrollTo({ top: 150, behavior: 'smooth' });
};

// Wizard Step 1: Format & Player Count & Overs Listeners
document.addEventListener('click', e => {
  // Player Count Chips
  if (e.target.closest('.count-chip')) {
    const btn = e.target.closest('.count-chip');
    document.querySelectorAll('.count-chip').forEach(b => {
      b.classList.remove('btn-primary', 'active');
      b.classList.add('btn-outline-secondary');
    });
    btn.classList.add('btn-primary', 'active');
    btn.classList.remove('btn-outline-secondary');

    const val = btn.dataset.players;
    const customWrap = document.getElementById('custom-player-count-wrap');
    if (val === 'custom') {
      customWrap.classList.remove('d-none');
      const count = Number(document.getElementById('input-custom-players').value) || 8;
      window.appState.wizardData.playerCount = count;
      generateSquadInputs(count);
    } else {
      customWrap.classList.add('d-none');
      const count = Number(val);
      window.appState.wizardData.playerCount = count;
      generateSquadInputs(count);
    }
  }

  // Overs Chips
  if (e.target.closest('.over-chip')) {
    const btn = e.target.closest('.over-chip');
    document.querySelectorAll('.over-chip').forEach(b => {
      b.classList.remove('btn-primary', 'active');
      b.classList.add('btn-outline-secondary');
    });
    btn.classList.add('btn-primary', 'active');
    btn.classList.remove('btn-outline-secondary');

    window.appState.wizardData.overs = btn.dataset.overs;
  }
});

// Format radios
document.querySelectorAll('input[name="matchFormat"]').forEach(radio => {
  radio.addEventListener('change', () => {
    window.appState.wizardData.format = radio.value;
  });
});

// Step 1 -> Step 2
const btnGotoStep2 = document.getElementById('btn-goto-step-2');
if (btnGotoStep2) {
  btnGotoStep2.addEventListener('click', () => {
    window.appState.wizardData.venue = document.getElementById('input-venue').value || 'Gully Arena';
    window.appState.wizardData.ballType = document.getElementById('select-ball-type').value;
    window.gotoWizardStep(2);
  });
}

/**
 * Generate Dynamic Squad Inputs
 */
function generateSquadInputs(count) {
  const countSpanA = document.getElementById('team-a-player-count');
  const countSpanB = document.getElementById('team-b-player-count');
  if (countSpanA) countSpanA.textContent = String(count);
  if (countSpanB) countSpanB.textContent = String(count);

  const defaultNamesA = [
    'Mohammad Ashif (C)', 'Rohit Sharma (WK)', 'Virat Kohli', 'Surya Kumar', 'Hardik Pandya',
    'Rinku Singh', 'Axar Patel', 'Kuldeep Yadav', 'Jasprit Bumrah', 'Arshdeep Singh', 'Siraj'
  ];

  const defaultNamesB = [
    'Babar Azam (C)', 'Rizwan (WK)', 'Fakhar Zaman', 'Iftikhar Ahmed', 'Shadab Khan',
    'Imad Wasim', 'Shaheen Afridi', 'Naseem Shah', 'Haris Rauf', 'Amir', 'Abrar Ahmed'
  ];

  const containerA = document.getElementById('team-a-players-list');
  const containerB = document.getElementById('team-b-players-list');

  const createRows = (container, teamKey, defaults) => {
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const row = document.createElement('div');
      row.className = 'input-group input-group-sm mb-2';
      const cleanName = (defaults[i] || `Player ${i + 1}`).replace(' (C)', '').replace(' (WK)', '');
      row.innerHTML = `
        <span class="input-group-text bg-white border text-muted" style="width: 32px;">${i + 1}</span>
        <input type="text" class="form-control player-name-input" data-team="${teamKey}" data-index="${i}" value="${cleanName}" placeholder="Player ${i + 1} Name" />
        <button type="button" class="btn btn-outline-secondary btn-sm badge-captain ${i === 0 ? 'btn-primary text-white' : ''}" title="Captain">C</button>
        <button type="button" class="btn btn-outline-secondary btn-sm badge-keeper ${i === 1 ? 'btn-primary text-white' : ''}" title="Wicket Keeper">WK</button>
      `;
      container.appendChild(row);
    }
  };

  createRows(containerA, 'A', defaultNamesA);
  createRows(containerB, 'B', defaultNamesB);
}

// Step 2 -> Step 3
const btnGotoStep3 = document.getElementById('btn-goto-step-3');
if (btnGotoStep3) {
  btnGotoStep3.addEventListener('click', () => {
    // Read Team names and squads
    const nameA = document.getElementById('input-team-a-name').value || 'Team A';
    const nameB = document.getElementById('input-team-b-name').value || 'Team B';

    const collectPlayers = (teamKey) => {
      const inputs = document.querySelectorAll(`.player-name-input[data-team="${teamKey}"]`);
      const list = [];
      inputs.forEach((input, idx) => {
        const val = input.value.trim() || `Player ${idx + 1}`;
        list.push({
          name: val,
          isCaptain: idx === 0,
          isKeeper: idx === 1
        });
      });
      return list;
    };

    window.appState.wizardData.teamA = {
      name: nameA,
      players: collectPlayers('A')
    };
    window.appState.wizardData.teamB = {
      name: nameB,
      players: collectPlayers('B')
    };

    // Update Step 3 toss team dropdowns
    const optA = document.getElementById('opt-toss-team-a');
    const optB = document.getElementById('opt-toss-team-b');
    if (optA) optA.textContent = nameA;
    if (optB) optB.textContent = nameB;

    window.gotoWizardStep(3);
  });
}

/**
 * 3D Toss Coin Flip Simulator
 */
const btnFlipCoin = document.getElementById('btn-flip-coin');
if (btnFlipCoin) {
  btnFlipCoin.addEventListener('click', () => {
    const coin = document.getElementById('coin');
    const statusText = document.getElementById('toss-animation-status');
    const decisionBox = document.getElementById('toss-decision-box');
    const openersBox = document.getElementById('openers-selection-box');
    const resultText = document.getElementById('toss-result-text');

    const callingTeamKey = document.getElementById('toss-calling-team').value; // 'A' or 'B'
    const userCall = document.getElementById('toss-call').value; // 'Heads' or 'Tails'
    const callingTeamName = callingTeamKey === 'A' ? window.appState.wizardData.teamA.name : window.appState.wizardData.teamB.name;
    const opponentTeamName = callingTeamKey === 'A' ? window.appState.wizardData.teamB.name : window.appState.wizardData.teamA.name;

    btnFlipCoin.disabled = true;
    statusText.textContent = 'Flipping coin in mid-air...';

    coin.classList.remove('flipping');
    void coin.offsetWidth; // trigger reflow
    coin.classList.add('flipping');

    const outcome = Math.random() > 0.5 ? 'Heads' : 'Tails';
    const winnerKey = outcome === userCall ? callingTeamKey : (callingTeamKey === 'A' ? 'B' : 'A');
    const winnerName = winnerKey === 'A' ? window.appState.wizardData.teamA.name : window.appState.wizardData.teamB.name;

    setTimeout(() => {
      coin.classList.remove('flipping');
      statusText.innerHTML = `Coin landed on: <strong class="text-primary">${outcome.toUpperCase()}</strong>!`;
      resultText.innerHTML = `<strong>${winnerName}</strong> won the toss!`;
      decisionBox.classList.remove('d-none');
      openersBox.classList.remove('d-none');
      btnFlipCoin.disabled = false;

      window.appState.wizardData.toss.winner = winnerKey;
      populateOpenersDropdowns();
    }, 1800);
  });
}

function populateOpenersDropdowns() {
  const tossDecision = document.querySelector('input[name="tossChoice"]:checked')?.value || 'BAT';
  window.appState.wizardData.toss.decision = tossDecision;

  const winnerKey = window.appState.wizardData.toss.winner;
  const isTeamABatting = (winnerKey === 'A' && tossDecision === 'BAT') || (winnerKey === 'B' && tossDecision === 'BOWL');

  const battingTeam = isTeamABatting ? window.appState.wizardData.teamA : window.appState.wizardData.teamB;
  const bowlingTeam = isTeamABatting ? window.appState.wizardData.teamB : window.appState.wizardData.teamA;

  const selStrike = document.getElementById('select-opener-strike');
  const selNonStrike = document.getElementById('select-opener-nonstrike');
  const selBowler = document.getElementById('select-opener-bowler');

  if (selStrike && selNonStrike) {
    selStrike.innerHTML = battingTeam.players.map((p, i) => `<option value="${p.name}" ${i === 0 ? 'selected' : ''}>${p.name}</option>`).join('');
    selNonStrike.innerHTML = battingTeam.players.map((p, i) => `<option value="${p.name}" ${i === 1 ? 'selected' : ''}>${p.name}</option>`).join('');
  }

  if (selBowler) {
    selBowler.innerHTML = bowlingTeam.players.map((p, i) => `<option value="${p.name}" ${i === 0 ? 'selected' : ''}>${p.name}</option>`).join('');
  }
}

// Start Live Match Button
const btnStartMatch = document.getElementById('btn-start-match');
if (btnStartMatch) {
  btnStartMatch.addEventListener('click', () => {
    const selStrike = document.getElementById('select-opener-strike');
    const selNonStrike = document.getElementById('select-opener-nonstrike');
    const selBowler = document.getElementById('select-opener-bowler');

    const tossDecision = document.querySelector('input[name="tossChoice"]:checked')?.value || 'BAT';
    window.appState.wizardData.toss.decision = tossDecision;

    const matchInstance = CricketEngine.createNewMatch({
      format: window.appState.wizardData.format,
      playerCount: window.appState.wizardData.playerCount,
      overs: window.appState.wizardData.overs,
      venue: window.appState.wizardData.venue,
      ballType: window.appState.wizardData.ballType,
      teamA: window.appState.wizardData.teamA,
      teamB: window.appState.wizardData.teamB,
      toss: window.appState.wizardData.toss,
      openers: {
        strike: selStrike?.value,
        nonStrike: selNonStrike?.value,
        bowler: selBowler?.value
      }
    });

    window.appState.activeMatch = matchInstance;
    storage.setLiveMatch(matchInstance);
    storage.saveMatch(matchInstance);
    saveMatchToFirestore(matchInstance);

    showToast('Match initialized! Let the play begin!', 'success');
    window.location.hash = '#live';
  });
}

// ============================================================================
// 6. LIVE SCORING COCKPIT RENDER & ACTIONS
// ============================================================================

function renderLiveConsole() {
  const match = window.appState.activeMatch;
  const emptyState = document.getElementById('live-empty-state');
  const activeContainer = document.getElementById('live-active-container');
  const liveBadge = document.getElementById('nav-live-badge');

  if (!match) {
    if (emptyState) emptyState.classList.remove('d-none');
    if (activeContainer) activeContainer.classList.add('d-none');
    if (liveBadge) liveBadge.classList.add('d-none');
    return;
  }

  if (emptyState) emptyState.classList.add('d-none');
  if (activeContainer) activeContainer.classList.remove('d-none');
  if (liveBadge) liveBadge.classList.remove('d-none');

  const inn = match.innings[match.currentInningsIndex];
  if (!inn) return;

  // Header stats
  document.getElementById('live-batting-team-name').textContent = inn.battingTeamName;
  document.getElementById('live-score-display').textContent = `${inn.totalRuns}/${inn.wickets}`;
  document.getElementById('live-overs-display').textContent = inn.oversBowled;
  document.getElementById('live-max-overs').textContent = inn.maxOvers === 999 ? 'Test' : String(inn.maxOvers);
  document.getElementById('live-match-format-badge').textContent = match.format;
  document.getElementById('live-match-venue').innerHTML = `<i class="bi bi-geo-alt me-1"></i>${match.venue}`;

  const crrVal = (inn.totalRuns / Math.max(0.166, inn.legalBalls / 6)).toFixed(2);
  document.getElementById('live-crr').textContent = crrVal;
  document.getElementById('live-extras-count').textContent = String(inn.extras.total);

  // Second Innings Target Box & Win Probability
  const targetBox = document.getElementById('live-target-box');
  const rrrWrap = document.getElementById('live-rrr-wrap');
  if (match.currentInningsIndex === 1 && match.innings[0]) {
    targetBox.classList.remove('d-none');
    rrrWrap.classList.remove('d-none');
    const target = match.innings[0].totalRuns + 1;
    const needRuns = Math.max(0, target - inn.totalRuns);
    const remainingBalls = Math.max(0, (inn.maxOvers * 6) - inn.legalBalls);
    const rrr = remainingBalls > 0 ? ((needRuns / remainingBalls) * 6).toFixed(2) : '—';

    document.getElementById('live-target-runs').textContent = String(target);
    document.getElementById('live-need-runs').textContent = String(needRuns);
    document.getElementById('live-need-balls').textContent = String(remainingBalls);
    document.getElementById('live-rrr').textContent = rrr;

    // Win Probability Formula
    let probA = 50;
    if (needRuns <= 0) {
      probA = 0;
    } else if (remainingBalls <= 0) {
      probA = 100;
    } else {
      const runDifferential = (needRuns / Math.max(1, remainingBalls)) * 6;
      probA = Math.min(95, Math.max(5, Math.round(50 + (runDifferential - 7) * 5 + (inn.wickets * 4))));
    }
    const probB = 100 - probA;
    document.getElementById('prob-team-a-label').textContent = `${match.teamA.name}: ${probA}%`;
    document.getElementById('prob-team-b-label').textContent = `${match.teamB.name}: ${probB}%`;
    document.getElementById('prob-bar-a').style.width = `${probA}%`;
    document.getElementById('prob-bar-b').style.width = `${probB}%`;
  } else {
    targetBox.classList.add('d-none');
    rrrWrap.classList.add('d-none');
  }

  // Batters Table
  const strikeBatter = inn.batters.find(b => b.name === inn.strikeBatterName) || { name: inn.strikeBatterName, runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: 0 };
  const nonStrikeBatter = inn.batters.find(b => b.name === inn.nonStrikeBatterName) || { name: inn.nonStrikeBatterName, runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: 0 };

  document.getElementById('strike-batter-name').textContent = strikeBatter.name;
  document.getElementById('strike-batter-runs').textContent = String(strikeBatter.runs);
  document.getElementById('strike-batter-balls').textContent = String(strikeBatter.balls);
  document.getElementById('strike-batter-fours').textContent = String(strikeBatter.fours);
  document.getElementById('strike-batter-sixes').textContent = String(strikeBatter.sixes);
  document.getElementById('strike-batter-sr').textContent = String(strikeBatter.strikeRate);

  document.getElementById('nonstrike-batter-name').textContent = nonStrikeBatter.name;
  document.getElementById('nonstrike-batter-runs').textContent = String(nonStrikeBatter.runs);
  document.getElementById('nonstrike-batter-balls').textContent = String(nonStrikeBatter.balls);
  document.getElementById('nonstrike-batter-fours').textContent = String(nonStrikeBatter.fours);
  document.getElementById('nonstrike-batter-sixes').textContent = String(nonStrikeBatter.sixes);
  document.getElementById('nonstrike-batter-sr').textContent = String(nonStrikeBatter.strikeRate);

  // Partnership
  const curPart = inn.partnerships[inn.partnerships.length - 1];
  if (curPart) {
    document.getElementById('live-partnership-runs').textContent = String(curPart.runs);
    document.getElementById('live-partnership-balls').textContent = String(curPart.balls);
  }

  // Bowler Figures
  const bowler = inn.bowlers.find(b => b.name === inn.currentBowlerName) || { name: inn.currentBowlerName, overs: 0, maidens: 0, runs: 0, wickets: 0, economy: 0 };
  document.getElementById('current-bowler-name').textContent = bowler.name;
  document.getElementById('bowler-overs').textContent = String(bowler.overs);
  document.getElementById('bowler-maidens').textContent = String(bowler.maidens);
  document.getElementById('bowler-runs').textContent = String(bowler.runs);
  document.getElementById('bowler-wickets').textContent = String(bowler.wickets);
  document.getElementById('bowler-economy').textContent = String(bowler.economy);
  document.getElementById('bowler-spell-text').textContent = `${bowler.wickets}/${bowler.runs} in ${bowler.overs} ov`;

  // Current Over Visual Badges
  const ballsContainer = document.getElementById('current-over-balls');
  if (ballsContainer) {
    ballsContainer.innerHTML = '';
    const currentBalls = inn.currentOverBalls || [];
    currentBalls.forEach(b => {
      const badge = document.createElement('span');
      badge.className = 'over-ball-badge';
      if (b.isWicket) badge.classList.add('wicket');
      else if (b.runs === 4) badge.classList.add('four');
      else if (b.runs === 6) badge.classList.add('six');
      else if (b.extra) badge.classList.add('extra');
      else if (b.runs === 0) badge.classList.add('dot');

      badge.textContent = b.display;
      ballsContainer.appendChild(badge);
    });

    // Fill remaining dots up to 6
    const legalInOver = currentBalls.filter(b => b.isLegal).length;
    for (let i = legalInOver; i < 6; i++) {
      const emptyBadge = document.createElement('span');
      emptyBadge.className = 'over-ball-badge empty';
      emptyBadge.textContent = '·';
      ballsContainer.appendChild(emptyBadge);
    }
  }

  // Commentary
  const lastBall = inn.allDeliveries[inn.allDeliveries.length - 1];
  if (lastBall) {
    document.getElementById('live-ball-commentary').innerHTML = `<i class="bi bi-chat-left-quote me-1 text-primary"></i>${lastBall.commentary}`;
  }

  // Undo / Redo buttons status
  const btnUndo = document.getElementById('btn-undo-ball');
  const btnRedo = document.getElementById('btn-redo-ball');
  if (btnUndo) btnUndo.disabled = !match.historyStack || match.historyStack.length === 0;
  if (btnRedo) btnRedo.disabled = !match.redoStack || match.redoStack.length === 0;

  // Check if Match has Finished
  if (match.status === 'completed' || match.status === 'tied') {
    showMatchResultModal(match);
  }
}

// Keypad Actions
window.recordBall = function(runs) {
  const match = window.appState.activeMatch;
  if (!match || match.status === 'completed') return;

  CricketEngine.recordDelivery(match, runs);
  storage.setLiveMatch(match);
  storage.saveMatch(match);
  saveMatchToFirestore(match);
  renderLiveConsole();
};

window.switchBatterStrike = function() {
  const match = window.appState.activeMatch;
  if (!match) return;
  const inn = match.innings[match.currentInningsIndex];
  CricketEngine.swapStrike(inn);
  storage.setLiveMatch(match);
  renderLiveConsole();
  showToast('Strike rotated.');
};

window.undoLastBall = function() {
  const match = window.appState.activeMatch;
  if (!match) return;
  CricketEngine.undo(match);
  storage.setLiveMatch(match);
  storage.saveMatch(match);
  renderLiveConsole();
  showToast('Last action undone.');
};

window.redoBall = function() {
  const match = window.appState.activeMatch;
  if (!match) return;
  CricketEngine.redo(match);
  storage.setLiveMatch(match);
  storage.saveMatch(match);
  renderLiveConsole();
  showToast('Action redone.');
};

window.recordDeadBall = function() {
  showToast('Dead Ball acknowledged. No ball recorded.');
};

// Extras Modal
let currentExtraType = 'wide';
window.openExtraModal = function(type) {
  currentExtraType = type;
  const title = document.getElementById('extra-modal-title');
  const exp = document.getElementById('extra-modal-explanation');
  if (title) title.textContent = `Record ${type.toUpperCase()}`;
  if (exp) {
    if (type === 'wide') exp.textContent = 'Wide: 1 extra run + re-bowl delivery. Select additional runs if batters ran or overthrows occurred.';
    if (type === 'noball') exp.textContent = 'No Ball: 1 extra run + Free Hit re-bowl. Select runs made off the bat.';
    if (type === 'bye') exp.textContent = 'Byes: Legal delivery. Runs completed without hitting bat.';
    if (type === 'legbye') exp.textContent = 'Leg Byes: Legal delivery. Runs completed hitting pads.';
  }
  const modal = new bootstrap.Modal(document.getElementById('modal-extras'));
  modal.show();
};

window.confirmExtra = function(additionalRuns) {
  const match = window.appState.activeMatch;
  if (!match) return;

  CricketEngine.recordExtra(match, currentExtraType, additionalRuns);
  storage.setLiveMatch(match);
  storage.saveMatch(match);
  saveMatchToFirestore(match);

  const modalEl = document.getElementById('modal-extras');
  const modal = bootstrap.Modal.getInstance(modalEl);
  if (modal) modal.hide();

  renderLiveConsole();
};

window.openPenaltyModal = function() {
  const match = window.appState.activeMatch;
  if (!match) return;
  CricketEngine.recordExtra(match, 'penalty', 5);
  storage.setLiveMatch(match);
  renderLiveConsole();
  showToast('+5 Penalty runs awarded to batting team.');
};

// Wicket Modal
window.openWicketModal = function() {
  const match = window.appState.activeMatch;
  if (!match) return;
  const inn = match.innings[match.currentInningsIndex];

  document.getElementById('wb-strike-name').textContent = inn.strikeBatterName;
  document.getElementById('wb-nonstrike-name').textContent = inn.nonStrikeBatterName;

  // Next batter dropdown
  const yetToBat = inn.batters.filter(b => b.status === 'yet_to_bat');
  const selNext = document.getElementById('select-next-batter');
  if (selNext) {
    if (yetToBat.length > 0) {
      selNext.innerHTML = yetToBat.map(b => `<option value="${b.name}">${b.name}</option>`).join('');
    } else {
      selNext.innerHTML = '<option value="">No more batters (Innings End)</option>';
    }
  }

  // Fielder dropdown (all fielders from bowling squad)
  const selFielder = document.getElementById('select-fielder');
  if (selFielder) {
    selFielder.innerHTML = inn.bowlers.map(bw => `<option value="${bw.name}">${bw.name}</option>`).join('');
  }

  const modal = new bootstrap.Modal(document.getElementById('modal-wicket'));
  modal.show();
};

window.onWicketTypeChange = function() {
  const type = document.getElementById('select-wicket-type').value;
  const fielderWrap = document.getElementById('fielder-select-wrap');
  const runoutWrap = document.getElementById('runout-runs-wrap');

  if (type === 'Caught' || type === 'Run Out' || type === 'Stumped') {
    fielderWrap.classList.remove('d-none');
  } else {
    fielderWrap.classList.add('d-none');
  }

  if (type === 'Run Out') {
    runoutWrap.classList.remove('d-none');
  } else {
    runoutWrap.classList.add('d-none');
  }
};

window.confirmWicket = function() {
  const match = window.appState.activeMatch;
  if (!match) return;

  const outBatter = document.querySelector('input[name="wicketBatter"]:checked')?.value || 'strike';
  const dismissalType = document.getElementById('select-wicket-type').value;
  const fielder = document.getElementById('select-fielder').value;
  const nextBatter = document.getElementById('select-next-batter').value;
  const runsCompleted = Number(document.getElementById('input-runout-runs').value) || 0;

  CricketEngine.recordWicket(match, {
    dismissalType,
    outBatter,
    fielder,
    nextBatter,
    runsCompleted
  });

  storage.setLiveMatch(match);
  storage.saveMatch(match);
  saveMatchToFirestore(match);

  const modalEl = document.getElementById('modal-wicket');
  const modal = bootstrap.Modal.getInstance(modalEl);
  if (modal) modal.hide();

  renderLiveConsole();
  showToast(`WICKET! ${dismissalType} recorded.`, 'danger');
};

// Bowler Change Modal
window.changeBowlerModal = function() {
  const match = window.appState.activeMatch;
  if (!match) return;
  const inn = match.innings[match.currentInningsIndex];

  const sel = document.getElementById('select-new-bowler');
  if (sel) {
    // Exclude current bowler unless 1v1
    const available = match.playerCount === 1 ? inn.bowlers : inn.bowlers.filter(bw => bw.name !== inn.currentBowlerName);
    sel.innerHTML = available.map(bw => `<option value="${bw.name}">${bw.name} (${bw.overs} ov, ${bw.wickets}/${bw.runs})</option>`).join('');
  }

  const modal = new bootstrap.Modal(document.getElementById('modal-change-bowler'));
  modal.show();
};

window.confirmBowlerChange = function() {
  const match = window.appState.activeMatch;
  if (!match) return;
  const inn = match.innings[match.currentInningsIndex];
  const newBowler = document.getElementById('select-new-bowler').value;

  inn.currentBowlerName = newBowler;
  storage.setLiveMatch(match);

  const modalEl = document.getElementById('modal-change-bowler');
  const modal = bootstrap.Modal.getInstance(modalEl);
  if (modal) modal.hide();

  renderLiveConsole();
  showToast(`Bowler changed to ${newBowler}.`);
};

// End Innings confirmation
window.confirmEndInnings = function() {
  if (confirm('Are you sure you want to declare or conclude the current innings?')) {
    const match = window.appState.activeMatch;
    if (!match) return;
    CricketEngine.completeInnings(match);
    storage.setLiveMatch(match);
    storage.saveMatch(match);
    saveMatchToFirestore(match);
    renderLiveConsole();
    showToast('Innings concluded.');
  }
};

// ============================================================================
// 7. MATCH RESULT, SUPER OVER & SHARE
// ============================================================================

function showMatchResultModal(match) {
  const modalEl = document.getElementById('modal-match-result');
  if (!modalEl) return;

  document.getElementById('result-winner-title').textContent = match.result?.summary || 'Match Over';
  document.getElementById('result-margin-text').textContent = match.status === 'tied' ? 'Scores are level' : 'Official Result';
  document.getElementById('result-potm-name').textContent = match.playerOfTheMatch || 'Top Performer';

  const inn1 = match.innings[0];
  const inn2 = match.innings[1];
  if (inn1) {
    document.getElementById('result-team-a-name').textContent = inn1.battingTeamName;
    document.getElementById('result-team-a-score').textContent = `${inn1.totalRuns}/${inn1.wickets}`;
    document.getElementById('result-team-a-overs').textContent = `(${inn1.oversBowled} ov)`;
  }
  if (inn2) {
    document.getElementById('result-team-b-name').textContent = inn2.battingTeamName;
    document.getElementById('result-team-b-score').textContent = `${inn2.totalRuns}/${inn2.wickets}`;
    document.getElementById('result-team-b-overs').textContent = `(${inn2.oversBowled} ov)`;
  }

  // Super Over Prompt
  const soPrompt = document.getElementById('super-over-prompt-box');
  if (match.status === 'tied' && soPrompt) {
    soPrompt.classList.remove('d-none');
  } else if (soPrompt) {
    soPrompt.classList.add('d-none');
  }

  // Confetti effect!
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 }
    });
  }

  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}

window.startSuperOver = function() {
  const match = window.appState.activeMatch;
  if (!match) return;

  const soInstance = CricketEngine.createNewMatch({
    format: 'Super Over',
    playerCount: 3,
    overs: 1,
    venue: match.venue,
    teamA: match.teamA,
    teamB: match.teamB,
    toss: { winner: 'A', decision: 'BAT' }
  });

  window.appState.activeMatch = soInstance;
  storage.setLiveMatch(soInstance);

  const modalEl = document.getElementById('modal-match-result');
  const modal = bootstrap.Modal.getInstance(modalEl);
  if (modal) modal.hide();

  renderLiveConsole();
  showToast('Super Over initialized! 6 balls shootout!', 'warning');
};

window.shareWhatsApp = function() {
  const match = window.appState.activeMatch || window.appState.allMatches[0];
  if (!match) return;

  const text = `🏏 *${match.teamA.name} vs ${match.teamB.name}*\n` +
               `🏆 Result: ${match.result?.summary || 'Live Match'}\n` +
               `⭐ Player of the Match: ${match.playerOfTheMatch || 'N/A'}\n` +
               `Scored via Gully Cricket Scorer by Ashif Web Studio: https://ashif-web-studio.vercel.app`;

  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
};

window.copyShareLink = function() {
  const url = window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    showToast('Match link copied to clipboard!');
  });
};

// ============================================================================
// 8. SCORECARD MODAL & PDF EXPORT
// ============================================================================

window.showScorecardModal = function(matchData = null) {
  const match = matchData || window.appState.activeMatch || window.appState.allMatches[0];
  if (!match) {
    showToast('No match data to display.', 'info');
    return;
  }

  const renderContainer = document.getElementById('full-scorecard-render');
  if (renderContainer) {
    renderContainer.innerHTML = PDFExport.renderScorecardHTML(match);
  }

  const modal = new bootstrap.Modal(document.getElementById('modal-scorecard'));
  modal.show();
};

window.downloadMatchPDF = function() {
  PDFExport.printScorecard();
};

window.printScorecard = function() {
  PDFExport.printScorecard();
};

// ============================================================================
// 9. VISUAL ANALYTICS (Graphs Modal)
// ============================================================================

window.showGraphsModal = function() {
  const match = window.appState.activeMatch;
  if (!match) {
    showToast('Start a match to view real-time graphs.', 'info');
    return;
  }

  const modal = new bootstrap.Modal(document.getElementById('modal-graphs'));
  modal.show();

  setTimeout(() => {
    const inn = match.innings[match.currentInningsIndex];
    CricketCharts.renderManhattan('canvas-manhattan', inn?.allDeliveries || []);
    CricketCharts.renderWorm('canvas-worm', match);
    CricketCharts.renderRunRate('canvas-runrate', match);
  }, 250);
};

// ============================================================================
// 10. HOME STATS & SEARCH & ARCHIVES
// ============================================================================

function renderHomeStats() {
  const matches = window.appState.allMatches;
  let totalRuns = 0;
  let totalWickets = 0;
  const playersSet = new Set();

  matches.forEach(m => {
    if (m.innings) {
      m.innings.forEach(inn => {
        totalRuns += inn.totalRuns || 0;
        totalWickets += inn.wickets || 0;
        if (inn.batters) inn.batters.forEach(b => playersSet.add(b.name));
      });
    }
  });

  document.getElementById('stat-total-matches').textContent = String(matches.length);
  document.getElementById('stat-total-runs').textContent = String(totalRuns);
  document.getElementById('stat-total-wickets').textContent = String(totalWickets);
  document.getElementById('stat-active-players').textContent = String(playersSet.size);

  // Active match hero trigger
  const liveMatch = window.appState.activeMatch;
  const btnResume = document.getElementById('btn-hero-resume-live');
  const liveBanner = document.getElementById('home-live-card-container');
  if (liveMatch && liveMatch.status === 'live') {
    if (btnResume) btnResume.classList.remove('d-none');
    if (liveBanner) {
      liveBanner.classList.remove('d-none');
      const inn = liveMatch.innings[liveMatch.currentInningsIndex];
      document.getElementById('home-live-card').innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <span class="badge bg-danger rounded-pill px-3 py-1 mb-2">LIVE MATCH</span>
            <h4 class="fw-bold mb-1">${inn.battingTeamName} vs ${inn.bowlingTeamName}</h4>
            <div class="display-6 fw-black text-primary">${inn.totalRuns}/${inn.wickets} <span class="fs-5 text-muted">(${inn.oversBowled} ov)</span></div>
          </div>
          <a href="#live" class="btn btn-primary rounded-pill px-4 fw-bold">Resume Scoring</a>
        </div>
      `;
    }
  } else {
    if (btnResume) btnResume.classList.add('d-none');
    if (liveBanner) liveBanner.classList.add('d-none');
  }
}

function renderRecentMatches() {
  const container = document.getElementById('home-recent-matches');
  if (!container) return;

  const matches = window.appState.allMatches.slice(0, 4);
  if (matches.length === 0) {
    container.innerHTML = `
      <div class="col-12 text-center py-4 text-muted">
        <i class="bi bi-folder2-open fs-2 mb-2 d-block"></i>
        No matches recorded yet. Hit "Start New Match" to score your first gully cricket game!
      </div>
    `;
    return;
  }

  container.innerHTML = matches.map(m => `
    <div class="col-md-6 col-lg-3">
      <div class="card border-0 rounded-4 shadow-sm p-3 h-100">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span class="badge bg-primary-subtle text-primary rounded-pill small">${m.format}</span>
          <small class="text-muted">${new Date(m.createdAt).toLocaleDateString()}</small>
        </div>
        <h6 class="fw-bold mb-1">${m.teamA.name} vs ${m.teamB.name}</h6>
        <p class="small text-muted mb-3">${m.result?.summary || 'In Progress'}</p>
        <button class="btn btn-sm btn-outline-primary rounded-pill w-100 fw-bold mt-auto" onclick='window.showScorecardModal(${JSON.stringify(m).replace(/'/g, "&apos;")})'>
          View Scorecard
        </button>
      </div>
    </div>
  `).join('');
}

function renderHistoryList() {
  const container = document.getElementById('history-matches-list');
  if (!container) return;

  const matches = window.appState.allMatches;
  if (matches.length === 0) {
    container.innerHTML = `<div class="col-12 text-center py-5 text-muted">No matches found in archive.</div>`;
    return;
  }

  container.innerHTML = matches.map(m => `
    <div class="col-md-6">
      <div class="card border-0 rounded-4 shadow-sm p-4 h-100">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span class="badge bg-light text-dark border rounded-pill">${m.format} · ${m.displayOvers} ov</span>
          <small class="text-muted">${new Date(m.createdAt).toLocaleDateString()}</small>
        </div>
        <h5 class="fw-bold mb-1">${m.teamA.name} <span class="text-muted font-normal">vs</span> ${m.teamB.name}</h5>
        <div class="alert alert-light border py-2 px-3 rounded-3 small fw-bold mb-3 text-primary">
          ${m.result?.summary || 'Match Status: ' + m.status}
        </div>
        <div class="d-flex gap-2 mt-auto">
          <button class="btn btn-sm btn-primary rounded-pill px-3 flex-fill fw-bold" onclick='window.showScorecardModal(${JSON.stringify(m).replace(/'/g, "&apos;")})'>
            <i class="bi bi-file-earmark-text me-1"></i>Scorecard
          </button>
          <button class="btn btn-sm btn-outline-danger rounded-pill px-3" onclick="window.deleteMatch('${m.id}')" title="Delete Match">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

window.deleteMatch = async function(matchId) {
  if (confirm('Delete this match record?')) {
    storage.deleteMatch(matchId);
    await deleteMatchFromFirestore(matchId);
    window.appState.allMatches = storage.getAllMatches();
    renderHistoryList();
    renderHomeStats();
    showToast('Match deleted.');
  }
};

// ============================================================================
// 11. PLAYERS & TEAMS LEADERBOARDS
// ============================================================================

function renderLeaderboards() {
  const matches = window.appState.allMatches;

  // Aggregate Player Records
  const playerStats = {};
  // Aggregate Team Records
  const teamStats = {};

  matches.forEach(m => {
    // Teams
    [m.teamA.name, m.teamB.name].forEach(t => {
      if (!teamStats[t]) teamStats[t] = { name: t, matches: 0, wins: 0, losses: 0, ties: 0 };
      teamStats[t].matches += 1;
    });

    if (m.result?.summary) {
      if (m.result.summary.includes(m.teamA.name)) {
        teamStats[m.teamA.name].wins += 1;
        teamStats[m.teamB.name].losses += 1;
      } else if (m.result.summary.includes(m.teamB.name)) {
        teamStats[m.teamB.name].wins += 1;
        teamStats[m.teamA.name].losses += 1;
      } else if (m.status === 'tied') {
        teamStats[m.teamA.name].ties += 1;
        teamStats[m.teamB.name].ties += 1;
      }
    }

    // Players
    if (m.innings) {
      m.innings.forEach(inn => {
        inn.batters.forEach(b => {
          if (!playerStats[b.name]) {
            playerStats[b.name] = { name: b.name, matches: 0, runs: 0, balls: 0, fours: 0, sixes: 0, highest: 0, wickets: 0, runsConceded: 0, ballsBowled: 0 };
          }
          playerStats[b.name].matches += 1;
          playerStats[b.name].runs += b.runs;
          playerStats[b.name].balls += b.balls;
          playerStats[b.name].fours += b.fours;
          playerStats[b.name].sixes += b.sixes;
          if (b.runs > playerStats[b.name].highest) playerStats[b.name].highest = b.runs;
        });

        inn.bowlers.forEach(bw => {
          if (!playerStats[bw.name]) {
            playerStats[bw.name] = { name: bw.name, matches: 0, runs: 0, balls: 0, fours: 0, sixes: 0, highest: 0, wickets: 0, runsConceded: 0, ballsBowled: 0 };
          }
          playerStats[bw.name].wickets += bw.wickets;
          playerStats[bw.name].runsConceded += bw.runs;
          playerStats[bw.name].ballsBowled += bw.legalBalls;
        });
      });
    }
  });

  // Render Players
  const pBody = document.getElementById('players-leaderboard-body');
  if (pBody) {
    const list = Object.values(playerStats).sort((a, b) => b.runs - a.runs);
    if (list.length === 0) {
      pBody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-muted">No player stats recorded yet.</td></tr>`;
    } else {
      pBody.innerHTML = list.map(p => `
        <tr>
          <td class="fw-bold">${p.name}</td>
          <td class="text-center tabular-nums">${p.matches}</td>
          <td class="text-center fw-extrabold text-primary tabular-nums">${p.runs}</td>
          <td class="text-center tabular-nums">${p.highest}</td>
          <td class="text-center tabular-nums">${(p.runs / Math.max(1, p.matches)).toFixed(1)}</td>
          <td class="text-center tabular-nums">${((p.runs / Math.max(1, p.balls)) * 100).toFixed(1)}</td>
          <td class="text-center tabular-nums">${p.fours} / ${p.sixes}</td>
          <td class="text-center fw-bold text-danger tabular-nums">${p.wickets}</td>
          <td class="text-center tabular-nums">${(p.runsConceded / Math.max(1, p.ballsBowled / 6)).toFixed(2)}</td>
        </tr>
      `).join('');
    }
  }

  // Render Teams
  const tBody = document.getElementById('teams-leaderboard-body');
  if (tBody) {
    const list = Object.values(teamStats).sort((a, b) => b.wins - a.wins);
    if (list.length === 0) {
      tBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No teams recorded yet.</td></tr>`;
    } else {
      tBody.innerHTML = list.map(t => {
        const winPct = ((t.wins / Math.max(1, t.matches)) * 100).toFixed(1);
        return `
          <tr>
            <td class="fw-bold">${t.name}</td>
            <td class="text-center tabular-nums">${t.matches}</td>
            <td class="text-center fw-bold text-success tabular-nums">${t.wins}</td>
            <td class="text-center fw-bold text-danger tabular-nums">${t.losses}</td>
            <td class="text-center text-muted tabular-nums">${t.ties}</td>
            <td class="text-center fw-extrabold tabular-nums">${winPct}%</td>
          </tr>
        `;
      }).join('');
    }
  }
}

// Points Table Demo
function renderPointsTable() {
  const pBody = document.getElementById('points-table-body');
  if (!pBody) return;

  const defaultTeams = [
    { name: 'Thunder Strikers', p: 4, w: 3, l: 1, nr: 0, pts: 6, nrr: '+1.450' },
    { name: 'Royal Challengers', p: 4, w: 2, l: 2, nr: 0, pts: 4, nrr: '+0.230' },
    { name: 'Gully Kings', p: 4, w: 2, l: 2, nr: 0, pts: 4, nrr: '-0.110' },
    { name: 'Box Cricket Titans', p: 4, w: 1, l: 3, nr: 0, pts: 2, nrr: '-1.570' }
  ];

  pBody.innerHTML = defaultTeams.map(t => `
    <tr>
      <td class="text-start fw-bold">${t.name}</td>
      <td class="tabular-nums">${t.p}</td>
      <td class="text-success fw-bold tabular-nums">${t.w}</td>
      <td class="text-danger fw-bold tabular-nums">${t.l}</td>
      <td class="text-muted tabular-nums">${t.nr}</td>
      <td class="fw-extrabold fs-6 text-primary tabular-nums">${t.pts}</td>
      <td class="tabular-nums fw-semibold">${t.nrr}</td>
    </tr>
  `).join('');
}

// ============================================================================
// 12. HIDDEN ADMIN CONSOLE (URL /admin-login or #admin-login)
// ============================================================================

async function checkAdminView() {
  const gateWrap = document.getElementById('admin-gate-wrap');
  const dashWrap = document.getElementById('admin-dashboard-wrap');

  if (window.appState.adminLoggedIn || (window.appState.currentUser && window.appState.currentUser.email === ADMIN_EMAIL)) {
    if (gateWrap) gateWrap.classList.add('d-none');
    if (dashWrap) dashWrap.classList.remove('d-none');
    loadAdminDashboard();
  } else {
    if (gateWrap) gateWrap.classList.remove('d-none');
    if (dashWrap) dashWrap.classList.add('d-none');
  }
}

window.adminGoogleLogin = async function() {
  try {
    const user = await loginWithGoogle();
    if (user.email === ADMIN_EMAIL) {
      window.appState.adminLoggedIn = true;
      checkAdminView();
      showToast('Admin authenticated successfully!', 'success');
    } else {
      showToast(`User ${user.email} is not authorized as Master Admin.`, 'warning');
    }
  } catch (err) {
    showToast('Admin login error: ' + err.message, 'danger');
  }
};

window.verifyAdminPasscode = function() {
  const passcode = document.getElementById('input-admin-passcode').value;
  if (passcode === 'ashif2026' || passcode === 'gullyadmin') {
    window.appState.adminLoggedIn = true;
    checkAdminView();
    showToast('Admin unlocked via passcode!', 'success');
  } else {
    showToast('Incorrect passcode.', 'danger');
  }
};

window.exitAdmin = function() {
  window.appState.adminLoggedIn = false;
  window.location.hash = '#home';
};

async function loadAdminDashboard() {
  const stats = await fetchAdminStats();
  const emailSpan = document.getElementById('admin-user-email');
  if (emailSpan) emailSpan.textContent = ADMIN_EMAIL;

  if (stats) {
    document.getElementById('admin-stat-users').textContent = String(stats.totalUsers);
    document.getElementById('admin-stat-logins').textContent = String(stats.todayLogins);
    document.getElementById('admin-stat-matches').textContent = String(stats.matchesCreated);
    document.getElementById('admin-stat-live').textContent = String(stats.liveMatches);

    // Users table
    const usersBody = document.getElementById('admin-users-table-body');
    if (usersBody) {
      usersBody.innerHTML = stats.users.map(u => `
        <tr>
          <td class="fw-bold">${u.name}</td>
          <td>${u.email}</td>
          <td class="small text-muted font-monospace">${u.uid?.substring(0, 10)}...</td>
          <td class="small text-muted">${new Date(u.lastLogin || Date.now()).toLocaleDateString()}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-danger" onclick="window.adminDeleteUser('${u.uid}')"><i class="bi bi-trash"></i></button>
          </td>
        </tr>
      `).join('');
    }

    // Matches table
    const matchesBody = document.getElementById('admin-matches-table-body');
    if (matchesBody) {
      matchesBody.innerHTML = stats.matches.map(m => `
        <tr>
          <td class="small font-monospace">${m.id}</td>
          <td class="fw-bold">${m.teamA?.name} vs ${m.teamB?.name}</td>
          <td><span class="badge bg-secondary-subtle text-secondary">${m.status}</span></td>
          <td class="small text-muted">${new Date(m.createdAt).toLocaleDateString()}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-danger" onclick="window.deleteMatch('${m.id}')"><i class="bi bi-trash"></i></button>
          </td>
        </tr>
      `).join('');
    }
  }
}

window.adminDeleteUser = async function(userId) {
  if (confirm('Delete this user profile from Firestore?')) {
    await deleteUserFromFirestore(userId);
    loadAdminDashboard();
    showToast('User deleted.');
  }
};

// ============================================================================
// 13. QUICK PRESET & DEMO MATCH CREATOR
// ============================================================================

window.fillPresetTeamNames = function() {
  document.getElementById('input-team-a-name').value = 'Thunder Strikers';
  document.getElementById('input-team-b-name').value = 'Royal Challengers';
  showToast('Preset Gully teams loaded!');
};

window.quickDemoMatch = function() {
  const match = CricketEngine.createNewMatch({
    format: 'Limited Overs',
    playerCount: 11,
    overs: 5,
    venue: 'Ashif Cricket Turf',
    teamA: {
      name: 'Thunder Strikers',
      players: [
        { name: 'Mohammad Ashif', isCaptain: true },
        { name: 'Rohit Sharma', isKeeper: true },
        { name: 'Virat Kohli' },
        { name: 'Surya Kumar' },
        { name: 'Hardik Pandya' },
        { name: 'Rinku Singh' },
        { name: 'Axar Patel' },
        { name: 'Kuldeep Yadav' },
        { name: 'Jasprit Bumrah' },
        { name: 'Arshdeep Singh' },
        { name: 'Siraj' }
      ]
    },
    teamB: {
      name: 'Royal Challengers',
      players: [
        { name: 'Babar Azam', isCaptain: true },
        { name: 'Rizwan', isKeeper: true },
        { name: 'Fakhar Zaman' },
        { name: 'Iftikhar Ahmed' },
        { name: 'Shadab Khan' },
        { name: 'Imad Wasim' },
        { name: 'Shaheen Afridi' },
        { name: 'Naseem Shah' },
        { name: 'Haris Rauf' },
        { name: 'Amir' },
        { name: 'Abrar' }
      ]
    },
    toss: { winner: 'A', decision: 'BAT' }
  });

  // Pre-seed a few exciting deliveries for instant demonstration!
  CricketEngine.recordDelivery(match, 4);
  CricketEngine.recordDelivery(match, 1);
  CricketEngine.recordDelivery(match, 6);
  CricketEngine.recordDelivery(match, 0);
  CricketEngine.recordDelivery(match, 2);
  CricketEngine.recordDelivery(match, 1);

  window.appState.activeMatch = match;
  storage.setLiveMatch(match);
  storage.saveMatch(match);
  saveMatchToFirestore(match);

  showToast('Quick Match loaded! 1 over already scored for demonstration.', 'success');
  window.location.hash = '#live';
};

// Export JSON & CSV
window.exportAllMatchesJSON = function() {
  const data = JSON.stringify(window.appState.allMatches, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gully_cricket_matches_${Date.now()}.json`;
  a.click();
};

window.exportAllMatchesCSV = function() {
  const matches = window.appState.allMatches;
  let csv = 'MatchID,Date,Format,Overs,TeamA,TeamB,Result,PlayerOfTheMatch\n';
  matches.forEach(m => {
    csv += `"${m.id}","${m.createdAt}","${m.format}","${m.displayOvers}","${m.teamA.name}","${m.teamB.name}","${m.result?.summary || 'In Progress'}","${m.playerOfTheMatch || ''}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gully_cricket_matches_${Date.now()}.csv`;
  a.click();
};

// Global Toast Helper
function showToast(message, type = 'dark') {
  const toastEl = document.getElementById('app-toast');
  const msgEl = document.getElementById('toast-message');
  if (!toastEl || !msgEl) return;

  msgEl.innerHTML = `<i class="bi bi-info-circle-fill text-primary"></i> ${message}`;
  const toast = new bootstrap.Toast(toastEl, { delay: 3500 });
  toast.show();
}
