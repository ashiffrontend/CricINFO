/**
 * Professional PDF Scorecard & Print Generator
 * Gully Cricket Scorer
 * Designed & Developed by Ashif Web Studio
 * Developer: Mohammad Ashif (mohdashif.dev@gmail.com)
 */

export class PDFExport {
  /**
   * Render complete HTML Scorecard ready for printing / PDF saving
   */
  static renderScorecardHTML(match) {
    if (!match) return '<div class="alert alert-warning">No match data available.</div>';

    const inn1 = match.innings[0];
    const inn2 = match.innings[1];
    const matchDate = new Date(match.createdAt || Date.now()).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const renderInningsTable = (inn, label) => {
      if (!inn) return '';
      return `
        <div class="scorecard-innings-block mb-4 p-3 rounded-4 border bg-white">
          <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
            <div>
              <h5 class="fw-bold mb-0 text-primary">${inn.battingTeamName} — ${label}</h5>
              <small class="text-muted">Bowling: ${inn.bowlingTeamName}</small>
            </div>
            <div class="text-end">
              <span class="fs-4 fw-black tabular-nums text-dark">${inn.totalRuns}/${inn.wickets}</span>
              <small class="text-muted d-block">(${inn.oversBowled} / ${inn.maxOvers === 999 ? 'Test' : inn.maxOvers} ov)</small>
            </div>
          </div>

          <!-- Batting Table -->
          <h6 class="fw-bold text-muted small mb-2 text-uppercase">Batting Scorecard</h6>
          <div class="table-responsive mb-3">
            <table class="table table-sm align-middle table-hover mb-0">
              <thead class="table-light small">
                <tr>
                  <th>Batter</th>
                  <th>Dismissal</th>
                  <th>Bowler</th>
                  <th class="text-end">R</th>
                  <th class="text-end">B</th>
                  <th class="text-end">4s</th>
                  <th class="text-end">6s</th>
                  <th class="text-end">SR</th>
                </tr>
              </thead>
              <tbody>
                ${inn.batters.map(b => `
                  <tr>
                    <td class="fw-semibold">
                      ${b.name}
                      ${b.isCaptain ? '<span class="badge bg-secondary-subtle text-secondary ms-1">C</span>' : ''}
                      ${b.isKeeper ? '<span class="badge bg-secondary-subtle text-secondary ms-1">WK</span>' : ''}
                    </td>
                    <td class="small text-muted">${b.dismissal ? b.dismissal : (b.status === 'batting' ? '<span class="text-success fw-bold">not out</span>' : 'yet to bat')}</td>
                    <td class="small text-muted">${b.bowler ? b.bowler : '—'}</td>
                    <td class="text-end fw-bold tabular-nums">${b.runs}</td>
                    <td class="text-end tabular-nums text-muted">${b.balls}</td>
                    <td class="text-end tabular-nums">${b.fours}</td>
                    <td class="text-end tabular-nums">${b.sixes}</td>
                    <td class="text-end tabular-nums">${b.strikeRate}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Extras & Total -->
          <div class="d-flex justify-content-between p-2 rounded-3 bg-light small mb-3">
            <span>Extras: <strong>${inn.extras.total}</strong> (wd: ${inn.extras.wides}, nb: ${inn.extras.noBalls}, b: ${inn.extras.byes}, lb: ${inn.extras.legByes}, p: ${inn.extras.penalty})</span>
            <span>Total: <strong>${inn.totalRuns}/${inn.wickets}</strong> (${inn.oversBowled} overs, RR: ${(inn.totalRuns / Math.max(0.166, inn.legalBalls / 6)).toFixed(2)})</span>
          </div>

          <!-- Fall of Wickets -->
          ${inn.fallOfWickets && inn.fallOfWickets.length > 0 ? `
            <div class="small mb-3">
              <strong class="text-muted d-block mb-1">Fall of Wickets:</strong>
              <div class="text-muted">
                ${inn.fallOfWickets.map(fow => `${fow.score}-${fow.wicketNumber} (${fow.batterName}, ${fow.overs} ov)`).join(', ')}
              </div>
            </div>
          ` : ''}

          <!-- Bowling Table -->
          <h6 class="fw-bold text-muted small mb-2 text-uppercase">Bowling Figures</h6>
          <div class="table-responsive">
            <table class="table table-sm align-middle table-hover mb-0">
              <thead class="table-light small">
                <tr>
                  <th>Bowler</th>
                  <th class="text-end">O</th>
                  <th class="text-end">M</th>
                  <th class="text-end">R</th>
                  <th class="text-end">W</th>
                  <th class="text-end">ECON</th>
                  <th class="text-end">WD</th>
                  <th class="text-end">NB</th>
                </tr>
              </thead>
              <tbody>
                ${inn.bowlers.filter(bw => bw.legalBalls > 0 || bw.runs > 0).map(bw => `
                  <tr>
                    <td class="fw-semibold">${bw.name}</td>
                    <td class="text-end tabular-nums">${bw.overs}</td>
                    <td class="text-end tabular-nums">${bw.maidens}</td>
                    <td class="text-end tabular-nums fw-bold">${bw.runs}</td>
                    <td class="text-end tabular-nums fw-extrabold text-danger">${bw.wickets}</td>
                    <td class="text-end tabular-nums">${bw.economy}</td>
                    <td class="text-end tabular-nums text-muted">${bw.wides}</td>
                    <td class="text-end tabular-nums text-muted">${bw.noBalls}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    };

    return `
      <div class="pdf-container p-3 p-md-4 bg-white text-dark">
        <!-- PDF Header -->
        <div class="d-flex align-items-center justify-content-between border-bottom pb-3 mb-4">
          <div class="d-flex align-items-center gap-3">
            <img src="/assets/aistudio/Ashif_Web_Studio_Frontend_Developer_logo_229c6c9e.png" alt="Ashif Web Studio" width="60" height="60" class="rounded-circle border" />
            <div>
              <h3 class="fw-extrabold mb-0 text-primary">GULLY CRICKET SCORER</h3>
              <small class="text-muted fw-semibold">Official Match Certificate & Scorecard</small>
            </div>
          </div>
          <div class="text-end small text-muted">
            <div><strong>Date:</strong> ${matchDate}</div>
            <div><strong>Venue:</strong> ${match.venue || 'Gully Arena'}</div>
            <div><strong>Format:</strong> ${match.format} (${match.displayOvers} Overs)</div>
          </div>
        </div>

        <!-- Match Result Banner -->
        <div class="p-3 rounded-4 bg-primary text-white text-center mb-4 shadow-sm">
          <span class="badge bg-white text-primary rounded-pill mb-1">FINAL RESULT</span>
          <h4 class="fw-black mb-1">${match.result?.summary || 'Match in Progress'}</h4>
          ${match.playerOfTheMatch ? `<div class="small fw-bold text-white-50"><i class="bi bi-star-fill text-warning me-1"></i>Player of the Match: ${match.playerOfTheMatch}</div>` : ''}
        </div>

        <!-- Teams Strip -->
        <div class="row g-3 text-center mb-4">
          <div class="col-6">
            <div class="p-3 bg-light rounded-3 border">
              <span class="text-muted small d-block">TEAM 1</span>
              <strong class="fs-5">${match.teamA.name}</strong>
            </div>
          </div>
          <div class="col-6">
            <div class="p-3 bg-light rounded-3 border">
              <span class="text-muted small d-block">TEAM 2</span>
              <strong class="fs-5">${match.teamB.name}</strong>
            </div>
          </div>
        </div>

        <!-- Innings 1 -->
        ${renderInningsTable(inn1, '1st Innings')}

        <!-- Innings 2 -->
        ${renderInningsTable(inn2, '2nd Innings')}

        <!-- Footer -->
        <div class="border-top pt-4 mt-4 text-center text-muted small">
          <p class="mb-1 fw-bold text-dark">Designed & Developed by <span class="text-primary">Ashif Web Studio</span></p>
          <p class="mb-1">Developer: <strong>Mohammad Ashif</strong> · Email: <a href="mailto:mohdashif.dev@gmail.com" class="text-decoration-none">mohdashif.dev@gmail.com</a></p>
          <p class="mb-0">Website: <a href="https://ashif-web-studio.vercel.app" target="_blank" rel="noopener noreferrer" class="text-decoration-none">https://ashif-web-studio.vercel.app</a></p>
        </div>
      </div>
    `;
  }

  /**
   * Print Scorecard using browser native print dialog (save as PDF)
   */
  static printScorecard() {
    window.print();
  }
}
