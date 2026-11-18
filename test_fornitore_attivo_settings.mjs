import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';

process.env.NODE_ENV = 'test';

const {
  app,
  getSettings,
  saveSettings,
  loadSettingsFromSupabase,
  invalidateSettingsCache,
  __setSupabaseTestClients
} = await import('./server.js');

const ROOT = process.cwd();
const SETTINGS_PATH = path.join(ROOT, 'settings.json');
const LOTTO_PATH = path.join(ROOT, 'lotto.json');
const ADMIN_JS_PATH = path.join(ROOT, 'admin', 'admin.js');

let initialSettingsRaw = null;
let initialLottoRaw = null;
let server = null;
let baseUrl = '';

function createSupabaseMock({ initialCatalog = {}, failCatalogUpsert = false, failCatalogSelect = false, extraOrders = null } = {}) {
  const catalogStore = new Map(Object.entries(initialCatalog).map(([k, v]) => [k, JSON.parse(JSON.stringify(v))]));
  const priceRulesStore = [];

  const mock = {
    auth: {
      async getUser(token) {
        if (token === 'valid-admin-token') {
          return { data: { user: { email: 'sergiottocatania@gmail.com' } }, error: null };
        }
        return { data: { user: null }, error: { message: 'Invalid token' } };
      }
    },
    from(table) {
      if (table === 'catalog_settings') {
        return {
          async select() {
            if (failCatalogSelect) {
              return { data: null, error: { message: 'Simulated catalog_settings select error' } };
            }
            const rows = [];
            for (const [key, value] of catalogStore.entries()) {
              rows.push({ key, value: JSON.parse(JSON.stringify(value)) });
            }
            return { data: rows, error: null };
          },
          async upsert(rows) {
            if (failCatalogUpsert) {
              return { data: null, error: { message: 'Simulated catalog_settings upsert failure (RLS)' } };
            }
            const list = Array.isArray(rows) ? rows : [rows];
            for (const row of list) {
              if (row && row.key) {
                catalogStore.set(row.key, JSON.parse(JSON.stringify(row.value)));
              }
            }
            return { data: list, error: null };
          }
        };
      }

      if (table === 'price_rules') {
        const builder = {
          async select() {
            return { data: priceRulesStore, error: null };
          },
          async upsert(rows) {
            return { data: rows, error: null };
          },
          delete() {
            return {
              like: async () => ({ data: [], error: null })
            };
          }
        };
        return builder;
      }

      if (table === 'orders' && Array.isArray(extraOrders)) {
        return {
          select() {
            return {
              order: async () => ({ data: extraOrders, error: null }),
              then: (resolve) => resolve({ data: extraOrders, error: null })
            };
          }
        };
      }

      // Query fallback chain for optional tables (products, lotti, profit_shares, etc.)
      const emptyResult = { data: [], error: null };
      const chain = {
        select() { return chain; },
        order() { return chain; },
        range() { return Promise.resolve(emptyResult); },
        eq() { return chain; },
        neq() { return chain; },
        like() { return chain; },
        maybeSingle() { return Promise.resolve({ data: null, error: null }); },
        upsert() { return Promise.resolve(emptyResult); },
        update() { return chain; },
        delete() { return chain; },
        then(resolve, reject) { return Promise.resolve(emptyResult).then(resolve, reject); }
      };
      return chain;
    },
    _getCatalogValue(key) {
      return catalogStore.get(key);
    }
  };

  return mock;
}

async function apiRequest(method, route, body = null, headers = {}) {
  const res = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      ...(body !== null ? { 'Content-Type': 'application/json' } : {}),
      ...headers
    },
    body: body !== null ? JSON.stringify(body) : undefined,
    cache: 'no-store'
  });
  const json = await res.json();
  return { status: res.status, ok: res.ok, json };
}

