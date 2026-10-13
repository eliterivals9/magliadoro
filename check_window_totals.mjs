import fs from 'fs';

const indexHtml = fs.readFileSync('index.html', 'utf8');

function findMatches(term) {
  const regex = new RegExp(term, 'g');
  let match;
  console.log(`\n================ Matches for ${term} ================`);
  while ((match = regex.exec(indexHtml)) !== null) {
    const lineNum = indexHtml.substring(0, match.index).split('\n').length;
    console.log(`Line ${lineNum}: ${indexHtml.substring(match.index - 30, match.index + 120).trim()}`);
  }
}

findMatches('totaleArticoliClub');
findMatches('totaleArticoliNazionali');
findMatches('indiceProdottiPerSquadra');
findMatches('_mappaConteggiCache');
