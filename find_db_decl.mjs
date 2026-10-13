import fs from 'fs';

const indexHtml = fs.readFileSync('index.html', 'utf8');

const regex = /(var|let|const)\s+databaseProdotti/g;
let match;
while ((match = regex.exec(indexHtml)) !== null) {
  console.log(`Line ${indexHtml.substring(0, match.index).split('\n').length}: ${match[0]}`);
  console.log(indexHtml.substring(match.index, match.index + 200));
}
