import fs from 'fs';
import path from 'path';

const indexHtml = fs.readFileSync('index.html', 'utf8');

console.log('=== INDEX.HTML METRICS ===');
console.log('File size:', (indexHtml.length / 1024 / 1024).toFixed(2), 'MB');
console.log('Line count:', indexHtml.split('\n').length);

// 1. Check images
const imgMatches = indexHtml.match(/<img\b[^>]*>/gi) || [];
console.log('Total static <img> tags:', imgMatches.length);
const lazyImgs = imgMatches.filter(i => i.toLowerCase().includes('loading="lazy"') || i.toLowerCase().includes("loading='lazy'"));
console.log('Lazy loaded static <img> tags:', lazyImgs.length);

// Check if dynamic images generated in JS use loading="lazy" or explicit width/height
const dynamicImgTags = indexHtml.match(/<img[^>]+>/g) || [];
console.log('Total <img strings (including templates/JS):', dynamicImgTags.length);

// 2. Check Event Listeners & Observers
const scrollListeners = indexHtml.match(/addEventListener\s*\(\s*['"]scroll['"]/g) || [];
console.log('Scroll event listeners:', scrollListeners.length);

const resizeListeners = indexHtml.match(/addEventListener\s*\(\s*['"]resize['"]/g) || [];
console.log('Resize event listeners:', resizeListeners.length);

const touchListeners = indexHtml.match(/addEventListener\s*\(\s*['"]touch/g) || [];
console.log('Touch event listeners:', touchListeners.length);

const inputListeners = indexHtml.match(/addEventListener\s*\(\s*['"]input['"]/g) || [];
console.log('Input event listeners:', inputListeners.length);

const keyupListeners = indexHtml.match(/addEventListener\s*\(\s*['"]key/g) || [];
console.log('Keyboard event listeners:', keyupListeners.length);

// 3. Debounce & Throttling
const debounceMatches = indexHtml.match(/debounce/gi) || [];
console.log('Debounce function references:', debounceMatches.length);

// 4. Console logs and warnings
const consoleLogs = indexHtml.match(/console\.log\(/g) || [];
const consoleWarns = indexHtml.match(/console\.warn\(/g) || [];
const consoleErrors = indexHtml.match(/console\.error\(/g) || [];
console.log('Console logs:', consoleLogs.length, '| Warns:', consoleWarns.length, '| Errors:', consoleErrors.length);

// 5. Look for synchronous heavy catalog iterations in client JS
const filterFuncs = [
  'filtraProdotti',
  'aggiornaCatalogo',
  'caricaProdotti',
  'mostraProdotti',
  'creaCardProdotto',
  'applicaFiltri',
  'renderProdotti'
];

console.log('\n=== KEY CATALOG FUNCTION OCCURRENCES ===');
filterFuncs.forEach(fn => {
  const matches = (indexHtml.match(new RegExp(fn, 'g')) || []).length;
  console.log(`${fn}: ${matches} references`);
});

// 6. Check Supabase & local JSON fetching
const fetchCalls = indexHtml.match(/fetch\s*\(/g) || [];
console.log('Fetch calls in index.html:', fetchCalls.length);

const supabaseCalls = indexHtml.match(/supabase\./g) || [];
console.log('Supabase JS calls in index.html:', supabaseCalls.length);
