import fs from 'fs';
import vm from 'vm';

let indexHtml = fs.readFileSync('index.html', 'utf8');
const products = JSON.parse(fs.readFileSync('products_local.json', 'utf8'));

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

scripts.forEach(code => {
  try {
    vm.runInContext(code, context);
  } catch (e) {
    //
  }
});

vm.runInContext(`
  window.databaseProdotti = ${JSON.stringify(products)};
  window.publicTeams = ${JSON.stringify(mockPublicTeams)};
  if (typeof window.ricalcolaMappaConteggiProdotti === 'function') window.ricalcolaMappaConteggiProdotti();
  if (typeof window.aggiornaIndiceProdottiPerSquadra === 'function') window.aggiornaIndiceProdottiPerSquadra();
`, context);

console.log("=== ORIGINAL UN-OPTIMIZED RESULTS ===");

const testCases = [
  'tutti_club',
  'tutte_nazionali',
  'lega_premier-league',
  'lega_serie-a',
  'continent_europa',
  'Real Madrid',
  'Italia'
];

testCases.forEach(sq => {
  const prods = vm.runInContext(`
    if (typeof window.generaProdottiSquadra === 'function') {
      window.generaProdottiSquadra("${sq}");
    } else {
      [];
    }
  `, context) || [];
  const validProds = prods.filter(p => vm.runInContext(`
    (typeof window.isProdottoValidoPubblico === 'function') ? window.isProdottoValidoPubblico(p) : true
  `, context));
  console.log(`[Original] ${sq}: raw = ${prods.length}`);
});

const origTotClub = vm.runInContext(`
  window.databaseProdotti.filter(p => window.isProdottoValidoPubblico(p) && window.isClub(p.squadra)).length
`, context);

const origTotNaz = vm.runInContext(`
  window.databaseProdotti.filter(p => window.isProdottoValidoPubblico(p) && window.isNazionale(p.squadra)).length
`, context);

console.log(`[Original] totClub: ${origTotClub}, totNaz: ${origTotNaz}`);

const origClubSeasons = vm.runInContext(`
  window.ottieniStagioniDeduplicateEOrdinate(window.databaseProdotti.filter(p => window.isClub(p.squadra) && window.isProdottoValidoPubblico(p)))
`, context);

const origNazSeasons = vm.runInContext(`
  window.ottieniStagioniDeduplicateEOrdinate(window.databaseProdotti.filter(p => window.isNazionale(p.squadra) && window.isProdottoValidoPubblico(p)))
`, context);

console.log(`[Original] Club Seasons count: ${origClubSeasons.length}, Naz Seasons count: ${origNazSeasons.length}`);
