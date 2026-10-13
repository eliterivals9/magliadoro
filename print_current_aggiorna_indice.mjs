import fs from 'fs';

const indexHtml = fs.readFileSync('index.html', 'utf8');

const start = indexHtml.indexOf('function aggiornaIndiceProdottiPerSquadra(');
const end = indexHtml.indexOf('function inizializzaDatabaseProdotti(', start);

console.log(indexHtml.substring(start, end));
