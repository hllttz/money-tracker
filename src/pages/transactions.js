import { store } from '../store.js';
import { getIcon } from '../icons.js';
import { exchangeService } from '../exchange.js';

export function renderTransactions() {
  const currencyCode = store.getSettings().currency;
  const rates = exchangeService.getCachedRates();
  const convertFn = (amount, txCurrency) => {
    return exchangeService.convert(amount, txCurrency || exchangeService.BASE_CURRENCY, currencyCode, rates);
  };
  
  const txs = store.getTransactions();

  // Group by date
  const groups = {};
  txs.forEach((tx) => {
    const key = tx.date;
    if (!groups[key]) groups[key] = [];
    groups[key].push(tx);
  });

  const sortedDates = Object.keys(groups).sort((a, b) => new Date(b) - new Date(a));

  const page = document.createElement('div');
  page.className = 'page transactions-page';
  page.innerHTML = `
    <header class="page-header">
      <h1 class="page-title">账单</h1>
      <p class="page-subtitle">所有交易记录</p>
    </header>

    <div class="tx-groups" id="tx-groups">
      ${txs.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">${getIcon('list', 32)}</div>
          <p class="empty-text">暂无交易记录</p>
        </div>
      ` : sortedDates.map((date) => {
        const dayTxs = groups[date];
        const d = new Date(date);
        const dayTotal = dayTxs.reduce((sum, t) => {
          const amt = convertFn(t.amount, t.currency || exchangeService.BASE_CURRENCY);
          return sum + (t.type === 'expense' ? -amt : amt);
        }, 0);
        
        return `
          <div class="tx-group stagger-item">
            <div class="tx-group-header">
              <span class="tx-group-date">${formatDate(d)}</span>
              <span class="tx-group-total ${dayTotal >= 0 ? 'income' : 'expense'}">${dayTotal >= 0 ? '+' : ''}${exchangeService.formatConverted(Math.abs(dayTotal), currencyCode)}</span>
            </div>
            <div class="tx-group-list">
              ${dayTxs.map((tx) => renderTxRow(tx, currencyCode, convertFn)).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Bind delete and swipe events
  let activeFg = null;
  let startX = 0;
  let currentX = 0;
  const swipeThreshold = -56;
  const maxSwipe = -82;

  function closeActiveSwipe() {
    if (!activeFg) return;
    activeFg.style.transition = 'transform 200ms var(--ease-ios)';
    activeFg.style.transform = 'translateX(0)';
    activeFg.dataset.x = '0';
    activeFg.dataset.dragX = '0';
    activeFg = null;
  }

  page.querySelectorAll('.tx-delete-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const rowWrap = btn.closest('.tx-row-wrap');
      if (!rowWrap) return;
      const group = rowWrap.closest('.tx-group');

      const rowHeight = rowWrap.offsetHeight;
      rowWrap.style.maxHeight = `${rowHeight}px`;
      rowWrap.style.overflow = 'hidden';
      rowWrap.style.transition = 'transform 240ms var(--ease-ios), opacity 200ms var(--ease-smooth), max-height 200ms var(--ease-smooth)';

      requestAnimationFrame(() => {
        rowWrap.style.transform = 'translateX(-44px)';
        rowWrap.style.opacity = '0';
        rowWrap.style.maxHeight = '0';
      });

      setTimeout(() => {
        store.silentDelete(id);
        rowWrap.remove();

        const list = group?.querySelector('.tx-group-list');
        if (group && list && list.children.length === 0) {
          const groupHeight = group.offsetHeight;
          group.style.maxHeight = `${groupHeight}px`;
          group.style.overflow = 'hidden';
          group.style.transition = 'opacity 200ms var(--ease-smooth), max-height 200ms var(--ease-smooth)';

          requestAnimationFrame(() => {
            group.style.opacity = '0';
            group.style.maxHeight = '0';
          });

          setTimeout(() => group.remove(), 200);
        }
      }, 240);
    });
  });

  page.querySelectorAll('.tx-row-fg').forEach((fg) => {
    fg.addEventListener('touchstart', (e) => {
      if (activeFg && activeFg !== fg) {
        closeActiveSwipe();
      }

      if (e.target.closest('.tx-delete-btn')) return;

      startX = e.touches[0].clientX;
      currentX = fg.dataset.x ? parseFloat(fg.dataset.x) : 0;
      fg.dataset.dragX = String(currentX);
      fg.style.transition = 'none';
    }, { passive: true });

    fg.addEventListener('touchmove', (e) => {
      const deltaX = e.touches[0].clientX - startX;
      let newX = currentX + deltaX;

      if (newX > 0) newX *= 0.2;
      if (newX < maxSwipe) newX = maxSwipe + (newX - maxSwipe) * 0.2;

      fg.dataset.dragX = String(newX);
      fg.style.transform = `translateX(${newX}px)`;
    }, { passive: true });

    fg.addEventListener('touchend', () => {
      const finalX = fg.dataset.dragX ? parseFloat(fg.dataset.dragX) : (fg.dataset.x ? parseFloat(fg.dataset.x) : 0);
      fg.style.transition = 'transform 200ms var(--ease-ios)';

      if (finalX < swipeThreshold) {
        fg.style.transform = `translateX(${maxSwipe}px)`;
        fg.dataset.x = String(maxSwipe);
        fg.dataset.dragX = String(maxSwipe);
        activeFg = fg;
      } else {
        fg.style.transform = 'translateX(0)';
        fg.dataset.x = '0';
        fg.dataset.dragX = '0';
        if (activeFg === fg) activeFg = null;
      }
    });
  });

  page.addEventListener('touchstart', (e) => {
    if (activeFg && !e.target.closest('.tx-row-wrap')) {
      closeActiveSwipe();
    }
  }, { passive: true });

  return page;
}

function renderTxRow(tx, currencyCode, convertFn) {
  const cat = store.getCategoryById(tx.category);
  const isExpense = tx.type === 'expense';
  const displayAmount = convertFn(tx.amount, tx.currency || exchangeService.BASE_CURRENCY);

  return `
    <div class="tx-row-wrap" data-id="${tx.id}">
      <div class="tx-row-bg">
        <button class="tx-delete-btn" data-id="${tx.id}">
          删除
        </button>
      </div>
      <div class="tx-row-fg">
        <div class="tx-row-icon" style="background: ${cat.color}12; color: ${cat.color}">
          ${getIcon(cat.icon, 18)}
        </div>
        <div class="tx-row-info">
          <div class="tx-row-name">${cat.name}</div>
          <div class="tx-row-note">${tx.note || ''}</div>
        </div>
        <div class="tx-row-amount ${isExpense ? 'expense' : 'income'}">
          ${isExpense ? '-' : '+'}${exchangeService.formatConverted(displayAmount, currencyCode)}
        </div>
      </div>
    </div>
  `;
}

function formatDate(d) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return '今天';
  if (d.toDateString() === yesterday.toDateString()) return '昨天';

  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  return `${month}月${day}日 周${weekdays[d.getDay()]}`;
}

// Transactions page styles
const style = document.createElement('style');
style.textContent = `
  .transactions-page {
    padding-top: var(--space-4xl);
  }

  .page-header {
    margin-bottom: var(--space-2xl);
  }

  .page-title {
    font-size: var(--font-3xl);
    font-weight: var(--weight-bold);
    letter-spacing: -0.5px;
  }

  .page-subtitle {
    font-size: var(--font-sm);
    color: var(--text-tertiary);
    margin-top: 2px;
    font-weight: var(--weight-medium);
  }

  .tx-groups {
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
  }

  .tx-group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 var(--space-xs);
    margin-bottom: var(--space-sm);
  }

  .tx-group-date {
    font-size: var(--font-sm);
    font-weight: var(--weight-semibold);
    color: var(--text-secondary);
  }

  .tx-group-total {
    font-size: var(--font-sm);
    font-weight: var(--weight-medium);
  }

  .tx-group-total.income { color: var(--income); }
  .tx-group-total.expense { color: var(--text-secondary); }

  .tx-group-list {
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: var(--shadow-card);
  }

  .tx-row-wrap {
    position: relative;
    overflow: hidden;
    background: var(--expense);
  }

  .tx-row-wrap + .tx-row-wrap {
    border-top: 1px solid var(--border-light);
  }

  .tx-row-bg {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    display: flex;
    justify-content: flex-end;
    background: var(--expense);
  }

  .tx-delete-btn {
    width: 80px;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: var(--font-sm);
    font-weight: var(--weight-medium);
    transition: background var(--duration-fast) var(--ease-smooth);
  }

  .tx-delete-btn:active {
    background: #e03131; /* Darker red */
  }

  .tx-row-fg {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md) var(--space-lg);
    background: var(--bg-card);
    position: relative;
    z-index: 1;
    transform: translateX(0);
    will-change: transform;
    transition: transform var(--duration-fast) var(--ease-ios), background var(--duration-fast) var(--ease-smooth);
  }

  .tx-row-fg:active {
    background: var(--bg-hover);
  }

  .tx-row-icon {
    width: 38px;
    height: 38px;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .tx-row-info {
    flex: 1;
    min-width: 0;
  }

  .tx-row-name {
    font-size: var(--font-base);
    font-weight: var(--weight-medium);
  }

  .tx-row-note {
    font-size: var(--font-xs);
    color: var(--text-tertiary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tx-row-amount {
    font-size: var(--font-base);
    font-weight: var(--weight-semibold);
    white-space: nowrap;
  }

  .tx-row-amount.expense { color: var(--text-primary); }
  .tx-row-amount.income { color: var(--income); }
`;
document.head.appendChild(style);
