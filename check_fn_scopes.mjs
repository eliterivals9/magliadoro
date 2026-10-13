import fs from 'fs';

const indexHtml = fs.readFileSync('index.html', 'utf8');

function checkExport(fnName) {
  const lineNum = indexHtml.split('\n').findIndex(line => line.includes(`window.${fnName} =`));
  console.log(`${fnName}: window assignment at line ${lineNum + 1}`);
}

['isProdottoValidoPubblico', 'isClub', 'isNazionale', 'generaProdottiSquadra', 'ottieniSquadrePubblicheVisibili', 'renderizzaSidebarLegheClub', 'renderizzaSidebarLegheNazionali', 'renderizzaProdottiSquadraConFiltri'].forEach(checkExport);
