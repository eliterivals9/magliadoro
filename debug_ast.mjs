import fs from 'fs';
import * as acorn from 'acorn';

const code = fs.readFileSync('server.js', 'utf8');

// Acorn tokenizer allows us to see the exact stream of tokens
const tokens = [...acorn.tokenizer(code, { ecmaVersion: 2022, sourceType: 'module', locations: true })];

console.log('Total tokens:', tokens.length);
console.log('Last 20 tokens:');
tokens.slice(-20).forEach(t => {
  console.log(`${t.type.label} (${t.value ?? ''}) at line ${t.loc.start.line}:${t.loc.start.column}`);
});
