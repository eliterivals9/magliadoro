import fs from 'fs';

const indexHtml = fs.readFileSync('index.html', 'utf8');
const lines = indexHtml.split('\n');

for (let i = 23130; i < 23240; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}
