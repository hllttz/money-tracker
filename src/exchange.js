const CACHE_KEY = 'money_tracker_rates';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000;
const REQUEST_TIMEOUT = 8000;

const CURRENCIES = [
  { code: 'CNY', symbol: '¥', name: '人民币' },
  { code: 'USD', symbol: '$', name: '美元' },
  { code: 'EUR', symbol: '€', name: '欧元' },
  { code: 'GBP', symbol: '£', name: '英镑' },
  { code: 'JPY', symbol: '¥', name: '日元' },
  { code: 'KRW', symbol: '₩', name: '韩元' },
  { code: 'HKD', symbol: 'HK$', name: '港币' },
  { code: 'TWD', symbol: 'NT$', name: '新台币' },
];

const BASE_CURRENCY = 'CNY';

const OFFLINE_RATES = {
  CNY: 1,
  USD: 0.138,
  EUR: 0.127,
  GBP: 0.109,
  JPY: 20.8,
  KRW: 190,
  HKD: 1.08,
  TWD: 4.47,
};

let memoryCache = null;
let refreshTimer = null;
let inFlight = null;
let isFetching = false;
let lastError = null;

const listeners = new Set();

function normalizeRates(rawRates) {
  const normalized = { ...OFFLINE_RATES };

  if (!rawRates || typeof rawRates !== 'object') {
    return normalized;
  }

  Object.entries(rawRates).forEach(([code, value]) => {
    if (Number.isFinite(value) && value > 0) {
      normalized[code.toUpperCase()] = value;
    }
  });

  normalized[BASE_CURRENCY] = 1;
  return normalized;
}

function loadCache() {
  if (memoryCache) return memoryCache;

  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    const rates = normalizeRates(parsed.rates);
    const timestamp = Number(parsed.timestamp) || 0;

    memoryCache = {
      rates,
      timestamp,
      source: parsed.source || 'cache',
      providerTimestamp: parsed.providerTimestamp || null,
    };

    return memoryCache;
  } catch (error) {
    console.warn('Failed to load rate cache:', error);
    return null;
  }
}

function saveCache(rates, source, providerTimestamp = null) {
  memoryCache = {
    rates: normalizeRates(rates),
    timestamp: Date.now(),
    source,
    providerTimestamp,
  };

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(memoryCache));
  } catch (error) {
    console.warn('Failed to persist rate cache:', error);
  }
}

function isCacheFresh(cache) {
  if (!cache) return false;
  return Date.now() - cache.timestamp < CACHE_TTL;
}

function notify() {
  listeners.forEach((fn) => fn(getSnapshot()));
}

function getOfflineRates() {
  return { ...OFFLINE_RATES };
}

function getSnapshot() {
  const cache = loadCache();
  const hasCache = Boolean(cache && cache.rates);

  return {
    rates: hasCache ? cache.rates : getOfflineRates(),
    timestamp: cache?.timestamp || 0,
    source: cache?.source || 'offline',
    providerTimestamp: cache?.providerTimestamp || null,
    isStale: !isCacheFresh(cache),
    isFetching,
    lastError,
  };
}

function getCachedRates() {
  return getSnapshot().rates;
}

