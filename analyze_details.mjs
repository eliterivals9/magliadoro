import fs from 'fs';

const indexHtml = fs.readFileSync('index.html', 'utf8');

console.log('=== 1. ANALYZING CONSOLE.WARN AND CONSOLE.ERROR LOCATIONS ===');
const lines = indexHtml.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('console.warn(') || line.includes('console.error(')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});

console.log('\n=== 2. ANALYZING CATALOG LOADING & API FETCH ===');
lines.forEach((line, idx) => {
  if (line.includes('async function caricaProdotti') || line.includes('/api/products') || line.includes('databaseProdotti')) {
    if (idx < 5000 || idx > 15000) { // keep log concise
      console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
  }
});

console.log('\n=== 3. ANALYZING SEARCH & FILTER DEBOUNCE AND LISTENERS ===');
lines.forEach((line, idx) => {
  if (line.includes('addEventListener') && (line.includes('input') || line.includes('keyup') || line.includes('scroll') || line.includes('resize'))) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
