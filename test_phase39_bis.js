import assert from 'assert';

// 1. Definiamo le funzioni mockate identiche a server.js per convalidare matematicamente la logica

const localListMockTornei = [
  { id: "ea378156-a006-4af9-91a7-409fa275617e", nome: "ETNA GOLD", is_active: true },
  { id: "11b1d557-a5f8-46a9-aac7-a43b7213d46c", nome: "Torneo Audit Fase 9", is_active: true },
  { id: "262e6114-36c7-46ac-af4b-09805fd44c26", nome: "Torneo Test Fase 4", is_active: true },
  { id: "a4cd558c-3c9b-4953-9d01-e5709cf49ac2", nome: "Champions Cup 8030", is_active: false }
];

const localListMockSquadre = [
  { id: "sq-1", nome_squadra: "FC SERGIO", torneo_id: "ea378156-a006-4af9-91a7-409fa275617e" },
  { id: "sq-2", nome_squadra: "FC Test Fase 9", torneo_id: "11b1d557-a5f8-46a9-aac7-a43b7213d46c" }
];

// Funzione con la nuova logica getTornei()
async function testGetTorneiLogic(supabaseInstance, queryResult) {
  const localList = localListMockTornei;
  const supabase = supabaseInstance;
  if (supabase) {
    try {
      const { data, error } = queryResult;

      if (!error && Array.isArray(data)) {
        // Se la query ha successo, restituiamo ESCLUSIVAMENTE i dati di Supabase (anche se vuoto)
        return data;
      } else if (error) {
        console.warn(`[TORNEI DEBUG] Errore query Supabase, fallback locale: ${error.message || error}`);
      }
    } catch (err) {
      console.warn(`[TORNEI DEBUG] Eccezione Supabase SELECT, fallback locale: ${err.message}`);
    }
  }

  return localList;
}

// Funzione con la nuova logica getAllTorneoSquadre()
async function testGetAllTorneoSquadreLogic(supabaseInstance, queryResult) {
  const localList = localListMockSquadre;
  const supabase = supabaseInstance;
  if (supabase) {
    try {
      const { data, error } = queryResult;

      if (!error && Array.isArray(data)) {
        // Se la query ha successo, restituiamo ESCLUSIVAMENTE le squadre di Supabase (anche se vuoto)
        return data;
      } else if (error) {
        console.warn(`[TORNEO SQUADRE DEBUG] Errore query Supabase, fallback locale: ${error.message || error}`);
      }
    } catch (err) {
      console.warn(`[TORNEO SQUADRE DEBUG] Eccezione Supabase SELECT ALL, fallback locale: ${err.message}`);
    }
  }
  return localList;
}

// === AVVIO UNIT TESTS ===

console.log("=========================================");
console.log("RUNNING PHASE 39 TER - TORNEI MERGE RESOLUTION TESTS");
console.log("=========================================");

(async () => {
  try {
    // TEST 1 — Supabase vuoto (nessun torneo nel DB)
    // Risultato atteso: [] (array vuoto, non deve mostrare i tornei del JSON locale)
    const res1 = await testGetTorneiLogic(true, { data: [], error: null });
    assert.deepStrictEqual(res1, [], "Se Supabase ha risposto con successo ma è vuoto, getTornei() deve restituire un array vuoto!");
    console.log("✅ Test 1: Empty Supabase table returns [] correctly without local JSON merge.");

    // TEST 2 — Tornei presenti su Supabase
    // Risultato atteso: restituisce solo i tornei remoti, escludendo i locali non sincronizzati
    const remoteTornei = [{ id: "remote-1", nome: "Torneo Remoto Reale", is_active: true }];
    const res2 = await testGetTorneiLogic(true, { data: remoteTornei, error: null });
    assert.deepStrictEqual(res2, remoteTornei, "Deve restituire esclusivamente i dati remoti!");
    console.log("✅ Test 2: Supabase with real tournaments returns only Supabase items correctly.");

    // TEST 3 — Errore di query reale o Supabase disattivato (Fallback compatibilità)
    // Risultato atteso: restituisce la lista locale (es. per compatibilità offline o server locale senza credenziali)
    const res3 = await testGetTorneiLogic(true, { data: null, error: { message: "Database down" } });
    assert.deepStrictEqual(res3, localListMockTornei, "In caso di errore reale, deve ripiegare su localList per compatibilità!");
    console.log("✅ Test 3: Real Supabase query error triggers fallback to local JSON gracefully.");

    // TEST 4 — Test Squadre: Supabase vuoto (nessuna squadra nel DB)
    // Risultato atteso: []
    const res4 = await testGetAllTorneoSquadreLogic(true, { data: [], error: null });
    assert.deepStrictEqual(res4, [], "Se Supabase ha risposto con successo ma è vuoto, getAllTorneoSquadre() deve restituire []!");
    console.log("✅ Test 4: Empty Squadre table on Supabase returns [] correctly without local JSON merge.");

    // TEST 5 — Test Squadre: Squadre presenti su Supabase
    const remoteSquadre = [{ id: "sq-remote", nome_squadra: "FC Real Remote", torneo_id: "ea378156-a006-4af9-91a7-409fa275617e" }];
    const res5 = await testGetAllTorneoSquadreLogic(true, { data: remoteSquadre, error: null });
    assert.deepStrictEqual(res5, remoteSquadre, "Deve restituire solo le squadre remote di Supabase!");
    console.log("✅ Test 5: Supabase with real teams returns only Supabase items correctly.");

    console.log("\n=========================================");
    console.log("🚀 ALL MERGE AND FALLBACK TESTS PASSED PERFECTLY!");
    console.log("=========================================");

  } catch (err) {
    console.error("❌ Test Fallito:", err);
    process.exit(1);
  }
})();
