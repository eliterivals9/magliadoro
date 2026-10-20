import fs from 'fs';
const adminJs = fs.readFileSync('admin/admin.js', 'utf8');
const lines = adminJs.split('\n');
lines.forEach((l, i) => {
  if (l.toLowerCase().includes('patch') && l.toLowerCase().includes('fetch')) {
    console.log(`Line ${i+1}: ${l.trim()}`);
  }
});
