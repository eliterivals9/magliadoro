import fs from 'fs';
const lines = fs.readFileSync('server.js', 'utf8').split('\n');
lines.forEach((l, i) => {
  if (l.includes('PORT')) {
    console.log(`Line ${i + 1}: ${l}`);
  }
});
