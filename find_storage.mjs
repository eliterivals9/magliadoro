import fs from 'fs';
const serverJs = fs.readFileSync('server.js', 'utf8');
const lines = serverJs.split('\n');
lines.forEach((l, i) => {
  if (l.toLowerCase().includes('storage') || l.toLowerCase().includes('supabase') && l.toLowerCase().includes('upload')) {
    console.log(`Line ${i+1}: ${l.trim().substring(0, 120)}`);
  }
});
