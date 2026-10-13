import fs from 'fs';

const indexHtml = fs.readFileSync('index.html', 'utf8');

// Search for databaseProdotti.filter, databaseProdotti.forEach, databaseProdotti.map, databaseProdotti.reduce, databaseProdotti.find, databaseProdotti.some
const regex = /databaseProdotti\s*\.\s*(filter|forEach|map|reduce|find|some)\s*\(/g;
let match;
const scans = [];
while ((match = regex.exec(indexHtml)) !== null) {
  // Get line number
  const lineNumber = indexHtml.substring(0, match.index).split('\n').length;
  // Get surrounding function name if possible
  const precedingCode = indexHtml.substring(Math.max(0, match.index - 800), match.index);
  const fnMatch = precedingCode.match(/function\s+([a-zA-Z0-9_$]+)/g);
  const fnName = fnMatch ? fnMatch[fnMatch.length - 1] : 'anonymous/top-level';
  
  // Get surrounding line snippet
  const lineStart = indexHtml.lastIndexOf('\n', match.index);
  const lineEnd = indexHtml.indexOf('\n', match.index);
  const snippet = indexHtml.substring(lineStart + 1, Math.min(indexHtml.length, lineEnd));

  scans.push({
    line: lineNumber,
    fn: fnName,
    type: match[1],
    snippet: snippet.trim()
  });
}

console.log(`Found ${scans.length} occurrences of databaseProdotti loops/filters:`);
scans.forEach((s, i) => {
  console.log(`${i+1}. [Line ${s.line}] in ${s.fn} -> .${s.type}(): ${s.snippet.substring(0, 100)}`);
});
