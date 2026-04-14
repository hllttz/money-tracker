import { renderHome } from './src/pages/home.js';
import { renderStats } from './src/pages/stats.js';
import { renderTransactions } from './src/pages/transactions.js';

// mock DOM
global.document = {
  createElement: (tag) => ({
    className: '',
    innerHTML: '',
    appendChild: () => {},
    querySelector: () => null,
    querySelectorAll: () => []
  }),
  head: { appendChild: () => {} }
};
global.window = {
  devicePixelRatio: 1,
  addEventListener: () => {}
};
global.localStorage = {
  getItem: () => null,
  setItem: () => {}
};

try {
  let home = renderHome();
  console.log("Home rendered OK");
} catch(e) {
  console.error("Home error:", e);
}

try {
  let stats = renderStats();
  console.log("Stats rendered OK");
} catch(e) {
  console.error("Stats error:", e);
}

try {
  let tx = renderTransactions();
  console.log("Tx rendered OK");
} catch(e) {
  console.error("Tx error:", e);
}
