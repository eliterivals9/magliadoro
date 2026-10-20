import fs from 'fs';
const serverJs = fs.readFileSync('server.js', 'utf8');
const lines = serverJs.split('\n');
lines.forEach((l, i) => {
  if (l.includes('express.static') || l.includes('uploads')) {
    console.log(`Line ${i+1}: ${l.trim()}`);
  }
});
