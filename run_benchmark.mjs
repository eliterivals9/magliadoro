import fs from 'fs';
import vm from 'vm';

const indexHtml = fs.readFileSync('index.html', 'utf8');
const products = JSON.parse(fs.readFileSync('products_local.json', 'utf8'));

// Extract all <script> contents from index.html except external src scripts
const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let match;
const scripts = [];
while ((match = scriptRegex.exec(indexHtml)) !== null) {
  const fullTag = match[0];
  if (!fullTag.includes('src=')) {
    scripts.push(match[1]);
  }
}

console.log(`Extracted ${scripts.length} inline script blocks from index.html.`);

// Minimal DOM mock
class MockElement {
  constructor(id = '') {
    this.id = id;
    this.classList = new Set();
    this.style = {};
    this.innerText = '';
    this.innerHTML = '';
    this.children = [];
  }
  getAttribute() { return null; }
  setAttribute() {}
  addEventListener() {}
  appendChild(child) { this.children.push(child); }
  querySelector() { return new MockElement(); }
  querySelectorAll() { return []; }
}

const elements = {};
function getOrCreateElement(id) {
  if (!elements[id]) {
    elements[id] = new MockElement(id);
  }
  return elements[id];
}

const mockDocument = {
  getElementById: (id) => getOrCreateElement(id),
  querySelector: () => new MockElement(),
  querySelectorAll: () => [],
  createElement: () => new MockElement(),
  body: new MockElement('body'),
  addEventListener: () => {}
};

const mockWindow = {
  document: mockDocument,
  location: { href: 'http://localhost/', search: '', hash: '' },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  addEventListener: () => {},
  removeEventListener: () => {},
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval,
  console: console,
  appSettings: {},
  databaseProdotti: products,
  databaseInizializzato: true,
  publicTeams: []
};
mockWindow.window = mockWindow;

const context = vm.createContext(mockWindow);

// Add scan counting interceptor on databaseProdotti inside context
let totalScans = 0;
vm.runInContext(`
  let _scanCount = 0;
  const origFilter = Array.prototype.filter;
  Array.prototype.filter = function(...args) {
    if (this === window.databaseProdotti || (Array.isArray(window.databaseProdotti) && this.length === window.databaseProdotti.length && this[0] === window.databaseProdotti[0])) {
      _scanCount++;
    }
    return origFilter.apply(this, args);
  };
  function getScanCount() { return _scanCount; }
  function resetScanCount() { _scanCount = 0; }
`, context);

// Execute inline scripts in context
scripts.forEach((code, i) => {
  try {
    vm.runInContext(code, context);
  } catch (err) {
    // Ignore minor bootstrap errors due to missing browser APIs
  }
});

console.log("Environment initialized!");
console.log("DatabaseProdotti in context:", context.databaseProdotti ? context.databaseProdotti.length : 0);
console.log("PublicTeams length:", context.publicTeams ? context.publicTeams.length : 0);

// Test executing renderizzaSidebarLegheClub
vm.runInContext('resetScanCount()', context);
const t0 = performance.now();
vm.runInContext('if (typeof renderizzaSidebarLegheClub === "function") renderizzaSidebarLegheClub();', context);
const t1 = performance.now();
const scansClub = vm.runInContext('getScanCount()', context);
console.log(`renderizzaSidebarLegheClub execution time: ${(t1 - t0).toFixed(2)} ms, catalog scans: ${scansClub}`);

// Test executing renderizzaSidebarLegheNazionali
vm.runInContext('resetScanCount()', context);
const t2 = performance.now();
vm.runInContext('if (typeof renderizzaSidebarLegheNazionali === "function") renderizzaSidebarLegheNazionali();', context);
const t3 = performance.now();
const scansNaz = vm.runInContext('getScanCount()', context);
console.log(`renderizzaSidebarLegheNazionali execution time: ${(t3 - t2).toFixed(2)} ms, catalog scans: ${scansNaz}`);

// Test executing renderizzaProdottiSquadraConFiltri
vm.runInContext('resetScanCount()', context);
const t4 = performance.now();
vm.runInContext('if (typeof renderizzaProdottiSquadraConFiltri === "function") renderizzaProdottiSquadraConFiltri();', context);
const t5 = performance.now();
const scansRender = vm.runInContext('getScanCount()', context);
console.log(`renderizzaProdottiSquadraConFiltri execution time: ${(t5 - t4).toFixed(2)} ms, catalog scans: ${scansRender}`);
