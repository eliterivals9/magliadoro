const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

console.log('=== PERFORMANCE ANALYSIS OF INDEX.HTML ===\n');

// 1. File Size & Lines
console.log(`1. FILE METRICS:`);
console.log(`- Total size: ${(html.length / 1024 / 1024).toFixed(2)} MB (${html.length} bytes)`);
console.log(`- Total lines: ${html.split('\n').length}`);

// 2. CSS & JS Distribution
const scriptMatches = html.match(/<script[\s\S]*?>[\s\S]*?<\/script>/gi) || [];
let totalJsBytes = 0;
scriptMatches.forEach(s => totalJsBytes += s.length);
console.log(`- Inline JS: ${(totalJsBytes / 1024).toFixed(1)} KB in ${scriptMatches.length} <script> blocks`);

const styleMatches = html.match(/<style[\s\S]*?>[\s\S]*?<\/style>/gi) || [];
let totalCssBytes = 0;
styleMatches.forEach(s => totalCssBytes += s.length);
console.log(`- Inline CSS: ${(totalCssBytes / 1024).toFixed(1)} KB in ${styleMatches.length} <style> blocks\n`);

// 3. Scroll & Event Listeners
console.log('2. SCROLL & TOUCH EVENT LISTENERS:');
const lines = html.split('\n');
lines.forEach((line, idx) => {
    if (line.includes('addEventListener') && (line.includes('scroll') || line.includes('touch') || line.includes('resize') || line.includes('wheel'))) {
        console.log(`- Line ${idx + 1}: ${line.trim().substring(0, 110)}`);
    }
});

// 4. Heavy CSS Effects
console.log('\n3. HEAVY CSS EFFECTS (BLUR, BACKDROP-FILTER, WILL-CHANGE):');
const backdropCount = (html.match(/backdrop-filter/gi) || []).length;
const filterBlurCount = (html.match(/filter:\s*blur/gi) || []).length;
const boxShaowsCount = (html.match(/box-shadow:/gi) || []).length;
const willChangeCount = (html.match(/will-change:/gi) || []).length;
console.log(`- backdrop-filter occurrences: ${backdropCount}`);
console.log(`- filter: blur occurrences: ${filterBlurCount}`);
console.log(`- box-shadow rules: ${boxShaowsCount}`);
console.log(`- will-change declarations: ${willChangeCount}`);

// 5. Image Loading Strategy
console.log('\n4. IMAGE LOADING & LAZY LOADING:');
const imgTags = html.match(/<img[^>]+>/gi) || [];
let lazyCount = 0;
let decodingAsyncCount = 0;
let widthHeightCount = 0;
imgTags.forEach(img => {
    if (img.includes('loading="lazy"') || img.includes("loading='lazy'")) lazyCount++;
    if (img.includes('decoding="async"') || img.includes("decoding='async'")) decodingAsyncCount++;
    if (img.includes('width=') || img.includes('height=')) widthHeightCount++;
});
console.log(`- Static <img> tags in DOM: ${imgTags.length}`);
console.log(`- <img> with loading="lazy": ${lazyCount}`);
console.log(`- <img> with decoding="async": ${decodingAsyncCount}`);
console.log(`- <img> with width/height attributes: ${widthHeightCount}`);

// 6. Dynamic Card Generation & Lazy Loading in JS
console.log('\n5. DYNAMIC CATALOG & PRODUCT CARD CREATION:');
const dynamicImgJs = lines.filter(l => l.includes('loading=') || l.includes('decoding=') || l.includes('generaCard') || l.includes('renderizzacatalogo') || l.includes('caricaProdotti'));
console.log(`- Found ${dynamicImgJs.length} lines referencing catalog rendering or dynamic image creation.`);

// 7. Interval & Timers
console.log('\n6. INTERVALS & TIMERS:');
lines.forEach((line, idx) => {
    if (line.includes('setInterval') || (line.includes('setTimeout') && line.includes('1000'))) {
        console.log(`- Line ${idx + 1}: ${line.trim().substring(0, 100)}`);
    }
});

// 8. Backend API Calls
console.log('\n7. API CALLS & FETCHES:');
lines.forEach((line, idx) => {
    if (line.includes('fetch(') || line.includes('XMLHttpRequest')) {
        console.log(`- Line ${idx + 1}: ${line.trim().substring(0, 100)}`);
    }
});
