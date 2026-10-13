import fs from 'fs';

const indexHtml = fs.readFileSync('index.html', 'utf8');
const lines = indexHtml.split('\n');

for (let i = 19380; i < 19410; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}

for (let i = 20350; i < 20380; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}
