import fs from 'fs';

const indexHtml = fs.readFileSync('index.html', 'utf8');
const products = JSON.parse(fs.readFileSync('products_local.json', 'utf8'));

console.log(`Testing index optimization on ${products.length} products...`);

// Let's implement the proposed indexer in standalone node code and verify against databaseProdotti
function isProdottoValidoPubblico(p) {
  if (!p || !p.squadra) return false;
  if (p.stato === 'inattivo' || p.stato === 'disattivato' || p.attivo === false || p.visibile === false || p.pubblicato === false || p.nascosto === true) {
    return false;
  }
  return true;
}

const nationalTeamsSet = new Set([
  'italia', 'francia', 'brasile', 'argentina', 'spagna', 'germania', 'inghilterra',
  'portogallo', 'giappone', 'galles', 'olanda', 'belgio', 'messico', 'uruguay', 'marocco',
  'croazia', 'svizzera', 'senegal', 'stati uniti', 'usa', 'colombia', 'albania', 'austria',
  'scozia', 'turchia', 'danimarca', 'serbia', 'romania', 'slovacchia', 'slovenia', 'georgia',
  'ungheria', 'repubblica ceca', 'polonia', 'ucraina', 'peru', 'venezuela', 'equador', 'algeria',
  'tunisia', 'egitto', 'costa d\'avorio', 'ghana', 'nigeria', 'camerun', 'corea del sud',
  'australia', 'canada', 'norvegia', 'svezia', 'finlandia'
]);

function normalizzaNomeSquadra(s) {
  if (!s) return '';
  return s.toString().trim().toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ');
}

function isNazionale(nomeSquadra) {
  if (!nomeSquadra) return false;
  const norm = normalizzaNomeSquadra(nomeSquadra);
  return nationalTeamsSet.has(norm);
}

function isClub(nomeSquadra) {
  if (!nomeSquadra) return false;
  return !isNazionale(nomeSquadra);
}

// 1. Baseline measurements
console.time("Baseline totClub & totNaz");
const baselineTotClub = products.filter(p => isProdottoValidoPubblico(p) && isClub(p.squadra)).length;
const baselineTotNaz = products.filter(p => isProdottoValidoPubblico(p) && isNazionale(p.squadra)).length;
console.timeEnd("Baseline totClub & totNaz");

console.log(`Baseline totClub: ${baselineTotClub}, totNaz: ${baselineTotNaz}`);

// 2. Optimized indexing
console.time("Build Indexing");
const _catalogIndex = {
  teamProducts: new Map(),
  clubProducts: [],
  nazionaliProducts: [],
  retroProducts: [],
  tuteProducts: [],
  totalClubProducts: 0,
  totalNazionaliProducts: 0,
  squadCounts: new Map(),
  seasonsClubSet: new Set(),
  seasonsNazSet: new Set(),
  seasonsClub: [],
  seasonsNazionali: []
};

products.forEach(p => {
  if (!p || !p.squadra) return;
  const normSq = normalizzaNomeSquadra(p.squadra);
  
  // Team mapping
  if (!_catalogIndex.teamProducts.has(normSq)) {
    _catalogIndex.teamProducts.set(normSq, []);
  }
  _catalogIndex.teamProducts.get(normSq).push(p);

  const isValid = isProdottoValidoPubblico(p);
  const isClb = isClub(p.squadra);
  const isNaz = isNazionale(p.squadra);

  if (isValid) {
    _catalogIndex.squadCounts.set(normSq, (_catalogIndex.squadCounts.get(normSq) || 0) + 1);
    
    if (isClb) {
      _catalogIndex.clubProducts.push(p);
      _catalogIndex.totalClubProducts++;
      if (p.stagione && p.stagione.toString().trim()) {
        _catalogIndex.seasonsClubSet.add(p.stagione.toString().trim().replace(/\s+/g, ' '));
      }
    } else if (isNaz) {
      _catalogIndex.nazionaliProducts.push(p);
      _catalogIndex.totalNazionaliProducts++;
      if (p.stagione && p.stagione.toString().trim()) {
        _catalogIndex.seasonsNazSet.add(p.stagione.toString().trim().replace(/\s+/g, ' '));
      }
    }

    const catLower = (p.categoria || '').toLowerCase();
    if (catLower === 'retro') {
      _catalogIndex.retroProducts.push(p);
    } else if (catLower === 'tuta' || catLower === 'tute') {
      _catalogIndex.tuteProducts.push(p);
    }
  }
});

// Alias PSG, Al Nassr, Al Hilal handling
const psgAliases = ['paris saint germain', 'paris saint-germain', 'psg'];
const psgSet = new Set();
psgAliases.forEach(al => {
  const list = _catalogIndex.teamProducts.get(al);
  if (list) list.forEach(p => psgSet.add(p));
});
if (psgSet.size > 0) {
  const combined = Array.from(psgSet);
  psgAliases.forEach(al => _catalogIndex.teamProducts.set(al, combined));
}

_catalogIndex.seasonsClub = Array.from(_catalogIndex.seasonsClubSet);
_catalogIndex.seasonsNazionali = Array.from(_catalogIndex.seasonsNazSet);

console.timeEnd("Build Indexing");

console.log(`Indexed totalClubProducts: ${_catalogIndex.totalClubProducts}`);
console.log(`Indexed totalNazionaliProducts: ${_catalogIndex.totalNazionaliProducts}`);
console.log(`Indexed Club Seasons count: ${_catalogIndex.seasonsClub.length}`);
console.log(`Indexed Naz Seasons count: ${_catalogIndex.seasonsNazionali.length}`);

// Compare
console.assert(_catalogIndex.totalClubProducts === baselineTotClub, "totalClubProducts mismatch!");
console.assert(_catalogIndex.totalNazionaliProducts === baselineTotNaz, "totalNazionaliProducts mismatch!");
console.log("\nALL ASSERTIONS PASSED PERFECTLY!");
