import fs from 'fs';

const indexHtml = fs.readFileSync('index.html', 'utf8');

function findFnBody(fnName) {
  const patterns = [
    `function ${fnName}(`,
    `function ${fnName} (`,
    `const ${fnName} =`,
    `let ${fnName} =`,
    `window.${fnName} =`
  ];
  for (const pat of patterns) {
    const idx = indexHtml.indexOf(pat);
    if (idx !== -1) {
      // Print around idx
      console.log(`=== FOUND: ${pat} at ${idx} ===`);
      console.log(indexHtml.substring(idx, idx + 2500));
      return;
    }
  }
  console.log(`=== NOT FOUND: ${fnName} ===`);
}

['ottieniSquadrePubblicheVisibili', 'squadraHaProdottiVisibili', 'contaProdottiSquadra', 'ottieniProdottiFiltratiSquadra', 'ottieniProdottiFiltrati'].forEach(findFnBody);
