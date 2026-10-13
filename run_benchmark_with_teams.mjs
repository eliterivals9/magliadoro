import fs from 'fs';
import vm from 'vm';

const indexHtml = fs.readFileSync('index.html', 'utf8');
const products = JSON.parse(fs.readFileSync('products_local.json', 'utf8'));

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

// Extract script blocks
const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let match;
const scripts = [];
while ((match = scriptRegex.exec(indexHtml)) !== null) {
  const fullTag = match[0];
  if (!fullTag.includes('src=')) {
    scripts.push(match[1]);
  }
}

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
  publicTeams: mockPublicTeams
};
mockWindow.window = mockWindow;

const context = vm.createContext(mockWindow);

// Set window.databaseProdotti in context FIRST
vm.runInContext(`
  window.databaseProdotti = ${JSON.stringify(products)};
  window.publicTeams = ${JSON.stringify(mockPublicTeams)};
  window.databaseInizializzato = true;

  let _scanCount = 0;

  const origFilter = Array.prototype.filter;
  Array.prototype.filter = function(fn, ...args) {
    if (this === window.databaseProdotti || (Array.isArray(window.databaseProdotti) && this.length === window.databaseProdotti.length && this[0] === window.databaseProdotti[0])) {
      _scanCount++;
    }
    return origFilter.call(this, fn, ...args);
  };

  function getMetrics() {
    return {
      scanCount: _scanCount
    };
  }
  function resetMetrics() {
    _scanCount = 0;
  }
`, context);

scripts.forEach((code) => {
  try {
    vm.runInContext(code, context);
  } catch (err) {
    //
  }
});

// Ensure databaseInizializzato is true and databaseProdotti is assigned
vm.runInContext(`
  if (!databaseProdotti || databaseProdotti.length === 0) {
    databaseProdotti = window.databaseProdotti;
  }
  databaseInizializzato = true;
  if (typeof ricalcolaMappaConteggiProdotti === 'function') ricalcolaMappaConteggiProdotti();
  if (typeof aggiornaIndiceProdottiPerSquadra === 'function') aggiornaIndiceProdottiPerSquadra();
`, context);

console.log("\n=================== BENCHMARK BEFORE OPTIMIZATION ===================");
console.log(`databaseProdotti count: ${vm.runInContext('databaseProdotti.length', context)}`);

// 1. renderizzaSidebarLegheClub
vm.runInContext('resetMetrics()', context);
let t0 = performance.now();
vm.runInContext('if (typeof renderizzaSidebarLegheClub === "function") renderizzaSidebarLegheClub();', context);
let t1 = performance.now();
let m1 = vm.runInContext('getMetrics()', context);
console.log(`1. renderizzaSidebarLegheClub:`);
console.log(`   Time: ${(t1 - t0).toFixed(2)} ms | Catalog Scans: ${m1.scanCount}`);

// 2. renderizzaSidebarLegheNazionali
vm.runInContext('resetMetrics()', context);
t0 = performance.now();
vm.runInContext('if (typeof renderizzaSidebarLegheNazionali === "function") renderizzaSidebarLegheNazionali();', context);
t1 = performance.now();
let m2 = vm.runInContext('getMetrics()', context);
console.log(`2. renderizzaSidebarLegheNazionali:`);
console.log(`   Time: ${(t1 - t0).toFixed(2)} ms | Catalog Scans: ${m2.scanCount}`);

// 3. renderizzaProdottiSquadraConFiltri (tutti_club)
vm.runInContext('squadraSelezionata = "tutti_club"; modalitaClubCorrente = "tutti-gli-articoli"; resetMetrics()', context);
t0 = performance.now();
vm.runInContext('if (typeof renderizzaProdottiSquadraConFiltri === "function") renderizzaProdottiSquadraConFiltri();', context);
t1 = performance.now();
let m3 = vm.runInContext('getMetrics()', context);
console.log(`3. renderizzaProdottiSquadraConFiltri (tutti_club):`);
console.log(`   Time: ${(t1 - t0).toFixed(2)} ms | Catalog Scans: ${m3.scanCount}`);

// 4. renderizzaProdottiSquadraConFiltri (lega_premier-league)
vm.runInContext('squadraSelezionata = "lega_premier-league"; modalitaClubCorrente = "prodotti-club"; resetMetrics()', context);
t0 = performance.now();
vm.runInContext('if (typeof renderizzaProdottiSquadraConFiltri === "function") renderizzaProdottiSquadraConFiltri();', context);
t1 = performance.now();
let m4 = vm.runInContext('getMetrics()', context);
console.log(`4. renderizzaProdottiSquadraConFiltri (lega_premier-league):`);
console.log(`   Time: ${(t1 - t0).toFixed(2)} ms | Catalog Scans: ${m4.scanCount}`);

// 5. renderizzaProdottiSquadraConFiltri (tutte_nazionali)
vm.runInContext('squadraSelezionata = "tutte_nazionali"; modalitaNazionaliCorrente = "tutti-gli-articoli"; resetMetrics()', context);
t0 = performance.now();
vm.runInContext('if (typeof renderizzaProdottiSquadraConFiltri === "function") renderizzaProdottiSquadraConFiltri();', context);
t1 = performance.now();
let m5 = vm.runInContext('getMetrics()', context);
console.log(`5. renderizzaProdottiSquadraConFiltri (tutte_nazionali):`);
console.log(`   Time: ${(t1 - t0).toFixed(2)} ms | Catalog Scans: ${m5.scanCount}`);
