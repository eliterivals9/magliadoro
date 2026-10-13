import fs from 'fs';

// Load products and create realistic environment
const products = JSON.parse(fs.readFileSync('products_local.json', 'utf8'));
const indexHtml = fs.readFileSync('index.html', 'utf8');

console.log(`Loaded ${products.length} products.`);

// Let's create a script that runs the exact current functions from index.html using Node
// We will evaluate the number of databaseProdotti filter executions per action.

const evalContext = `
const fs = require('fs');
const databaseProdotti = ${JSON.stringify(products)};
const publicTeams = []; // Will be populated
let databaseInizializzato = true;
let isCaricamentoCatalogoInCorso = false;
let databaseClub = [];
let databaseNazionali = [];
let _clubTeamsSet = null;
let _nazionaliTeamsSet = null;
let _mappaConteggiCache = null;
let filtroCategoriaCorrente = 'tutti';
let filtroStagioneCorrente = 'tutte';
let squadraSelezionata = 'tutti_club';
let modalitaClubCorrente = 'tutti-gli-articoli';
let modalitaNazionaliCorrente = 'griglia-nazionali';
let legaClubSelezionata = 'tutti';
let categoriaNazionaliSelezionata = 'tutti';
let filtroLegaDinamicoClub = 'tutte';
let filtroCategoriaDinamicoNazionali = 'tutte';
let filtroSquadraDinamico = 'tutte';
let queryRicercaProdottiClub = '';
let queryRicercaProdottiNazionali = '';
let ordinamentoCorrente = 'novita';

// We mock DOM elements
const document = {
  getElementById: (id) => ({
    classList: { contains: () => false },
    style: {},
    innerText: '',
    innerHTML: ''
  })
};
window = {
  appSettings: {},
  document
};

let scanCounter = 0;
const originalFilter = Array.prototype.filter;
Array.prototype.filter = function(...args) {
  if (this === databaseProdotti) {
    scanCounter++;
  }
  return originalFilter.apply(this, args);
};

// Now evaluate the code from index.html for filtering functions
`;

// Let's write measure_scans.mjs
fs.writeFileSync('/tmp_measure.js', evalContext);
