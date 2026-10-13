import fs from 'fs';

const indexHtml = fs.readFileSync('index.html', 'utf8');

// Search for functions that filter or count databaseProdotti or publicTeams
const fnRegex = /function\s+([a-zA-Z0-9_$]+)\s*\(([^)]*)\)\s*\{/g;
let match;
const functions = [];
while ((match = fnRegex.exec(indexHtml)) !== null) {
  functions.push({
    name: match[1],
    index: match.index
  });
}

console.log(`Found ${functions.length} functions.`);

// Search for functions containing databaseProdotti or publicTeams or squad
const relevantFns = [
  'squadraHaProdottiVisibili',
  'ottieniSquadrePubblicheVisibili',
  'contaProdottiSquadra',
  'renderizzaSidebarLegheClub',
  'renderizzaSidebarLegheNazionali',
  'renderizzaProdottiSquadraConFiltri',
  'renderizzaFiltriCatalogoPubblici',
  'aggiornaConteggi',
  'aggiornaSidebar',
  'isProdottoValidoPubblico',
  'isClub',
  'isNazionale',
  'filtraProdotti',
  'ottieniProdottiVisibili'
];

relevantFns.forEach(fnName => {
  const pos = indexHtml.indexOf(`function ${fnName}`);
  if (pos !== -1) {
    // Find matching brace or next function
    const endPos = indexHtml.indexOf('\nfunction ', pos + 10);
    const code = indexHtml.substring(pos, endPos !== -1 ? endPos : pos + 2000);
    console.log(`\n=================== FUNCTION: ${fnName} ===================`);
    console.log(code.substring(0, 1500));
  } else {
    console.log(`Function ${fnName} NOT FOUND directly with 'function ${fnName}'`);
  }
});
