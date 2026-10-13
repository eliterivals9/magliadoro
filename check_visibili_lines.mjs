import fs from 'fs';

const indexHtml = fs.readFileSync('index.html', 'utf8');
const lines = indexHtml.split('\n');

for (let i = 17955; i < 18010; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}
