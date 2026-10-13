import fs from 'fs';
import vm from 'vm';

let indexHtml = fs.readFileSync('index.html', 'utf8');
const products = JSON.parse(fs.readFileSync('products_local.json', 'utf8'));

// Instrument index.html code to log whenever databaseProdotti is scanned!
// Replace `databaseProdotti.filter(` with `(window._incScan('filter'), databaseProdotti).filter(`
indexHtml = indexHtml.replace(/databaseProdotti\s*\.\s*(filter|forEach|map|reduce|find|some)\s*\(/g, '(window._incScan("$1"), databaseProdotti).$1(');

const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let match;
const scripts = [];
while ((match = scriptRegex.exec(indexHtml)) !== null) {
  const fullTag = match[0];
  if (!fullTag.includes('src=')) {
    scripts.push(match[1]);
  }
}

// Generate publicTeams from products_local.json
const teamsMap = new Map();
products.forEach(p => {
  if (p.squadra) {
    const sq = p.squadra.trim();
    if (!teamsMap.has(sq)) {
      const isNaz = p.categoria === 'Nazionali' || p.target === 'Nazionale' || ['Italia', 'Francia', 'Brasile', 'Argentina', 'Spagna', 'Germania', 'Inghilterra', 'Portogallo', 'Giappone', 'Galles', 'Olanda', 'Belgio', 'Messico', 'Uruguay', 'Marocco'].includes(sq);
      teamsMap.set(sq, {
        name: sq,
        categoria: isNaz ? 'Nazionali' : 'Club',
        sezione: isNaz ? 'Europa' : 'Serie A'
      });
    }
  }
});
const mockPublicTeams = Array.from(teamsMap.values());

class MockElement {
  constructor(id = '') {
    this.id = id;
    this.classList = {
      contains: () => false,
      add: () => {},
      remove: () => {}
    };
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
  publicTeams: mockPublicTeams,
  _scanCounts: {},
  _incScan: (op) => {
    mockWindow._scanCounts[op] = (mockWindow._scanCounts[op] || 0) + 1;
    mockWindow._totalScans = (mockWindow._totalScans || 0) + 1;
  },
  _resetScans: () => {
    mockWindow._scanCounts = {};
    mockWindow._totalScans = 0;
  }
};
mockWindow.window = mockWindow;

const context = vm.createContext(mockWindow);

scripts.forEach((code) => {
  try {
    vm.runInContext(code, context);
  } catch (err) {
    //
  }
});

vm.runInContext(`
  databaseProdotti = window.databaseProdotti;
  publicTeams = window.publicTeams;
  databaseInizializzato = true;
  if (typeof ricalcolaMappaConteggiProdotti === 'function') ricalcolaMappaConteggiProdotti();
  if (typeof aggiornaIndiceProdottiPerSquadra === 'function') aggiornaIndiceProdottiPerSquadra();
`, context);

console.log("\n=================== BENCHMARK BEFORE OPTIMIZATION ===================");
console.log(`databaseProdotti count: ${vm.runInContext('databaseProdotti.length', context)}`);

function runTest(label, code) {
  vm.runInContext('_resetScans()', context);
  const t0 = performance.now();
  vm.runInContext(code, context);
  const t1 = performance.now();
  const totalScans = vm.runInContext('_totalScans', context) || 0;
  const breakdown = vm.runInContext('JSON.stringify(_scanCounts)', context);
  console.log(`\n[${label}]`);
  console.log(`  Time: ${(t1 - t0).toFixed(2)} ms`);
  console.log(`  Total Catalog Scans: ${totalScans}`);
  console.log(`  Operations: ${breakdown}`);
}

runTest('1. renderizzaSidebarLegheClub()', 'if (typeof renderizzaSidebarLegheClub === "function") renderizzaSidebarLegheClub();');
runTest('2. renderizzaSidebarLegheNazionali()', 'if (typeof renderizzaSidebarLegheNazionali === "function") renderizzaSidebarLegheNazionali();');
runTest('3. renderizzaProdottiSquadraConFiltri("tutti_club")', 'squadraSelezionata = "tutti_club"; modalitaClubCorrente = "tutti-gli-articoli"; if (typeof renderizzaProdottiSquadraConFiltri === "function") renderizzaProdottiSquadraConFiltri();');
runTest('4. renderizzaProdottiSquadraConFiltri("lega_premier-league")', 'squadraSelezionata = "lega_premier-league"; modalitaClubCorrente = "prodotti-club"; if (typeof renderizzaProdottiSquadraConFiltri === "function") renderizzaProdottiSquadraConFiltri();');
runTest('5. renderizzaProdottiSquadraConFiltri("tutte_nazionali")', 'squadraSelezionata = "tutte_nazionali"; modalitaNazionaliCorrente = "tutti-gli-articoli"; if (typeof renderizzaProdottiSquadraConFiltri === "function") renderizzaProdottiSquadraConFiltri();');