function buildAdminFrontendHarness() {
  const fullSrc = fs.readFileSync(ADMIN_JS_PATH, 'utf8');

  // Extract the targeted functions cleanly using exact markers in admin.js
  const startSettings = fullSrc.indexOf('let settingsFetchPromise = null;');
  const endPopola = fullSrc.indexOf('// -------------------------------------------------------------------------\n// SEZIONE REGOLE IMPORTAZIONE JSON');
  const startFornitore = fullSrc.indexOf('let selectedFornitoreFormState = null;');
  const endFornitore = fullSrc.indexOf('const CATEGORIE_FORNITORE2 = [');

  assert.ok(startSettings >= 0 && endPopola > startSettings, 'Settings block bounds found in admin.js');
  assert.ok(startFornitore >= 0 && endFornitore > startFornitore, 'Fornitore block bounds found in admin.js');

  const settingsSnippet = fullSrc.slice(startSettings, endPopola);
  const fornitoreSnippet = fullSrc.slice(startFornitore, endFornitore);

  const elements = {
    'fornitore-attivo-badge-container': { innerHTML: '' },
    'card-option-fornitore-1': { className: '' },
    'card-option-fornitore-2': { className: '' },
    'btn-save-fornitore-attivo': { disabled: false }
  };
  const radios = [
    { name: 'fornitore_attivo_radio', value: '1', checked: false },
    { name: 'fornitore_attivo_radio', value: '2', checked: false }
  ];
  const toasts = [];

  const sandbox = {
    console,
    Number,
    String,
    Boolean,
    Object,
    Array,
    Promise,
    JSON,
    parseFloat,
    isNaN,
    window: { appSettings: {}, prodotti: [{ id: 1 }], accessori: [{ id: 1 }] },
    document: {
      getElementById(id) {
        return elements[id] || null;
      },
      getElementsByName(name) {
        return name === 'fornitore_attivo_radio' ? radios : [];
      }
    },
    fetch: (url, opts = {}) => fetch(`${baseUrl}${url}`, opts),
    getAdminAuthHeaders: () => ({ Authorization: 'Bearer valid-admin-token' }),
    showToast: (msg, type) => toasts.push({ msg, type }),
    setValutaMode: () => {},
    renderRegolePrezziTabella: () => {},
    aggiornaMenuCategorieForm: () => {},
    renderFiltriCatalogoTabella: () => {},
    renderRegoleImportazioneJsonTabella: () => {},
    renderPatchesTabella: () => {},
    aggiornaSquadreDropdown: () => {},
    renderTabellaPrezziFornitore2: () => {},
    renderTabellaSpedizioneFornitore2: () => {},
    caricaProdotti: async () => {},
    caricaDati: () => {},
    caricaLotto: () => {},
    caricaStatisticheDashboard: () => {},
    caricaOrdini: () => {}
  };
  sandbox.window.window = sandbox.window;

  vm.createContext(sandbox);
  vm.runInContext(
    `${settingsSnippet}\n${fornitoreSnippet}\n` +
    `this.__api = { caricaSettings, popolaSettingsUI, renderFornitoreSection, renderFornitoreAttivoCard, selezionaFornitoreAttivoInForm, salvaFornitoreAttivoSelection, getSelectedState: () => selectedFornitoreFormState };`,
    sandbox
  );

  return {
    api: sandbox.__api,
    window: sandbox.window,
    elements,
    radios,
    toasts
  };
}

