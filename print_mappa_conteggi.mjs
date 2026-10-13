import fs from 'fs';

const indexHtml = fs.readFileSync('index.html', 'utf8');

const start = indexHtml.indexOf('function ricalcolaMappaConteggiProdotti(');
const end = indexHtml.indexOf('window.ricalcolaMappaConteggiProdotti', start);

console.log(indexHtml.substring(start, end + 80));
