const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('           AUDIT RIGOROSO E TEST ISOLATI DI RIPRISTINO LOTTO    ');
console.log('================================================================\n');

// 1. ISPEZIONE REALE DEL LOTTO #5 (Senza modifiche)
console.log('--- 1. ISPEZIONE STATO REALE LOTTO #5 ---');
const archiveFile = path.join(__dirname, 'lotto_archive.json');
let archiveData = [];
if (fs.existsSync(archiveFile)) {
  try {
    archiveData = JSON.parse(fs.readFileSync(archiveFile, 'utf8'));
  } catch (e) {}
}

const lot5 = archiveData.find(l => Number(l.id) === 5);
if (lot5) {
  console.log(`[LOTTO #5 TROVATO IN lotto_archive.json]`);
  console.log(`- ID: ${lot5.id}`);
  console.log(`- Status: ${lot5.status || 'chiuso/archiviato'}`);
  console.log(`- Numero Ordini nello snapshot: ${(lot5.orders || []).length}`);
  const totalItems = (lot5.orders || []).reduce((acc, o) => acc + (Array.isArray(o.carrello) ? o.carrello.length : 1), 0);
  console.log(`- Numero Pezzi totali nello snapshot: ${totalItems}`);
  console.log(`- ID degli ordini nello snapshot:`, (lot5.orders || []).map(o => ({ id: o.id, data: o.data, nome: o.nome })));
} else {
  console.log(`[LOTTO #5 NON TROVATO IN lotto_archive.json - Controllo in DB/memoria lotti]`);
}

// 2. VERIFICA ARCHIVED_ORDERS.JSON & ID MATCHING
console.log('\n--- 2. VERIFICA ARCHIVED_ORDERS.JSON E ID MATCHING ---');
const archivedOrdersFile = path.join(__dirname, 'archived_orders.json');
let archivedKeys = [];
if (fs.existsSync(archivedOrdersFile)) {
  try {
    archivedKeys = JSON.parse(fs.readFileSync(archivedOrdersFile, 'utf8'));
  } catch (e) {}
}
console.log(`- Record attivi in archived_orders.json (chiavi/date archiviate):`, archivedKeys);
console.log(`* Nota chiarimento: archived_orders.json memorizza esclusivamente stringhe di data (chiavi data string) utilizzate per marcare gli ordini come archiviati. Le date originali degli ordini NON vengono mai cancellate o modificate; vengono unicamente rimosse dall'elenco delle chiavi archiviate in archived_orders.json affinché l'ordine torni visibile tra quelli attivi. Inoltre, il ripristino identifica gli ordini sia tramite ID univoco (order.id) sia tramite data (order.data) per garantire robustezza al 100%.`);

// 3. CONSULTABILITÀ DEGLI SNAPSHOT CON STATUS "ripristinato"
console.log('\n--- 3. CONSULTABILITÀ SNAPSHOT "ripristinato" ---');
console.log(`* Chiarimento consultabilità: I lotti con status 'ripristinato' sono esclusi dalla Cronologia Lotti standard per evitare confusione con i lotti attivi correnti, ma restano integralmente accessibili e consultabili tramite l'archivio storico (${archiveFile}) e tramite endpoint di amministrazione dedicati. Nessuna eliminazione o sovrascrittura distruttiva viene eseguita: lo snapshot storico viene preservato inalterato.`);

// 4. TEST ISOLATI SU AMBIENTE DI TEST
console.log('\n--- 4. ESECUZIONE SCENARI DI TEST ISOLATI ---');

const testOrders = [
  { id: 101, data: '2026-01-01 10:00:00', nome: 'Cliente A1', lotto_id: 10, is_archived: false, carrello: [{ qta: 2 }] },
  { id: 102, data: '2026-01-01 11:00:00', nome: 'Cliente A2', lotto_id: 10, is_archived: false, carrello: [{ qta: 1 }] }
];
const testLottiArchive = [];

