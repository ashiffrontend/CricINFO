/**
 * UI Controller Module
 * Gully Cricket Scorer
 * Designed & Developed by Ashif Web Studio
 * Developer: Mohammad Ashif (mohdashif.dev@gmail.com)
 */

import { StatsCalculator } from './stats.js';
import { HistoryManager } from './historyManager.js';
import { BowlingManager } from './bowlingManager.js';
import { BattingManager } from './battingManager.js';

export const UIController = {
  /**
   * Update the entire Live Scoreboard interface
   */
  updateLiveScoreboard(match) {
    if (!match) return;

    const inn = match.status === 'super_over' ?
      match.superOver.innings[match.superOver.currentInningsIndex] :
      match.innings[match.currentInningsIndex];

    if (!inn) return;

    // Header Teams
    const teamsHeader = document.getElementById('score-header-teams');
    if (teamsHeader) {
      const soBadge = match.status === 'super_over' ? ' [SUPER OVER]' : '';
      teamsHeader.textContent = `${inn.battingTeamName} vs ${inn.bowlingTeamName}${soBadge}`;
    }

    // Score & Overs
    const runsWickets = document.getElementById('score-runs-wickets');
    if (runsWickets) {
      runsWickets.textContent = `${inn.totalRuns}/${inn.wickets}`;
    }

    const oversDisplay = document.getElementById('score-overs-display');
    if (oversDisplay) {
      oversDisplay.textContent = inn.oversBowled;
    }

    const maxOvers = document.getElementById('score-max-overs');
    if (maxOvers) {
      maxOvers.textContent = String(inn.maxOvers);
    }

    // Run Rate (CRR)
    const crrDisplay = document.getElementById('score-crr-display');
    if (crrDisplay) {
      crrDisplay.textContent = StatsCalculator.calculateCRR(inn.totalRuns, inn.legalBalls);
    }

    // Current Striker
    const currBatter = document.getElementById('score-current-batter');
    const batterRuns = document.getElementById('score-batter-runs');
    const batterBalls = document.getElementById('score-batter-balls');

    const striker = (inn.batters || []).find(b => b.name === inn.strikeBatterName);
    if (currBatter) currBatter.textContent = `${inn.strikeBatterName || 'Batter 1'} *`;
    if (batterRuns) batterRuns.textContent = String(striker?.runs || 0);
    if (batterBalls) batterBalls.textContent = String(striker?.balls || 0);

    // Current Bowler
    const currBowler = document.getElementById('score-current-bowler');
    const bowlerWickets = document.getElementById('score-bowler-wickets');
    const bowlerRuns = document.getElementById('score-bowler-runs');
    const bowlerOvers = document.getElementById('score-bowler-overs');

    const bowler = (inn.bowlers || []).find(b => b.name === inn.currentBowlerName);
    if (currBowler) currBowler.textContent = inn.currentBowlerName || 'Bowler 1';
    if (bowlerWickets) bowlerWickets.textContent = String(bowler?.wickets || 0);
    if (bowlerRuns) bowlerRuns.textContent = String(bowler?.runs || 0);
    if (bowlerOvers) bowlerOvers.textContent = String(bowler?.overs || '0.0');

    // This Over Balls list
    UIController.renderThisOverBalls(inn.currentOverBalls || []);

    // Homepage Live Card Sync
    UIController.syncHomepageLiveCard(match, inn);
  },

  /**
   * Render badges for deliveries in current over
   */
  renderThisOverBalls(deliveries) {
    const container = document.getElementById('live-over-balls-list');
    if (!container) return;

    if (!deliveries || deliveries.length === 0) {
      container.innerHTML = '<span class="text-muted small fst-italic">Over starting...</span>';
      return;
    }

    container.innerHTML = deliveries.map(d => {
      let badgeClass = 'bg-white border text-dark';
      if (d.runs === 4) badgeClass = 'bg-success text-white fw-bold';
      else if (d.runs === 6) badgeClass = 'bg-primary text-white fw-bold';
      else if (d.isWicket) badgeClass = 'bg-danger text-white fw-bold';
      else if (d.extra === 'wide' || d.extra === 'noball') badgeClass = 'bg-warning-subtle text-dark border-warning';
      else if (d.runs === 0) badgeClass = 'bg-light text-secondary';

      return `<span class="badge ${badgeClass} rounded-2 px-2 py-2 fs-6 tabular-nums shadow-xs" title="${d.commentary || ''}">${d.display || '0'}</span>`;
    }).join('');
  },

  /**
   * Synchronize homepage live match banner
   */
  syncHomepageLiveCard(match, inn) {
    const container = document.getElementById('home-live-match-container');
    if (!container) return;

    if (!match || (match.status !== 'live' && match.status !== 'super_over')) {
      container.classList.add('d-none');
      return;
    }

    container.classList.remove('d-none');
    const teamsEl = document.getElementById('home-live-teams');
    const scoreEl = document.getElementById('home-live-score');
    const oversEl = document.getElementById('home-live-overs');
    const batterEl = document.getElementById('home-live-batter');
    const bowlerEl = document.getElementById('home-live-bowler');

    if (teamsEl) teamsEl.textContent = `${match.teamA?.name} vs ${match.teamB?.name}`;
    if (scoreEl) scoreEl.textContent = `${inn.totalRuns}/${inn.wickets}`;
    if (oversEl) oversEl.textContent = inn.oversBowled;
    if (batterEl) batterEl.textContent = inn.strikeBatterName || 'Batter';
    if (bowlerEl) bowlerEl.textContent = inn.currentBowlerName || 'Bowler';
  },

  /**
   * Render Over History modal content
   */
  renderOverHistoryModal(innings) {
    const body = document.getElementById('over-history-modal-body');
    if (!body || !innings) return;

    const overs = HistoryManager.computeOverHistory(innings);
    if (overs.length === 0) {
      body.innerHTML = '<div class="text-center p-4 text-muted">No overs bowled yet in this innings.</div>';
      return;
    }

    body.innerHTML = overs.map(ov => `
      <div class="card border rounded-3 mb-3 p-3 bg-light">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <div>
            <strong class="text-primary">Over ${ov.overNumber}</strong>
            <span class="text-muted small ms-2">Bowler: <strong>${ov.bowler || 'Bowler'}</strong></span>
          </div>
          <div>
            <span class="badge bg-dark rounded-pill">${ov.runs} Runs</span>
            ${ov.wickets > 0 ? `<span class="badge bg-danger rounded-pill ms-1">${ov.wickets} Wicket(s)</span>` : ''}
          </div>
        </div>
        <div class="d-flex gap-2 flex-wrap mb-2">
          ${ov.deliveries.map(d => `
            <span class="badge ${d.isWicket ? 'bg-danger text-white' : (d.runs === 4 ? 'bg-success' : (d.runs === 6 ? 'bg-primary' : 'bg-white border text-dark'))} rounded-2 p-2">
              ${d.display}
            </span>
          `).join('')}
        </div>
        <div class="small text-muted border-top pt-2 mt-1">
          ${ov.deliveries.map(d => `<div class="mb-1"><strong>${d.ballNotation}</strong>: ${d.commentary || ''}</div>`).join('')}
        </div>
      </div>
    `).join('');
  },

  /**
   * Render Official Detailed Scorecard Modal
   */
  renderScorecardModal(match) {
    const container = document.getElementById('printable-scorecard-content');
    if (!container || !match) return;

    const renderInningsTable = (inn, idx) => {
      if (!inn) return '';
      return `
        <div class="card border rounded-4 p-3 mb-4 shadow-xs">
          <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
            <div>
              <span class="badge bg-primary-subtle text-primary fw-bold">Innings ${idx + 1}</span>
              <h5 class="fw-bold mb-0 text-dark">${inn.battingTeamName}</h5>
            </div>
            <div class="text-end">
              <h4 class="fw-black mb-0 text-primary tabular-nums">${inn.totalRuns}/${inn.wickets}</h4>
              <small class="text-muted">(${inn.oversBowled} / ${inn.maxOvers} ov, CRR: ${StatsCalculator.calculateCRR(inn.totalRuns, inn.legalBalls)})</small>
            </div>
          </div>

          <!-- Batting Table -->
          <div class="table-responsive mb-3">
            <table class="table table-sm table-hover align-middle mb-0 small">
              <thead class="table-light">
                <tr>
                  <th>Batter</th>
                  <th>Dismissal</th>
                  <th class="text-center">R</th>
                  <th class="text-center">B</th>
                  <th class="text-center">4s</th>
                  <th class="text-center">6s</th>
                  <th class="text-end">SR</th>
                </tr>
              </thead>
              <tbody>
                ${(inn.batters || []).map(b => `
                  <tr>
                    <td class="fw-bold">${b.name} ${b.isCaptain ? '(c)' : ''} ${b.isKeeper ? '(wk)' : ''} ${b.status === 'batting' ? '*' : ''}</td>
                    <td class="text-muted">${b.dismissal ? b.dismissal : (b.status === 'batting' ? '<span class="text-success fw-bold">not out</span>' : '<span class="text-muted">yet to bat</span>')}</td>
                    <td class="text-center fw-bold tabular-nums">${b.runs || 0}</td>
                    <td class="text-center text-muted tabular-nums">${b.balls || 0}</td>
                    <td class="text-center text-muted tabular-nums">${b.fours || 0}</td>
                    <td class="text-center text-muted tabular-nums">${b.sixes || 0}</td>
                    <td class="text-end text-muted tabular-nums">${b.strikeRate || '0.0'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Extras breakdown -->
          <div class="p-2 bg-light rounded-3 small d-flex justify-content-between mb-3 border">
            <div>
              <span class="fw-bold text-dark">Extras:</span>
              <span class="text-muted ms-1">(wd ${inn.extras?.wides || 0}, nb ${inn.extras?.noBalls || 0}, b ${inn.extras?.byes || 0}, lb ${inn.extras?.legByes || 0}, p ${inn.extras?.penalty || 0})</span>
            </div>
            <strong class="text-dark tabular-nums">${inn.extras?.total || 0}</strong>
          </div>

          <!-- Bowling Table -->
          <h6 class="fw-bold small text-muted text-uppercase mb-2">Bowling Figures</h6>
          <div class="table-responsive">
            <table class="table table-sm table-hover align-middle mb-0 small">
              <thead class="table-light">
                <tr>
                  <th>Bowler</th>
                  <th class="text-center">O</th>
                  <th class="text-center">M</th>
                  <th class="text-center">R</th>
                  <th class="text-center">W</th>
                  <th class="text-end">ECON</th>
                </tr>
              </thead>
              <tbody>
                ${(inn.bowlers || []).filter(bw => bw.legalBalls > 0 || bw.runs > 0).map(bw => `
                  <tr>
                    <td class="fw-bold">${bw.name}</td>
                    <td class="text-center tabular-nums">${bw.overs || '0.0'}</td>
                    <td class="text-center tabular-nums">${bw.maidens || 0}</td>
                    <td class="text-center tabular-nums fw-bold">${bw.runs || 0}</td>
                    <td class="text-center tabular-nums text-danger fw-bold">${bw.wickets || 0}</td>
                    <td class="text-end tabular-nums">${bw.economy || '0.00'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Fall of Wickets -->
          ${inn.fallOfWickets && inn.fallOfWickets.length > 0 ? `
            <div class="mt-3 pt-2 border-top">
              <h6 class="fw-bold small text-muted text-uppercase mb-1">Fall of Wickets</h6>
              <div class="small text-muted">
                ${inn.fallOfWickets.map(f => `<span class="me-3"><strong>${f.score}/${f.wicketNumber}</strong> (${f.batterName}, ${f.overs} ov)</span>`).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      `;
    };

    container.innerHTML = match.innings.map((inn, idx) => renderInningsTable(inn, idx)).join('');
  }
};
