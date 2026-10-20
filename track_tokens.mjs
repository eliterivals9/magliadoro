import fs from 'fs';
import * as acorn from 'acorn';

const code = fs.readFileSync('server.js', 'utf8');
let parenStack = [];

try {
  acorn.parse(code, {
    ecmaVersion: 2022,
    sourceType: 'module',
    locations: true,
    onToken: (token) => {
      if (token.type.label === '(' || token.type.label === '[' || token.type.label === '{') {
        parenStack.push({ line: token.loc.start.line, type: token.type.label });
      } else if (token.type.label === ')' || token.type.label === ']' || token.type.label === '}') {
        parenStack.pop();
      }
    }
  });
  console.log('Parsed successfully');
} catch (err) {
  console.log('Error:', err.message, 'at line:', err.loc?.line);
}

console.log('Remaining unclosed tokens in stack (last 15):', parenStack.slice(-15));
