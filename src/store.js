// Reactive localStorage-backed store
const STORAGE_KEY = 'money_tracker_data';

const defaultData = {
  transactions: [],
  settings: {
    currency: 'CNY',
    locale: 'zh-CN',
  },
};

const categories = {
  expense: [
    { id: 'food', name: '餐饮', color: 'var(--cat-food)', icon: 'food' },
    { id: 'transport', name: '交通', color: 'var(--cat-transport)', icon: 'transport' },
    { id: 'shopping', name: '购物', color: 'var(--cat-shopping)', icon: 'shopping' },
    { id: 'entertainment', name: '娱乐', color: 'var(--cat-entertainment)', icon: 'entertainment' },
    { id: 'housing', name: '住房', color: 'var(--cat-housing)', icon: 'housing' },
    { id: 'health', name: '医疗', color: 'var(--cat-health)', icon: 'health' },
    { id: 'education', name: '教育', color: 'var(--cat-education)', icon: 'education' },
    { id: 'other', name: '其他', color: 'var(--cat-other)', icon: 'other' },
  ],
  income: [
    { id: 'salary', name: '工资', color: 'var(--income)', icon: 'salary' },
    { id: 'bonus', name: '奖金', color: 'var(--cat-food)', icon: 'bonus' },
    { id: 'investment', name: '投资', color: 'var(--cat-transport)', icon: 'investment' },
    { id: 'freelance', name: '兼职', color: 'var(--cat-entertainment)', icon: 'freelance' },
    { id: 'other_income', name: '其他', color: 'var(--cat-other)', icon: 'other' },
  ],
};

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      let parsed = JSON.parse(raw);
      // Migrate old symbol currencies to new ISO codes
      if (parsed.settings && ['¥', '$', '€', '£', '₩'].includes(parsed.settings.currency)) {
        const map = { '¥': 'CNY', '$': 'USD', '€': 'EUR', '£': 'GBP', '₩': 'KRW' };
        parsed.settings.currency = map[parsed.settings.currency] || 'CNY';
        saveData(parsed);
      }
      return parsed;
    }
  } catch (e) {
    console.warn('Failed to load data:', e);
  }
  return { ...defaultData, transactions: [] };
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

let data = loadData();
const listeners = new Set();

export const store = {
  getTransactions() {
    return data.transactions;
  },

  getSettings() {
    return data.settings;
  },

  getCategories(type = 'expense') {
    return categories[type] || categories.expense;
  },

  getCategoryById(id) {
    const allCats = [...categories.expense, ...categories.income];
    return allCats.find((c) => c.id === id) || { id: 'other', name: '其他', color: 'var(--cat-other)', icon: 'other' };
  },

  addTransaction(tx) {
    tx.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    tx.createdAt = new Date().toISOString();
    tx.currency = tx.currency || data.settings.currency;
    data.transactions.unshift(tx);
    saveData(data);
    this.notify();
  },

  deleteTransaction(id) {
    data.transactions = data.transactions.filter((t) => t.id !== id);
    saveData(data);
    this.notify();
  },

  // Delete without triggering re-render (for animated deletes)
  silentDelete(id) {
    data.transactions = data.transactions.filter((t) => t.id !== id);
    saveData(data);
  },

  updateSettings(settings) {
    data.settings = { ...data.settings, ...settings };
    saveData(data);
    this.notify();
  },

  clearAll() {
    data = { ...defaultData, transactions: [] };
    saveData(data);
    this.notify();
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  notify() {
    listeners.forEach((fn) => fn());
  },

  // Computed helpers
  getMonthlyStats(year, month, convertFn = (a, c) => a) {
    const txs = data.transactions.filter((t) => {
      const d = new Date(t.date);
      return d.getFullYear() === year && d.getMonth() === month;
    });
    const income = txs.filter((t) => t.type === 'income').reduce((s, t) => s + convertFn(t.amount, t.currency || 'CNY'), 0);
    const expense = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + convertFn(t.amount, t.currency || 'CNY'), 0);
    return { income, expense, balance: income - expense, transactions: txs };
  },

  getCategoryBreakdown(year, month, type = 'expense', convertFn = (a, c) => a) {
    const txs = data.transactions.filter((t) => {
      const d = new Date(t.date);
      return d.getFullYear() === year && d.getMonth() === month && t.type === type;
    });
    const map = {};
    txs.forEach((t) => {
      if (!map[t.category]) map[t.category] = 0;
      map[t.category] += convertFn(t.amount, t.currency || 'CNY');
    });
    return Object.entries(map)
      .map(([id, amount]) => ({ ...this.getCategoryById(id), amount }))
      .sort((a, b) => b.amount - a.amount);
  },

  getWeeklyTrend(year, month, convertFn = (a, c) => a) {
    const txs = data.transactions.filter((t) => {
      const d = new Date(t.date);
      return d.getFullYear() === year && d.getMonth() === month && t.type === 'expense';
    });
    // Group by week of month
    const weeks = [0, 0, 0, 0, 0];
    txs.forEach((t) => {
      const d = new Date(t.date);
      const week = Math.min(Math.floor((d.getDate() - 1) / 7), 4);
      weeks[week] += convertFn(t.amount, t.currency || 'CNY');
    });
    return weeks;
  },
};
