import fs from 'fs';
import assert from 'assert';

console.log("==================================================");
console.log("RUNNING SIZING & REGRESSION TESTS FOR PHASE 38 TER");
console.log("==================================================");

try {
  const serverCode = fs.readFileSync('server.js', 'utf8');

  // 1. Verifica altezza righe in generaExcelLotto e generaExcelRiepilogoTorneo
  // Cerchiamo le ricorrenze di row.height = 110
  const rowHeightMatches = serverCode.match(/row\.height\s*=\s*110/g);
  assert.ok(rowHeightMatches && rowHeightMatches.length >= 2, "L'altezza delle righe (row.height = 110) deve essere impostata a 110 in entrambi gli Excel!");
  console.log("✅ Test 1: Row height is successfully set to 110 in both Excel generators.");

  // 2. Verifica larghezza colonne immagini impostate a 20
  // Nel primo (Lotti) usa getColumn(1).width = 20
  // Nel secondo (Fornitura) usa { header: '', key: 'immagine', width: 20 }
  assert.ok(serverCode.includes('getColumn(1).width = 20'), "La larghezza della colonna immagine (getColumn(1).width = 20) nei Lotti non è corretta.");
  assert.ok(serverCode.includes("key: 'immagine', width: 20"), "La larghezza della colonna immagine nel riepilogo Fornitura Torneo non è corretta.");
  console.log("✅ Test 2: Column widths are successfully set to 20 for both Excel systems.");

  // 3. Verifica dimensioni immagini a 130x130px
  // Cerchiamo ext: { width: 130, height: 130 }
  const imgSizeMatches = serverCode.match(/width:\s*130,\s*height:\s*130/g);
  assert.ok(imgSizeMatches && imgSizeMatches.length >= 2, "La dimensione dell'immagine (130x130) non è stata impostata correttamente in entrambi i fogli.");
  console.log("✅ Test 3: Embedded image sizes are successfully set to 130x130 px (3x size increase).");

  // 4. Verifichiamo che i vecchi parametri '42' (altezza/dimensione riga) siano stati modificati per evitare regressioni
  const oldSizeMatches = serverCode.match(/width:\s*42,\s*height:\s*42/g);
  assert.strictEqual(oldSizeMatches, null, "Rilevate ancora vecchie configurazioni a 42x42px nel disegno delle immagini.");
  console.log("✅ Test 4: Old 42x42px parameters are completely cleaned up and replaced.");

  console.log("\n==================================================");
  console.log("🚀 ALL LAYOUT TESTS PASSED PERFECTLY!");
  console.log("==================================================");

} catch (err) {
  console.error("❌ Test Sizing Fallito:", err.message);
  process.exit(1);
}