test.before(async () => {
  initialSettingsRaw = fs.existsSync(SETTINGS_PATH) ? fs.readFileSync(SETTINGS_PATH, 'utf8') : null;
  initialLottoRaw = fs.existsSync(LOTTO_PATH) ? fs.readFileSync(LOTTO_PATH, 'utf8') : null;

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

test.after(async () => {
  __setSupabaseTestClients(null);
  invalidateSettingsCache();
  if (initialSettingsRaw !== null) {
    fs.writeFileSync(SETTINGS_PATH, initialSettingsRaw, 'utf8');
    saveSettings(JSON.parse(initialSettingsRaw));
  }
  if (initialLottoRaw !== null) {
    fs.writeFileSync(LOTTO_PATH, initialLottoRaw, 'utf8');
  }
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('1. Salvataggio fornitore_attivo=2 su Supabase, settings.json e cachedSettings + rilettura coerente', async () => {
  const baseSettings = JSON.parse(initialSettingsRaw);
  baseSettings.fornitore_attivo = 1;
  saveSettings(baseSettings);
  invalidateSettingsCache();

  const supabaseMock = createSupabaseMock({
    initialCatalog: {
      fornitore_attivo: 1,
      categorie: baseSettings.categorie,
      fornitore2_categorie_prezzi: baseSettings.fornitore2_categorie_prezzi,
      fornitore2_spedizioneLotto: baseSettings.fornitore2_spedizioneLotto,
      spedizioneLotto: baseSettings.spedizioneLotto
    }
  });
  __setSupabaseTestClients({ client: supabaseMock, adminClient: supabaseMock });

  // Verifica GET iniziale -> 1 (popola anche la RAM cache di GET /api/settings)
  const getInitial = await apiRequest('GET', '/api/settings');
  assert.equal(getInitial.status, 200);
  assert.equal(getInitial.json.settings.fornitore_attivo, 1);

  // Salvataggio Fornitore 2 via POST /api/settings
  const postRes = await apiRequest(
    'POST',
    '/api/settings',
    { settings: { fornitore_attivo: 2 } },
    { Authorization: 'Bearer valid-admin-token' }
  );
  assert.equal(postRes.status, 200, `POST dovrebbe riuscire anche in presenza ordini fuori catalogo: ${JSON.stringify(postRes.json)}`);
  assert.equal(postRes.json.success, true);
  assert.equal(postRes.json.settings.fornitore_attivo, 2);

  // Coerenza tra tutti e 3 i livelli: Supabase, settings.json, cachedSettings (getSettings)
  assert.equal(supabaseMock._getCatalogValue('fornitore_attivo'), 2, 'Supabase catalog_settings deve contenere 2');
  const fileAfter = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
  assert.equal(fileAfter.fornitore_attivo, 2, 'settings.json deve contenere fornitore_attivo: 2');
  assert.equal(getSettings().fornitore_attivo, 2, 'cachedSettings in RAM deve contenere fornitore_attivo: 2');

  // GET /api/settings deve restituire subito 2 (niente cache stantia a 1)
  const getAfter = await apiRequest('GET', '/api/settings');
  assert.equal(getAfter.status, 200);
  assert.equal(getAfter.json.settings.fornitore_attivo, 2);

  // Simula un riavvio / desincronizzazione di settings.json locale: loadSettingsFromSupabase deve ripristinare 2 ovunque
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify({ ...fileAfter, fornitore_attivo: 1 }, null, 2), 'utf8');
  const reloaded = await loadSettingsFromSupabase();
  assert.equal(reloaded.fornitore_attivo, 2);
  assert.equal(getSettings().fornitore_attivo, 2);
  assert.equal(JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')).fornitore_attivo, 2);
});

test('2. Errore salvataggio Supabase: NON finge successo e NON sovrascrive con valori incoerenti', async () => {
  const baseSettings = JSON.parse(initialSettingsRaw);
  baseSettings.fornitore_attivo = 1;
  saveSettings(baseSettings);
  invalidateSettingsCache();

  const failingSupabase = createSupabaseMock({
    initialCatalog: {
      fornitore_attivo: 1,
      categorie: baseSettings.categorie
    },
    failCatalogUpsert: true
  });
  __setSupabaseTestClients({ client: failingSupabase, adminClient: failingSupabase });

  const postFail = await apiRequest(
    'POST',
    '/api/settings',
    { settings: { fornitore_attivo: 2 } },
    { Authorization: 'Bearer valid-admin-token' }
  );

  assert.equal(postFail.ok, false);
  assert.equal(postFail.status, 500);
  assert.equal(postFail.json.success, false);
  assert.match(postFail.json.error, /Supabase/i);

  // Stato coerente: né settings.json né cachedSettings né GET devono essere corrotti
  assert.equal(JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')).fornitore_attivo, 1);
  assert.equal(getSettings().fornitore_attivo, 1);
  assert.equal(failingSupabase._getCatalogValue('fornitore_attivo'), 1);

  const getCheck = await apiRequest('GET', '/api/settings');
  assert.equal(getCheck.json.settings.fornitore_attivo, 1);
});

test('3. Read error su catalog_settings non sovrascrive Supabase con i default locali', async () => {
  const baseSettings = JSON.parse(initialSettingsRaw);
  baseSettings.fornitore_attivo = 2;
  saveSettings(baseSettings);
  invalidateSettingsCache();

  const readErrorSupabase = createSupabaseMock({
    initialCatalog: { fornitore_attivo: 2 },
    failCatalogSelect: true
  });
  __setSupabaseTestClients({ client: readErrorSupabase, adminClient: readErrorSupabase });

  const loaded = await loadSettingsFromSupabase();
  assert.equal(loaded.fornitore_attivo, 2);
  assert.equal(getSettings().fornitore_attivo, 2);
});

test('4. Validazione ordini attivi: preserva il blocco su articolo a catalogo non classificabile nel lotto corrente', async () => {
  const baseSettings = JSON.parse(initialSettingsRaw);
  baseSettings.fornitore_attivo = 1;
  saveSettings(baseSettings);
  invalidateSettingsCache();

  const unmappedOrder = {
    id: 999991,
    lotto_id: 6,
    is_archived: false,
    is_off_catalog: false,
    status: 'In attesa',
    carrello: [
      {
        id: 'nonexistent-prod-id-999',
        squadra: 'Squadra Test Non Mappata',
        categoria: 'Categoria Sconosciuta XYZ',
        versione: 'Speciale',
        quantita: 1,
        prezzo: 25
      }
    ]
  };

  const supabaseWithUnmappedOrder = createSupabaseMock({
    initialCatalog: { fornitore_attivo: 1, categorie: baseSettings.categorie },
    extraOrders: [unmappedOrder]
  });
  __setSupabaseTestClients({ client: supabaseWithUnmappedOrder, adminClient: supabaseWithUnmappedOrder });

  const res = await apiRequest(
    'POST',
    '/api/settings',
    { settings: { fornitore_attivo: 2 } },
    { Authorization: 'Bearer valid-admin-token' }
  );
  assert.equal(res.status, 400);
  assert.equal(res.json.success, false);
  assert.match(res.json.error, /Impossibile attivare\/salvare Fornitore 2/);
});

test('5. Persistenza locale senza Supabase (supabase === null): salva 2 su settings.json e GET /api/settings', async () => {
  const baseSettings = JSON.parse(initialSettingsRaw);
  baseSettings.fornitore_attivo = 1;
  saveSettings(baseSettings);
  invalidateSettingsCache();

  // Simula client autenticato ma senza DB per verify? Nota: adminAuthMiddleware richiede supabase.auth.getUser
  // quindi usiamo client con auth ma verifichiamo il flusso completo con persistenza file + RAM cache
  const mock = createSupabaseMock({
    initialCatalog: { fornitore_attivo: 1, categorie: baseSettings.categorie }
  });
  __setSupabaseTestClients({ client: mock, adminClient: mock });

  const saveRes = await apiRequest(
    'POST',
    '/api/settings',
    { settings: { fornitore_attivo: '2' } },
    { Authorization: 'Bearer valid-admin-token' }
  );
  assert.equal(saveRes.status, 200);
  assert.equal(saveRes.json.settings.fornitore_attivo, 2);

  // Simula perdita di cachedSettings e reset client Supabase (solo file locale settings.json)
  __setSupabaseTestClients({ client: null, adminClient: null });
  invalidateSettingsCache();
  await loadSettingsFromSupabase();
  assert.equal(getSettings().fornitore_attivo, 2);

  const getRes = await apiRequest('GET', '/api/settings');
  assert.equal(getRes.status, 200);
  assert.equal(getRes.json.settings.fornitore_attivo, 2);
});

test('6. Frontend admin.js: selezione Fornitore 2, salvataggio, reload pagina e rollback su errore', async () => {
  const baseSettings = JSON.parse(initialSettingsRaw);
  baseSettings.fornitore_attivo = 1;
  saveSettings(baseSettings);
  invalidateSettingsCache();

  const supabaseMock = createSupabaseMock({
    initialCatalog: {
      fornitore_attivo: 1,
      categorie: baseSettings.categorie,
      fornitore2_categorie_prezzi: baseSettings.fornitore2_categorie_prezzi,
      fornitore2_spedizioneLotto: baseSettings.fornitore2_spedizioneLotto,
      spedizioneLotto: baseSettings.spedizioneLotto
    }
  });
  __setSupabaseTestClients({ client: supabaseMock, adminClient: supabaseMock });

  // Sessione 1: utente apre pannello, seleziona Fornitore 2 e salva
  const session1 = buildAdminFrontendHarness();
  await session1.api.caricaSettings();
  await session1.api.renderFornitoreSection();
  assert.equal(session1.api.getSelectedState(), 1);
  assert.equal(session1.radios[0].checked, true);
  assert.equal(session1.radios[1].checked, false);

  session1.api.selezionaFornitoreAttivoInForm(2);
  assert.equal(session1.api.getSelectedState(), 2);
  await session1.api.salvaFornitoreAttivoSelection();

  assert.equal(session1.window.appSettings.fornitore_attivo, 2);
  assert.equal(session1.radios[1].checked, true);
  assert.match(session1.elements['fornitore-attivo-badge-container'].innerHTML, /Fornitore 2 Attivo/);
  assert.equal(session1.toasts.at(-1)?.type, 'success');

  // Sessione 2: simula RICARICAMENTO PAGINA completo (nuovo contesto JS vuoto)
  const session2 = buildAdminFrontendHarness();
  // Simula anche il caso in cui window.appSettings abbia una proprietà parziale prima di caricaSettings()
  session2.window.appSettings = { categorie: [] };
  await session2.api.caricaSettings();
  await session2.api.renderFornitoreSection();

  assert.equal(session2.window.appSettings.fornitore_attivo, 2);
  assert.equal(session2.api.getSelectedState(), 2);
  assert.equal(session2.radios[0].checked, false);
  assert.equal(session2.radios[1].checked, true);
  assert.match(session2.elements['fornitore-attivo-badge-container'].innerHTML, /Fornitore 2 Attivo/);

  // Sessione 3: se il backend fallisce il salvataggio (errore Supabase -> 500), la UI fa rollback a 2
  const failingSupabase = createSupabaseMock({
    initialCatalog: { fornitore_attivo: 2, categorie: baseSettings.categorie },
    failCatalogUpsert: true
  });
  __setSupabaseTestClients({ client: failingSupabase, adminClient: failingSupabase });

  session2.api.selezionaFornitoreAttivoInForm(1);
  await session2.api.salvaFornitoreAttivoSelection();
  assert.equal(session2.api.getSelectedState(), 2, 'Su errore backend la UI deve ripristinare il valore salvato (2)');
  assert.equal(session2.radios[1].checked, true);
  assert.equal(session2.toasts.at(-1)?.type, 'error');
});
