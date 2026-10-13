import fs from 'fs';

const indexHtml = fs.readFileSync('index.html', 'utf8');

function extractFunction(funcName) {
  const startIdx = indexHtml.indexOf(`function ${funcName}`);
  if (startIdx === -1) {
    const asyncStartIdx = indexHtml.indexOf(`async function ${funcName}`);
    if (asyncStartIdx === -1) return null;
    const endIdx = indexHtml.indexOf('\n}\n', asyncStartIdx);
    return indexHtml.substring(asyncStartIdx, endIdx + 3);
  }
  const endIdx = indexHtml.indexOf('\n}\n', startIdx);
  return indexHtml.substring(startIdx, endIdx + 3);
}

console.log('=== EXTRACTING TARGET FUNCTIONS ===');

['renderizzaSidebarLegheClub', 'renderizzaSidebarLegheNazionali', 'renderizzaProdottiSquadraConFiltri', 'renderizzaFiltriCatalogoPubblici'].forEach(fn => {
  console.log(`\n--- ${fn} ---`);
  const code = extractFunction(fn);
  if (code) {
    console.log(code.substring(0, 1500));
    if (code.length > 1500) console.log('... [truncated, length:', code.length, ']');
  } else {
    console.log('Function not found directly with function statement');
  }
});
