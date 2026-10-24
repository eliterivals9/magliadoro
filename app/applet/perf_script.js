const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

console.log('=== METRICS & STRUCTURE ===');
console.log('HTML Total Size:', (html.length / 1024 / 1024).toFixed(2), 'MB');
console.log('HTML Line Count:', html.split('\n').length);

// 1. CSS & JS Distribution
const styleBlocks = html.match(/<style[\s\S]*?>[\s\S]*?<\/style>/gi) || [];
console.log('Style blocks:', styleBlocks.length);
let styleLength = 0;
styleBlocks.forEach(s => styleLength += s.length);
console.log('Style CSS Size:', (styleLength / 1024).toFixed(1), 'KB');

const scriptBlocks = html.match(/<script[\s\S]*?>[\s\S]*?<\/script>/gi) || [];
console.log('Script blocks:', scriptBlocks.length);
let scriptLength = 0;
scriptBlocks.forEach(s => scriptLength += s.length);
console.log('Script JS Size:', (scriptLength / 1024).toFixed(1), 'KB');

// External scripts/links
const extScripts = html.match(/<script[^>]+src=["'][^"']+["']/gi) || [];
console.log('External script tags:', extScripts);
const extStyles = html.match(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi) || [];
console.log('External style tags:', extStyles);

// 2. Heavy CSS Rules
console.log('\n=== HEAVY CSS RULES ===');
console.log('backdrop-filter occurrences:', (html.match(/backdrop-filter/gi) || []).length);
console.log('filter: blur occurrences:', (html.match(/filter:\s*blur/gi) || []).length);
console.log('box-shadow occurrences:', (html.match(/box-shadow/gi) || []).length);
console.log('will-change occurrences:', (html.match(/will-change/gi) || []).length);

// 3. Image Tags & Attributes
console.log('\n=== IMAGE TAGS & LAZY LOADING ===');
const imgTags = html.match(/<img[^>]+>/gi) || [];
console.log('Total <img> tags in static HTML:', imgTags.length);
let lazyCount = 0;
let asyncCount = 0;
let dimensionCount = 0;
imgTags.forEach(img => {
    if (img.includes('loading="lazy"') || img.includes("loading='lazy'")) lazyCount++;
    if (img.includes('decoding="async"') || img.includes("decoding='async'")) asyncCount++;
    if (img.includes('width=') || img.includes('height=')) dimensionCount++;
});
console.log('<img> with loading="lazy":', lazyCount);
console.log('<img> with decoding="async":', asyncCount);
console.log('<img> with width/height:', dimensionCount);

// 4. JavaScript Functions for Catalog & Filtering
console.log('\n=== CATALOG RENDERING & FILTERING FUNCTIONS ===');
const lines = html.split('\n');
lines.forEach((line, idx) => {
    if (line.includes('function ') && (line.includes('genera') || line.includes('render') || line.includes('carica') || line.includes('catalogo') || line.includes('Filtri') || line.includes('Prodott') || line.includes('Sezione'))) {
        console.log(`Line ${idx + 1}: ${line.trim().substring(0, 100)}`);
    }
});

// 5. Scroll & Touch Event Listeners
console.log('\n=== SCROLL & TOUCH LISTENERS ===');
lines.forEach((line, idx) => {
    if (line.includes('addEventListener') && (line.includes('scroll') || line.includes('touch') || line.includes('resize') || line.includes('wheel'))) {
        console.log(`Line ${idx + 1}: ${line.trim().substring(0, 120)}`);
    }
});

// 6. API Calls & Backend Requests
console.log('\n=== API FETCH CALLS ===');
lines.forEach((line, idx) => {
    if (line.includes('fetch(') || line.includes('/api/')) {
        console.log(`Line ${idx + 1}: ${line.trim().substring(0, 100)}`);
    }
});
