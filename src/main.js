import './styles/base.css';
import { createNavbar } from './components/navbar.js';
import { renderHome } from './pages/home.js';
import { renderTransactions } from './pages/transactions.js';
import { renderStats } from './pages/stats.js';
import { renderSettings } from './pages/settings.js';
import { openAddModal } from './pages/add.js';
import { store } from './store.js';
import { exchangeService } from './exchange.js';

const pageContainer = document.getElementById('page-container');

const pages = {
  home: renderHome,
  transactions: renderTransactions,
  stats: renderStats,
  settings: renderSettings,
};

let currentPage = 'home';

let rerenderTimer = null;
function rerenderCurrentPage() {
  if (rerenderTimer) return;

  rerenderTimer = requestAnimationFrame(() => {
    rerenderTimer = null;

    const renderFn = pages[currentPage];
    if (!renderFn) return;

    const oldPage = pageContainer.querySelector('.page');
    const pageEl = renderFn();
    pageEl.style.animation = 'none';

    if (!oldPage) {
      pageContainer.replaceChildren(pageEl);
      return;
    }

    pageEl.style.cssText = `
      opacity: 0;
      transform: translateY(6px);
      will-change: opacity, transform;
      transition: opacity var(--duration-normal) var(--ease-ios),
                  transform var(--duration-normal) var(--ease-ios);
    `;
    pageContainer.appendChild(pageEl);

    oldPage.style.willChange = 'opacity';
    oldPage.style.transition = 'opacity 200ms var(--ease-smooth)';

    requestAnimationFrame(() => {
      oldPage.style.opacity = '0';
      pageEl.style.opacity = '1';
      pageEl.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
      oldPage.remove();
      pageEl.style.willChange = 'auto';
    }, 260);
  });
}

let transitionId = 0;

function navigateTo(pageId) {
  if (pageId === currentPage && pageContainer.children.length > 0) return;

  const renderFn = pages[pageId];
  if (!renderFn) return;

  transitionId += 1;
  const myId = transitionId;

  const existingPages = pageContainer.querySelectorAll('.page');
  if (existingPages.length > 1) {
    for (let i = 0; i < existingPages.length - 1; i += 1) {
      existingPages[i].remove();
    }
  }

  const oldPage = pageContainer.querySelector('.page');
  currentPage = pageId;
  const newPage = renderFn();

  if (!oldPage) {
    pageContainer.appendChild(newPage);
    return;
  }

  newPage.style.cssText = `
    opacity: 0;
    transform: translateY(10px);
    will-change: opacity, transform;
    transition: opacity var(--duration-slow) var(--ease-ios),
                transform var(--duration-slow) var(--ease-ios);
  `;
  pageContainer.appendChild(newPage);

  oldPage.style.willChange = 'opacity, transform';
  oldPage.style.transition = 'opacity 220ms var(--ease-smooth), transform 220ms var(--ease-smooth)';

  requestAnimationFrame(() => {
    if (transitionId !== myId) return;

    oldPage.style.opacity = '0';
    oldPage.style.transform = 'translateY(-8px)';

    newPage.style.opacity = '1';
    newPage.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    if (transitionId !== myId) return;

    oldPage.remove();
    newPage.style.willChange = 'auto';
  }, 340);
}

function init() {
  createNavbar(
    (tabId) => navigateTo(tabId),
    () => openAddModal(),
  );

  store.subscribe(() => {
    rerenderCurrentPage();
  });

  exchangeService.subscribe(() => {
    rerenderCurrentPage();
  });

  exchangeService.startAutoRefresh();

  navigateTo('home');

  if (!localStorage.getItem('money_tracker_initialized')) {
    localStorage.setItem('money_tracker_initialized', '1');
    addSampleData();
  }
}

function addSampleData() {
  const today = new Date();
  const fmt = (d) => d.toISOString().split('T')[0];

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const samples = [
    { type: 'expense', category: 'food', amount: 32.5, date: fmt(today), note: '午餐' },
    { type: 'expense', category: 'transport', amount: 15, date: fmt(today), note: '地铁' },
    { type: 'income', category: 'salary', amount: 12000, date: fmt(yesterday), note: '工资' },
    { type: 'expense', category: 'shopping', amount: 299, date: fmt(yesterday), note: '衣服' },
    { type: 'expense', category: 'entertainment', amount: 68, date: fmt(twoDaysAgo), note: '电影' },
    { type: 'expense', category: 'food', amount: 45, date: fmt(twoDaysAgo), note: '晚餐' },
    { type: 'expense', category: 'housing', amount: 3500, date: fmt(twoDaysAgo), note: '房租' },
    { type: 'expense', category: 'health', amount: 128, date: fmt(twoDaysAgo), note: '药品' },
  ];

  samples.forEach((s) => store.addTransaction(s));
}

init();
