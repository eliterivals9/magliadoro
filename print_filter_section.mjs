import fs from 'fs';

const indexHtml = fs.readFileSync('index.html', 'utf8');
const lines = indexHtml.split('\n');

const code = lines.slice(23130 - 1, 24000).join('\n');
console.log(code);
