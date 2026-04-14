import { store } from '../store.js';
import { exchangeService } from '../exchange.js';

let pickerOverlay = null;
let pickerBackdrop = null;

let touchStartY = 0;
let currentY = 0;
let isDragging = false;
let isSelecting = false;
let unsubscribeRates = null;

function formatSnapshotText(snapshot) {
  if (!snapshot.timestamp) return '离线汇率';

  const diff = Date.now() - snapshot.timestamp;
  if (diff < 60 * 1000) return '刚刚更新';
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))} 分钟前更新`;

  return `更新于 ${new Date(snapshot.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
}

function getCurrentMonthExpense(currencyCode, rates) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  return store.getTransactions().reduce((sum, tx) => {
    if (tx.type !== 'expense') return sum;

    const d = new Date(tx.date);
    if (d.getFullYear() !== year || d.getMonth() !== month) return sum;

    return sum + exchangeService.convert(tx.amount, tx.currency || exchangeService.BASE_CURRENCY, currencyCode, rates);
  }, 0);
}

function ensurePickerCreated() {
  if (pickerOverlay) return;

  pickerBackdrop = document.createElement('div');
  pickerBackdrop.className = 'cur-picker-backdrop';
  document.body.appendChild(pickerBackdrop);

  pickerOverlay = document.createElement('div');
  pickerOverlay.className = 'cur-picker-overlay';
  document.body.appendChild(pickerOverlay);

  const style = document.createElement('style');
  style.textContent = `
  .cur-picker-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.28);
    z-index: 90;
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--duration-normal) var(--ease-smooth);
  }

  .cur-picker-backdrop.visible {
    opacity: 1;
    pointer-events: auto;
  }

  .cur-picker-overlay {
    position: fixed;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%) translateY(100%);
    width: 100%;
    max-width: var(--max-width);
    background: var(--bg-elevated);
    border-radius: var(--radius-2xl) var(--radius-2xl) 0 0;
    z-index: 91;
    box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.16);
    transition: transform var(--duration-modal) var(--ease-ios);
    max-height: 78vh;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: var(--space-sm) var(--space-xl) var(--space-3xl);
  }

  .cur-picker-overlay.visible {
    transform: translateX(-50%) translateY(0);
  }

  .sheet-handle {
    width: 36px;
    height: 5px;
    background: var(--border);
    border-radius: var(--radius-full);
    margin: 4px auto var(--space-md);
  }

  .cur-picker-title {
    font-size: var(--font-lg);
    font-weight: var(--weight-semibold);
    text-align: center;
    margin-bottom: var(--space-xs);
  }

  .cur-picker-hint {
    font-size: var(--font-xs);
    color: var(--text-tertiary);
    text-align: center;
    margin-bottom: var(--space-lg);
  }

  .cur-picker-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .cur-picker-item {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-lg);
    border-radius: var(--radius-md);
    transition: background var(--duration-fast) var(--ease-smooth);
    background: transparent;
    border: none;
    width: 100%;
    cursor: pointer;
    text-align: left;
  }

  .cur-picker-item:active {
    background: var(--bg-hover);
  }

  .cur-picker-item.active {
    background: var(--accent-light);
  }

  .cur-picker-item:disabled {
    opacity: 0.65;
  }

  .cur-picker-symbol {
    font-size: var(--font-xl);
    font-weight: var(--weight-semibold);
    color: var(--text-primary);
    width: 32px;
    text-align: center;
  }

  .cur-picker-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .cur-picker-name {
    font-size: var(--font-base);
    font-weight: var(--weight-medium);
    color: var(--text-primary);
  }

  .cur-picker-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 2px;
    flex-wrap: wrap;
  }

  .cur-picker-code {
    font-size: var(--font-xs);
    color: var(--text-tertiary);
  }

  .cur-picker-rate {
    font-size: 11px;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
  }

  .cur-picker-spend {
    font-size: 11px;
    color: var(--text-tertiary);
    font-variant-numeric: tabular-nums;
  }

  .cur-picker-check {
    color: var(--accent);
    display: flex;
    align-items: center;
    margin-left: var(--space-xs);
  }
  `;
  document.head.appendChild(style);

  pickerBackdrop.addEventListener('click', closeCurrencyPicker);

  pickerOverlay.addEventListener('touchstart', (e) => {
    if (pickerOverlay.scrollTop > 0) return;
    touchStartY = e.touches[0].clientY;
    currentY = 0;
    isDragging = true;
    pickerOverlay.style.transition = 'none';
  }, { passive: true });

  pickerOverlay.addEventListener('touchmove', (e) => {
    if (!isDragging) return;

    const deltaY = e.touches[0].clientY - touchStartY;
    if (deltaY > 0) {
      currentY = deltaY;
      pickerOverlay.style.transform = `translateX(-50%) translateY(${deltaY}px)`;
      if (e.cancelable) e.preventDefault();
    }
  }, { passive: false });

  pickerOverlay.addEventListener('touchend', () => {
    if (!isDragging) return;

    isDragging = false;
    pickerOverlay.style.transition = '';

    if (currentY > 100) {
      closeCurrencyPicker();
    } else {
      pickerOverlay.style.transform = '';
    }

    currentY = 0;
  });

  unsubscribeRates = exchangeService.subscribe(() => {
    if (pickerOverlay && pickerOverlay.classList.contains('visible')) {
      renderPickerContent();
    }
  });
}

