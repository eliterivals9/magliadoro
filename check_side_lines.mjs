import fs from 'fs';

const indexHtml = fs.readFileSync('index.html', 'utf8');
const lines = indexHtml.split('\n');

for (let i = 19407; i < 19420; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}
