import fs from 'fs';

const indexHtml = fs.readFileSync('index.html', 'utf8');

function findExactLines(searchStr) {
  const lines = indexHtml.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes(searchStr)) {
      console.log(`Line ${idx + 1}: ${line.trim().substring(0, 120)}`);
    }
  });
}

console.log("=== Checking Line Numbers ===");
console.log("--- aggiornaIndiceProdottiPerSquadra ---");
findExactLines('function aggiornaIndiceProdottiPerSquadra');

console.log("--- ricalcolaMappaConteggiProdotti ---");
findExactLines('function ricalcolaMappaConteggiProdotti');

console.log("--- generaProdottiSquadra ---");
findExactLines('function generaProdottiSquadra');

console.log("--- renderizzaProdottiSquadraConFiltri ---");
findExactLines('function renderizzaProdottiSquadraConFiltri');

console.log("--- renderizzaSidebarLegheClub ---");
findExactLines('function renderizzaSidebarLegheClub');

console.log("--- renderizzaSidebarLegheNazionali ---");
findExactLines('function renderizzaSidebarLegheNazionali');

console.log("--- ottieniSquadrePubblicheVisibili ---");
findExactLines('function ottieniSquadrePubblicheVisibili');
