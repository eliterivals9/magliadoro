import fs from 'fs';

const indexHtml = fs.readFileSync('index.html', 'utf8');

function extractFunc(name) {
  const start = indexHtml.indexOf(`function ${name}(`);
  if (start === -1) {
    console.log(`=== NOT FOUND: function ${name} ===`);
    return;
  }
  // Find where function ends by counting braces or finding next function
  let openBraces = 0;
  let started = false;
  let end = start;
  for (let i = start; i < indexHtml.length; i++) {
    if (indexHtml[i] === '{') {
      openBraces++;
      started = true;
    } else if (indexHtml[i] === '}') {
      openBraces--;
      if (started && openBraces === 0) {
        end = i + 1;
        break;
      }
    }
  }
  console.log(`\n==============================================`);
  console.log(`FUNCTION: ${name} (length ${end - start} chars)`);
  console.log(`==============================================`);
  console.log(indexHtml.substring(start, end));
}

[
  'ricalcolaMappaConteggiProdotti',
  'contaProdottiVisibiliSquadra',
  'squadraHaProdottiVisibili',
  'ottieniSquadrePubblicheVisibili',
  'renderizzaSidebarLegheClub',
  'renderizzaSidebarLegheNazionali',
  'renderizzaProdottiSquadraConFiltri',
  'renderizzaGrigliaClubLega',
  'renderizzaGrigliaNazionaliCategoria'
].forEach(extractFunc);
