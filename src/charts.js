/**
 * High Performance HTML5 Canvas Cricket Visual Analytics
 * Gully Cricket Scorer
 * Designed & Developed by Ashif Web Studio
 */

export class CricketCharts {
  /**
   * Render Manhattan Bar Chart (Runs per Over + Wicket Markers)
   */
  static renderManhattan(canvasId, deliveries = []) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Group runs and wickets by over
    const oversData = {};
    deliveries.forEach(d => {
      const overNum = d.overNumber || 1;
      if (!oversData[overNum]) {
        oversData[overNum] = { runs: 0, wickets: 0 };
      }
      oversData[overNum].runs += (d.runs || 0) + (d.extraRuns || 0);
      if (d.isWicket) oversData[overNum].wickets += 1;
    });

    const overKeys = Object.keys(oversData).map(Number).sort((a, b) => a - b);
    if (overKeys.length === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px Plus Jakarta Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No over data available yet', width / 2, height / 2);
      return;
    }

    const maxRuns = Math.max(12, ...overKeys.map(k => oversData[k].runs));
    const padding = { top: 30, right: 20, bottom: 40, left: 40 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // Draw grid lines
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px JetBrains Mono, monospace';
    ctx.textAlign = 'right';

    const gridSteps = 4;
    for (let i = 0; i <= gridSteps; i++) {
      const val = Math.round((maxRuns / gridSteps) * i);
      const y = padding.top + chartH - (i / gridSteps) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      ctx.fillText(String(val), padding.left - 6, y + 4);
    }

    // Draw Bars
    const barWidth = Math.max(12, Math.min(32, (chartW / overKeys.length) - 8));
    const barSpacing = chartW / overKeys.length;

    overKeys.forEach((overNum, idx) => {
      const data = oversData[overNum];
      const barH = (data.runs / maxRuns) * chartH;
      const x = padding.left + (idx * barSpacing) + (barSpacing - barWidth) / 2;
      const y = padding.top + chartH - barH;

      // Gradient for Bar
      const grad = ctx.createLinearGradient(0, y, 0, y + barH);
      grad.addColorStop(0, '#0d6efd');
      grad.addColorStop(1, '#60a5fa');
      ctx.fillStyle = grad;

      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, Math.max(2, barH), [4, 4, 0, 0]);
      ctx.fill();

      // Over label
      ctx.fillStyle = '#64748b';
      ctx.font = '11px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Ov ${overNum}`, x + barWidth / 2, height - padding.bottom + 18);

      // Runs label on bar
      if (data.runs > 0) {
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 11px JetBrains Mono, monospace';
        ctx.fillText(String(data.runs), x + barWidth / 2, y - 6);
      }

      // Wickets badge (Red circle)
      if (data.wickets > 0) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(x + barWidth / 2, y - 18, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px JetBrains Mono, monospace';
        ctx.fillText(data.wickets > 1 ? String(data.wickets) : 'W', x + barWidth / 2, y - 15);
      }
    });
  }

  /**
   * Render Worm Graph (Cumulative score progression of Team A vs Team B)
   */
  static renderWorm(canvasId, match) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !match) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const inn1 = match.innings[0];
    const inn2 = match.innings[1];

    if (!inn1 || inn1.allDeliveries.length === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px Plus Jakarta Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Worm graph will appear as deliveries are bowled', width / 2, height / 2);
      return;
    }

    // Build cumulative scores
    const getProgression = (inn) => {
      if (!inn) return [];
      let total = 0;
      let legal = 0;
      const points = [{ ball: 0, runs: 0 }];
      inn.allDeliveries.forEach(d => {
        total += (d.runs || 0) + (d.extraRuns || 0);
        if (d.isLegal) legal += 1;
        points.push({ ball: legal, runs: total, isWicket: !!d.isWicket });
      });
      return points;
    };

    const pts1 = getProgression(inn1);
    const pts2 = getProgression(inn2);

    const maxBalls = Math.max(inn1.maxOvers * 6, pts1[pts1.length - 1]?.ball || 0, pts2[pts2.length - 1]?.ball || 0);
    const maxScore = Math.max(20, (inn1.totalRuns || 0) + 15, (inn2?.totalRuns || 0) + 15);

    const padding = { top: 30, right: 30, bottom: 40, left: 45 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // Grid
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'right';

    for (let i = 0; i <= 4; i++) {
      const val = Math.round((maxScore / 4) * i);
      const y = padding.top + chartH - (i / 4) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      ctx.fillText(String(val), padding.left - 6, y + 4);
    }

    const drawLine = (pts, color, label) => {
      if (pts.length < 2) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      pts.forEach((p, idx) => {
        const x = padding.left + (p.ball / maxBalls) * chartW;
        const y = padding.top + chartH - (p.runs / maxScore) * chartH;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Draw Wicket dots
      pts.filter(p => p.isWicket).forEach(p => {
        const x = padding.left + (p.ball / maxBalls) * chartW;
        const y = padding.top + chartH - (p.runs / maxScore) * chartH;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    // Draw Team 1 line (Blue)
    drawLine(pts1, '#0d6efd', inn1.battingTeamName);

    // Draw Team 2 line (Red) if exists
    if (pts2.length > 0) {
      drawLine(pts2, '#ef4444', inn2?.battingTeamName);
    }

    // Legend
    ctx.font = 'bold 11px Plus Jakarta Sans, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#0d6efd';
    ctx.fillRect(width - 170, 10, 12, 12);
    ctx.fillText(`${inn1.battingTeamName} (${inn1.totalRuns}/${inn1.wickets})`, width - 152, 20);

    if (inn2) {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(width - 170, 26, 12, 12);
      ctx.fillText(`${inn2.battingTeamName} (${inn2.totalRuns}/${inn2.wickets})`, width - 152, 36);
    }
  }

  /**
   * Render Current vs Required Run Rate curve
   */
  static renderRunRate(canvasId, match) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !match) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const inn = match.innings[match.currentInningsIndex];
    if (!inn || inn.allDeliveries.length === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px Plus Jakarta Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Run rate curve will plot as overs proceed', width / 2, height / 2);
      return;
    }

    // CRR calculation at each legal ball
    let cumulativeRuns = 0;
    let legalCount = 0;
    const crrPoints = [];

    inn.allDeliveries.forEach(d => {
      cumulativeRuns += (d.runs || 0) + (d.extraRuns || 0);
      if (d.isLegal) {
        legalCount += 1;
        const crr = (cumulativeRuns / (legalCount / 6));
        crrPoints.push({ over: legalCount / 6, crr });
      }
    });

    if (crrPoints.length === 0) return;

    const maxRate = Math.max(14, ...crrPoints.map(p => p.crr));
    const padding = { top: 30, right: 20, bottom: 40, left: 40 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // Grid
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'right';

    for (let i = 0; i <= 3; i++) {
      const val = ((maxRate / 3) * i).toFixed(1);
      const y = padding.top + chartH - (i / 3) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      ctx.fillText(String(val), padding.left - 6, y + 4);
    }

    // Plot CRR
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const maxOvers = inn.maxOvers;
    crrPoints.forEach((p, idx) => {
      const x = padding.left + (p.over / maxOvers) * chartW;
      const y = padding.top + chartH - (p.crr / maxRate) * chartH;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Legend
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 12px Plus Jakarta Sans, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Current Run Rate (CRR): ${(inn.totalRuns / Math.max(0.166, inn.legalBalls / 6)).toFixed(2)}`, padding.left, 18);
  }
}
