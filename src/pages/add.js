import { store } from '../store.js';
import { getIcon, icons } from '../icons.js';

export function openAddModal() {
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('add-modal');

  let type = 'expense';
  let selectedCategory = 'food';
  let amount = '';
  let note = '';
  let date = new Date().toISOString().split('T')[0];
  
  let touchStartY = 0;
  let currentY = 0;
  let isDragging = false;

  const onModalTouchStart = (e) => {
    if (modal.scrollTop > 0) return;
    touchStartY = e.touches[0].clientY;
    currentY = 0;
    isDragging = true;
    modal.style.transition = 'none';
  };

  const onModalTouchMove = (e) => {
    if (!isDragging) return;
    const deltaY = e.touches[0].clientY - touchStartY;
    if (deltaY > 0) {
      currentY = deltaY;
      modal.style.transform = `translateX(-50%) translateY(${deltaY}px)`;
      if (e.cancelable) e.preventDefault();
    }
  };

  const onModalTouchEnd = () => {
    if (!isDragging) return;
    isDragging = false;
    modal.style.transition = '';
    
    if (currentY > 100) {
      closeModal();
    } else {
      modal.style.transform = '';
    }
    currentY = 0;
  };

  function render() {
    const categories = store.getCategories(type);

    modal.innerHTML = `
      <div class="add-sheet">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <button class="sheet-close" id="add-close">${icons.close}</button>
          <h2 class="sheet-title">记一笔</h2>
          <button class="sheet-save" id="add-save">保存</button>
        </div>

        <div class="type-toggle">
          <button class="type-btn ${type === 'expense' ? 'active' : ''}" data-type="expense" id="type-expense">支出</button>
          <button class="type-btn ${type === 'income' ? 'active' : ''}" data-type="income" id="type-income">收入</button>
          <div class="type-indicator" style="transform: translateX(${type === 'income' ? '100%' : '0'})"></div>
        </div>

        <div class="amount-input-area">
          <span class="amount-currency">${store.getSettings().currency}</span>
          <input
            type="number"
            class="amount-input"
            placeholder="0.00"
            value="${amount}"
            id="add-amount"
            inputmode="decimal"
            step="0.01"
            autofocus
          />
        </div>

        <div class="category-grid">
          ${categories.map((cat) => `
            <button class="cat-btn ${selectedCategory === cat.id ? 'selected' : ''}" data-cat="${cat.id}" id="cat-${cat.id}">
              <div class="cat-icon" style="background: ${cat.color}12; color: ${cat.color}">
                ${getIcon(cat.icon, 20)}
              </div>
              <span class="cat-label">${cat.name}</span>
            </button>
          `).join('')}
        </div>

        <div class="add-fields">
          <div class="add-field">
            <span class="field-icon">${getIcon('calendar', 18)}</span>
            <input type="date" class="field-input" value="${date}" id="add-date" />
          </div>
          <div class="add-field">
            <span class="field-icon">${icons.list}</span>
            <input type="text" class="field-input" placeholder="添加备注..." value="${note}" id="add-note" maxlength="50" />
          </div>
        </div>

        <button class="confirm-btn" id="add-confirm">
          ${getIcon('check', 20)}
          <span>确认保存</span>
        </button>
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    // Close
    modal.querySelector('#add-close').addEventListener('click', closeModal);
    overlay.removeEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);

    // Swipe to dismiss
    modal.removeEventListener('touchstart', onModalTouchStart);
    modal.removeEventListener('touchmove', onModalTouchMove);
    modal.removeEventListener('touchend', onModalTouchEnd);
    modal.addEventListener('touchstart', onModalTouchStart, { passive: true });
    modal.addEventListener('touchmove', onModalTouchMove, { passive: false });
    modal.addEventListener('touchend', onModalTouchEnd);

    // Type toggle
    modal.querySelectorAll('.type-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        type = btn.dataset.type;
        selectedCategory = type === 'expense' ? 'food' : 'salary';
        render();
      });
    });

    // Category selection
    modal.querySelectorAll('.cat-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedCategory = btn.dataset.cat;
        modal.querySelectorAll('.cat-btn').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });

    // Amount
    const amountInput = modal.querySelector('#add-amount');
    amountInput.addEventListener('input', (e) => { amount = e.target.value; });

    // Date
    modal.querySelector('#add-date').addEventListener('change', (e) => { date = e.target.value; });

    // Note
    modal.querySelector('#add-note').addEventListener('input', (e) => { note = e.target.value; });

    // Save
    const saveHandler = () => {
      const val = parseFloat(amount);
      if (!val || val <= 0) {
        amountInput.style.animation = 'shake 320ms var(--ease-ios)';
        setTimeout(() => { amountInput.style.animation = ''; }, 320);
        return;
      }
      store.addTransaction({
        type,
        category: selectedCategory,
        amount: val,
        date,
        note,
      });
      closeModal();
    };

    modal.querySelector('#add-save').addEventListener('click', saveHandler);
    modal.querySelector('#add-confirm').addEventListener('click', saveHandler);
  }

  function closeModal() {
    overlay.classList.remove('visible');
    modal.classList.remove('visible');
    modal.style.transform = ''; // Clear drag inline style
    overlay.removeEventListener('click', closeModal);
  }

  // Open
  render();
  // Force reflow
  void modal.offsetHeight;
  modal.classList.add('visible');
  overlay.classList.add('visible');

  // Focus amount after animation
  setTimeout(() => {
    const input = modal.querySelector('#add-amount');
    if (input) input.focus();
  }, 280);
}

// Add modal styles
const style = document.createElement('style');
style.textContent = `
  .add-sheet {
    padding: var(--space-sm) var(--space-xl) var(--space-3xl);
  }

  .sheet-handle {
    width: 36px;
    height: 4px;
    border-radius: 2px;
    background: var(--border);
    margin: var(--space-sm) auto var(--space-lg);
  }

  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-xl);
  }

  .sheet-close {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-full);
    background: var(--bg-hover);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
  }

  .sheet-close svg {
    width: 16px;
    height: 16px;
  }

  .sheet-title {
    font-size: var(--font-lg);
    font-weight: var(--weight-semibold);
  }

  .sheet-save {
    font-size: var(--font-base);
    font-weight: var(--weight-semibold);
    color: var(--accent);
    padding: var(--space-xs) var(--space-md);
  }

  .type-toggle {
    display: flex;
    background: var(--bg-hover);
    border-radius: var(--radius-md);
    padding: 3px;
    position: relative;
    margin-bottom: var(--space-2xl);
  }

  .type-btn {
    flex: 1;
    padding: var(--space-sm) 0;
    font-size: var(--font-sm);
    font-weight: var(--weight-semibold);
    color: var(--text-secondary);
    border-radius: calc(var(--radius-md) - 2px);
    z-index: 1;
    transition: color var(--duration-fast) var(--ease-smooth);
  }

  .type-btn.active {
    color: var(--text-primary);
  }

  .type-indicator {
    position: absolute;
    top: 3px;
    left: 3px;
    width: calc(50% - 3px);
    height: calc(100% - 6px);
    background: white;
    border-radius: calc(var(--radius-md) - 2px);
    box-shadow: var(--shadow-sm);
    transition: transform var(--duration-normal) var(--ease-ios);
  }

  .amount-input-area {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-lg) 0;
    border-bottom: 2px solid var(--border-light);
    margin-bottom: var(--space-xl);
  }

  .amount-currency {
    font-size: var(--font-2xl);
    font-weight: var(--weight-semibold);
    color: var(--text-secondary);
  }

  .amount-input {
    font-size: var(--font-4xl);
    font-weight: var(--weight-bold);
    color: var(--text-primary);
    width: 100%;
    letter-spacing: -1px;
  }

  .amount-input::placeholder {
    color: var(--text-tertiary);
  }

  /* Hide number input spin buttons */
  .amount-input::-webkit-outer-spin-button,
  .amount-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .amount-input[type=number] {
    -moz-appearance: textfield;
  }

  .category-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-md);
    margin-bottom: var(--space-xl);
  }

  .cat-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-md) var(--space-xs);
    border-radius: var(--radius-md);
    transition: transform var(--duration-fast) var(--ease-ios), background var(--duration-fast) var(--ease-smooth);
  }

  .cat-btn:active {
    transform: scale(0.92);
  }

  .cat-btn.selected {
    background: var(--accent-light);
  }

  .cat-btn.selected .cat-icon {
    background: var(--accent) !important;
    color: white !important;
    box-shadow: 0 4px 12px rgba(74, 108, 247, 0.3);
  }

  .cat-icon {
    width: 44px;
    height: 44px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform var(--duration-fast) var(--ease-ios), background var(--duration-fast) var(--ease-smooth), color var(--duration-fast) var(--ease-smooth);
  }

  .cat-label {
    font-size: var(--font-xs);
    color: var(--text-secondary);
    font-weight: var(--weight-medium);
  }

  .add-fields {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    margin-bottom: var(--space-xl);
  }

  .add-field {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md) var(--space-lg);
    background: var(--bg-hover);
    border-radius: var(--radius-md);
  }

  .field-icon {
    width: 20px;
    height: 20px;
    color: var(--text-tertiary);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .field-icon svg {
    width: 18px;
    height: 18px;
  }

  .field-input {
    flex: 1;
    font-size: var(--font-base);
    color: var(--text-primary);
  }

  .field-input::placeholder {
    color: var(--text-tertiary);
  }

  .confirm-btn {
    width: 100%;
    padding: var(--space-lg);
    background: var(--accent-gradient);
    color: white;
    border-radius: var(--radius-lg);
    font-size: var(--font-base);
    font-weight: var(--weight-semibold);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    box-shadow: var(--shadow-fab);
    transition: transform var(--duration-fast) var(--ease-ios), box-shadow var(--duration-fast) var(--ease-smooth);
  }

  .confirm-btn:active {
    transform: scale(0.98) !important;
  }
`;
document.head.appendChild(style);
