const fs = require('fs');
const code = fs.readFileSync('server.js', 'utf8');

let stack = []; // stores '{', '(', '[' and line number
let inLineComment = false;
let inBlockComment = false;
let inString = null; // '"', "'", '`'
let escaped = false;
let templateDepth = 0; // for template literals with ${ }

for (let i = 0; i < code.length; i++) {
  const c = code[i];
  const nextC = code[i + 1];
  const line = code.substring(0, i).split('\n').length;
  const col = i - code.lastIndexOf('\n', i - 1);

  if (inLineComment) {
    if (c === '\n') inLineComment = false;
    continue;
  }
  if (inBlockComment) {
    if (c === '*' && nextC === '/') {
      inBlockComment = false;
      i++;
    }
    continue;
  }

  if (inString) {
    if (escaped) {
      escaped = false;
    } else if (c === '\\') {
      escaped = true;
    } else if (inString === '`' && c === '$' && nextC === '{') {
      stack.push({ type: '${', line, col });
      i++;
    } else if (inString === '`' && c === '}' && stack.length > 0 && stack[stack.length - 1].type === '${') {
      stack.pop();
    } else if (c === inString) {
      inString = null;
    }
    continue;
  }

  // Check comments
  if (c === '/' && nextC === '/') {
    inLineComment = true;
    i++;
    continue;
  }
  if (c === '/' && nextC === '*') {
    inBlockComment = true;
    i++;
    continue;
  }

  // Check strings
  if (c === '"' || c === "'" || c === '`') {
    inString = c;
    continue;
  }

  if (c === '{' || c === '(' || c === '[') {
    stack.push({ type: c, line, col });
  } else if (c === '}' || c === ')' || c === ']') {
    if (stack.length === 0) {
      console.log(`Unmatched closing ${c} at line ${line}, col ${col}`);
    } else {
      const last = stack.pop();
      const expected = last.type === '{' ? '}' : last.type === '(' ? ')' : ']';
      if (expected !== c) {
        console.log(`Mismatched closing ${c} at line ${line}, col ${col} (expected ${expected} for open ${last.type} at line ${last.line})`);
      }
    }
  }
}

console.log('Unclosed items remaining in stack:');
stack.forEach(s => console.log(`Unclosed ${s.type} opened at line ${s.line}, col ${s.col}`));
