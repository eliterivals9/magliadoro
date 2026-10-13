import fs from 'fs';

const indexHtml = fs.readFileSync('index.html', 'utf8');
const lines = indexHtml.split('\n');

function printRange(start, count, label) {
  console.log(`\n=================== ${label} (Lines ${start} to ${start + count}) ===================`);
  for (let i = start - 1; i < Math.min(lines.length, start + count - 1); i++) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
}

printRange(17910, 70, "1. ricalcolaMappaConteggiProdotti & ottieniSquadrePubblicheVisibili");
printRange(19380, 45, "2. renderizzaSidebarLegheClub");
printRange(20345, 45, "3. renderizzaSidebarLegheNazionali");
printRange(23135, 100, "4. aggiornaIndiceProdottiPerSquadra & generaProdottiSquadra");
printRange(23705, 20, "5. Seasons in renderizzaProdottiSquadraConFiltri");
printRange(23820, 20, "6. Naz Seasons in renderizzaProdottiSquadraConFiltri");
printRange(23935, 30, "7. Totals in renderizzaProdottiSquadraConFiltri");
