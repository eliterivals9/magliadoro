import fs from 'fs';

const indexHtml = fs.readFileSync('index.html', 'utf8');

function findFn(fnName) {
  const pos = indexHtml.indexOf(fnName);
  if (pos !== -1) {
    console.log(`\n=================== ${fnName} at ${pos} ===================`);
    console.log(indexHtml.substring(Math.max(0, pos - 100), Math.min(indexHtml.length, pos + 1500)));
  } else {
    console.log(`NOT FOUND: ${fnName}`);
  }
}

['contaProdottiVisibiliSquadra', 'renderizzaSidebarLegheClub', 'renderizzaSidebarLegheNazionali', 'renderizzaProdottiSquadraConFiltri'].forEach(findFn);
