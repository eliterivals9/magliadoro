const fs = require('fs');

console.log("=== APPLYING MOBILE PRICE INPUT FIX ===");

// 1. Update admin/admin.css
let css = fs.readFileSync('admin/admin.css', 'utf8');
const cssAddon = `
/* ==========================================================================
   FIX VISIVO INPUT PREZZO MODALE MODIFICA PREZZO CONCORDATO SU MOBILE
   ========================================================================== */

.input-prezzo-concordato::-webkit-outer-spin-button,
.input-prezzo-concordato::-webkit-inner-spin-button,
.modal-prezzo-input::-webkit-outer-spin-button,
.modal-prezzo-input::-webkit-inner-spin-button,
.modal-prezzo-input-fascia::-webkit-outer-spin-button,
.modal-prezzo-input-fascia::-webkit-inner-spin-button,
.modal-prezzo-input-qty::-webkit-outer-spin-button,
.modal-prezzo-input-qty::-webkit-inner-spin-button {
    -webkit-appearance: none !important;
    margin: 0 !important;
}

.input-prezzo-concordato,
.modal-prezzo-input {
    -moz-appearance: textfield !important;
    appearance: textfield !important;
    font-size: 16px !important;
    font-weight: 800 !important;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
    min-height: 44px !important;
    height: 44px !important;
    padding-left: 2.25rem !important;
    padding-right: 0.75rem !important;
    padding-top: 0.5rem !important;
    padding-bottom: 0.5rem !important;
    line-height: 1.25 !important;
    vertical-align: middle !important;
    box-sizing: border-box !important;
    color: #0f172a !important;
    background-color: #f8fafc !important;
}

.modal-prezzo-input-fascia {
    -moz-appearance: textfield !important;
    appearance: textfield !important;
    font-size: 15px !important;
    font-weight: 700 !important;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
    min-height: 40px !important;
    height: 40px !important;
    padding-left: 1.85rem !important;
    padding-right: 0.5rem !important;
    padding-top: 0.35rem !important;
    padding-bottom: 0.35rem !important;
    line-height: 1.25 !important;
    vertical-align: middle !important;
    box-sizing: border-box !important;
    color: #0f172a !important;
    background-color: #ffffff !important;
}

.modal-prezzo-input-qty {
    -moz-appearance: textfield !important;
    appearance: textfield !important;
    font-size: 15px !important;
    font-weight: 700 !important;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
    min-height: 40px !important;
    height: 40px !important;
    padding-left: 0.65rem !important;
    padding-right: 0.5rem !important;
    padding-top: 0.35rem !important;
    padding-bottom: 0.35rem !important;
    line-height: 1.25 !important;
    vertical-align: middle !important;
    box-sizing: border-box !important;
    color: #0f172a !important;
    background-color: #ffffff !important;
}
`;

if (!css.includes("FIX VISIVO INPUT PREZZO MODALE MODIFICA PREZZO CONCORDATO SU MOBILE")) {
    css += cssAddon;
    fs.writeFileSync('admin/admin.css', css, 'utf8');
    console.log("✅ admin/admin.css updated.");
}

// 2. Update admin/index.html with embedded style
let html = fs.readFileSync('admin/index.html', 'utf8');
if (!html.includes("FIX VISIVO INPUT PREZZO MODALE MODIFICA PREZZO CONCORDATO SU MOBILE")) {
    const targetLink = `<link rel="stylesheet" href="/admin/admin.css">`;
    const styleTag = `${targetLink}\n    <style>${cssAddon}</style>`;
    html = html.replace(targetLink, styleTag);
    fs.writeFileSync('admin/index.html', html, 'utf8');
    console.log("✅ admin/index.html updated.");
}

// 3. Update admin/admin.js template strings
let js = fs.readFileSync('admin/admin.js', 'utf8');

const newSingleInput = `<input type="number" step="0.01" min="0" 
                                    id="item-price-input-\${idx}" 
                                    value="\${item.prezzo_unitario !== undefined ? item.prezzo_unitario : item.prezzo_originale}" 
                                    oninput="onInputPrezzoSingoloItem(\${idx}, this.value)" 
                                    class="modal-prezzo-input input-prezzo-concordato w-full pl-9 pr-3 h-11 bg-slate-50 border border-slate-300 rounded-xl text-base font-mono font-black text-slate-900 focus:bg-white focus:border-brand-gold focus:outline-none shadow-xs transition-all leading-normal">`;

js = js.replace(
    /<input type="number" step="0\.01" min="0"\s+id="item-price-input-\${idx}"[\s\S]*?class="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-brand-gold focus:outline-none shadow-xs">/,
    newSingleInput
);

js = js.replace(
    `<span class="absolute inset-y-0 left-0 pl-3 flex items-center font-bold text-slate-400 font-mono text-xs">€</span>`,
    `<span class="absolute left-3 flex items-center justify-center font-mono font-bold text-slate-500 text-sm sm:text-base pointer-events-none select-none z-10">€</span>`
);

const newFascePrice = `<input type="number" step="0.01" min="0" 
                            value="\${fascia.prezzo_unitario}" 
                            oninput="onInputFasciaPrice(\${itemIdx}, \${fIdx}, this.value)" 
                            class="modal-prezzo-input-fascia w-full pl-7 pr-2 h-10 bg-white border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-900 focus:border-brand-gold focus:outline-none transition-all leading-normal">`;

js = js.replace(
    /<input type="number" step="0\.01" min="0"\s+value="\${fascia\.prezzo_unitario}"\s+oninput="onInputFasciaPrice\(\${itemIdx}, \${fIdx}, this\.value\)"\s+class="w-full pl-6 pr-2 py-1\.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:border-brand-gold focus:outline-none">/,
    newFascePrice
);

const newFasceQty = `<input type="number" min="1" max="\${item.quantita}" 
                        value="\${fascia.quantita}" 
                        oninput="onInputFasciaQty(\${itemIdx}, \${fIdx}, this.value)" 
                        class="modal-prezzo-input-qty w-full px-2.5 h-10 bg-white border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-900 focus:border-brand-gold focus:outline-none transition-all leading-normal">`;

js = js.replace(
    /<input type="number" min="1" max="\${item\.quantita}"\s+value="\${fascia\.quantita}"\s+oninput="onInputFasciaQty\(\${itemIdx}, \${fIdx}, this\.value\)"\s+class="w-full px-2\.5 py-1\.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:border-brand-gold focus:outline-none">/,
    newFasceQty
);

fs.writeFileSync('admin/admin.js', js, 'utf8');
console.log("✅ admin/admin.js updated.");
console.log("=== FIX COMPLETED ===");
