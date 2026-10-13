import fs from 'fs';

const indexHtml = fs.readFileSync('index.html', 'utf8');
const lines = indexHtml.split('\n');

for (let i = 23235; i < 23280; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}
