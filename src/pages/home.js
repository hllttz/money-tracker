import { store } from '../store.js';
import { getIcon } from '../icons.js';
import { exchangeService } from '../exchange.js';
import { openCurrencyPicker } from '../components/currencyPicker.js';

function formatRateUpdate(snapshot) {
  if (!snapshot.timestamp) return '离线汇率';

  const diffMs = Date.now() - snapshot.timestamp;
  if (diffMs < 60 * 1000) return '刚刚更新';
  if (diffMs < 60 * 60 * 1000) return `${Math.floor(diffMs / (60 * 1000))} 分钟前更新`;

  return `更新于 ${new Date(snapshot.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
}

function getMonthlyExpenseByCurrency(year, month, rates) {
  const txs = store.getTransactions().filter((tx) => {
    if (tx.type !== 'expense') return false;
    const d = new Date(tx.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  return exchangeService.CURRENCIES.map((currency) => {
    const amount = txs.reduce((sum, tx) => {
      return sum + exchangeService.convert(tx.amount, tx.currency || exchangeService.BASE_CURRENCY, currency.code, rates);
    }, 0);

    return {
      ...currency,
      amount,
    };
  });
}

export function renderHome() {
  const settings = store.getSettings();
  const currentDisplayCurrency = settings.currency;
  const snapshot = exchangeService.getSnapshot();
  const exchangeRates = snapshot.rates;

  const convertFn = (amount, txCurrency) => {
    return exchangeService.convert(amount, txCurrency || exchangeService.BASE_CURRENCY, currentDisplayCurrency, exchangeRates);
  };

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const stats = store.getMonthlyStats(year, month, convertFn);
  const recentTxs = store.getTransactions().slice(0, 5);
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  const displayCurr = exchangeService.CURRENCIES.find((c) => c.code === currentDisplayCurrency);
  const displaySymbol = displayCurr?.symbol || '¥';

  const displayBalance = stats.balance;
  const displayIncome = stats.income;
  const displayExpense = stats.expense;

  const multiCurrencyExpenses = getMonthlyExpenseByCurrency(year, month, exchangeRates);
  const rateSummaryCodes = ['USD', 'EUR', 'JPY'];

  const page = document.createElement('div');
  page.className = 'page home-page';
  page.innerHTML = `
    <header class="home-header">
      <div class="home-greeting">
        <h1 class="home-title">记账</h1>
        <p class="home-date">${year}年${monthNames[month]}</p>
      </div>
      <button class="currency-chip" id="currency-chip">
        <span class="currency-chip-sym">${displayCurr?.symbol || '¥'}</span>
        <span class="currency-chip-name">${displayCurr?.name || '人民币'}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </button>
    </header>

    <section class="rate-panel">
      <div class="rate-panel-top">
        <span class="rate-icon">${getIcon('chart', 12)}</span>
        <span class="rate-dot ${snapshot.isStale ? 'stale' : ''}"></span>
        <span class="rate-status">${snapshot.isFetching ? '同步中' : '汇率'}</span>
        <span class="rate-time">${formatRateUpdate(snapshot)}</span>
      </div>
      <div class="rate-summary">
        ${rateSummaryCodes.map((code) => `${code} ${exchangeRates[code]?.toFixed(code === 'JPY' ? 2 : 4) || '—'}`).join(' · ')}
      </div>
    </section>

    <div class="balance-card">
      <div class="balance-label">本月结余</div>
      <div class="balance-amount">
        <span class="balance-sign">${displayBalance >= 0 ? '+' : ''}</span>
        <span class="balance-currency">${displaySymbol}</span>
        <span class="balance-value">${Math.abs(displayBalance).toFixed(currentDisplayCurrency === 'JPY' || currentDisplayCurrency === 'KRW' ? 0 : 2)}</span>
      </div>
      <div class="balance-row">
        <div class="balance-item income">
          <span class="balance-item-icon">${getIcon('arrowDown', 16)}</span>
          <div>
            <div class="balance-item-label">收入</div>
            <div class="balance-item-value">${exchangeService.formatConverted(displayIncome, currentDisplayCurrency)}</div>
          </div>
        </div>
        <div class="balance-divider"></div>
        <div class="balance-item expense">
          <span class="balance-item-icon">${getIcon('arrowUp', 16)}</span>
          <div>
            <div class="balance-item-label">支出</div>
            <div class="balance-item-value">${exchangeService.formatConverted(displayExpense, currentDisplayCurrency)}</div>
          </div>
        </div>
      </div>
    </div>

    <section class="multi-currency-section">
      <div class="section-header">
        <h2 class="section-title">多币种支出</h2>
      </div>
      <div class="multi-currency-list">
        ${multiCurrencyExpenses.map((item, index) => `
          <div class="multi-row stagger-item ${item.code === currentDisplayCurrency ? 'active' : ''}" style="animation-delay: ${index * 35}ms">
            <div class="multi-left">
              <span class="multi-symbol">${item.symbol}</span>
              <div class="multi-info">
                <span class="multi-name">${item.name}</span>
                <span class="multi-code">${item.code}</span>
              </div>
            </div>
            <span class="multi-amount">${exchangeService.formatConverted(item.amount, item.code)}</span>
          </div>
        `).join('')}
      </div>
    </section>

    <section class="recent-section">
      <div class="section-header">
        <h2 class="section-title">最近</h2>
      </div>
      <div class="transaction-list">
        ${recentTxs.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">${getIcon('list', 32)}</div>
            <p class="empty-text">暂无交易记录</p>
          </div>
        ` : recentTxs.map((tx, i) => renderTransactionItem(tx, i, currentDisplayCurrency, convertFn)).join('')}
      </div>
    </section>
  `;

  const chip = page.querySelector('#currency-chip');
  if (chip) {
    chip.addEventListener('click', () => {
      openCurrencyPicker();
    });
  }

  return page;
}

function renderTransactionItem(tx, index, currencyCode, convertFn) {
  const cat = store.getCategoryById(tx.category);
  const isExpense = tx.type === 'expense';
  const d = new Date(tx.date);
  const timeStr = `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
  const displayAmount = convertFn(tx.amount, tx.currency || exchangeService.BASE_CURRENCY);

  return `
    <div class="tx-item stagger-item" style="animation-delay: ${index * 45}ms">
      <div class="tx-icon" style="background: ${cat.color}15; color: ${cat.color}">
        ${getIcon(cat.icon, 18)}
      </div>
      <div class="tx-info">
        <div class="tx-category">${cat.name}</div>
        <div class="tx-note">${tx.note || timeStr}</div>
      </div>
      <div class="tx-amount ${isExpense ? 'expense' : 'income'}">
        ${isExpense ? '-' : '+'}${exchangeService.formatConverted(displayAmount, currencyCode)}
      </div>
    </div>
  `;
}

const style = document.createElement('style');
style.textContent = `
  .home-page { padding-top: var(--space-4xl); }

  .home-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: var(--space-md);
  }

  .home-title {
    font-size: var(--font-3xl);
    font-weight: var(--weight-bold);
    color: var(--text-primary);
    letter-spacing: -0.5px;
  }

  .home-date {
    font-size: var(--font-sm);
    color: var(--text-tertiary);
    margin-top: 2px;
    font-weight: var(--weight-medium);
  }

  .currency-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: var(--bg-card);
    border-radius: var(--radius-full);
    box-shadow: var(--shadow-sm);
    margin-top: 6px;
    transition: transform var(--duration-fast) var(--ease-smooth);
    max-width: 46%;
    min-width: 0;
  }
  .currency-chip:active { transform: scale(0.96); }

  .currency-chip-sym {
    font-size: var(--font-base);
    font-weight: var(--weight-bold);
    color: var(--accent);
  }

  .currency-chip-name {
    font-size: var(--font-xs);
    font-weight: var(--weight-semibold);
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .currency-chip svg { color: var(--text-tertiary); }

  .rate-panel {
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-card);
    padding: var(--space-md) var(--space-lg);
    margin-bottom: var(--space-lg);
  }

  .rate-panel-top {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .rate-icon {
    width: 18px;
    height: 18px;
    border-radius: var(--radius-full);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--accent);
    background: var(--accent-light);
    animation: iconFadeScaleIn var(--duration-normal) var(--ease-smooth) both;
  }

  .rate-dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: var(--income);
  }

  .rate-dot.stale {
    background: var(--expense);
  }

  .rate-status {
    font-size: var(--font-sm);
    font-weight: var(--weight-semibold);
  }

  .rate-time {
    margin-left: auto;
    font-size: var(--font-xs);
    color: var(--text-tertiary);
  }

  .rate-summary {
    margin-top: 6px;
    font-size: var(--font-xs);
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
    line-height: 1.4;
  }

  .balance-card {
    background: var(--accent-gradient);
    border-radius: var(--radius-xl);
    padding: var(--space-2xl);
    color: white;
    margin-bottom: var(--space-xl);
    box-shadow: 0 8px 30px rgba(74, 108, 247, 0.22);
    animation: listItemEnter var(--duration-normal) var(--ease-ios) both;
  }

  .balance-label {
    font-size: var(--font-sm);
    opacity: 0.82;
    font-weight: var(--weight-medium);
  }

  .balance-amount {
    font-size: clamp(30px, 8vw, var(--font-4xl));
    font-weight: var(--weight-bold);
    margin: var(--space-sm) 0 var(--space-xl);
    letter-spacing: -1px;
    display: flex;
    align-items: baseline;
    gap: 2px;
    min-width: 0;
  }

  .balance-sign,
  .balance-currency {
    font-size: clamp(18px, 4.5vw, var(--font-2xl));
    font-weight: var(--weight-medium);
    flex-shrink: 0;
  }

  .balance-value {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .balance-row {
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.15);
    border-radius: var(--radius-md);
    padding: var(--space-md) var(--space-lg);
    gap: var(--space-sm);
    min-width: 0;
  }

  .balance-item {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    min-width: 0;
  }

  .balance-item > div {
    min-width: 0;
  }

  .balance-item-icon {
    width: 28px;
    height: 28px;
    border-radius: var(--radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.2);
  }

  .balance-item-label {
    font-size: var(--font-xs);
    opacity: 0.75;
    white-space: nowrap;
  }

  .balance-item-value {
    font-size: clamp(12px, 3.3vw, var(--font-base));
    font-weight: var(--weight-semibold);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .balance-divider {
    width: 1px;
    height: 32px;
    background: rgba(255, 255, 255, 0.2);
    margin: 0 var(--space-sm);
    flex-shrink: 0;
  }

  .multi-currency-section {
    margin-bottom: var(--space-xl);
  }

  .multi-currency-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .multi-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--bg-card);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-card);
    padding: var(--space-md) var(--space-lg);
  }

  .multi-row.active {
    background: var(--accent-light);
  }

  .multi-left {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .multi-symbol {
    width: 28px;
    text-align: center;
    font-size: var(--font-lg);
    font-weight: var(--weight-semibold);
  }

  .multi-info {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
  }

  .multi-name {
    font-size: var(--font-sm);
    font-weight: var(--weight-medium);
  }

  .multi-code {
    font-size: var(--font-xs);
    color: var(--text-tertiary);
  }

  .multi-amount {
    font-size: var(--font-base);
    font-weight: var(--weight-semibold);
  }

  .recent-section {
    animation: fadeIn var(--duration-normal) var(--ease-smooth) 100ms both;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-md);
  }

  .transaction-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .tx-item {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md) var(--space-lg);
    background: var(--bg-card);
    border-radius: var(--radius-md);
    transition: background var(--duration-fast) var(--ease-smooth);
  }

  .tx-item:active { background: var(--bg-hover); }

  .tx-icon {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .tx-info { flex: 1; min-width: 0; }

  .tx-category {
    font-size: var(--font-base);
    font-weight: var(--weight-medium);
    color: var(--text-primary);
  }

  .tx-note {
    font-size: var(--font-xs);
    color: var(--text-tertiary);
    margin-top: 1px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tx-amount {
    font-size: var(--font-base);
    font-weight: var(--weight-semibold);
    white-space: nowrap;
    flex-shrink: 0;
    max-width: 42%;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tx-amount.expense { color: var(--text-primary); }
  .tx-amount.income { color: var(--income); }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-4xl) var(--space-xl);
    color: var(--text-tertiary);
  }

  .empty-icon {
    width: 56px;
    height: 56px;
    border-radius: var(--radius-full);
    background: var(--bg-hover);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: var(--space-lg);
  }

  .empty-text {
    font-size: var(--font-base);
    font-weight: var(--weight-medium);
    color: var(--text-secondary);
  }

`;
document.head.appendChild(style);
