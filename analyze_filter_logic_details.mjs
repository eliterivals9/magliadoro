import fs from 'fs';

const indexHtml = fs.readFileSync('index.html', 'utf8');

function searchCode(snippet) {
  const idx = indexHtml.indexOf(snippet);
  if (idx !== -1) {
    console.log(`\nFound snippet "${snippet}" at line ${indexHtml.substring(0, idx).split('\n').length}:`);
    console.log(indexHtml.substring(idx - 50, idx + 600));
  } else {
    console.log(`Snippet "${snippet}" not found.`);
  }
}

searchCode('function generaProdottiSquadra(');
searchCode('function ottieniStagioniDeduplicateEOrdinate(');
searchCode('function verificaProdottoCorrispondeCategoria(');
searchCode('function verificaProdottoCorrispondeStagione(');
searchCode('function ottieniSquadreDellaLega(');
searchCode('function ottieniNazionaliDellaCategoria(');