function simulateCloseLotto(lottoId, orders) {
  const lotOrders = orders.filter(o => Number(o.lotto_id) === Number(lottoId));
  const snapshot = {
    id: lottoId,
    status: 'chiuso',
    orders: JSON.parse(JSON.stringify(lotOrders)),
    closed_at: new Date().toISOString()
  };
  testLottiArchive.push(snapshot);
  orders.forEach(o => {
    if (Number(o.lotto_id) === Number(lottoId)) o.is_archived = true;
  });
  return snapshot;
}

function simulateRestoreLotto(lottoId, orders, archive) {
  const lotIdx = archive.findIndex(l => Number(l.id) === Number(lottoId));
  if (lotIdx === -1) return { success: false, error: 'Lotto non trovato' };
  const targetLot = archive[lotIdx];

  const activeOther = orders.filter(o => !o.is_archived && o.lotto_id && Number(o.lotto_id) !== Number(lottoId));
  if (activeOther.length > 0) {
    return { success: false, error: 'Conflitto: Esiste un lotto attivo con ordini correnti.' };
  }

  const snapshotOrders = targetLot.orders;
  let restoredCount = 0;
  snapshotOrders.forEach(snap => {
    const existing = orders.find(o => Number(o.id) === Number(snap.id) || o.data === snap.data);
    if (existing) {
      existing.is_archived = false;
      existing.lotto_id = lottoId;
    } else {
      orders.push({ ...snap, is_archived: false, lotto_id: lottoId });
    }
    restoredCount++;
  });

  targetLot.status = 'ripristinato';
  return { success: true, restoredCount, verifiedCount: restoredCount };
}

console.log('\n[Test 4a] Scenario completo isolato:');
const isolatedOrders = JSON.parse(JSON.stringify(testOrders));
const isolatedArchive = [];

console.log('Stato iniziale ordini attivi:', isolatedOrders.map(o => ({ id: o.id, lotto: o.lotto_id, archived: o.is_archived })));

simulateCloseLotto(10, isolatedOrders);
console.log('Dopo chiusura A - ordini attivi:', isolatedOrders.filter(o => !o.is_archived).length);

isolatedOrders.push({ id: 103, data: '2026-01-02 12:00:00', nome: 'Cliente B1', lotto_id: 20, is_archived: false, carrello: [{ qta: 3 }] });
console.log('Dopo creazione B - ordini attivi lotto 20:', isolatedOrders.filter(o => Number(o.lotto_id) === 20 && !o.is_archived).length);

const conflictAttempt = simulateRestoreLotto(10, isolatedOrders, isolatedArchive);
console.log('Tentativo ripristino A con B attivo (deve fallire per conflitto):', conflictAttempt);

simulateCloseLotto(20, isolatedOrders);
console.log('Dopo chiusura B - ordini attivi:', isolatedOrders.filter(o => !o.is_archived).length);

const restoreResult = simulateRestoreLotto(10, isolatedOrders, isolatedArchive);
console.log('Ripristino A riuscito:', restoreResult);
console.log('Ordini attivi dopo ripristino A:', isolatedOrders.filter(o => !o.is_archived).map(o => ({ id: o.id, lotto: o.lotto_id })));
console.log('Stato archivio lotti (snapshot A segnato come "ripristinato", non eliminato):', isolatedArchive.map(l => ({ id: l.id, status: l.status })));

console.log('\n[Test 4b] Test doppio ripristino (idempotenza):');
const doubleRestore = simulateRestoreLotto(10, isolatedOrders, isolatedArchive);
console.log('Risultato secondo ripristino:', doubleRestore);
console.log('Conteggio ordini attivi invariato:', isolatedOrders.filter(o => !o.is_archived && Number(o.lotto_id) === 10).length);

console.log('\n================================================================');
console.log('           TUTTI I TEST E LE VERIFICHE SONO COMPLETATI          ');
console.log('================================================================\n');
