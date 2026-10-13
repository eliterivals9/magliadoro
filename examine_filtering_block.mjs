import fs from 'fs';

const indexHtml = fs.readFileSync('index.html', 'utf8');
const lines = indexHtml.split('\n');

console.log(`Total lines in index.html: ${lines.length}`);

// Print lines 22800 to 24200 with line numbers
const startLine = 22800;
const endLine = 24200;

for (let i = startLine - 1; i < Math.min(lines.length, endLine); i++) {
  // Only print function definitions, key calls, or lines with databaseProdotti / publicTeams
  const l = lines[i];
  if (l.includes('function ') || l.includes('databaseProdotti') || l.includes('publicTeams') || l.includes('ottieniProdotti') || l.includes('renderizza') || l.includes('totaleArticoli') || l.includes('isClub') || l.includes('isNazionale')) {
    console.log(`Line ${i+1}: ${l.trim().substring(0, 140)}`);
  }
}
