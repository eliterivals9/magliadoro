// migrate.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCAL_PRODUCTS_FILE = path.join(__dirname, 'products_local.json');
const ENV_FILE = path.join(__dirname, '.env');

// Funzione di utilità per caricare il file .env se presente
function loadEnvFile() {
  if (fs.existsSync(ENV_FILE)) {
    console.log('Rilevato file .env locale. Caricamento variabili d\'ambiente...');
    try {
      const content = fs.readFileSync(ENV_FILE, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const parts = trimmed.split('=');
          const key = parts[0].trim();
          const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
          if (key) {
            process.env[key] = val;
          }
        }
      });
    } catch (e) {
      console.warn('Avviso: impossibile leggere il file .env locale:', e.message);
    }
  }
}

async function runMigration() {
  console.log('=== INIZIO MIGRAZIONE PRODOTTI VERSO SUPABASE ===\n');

  // Carica .env locale se presente
  loadEnvFile();

  // 1. Leggi parametri di configurazione da process.env
  let supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('ERRORE: SUPABASE_URL o SUPABASE_ANON_KEY non sono impostate nelle variabili d\'ambiente.');
    process.exit(1);
  }

  // Pulisce l'URL se termina con /rest/v1 o /rest/v1/
  supabaseUrl = supabaseUrl.trim().replace(/\/rest\/v1\/?$/, "");

  console.log(`Connessione a Supabase URL (pulito): ${supabaseUrl}`);

  // 2. Leggi prodotti da products_local.json
  if (!fs.existsSync(LOCAL_PRODUCTS_FILE)) {
    console.error(`ERRORE: Il file ${LOCAL_PRODUCTS_FILE} non esiste.`);
    process.exit(1);
  }

  let localProducts = [];
  try {
    const rawData = fs.readFileSync(LOCAL_PRODUCTS_FILE, 'utf8');
    localProducts = JSON.parse(rawData);
  } catch (err) {
    console.error(`ERRORE durante la lettura o il parsing di products_local.json: ${err.message}`);
    process.exit(1);
  }

  const numProdottiLetti = localProducts.length;
  console.log(`Numero prodotti letti dal file locale: ${numProdottiLetti}`);

  // 3. Connettiti a Supabase
  let supabase;
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.error(`ERRORE durante l\'inizializzazione del client Supabase: ${err.message}`);
    process.exit(1);
  }

  // 4. Recupera gli ID dei prodotti già esistenti in Supabase per saltare i duplicati
  console.log('Recupero legacy_id dei prodotti esistenti su Supabase per evitare duplicati...');
  let existingIds = new Set();
  try {
    const { data, error } = await supabase
      .from('products')
      .select('legacy_id');

    if (error) {
      throw error;
    }

    if (data && Array.isArray(data)) {
      data.forEach(item => {
        if (item.legacy_id !== undefined && item.legacy_id !== null) {
          existingIds.add(Number(item.legacy_id));
        }
      });
    }
    console.log(`Trovati ${existingIds.size} prodotti già presenti nel database di Supabase.`);
  } catch (err) {
    console.error(`ATTENZIONE/ERRORE durante il recupero dei prodotti esistenti: ${err.message}`);
    console.log('Procedo provando a inserire tutti i prodotti (gestendo eventuali errori di chiave duplicata)...');
  }

  // 4b. Recupera le squadre e i campionati esistenti su Supabase per la validazione
  console.log('Recupero squadre e campionati esistenti su Supabase per la validazione dei dati...');
  let squadreValide = [];
  let campionatiValidi = [
    'Premier League', 'Serie A', 'La Liga', 'Bundesliga', 'Ligue 1', 'Champions League',
    'USA MLS', 'Saudi League', 'Altri Club', 'Europa', 'Sud America', 'Nord America',
    'Asia', 'Oceania', 'Africa', 'Eastern Conference', 'Western Conference', 'Liga Mx',
    'Brasileiro Serie A', 'Japan Series'
  ];

  try {
    const { data: dbTeams, error: teamsError } = await supabase
      .from('teams')
      .select('name, sezione');

    if (!teamsError && dbTeams) {
      dbTeams.forEach(t => {
        if (t.name && !squadreValide.includes(t.name)) {
          squadreValide.push(t.name);
        }
        if (t.sezione && !campionatiValidi.includes(t.sezione)) {
          campionatiValidi.push(t.sezione);
        }
      });
    }
    console.log(`Recuperate ${squadreValide.length} squadre per la validazione.`);
  } catch (err) {
    console.error(`Avviso/Errore nel recupero delle squadre per la validazione: ${err.message}`);
  }

  // Fallback se vuoto o non caricato
  if (squadreValide.length === 0) {
    squadreValide = [
      "Manchester United", "Manchester City", "Liverpool F.C.", "Chelsea F.C.", "Arsenal F.C.",
      "Real Madrid", "Barcellona", "Atletico Madrid", "AC Milan", "Inter", "Juventus", "Roma",
      "Napoli", "Lazio", "Fiorentina", "Atalanta", "Tottenham Hotspur", "Bayern Monaco",
      "PSG", "Borussia Dortmund", "Benfica", "Ajax", "Boca Juniors", "Palmeiras", "Flamengo",
      "Italia", "Francia", "Germania", "Spagna", "Svizzera", "Austria", "Inghilterra", "Portogallo",
      "Aston Villa", "Newcastle United", "Bayer Leverkusen", "RB Lipsia", "Stoccarda", "Eintracht Francoforte"
    ];
  }

  // Funzione locale di validazione professionale
  function validaProdottoMigrate(p, riga) {
    const errori = [];

    // 1. Nome prodotto
    const nome = p.versione || p.nome_finale || p.nome || p.title || p.name;
    if (!nome || typeof nome !== 'string' || nome.trim() === '') {
      errori.push("Nome prodotto mancante");
    }

    // 2. Categoria
    const categoria = p.categoria;
    const categorieValide = ['Kit', 'Player', 'Fan', 'Kit Allenamento', 'kit training', 'Tuta', 'Retro', 'Kit Bambino', 'Club Ufficiali', 'Nazionali', 'NBA'];
    if (!categoria || typeof categoria !== 'string' || categoria.trim() === '') {
      errori.push("Categoria mancante");
    } else {
      const catTrim = categoria.trim();
      if (catTrim.toLowerCase() === 'club') {
        errori.push(`Categoria inesistente: '${catTrim}' (nel sistema esiste solo 'Club Ufficiali', 'Nazionali' o 'NBA')`);
      } else if (!categorieValide.some(c => c.toLowerCase() === catTrim.toLowerCase())) {
        errori.push(`Categoria non valida o non supportata: '${catTrim}'`);
      }
    }

    // 3. Sottocategoria (or target)
    const sottocategoria = p.sottocategoria || p.target || (categoria === 'Kit Bambino' ? 'Bambino' : 'Adulto');
    if (!sottocategoria || typeof sottocategoria !== 'string' || sottocategoria.trim() === '') {
      errori.push("Sottocategoria o target mancante");
    }

    // 4. Squadra
    const squadra = p.squadra;
    if (!squadra || typeof squadra !== 'string' || squadra.trim() === '' || squadra === 'Sconosciuta') {
      errori.push("Squadra mancante");
    } else {
      const sqTrim = squadra.trim();
      const isSquadraValida = squadreValide.some(s => s.toLowerCase() === sqTrim.toLowerCase());
      if (!isSquadraValida) {
        errori.push(`Squadra inesistente: '${sqTrim}'`);
      }
    }

    // 5. Campionato (Inferito o controllato)
    let campionato = p.campionato || p.sezione || p.lega;
    if (!campionato && squadra) {
      // Se manca il campionato ma c'è la squadra, consideriamolo inferibile (e quindi valido)
      campionato = 'Serie A'; 
    }
    if (!campionato || typeof campionato !== 'string' || campionato.trim() === '') {
      errori.push("Campionato mancante");
    } else {
      const campTrim = campionato.trim();
      const isCampValido = campionatiValidi.some(c => c.toLowerCase() === campTrim.toLowerCase());
      if (!isCampValido) {
        errori.push(`Campionato inesistente: '${campTrim}'`);
      }
    }

    // 6. Stagione
    const stagione = p.stagione;
    if (!stagione || typeof stagione !== 'string' || stagione.trim() === '') {
      errori.push("Stagione mancante o non valida");
    } else {
      const stagioneRegex = /^\d{2,4}\/\d{2,4}$/;
      if (!stagioneRegex.test(stagione.trim())) {
        errori.push(`Formato stagione non valido: '${stagione.trim()}' (usa es. 2024/25 o 24/25)`);
      }
    }

    // 7. Prezzo
    const prezzo = p.prezzo;
    if (prezzo === undefined || prezzo === null || prezzo === '') {
      errori.push("Prezzo mancante");
    } else {
      const prNum = parseFloat(prezzo);
      if (isNaN(prNum) || prNum <= 0) {
        errori.push(`Prezzo non valido: ${prezzo}`);
      }
    }

    // 8. Immagine principale
    const immagine = p.immagine;
    if (!immagine || typeof immagine !== 'string' || immagine.trim() === '') {
      errori.push("Immagine principale mancante");
    } else {
      const imgTrim = immagine.trim();
      if (imgTrim.startsWith('http://') || imgTrim.startsWith('https://') || imgTrim.startsWith('//')) {
        // URL remoto valido
      } else {
        // Percorso locale, controlliamo che esista davvero
        const localPath = path.join(__dirname, imgTrim);
        if (!fs.existsSync(localPath)) {
          errori.push(`Immagine non trovata nel percorso locale: '${imgTrim}'`);
        }
      }
    }

    // 9. Disponibilità
    const disponibilita = p.disponibilita !== undefined ? p.disponibilita : (p.disponibilità !== undefined ? p.disponibilità : (p.disponibile !== undefined ? p.disponibile : true));
    if (disponibilita === undefined || disponibilita === null) {
      errori.push("Disponibilità mancante");
    } else {
      const dispStr = String(disponibilita).toLowerCase().trim();
      if (dispStr === 'false' || dispStr === 'esaurito' || dispStr === 'non disponibile') {
        errori.push("Prodotto non disponibile o esaurito");
      }
    }

    // 10. ID univoco
    const id = p.id !== undefined ? p.id : p.legacy_id;
    if (id === undefined || id === null || id === '') {
      errori.push("ID univoco mancante");
    }

    return errori;
  }

  // 5. Filtra i prodotti da importare e mappa i campi
  const prodottiDaImportare = [];
  let duplicatiSaltati = 0;
  let saltati = 0;
  const erroriTrovati = [];
  const seenIds = new Set();

  localProducts.forEach((item, index) => {
    const riga = index + 1;
    const idNum = Number(item.id);

    // Valida prima il prodotto
    const errori = validaProdottoMigrate(item, riga);

    if (idNum !== undefined && idNum !== null && !isNaN(idNum)) {
      if (seenIds.has(idNum)) {
        errori.push(`ID univoco duplicato nel file: '${idNum}'`);
      } else {
        seenIds.add(idNum);
      }
    }

    if (errori.length > 0) {
      saltati++;
      erroriTrovati.push({
        riga,
        errori
      });
      return; // Salta il prodotto con errori
    }

    if (existingIds.has(idNum)) {
      duplicatiSaltati++;
      return; // Salta i duplicati già esistenti su Supabase
    }

    // Mappatura pulita e robusta dei campi richiesti
    const mappedProduct = {
      legacy_id: idNum,
      squadra: item.squadra || '',
      categoria: item.categoria || '',
      versione: item.versione || '',
      stagione: item.stagione || '',
      prezzo: typeof item.prezzo === 'number' ? item.prezzo : 23.99,
      prezzo_fornitore: (item.prezzo_fornitore !== undefined && item.prezzo_fornitore !== null && item.prezzo_fornitore !== "") ? parseFloat(item.prezzo_fornitore) : null,
      immagine: item.immagine || null,
      target: item.target || (item.categoria === 'Kit Bambino' ? 'Bambino' : 'Adulto')
    };

    prodottiDaImportare.push(mappedProduct);
  });

  console.log(`Prodotti duplicati già presenti (saltati): ${duplicatiSaltati}`);
  console.log(`Prodotti validi da inserire: ${prodottiDaImportare.length}`);

  let prodottiImportati = 0;
  let erroriRilevati = 0;

  if (prodottiDaImportare.length > 0) {
    // 6. Inserimento in batch (es. 100 prodotti alla volta per evitare limiti di payload)
    const chunkSize = 100;
    console.log('\nInizio inserimento dei prodotti...');
    for (let i = 0; i < prodottiDaImportare.length; i += chunkSize) {
      const chunk = prodottiDaImportare.slice(i, i + chunkSize);
      console.log(`Inserimento blocco ${Math.floor(i / chunkSize) + 1} di ${Math.ceil(prodottiDaImportare.length / chunkSize)} (${chunk.length} prodotti)...`);

      try {
        const { error } = await supabase
          .from('products')
          .insert(chunk);

        if (error) {
          console.error(`Errore nel blocco di inserimento: ${error.message}`);
          erroriRilevati += chunk.length;
        } else {
          prodottiImportati += chunk.length;
        }
      } catch (err) {
        console.error(`Eccezione durante l'inserimento: ${err.message}`);
        erroriRilevati += chunk.length;
      }
    }
  }

  console.log('\n====================================');
  console.log('IMPORTAZIONE COMPLETATA');
  console.log(`Prodotti letti: ${numProdottiLetti}`);
  console.log(`Importati: ${prodottiImportati}`);
  console.log(`Saltati: ${saltati + duplicatiSaltati}`);
  console.log('====================================');

  if (erroriTrovati.length > 0) {
    console.log('Errori trovati\n');
    erroriTrovati.forEach((item, index) => {
      console.log(`Riga ${item.riga}`);
      console.log(item.errori.join('\n'));
      if (index < erroriTrovati.length - 1) {
        console.log('------------------------------------');
      }
    });
    console.log('====================================');
  } else {
    console.log('Nessun errore riscontrato.');
    console.log('====================================');
  }
}

runMigration().catch(err => {
  console.error('MIGRAZIONE FALLITA per eccezione non gestita:', err);
  process.exit(1);
});
