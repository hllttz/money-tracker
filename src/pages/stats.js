import { store } from '../store.js';
import { exchangeService } from '../exchange.js';
import { getIcon } from '../icons.js';

const DONUT_DURATION = 780;

export function renderStats() {
  const currencyCode = store.getSettings().currency;
  const rates = exchangeService.getCachedRates();
  const convertFn = (amount, txCurrency) => {
    return exchangeService.convert(amount, txCurrency || exchangeService.BASE_CURRENCY, currencyCode, rates);
  };
  
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const stats = store.getMonthlyStats(year, month, convertFn);
  const breakdown = store.getCategoryBreakdown(year, month, 'expense', convertFn);
  const weeklyTrend = store.getWeeklyTrend(year, month, convertFn);
  
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  const totalExpense = stats.expense;
  const totalIncome = stats.income;
  const maxWeekly = Math.max(...weeklyTrend, 1);

  // Colors for donut chart
  const donutColors = ['#ff9f43', '#4a6cf7', '#ee5a8f', '#a855f7', '#34c895', '#f25f5c', '#3b82f6', '#6b7085'];

  const page = document.createElement('div');
  page.className = 'page stats-page';
  page.innerHTML = `
    <header class="page-header">
      <h1 class="page-title">统计</h1>
      <p class="page-subtitle">${year}年${monthNames[month]}</p>
    </header>

    <div class="stats-overview">
      <div class="stat-card">
        <div class="stat-head">
          <span class="stat-circle-icon expense">${getIcon('arrowUp', 14)}</span>
          <div class="stat-label">本月支出</div>
        </div>
        <div class="stat-value expense">${exchangeService.formatConverted(totalExpense, currencyCode)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-head">
          <span class="stat-circle-icon income">${getIcon('arrowDown', 14)}</span>
          <div class="stat-label">本月收入</div>
        </div>
        <div class="stat-value income">${exchangeService.formatConverted(totalIncome, currencyCode)}</div>
      </div>
    </div>

    <div class="chart-section">
      <h3 class="section-title">支出构成</h3>
      <div class="donut-container">
        <canvas id="donut-chart" width="140" height="140"></canvas>
        <div class="donut-center">
          <div class="donut-total-label">总支出</div>
          <div class="donut-total-value">${exchangeService.formatConverted(totalExpense, currencyCode)}</div>
        </div>
      </div>
      <div class="breakdown-list">
        ${breakdown.length === 0 ? '<p class="empty-hint" style="text-align:center;color:var(--text-tertiary);padding:var(--space-lg)">暂无数据</p>' :
          breakdown.map((item, i) => {
            const itemAmount = item.amount;
            const pct = totalExpense > 0 ? ((itemAmount / totalExpense) * 100).toFixed(1) : 0;
            return `
              <div class="breakdown-item stagger-item" style="animation-delay: ${i * 50}ms">
                <div class="breakdown-dot" style="background: ${donutColors[i % donutColors.length]}; animation-delay: ${80 + i * 55}ms"></div>
                <span class="breakdown-name">${item.name}</span>
                <span class="breakdown-pct">${pct}%</span>
                <span class="breakdown-amount">${exchangeService.formatConverted(itemAmount, currencyCode)}</span>
              </div>
            `;
          }).join('')}
      </div>
    </div>

    <div class="chart-section">
      <h3 class="section-title">每周趋势</h3>
      <div class="bar-chart">
        ${weeklyTrend.map((val, i) => `
          <div class="bar-col">
            <div class="bar-fill" style="height: ${maxWeekly > 0 ? (val / maxWeekly * 100) : 0}%; animation-delay: ${i * 80}ms"></div>
            <div class="bar-label">第${i + 1}周</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Draw donut chart after render
  requestAnimationFrame(() => {
    drawDonutChart();
  });

  return page;

  function drawDonutChart() {
    const canvas = page.querySelector('#donut-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Fix DPR scaling on Android
    const dpr = window.devicePixelRatio || 1;
    const baseSize = 140;
    canvas.width = baseSize * dpr;
    canvas.height = baseSize * dpr;
    canvas.style.width = baseSize + 'px';
    canvas.style.height = baseSize + 'px';
    
    ctx.scale(dpr, dpr);
    
    const cx = baseSize / 2;
    const cy = baseSize / 2;
    const radius = baseSize / 2 - 12;

    const prefersReducedMotion = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (breakdown.length === 0) {
      drawRingTrack();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.lineWidth = 12;
      ctx.strokeStyle = '#2a2b36'; // Empty state color
      ctx.stroke();
      return;
    }

    const actualTotal = breakdown.reduce((sum, item) => sum + item.amount, 0);
    const segments = breakdown.map((item, i) => ({
      angle: (item.amount / actualTotal) * (Math.PI * 2),
      color: donutColors[i % donutColors.length],
    }));

    if (prefersReducedMotion) {
      renderDonut(1);
      return;
    }

    const startTs = performance.now();
    function tick(now) {
      const elapsed = now - startTs;
      const progress = Math.min(elapsed / DONUT_DURATION, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      renderDonut(eased);

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }

    requestAnimationFrame(tick);

    function renderDonut(progress) {
      ctx.clearRect(0, 0, baseSize, baseSize);
      drawRingTrack();

      let remainingAngle = Math.PI * 2 * progress;
      let currentStart = -Math.PI / 2;

      segments.forEach((segment) => {
        if (remainingAngle <= 0) return;

        const drawAngle = Math.min(segment.angle, remainingAngle);
        ctx.beginPath();
        ctx.arc(cx, cy, radius, currentStart, currentStart + drawAngle, false);
        ctx.lineWidth = 12;
        ctx.lineCap = 'round';
        ctx.strokeStyle = segment.color;
        ctx.stroke();

        currentStart += segment.angle;
        remainingAngle -= drawAngle;
      });
    }

    function drawRingTrack() {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.lineWidth = 12;
      ctx.strokeStyle = '#edf0f6';
      ctx.stroke();
    }
  }
}

// Stats page styles
const style = document.createElement('style');
style.textContent = `
  .stats-page {
    padding-top: var(--space-4xl);
  }

  .stats-overview {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-md);
    margin-bottom: var(--space-2xl);
  }

  .stat-card {
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    padding: var(--space-lg);
    box-shadow: var(--shadow-card);
    animation: scaleIn var(--duration-normal) var(--ease-smooth) both;
    transition: transform var(--duration-fast) var(--ease-smooth), box-shadow var(--duration-fast) var(--ease-smooth);
  }

  .stat-card:nth-child(2) {
    animation-delay: 110ms;
  }

  .stat-card:active {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  .stat-head {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    margin-bottom: var(--space-xs);
  }

  .stat-circle-icon {
    width: 24px;
    height: 24px;
    border-radius: var(--radius-full);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    animation: iconFadeScaleIn var(--duration-slow) var(--ease-smooth) both;
    transition: transform var(--duration-fast) var(--ease-smooth), filter var(--duration-fast) var(--ease-smooth);
  }

  .stat-card:nth-child(2) .stat-circle-icon {
    animation-delay: 130ms;
  }

  .stat-circle-icon.expense {
    color: #9f4f34;
    background: rgba(255, 159, 67, 0.18);
  }

  .stat-circle-icon.income {
    color: #147457;
    background: rgba(52, 200, 149, 0.18);
  }

  .stat-label {
    font-size: var(--font-xs);
    color: var(--text-tertiary);
    font-weight: var(--weight-medium);
  }

  .stat-value {
    font-size: var(--font-xl);
    font-weight: var(--weight-bold);
    letter-spacing: -0.5px;
  }

  .stat-value.expense { color: var(--text-primary); }
  .stat-value.income { color: var(--income); }

  .chart-section {
    margin-bottom: var(--space-2xl);
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    padding: var(--space-xl);
    box-shadow: var(--shadow-card);
    animation: fadeIn var(--duration-slow) var(--ease-smooth) both;
  }

  .chart-section:nth-child(4) {
    animation-delay: 220ms;
  }

  .chart-section .section-title {
    margin-bottom: var(--space-lg);
  }

  .donut-container {
    position: relative;
    width: 140px;
    height: 140px;
    margin: 0 auto var(--space-lg);
    animation: iconFadeScaleIn var(--duration-slow) var(--ease-smooth) both;
  }

  .donut-center {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    animation: centerFadeScaleIn 420ms var(--ease-ios) 120ms both;
  }

  .donut-total-label {
    font-size: var(--font-xs);
    color: var(--text-tertiary);
  }

  .donut-total-value {
    font-size: var(--font-lg);
    font-weight: var(--weight-bold);
    margin-top: 2px;
  }

  .breakdown-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .breakdown-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-xs) 0;
  }

  .breakdown-dot {
    width: 8px;
    height: 8px;
    border-radius: var(--radius-full);
    flex-shrink: 0;
    animation: iconFadeScaleIn var(--duration-normal) var(--ease-smooth) both;
    transform-origin: center;
    transition: transform var(--duration-fast) var(--ease-smooth), filter var(--duration-fast) var(--ease-smooth);
  }

  .breakdown-item:active .breakdown-dot {
    transform: scale(1.34);
    filter: brightness(1.06);
  }

  .breakdown-name {
    flex: 1;
    font-size: var(--font-sm);
    font-weight: var(--weight-medium);
  }

  .breakdown-pct {
    font-size: var(--font-sm);
    color: var(--text-tertiary);
    width: 48px;
    text-align: right;
  }

  .breakdown-amount {
    font-size: var(--font-sm);
    font-weight: var(--weight-semibold);
    min-width: 80px;
    text-align: right;
  }

  .bar-chart {
    display: flex;
    align-items: flex-end;
    gap: var(--space-md);
    height: 140px;
    padding: var(--space-lg) 0;
  }

  .bar-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-sm);
    height: 100%;
    justify-content: flex-end;
  }

  .bar-fill {
    width: 100%;
    max-width: 36px;
    border-radius: var(--radius-sm) var(--radius-sm) 0 0;
    background: var(--accent-gradient);
    min-height: 4px;
    transform-origin: bottom;
    animation: barGrow var(--duration-slow) var(--ease-smooth) both;
  }

  .bar-label {
    font-size: var(--font-xs);
    color: var(--text-tertiary);
    font-weight: var(--weight-medium);
  }
`;
document.head.appendChild(style);
