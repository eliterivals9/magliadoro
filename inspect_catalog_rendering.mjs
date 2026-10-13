import fs from 'fs';

const indexHtml = fs.readFileSync('index.html', 'utf8');
const lines = indexHtml.split('\n');

console.log('=== SEARCHING FOR CATALOG LOADING & RENDERING IN INDEX.HTML ===');

lines.forEach((line, idx) => {
  if (line.includes('async function caricaProdotti') || 
      line.includes('function render') || 
      line.includes('function applicaFiltri') || 
      line.includes('function popola') ||
      line.includes('function apriPersonalizza') ||
      line.includes('function apriAccessorioModal') ||
      line.includes('function aggiungiAlCarrello') ||
      line.includes('function generaCard') ||
      line.includes('function mostraPAGINA') ||
      line.includes('function apriSezione')) {
    console.log(`Line ${idx + 1}: ${line.trim().substring(0, 100)}`);
  }
});
