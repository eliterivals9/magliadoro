import fs from 'fs';
import assert from 'assert';

console.log("==================================================");
console.log("RUNNING SIZING & REGRESSION TESTS FOR PHASE 38 QUATER");
console.log("==================================================");

try {
  const serverCode = fs.readFileSync('server.js', 'utf8');

  // 1. Verifica altezza righe in generaExcelLotto e generaExcelRiepilogoTorneo
  // Cerchiamo le ricorrenze di row.height = 88
  const rowHeightMatches = serverCode.match(/row\.height\s*=\s*88/g);
  assert.ok(rowHeightMatches && rowHeightMatches.length >= 2, "L'altezza delle righe (row.height = 88) deve essere impostata a 88 in entrambi gli Excel!");
  console.log("✅ Test 1: Row height is successfully reduced by 20% to 88 points.");

  // 2. Verifica larghezza colonne immagini ridotta proporzionalmente a 16 (da 20)
  // Nel primo (Lotti) usa getColumn(1).width = 16
  // Nel secondo (Fornitura) usa { header: '', key: 'immagine', width: 16 }
  assert.ok(serverCode.includes('getColumn(1).width = 16'), "La larghezza della colonna immagine (getColumn(1).width = 16) nei Lotti non è corretta.");
  assert.ok(serverCode.includes("key: 'immagine', width: 16"), "La larghezza della colonna immagine nel riepilogo Fornitura Torneo non è corretta.");
  console.log("✅ Test 2: Column widths are successfully reduced to 16 for both Excel systems.");

  // 3. Verifica dimensioni immagini a 104x104px (da 130x130px)
  // Cerchiamo ext: { width: 104, height: 104 }
  const imgSizeMatches = serverCode.match(/width:\s*104,\s*height:\s*104/g);
  assert.ok(imgSizeMatches && imgSizeMatches.length >= 2, "La dimensione dell'immagine (104x104) non è stata impostata correttamente in entrambi i fogli.");
  console.log("✅ Test 3: Embedded image sizes are successfully reduced by 20% to 104x104 px.");

  // 4. Verifichiamo che i vecchi parametri '130' e '110' siano stati sostituiti
  const oldImgSizeMatches = serverCode.match(/width:\s*130,\s*height:\s*130/g);
  assert.strictEqual(oldImgSizeMatches, null, "Rilevate ancora vecchie configurazioni a 130x130px nel disegno delle immagini.");
  const oldRowHeightMatches = serverCode.match(/row\.height\s*=\s*110/g);
  assert.strictEqual(oldRowHeightMatches, null, "Rilevate ancora vecchie altezze righe a 110 punti.");
  console.log("✅ Test 4: Old 130x130px and 110pt parameters are completely cleaned up and replaced.");

  // 5. Verifica che non siano state aggiunte immagini alla colonna PATCH
  // La colonna patch non deve avere codice che vi inserisce immagini
  const patchImageRegex = /worksheet\.addImage\([^,]+,\s*{\s*tl:\s*{\s*col:\s*5\.1/g; // La colonna PATCH è la colonna 6 (indice 5)
  assert.ok(!patchImageRegex.test(serverCode), "La colonna PATCH non deve contenere immagini disegnate, solo testo!");
  console.log("✅ Test 5: Patch column correctly contains only text, no layout changes or images added.");

  console.log("\n==================================================");
  console.log("🚀 ALL 20% REDUCTION TESTS PASSED PERFECTLY!");
  console.log("==================================================");

} catch (err) {
  console.error("❌ Test Sizing Fallito:", err.message);
  process.exit(1);
}
