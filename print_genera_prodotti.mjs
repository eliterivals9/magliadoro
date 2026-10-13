import fs from 'fs';

const indexHtml = fs.readFileSync('index.html', 'utf8');

const start = indexHtml.indexOf('function generaProdottiSquadra(');
const end = indexHtml.indexOf('function selezionaSquadraSpecifica(', start);

console.log(indexHtml.substring(start, end));
