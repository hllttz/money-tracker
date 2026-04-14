import { store } from '../store.js';
import { getIcon } from '../icons.js';
import { exchangeService } from '../exchange.js';
import { openCurrencyPicker } from '../components/currencyPicker.js';

function formatUpdateText(snapshot) {
  if (!snapshot.timestamp) return '离线兜底汇率';

  const diff = Date.now() - snapshot.timestamp;
  if (diff < 60 * 1000) return '刚刚更新';
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))} 分钟前更新`;

  const time = new Date(snapshot.timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `更新于 ${time}`;
}

export function renderSettings() {
  const settings = store.getSettings();
  const snapshot = exchangeService.getSnapshot();
  const rates = snapshot.rates;

  const currentCurr = exchangeService.CURRENCIES.find((c) => c.code === settings.currency) || exchangeService.CURRENCIES[0];

  const now = new Date();
  const stats = store.getMonthlyStats(now.getFullYear(), now.getMonth(), (amount, txCurrency) => {
    return exchangeService.convert(amount, txCurrency || exchangeService.BASE_CURRENCY, settings.currency, rates);
  });

  const keyPairs = ['USD', 'EUR', 'JPY'];

  const page = document.createElement('div');
  page.className = 'page settings-page';
  page.innerHTML = `
    <header class="page-header">
      <h1 class="page-title">设置</h1>
    </header>

    <div class="settings-group stagger-item">
      <h3 class="settings-group-title">通用</h3>
      <div class="settings-card">
        <div class="settings-item" id="currency-setting">
          <div class="settings-item-left">
            <span class="settings-icon">${getIcon('salary', 18)}</span>
            <span>显示货币</span>
          </div>
          <div class="settings-item-right">
            <span class="settings-value" id="currency-value">${currentCurr.name} (${currentCurr.symbol})</span>
            <span class="settings-chevron">${getIcon('chevronRight', 16)}</span>
          </div>
        </div>
        <div class="settings-item">
          <div class="settings-item-left">
            <span class="settings-icon">${getIcon('chart', 18)}</span>
            <span>本月支出</span>
          </div>
          <div class="settings-item-right">
            <span class="settings-value">${exchangeService.formatConverted(stats.expense, settings.currency)}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="settings-group stagger-item" style="animation-delay: 40ms">
      <h3 class="settings-group-title">汇率</h3>
      <div class="settings-card">
        <div class="settings-item">
          <div class="settings-item-left">
            <span class="settings-icon">${getIcon('calendar', 18)}</span>
            <span>汇率状态</span>
          </div>
          <div class="settings-item-right">
            <span class="settings-value ${snapshot.isStale ? 'warn' : ''}">${snapshot.isFetching ? '刷新中' : formatUpdateText(snapshot)}</span>
          </div>
        </div>
        <div class="settings-item rates-item">
          <div class="settings-item-left">
            <span class="settings-icon">${getIcon('arrowUp', 18)}</span>
            <span>关键汇率</span>
          </div>
          <div class="settings-item-right">
            <span class="settings-value rates-inline">${keyPairs.map((code) => `${code} ${rates[code]?.toFixed(code === 'JPY' ? 2 : 4) || '—'}`).join(' · ')}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="settings-group stagger-item" style="animation-delay: 80ms">
      <h3 class="settings-group-title">数据</h3>
      <div class="settings-card">
        <div class="settings-item" id="export-setting">
          <div class="settings-item-left">
            <span class="settings-icon">${getIcon('chart', 18)}</span>
            <span>交易总数</span>
          </div>
          <div class="settings-item-right">
            <span class="settings-value">${store.getTransactions().length} 笔</span>
          </div>
        </div>
        <div class="settings-item danger" id="clear-setting">
          <div class="settings-item-left">
            <span class="settings-icon">${getIcon('trash', 18)}</span>
            <span>清除所有数据</span>
          </div>
          <div class="settings-item-right">
            <span class="settings-chevron">${getIcon('chevronRight', 16)}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="settings-group stagger-item" style="animation-delay: 120ms">
      <h3 class="settings-group-title">关于</h3>
      <div class="settings-card">
        <div class="settings-item">
          <div class="settings-item-left">
            <span class="settings-icon">${getIcon('home', 18)}</span>
            <span>版本</span>
          </div>
          <div class="settings-item-right">
            <span class="settings-value">1.0.0</span>
          </div>
        </div>
      </div>
    </div>
  `;

  const currencySetting = page.querySelector('#currency-setting');
  if (currencySetting) {
    currencySetting.addEventListener('click', () => {
      openCurrencyPicker();
    });
  }

  const clearSetting = page.querySelector('#clear-setting');
  if (clearSetting) {
    clearSetting.addEventListener('click', () => {
      if (confirm('确定要清除所有数据吗？此操作不可撤销。')) {
        store.clearAll();
      }
    });
  }

  return page;
}

const style = document.createElement('style');
style.textContent = `
  .settings-page { padding-top: var(--space-4xl); }

  .settings-group { margin-bottom: var(--space-2xl); }

  .settings-group-title {
    font-size: var(--font-xs);
    font-weight: var(--weight-semibold);
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 0 var(--space-xs);
    margin-bottom: var(--space-sm);
  }

  .settings-card {
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-card);
    overflow: hidden;
  }

  .settings-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-lg);
    cursor: pointer;
    transition: background var(--duration-fast) var(--ease-smooth);
  }

  .settings-item:active { background: var(--bg-hover); }

  .settings-item + .settings-item { border-top: 1px solid var(--border-light); }

  .settings-item.danger { color: var(--expense); }

  .settings-item-left {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    font-size: var(--font-base);
    font-weight: var(--weight-medium);
  }

  .settings-icon {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
  }

  .settings-item.danger .settings-icon { color: var(--expense); }

  .settings-item-right {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    max-width: 52%;
    justify-content: flex-end;
  }

  .settings-value {
    font-size: var(--font-sm);
    color: var(--text-tertiary);
    font-weight: var(--weight-medium);
    text-align: right;
  }

  .settings-value.warn { color: var(--expense); }

  .settings-chevron {
    color: var(--text-tertiary);
    opacity: 0.5;
  }

  .rates-item .settings-value {
    font-variant-numeric: tabular-nums;
    line-height: 1.4;
  }

  .rates-inline {
    white-space: normal;
  }
`;
document.head.appendChild(style);
