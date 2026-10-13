import fs from 'fs';

const indexHtml = fs.readFileSync('index.html', 'utf8');

const regex = /publicTeams\s*=\s*/g;
let match;
while ((match = regex.exec(indexHtml)) !== null) {
  console.log(`Line ${indexHtml.substring(0, match.index).split('\n').length}:`);
  console.log(indexHtml.substring(match.index, match.index + 300));
}