function mapToBaseCny(ratesByBase, baseCode) {
  const sourceRates = { [baseCode]: 1, ...ratesByBase };

  if (baseCode === BASE_CURRENCY) {
    return normalizeRates(sourceRates);
  }

  const baseToCny = sourceRates[BASE_CURRENCY];
  if (!Number.isFinite(baseToCny) || baseToCny <= 0) {
    throw new Error(`Missing ${BASE_CURRENCY} rate from ${baseCode} source`);
  }

  const mapped = {};
  Object.entries(sourceRates).forEach(([code, rate]) => {
    if (Number.isFinite(rate) && rate > 0) {
      mapped[code] = rate / baseToCny;
    }
  });
  mapped[BASE_CURRENCY] = 1;

  return normalizeRates(mapped);
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFromOpenErApi() {
  const data = await fetchJson(`https://open.er-api.com/v6/latest/${BASE_CURRENCY}`);
  if (!data?.rates || (data.result && data.result !== 'success')) {
    throw new Error('open.er-api malformed response');
  }

  return {
    rates: mapToBaseCny(data.rates, BASE_CURRENCY),
    source: 'open.er-api',
    providerTimestamp: data.time_last_update_utc || null,
  };
}

async function fetchFromFrankfurter() {
  try {
    const data = await fetchJson(`https://api.frankfurter.app/latest?from=${BASE_CURRENCY}`);
    if (data?.rates) {
      return {
        rates: mapToBaseCny(data.rates, BASE_CURRENCY),
        source: 'frankfurter',
        providerTimestamp: data.date || null,
      };
    }
  } catch (error) {
    // fallback below
  }

  const data = await fetchJson('https://api.frankfurter.app/latest?from=USD');
  if (!data?.rates) {
    throw new Error('frankfurter malformed response');
  }

  return {
    rates: mapToBaseCny(data.rates, 'USD'),
    source: 'frankfurter-usd',
    providerTimestamp: data.date || null,
  };
}

async function fetchNetworkRates() {
  try {
    return await fetchFromOpenErApi();
  } catch (error) {
    console.warn('open.er-api failed, trying frankfurter:', error);
    return fetchFromFrankfurter();
  }
}

async function fetchRates({ force = false } = {}) {
  const cache = loadCache();

  if (!force && isCacheFresh(cache)) {
    return cache.rates;
  }

  if (inFlight) return inFlight;

  isFetching = true;
  notify();

  inFlight = (async () => {
    try {
      const result = await fetchNetworkRates();
      saveCache(result.rates, result.source, result.providerTimestamp);
      lastError = null;
      notify();
      return memoryCache.rates;
    } catch (error) {
      lastError = error?.message || String(error);
      console.warn('All exchange rate providers failed:', error);
      notify();
      return cache?.rates || getOfflineRates();
    } finally {
      isFetching = false;
      inFlight = null;
      notify();
    }
  })();

  return inFlight;
}

function normalizeCode(code) {
  return (code || BASE_CURRENCY).toUpperCase();
}

function getRate(fromCode, toCode, rates = getCachedRates()) {
  const from = normalizeCode(fromCode);
  const to = normalizeCode(toCode);

  if (from === to) return 1;

  const fromRate = from === BASE_CURRENCY ? 1 : rates[from];
  const toRate = to === BASE_CURRENCY ? 1 : rates[to];

  if (!Number.isFinite(fromRate) || fromRate <= 0 || !Number.isFinite(toRate) || toRate <= 0) {
    return null;
  }

  return toRate / fromRate;
}

function convert(amount, fromCode, toCode, rates = getCachedRates()) {
  if (!Number.isFinite(amount)) return 0;

  const rate = getRate(fromCode, toCode, rates);
  if (!Number.isFinite(rate)) return amount;

  return amount * rate;
}

function formatConverted(amount, currencyCode) {
  const code = normalizeCode(currencyCode);
  const curr = CURRENCIES.find((c) => c.code === code);
  const symbol = curr ? curr.symbol : code;

  const decimals = (code === 'JPY' || code === 'KRW') ? 0 : 2;
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  return `${symbol}${safeAmount.toFixed(decimals)}`;
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function startAutoRefresh(interval = AUTO_REFRESH_INTERVAL) {
  if (refreshTimer) return;

  fetchRates({ force: true });

  refreshTimer = setInterval(() => {
    fetchRates({ force: true });
  }, interval);
}

function stopAutoRefresh() {
  if (!refreshTimer) return;
  clearInterval(refreshTimer);
  refreshTimer = null;
}

export const exchangeService = {
  CURRENCIES,
  BASE_CURRENCY,
  fetchRates,
  getCachedRates,
  getSnapshot,
  getRate,
  convert,
  formatConverted,
  getOfflineRates,
  subscribe,
  startAutoRefresh,
  stopAutoRefresh,
};
