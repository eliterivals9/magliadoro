const fs = require('fs');
const path = require('path');

const indexFile = path.join(__dirname, '../admin/index.html');
let html = fs.readFileSync(indexFile, 'utf8');

const targetBtn = `<button onclick="copiaTestoRiepilogoCliente()" type="button" class="w-full sm:w-auto px-4 py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer">                    <span>📋</span> Copia Testo Riepilogo                </button>`;

const replaceBtn = `<button onclick="copiaTestoRiepilogoCliente()" type="button" class="w-full sm:w-auto px-4 py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer">                    <span>📋</span> Copia Testo Riepilogo                </button>                <button id="btn-scarica-excel-riepilogo" onclick="scaricaExcelRiepilogoCliente()" type="button" class="w-full sm:w-auto px-4 py-2.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer">                    <span>📊</span> Scarica Excel                </button>`;

if (html.includes(targetBtn)) {
  html = html.replace(targetBtn, replaceBtn);
  fs.writeFileSync(indexFile, html, 'utf8');
  console.log('Successfully added Scarica Excel button to admin/index.html');
} else {
  console.log('targetBtn not found in admin/index.html');
}

// Add JS handler to admin/admin.js
const adminFile = path.join(__dirname, '../admin/admin.js');
let adminJs = fs.readFileSync(adminFile, 'utf8');

const jsCode = `
async function scaricaExcelRiepilogoCliente() {
    if (!currentRiepilogoOrdine) {
        if (typeof showToast === 'function') showToast("Nessun ordine selezionato per l'esportazione.", "error");
        return;
    }

    const orderId = currentRiepilogoOrdine.id || currentRiepilogoOrdine.data;
    if (!orderId) {
        if (typeof showToast === 'function') showToast("ID ordine non valido.", "error");
        return;
    }

    const rawName = currentRiepilogoOrdine.nome || currentRiepilogoOrdine.registered_name || 'Cliente';
    const cleanName = String(rawName).replace(/[\\\\/:*?"<>|]/g, '').trim().replace(/\\s+/g, '_') || 'Cliente';
    const orderNum = currentRiepilogoOrdine.displayIndex || currentRiepilogoOrdine.id || '1';
    const filename = \`Riepilogo_Ordine_\${orderNum}_\${cleanName}.xlsx\`;

    if (typeof showToast === 'function') showToast("Generazione file Excel in corso...", "info");

    const downloadUrl = \`/api/admin/orders/\${encodeURIComponent(orderId)}/excel\`;
    const success = await downloadAuthenticatedFile(downloadUrl, filename);
    if (success) {
        if (typeof showToast === 'function') showToast("File Excel scaricato con successo!", "success");
    }
}
window.scaricaExcelRiepilogoCliente = scaricaExcelRiepilogoCliente;
`;

if (!adminJs.includes('window.scaricaExcelRiepilogoCliente = scaricaExcelRiepilogoCliente')) {
  adminJs += jsCode;
  fs.writeFileSync(adminFile, adminJs, 'utf8');
  console.log('Successfully appended scaricaExcelRiepilogoCliente to admin/admin.js');
}
