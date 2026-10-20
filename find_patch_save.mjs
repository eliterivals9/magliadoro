import fs from 'fs';
const html = fs.readFileSync('index.html', 'utf8');
const lines = html.split('\n');
lines.forEach((l, i) => {
  if (l.toLowerCase().includes('patch') && l.toLowerCase().includes('save')) {
    console.log(`Line ${i+1}: ${l.trim().substring(0, 120)}`);
  }
});
