import { icons } from '../icons.js';

const tabs = [
  { id: 'home', label: '首页', icon: 'home' },
  { id: 'transactions', label: '账单', icon: 'list' },
  { id: 'add', label: '', icon: 'plus' },
  { id: 'stats', label: '统计', icon: 'chart' },
  { id: 'settings', label: '设置', icon: 'settings' },
];

export function createNavbar(onNavigate, onAddClick) {
  const container = document.getElementById('navbar-container');

  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';

  const inner = document.createElement('div');
  inner.className = 'nav-inner';

  tabs.forEach((tab) => {
    if (tab.id === 'add') {
      const fabBtn = document.createElement('button');
      fabBtn.className = 'nav-fab';
      fabBtn.id = 'nav-fab-btn';
      fabBtn.setAttribute('aria-label', '添加');
      fabBtn.innerHTML = icons.plus;
      fabBtn.addEventListener('click', () => onAddClick());
      inner.appendChild(fabBtn);
      return;
    }

    const btn = document.createElement('button');
    btn.className = 'nav-tab' + (tab.id === 'home' ? ' active' : '');
    btn.dataset.tab = tab.id;
    btn.id = 'nav-tab-' + tab.id;

    const iconSpan = document.createElement('span');
    iconSpan.className = 'nav-icon';
    iconSpan.innerHTML = icons[tab.icon];

    const labelSpan = document.createElement('span');
    labelSpan.className = 'nav-label';
    labelSpan.textContent = tab.label;

    btn.appendChild(iconSpan);
    btn.appendChild(labelSpan);

    btn.addEventListener('click', () => {
      inner.querySelectorAll('.nav-tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      onNavigate(tab.id);
    });

    inner.appendChild(btn);
  });

  nav.appendChild(inner);
  container.appendChild(nav);

  return {
    setActive(tabId) {
      inner.querySelectorAll('.nav-tab').forEach((b) => b.classList.remove('active'));
      const target = inner.querySelector(`[data-tab="${tabId}"]`);
      if (target) target.classList.add('active');
    },
  };
}

// Navbar styles
const style = document.createElement('style');
style.textContent = `
  .bottom-nav {
    position: fixed;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    max-width: var(--max-width);
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    box-shadow: var(--shadow-navbar);
    z-index: 50;
    padding-bottom: var(--safe-bottom);
  }

  .nav-inner {
    display: flex;
    align-items: center;
    justify-content: space-around;
    height: var(--navbar-height);
    padding: 0 var(--space-sm);
    overflow: visible;
  }

  .nav-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: var(--space-xs) var(--space-md);
    border-radius: var(--radius-md);
    transition: color var(--duration-fast) var(--ease-smooth),
                transform var(--duration-fast) var(--ease-ios),
                background var(--duration-fast) var(--ease-smooth);
    color: var(--text-tertiary);
    position: relative;
    z-index: 2;
    min-width: 56px;
    cursor: pointer;
  }

  .nav-tab:active {
    transform: scale(0.92);
  }

  .nav-tab.active {
    color: var(--accent);
  }

  .nav-tab.active .nav-icon {
    transform: translateY(-1px);
  }

  .nav-icon {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform var(--duration-fast) var(--ease-ios);
  }

  .nav-icon svg {
    width: 22px;
    height: 22px;
  }

  .nav-label {
    font-size: 10px;
    font-weight: var(--weight-medium);
    letter-spacing: 0.2px;
  }

  .nav-fab {
    width: 48px;
    height: 48px;
    border-radius: var(--radius-full);
    background: var(--accent-gradient);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--shadow-fab);
    transition: transform var(--duration-fast) var(--ease-ios),
                box-shadow var(--duration-fast) var(--ease-smooth);
    margin-top: -12px;
    z-index: 1;
    flex-shrink: 0;
  }

  .nav-fab:active {
    transform: scale(0.9) !important;
    box-shadow: 0 3px 12px rgba(74, 108, 247, 0.25);
  }

  .nav-fab svg {
    width: 22px;
    height: 22px;
  }
`;
document.head.appendChild(style);
