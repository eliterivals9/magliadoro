import fs from 'fs';

const indexHtml = fs.readFileSync('index.html', 'utf8');
const lines = indexHtml.split('\n');

for (let i = 23770; i < 24030; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}