function renderPickerContent() {
  const currentDisplayCurrency = store.getSettings().currency;
  const snapshot = exchangeService.getSnapshot();
  const rates = snapshot.rates;

  pickerOverlay.innerHTML = `
    <div class="sheet-handle"></div>
    <h3 class="cur-picker-title">选择展示货币</h3>
    <p class="cur-picker-hint">${snapshot.isFetching ? '正在同步最新汇率…' : `${formatSnapshotText(snapshot)} · 选择后全局自动换算`}</p>
    <div class="cur-picker-list">
      ${exchangeService.CURRENCIES.map((currency) => {
        const rateText = currency.code === 'CNY'
          ? '基准货币'
          : `1 CNY = ${rates[currency.code]?.toFixed(currency.code === 'JPY' ? 2 : 4) || '—'} ${currency.code}`;

        const expenseInCurrency = getCurrentMonthExpense(currency.code, rates);

        return `
          <button class="cur-picker-item ${currency.code === currentDisplayCurrency ? 'active' : ''}" data-code="${currency.code}" ${isSelecting ? 'disabled' : ''}>
            <span class="cur-picker-symbol">${currency.symbol}</span>
            <div class="cur-picker-info">
              <span class="cur-picker-name">${currency.name}</span>
              <div class="cur-picker-meta">
                <span class="cur-picker-code">${currency.code}</span>
                <span class="cur-picker-rate">${rateText}</span>
                <span class="cur-picker-spend">本月支出 ${exchangeService.formatConverted(expenseInCurrency, currency.code)}</span>
              </div>
            </div>
            ${currency.code === currentDisplayCurrency ? '<span class="cur-picker-check"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg></span>' : ''}
          </button>
        `;
      }).join('')}
    </div>
  `;

  pickerOverlay.querySelectorAll('.cur-picker-item').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (isSelecting) return;

      const code = btn.dataset.code;
      const current = store.getSettings().currency;
      if (code === current) {
        closeCurrencyPicker();
        return;
      }

      isSelecting = true;
      renderPickerContent();

      try {
        await exchangeService.fetchRates({ force: true });
      } finally {
        store.updateSettings({ currency: code });
        isSelecting = false;
        closeCurrencyPicker();
      }
    });
  });
}

export function openCurrencyPicker() {
  ensurePickerCreated();
  renderPickerContent();

  requestAnimationFrame(() => {
    pickerBackdrop.classList.add('visible');
    pickerOverlay.classList.add('visible');
  });

  const snapshot = exchangeService.getSnapshot();
  exchangeService.fetchRates({ force: snapshot.isStale });
}

export function closeCurrencyPicker() {
  if (!pickerOverlay) return;

  pickerBackdrop.classList.remove('visible');
  pickerOverlay.classList.remove('visible');
  pickerOverlay.style.transform = '';
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (unsubscribeRates) {
      unsubscribeRates();
      unsubscribeRates = null;
    }
  });
}
