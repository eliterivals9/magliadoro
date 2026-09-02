import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import exceljs from 'exceljs';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Wrapper per salvare i log del server in un file locale server.log
const logFile = path.join(__dirname, 'server.log');
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

function writeToLogFile(level, args) {
  try {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg).join(' ');
    fs.appendFileSync(logFile, `[${timestamp}] [${level}] ${message}\n`, 'utf8');
  } catch (err) {
    // ignorato
  }
}

console.log = (...args) => {
  originalLog(...args);
  writeToLogFile('LOG', args);
};

console.error = (...args) => {
  originalError(...args);
  writeToLogFile('ERROR', args);
};

console.warn = (...args) => {
  originalWarn(...args);
  writeToLogFile('WARN', args);
};

// Carica le variabili d'ambiente dal file .env se presente
const ENV_FILE = path.join(__dirname, '.env');
if (fs.existsSync(ENV_FILE)) {
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
    console.log('✅ File .env caricato correttamente in server.js');
  } catch (e) {
    console.warn('⚠️ Errore durante la lettura del file .env in server.js:', e.message);
  }
}

const app = express();
const PORT = 3000;

// Local fallback database file and custom uploads configuration
const LOCAL_PRODUCTS_FILE = path.join(__dirname, 'products_local.json');
const LOCAL_ACCESSORIES_FILE = path.join(__dirname, 'accessories_local.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Enable JSON body parsing for API requests
app.use(express.json({ limit: '20mb' }));

// Serve custom uploaded files
app.use('/uploads', express.static(UPLOADS_DIR));

// Rotte dirette per le aree amministrative (supporta accesso con o senza slash finale)
app.get(['/admin/accessori', '/admin/accessori/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'accessori', 'index.html'));
});

// Intercetta richieste dirette a /lotti/:filename per garantire generazione dinamica on-demand dei lotti
app.get('/lotti/:filename', async (req, res, next) => {
  const filename = req.params.filename || '';
  const match = filename.match(/^LOTTO_(\d+)\.xlsx$/i);
  if (match) {
    const lottoId = parseInt(match[1], 10);
    return handleDownloadExcelLotto(req, res, lottoId);
  }
  next();
});

// Serve static files from root directory
app.use(express.static(__dirname));

// Popular clubs and national teams to dynamically generate a complete fallback catalog
const DATABASE_CLUB = [
  { nome: "Manchester United - Casa", img: "" },
  { nome: "Manchester United - Fuori Casa", img: "" },
  { nome: "Manchester City - Casa", img: "" },
  { nome: "Manchester City - Fuori Casa", img: "" },
  { nome: "Arsenal F.C. - Casa", img: "" },
  { nome: "Arsenal F.C. - Fuori Casa", img: "" },
  { nome: "Liverpool F.C. - Casa", img: "" },
  { nome: "Liverpool F.C. - Fuori Casa", img: "" },
  { nome: "Chelsea F.C. - Casa", img: "" },
  { nome: "Chelsea F.C. - Fuori Casa", img: "" },
  { nome: "Juventus - Casa", img: "" },
  { nome: "Juventus - Fuori Casa", img: "" },
  { nome: "Inter - Casa", img: "" },
  { nome: "Inter - Fuori Casa", img: "" },
  { nome: "AC Milan - Casa", img: "src/assets/images/milan_home_2627_1783613532937.jpg" },
  { nome: "AC Milan - Fuori Casa", img: "src/assets/images/milan_away_garage_1783535406975.jpg" },
  { nome: "Real Madrid - Casa", img: "" },
  { nome: "Real Madrid - Fuori Casa", img: "" },
  { nome: "Barcellona - Casa", img: "" },
  { nome: "Barcellona - Fuori Casa", img: "" },
  { nome: "Bayern Monaco - Casa", img: "" },
  { nome: "Bayern Monaco - Fuori Casa", img: "" }
];

const DATABASE_NAZIONALI = [
  { nome: "Italia - Casa", img: "https://thumblr.uniid.it/product/431339/bb3633d34ccc.jpg?width=1920&format=webp&q=75" },
  { nome: "Italia - Fuori Casa", img: "" },
  { nome: "Francia - Casa", img: "" },
  { nome: "Francia - Fuori Casa", img: "" },
  { nome: "Germania - Casa", img: "https://jerseys-catalog.com/upload/20260704/a77dc59bccbd765e6133568631757c43.png" },
  { nome: "Germania - Fuori Casa", img: "" },
  { nome: "Spagna - Casa", img: "" },
  { nome: "Spagna - Fuori Casa", img: "" }
];

function traduciTestoProdotto(text) {
  if (!text || typeof text !== 'string') return text || '';
  
  // Lista di coppie [Regex, Sostituto] in ordine di specificità
  const regole = [
    // Frasi composte
    [/\bPlayer Version\b/gi, "Versione Player"],
    [/\bFan Version\b/gi, "Versione Fan"],
    [/\bTraining Kit\b/gi, "Kit Allenamento"],
    [/\bSpecial Edition\b/gi, "Edizione Speciale"],
    [/\bLimited Edition\b/gi, "Edizione Limitata"],
    [/\bLong Sleeve\b/gi, "Maniche Lunghe"],
    [/\bShort Sleeve\b/gi, "Maniche Corte"],
    [/\bGoalkeeper\b/gi, "Portiere"],
    [/\bTracksuit\b/gi, "Tuta"],
    [/\bAnniversary\b/gi, "Anniversario"],
    
    // Parole singole
    [/\bHome\b/gi, "Casa"],
    [/\bAway\b/gi, "Trasferta"],
    [/\bThird\b/gi, "Terza"],
    [/\bFourth\b/gi, "Quarta"],
    [/\bTraining\b/gi, "Allenamento"],
    [/\bKids\b/gi, "Bambino"],
    [/\bAdults\b/gi, "Adulto"],
    [/\bJersey\b/gi, "Maglia"],
    [/\bRetro\b/gi, "Retro"],
    [/\bWomen's\b/gi, "Donna"],
    [/\bWomen\b/gi, "Donna"],
    [/\bGK\b/g, "Portiere"],
    [/\bgk\b/g, "Portiere"]
  ];

  let tradotto = text;
  for (const [pattern, replacement] of regole) {
    tradotto = tradotto.replace(pattern, replacement);
  }

  // Risolviamo anche l'ordine del nome se ci sono combinazioni particolari:
  // Ad esempio, "Maniche Lunghe Casa" -> "Casa Maniche Lunghe"
  const swaps = [
    [/\bManiche Lunghe Casa\b/gi, "Casa Maniche Lunghe"],
    [/\bManiche Lunghe Trasferta\b/gi, "Trasferta Maniche Lunghe"],
    [/\bManiche Lunghe Terza\b/gi, "Terza Maniche Lunghe"],
    [/\bManiche Lunghe Quarta\b/gi, "Quarta Maniche Lunghe"],
    [/\bManiche Corte Casa\b/gi, "Casa Maniche Corte"],
    [/\bManiche Corte Trasferta\b/gi, "Trasferta Maniche Corte"],
    [/\bManiche Corte Terza\b/gi, "Terza Maniche Corte"],
    [/\bManiche Corte Quarta\b/gi, "Quarta Maniche Corte"]
  ];

  for (const [pattern, replacement] of swaps) {
    tradotto = tradotto.replace(pattern, replacement);
  }

  // Pulisce spazi doppi o spazi extra ai bordi
  tradotto = tradotto.replace(/\s+/g, ' ').trim();
  
  return tradotto;
}

function normalizzaCategoria(categoria, customSettings = null) {
  if (!categoria) return 'Kit';
  const rawStr = categoria.toString().trim();
  const lower = rawStr.toLowerCase();
  
  if (lower === '__coupon__' || rawStr === '__coupon__' || lower.startsWith('__')) {
    return '__coupon__';
  }

  const s = customSettings || getSettings();

  // 1. Controlla prima le regole di importazione JSON salvate nelle impostazioni
  if (s && Array.isArray(s.regoleImportazioneJson) && s.regoleImportazioneJson.length > 0) {
    // Match esatto
    const matchEsatto = s.regoleImportazioneJson.find(r => (r.valore_json || '').toString().trim().toLowerCase() === lower);
    if (matchEsatto && matchEsatto.categoria) {
      return matchEsatto.categoria;
    }
    // Match parziale (contenimento)
    const matchParziale = s.regoleImportazioneJson.find(r => {
      const v = (r.valore_json || '').toString().trim().toLowerCase();
      return v && (lower.includes(v) || v.includes(lower));
    });
    if (matchParziale && matchParziale.categoria) {
      return matchParziale.categoria;
    }
  }

  // 2. Controlla le categorie dinamiche definite nel sistema
  if (s && Array.isArray(s.categorie) && s.categorie.length > 0) {
    const match = s.categorie.find(c => (c.nome || '').toString().trim().toLowerCase() === lower);
    if (match && match.nome) {
      return match.nome;
    }
    const matchPartial = s.categorie.find(c => {
      const cLower = (c.nome || '').toString().trim().toLowerCase();
      return cLower && (lower.includes(cLower) || cLower.includes(lower));
    });
    if (matchPartial && matchPartial.nome) {
      return matchPartial.nome;
    }
  }
  
  return rawStr || 'Kit';
}

async function ottieniListeValidazione(supabase) {
  let squadreValide = [];
  let campionatiValidi = [
    'Premier League', 'Serie A', 'La Liga', 'Bundesliga', 'Ligue 1', 'Champions League',
    'USA MLS', 'Saudi League', 'Altri Club', 'Europa', 'Sud America', 'Nord America',
    'Asia', 'Oceania', 'Africa', 'Eastern Conference', 'Western Conference', 'Liga Mx',
    'Brasileiro Serie A', 'Japan Series', 'Nazionali', 'Mondiali', 'NBA'
  ];

  // Aggiungi squadre fisse da DATABASE_CLUB e DATABASE_NAZIONALI
  if (typeof DATABASE_CLUB !== 'undefined' && Array.isArray(DATABASE_CLUB)) {
    DATABASE_CLUB.forEach(c => {
      const name = c.nome.split(" - ")[0];
      if (name && !squadreValide.includes(name)) squadreValide.push(name);
    });
  }
  if (typeof DATABASE_NAZIONALI !== 'undefined' && Array.isArray(DATABASE_NAZIONALI)) {
    DATABASE_NAZIONALI.forEach(n => {
      const name = n.nome.split(" - ")[0];
      if (name && !squadreValide.includes(name)) squadreValide.push(name);
    });
  }

  if (supabase) {
    try {
      const { data: dbTeams, error: teamsError } = await supabase.from('teams').select('name, sezione');
      if (!teamsError && dbTeams && dbTeams.length > 0) {
        dbTeams.forEach(t => {
          if (t.name && !squadreValide.includes(t.name)) {
            squadreValide.push(t.name);
          }
          if (t.sezione && !campionatiValidi.includes(t.sezione)) {
            campionatiValidi.push(t.sezione);
          }
        });
      }
    } catch (e) {
      console.error("⚠️ Errore recupero squadre da database per validazione:", e.message);
    }
  }

  // Fallback estremo se ancora vuoto
  if (squadreValide.length === 0) {
    squadreValide = [
      "Manchester United", "Manchester City", "Liverpool F.C.", "Chelsea F.C.", "Arsenal F.C.",
      "Real Madrid", "Barcellona", "Atletico Madrid", "AC Milan", "Inter", "Juventus", "Roma",
      "Napoli", "Lazio", "Fiorentina", "Atalanta", "Tottenham Hotspur", "Bayern Monaco",
      "PSG", "Borussia Dortmund", "Benfica", "Ajax", "Boca Juniors", "Palmeiras", "Flamengo",
      "Italia", "Francia", "Germania", "Spagna", "Svizzera", "Austria", "Inghilterra", "Portogallo"
    ];
  }

  return { squadreValide, campionatiValidi };
}

function validaDatiProdotto(p, riga, squadreValide, campionatiValidi) {
  const errori = [];

  // 1. Nome prodotto
  const nome = p.versione || p.nome_finale || p.nome || p.title || p.name;
  if (!nome || typeof nome !== 'string' || nome.trim() === '') {
    errori.push("Nome prodotto mancante");
  }

  // 2. Categoria
  const categoria = p.categoria;
  const settings = getSettings();
  let dynamicCats = [];
  if (settings && Array.isArray(settings.categorie)) {
    dynamicCats = settings.categorie.map(c => (c.nome || '').trim()).filter(Boolean);
  }
  let jsonRuleCats = [];
  if (settings && Array.isArray(settings.regoleImportazioneJson)) {
    jsonRuleCats = settings.regoleImportazioneJson.map(r => (r.categoria || '').trim()).filter(Boolean);
  }
  const categorieValideSet = new Set([...dynamicCats, ...jsonRuleCats]);
  const categorieValide = Array.from(categorieValideSet);
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
      errori.push(`Squadra inesistente o scritta in modo errato: '${sqTrim}'`);
    }
  }

  // 5. Campionato (or sezione / lega)
  let campionato = p.campionato || p.sezione || p.lega;
  if (!campionato && squadra) {
    // se non c'è campionato proviamo ad assegnarlo ad un valore valido per non fallire per mancanza
    campionato = 'Serie A';
  }
  if (!campionato || typeof campionato !== 'string' || campionato.trim() === '') {
    errori.push("Campionato mancante");
  } else {
    const campTrim = campionato.trim();
    const isCampValido = campionatiValidi.some(c => c.toLowerCase() === campTrim.toLowerCase());
    if (!isCampValido) {
      errori.push(`Campionato inesistente o non supportato: '${campTrim}'`);
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
    // We do not block import for unavailable products anymore.
    // They are simply imported, satisfying "Se No, il prodotto viene importato ma disabilitato".
  }

  // 10. ID univoco
  const id = p.id !== undefined ? p.id : p.legacy_id;
  if (id === undefined || id === null || id === '') {
    errori.push("ID univoco mancante");
  }

  return errori;
}

function normalizzaNomeSquadra(nomeInput, listaSquadreEsistenti) {
  if (!nomeInput) return "";
  const cleanInput = nomeInput.trim();
  if (!listaSquadreEsistenti || listaSquadreEsistenti.length === 0) {
    return cleanInput;
  }

  function getCoreName(name) {
    if (!name) return "";
    let n = name.toLowerCase();
    
    // Rimuove accenti / diacritici
    n = n.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Rimuove la punteggiatura
    n = n.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ");
    
    // Rimuove sigle e parole comuni indipendenti
    const stopwords = ["fc", "ac", "ss", "sc", "us", "asd", "cf", "fk", "club", "calcio", "de", "futbol", "fútbol", "association"];
    let words = n.split(/\s+/).filter(Boolean);
    words = words.filter(w => !stopwords.includes(w));
    
    return words.join(" ");
  }

  const inputCore = getCoreName(cleanInput);
  if (!inputCore) return cleanInput;

  // 1. Pass 1: Corrispondenza esatta case-insensitive
  for (const sq of listaSquadreEsistenti) {
    if (sq.trim().toLowerCase() === cleanInput.toLowerCase()) {
      return sq;
    }
  }

  // 2. Pass 2: Corrispondenza del core name
  for (const sq of listaSquadreEsistenti) {
    const sqCore = getCoreName(sq);
    if (sqCore === inputCore) {
      return sq;
    }
  }

  // 3. Pass 3: Sovrapposizione delle parole nei core names
  const inputWords = inputCore.split(" ").filter(Boolean);
  for (const sq of listaSquadreEsistenti) {
    const sqCore = getCoreName(sq);
    const sqWords = sqCore.split(" ").filter(Boolean);
    
    if (sqWords.length > 0 && inputWords.length > 0) {
      const inputInSq = inputWords.every(w => sqWords.includes(w));
      const sqInInput = sqWords.every(w => inputWords.includes(w));
      if (inputInSq || sqInInput) {
        return sq;
      }
    }
  }

  return cleanInput;
}

function ottieniPrezzoCategoria(categoria, target) {
  const settings = getSettings();
  const regole = settings.regolePrezzi || DEFAULT_SETTINGS.regolePrezzi;
  
  let cat = normalizzaCategoria(categoria);
  let tgt = target || 'Adulto';
  
  const key = `${cat}_${tgt}`;
  if (regole && regole[key] !== undefined) {
    return Number(regole[key]);
  }
  
  if (tgt === 'Bambino') {
    if (cat === 'Kit Allenamento') return 21.99;
    if (cat === 'Tuta') return 40.00;
    return 19.99;
  } else {
    if (cat === 'Kit') return 23.99;
    if (cat === 'Player') return 22.99;
    if (cat === 'Fan') return 22.99;
    if (cat === 'Kit Allenamento') return 25.99;
    if (cat === 'Tuta') return 44.99;
    if (cat === 'Retro') return 23.99;
  }
  return 23.99;
}

function formattaNomenclaturaVersione(squadra, categoria, versione, stagione) {
  let cat = normalizzaCategoria(categoria);
  const versioneLower = (versione || '').toLowerCase();
  
  if (cat === 'Kit' && (categoria === 'Kit Bambino' || (versioneLower.includes('kids') || versioneLower.includes('bambino')))) {
    if (versioneLower.includes('casa') || versioneLower.includes('home')) {
      return `Kit Bambino Casa ${squadra}`;
    } else if (versioneLower.includes('fuori casa') || versioneLower.includes('away') || versioneLower.includes('esterno')) {
      return `Kit Bambino Fuori Casa ${squadra}`;
    } else if (versioneLower.includes('terza') || versioneLower.includes('third')) {
      return `Kit Bambino Terza Maglia ${squadra}`;
    } else if (versioneLower.includes('quarta') || versioneLower.includes('fourth')) {
      return `Kit Bambino Quarta Maglia ${squadra}`;
    } else {
      return `Kit Bambino Casa ${squadra}`;
    }
  }
  
  if (cat === 'Kit') {
    if (versioneLower.includes('casa') || versioneLower.includes('home')) {
      return `Kit Casa ${squadra}`;
    } else if (versioneLower.includes('fuori casa') || versioneLower.includes('away') || versioneLower.includes('esterno')) {
      return `Kit Fuori Casa ${squadra}`;
    } else if (versioneLower.includes('terza') || versioneLower.includes('third')) {
      return `Kit Terza Maglia ${squadra}`;
    } else if (versioneLower.includes('quarta') || versioneLower.includes('fourth')) {
      return `Kit Quarta Maglia ${squadra}`;
    } else {
      return `Kit Casa ${squadra}`;
    }
  }
  
  if (cat === 'Fan') {
    if (versioneLower.includes('casa') || versioneLower.includes('home')) {
      return `Versione Fan Casa ${squadra}`;
    } else if (versioneLower.includes('fuori casa') || versioneLower.includes('away') || versioneLower.includes('esterno')) {
      return `Versione Fan Fuori Casa ${squadra}`;
    } else if (versioneLower.includes('terza') || versioneLower.includes('third')) {
      return `Versione Fan Terza Maglia ${squadra}`;
    } else if (versioneLower.includes('quarta') || versioneLower.includes('fourth')) {
      return `Versione Fan Quarta Maglia ${squadra}`;
    } else {
      return `Versione Fan Casa ${squadra}`;
    }
  }
  
  if (cat === 'Player') {
    if (versioneLower.includes('casa') || versioneLower.includes('home')) {
      return `Versione Player Casa ${squadra}`;
    } else if (versioneLower.includes('fuori casa') || versioneLower.includes('away') || versioneLower.includes('esterno')) {
      return `Versione Player Fuori Casa ${squadra}`;
    } else if (versioneLower.includes('terza') || versioneLower.includes('third')) {
      return `Versione Player Terza Maglia ${squadra}`;
    } else if (versioneLower.includes('quarta') || versioneLower.includes('fourth')) {
      return `Versione Player Quarta Maglia ${squadra}`;
    } else {
      return `Versione Player Casa ${squadra}`;
    }
  }
  
  if (cat === 'Retro') {
    let yearMatch = versioneLower.match(/\b(19\d\d|20\d\d)\b/);
    let year = yearMatch ? yearMatch[0] : "";
    if (!year) {
      if (versioneLower.includes('classic')) {
        year = 'Classic';
      } else if (versioneLower.includes('vintage')) {
        year = 'Vintage';
      } else {
        year = 'Storica';
      }
    }
    return `Maglia Retro ${squadra} ${year}`;
  }
  
  if (cat === 'Tuta') {
    let modello = 'Rappresentanza';
    if (versioneLower.includes('tracksuit')) {
      modello = 'Tracksuit';
    } else if (versioneLower.includes('allenamento') || versioneLower.includes('training')) {
      modello = 'Training';
    } else if (versioneLower.includes('ufficiale')) {
      modello = 'Ufficiale';
    }
    return `Tuta ${squadra} ${modello}`;
  }
  
  return versione;
}

function generaDefaultProdottiSquadra(nomeSquadra) {
  let imgCasa = "";
  let imgAway = "";
  
  const foundClubCasa = DATABASE_CLUB.find(item => item.nome === `${nomeSquadra} - Casa`);
  if (foundClubCasa && foundClubCasa.img) imgCasa = foundClubCasa.img;
  
  const foundClubAway = DATABASE_CLUB.find(item => item.nome === `${nomeSquadra} - Fuori Casa`);
  if (foundClubAway && foundClubAway.img) imgAway = foundClubAway.img;
  
  const foundNazCasa = DATABASE_NAZIONALI.find(item => item.nome === `${nomeSquadra} - Casa`);
  if (foundNazCasa && foundNazCasa.img) imgCasa = foundNazCasa.img;
  
  const foundNazAway = DATABASE_NAZIONALI.find(item => item.nome === `${nomeSquadra} - Fuori Casa`);
  if (foundNazAway && foundNazAway.img) imgAway = foundNazAway.img;

  if (!imgCasa) {
    const match = DATABASE_CLUB.find(item => item.nome.startsWith(nomeSquadra) && item.img);
    if (match) imgCasa = match.img;
  }
  if (!imgCasa) {
    const match = DATABASE_NAZIONALI.find(item => item.nome.startsWith(nomeSquadra) && item.img);
    if (match) imgCasa = match.img;
  }

  return [
    { squadra: nomeSquadra, categoria: "Kit", versione: `Kit Casa ${nomeSquadra}`, stagione: "25/26", prezzo: 34.99, immagine: imgCasa },
    { squadra: nomeSquadra, categoria: "Kit", versione: `Kit Fuori Casa ${nomeSquadra}`, stagione: "26/27", prezzo: 34.99, immagine: imgAway },
    { squadra: nomeSquadra, categoria: "Fan", versione: `Versione Fan Casa ${nomeSquadra}`, stagione: "25/26", prezzo: 23.99, immagine: imgCasa },
    { squadra: nomeSquadra, categoria: "Fan", versione: `Versione Fan Fuori Casa ${nomeSquadra}`, stagione: "26/27", prezzo: 23.99, immagine: imgAway },
    { squadra: nomeSquadra, categoria: "Player", versione: `Versione Player Casa ${nomeSquadra}`, stagione: "25/26", prezzo: 39.99, immagine: imgCasa },
    { squadra: nomeSquadra, categoria: "Player", versione: `Versione Player Fuori Casa ${nomeSquadra}`, stagione: "26/27", prezzo: 39.99, immagine: imgAway },
    { squadra: nomeSquadra, categoria: "Retro", versione: `Maglia Retro ${nomeSquadra} 1998`, stagione: "25/26", prezzo: 29.99, immagine: imgCasa },
    { squadra: nomeSquadra, categoria: "Retro", versione: `Maglia Retro ${nomeSquadra} Classica`, stagione: "26/27", prezzo: 29.99, immagine: imgAway },
    { squadra: nomeSquadra, categoria: "Kit", versione: `Kit Bambino Casa ${nomeSquadra}`, stagione: "25/26", prezzo: 19.99, immagine: imgCasa, target: "Bambino" },
    { squadra: nomeSquadra, categoria: "Kit", versione: `Kit Bambino Fuori Casa ${nomeSquadra}`, stagione: "26/27", prezzo: 19.99, immagine: imgAway, target: "Bambino" }
  ];
}

function generateDefaultProducts() {
  const tempDatabase = [];
  const tutteLeSquadre = [];
  
  DATABASE_CLUB.forEach(c => {
    const nomeSquadra = c.nome.split(" - ")[0];
    if (!tutteLeSquadre.includes(nomeSquadra)) tutteLeSquadre.push(nomeSquadra);
  });
  
  DATABASE_NAZIONALI.forEach(n => {
    const nomeSquadra = n.nome.split(" - ")[0];
    if (!tutteLeSquadre.includes(nomeSquadra)) tutteLeSquadre.push(nomeSquadra);
  });
  
  let currentId = 1;
  
  tutteLeSquadre.forEach(squadra => {
    const defaultProdotti = generaDefaultProdottiSquadra(squadra);
    defaultProdotti.forEach(defProd => {
      const esisteGia = tempDatabase.some(p => p.squadra === defProd.squadra && p.categoria === defProd.categoria && p.versione === defProd.versione);
      if (!esisteGia) {
        defProd.id = currentId++;
        defProd.prezzo = ottieniPrezzoCategoria(defProd.categoria);
        tempDatabase.push(defProd);
      }
    });
  });
  
  return tempDatabase;
}

function getLocalProducts() {
  if (fs.existsSync(LOCAL_PRODUCTS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(LOCAL_PRODUCTS_FILE, 'utf8'));
    } catch (e) {
      console.error("⚠️ Error reading local products file, recreating database...", e);
    }
  }
  const defaultList = generateDefaultProducts();
  saveLocalProducts(defaultList);
  return defaultList;
}

function saveLocalProducts(products) {
  try {
    fs.writeFileSync(LOCAL_PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf8');
  } catch (e) {
    console.error("⚠️ Error saving local products file:", e);
  }
}

// ==========================================
// SEZIONE EXCEL GENERATOR - NUOVA ARCHITETTURA
// ==========================================

const TEAM_CHINESE_MAP = {
  "Milan": "米兰",
  "Inter": "国米",
  "Juventus": "尤文",
  "Roma": "罗马",
  "Napoli": "那不勒斯",
  "Real Madrid": "皇马",
  "Barcelona": "巴萨",
  "Atletico Madrid": "马竞",
  "Manchester United": "曼联",
  "Manchester City": "曼城",
  "Arsenal": "阿森纳",
  "Chelsea": "切尔西",
  "Liverpool": "利物浦",
  "Tottenham": "热刺",
  "Bayern Munich": "拜仁",
  "Bayern Monaco": "拜仁",
  "Borussia Dortmund": "多特",
  "PSG": "巴黎",
  "Paris Saint Germain": "巴黎",
  "Marseille": "马赛",
  "Benfica": "本菲卡",
  "Porto": "波尔图",
  "Ajax": "阿贾克斯",
  "Boca Juniors": "博卡",
  "River Plate": "河床",
  "Argentina": "阿根廷",
  "Brazil": "巴西",
  "Brasile": "巴西",
  "Italy": "意大利",
  "Italia": "意大利",
  "France": "法国",
  "Francia": "法国",
  "Germany": "德国",
  "Germania": "德国",
  "Spain": "西班牙",
  "Spagna": "西班牙",
  "England": "英格兰",
  "Inghilterra": "英格兰",
  "Portugal": "葡萄牙",
  "Portogallo": "葡萄牙",
  "Netherlands": "荷兰",
  "Olanda": "荷兰",
  "Croatia": "克罗地亚",
  "Croazia": "克罗地亚",
  "Japan": "日本",
  "Giappone": "日本"
};

function getEnglishTitleAndStyle(item) {
  const squadra = item.squadra || "";
  const categoria = (item.categoria || "").toLowerCase();
  const versione = (item.versione || "").toLowerCase();
  const stagione = item.stagione || "25/26";
  const target = (item.target || "").toLowerCase();

  // Determina se è bambino o tuta o retro o player
  const isBambino = target === 'bambino' || categoria === 'kit bambino' || versione.includes('bambino') || versione.includes('kids') || versione.includes('kid') || versione.includes('bambina');
  const isTuta = categoria === 'tuta' || categoria === 'tute' || versione.includes('tuta') || versione.includes('tracksuit');
  const isRetro = categoria === 'retro' || versione.includes('retro') || versione.includes('retrò');
  const isPlayer = categoria === 'player' || versione.includes('player') || versione.includes('giocatore');

  let titleEng = "";
  let styleEng = "Fans Version";

  if (isBambino) {
    if (isTuta) {
      titleEng = `Kids Tracksuit ${stagione} ${squadra}`;
      styleEng = "Tracksuit, Kids";
    } else {
      titleEng = `Kids Kits ${stagione} ${squadra} Home`;
      styleEng = "Kids Kits";
    }
  } else if (isTuta) {
    titleEng = `Adults Tracksuit ${stagione} ${squadra}`;
    styleEng = "Tracksuit";
  } else if (isRetro) {
    titleEng = `Retro ${stagione} ${squadra} Home`;
    styleEng = "Retro";
  } else if (isPlayer) {
    titleEng = `Player Version ${stagione} ${squadra} Home`;
    styleEng = "Player Version";
  } else {
    titleEng = `Fans Version ${stagione} ${squadra} Home`;
    styleEng = "Fans Version";
  }

  // Correzioni Home/Away
  if (versione.includes('fuori casa') || versione.includes('away')) {
    titleEng = titleEng.replace('Home', 'Away');
  } else if (versione.includes('terza') || versione.includes('third')) {
    titleEng = titleEng.replace('Home', 'Third');
  } else if (versione.includes('speciale') || versione.includes('special')) {
    titleEng = titleEng.replace('Home', 'Special Edition');
  }

  // Titolo Cinese
  let chTeam = TEAM_CHINESE_MAP[squadra] || squadra;
  for (const [itKey, zhVal] of Object.entries(TEAM_CHINESE_MAP)) {
    if (squadra.toLowerCase().includes(itKey.toLowerCase())) {
      chTeam = zhVal;
      break;
    }
  }

  let seasonClean = stagione.replace('/', '');
  let chType = "球迷版";
  if (isBambino) {
    chType = isTuta ? "儿童卫衣套装" : "儿童套装";
  } else if (isTuta) {
    chType = "成人卫衣套装";
  } else if (isRetro) {
    chType = "复古";
  } else if (isPlayer) {
    chType = "球员版";
  }

  let isAway = versione.includes('fuori casa') || versione.includes('away');
  let isThird = versione.includes('terza') || versione.includes('third');
  let isSpecial = versione.includes('speciale') || versione.includes('special');
  let chVers = "主场";
  if (isAway) chVers = "客场";
  else if (isThird) chVers = "第二客场";
  else if (isSpecial) chVers = "特别版";

  const titleCh = `${seasonClean}${chTeam}${chVers}${chType}`;

  return { titleEng, titleCh, styleEng };
}

function parseCustomizationDetails(infoPerso, item = {}) {
  let nome = "";
  let numero = "";
  let patches = [];
  let otherExtrasCount = 0;

  // 1. Controlla campi diretti dell'oggetto item
  if (item && typeof item === "object") {
    if (item.customName || item.nome_personalizzazione || (item.nome && typeof item.nome === "string" && !["nessuno", "nessuna", "no", ""].includes(item.nome.trim().toLowerCase()) && item.nome !== item.versione && item.nome !== item.squadra)) {
      nome = (item.customName || item.nome_personalizzazione || item.nome).trim();
    }
    if (item.customNumber || item.numero_personalizzazione || (item.numero && typeof item.numero === "string" && !["nessuno", "nessuna", "no", ""].includes(item.numero.trim().toLowerCase()))) {
      numero = String(item.customNumber || item.numero_personalizzazione || item.numero).trim();
    }
    if (item.customPatch || item.patch) {
      const p = String(item.customPatch || item.patch).trim();
      if (p && !["nessuna", "nessuno", "no", "false", ""].includes(p.toLowerCase())) {
        patches.push(p);
      }
    }
  }

  // 2. Parsa stringa infoPerso / personalizzazione
  let rawText = "";
  if (typeof infoPerso === "string") {
    rawText = infoPerso.trim();
  } else if (infoPerso && typeof infoPerso === "object") {
    if (infoPerso.nome) nome = infoPerso.nome;
    if (infoPerso.numero) numero = String(infoPerso.numero);
    if (infoPerso.patch) patches.push(infoPerso.patch);
    rawText = JSON.stringify(infoPerso);
  }

  if (rawText) {
    let cleanText = rawText.replace(/^(\d+)x\s+\[|\]$/g, "").replace(/^\[|\]$/g, "").trim();
    const lower = cleanText.toLowerCase();
    const isNone = ["nessuna", "nessuno", "no", "false", "", "1x [nessuna]", "[nessuna]"].includes(lower);

    if (!isNone) {
      // Estrai Patches / Badges
      const patchRegex = /(?:Patch|Badge):\s*([^|\n-]+)/gi;
      let pMatch;
      while ((pMatch = patchRegex.exec(cleanText)) !== null) {
        const val = pMatch[1].trim();
        if (val && !["nessuna", "nessuno", "no", "false", "none", ""].includes(val.toLowerCase())) {
          if (!patches.includes(val)) {
            patches.push(val);
          }
        }
      }

      // Estrai Nome
      const nomeRegex = /Nome:\s*([^|\n-]+)/i;
      const nMatch = cleanText.match(nomeRegex);
      if (nMatch) {
        const val = nMatch[1].trim();
        if (val && !["nessuna", "nessuno", "no", "false", "none", ""].includes(val.toLowerCase())) {
          nome = val;
        }
      }

      // Estrai Numero
      const numRegex = /Num(?:ero)?:\s*([^|\n\s-]+)/i;
      const numMatch = cleanText.match(numRegex);
      if (numMatch) {
        const val = numMatch[1].trim();
        if (val && !["nessuna", "nessuno", "no", "false", "none", ""].includes(val.toLowerCase())) {
          numero = val;
        }
      }

      // Se non trovati con etichette standard, analizza testo non strutturato (es. "MESSI - 10" o "BAGGIO 10")
      if (!nome && !numero) {
        let textWithoutPatches = cleanText.replace(/(?:Patch|Badge):\s*[^|\n-]+/gi, "").trim();
        textWithoutPatches = textWithoutPatches.replace(/^[-|,\s]+|[-|,\s]+$/g, "");

        if (textWithoutPatches && !["nessuna", "nessuno", "no", "false", "none", ""].includes(textWithoutPatches.toLowerCase())) {
          const hyphenParts = textWithoutPatches.split("-").map(s => s.trim()).filter(Boolean);
          if (hyphenParts.length >= 2) {
            nome = hyphenParts[0].replace(/Nome:\s*/i, "").trim();
            numero = hyphenParts[1].replace(/Num(?:ero)?:\s*/i, "").trim();
          } else {
            const hasDigits = /\d+/.test(textWithoutPatches);
            const hasLetters = /[A-Za-z]+/.test(textWithoutPatches);
            if (hasDigits && hasLetters) {
              const numPart = textWithoutPatches.match(/\b\d+\b/);
              if (numPart) {
                numero = numPart[0];
                nome = textWithoutPatches.replace(numPart[0], "").replace(/[-#]/g, "").trim();
              } else {
                nome = textWithoutPatches;
              }
            } else if (hasDigits) {
              numero = textWithoutPatches;
            } else if (hasLetters) {
              nome = textWithoutPatches;
            }
          }
        }
      }
    }
  }

  // Calcolo costo fornitore personalizzazioni (Formula ufficiale del gestionale: $1 Nome, $1 Numero, $1 per Patch)
  let customizationCostUSD = 0.00;
  if (nome && !["nessuno", "nessuna", "no", "false", ""].includes(nome.toLowerCase())) {
    customizationCostUSD += 1.00;
  }
  if (numero && !["nessuno", "nessuna", "no", "false", ""].includes(numero.toLowerCase())) {
    customizationCostUSD += 1.00;
  }
  customizationCostUSD += (patches.length * 1.00);
  customizationCostUSD += (otherExtrasCount * 1.00);

  return {
    nome,
    numero,
    patches,
    patchStr: patches.join(", "),
    customizationCostUSD: Number(customizationCostUSD.toFixed(2))
  };
}

function parserPersonalizzazione(infoPerso, taglia, item = {}) {
  const details = parseCustomizationDetails(infoPerso, item);
  let nameNumberStr = "";
  if (details.nome || details.numero) {
    const cleanTaglia = String(taglia).replace('Taglia', '').replace(/^1x\s+\[|\]$/g, '').replace(/^\[|\]$/g, '').trim();
    const isKid = !isNaN(cleanTaglia) && cleanTaglia !== "";
    const sizePrefix = isKid ? `#${cleanTaglia}` : cleanTaglia;
    if (details.nome && details.numero) {
      nameNumberStr = `${sizePrefix}(${details.nome.toUpperCase()}, ${details.numero})`;
    } else if (details.numero) {
      nameNumberStr = `${sizePrefix}(${details.numero})`;
    } else if (details.nome) {
      nameNumberStr = `${sizePrefix}(${details.nome.toUpperCase()})`;
    }
  }

  return {
    nameNumberStr,
    patch: details.patchStr,
    customizationCostUSD: details.customizationCostUSD
  };
}

function getColumnIndexForSize(size) {
  const s = String(size).toUpperCase().replace(/^1x\s+\[|\]$/g, '').replace(/^\[|\]$/g, '').trim();
  if (s === 'S') return 5;
  if (s === 'M') return 6;
  if (s === 'L') return 7;
  if (s === 'XL') return 8;
  if (s === 'XXL' || s === '2XL') return 9;
  if (s === '3XL' || s === 'XXXL') return 10;
  if (s === '10') return 11;
  if (s === '12') return 12;
  if (s === '14') return 13;
  if (s === '16') return 14;
  if (s === '18') return 15;
  if (s === '20') return 16;
  if (s === '22') return 17;
  if (s === '24') return 18;
  if (s === '26') return 19;
  if (s === '28') return 20;
  return -1;
}

function calcolaCostoFornitoreProdotto(prezzoBaseUSD, infoPerso, item = {}) {
  const base = parseFloat(prezzoBaseUSD) || 0;
  const details = parseCustomizationDetails(infoPerso, item);
  return Number((base + details.customizationCostUSD).toFixed(2));
}

/**
 * Estrae dinamicamente e ordina tutte le fasce di spedizione configurate in settings.spedizioneLotto.
 * Supporta qualsiasi numero di fasce (1, 2, 3, 4, 5, ... o formato array).
 */
function extractShippingTiers(settings = null) {
  const currentSettings = settings || getSettings();
  const rules = (currentSettings && currentSettings.spedizioneLotto) || {};

  if (Array.isArray(rules.tiers) && rules.tiers.length > 0) {
    return rules.tiers.map(t => ({
      min: parseInt(t.min, 10) || 1,
      max: (t.max !== undefined && t.max !== null && t.max !== '' && t.max !== Infinity) ? parseInt(t.max, 10) : null,
      cost: parseFloat(t.cost) || 0
    })).sort((a, b) => a.min - b.min);
  }

  const tierMap = new Map();
  Object.keys(rules).forEach(key => {
    const match = key.match(/^range(\d+)_(min|max|cost)$/i);
    if (match) {
      const idx = parseInt(match[1], 10);
      if (!tierMap.has(idx)) {
        tierMap.set(idx, { index: idx, min: null, max: null, cost: null });
      }
      const item = tierMap.get(idx);
      const prop = match[2].toLowerCase();
      if (prop === 'min') item.min = parseInt(rules[key], 10);
      else if (prop === 'max') item.max = parseInt(rules[key], 10);
      else if (prop === 'cost') item.cost = parseFloat(rules[key]);
    }
  });

  const tiers = Array.from(tierMap.values()).sort((a, b) => a.index - b.index);

  if (tiers.length > 0) {
    let prevMax = 0;
    tiers.forEach((t) => {
      if (t.min === null || isNaN(t.min)) {
        t.min = prevMax + 1;
      }
      if (t.cost === null || isNaN(t.cost)) {
        t.cost = 4.0;
      }
      if (t.max !== null && !isNaN(t.max)) {
        prevMax = t.max;
      } else {
        t.max = null;
      }
    });
    return tiers;
  }

  return [
    { min: 1, max: 20, cost: 4.0 },
    { min: 21, max: 40, cost: 3.0 },
    { min: 41, max: null, cost: 2.0 }
  ];
}

/**
 * Calcola la tariffa di spedizione unitaria per pezzo (in USD) in base al numero totale di pezzi del lotto.
 * Legge tutte le fasce disponibili e restituisce automaticamente quella corretta in modo generico.
 */
function getShippingRateByQuantity(totalQuantity, settings = null) {
  const qty = Math.max(0, parseInt(totalQuantity, 10) || 0);
  const tiers = extractShippingTiers(settings);
  if (!tiers || tiers.length === 0) {
    return 4.0;
  }

  const effectiveQty = qty > 0 ? qty : 1;

  for (const tier of tiers) {
    const min = tier.min !== null && !isNaN(tier.min) ? tier.min : 1;
    const max = tier.max !== null && !isNaN(tier.max) ? tier.max : Infinity;
    if (effectiveQty >= min && effectiveQty <= max) {
      return Number(tier.cost);
    }
  }

  const lastTier = tiers[tiers.length - 1];
  return Number(lastTier.cost);
}

function getSupplierShippingCost(totalQuantityPcs, currentSettings = null) {
  const settings = currentSettings || getSettings();
  const qty = Math.max(0, parseInt(totalQuantityPcs, 10) || 0);
  const unitShipping = getShippingRateByQuantity(qty, settings);
  const totalShipping = Number((qty * unitShipping).toFixed(2));
  return { unitShipping, totalShipping };
}

function getCentralizedExchangeRate(settings = null) {
  const currentSettings = settings || getSettings();
  const valuta = (currentSettings && currentSettings.cambioValuta) || {};
  if (valuta.mode === 'manual' && valuta.manual_rate !== undefined && valuta.manual_rate !== null && valuta.manual_rate !== '') {
    return parseFloat(valuta.manual_rate) || 0.856;
  }
  if (currentSettings && currentSettings.cambio_usd_eur !== undefined && currentSettings.cambio_usd_eur !== null && currentSettings.cambio_usd_eur !== '') {
    return parseFloat(currentSettings.cambio_usd_eur) || 0.856;
  }
  return 0.856;
}

function getEffectiveExchangeRate(settings = null) {
  return getCentralizedExchangeRate(settings);
}

async function getLiveOrSettingsExchangeRate(settings = null) {
  const currentSettings = settings || getSettings();
  const valuta = (currentSettings && currentSettings.cambioValuta) || {};
  if (valuta.mode === 'manual' && valuta.manual_rate !== undefined && valuta.manual_rate !== null && valuta.manual_rate !== '') {
    return parseFloat(valuta.manual_rate) || 0.856;
  }
  try {
    const rateRes = await fetch('https://open.er-api.com/v6/latest/USD');
    if (rateRes.ok) {
      const rateData = await rateRes.json();
      if (rateData && rateData.rates && rateData.rates.EUR) {
        return Number(rateData.rates.EUR);
      }
    }
  } catch (err) {
    console.warn("⚠️ Live exchange rate fetch failed, using configured fallback:", err.message);
  }
  if (valuta.manual_rate !== undefined && valuta.manual_rate !== null && valuta.manual_rate !== '') {
    return parseFloat(valuta.manual_rate) || 0.856;
  }
  if (currentSettings && currentSettings.cambio_usd_eur !== undefined && currentSettings.cambio_usd_eur !== null && currentSettings.cambio_usd_eur !== '') {
    return parseFloat(currentSettings.cambio_usd_eur) || 0.856;
  }
  return 0.856;
}

function convertUsdToEur(amountUsd, rate = null, sourceFunction = 'convertUsdToEur') {
  const numUsd = Number(amountUsd) || 0;
  const numRate = Number(rate) > 0 ? Number(rate) : getCentralizedExchangeRate();
  const convertedEur = Number((numUsd * numRate).toFixed(2));

  console.log(`[USD EUR CONVERSION DEBUG]
originalUSD: ${numUsd}
conversionRate: ${numRate}
convertedEUR: ${convertedEur}
sourceFunction: ${sourceFunction}`);

  return convertedEur;
}

function getOrderEffectiveExchangeRate(order, settings = null) {
  if (order) {
    const rawRate = order["Cambio USD/EUR"] || order.cambio_usd_eur || order.exchange_rate;
    if (rawRate !== undefined && rawRate !== null && rawRate !== '') {
      const parsed = parseItalianFloat(String(rawRate));
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }
  return getCentralizedExchangeRate(settings);
}

function isTechnicalShippingOrServiceLine(name) {
  if (!name) return false;
  const lower = name.toLowerCase().trim();
  const terms = [
    'spedizione',
    'shipping',
    'delivery',
    'servizi',
    'fee',
    'voci tecniche',
    'spese di',
    'costi di',
    'standard shipping',
    'premium shipping',
    'spedizione standard',
    'spedizione premium'
  ];
  return terms.some(term => lower.includes(term));
}

function ricostruisciCarrelloDaStringhe(order) {
  const items = [];
  const squadre = (order.squadra || "").split(' / ');
  const taglie = (order.taglia || "").split(' / ');
  const personalizzazioni = (order.personalizzazione || "").split(' | ');

  squadre.forEach((sq, idx) => {
    if (!sq.trim()) return;
    if (isTechnicalShippingOrServiceLine(sq)) return; // ignora spedizione cliente!
    
    let quantita = 1;
    let nomeProdotto = sq;
    const matchSq = sq.trim().match(/^(\d+)x\s+(.*)/);
    if (matchSq) {
      quantita = parseInt(matchSq[1], 10);
      nomeProdotto = matchSq[2];
    }

    nomeProdotto = nomeProdotto.replace(/^\[|\]$/g, '').trim();

    let tagliaStr = "M";
    if (taglie[idx]) {
      tagliaStr = taglie[idx].replace(/^(\d+)x\s+\[|\]$/g, '').replace(/^\[|\]$/g, '').trim();
    }

    let persStr = "Nessuna";
    if (personalizzazioni[idx]) {
      persStr = personalizzazioni[idx].replace(/^(\d+)x\s+\[|\]$/g, '').replace(/^\[|\]$/g, '').trim();
    }

    items.push({
      squadra: nomeProdotto,
      categoria: nomeProdotto.toLowerCase().includes('bambino') || nomeProdotto.toLowerCase().includes('kid') ? "Kit Bambino" : "Kit",
      versione: nomeProdotto,
      taglia: tagliaStr,
      infoPerso: persStr,
      quantita: quantita,
      prezzo: parseItalianFloat(order.totale) / squadre.length,
      imgUrl: order.foto ? order.foto.replace(/^=IMAGE\("|"\)$/g, '') : ""
    });
  });

  return items;
}

const TEMPLATE_URL = "https://docs.google.com/spreadsheets/d/1Fho2z8A56D78ABHOQ3AYC28c9U1t8NeP/export?format=xlsx&gid=360750015";
const TEMPLATE_FILE = path.join(__dirname, 'template.xlsx');

function detectImageFormat(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 4) return null;
  // PNG magic bytes: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'png';
  }
  // JPEG magic bytes: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'jpeg';
  }
  // GIF magic bytes: 47 49 46
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return 'gif';
  }
  return null;
}

function createFallbackSupplierWorkbook() {
  const workbook = new exceljs.Workbook();
  workbook.creator = 'Elite Tournament Store';
  workbook.lastModifiedBy = 'Elite Tournament Store';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet('Worksheet', {
    views: [{ showGridLines: true }],
    pageSetup: {
      orientation: 'portrait',
      horizontalDpi: 300,
      verticalDpi: 300,
      fitToWidth: 1,
      fitToHeight: 0
    }
  });

  // Set column widths
  const colWidths = [
    12, // A: 图片(photo)
    28, // B: 标题(title)
    28, // C: 中文标题(title)
    14, // D: 标签(styles)
    6,  // E: S
    6,  // F: M
    6,  // G: L
    6,  // H: XL
    6,  // I: 2XL
    6,  // J: 3XL
    6,  // K: 10
    6,  // L: 12
    6,  // M: 14
    6,  // N: 16
    6,  // O: 18
    6,  // P: 20
    6,  // Q: 22
    6,  // R: 24
    6,  // S: 26
    6,  // T: 28
    14, // U: 数量(quantity)
    24, // V: 名字 号码(name number)
    16, // W: 臂章(patches)
    16, // X: 单价(Unit USD)
    16  // Y: 总额(Sum USD)
  ];
  colWidths.forEach((w, i) => {
    worksheet.getColumn(i + 1).width = w;
  });

  // Row 1: "Order Details" across A1:Y1
  worksheet.mergeCells('A1:Y1');
  const r1 = worksheet.getRow(1);
  r1.getCell(1).value = 'Order Details';
  r1.getCell(1).font = { bold: true, size: 14 };
  r1.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  r1.height = 28;

  // Row 2: Adults & Kids groups
  worksheet.mergeCells('E2:J2');
  const r2 = worksheet.getRow(2);
  r2.getCell(5).value = '大人（adults)';
  r2.getCell(5).font = { bold: true, size: 11 };
  r2.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };

  worksheet.mergeCells('K2:T2');
  r2.getCell(11).value = '小孩(kids)';
  r2.getCell(11).font = { bold: true, size: 11 };
  r2.getCell(11).alignment = { horizontal: 'center', vertical: 'middle' };
  r2.height = 20;

  // Row 3: Headers
  const headers = [
    '图片(photo)',
    '标题(title)',
    '中文标题(title)',
    '标签(styles)',
    'S',
    'M',
    'L',
    'XL',
    '2XL',
    '3XL',
    10,
    12,
    14,
    16,
    18,
    20,
    22,
    24,
    26,
    28,
    '数量(quantity)',
    '名字 号码(name number)',
    '臂章(patches)',
    '单价(Unit USD)',
    '总额(Sum USD)'
  ];

  const r3 = worksheet.getRow(3);
  headers.forEach((h, i) => {
    const cell = r3.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 11 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
      bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
      left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
      right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
    };
  });
  r3.height = 24;

  return { workbook, worksheet };
}

async function getOrLoadSupplierTemplateWorkbook() {
  // Genera sempre una struttura workbook pulita e perfettamente conforme allo standard OpenXML
  return createFallbackSupplierWorkbook();
}

async function downloadTemplateIfNeeded() {
  const result = await getOrLoadSupplierTemplateWorkbook();
  return result;
}

async function downloadImageAsBuffer(url) {
  if (!url || !url.startsWith('http')) return null;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      signal: AbortSignal.timeout(6000)
    });
    if (res.ok) {
      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }
  } catch (err) {
    console.warn(`Failed to download image from ${url}:`, err.message);
  }
  return null;
}

function getExcelProductStyle(item, matchedProd) {
  const prod = matchedProd || item;
  let rawCategory = "";
  if (prod && prod.categoria !== undefined && prod.categoria !== null) {
    rawCategory = String(prod.categoria).trim();
  } else if (item && item.categoria !== undefined && item.categoria !== null) {
    rawCategory = String(item.categoria).trim();
  }

  if (!rawCategory) {
    return "";
  }

  return normalizzaCategoria(rawCategory);
}

function getExcelProductTitle(item, matchedProd) {
  const prod = matchedProd || item;
  if (prod && prod.versione) {
    return prod.versione.trim();
  }
  if (prod && prod.titleItalian) {
    return prod.titleItalian.trim();
  }
  return (prod ? (prod.squadra || "") : "").trim();
}

function compileProductFieldsForExcel(normalizedItem) {
  const styleEng = normalizedItem.style || getExcelProductStyle(normalizedItem, normalizedItem.matchedProd);
  const titleEng = normalizedItem.titleItalian || getExcelProductTitle(normalizedItem, normalizedItem.matchedProd);

  const squadra = (normalizedItem.squadra || "").trim();
  const versione = (normalizedItem.titleItalian || squadra).toLowerCase();
  const stagione = (normalizedItem.season || "25/26").trim();

  let chTeam = TEAM_CHINESE_MAP[squadra] || squadra;
  for (const [itKey, zhVal] of Object.entries(TEAM_CHINESE_MAP)) {
    if (squadra.toLowerCase().includes(itKey.toLowerCase())) {
      chTeam = zhVal;
      break;
    }
  }

  const seasonClean = stagione.replace('/', '');

  const isBambino = styleEng === "Kids Kit" || versione.includes('bambino') || versione.includes('kids') || versione.includes('kid') || versione.includes('bambina');
  const isTuta = styleEng === "Tuta" || versione.includes('tuta') || versione.includes('tracksuit');
  const isRetro = styleEng === "Retro" || versione.includes('retro') || versione.includes('retrò');
  const isPlayer = styleEng === "Player" || versione.includes('player') || versione.includes('giocatore');

  let chType = "球迷版";
  if (isBambino) {
    chType = isTuta ? "儿童卫衣套装" : "儿童套装";
  } else if (isTuta) {
    chType = "成人卫衣套装";
  } else if (isRetro) {
    chType = "复古";
  } else if (isPlayer) {
    chType = "球员版";
  } else if (styleEng === "Training") {
    chType = "训练服";
  }

  const isAway = versione.includes('fuori casa') || versione.includes('away');
  const isThird = versione.includes('terza') || versione.includes('third');
  const isSpecial = versione.includes('speciale') || versione.includes('special');

  let chVers = "主场";
  if (isAway) chVers = "客场";
  else if (isThird) chVers = "第二客场";
  else if (isSpecial) chVers = "特别版";

  const titleCh = `${seasonClean}${chTeam}${chVers}${chType}`;

  return { titleEng, titleCh, styleEng };
}

async function generaExcelLotto(lottoId, orders) {
  const templateObj = await getOrLoadSupplierTemplateWorkbook();
  if (!templateObj || !templateObj.workbook) {
    throw new Error("Impossibile creare il workbook del fornitore.");
  }

  const workbook = templateObj.workbook;
  const worksheet = templateObj.worksheet || workbook.getWorksheet(1) || workbook.worksheets[0];

  // 1. CARICAMENTO COMPLETO E RESILIENTE DEL CATALOGO PRODOTTI (Paginazione Supabase completa per 4600+ prodotti)
  let localProducts = [];
  try {
    localProducts = getLocalProducts();
  } catch (e) {}
  let supabaseProducts = [];
  try {
    const supabase = getSupabaseClient();
    if (supabase) {
      supabaseProducts = await getAllProductsFromSupabase(supabase);
      console.log(`[GENERA EXCEL] Catalogo Supabase caricato: ${supabaseProducts.length} prodotti.`);
    }
  } catch (e) {
    console.warn("⚠️ Warning caricamento prodotti completi per Excel:", e.message);
  }
  const allDbProducts = supabaseProducts.length > 0 ? supabaseProducts : localProducts;

  // Pre-indicizzazione O(1) rigida: UUID e legacy_id (Nessun fallback ambiguo per sola squadra)
  const prodByIdMap = new Map();
  const prodByLegacyIdMap = new Map();
  const prodByExactVersioneMap = new Map();

  allDbProducts.forEach(p => {
    if (p.id !== undefined && p.id !== null && String(p.id).trim() !== "") {
      prodByIdMap.set(String(p.id).trim(), p);
    }
    if (p.legacy_id !== undefined && p.legacy_id !== null && String(p.legacy_id).trim() !== "") {
      prodByLegacyIdMap.set(String(p.legacy_id).trim(), p);
    }
    if (p.versione) {
      prodByExactVersioneMap.set(String(p.versione).trim().toLowerCase(), p);
    }
  });

  const normalizedItems = [];
  const validExcelOrders = (orders || []).filter(isOrderActiveForLotto);
  
  validExcelOrders.forEach(order => {
    let cartItems = order.carrello;
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      cartItems = ricostruisciCarrelloDaStringhe(order);
    }

    cartItems.forEach(item => {
      const isSpedizioneCliente = item.squadra && isTechnicalShippingOrServiceLine(item.squadra);
      if (isSpedizioneCliente) return;

      const q = Math.max(1, parseInt(item.quantita) || 1);

      // MATCHING RIGIDO
      let matchedProd = null;
      if (item.id !== undefined && item.id !== null && String(item.id).trim() !== "" && String(item.id) !== "undefined") {
        matchedProd = prodByIdMap.get(String(item.id).trim());
      }
      if (!matchedProd && item.legacy_id !== undefined && item.legacy_id !== null && String(item.legacy_id).trim() !== "" && String(item.legacy_id) !== "undefined") {
        const cand = prodByLegacyIdMap.get(String(item.legacy_id).trim());
        if (cand) {
          const itemSq = String(item.squadra || item.versione || "").trim().toLowerCase();
          const candVer = String(cand.versione || "").trim().toLowerCase();
          const candSq = String(cand.squadra || "").trim().toLowerCase();
          if (itemSq === candVer || itemSq === candSq || candVer.includes(itemSq) || itemSq.includes(candVer) || candSq.includes(itemSq)) {
            matchedProd = cand;
          }
        }
      }
      if (!matchedProd && item.squadra) {
        const sqKey = String(item.squadra).trim().toLowerCase();
        matchedProd = prodByExactVersioneMap.get(sqKey);
      }

      // PREZZO FORNITORE BASE IN USD
      let basePriceUSD = 0;
      if (matchedProd && matchedProd.prezzo_fornitore !== undefined && matchedProd.prezzo_fornitore !== null && Number(matchedProd.prezzo_fornitore) > 0) {
        basePriceUSD = Number(matchedProd.prezzo_fornitore);
      } else if (item.prezzo_fornitore !== undefined && item.prezzo_fornitore !== null && Number(item.prezzo_fornitore) > 0) {
        basePriceUSD = Number(item.prezzo_fornitore);
      } else if (item.Prezzo_fornitore !== undefined && item.Prezzo_fornitore !== null && Number(item.Prezzo_fornitore) > 0) {
        basePriceUSD = Number(item.Prezzo_fornitore);
      } else {
        basePriceUSD = 10.00;
      }

      // Calcolo personalizzazioni fornitore in USD (Formula ufficiale: $1 Nome, $1 Numero, $1 Patch)
      const rawInfoPerso = item.infoPerso || item.personalizzazione || "";
      const customDetails = parseCustomizationDetails(rawInfoPerso, item);
      const supplierCustomizationPriceUSD = customDetails.customizationCostUSD;
      const supplierUnitPriceUSD = Number((basePriceUSD + supplierCustomizationPriceUSD).toFixed(2));
      const supplierTotalPriceUSD = Number((supplierUnitPriceUSD * q).toFixed(2));

      // OGGETTO NORMALIZZATO CERTIFICATO: Stessa identica sorgente per tutti i campi
      const titleItalian = matchedProd ? matchedProd.versione.trim() : (item.versione || item.squadra || "").trim();
      const squadra = matchedProd ? matchedProd.squadra.trim() : (item.squadra || "").trim();
      const categoria = matchedProd ? String(matchedProd.categoria || "").trim() : String(item.categoria || "").trim();
      const season = matchedProd ? String(matchedProd.stagione || "25/26").trim() : (item.stagione || "25/26");
      const imageUrl = (matchedProd && matchedProd.immagine) ? matchedProd.immagine.trim() : (item.imgUrl || item.immagine || "").trim();
      const styleEng = getExcelProductStyle(item, matchedProd);

      const normalized = {
        productId: matchedProd ? matchedProd.id : (item.id || "UNREGISTERED_ITEM"),
        orderData: order.data,
        customerName: order.nome,
        titleItalian,
        squadra,
        categoria,
        season,
        style: styleEng,
        imageUrl,
        taglia: item.taglia || "-",
        infoPerso: rawInfoPerso,
        quantity: q,
        supplierBasePriceUSD: Number(basePriceUSD.toFixed(2)),
        supplierCustomizationPriceUSD: Number(supplierCustomizationPriceUSD.toFixed(2)),
        supplierUnitPriceUSD: supplierUnitPriceUSD,
        supplierTotalPriceUSD: supplierTotalPriceUSD,
        matchedProd
      };

      // VALIDAZIONE RIGIDA PRE-SCRITTURA
      if (!normalized.titleItalian || isNaN(normalized.supplierUnitPriceUSD) || normalized.supplierUnitPriceUSD <= 0) {
        console.error(`🚨 Errore validazione articolo per Excel lotto #${lottoId}:`, normalized);
        throw new Error(`Impossibile verificare la corrispondenza prodotto/prezzo per: "${normalized.titleItalian || item.squadra}"`);
      }

      normalizedItems.push(normalized);
    });
  });

  console.log(`[GENERA EXCEL] Compilazione normalizzata di ${normalizedItems.length} righe per il Lotto #${lottoId}`);

  // Download parallelo delle immagini uniche con cache e limite di concorrenza
  const uniqueUrls = new Set();
  normalizedItems.forEach(item => {
    if (item.imageUrl && typeof item.imageUrl === 'string' && item.imageUrl.startsWith('http')) {
      uniqueUrls.add(item.imageUrl);
    }
  });

  const imageCache = new Map();
  const urlList = Array.from(uniqueUrls);
  const concurrencyLimit = 10;
  for (let i = 0; i < urlList.length; i += concurrencyLimit) {
    const chunk = urlList.slice(i, i + concurrencyLimit);
    await Promise.all(chunk.map(async (url) => {
      const buf = await downloadImageAsBuffer(url);
      if (buf) imageCache.set(url, buf);
    }));
  }

  let currentRowNum = 4;
  for (let idx = 0; idx < normalizedItems.length; idx++) {
    const item = normalizedItems[idx];
    const row = worksheet.getRow(currentRowNum);

    const { titleEng, titleCh, styleEng } = compileProductFieldsForExcel(item);
    const { nameNumberStr, patch } = parserPersonalizzazione(item.infoPerso, item.taglia, item);

    // Col A (1): Immagine incorporata realmente con verifica precisa del formato tramite magic bytes
    const imgUrl = item.imageUrl;
    if (imgUrl) {
      const imgBuffer = imageCache.get(imgUrl);
      if (imgBuffer) {
        const detectedExt = detectImageFormat(imgBuffer);
        if (detectedExt) {
          try {
            const imageId = workbook.addImage({
              buffer: imgBuffer,
              extension: detectedExt,
            });
            
            worksheet.addImage(imageId, {
              tl: { col: 0, row: currentRowNum - 1 },
              ext: { width: 45, height: 45 },
              editAs: 'oneCell'
            });
            row.height = 40;
          } catch (imgErr) {
            console.warn("Real embedding failed, using formula fallback:", imgErr.message);
            row.getCell(1).value = { formula: `IMAGE("${imgUrl}")` };
          }
        } else {
          row.getCell(1).value = { formula: `IMAGE("${imgUrl}")` };
        }
      } else {
        row.getCell(1).value = { formula: `IMAGE("${imgUrl}")` };
      }
    } else {
      row.getCell(1).value = "";
    }

    row.getCell(2).value = titleEng;          // Col B (2): 标题(title)
    row.getCell(3).value = titleCh;           // Col C (3): 中文标题(title)
    row.getCell(4).value = styleEng;          // Col D (4): 标签(styles)

    // Svuota taglie (colonne 5 a 20)
    for (let c = 5; c <= 20; c++) {
      row.getCell(c).value = "";
    }

    // Imposta la quantità corretta nella colonna della taglia
    const colIdx = getColumnIndexForSize(item.taglia);
    if (colIdx !== -1) {
      row.getCell(colIdx).value = item.quantity;
    }

    row.getCell(21).value = item.quantity;                // Col U (21): 数量(quantity)
    row.getCell(22).value = nameNumberStr;                // Col V (22): 名字 号码(name number)
    row.getCell(23).value = patch || "";                  // Col W (23): 臂章(patches)
    
    // Col X (24): Unit USD (PREZZO FORNITORE REALE UNITARIO IN USD)
    row.getCell(24).value = item.supplierUnitPriceUSD;
    row.getCell(24).numFmt = '#,##0.00';

    // Col Y (25): Sum USD (PREZZO FORNITORE TOTALE RIGA IN USD = Unit * Qty)
    row.getCell(25).value = { formula: `U${currentRowNum}*X${currentRowNum}`, result: item.supplierTotalPriceUSD };
    row.getCell(25).numFmt = '#,##0.00';

    // Allinea e formatta
    for (let c = 1; c <= 25; c++) {
      const cell = row.getCell(c);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
      };
      if (c >= 5 && c <= 21) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    }

    currentRowNum++;
  }

  const lastItemRowNum = currentRowNum > 4 ? currentRowNum - 1 : 4;
  const totalQuantityPcs = normalizedItems.reduce((acc, it) => acc + it.quantity, 0);
  const totalItemsSupplierPriceUSD = Number(normalizedItems.reduce((acc, it) => acc + it.supplierTotalPriceUSD, 0).toFixed(2));

  // Righe finali riepilogo
  // 1. Total Quantity Row
  const totalQtyRowNum = currentRowNum;
  worksheet.mergeCells(`A${totalQtyRowNum}:T${totalQtyRowNum}`);
  const totalQtyRow = worksheet.getRow(totalQtyRowNum);
  totalQtyRow.getCell(1).value = "Total Quantity (pcs)";
  totalQtyRow.getCell(1).font = { bold: true };
  totalQtyRow.getCell(21).value = { formula: `SUM(U4:U${lastItemRowNum})`, result: totalQuantityPcs };
  totalQtyRow.getCell(21).font = { bold: true };
  totalQtyRow.getCell(21).alignment = { horizontal: 'center', vertical: 'middle' };
  totalQtyRow.getCell(25).value = { formula: `SUM(Y4:Y${lastItemRowNum})`, result: totalItemsSupplierPriceUSD };
  totalQtyRow.getCell(25).font = { bold: true };
  totalQtyRow.getCell(25).numFmt = '#,##0.00';
  currentRowNum++;

  // 2. Shipping Cost Row (USD)
  const shippingRowNum = currentRowNum;
  worksheet.mergeCells(`A${shippingRowNum}:T${shippingRowNum}`);
  const shippingRow = worksheet.getRow(shippingRowNum);
  shippingRow.getCell(1).value = "shipping Cost (USD)";
  shippingRow.getCell(1).font = { bold: true };
  
  const settings = getSettings();
  const { unitShipping, totalShipping: totShippingUSD } = getSupplierShippingCost(totalQuantityPcs, settings);

  shippingRow.getCell(24).value = unitShipping;
  shippingRow.getCell(24).numFmt = '#,##0.00';
  shippingRow.getCell(24).alignment = { horizontal: 'center', vertical: 'middle' };
  shippingRow.getCell(25).value = { formula: `X${shippingRowNum}*U${totalQtyRowNum}`, result: totShippingUSD };
  shippingRow.getCell(25).font = { bold: true };
  shippingRow.getCell(25).numFmt = '#,##0.00';
  currentRowNum++;

  // 3. Total Price Row (USD)
  const totalPriceRowNum = currentRowNum;
  worksheet.mergeCells(`A${totalPriceRowNum}:T${totalPriceRowNum}`);
  const totalPriceRow = worksheet.getRow(totalPriceRowNum);
  totalPriceRow.getCell(1).value = "Total Price (USD)";
  totalPriceRow.getCell(1).font = { bold: true };
  const grandTotalUSD = Number((totalItemsSupplierPriceUSD + totShippingUSD).toFixed(2));
  totalPriceRow.getCell(25).value = { formula: `Y${totalQtyRowNum}+Y${shippingRowNum}`, result: grandTotalUSD };
  totalPriceRow.getCell(25).font = { bold: true, size: 12 };
  totalPriceRow.getCell(25).numFmt = '#,##0.00';

  const lottiDir = path.join(__dirname, 'lotti');
  if (!fs.existsSync(lottiDir)) {
    fs.mkdirSync(lottiDir, { recursive: true });
  }

  const outputFilename = `LOTTO_${String(lottoId).padStart(4, '0')}.xlsx`;
  const outputPath = path.join(lottiDir, outputFilename);
  await workbook.xlsx.writeFile(outputPath);
  console.log(`✅ Excel generato con successo in: ${outputPath} | Pezzi: ${totalQuantityPcs} | Totale Articoli: $${totalItemsSupplierPriceUSD} | Spedizione: $${totShippingUSD} | Totale Fornitore: $${grandTotalUSD}`);

  return `/lotti/${outputFilename}`;
}

/**
 * Gestore universale per la generazione dinamica e il download dell'Excel fornitore di un lotto.
 * Per il lotto IN CORSO: recupera in tempo reale gli ordini attuali e compila al volo il file XLSX.
 * Per il lotto ARCHIVIATO: recupera gli ordini dello storico e restituisce/rigenera il file.
 */
async function handleDownloadExcelLotto(req, res, targetLottoId) {
  try {
    let currentActiveLottoId = 1;
    try {
      currentActiveLottoId = getCurrentActiveLottoId();
    } catch (e) {}

    let lottoId = targetLottoId !== undefined && targetLottoId !== null ? Number(targetLottoId) : currentActiveLottoId;
    if (isNaN(lottoId) || lottoId <= 0) {
      lottoId = currentActiveLottoId;
    }

    const filename = `LOTTO_${String(lottoId).padStart(4, '0')}.xlsx`;
    const lottiDir = path.join(__dirname, 'lotti');
    if (!fs.existsSync(lottiDir)) {
      fs.mkdirSync(lottiDir, { recursive: true });
    }
    const filePath = path.join(lottiDir, filename);

    // Verifica se è il lotto corrente attivo in corso
    const isCurrentLotto = (Number(lottoId) === Number(currentActiveLottoId));

    if (isCurrentLotto) {
      // 1. LOTTO IN CORSO -> Rigenerazione dinamica on-demand al momento del download
      const allOrders = await getDbOrders();
      const unarchivedOrders = (allOrders || []).filter(o => !o.is_archived && isOrderActiveForLotto(o));
      const activeOrders = unarchivedOrders.filter(o => o.lotto_id === null || o.lotto_id === undefined || Number(o.lotto_id) === Number(lottoId));

      console.log(`[EXCEL LOTTO] Generazione dinamica on-demand per Lotto #${lottoId} (IN CORSO) con ${activeOrders.length} ordini attivi`);
      await generaExcelLotto(lottoId, activeOrders);

      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.download(filePath, filename, (err) => {
        if (err && !res.headersSent) {
          console.error(`[EXCEL LOTTO] Errore invio file ${filename}:`, err.message);
          res.status(500).json({ success: false, error: err.message });
        }
      });
    } else {
      // 2. LOTTO ARCHIVIATO / CHIUSO
      const allLotti = await getDbLotti();
      const archivedLotto = (allLotti || []).find(l => Number(l.id) === Number(lottoId));

      if (fs.existsSync(filePath)) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.download(filePath, filename, (err) => {
          if (err && !res.headersSent) {
            console.error(`[EXCEL LOTTO] Errore invio file esistente ${filename}:`, err.message);
            res.status(500).json({ success: false, error: err.message });
          }
        });
      }

      if (archivedLotto) {
        const allOrders = await getDbOrders();
        const lotOrders = getOrdersForArchivedLotto(archivedLotto, allOrders);
        console.log(`[EXCEL LOTTO] Generazione Excel per Lotto archiviato #${lottoId} con ${lotOrders.length} ordini`);
        await generaExcelLotto(lottoId, lotOrders);

        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.download(filePath, filename, (err) => {
          if (err && !res.headersSent) {
            console.error(`[EXCEL LOTTO] Errore invio file ${filename}:`, err.message);
            res.status(500).json({ success: false, error: err.message });
          }
        });
      }

      return res.status(404).json({ success: false, error: `Lotto #${lottoId} non trovato.` });
    }
  } catch (err) {
    console.error(`🚨 Errore durante generazione/download Excel lotto #${targetLottoId}:`, err.message);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}


// Lazy initialization of the Supabase client to prevent startup crash if keys are missing
let supabaseClient = null;

function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.warn("⚠️ Warning: SUPABASE_URL or SUPABASE_ANON_KEY/SERVICE_ROLE_KEY not set. Falling back to local database.");
    return null;
  }
  
  try {
    supabaseClient = createClient(supabaseUrl, supabaseKey);
    return supabaseClient;
  } catch (err) {
    console.warn("⚠️ Information: Supabase client is not initialized or invalid credentials:", err.message);
    return null;
  }
}

// Helper per scaricare in modo resiliente e paginato TUTTI i prodotti da Supabase (evitando il limite di 1000 righe)
async function getAllProductsFromSupabase(supabase) {
  if (!supabase) return [];
  let allProductsRaw = [];
  let rangeStart = 0;
  const chunkSize = 1000;
  let hasMore = true;
  let batchIndex = 1;
  while (hasMore) {
    const rangeEnd = rangeStart + chunkSize - 1;
    const { data: chunk, error } = await supabase
      .from('products')
      .select('*')
      .order('legacy_id', { ascending: true })
      .range(rangeStart, rangeEnd);

    if (error) {
      console.warn(`⚠️ Error loading products at batch ${batchIndex} (range: ${rangeStart}-${rangeEnd}):`, error.message);
      throw error;
    }

    if (chunk && chunk.length > 0) {
      allProductsRaw = allProductsRaw.concat(chunk);
      if (chunk.length < chunkSize) {
        hasMore = false;
      } else {
        rangeStart += chunkSize;
        batchIndex++;
      }
    } else {
      hasMore = false;
    }
  }
  return allProductsRaw;
}

// ==========================================
// OPERAZIONI DATABASE DUAL-STORAGE (SUPABASE + LOCAL RESILIENCE)
// ==========================================

async function getDbOrders() {
  const supabase = getSupabaseClient();
  let dbOrders = [];
  if (supabase) {
    try {
      const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (!error && data) {
        dbOrders = data.map(o => ({
          id: o.id,
          created_at: o.created_at,
          data: o.data,
          nome: o.nome,
          telefono: o.telefono,
          squadra: o.squadra,
          personalizzazione: o.personalizzazione,
          taglia: o.taglia,
          totale: o.totale,
          foto: o.foto,
          "Prezzo fornitore": o.prezzo_fornitore,
          "Costo prodotti (USD)": o.costo_prodotti_usd,
          "Costo spedizione (USD)": o.costo_spedizione_usd,
          "Costo totale (USD)": o.costo_totale_usd,
          "Cambio USD/EUR": o.cambio_usd_eur,
          "Costo totale (EUR)": o.costo_totale_eur,
          "Profitto (EUR)": o.profitto_eur,
          is_archived: o.is_archived,
          lotto_id: o.lotto_id,
          carrello: o.carrello,
          coupon_code: o.coupon_code || null,
          coupon_discount: o.coupon_discount !== undefined && o.coupon_discount !== null ? Number(o.coupon_discount) : 0,
          coupon_type: o.coupon_type || null,
          coupon_value: o.coupon_value !== undefined && o.coupon_value !== null ? Number(o.coupon_value) : null
        }));
      } else if (error) {
        console.warn("⚠️ Querying orders table from Supabase failed:", error.message);
      }
    } catch (err) {
      console.warn("⚠️ Exception querying orders from Supabase:", err.message);
    }
  }

  // Resilienza con persistenza locale (orders_local.json)
  const localOrders = getLocalOrders();
  
  // Merge deterministico su Map: chiave prioritaria ID (o data univoca)
  const mergedMap = new Map();
  
  // 1. Popola con gli ordini locali
  for (const lo of localOrders) {
    if (!lo) continue;
    const key = (lo.id !== undefined && lo.id !== null && String(lo.id).trim() !== '') 
      ? `id_${lo.id}` 
      : `data_${String(lo.data || '').trim()}`;
    mergedMap.set(key, lo);
  }
  
  // 2. Sovrascrivi/integra con i record remoti di Supabase mantenendo i dati più completi
  for (const dbo of dbOrders) {
    if (!dbo) continue;
    const keyById = (dbo.id !== undefined && dbo.id !== null && String(dbo.id).trim() !== '') ? `id_${dbo.id}` : null;
    const keyByData = (dbo.data !== undefined && dbo.data !== null && String(dbo.data).trim() !== '') ? `data_${String(dbo.data).trim()}` : null;
    
    const matchedKey = (keyById && mergedMap.has(keyById)) ? keyById : ((keyByData && mergedMap.has(keyByData)) ? keyByData : null);
    
    if (matchedKey) {
      const existing = mergedMap.get(matchedKey);
      if (keyById && matchedKey !== keyById) {
        mergedMap.delete(matchedKey);
        mergedMap.set(keyById, { ...existing, ...dbo });
      } else {
        mergedMap.set(matchedKey, { ...existing, ...dbo });
      }
    } else {
      const finalKey = keyById || keyByData || `item_${Math.random()}`;
      mergedMap.set(finalKey, dbo);
    }
  }
  
  return Array.from(mergedMap.values());
}

async function ensureLottoExistsInDb(lottoId) {
  if (!lottoId || isNaN(Number(lottoId))) return;
  const numId = Number(lottoId);
  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    const { data: existing, error: selErr } = await supabase.from('lotti').select('id').eq('id', numId);
    if (!selErr && (!existing || existing.length === 0)) {
      await supabase.from('lotti').upsert({
        id: numId,
        numero_lotto: `Lotto #${numId}`,
        archived_at: 'In corso',
        numero_ordini: 0,
        numero_articoli: 0,
        incasso_totale_eur: 0,
        costo_prodotti_usd: 0,
        costo_spedizione_usd: 0,
        costo_totale_usd: 0,
        costo_totale_eur: 0,
        profitto_eur: 0,
        margine_percentuale: 0
      });
      console.log(`✅ [DB SYNC] Record placeholder per Lotto #${numId} verificato su Supabase 'lotti'.`);
    }
  } catch (err) {
    console.warn(`⚠️ ensureLottoExistsInDb #${numId} warning:`, err.message);
  }
}

async function insertDbOrder(order) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase non è configurato.");
  }
  if (order.lotto_id !== undefined && order.lotto_id !== null && !isNaN(Number(order.lotto_id))) {
    await ensureLottoExistsInDb(order.lotto_id);
  }
  const orderData = {
    data: order.data,
    nome: order.nome,
    telefono: order.telefono,
    squadra: order.squadra,
    personalizzazione: order.personalizzazione || "",
    taglia: order.taglia || "",
    totale: order.totale,
    foto: order.foto || "",
    prezzo_fornitore: order["Prezzo fornitore"] || order.prezzo_fornitore || "",
    costo_prodotti_usd: order["Costo prodotti (USD)"] || order.costo_prodotti_usd || "0",
    costo_spedizione_usd: order["Costo spedizione (USD)"] || order["osto spedizione (USD)"] || order.costo_spedizione_usd || "0",
    costo_totale_usd: order["Costo totale (USD)"] || order.costo_totale_usd || "0",
    cambio_usd_eur: order["Cambio USD/EUR"] || order.cambio_usd_eur || "0",
    costo_totale_eur: order["Costo totale (EUR)"] || order.costo_totale_eur || "0",
    profitto_eur: order["Profitto (EUR)"] || order.profitto_eur || "0",
    is_archived: order.is_archived !== undefined ? order.is_archived : false,
    lotto_id: order.lotto_id !== undefined ? order.lotto_id : null,
    carrello: order.carrello || [],
    coupon_code: order.coupon_code || null,
    coupon_discount: order.coupon_discount !== undefined && order.coupon_discount !== null ? Number(order.coupon_discount) : null,
    coupon_type: order.coupon_type || null,
    coupon_value: order.coupon_value !== undefined && order.coupon_value !== null ? Number(order.coupon_value) : null
  };
 console.log("\n================ ORDER DATA DA SALVARE ================");
console.log(JSON.stringify(orderData, null, 2));
console.log("=======================================================\n");

  const { data, error } = await supabase
  .from('orders')
  .insert(orderData)
  .select();

if (error) {
  console.error("⚠️ Inserting order to Supabase failed:", error.message);
  throw error;
}

console.log("\n================ RIGA SALVATA SU SUPABASE ================");
console.log(JSON.stringify(data, null, 2));
console.log("==========================================================\n");

console.log("✅ Order inserted successfully in Supabase 'orders' table.");
return data && data.length > 0 ? data[0] : null;
}

async function deleteDbOrderByDate(orderDate) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase non è configurato.");
  }
  const { error } = await supabase.from('orders').delete().eq('data', orderDate);
  if (error) {
    console.error("⚠️ Deleting order from Supabase failed:", error.message);
    throw error;
  }
  console.log(`✅ Order with date ${orderDate} deleted from Supabase 'orders' table.`);
}

async function getDbLotti() {
  const supabase = getSupabaseClient();
  let dbLotti = [];
  if (supabase) {
    try {
      const { data, error } = await supabase.from('lotti').select('*').order('id', { ascending: false });
      if (!error && data) {
        dbLotti = data;
      } else if (error) {
        console.warn("⚠️ Querying lotti from Supabase failed, falling back to local archive:", error.message);
      }
    } catch (err) {
      console.warn("⚠️ Querying lotti from Supabase failed, fallback to local:", err.message);
    }
  }

  let localArchive = [];
  const archiveFile = path.join(__dirname, 'lotto_archive.json');
  if (fs.existsSync(archiveFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(archiveFile, 'utf8'));
      if (Array.isArray(parsed)) {
        localArchive = parsed;
      }
    } catch (e) {}
  }

  // Merge deterministico: priorità Supabase se presente, altrimenti fallback locale
  const mergedMap = new Map();
  for (const lo of localArchive) {
    if (!lo) continue;
    const key = lo.id !== undefined && lo.id !== null ? `id_${lo.id}` : `name_${lo.numero_lotto}`;
    mergedMap.set(key, lo);
  }

  for (const dbo of dbLotti) {
    if (!dbo) continue;
    const key = dbo.id !== undefined && dbo.id !== null ? `id_${dbo.id}` : `name_${dbo.numero_lotto}`;
    if (mergedMap.has(key)) {
      const existing = mergedMap.get(key);
      const merged = { ...existing };
      for (const [k, v] of Object.entries(dbo)) {
        if (v !== undefined && v !== null) {
          merged[k] = v;
        }
      }
      if (dbo.orders && dbo.orders.length > 0) {
        merged.orders = dbo.orders;
      }
      mergedMap.set(key, merged);
    } else {
      mergedMap.set(key, dbo);
    }
  }

  return Array.from(mergedMap.values()).sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
}

async function insertDbLotto(lotto) {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { error } = await supabase.from('lotti').upsert({
        id: lotto.id,
        numero_lotto: lotto.numero_lotto,
        archived_at: lotto.archived_at,
        status: lotto.status || 'archived',
        numero_ordini: lotto.numero_ordini,
        numero_articoli: lotto.numero_articoli,
        incasso_totale_eur: lotto.incasso_totale_eur,
        costo_prodotti_usd: lotto.costo_prodotti_usd,
        costo_spedizione_usd: lotto.costo_spedizione_usd,
        costo_fornitore_usd: lotto.costo_fornitore_usd,
        costo_fornitore_eur: lotto.costo_fornitore_eur,
        alibaba_fee_usd: lotto.alibaba_fee_usd,
        alibaba_fee_eur: lotto.alibaba_fee_eur,
        spese_extra_usd: lotto.spese_extra_usd,
        spese_extra_eur: lotto.spese_extra_eur,
        costo_totale_usd: lotto.costo_totale_usd,
        costo_totale_eur: lotto.costo_totale_eur,
        profitto_eur: lotto.profitto_eur,
        margine_percentuale: lotto.margine_percentuale,
        excel_url: lotto.excel_url,
        orders: lotto.orders || [],
        extra_expenses: lotto.extra_expenses || []
      });
      if (error) {
        // Se alcune colonne estese non sono definite nella tabella Supabase, esegui il fallback con schema base
        console.warn("⚠️ Upsert con campi estesi su Supabase non riuscito, eseguo fallback con colonne base:", error.message);
        const { error: fallbackErr } = await supabase.from('lotti').upsert({
          id: lotto.id,
          numero_lotto: lotto.numero_lotto,
          archived_at: lotto.archived_at,
          numero_ordini: lotto.numero_ordini,
          numero_articoli: lotto.numero_articoli,
          incasso_totale_eur: lotto.incasso_totale_eur,
          costo_prodotti_usd: lotto.costo_prodotti_usd,
          costo_spedizione_usd: lotto.costo_spedizione_usd,
          costo_totale_usd: lotto.costo_totale_usd,
          costo_totale_eur: lotto.costo_totale_eur,
          profitto_eur: lotto.profitto_eur,
          margine_percentuale: lotto.margine_percentuale,
          excel_url: lotto.excel_url,
          orders: lotto.orders || []
        });
        if (fallbackErr) {
          console.error("⚠️ Upsert base lotto su Supabase fallito:", fallbackErr.message);
        } else {
          console.log(`✅ Lotto #${lotto.id} salvato su Supabase (schema base).`);
        }
      } else {
        console.log(`✅ Lotto #${lotto.id} salvato con successo nel database Supabase 'lotti'.`);
      }
    } catch (err) {
      console.warn("⚠️ Exception upserting lotto to Supabase:", err.message);
    }
  }

  // Sincronizza anche il file locale di fallback
  const archiveFile = path.join(__dirname, 'lotto_archive.json');
  let localArchive = [];
  if (fs.existsSync(archiveFile)) {
    try { localArchive = JSON.parse(fs.readFileSync(archiveFile, 'utf8')); } catch (e) {}
  }
  if (!Array.isArray(localArchive)) localArchive = [];
  const existingIdx = localArchive.findIndex(l => Number(l.id) === Number(lotto.id));
  if (existingIdx !== -1) {
    localArchive[existingIdx] = lotto;
  } else {
    localArchive.push(lotto);
  }
  try {
    fs.writeFileSync(archiveFile, JSON.stringify(localArchive, null, 2), 'utf8');
  } catch (err) {
    console.warn("⚠️ Errore salvataggio lotto_archive.json locale:", err.message);
  }
}

async function deleteDbLotto(id) {
  const numId = Number(id);
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { error } = await supabase.from('lotti').delete().eq('id', numId);
      if (error) {
        console.error("⚠️ Deleting lotto from Supabase failed:", error.message);
      } else {
        console.log(`✅ Lotto with ID ${numId} deleted from Supabase 'lotti' table.`);
      }
    } catch (err) {
      console.warn("⚠️ Exception deleting lotto from Supabase:", err.message);
    }
  }

  // Sincronizza anche il file locale di fallback
  const archiveFile = path.join(__dirname, 'lotto_archive.json');
  if (fs.existsSync(archiveFile)) {
    try {
      let localArchive = JSON.parse(fs.readFileSync(archiveFile, 'utf8'));
      if (Array.isArray(localArchive)) {
        localArchive = localArchive.filter(l => Number(l.id) !== numId);
        fs.writeFileSync(archiveFile, JSON.stringify(localArchive, null, 2), 'utf8');
      }
    } catch (e) {}
  }
}


// GET /api/config - Ritorna la configurazione di Supabase per il seeding lato client
app.get('/api/config', (req, res) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  res.json({ supabaseUrl: supabaseUrl || null, supabaseAnonKey: supabaseAnonKey || null });
});

// GET /api/proxy-image - Proxy sicuro per nascondere il dominio del fornitore esterno
app.get('/api/proxy-image', async (req, res) => {
  let targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).send("Missing url parameter");
  }

  // Decodifica l'URL se è codificato in Base64 (per occultamento extra)
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    try {
      const decoded = Buffer.from(targetUrl, 'base64').toString('utf-8');
      if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
        targetUrl = decoded;
      }
    } catch (e) {
      // Continua con l'url originale se la decodifica fallisce
    }
  }

  // Validazione finale del protocollo
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    return res.status(400).send("Invalid url parameter");
  }

  try {
    // Rimuoviamo l'hash/fragment prima di fare il fetch
    const cleanUrl = targetUrl.split('#')[0];
    
    const response = await fetch(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      return res.status(response.status).send("Failed to fetch image from source");
    }

    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    
    // Cache di 24 ore per stabilità e prestazioni eccellenti
    res.setHeader('Cache-Control', 'public, max-age=86400');

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.send(buffer);
  } catch (err) {
    console.warn("⚠️ Proxy dell'immagine non riuscito:", err.message);
    res.status(502).send("Error proxying image");
  }
});

// Helper for Settings Persistence
const SETTINGS_FILE = path.join(__dirname, 'settings.json');
const DEFAULT_SETTINGS = {
  prezziPredefiniti: {
    "Kit": 26.99,
    "Player": 21.99,
    "Fan": 21.99,
    "Retro": 21.99,
    "Kit Allenamento": 25.99,
    "Tuta": 44.99,
    "Polo": 26.99,
    "Smanicati": 26.99,
    "Maniche Lunghe": 25.99,
    "Kit Bambino": 19.99
  },
  regolePrezzi: {
    "Kit_Adulto": 26.99,
    "Kit_Bambino": 21.99,
    "Player_Adulto": 21.99,
    "Player_Bambino": 19.99,
    "Fan_Adulto": 21.99,
    "Fan_Bambino": 19.99,
    "Retro_Adulto": 21.99,
    "Retro_Bambino": 19.99,
    "Kit Allenamento_Adulto": 25.99,
    "Kit Allenamento_Bambino": 21.99,
    "Tuta_Adulto": 44.99,
    "Tuta_Bambino": 40.00,
    "Polo_Adulto": 26.99,
    "Polo_Bambino": 21.99,
    "Smanicati_Adulto": 26.99,
    "Smanicati_Bambino": 21.99,
    "Maniche Lunghe_Adulto": 25.99,
    "Maniche Lunghe_Bambino": 21.99,
    "Kit Bambino_Adulto": 19.99,
    "Kit Bambino_Bambino": 19.99
  },
  spedizioneLotto: {
    "range1_min": 1,
    "range1_max": 10,
    "range1_cost": 4.0,
    "range2_min": 11,
    "range2_max": 20,
    "range2_cost": 3.0,
    "range3_min": 21,
    "range3_cost": 2.0
  },
  cambioValuta: {
    "mode": "auto",
    "manual_rate": 0.86
  },
  alibabaFee: {
    "percentage": 3.0
  },
  contatti: {
    "whatsapp_number": "393282218320",
    "support_email": "assistenza@elitetournamentstore.com"
  },
  valoriPredefiniti: {
    "stagione": "2024/2025",
    "categoria": "Kit",
    "versione": "Home"
  },
  sicurezza: {
    "conferma_elimina_prodotto": true,
    "conferma_elimina_ordine": true,
    "conferma_elimina_recensione": true
  },
  categorie: [
    { id: 'cat_kit', nome: 'Kit', prezzo_adulto: 26.99, prezzo_bambino: 21.99, ordine: 1, stato: 'attivo' },
    { id: 'cat_player', nome: 'Player', prezzo_adulto: 21.99, prezzo_bambino: 19.99, ordine: 2, stato: 'attivo' },
    { id: 'cat_fan', nome: 'Fan', prezzo_adulto: 21.99, prezzo_bambino: 19.99, ordine: 3, stato: 'attivo' },
    { id: 'cat_retro', nome: 'Retro', prezzo_adulto: 21.99, prezzo_bambino: 19.99, ordine: 4, stato: 'attivo' },
    { id: 'cat_allenamento', nome: 'Kit Allenamento', prezzo_adulto: 25.99, prezzo_bambino: 21.99, ordine: 5, stato: 'attivo' },
    { id: 'cat_tuta', nome: 'Tuta', prezzo_adulto: 44.99, prezzo_bambino: 40.00, ordine: 6, stato: 'attivo' },
    { id: 'cat_polo', nome: 'Polo', prezzo_adulto: 26.99, prezzo_bambino: 21.99, ordine: 7, stato: 'attivo' },
    { id: 'cat_smanicati', nome: 'Smanicati', prezzo_adulto: 26.99, prezzo_bambino: 21.99, ordine: 8, stato: 'attivo' },
    { id: 'cat_maniche_lunghe', nome: 'Maniche Lunghe', prezzo_adulto: 25.99, prezzo_bambino: 21.99, ordine: 9, stato: 'attivo' },
    { id: 'cat_bambino', nome: 'Kit Bambino', prezzo_adulto: 19.99, prezzo_bambino: 19.99, ordine: 10, stato: 'attivo' }
  ],
  filtriCatalogo: [
    { id: 'fil_tutti', nome: 'Tutti', ordine: 1, stato: 'attivo' },
    { id: 'fil_kit', nome: 'Kit', ordine: 2, stato: 'attivo' },
    { id: 'fil_player', nome: 'Player', ordine: 3, stato: 'attivo' },
    { id: 'fil_fan', nome: 'Fan', ordine: 4, stato: 'attivo' },
    { id: 'fil_retro', nome: 'Retro', ordine: 5, stato: 'attivo' },
    { id: 'fil_allenamento', nome: 'Kit Allenamento', ordine: 6, stato: 'attivo' },
    { id: 'fil_tuta', nome: 'Tuta', ordine: 7, stato: 'attivo' },
    { id: 'fil_polo', nome: 'Polo', ordine: 8, stato: 'attivo' },
    { id: 'fil_smanicati', nome: 'Smanicati', ordine: 9, stato: 'attivo' },
    { id: 'fil_maniche_lunghe', nome: 'Maniche Lunghe', ordine: 10, stato: 'attivo' },
    { id: 'fil_bambino', nome: 'Kit Bambino', ordine: 11, stato: 'attivo' }
  ],
  regoleImportazioneJson: [
    { id: 'rule_1', valore_json: 'Full Kit', categoria: 'Kit' },
    { id: 'rule_2', valore_json: 'Training Kit', categoria: 'Kit Allenamento' },
    { id: 'rule_3', valore_json: 'Vest', categoria: 'Kit Allenamento' },
    { id: 'rule_4', valore_json: 'Polo', categoria: 'Polo' },
    { id: 'rule_5', valore_json: 'Sleeveless', categoria: 'Smanicato' },
    { id: 'rule_6', valore_json: 'Player Version', categoria: 'Player' },
    { id: 'rule_7', valore_json: 'Player Jersey', categoria: 'Player' },
    { id: 'rule_8', valore_json: 'Fan Version', categoria: 'Fan' },
    { id: 'rule_9', valore_json: 'Fan Jersey', categoria: 'Fan' },
    { id: 'rule_10', valore_json: 'Retro', categoria: 'Retro' },
    { id: 'rule_11', valore_json: 'Vintage', categoria: 'Retro' },
    { id: 'rule_12', valore_json: 'Tracksuit', categoria: 'Tuta' },
    { id: 'rule_13', valore_json: 'Kit Bambino', categoria: 'Kit Bambino' }
  ]
};

let cachedSettings = null;

function assicuraMigrazioneCategorie(settings) {
  if (!settings) return settings;
  if (!Array.isArray(settings.categorie) || settings.categorie.length === 0) {
    const regole = settings.regolePrezzi || {};
    settings.categorie = DEFAULT_SETTINGS.categorie.map((cat, idx) => {
      const keyAdulto = `${cat.nome}_Adulto`;
      const keyBambino = `${cat.nome}_Bambino`;
      return {
        id: cat.id || `cat_${Date.now()}_${idx}`,
        nome: cat.nome,
        prezzo_adulto: regole[keyAdulto] !== undefined ? parseFloat(regole[keyAdulto]) : cat.prezzo_adulto,
        prezzo_bambino: regole[keyBambino] !== undefined ? parseFloat(regole[keyBambino]) : cat.prezzo_bambino,
        ordine: idx + 1,
        stato: 'attivo'
      };
    });
  }
  return settings;
}

function assicuraMigrazioneFiltri(settings) {
  if (!settings) return settings;
  if (!Array.isArray(settings.filtriCatalogo) || settings.filtriCatalogo.length === 0) {
    settings.filtriCatalogo = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.filtriCatalogo));
  }
  return settings;
}

function assicuraMigrazioneRegoleImportazioneJson(settings) {
  if (!settings) return settings;
  if (!Array.isArray(settings.regoleImportazioneJson) || settings.regoleImportazioneJson.length === 0) {
    settings.regoleImportazioneJson = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.regoleImportazioneJson));
  }
  return settings;
}

async function loadSettingsFromSupabase() {
  const settings = {
    prezziPredefiniti: { ...DEFAULT_SETTINGS.prezziPredefiniti },
    regolePrezzi: { ...DEFAULT_SETTINGS.regolePrezzi },
    spedizioneLotto: { ...DEFAULT_SETTINGS.spedizioneLotto },
    cambioValuta: { ...DEFAULT_SETTINGS.cambioValuta },
    alibabaFee: { ...DEFAULT_SETTINGS.alibabaFee },
    contatti: { ...DEFAULT_SETTINGS.contatti },
    valoriPredefiniti: { ...DEFAULT_SETTINGS.valoriPredefiniti },
    sicurezza: { ...DEFAULT_SETTINGS.sicurezza },
    categorie: JSON.parse(JSON.stringify(DEFAULT_SETTINGS.categorie)),
    filtriCatalogo: JSON.parse(JSON.stringify(DEFAULT_SETTINGS.filtriCatalogo)),
    regoleImportazioneJson: JSON.parse(JSON.stringify(DEFAULT_SETTINGS.regoleImportazioneJson))
  };

  // 1. Carica prima le impostazioni da file locale se esistente come fallback
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      Object.keys(settings).forEach(key => {
        if (data[key] !== undefined) {
          if (key === 'sicurezza' && typeof data[key] === 'object') {
            settings.sicurezza = {
              conferma_elimina_prodotto: data[key].conferma_elimina_prodotto !== undefined ? data[key].conferma_elimina_prodotto : DEFAULT_SETTINGS.sicurezza.conferma_elimina_prodotto,
              conferma_elimina_ordine: data[key].conferma_elimina_ordine !== undefined ? data[key].conferma_elimina_ordine : DEFAULT_SETTINGS.sicurezza.conferma_elimina_ordine,
              conferma_elimina_recensione: data[key].conferma_elimina_recensione !== undefined ? data[key].conferma_elimina_recensione : DEFAULT_SETTINGS.sicurezza.conferma_elimina_recensione
            };
          } else {
            settings[key] = data[key];
          }
        }
      });
    }
  } catch (err) {
    console.error("⚠️ Errore lettura settings.json:", err.message);
  }

  // 2. Se Supabase è collegato, scarica e sincronizza le impostazioni salvate nel DB
  const supabase = getSupabaseClient();
  if (supabase) {
    // A) Caricamento configurazione catalogo da catalog_settings (UNICA FONTE DI VERITÀ)
    try {
      console.log("[DEBUG] Caricamento configurazione catalogo da Supabase (tabella 'catalog_settings')...");
      const { data: catalogData, error: catErr } = await supabase.from('catalog_settings').select('*');

      const catalogMap = {};
      if (!catErr && Array.isArray(catalogData)) {
        catalogData.forEach(row => {
          if (row.key) {
            catalogMap[row.key] = row.value;
          }
        });
      } else if (catErr) {
        console.warn("⚠️ Errore lettura 'catalog_settings' da Supabase:", catErr.message);
      }

      // Verifichiamo se occorre effettuare la MIGRAZIONE AUTOMATICA iniziale (se catalog_settings è vuoto o non contiene dati)
      const keysToMigrate = ['categorie', 'filtriCatalogo', 'regoleImportazioneJson'];
      const missingOrEmptyKeys = keysToMigrate.filter(k => 
        !catalogMap[k] || (Array.isArray(catalogMap[k]) && catalogMap[k].length === 0)
      );

      if (missingOrEmptyKeys.length > 0) {
        console.log(`[DEBUG] Rilevate chiavi mancanti o vuote in 'catalog_settings': [${missingOrEmptyKeys.join(', ')}]. Avvio migrazione automatica da settings.json...`);
        const nowIso = new Date().toISOString();
        const rowsToUpsert = [];

        keysToMigrate.forEach(k => {
          const valToSave = (catalogMap[k] && Array.isArray(catalogMap[k]) && catalogMap[k].length > 0)
            ? catalogMap[k]
            : (settings[k] && Array.isArray(settings[k]) && settings[k].length > 0 ? settings[k] : DEFAULT_SETTINGS[k]);
          
          rowsToUpsert.push({
            key: k,
            value: valToSave,
            updated_at: nowIso
          });
          catalogMap[k] = valToSave;
        });

        const { error: upsertMigErr } = await supabase.from('catalog_settings').upsert(rowsToUpsert, { onConflict: 'key' });
        if (upsertMigErr) {
          console.error("⚠️ Errore durante la migrazione automatica iniziale in 'catalog_settings':", upsertMigErr.message);
        } else {
          console.log("✅ Migrazione automatica in 'catalog_settings' completata con successo su Supabase!");
        }
      }

      // Applicazione configurazione catalogo da catalog_settings (UNICA FONTE DI VERITÀ)
      if (Array.isArray(catalogMap.categorie)) {
        settings.categorie = catalogMap.categorie;
      }
      if (Array.isArray(catalogMap.filtriCatalogo)) {
        settings.filtriCatalogo = catalogMap.filtriCatalogo;
      }
      if (Array.isArray(catalogMap.regoleImportazioneJson)) {
        settings.regoleImportazioneJson = catalogMap.regoleImportazioneJson;
      }
      if (catalogMap.sicurezza && typeof catalogMap.sicurezza === 'object') {
        settings.sicurezza = {
          conferma_elimina_prodotto: catalogMap.sicurezza.conferma_elimina_prodotto !== undefined
            ? catalogMap.sicurezza.conferma_elimina_prodotto
            : (settings.sicurezza?.conferma_elimina_prodotto !== undefined ? settings.sicurezza.conferma_elimina_prodotto : DEFAULT_SETTINGS.sicurezza.conferma_elimina_prodotto),
          conferma_elimina_ordine: catalogMap.sicurezza.conferma_elimina_ordine !== undefined
            ? catalogMap.sicurezza.conferma_elimina_ordine
            : (settings.sicurezza?.conferma_elimina_ordine !== undefined ? settings.sicurezza.conferma_elimina_ordine : DEFAULT_SETTINGS.sicurezza.conferma_elimina_ordine),
          conferma_elimina_recensione: catalogMap.sicurezza.conferma_elimina_recensione !== undefined
            ? catalogMap.sicurezza.conferma_elimina_recensione
            : (settings.sicurezza?.conferma_elimina_recensione !== undefined ? settings.sicurezza.conferma_elimina_recensione : DEFAULT_SETTINGS.sicurezza.conferma_elimina_recensione)
        };
      }

    } catch (eCat) {
      console.error("⚠️ Eccezione durante il caricamento da catalog_settings:", eCat.message);
    }

    // B) Sync price rules from 'price_rules'
    try {
      console.log("[DEBUG] Syncing price rules from Supabase table 'price_rules'...");
      // Pulisce eventuali chiavi speciali legacy non appartenenti a price_rules
      try {
        await supabase.from('price_rules').delete().like('categoria', '__%');
      } catch (e) {}

      const { data, error } = await supabase.from('price_rules').select('*');
      if (!error && Array.isArray(data) && data.length > 0) {
        data.forEach(row => {
          if (row.categoria && !row.categoria.startsWith('__')) {
            const key = `${row.categoria}_${row.target}`;
            settings.regolePrezzi[key] = parseFloat(row.prezzo);
          }
        });
        console.log(`[DEBUG] Loaded ${data.length} price rules from Supabase successfully.`);
      }
    } catch (e) {
      console.error("⚠️ Exception loading price rules from Supabase:", e.message);
    }
  }

  assicuraMigrazioneCategorie(settings);
  assicuraMigrazioneFiltri(settings);
  assicuraMigrazioneRegoleImportazioneJson(settings);

  cachedSettings = settings;
  return settings;
}

function getSettings() {
  if (cachedSettings) {
    return cachedSettings;
  }
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      const secData = (data && typeof data.sicurezza === 'object') ? data.sicurezza : {};
      cachedSettings = {
        prezziPredefiniti: { ...DEFAULT_SETTINGS.prezziPredefiniti, ...(data.prezziPredefiniti || {}) },
        regolePrezzi: { ...DEFAULT_SETTINGS.regolePrezzi, ...(data.regolePrezzi || {}) },
        spedizioneLotto: { ...DEFAULT_SETTINGS.spedizioneLotto, ...(data.spedizioneLotto || {}) },
        cambioValuta: { ...DEFAULT_SETTINGS.cambioValuta, ...(data.cambioValuta || {}) },
        alibabaFee: { ...DEFAULT_SETTINGS.alibabaFee, ...(data.alibabaFee || {}) },
        contatti: { ...DEFAULT_SETTINGS.contatti, ...(data.contatti || {}) },
        valoriPredefiniti: { ...DEFAULT_SETTINGS.valoriPredefiniti, ...(data.valoriPredefiniti || {}) },
        sicurezza: {
          conferma_elimina_prodotto: secData.conferma_elimina_prodotto !== undefined ? secData.conferma_elimina_prodotto : DEFAULT_SETTINGS.sicurezza.conferma_elimina_prodotto,
          conferma_elimina_ordine: secData.conferma_elimina_ordine !== undefined ? secData.conferma_elimina_ordine : DEFAULT_SETTINGS.sicurezza.conferma_elimina_ordine,
          conferma_elimina_recensione: secData.conferma_elimina_recensione !== undefined ? secData.conferma_elimina_recensione : DEFAULT_SETTINGS.sicurezza.conferma_elimina_recensione
        },
        categorie: Array.isArray(data.categorie) ? data.categorie : JSON.parse(JSON.stringify(DEFAULT_SETTINGS.categorie)),
        filtriCatalogo: Array.isArray(data.filtriCatalogo) ? data.filtriCatalogo : JSON.parse(JSON.stringify(DEFAULT_SETTINGS.filtriCatalogo)),
        regoleImportazioneJson: Array.isArray(data.regoleImportazioneJson) ? data.regoleImportazioneJson : JSON.parse(JSON.stringify(DEFAULT_SETTINGS.regoleImportazioneJson))
      };
      assicuraMigrazioneCategorie(cachedSettings);
      assicuraMigrazioneFiltri(cachedSettings);
      assicuraMigrazioneRegoleImportazioneJson(cachedSettings);
      return cachedSettings;
    }
  } catch (err) {
    console.error("⚠️ Errore lettura settings.json:", err.message);
  }
  cachedSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  assicuraMigrazioneCategorie(cachedSettings);
  assicuraMigrazioneFiltri(cachedSettings);
  assicuraMigrazioneRegoleImportazioneJson(cachedSettings);
  return cachedSettings;
}

function saveSettings(settings) {
  try {
    // Le impostazioni vengono conservate nella cache in memoria e sincronizzate su file locale e Supabase.
    cachedSettings = JSON.parse(JSON.stringify(settings));
    try {
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(cachedSettings, null, 2), 'utf8');
    } catch (fsErr) {
      console.warn("⚠️ Impossibile scrivere settings.json:", fsErr.message);
    }
    return true;
  } catch (err) {
    console.error("⚠️ Errore aggiornamento in memoria delle impostazioni:", err.message);
    return false;
  }
}

// ==========================================
// SUPABASE HELPERS & API - GESTIONE DUPLICATI AUTORIZZATI (catalog_duplicate_exceptions)
// ==========================================

async function getDuplicateExceptionsFromSupabase() {
  const supabase = getSupabaseClient();
  if (supabase) {
    // 1. Prova a leggere dalla tabella nativa 'catalog_duplicate_exceptions'
    try {
      const { data, error } = await supabase
        .from('catalog_duplicate_exceptions')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        return data;
      }
    } catch (e) {
      console.warn("⚠️ Query catalog_duplicate_exceptions fallita, proseguo con fallback catalog_settings:", e.message);
    }

    // 2. Fallback su catalog_settings key = 'catalog_duplicate_exceptions'
    try {
      const { data: sData, error: sErr } = await supabase
        .from('catalog_settings')
        .select('value')
        .eq('key', 'catalog_duplicate_exceptions')
        .maybeSingle();

      if (!sErr && sData && Array.isArray(sData.value)) {
        return sData.value;
      }
    } catch (e2) {}
  }
  return [];
}

async function saveDuplicateExceptionInSupabase(urlNormalized) {
  const normUrl = String(urlNormalized || '').split('#')[0].trim().toLowerCase();
  if (!normUrl) throw new Error("URL immagine non valido per la normalizzazione");

  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  if (supabase) {
    let savedObj = null;

    // 1. Prova inserimento in tabella nativa catalog_duplicate_exceptions
    try {
      const { data, error } = await supabase
        .from('catalog_duplicate_exceptions')
        .upsert([{ image_url_normalized: normUrl, created_at: now }], { onConflict: 'image_url_normalized' })
        .select('*')
        .single();

      if (!error && data) {
        savedObj = data;
      }
    } catch (e) {
      console.warn("⚠️ Upsert in catalog_duplicate_exceptions fallito, eseguo fallback catalog_settings:", e.message);
    }

    // 2. Salva o sincronizza sempre anche su catalog_settings (garantisce persistenza anche senza DDL)
    try {
      let exceptions = await getDuplicateExceptionsFromSupabase();
      const existingIdx = exceptions.findIndex(ex => ex.image_url_normalized === normUrl);
      if (existingIdx >= 0) {
        if (!savedObj) savedObj = exceptions[existingIdx];
      } else {
        if (!savedObj) {
          savedObj = {
            id: Date.now(),
            image_url_normalized: normUrl,
            created_at: now
          };
        }
        exceptions.unshift(savedObj);
      }
      await supabase.from('catalog_settings').upsert({
        key: 'catalog_duplicate_exceptions',
        value: exceptions,
        updated_at: now
      }, { onConflict: 'key' });

      return savedObj;
    } catch (e2) {
      console.error("⚠️ Fallback salvataggio eccezione duplicati fallito:", e2.message);
      if (savedObj) return savedObj;
      throw e2;
    }
  }

  return { id: Date.now(), image_url_normalized: normUrl, created_at: now };
}

async function deleteDuplicateExceptionFromSupabase(identifier) {
  const supabase = getSupabaseClient();
  const identifierStr = String(identifier || '').trim();
  const normUrl = (identifierStr.includes('http') || identifierStr.includes('.'))
    ? identifierStr.split('#')[0].trim().toLowerCase()
    : null;

  if (supabase) {
    // 1. Prova cancellazione da tabella nativa catalog_duplicate_exceptions
    try {
      if (normUrl) {
        await supabase.from('catalog_duplicate_exceptions').delete().eq('image_url_normalized', normUrl);
      } else if (!isNaN(Number(identifierStr))) {
        await supabase.from('catalog_duplicate_exceptions').delete().eq('id', Number(identifierStr));
      }
    } catch (e) {}

    // 2. Sincronizza cancellazione su fallback catalog_settings
    try {
      let exceptions = await getDuplicateExceptionsFromSupabase();
      exceptions = exceptions.filter(ex => {
        if (normUrl && ex.image_url_normalized === normUrl) return false;
        if (String(ex.id) === identifierStr) return false;
        return true;
      });
      await supabase.from('catalog_settings').upsert({
        key: 'catalog_duplicate_exceptions',
        value: exceptions,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });
    } catch (e2) {}
  }
}

// GET /api/catalog/duplicate-exceptions - Elenco eccezioni duplicati autorizzati da Supabase
app.get('/api/catalog/duplicate-exceptions', async (req, res) => {
  try {
    const exceptions = await getDuplicateExceptionsFromSupabase();
    res.json({ success: true, exceptions });
  } catch (err) {
    console.error("⚠️ Errore lettura eccezioni duplicati:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/catalog/duplicate-exceptions - Autorizza un duplicato intenzionale salvandolo su Supabase
app.post('/api/catalog/duplicate-exceptions', async (req, res) => {
  try {
    const { image_url_normalized, url } = req.body || {};
    const targetUrl = image_url_normalized || url;
    if (!targetUrl) {
      return res.status(400).json({ success: false, error: "URL immagine mancante" });
    }
    const saved = await saveDuplicateExceptionInSupabase(targetUrl);
    res.json({ success: true, exception: saved });
  } catch (err) {
    console.error("⚠️ Errore salvataggio eccezione duplicato:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/catalog/duplicate-exceptions/:id - Revoca autorizzazione duplicato da Supabase
app.delete('/api/catalog/duplicate-exceptions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await deleteDuplicateExceptionFromSupabase(id);
    res.json({ success: true });
  } catch (err) {
    console.error("⚠️ Errore eliminazione eccezione duplicato:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/catalog/duplicate-exceptions - Revoca via Query Parameter (?url=... o ?id=...)
app.delete('/api/catalog/duplicate-exceptions', async (req, res) => {
  try {
    const { id, url, image_url_normalized } = req.query || {};
    const identifier = id || url || image_url_normalized;
    if (!identifier) {
      return res.status(400).json({ success: false, error: "Identificatore eccezione mancante" });
    }
    await deleteDuplicateExceptionFromSupabase(identifier);
    res.json({ success: true });
  } catch (err) {
    console.error("⚠️ Errore eliminazione eccezione duplicato:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/settings - Ottieni le impostazioni correnti o predefinite
app.get('/api/settings', async (req, res) => {
  console.log(">>> ENTRATA GET /api/settings");
  try {
    const currentSettings = await loadSettingsFromSupabase();
    res.json({ success: true, settings: currentSettings });
  } catch (err) {
    console.error("⚠️ Errore durante il caricamento delle impostazioni:", err.message);
    res.json({ success: true, settings: getSettings() });
  }
});

// POST /api/settings - Salva le nuove impostazioni e opzionalmente effettua l'aggiornamento massivo dei prezzi
app.post('/api/settings', async (req, res) => {
  console.log(">>> ENTRATA POST /api/settings");
  let summary = "";
  try {
    const { applyToExisting, settings, targetPairsToUpdate } = req.body;
    console.log("Payload ricevuto:", { applyToExisting, hasSettings: !!settings, targetPairsCount: targetPairsToUpdate ? targetPairsToUpdate.length : 0 });
    
    let settingsToSave = settings || req.body;
    
    // Per evitare problemi di destrutturazione o se inviamo solo trigger di applicazione
    if (applyToExisting && (!settingsToSave || !settingsToSave.regolePrezzi)) {
      settingsToSave = getSettings();
    }

    // Rimuovi proprietà speciali prima del salvataggio su file
    const settingsCopy = JSON.parse(JSON.stringify(settingsToSave));
    delete settingsCopy.applyToExisting;
    delete settingsCopy.targetPairsToUpdate;
    
    const success = saveSettings(settingsCopy);
    if (!success) {
      console.log("<<< USCITA POST /api/settings con errore di scrittura file");
      return res.status(500).json({ success: false, error: "Errore durante il salvataggio delle impostazioni locale." });
    }

    const supabase = getSupabaseClient();

    if (supabase) {
      // 1. Salva la configurazione del catalogo su Supabase nella tabella 'catalog_settings'
      try {
        const nowIso = new Date().toISOString();
        const catalogRowsToUpsert = [
          { key: 'categorie', value: settingsCopy.categorie || [], updated_at: nowIso },
          { key: 'filtriCatalogo', value: settingsCopy.filtriCatalogo || [], updated_at: nowIso },
          { key: 'regoleImportazioneJson', value: settingsCopy.regoleImportazioneJson || [], updated_at: nowIso }
        ];

        if (settingsCopy.sicurezza !== undefined) {
          catalogRowsToUpsert.push({
            key: 'sicurezza',
            value: settingsCopy.sicurezza,
            updated_at: nowIso
          });
        }

        console.log("[DEBUG] Salvo la configurazione catalogo (categorie, filtriCatalogo, regoleImportazioneJson) su Supabase tabella 'catalog_settings'...");
        const { error: catUpsertErr } = await supabase.from('catalog_settings').upsert(catalogRowsToUpsert, { onConflict: 'key' });
        if (catUpsertErr) {
          console.error("⚠️ Errore salvataggio 'catalog_settings' su Supabase:", catUpsertErr.message);
        } else {
          console.log("✅ Configurazione catalogo salvata con successo in 'catalog_settings' su Supabase.");
        }
      } catch (eCat) {
        console.error("⚠️ Eccezione durante il salvataggio in catalog_settings:", eCat.message);
      }

      // 2. Salva le regole prezzi su Supabase nella tabella 'price_rules'
      console.log("[DEBUG] Salvo le regole prezzi (categoria, target, prezzo) su Supabase...");
      
      try {
        await supabase.from('price_rules').delete().like('categoria', '__%');
      } catch (e) {}

      const rulesToUpsert = [];

      // Dalle categorie definite
      if (Array.isArray(settingsCopy.categorie)) {
        settingsCopy.categorie.forEach(cat => {
          if (cat.nome) {
            rulesToUpsert.push({ categoria: cat.nome, target: 'Adulto', prezzo: parseFloat(cat.prezzo_adulto) || 23.99 });
            rulesToUpsert.push({ categoria: cat.nome, target: 'Bambino', prezzo: parseFloat(cat.prezzo_bambino) || 19.99 });
          }
        });
      }

      // Eventuali regole aggiuntive in regolePrezzi
      if (settingsCopy.regolePrezzi) {
        for (const [key, val] of Object.entries(settingsCopy.regolePrezzi)) {
          const parts = key.split('_');
          if (parts.length === 2) {
            const exists = rulesToUpsert.some(r => r.categoria === parts[0] && r.target === parts[1]);
            if (!exists) {
              rulesToUpsert.push({ categoria: parts[0], target: parts[1], prezzo: parseFloat(val) || 23.99 });
            }
          }
        }
      }

      if (rulesToUpsert.length > 0) {
        console.log(`[DEBUG] Upserting ${rulesToUpsert.length} regole prezzi in Supabase...`);
        const { error: upsertError } = await supabase.from('price_rules').upsert(rulesToUpsert);
        if (upsertError) {
          console.error("⚠️ Errore salvataggio regole prezzi su Supabase:", upsertError.message);
        } else {
          console.log("✅ Regole prezzi salvate permanentemente su Supabase.");
        }
      }
    }

    const currentSettings = await loadSettingsFromSupabase();

    if (applyToExisting) {
      // Carichiamo le regole di prezzo salvate (dal DB o da settings.json)
      let rulesToUse = settingsToSave.regolePrezzi || {};
      
      if (supabase) {
        console.log("[DEBUG] Carico le regole prezzi salvate dal database per l'applicazione...");
        const { data: dbRules, error: dbRulesError } = await supabase.from('price_rules').select('*');
        if (!dbRulesError && dbRules && dbRules.length > 0) {
          rulesToUse = {};
          dbRules.forEach(row => {
            const key = `${row.categoria}_${row.target}`;
            rulesToUse[key] = parseFloat(row.prezzo);
          });
          console.log("[DEBUG] Regole prezzi lette dal database con successo per applicazione massiva.");
        } else if (dbRulesError) {
          console.warn("⚠️ Impossibile leggere regole da Supabase per l'applicazione, uso fallback locale:", dbRulesError.message);
        }
      }

      // Costruiamo i target pairs da aggiornare
      const pairsToUpdate = [];
      for (const [key, val] of Object.entries(rulesToUse)) {
        const parts = key.split('_');
        if (parts.length === 2) {
          pairsToUpdate.push({
            categoria: parts[0],
            target: parts[1],
            prezzo: parseFloat(val) || 23.99
          });
        }
      }

      try {
        const counts = {};
        const catsList = (settingsToSave.categorie && settingsToSave.categorie.length > 0) 
          ? settingsToSave.categorie 
          : (currentSettings.categorie || DEFAULT_SETTINGS.categorie);

        catsList.forEach(c => {
          counts[`${c.nome}_Adulto`] = 0;
          counts[`${c.nome}_Bambino`] = 0;
        });

        if (supabase) {
          const { data: dbProducts, error: fetchError } = await supabase.from('products').select('*');
          if (fetchError) {
            console.error("Errore fetch prodotti da Supabase:", fetchError);
          }
          if (!fetchError && dbProducts) {
            // Contiamo i prodotti corrispondenti per ciascuna coppia
            dbProducts.forEach(p => {
              let pCat = normalizzaCategoria(p.categoria);
              let pTarget = p.target;
              
              if (pCat === "Kit" && (p.categoria === "Kit Bambino" || (p.target && p.target.toLowerCase() === 'bambino'))) {
                pTarget = "Bambino";
              }
              if (!pTarget) {
                const textToCheck = `${p.squadra || ''} ${p.versione || ''} ${pCat}`.toLowerCase();
                if (textToCheck.includes('kids') || textToCheck.includes('bambino') || textToCheck.includes('child') || textToCheck.includes('youth')) {
                  pTarget = "Bambino";
                } else {
                  pTarget = "Adulto";
                }
              }
              
              const key = `${pCat}_${pTarget}`;
              if (counts[key] !== undefined) {
                counts[key]++;
              } else {
                counts[key] = (counts[key] || 0) + 1;
              }
            });

            // Ora effettuiamo le query di aggiornamento massivo per ciascuna regola caricata
            for (const pair of pairsToUpdate) {
              const { categoria, target, prezzo } = pair;
              const normCat = normalizzaCategoria(categoria);
              
              // Aggiorna prodotti con categoria e target specificati
              await supabase.from('products')
                .update({ prezzo })
                .eq('categoria', normCat)
                .eq('target', target);

              // Per retrocompatibilità, se categoria è "Kit" e target è "Bambino", aggiorna anche i prodotti con la vecchia categoria "Kit Bambino"
              if (normCat === "Kit" && target === "Bambino") {
                await supabase.from('products')
                  .update({ prezzo })
                  .eq('categoria', 'Kit Bambino');
              }
            }
          }
        } else if (fs.existsSync(LOCAL_PRODUCTS_FILE)) {
          let localProds = JSON.parse(fs.readFileSync(LOCAL_PRODUCTS_FILE, 'utf8'));
          
          // Contiamo prima i prodotti corrispondenti
          localProds.forEach(p => {
            let pCat = normalizzaCategoria(p.categoria);
            let pTarget = p.target;
            
            if (pCat === "Kit" && (p.categoria === "Kit Bambino" || (p.target && p.target.toLowerCase() === 'bambino'))) {
              pTarget = "Bambino";
            }
            if (!pTarget) {
              const textToCheck = `${p.squadra || ''} ${p.versione || ''} ${pCat}`.toLowerCase();
              if (textToCheck.includes('kids') || textToCheck.includes('bambino') || textToCheck.includes('child') || textToCheck.includes('youth')) {
                pTarget = "Bambino";
              } else {
                pTarget = "Adulto";
              }
            }
            
            const key = `${pCat}_${pTarget}`;
            if (counts[key] !== undefined) {
              counts[key]++;
            } else {
              counts[key] = (counts[key] || 0) + 1;
            }
          });

          // Ora aggiorniamo i prezzi localmente
          for (const pair of pairsToUpdate) {
            const { categoria, target, prezzo } = pair;
            const normCat = normalizzaCategoria(categoria);
            
            localProds = localProds.map(p => {
              let pCat = normalizzaCategoria(p.categoria);
              let pTarget = p.target;
              
              if (pCat === "Kit" && (p.categoria === "Kit Bambino" || (p.target && p.target.toLowerCase() === 'bambino'))) {
                pTarget = "Bambino";
              }
              if (!pTarget) {
                const textToCheck = `${p.squadra || ''} ${p.versione || ''} ${pCat}`.toLowerCase();
                if (textToCheck.includes('kids') || textToCheck.includes('bambino') || textToCheck.includes('child') || textToCheck.includes('youth')) {
                  pTarget = "Bambino";
                } else {
                  pTarget = "Adulto";
                }
              }
              
              if (pCat === normCat && pTarget === target) {
                return { ...p, prezzo };
              }
              return p;
            });
          }
          fs.writeFileSync(LOCAL_PRODUCTS_FILE, JSON.stringify(localProds, null, 2), 'utf8');
        }

        // Costruiamo il riepilogo
        const formatLine = (label, count) => {
          return `${label}\n${count} prodott${count === 1 ? 'o aggiornato' : 'i aggiornati'}${count === 0 ? ' (nessun prodotto corrispondente)' : ''}\n--------------------------------`;
        };

        const lines = [];
        catsList.forEach(c => {
          lines.push(formatLine(`${c.nome} Adulto`, counts[`${c.nome}_Adulto`] || 0));
          lines.push(formatLine(`${c.nome} Bambino`, counts[`${c.nome}_Bambino`] || 0));
        });

        const totalUpdated = Object.values(counts).reduce((a, b) => a + b, 0);
        summary = lines.join("\n") + `\nTotale prodotti aggiornati:\n${totalUpdated}`;

        console.log("\n=================================================");
        console.log("RIEPILOGO AGGIORNAMENTO MASSIVO PREZZI (STORED RULES)");
        console.log("=================================================");
        console.log(summary);
        console.log("=================================================\n");

      } catch (err) {
        console.error("⚠️ Errore durante l'aggiornamento massivo dei prezzi:", err.message);
        summary = "Errore durante l'aggiornamento massivo: " + err.message;
      }
    }

    console.log("<<< USCITA POST /api/settings con successo");
    // Ricalcola il lotto e tutti gli ordini attivi con le nuove impostazioni (cambio valuta o fasce spedizione)
    try {
      await recalculateCurrentLotto();
    } catch (lottoErr) {
      console.warn("⚠️ Errore ricalcolo lotto dopo aggiornamento settings:", lottoErr.message);
    }

    // Ritorniamo i settings più aggiornati possibili (compresi quelli da DB se letti)
    const finalSettings = getSettings();
    if (supabase) {
      try {
        const { data } = await supabase.from('price_rules').select('*');
        if (data && data.length > 0) {
          data.forEach(row => {
            const key = `${row.categoria}_${row.target}`;
            finalSettings.regolePrezzi[key] = parseFloat(row.prezzo);
          });
        }
      } catch (e) {}
    }
    return res.json({ success: true, settings: finalSettings, summary: summary });
  } catch (error) {
    console.error("🔴 ERRORE FATALE IN POST /api/settings:", error);
    return res.status(500).json({ success: false, error: "Si è verificato un errore interno: " + error.message });
  }
});

// ==========================================
// API GESTIONE MARKETING PROMO HOME
// ==========================================

const LOCAL_PROMOS_FILE = path.join(__dirname, 'marketing_promos_local.json');

function getLocalPromos() {
  if (fs.existsSync(LOCAL_PROMOS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(LOCAL_PROMOS_FILE, 'utf8'));
    } catch (e) {
      console.error("Errore lettura local promos file:", e.message);
      return [];
    }
  }
  return [];
}

function saveLocalPromos(promos) {
  try {
    fs.writeFileSync(LOCAL_PROMOS_FILE, JSON.stringify(promos, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error("Errore salvataggio local promos file:", e.message);
    return false;
  }
}

// GET /api/marketing-promos - Leggi tutte le promo
app.get('/api/marketing-promos', async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase
        .from('marketing_promos')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        return res.json({ success: true, promos: data });
      }
    }
    return res.json({ success: true, promos: getLocalPromos() });
  } catch (err) {
    console.error("⚠️ Errore caricamento promos:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/marketing-promos/active - Leggi la promo attiva per la Home
app.get('/api/marketing-promos/active', async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase
        .from('marketing_promos')
        .select('*')
        .eq('pagina', 'home')
        .eq('attiva', true)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      if (data && data.length > 0) {
        return res.json({ success: true, promo: data[0] });
      }
    }
    
    // Fallback local file
    const local = getLocalPromos();
    const activeLocal = local.find(p => p.pagina === 'home' && p.attiva === true);
    return res.json({ success: true, promo: activeLocal || null });
  } catch (err) {
    console.error("⚠️ Errore caricamento promo attiva:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/marketing-promos - Salva o aggiorna una promo
app.post('/api/marketing-promos', async (req, res) => {
  try {
    const payload = req.body;
    const {
      id,
      attiva,
      pagina = 'home',
      badge,
      titolo,
      sottotitolo,
      descrizione,
      immagine,
      bottone_testo,
      bottone_link,
      codice_sconto,
      tema,
      mostra_timer,
      posizione,
      data_inizio,
      data_fine
    } = payload;

    const promoData = {
      attiva: Boolean(attiva),
      pagina,
      badge: badge || '',
      titolo: titolo || '',
      sottotitolo: sottotitolo || '',
      descrizione: descrizione || '',
      immagine: immagine || '',
      bottone_testo: bottone_testo || '',
      bottone_link: bottone_link || '',
      codice_sconto: codice_sconto || '',
      tema: tema || 'gold',
      mostra_timer: Boolean(mostra_timer),
      posizione: posizione || 'right',
      data_inizio,
      data_fine,
      updated_at: new Date().toISOString()
    };

    const supabase = getSupabaseClient();
    let savedPromo = null;

    if (supabase) {
      // Cerca se esiste già un record per questa pagina
      let existingId = id;
      if (!existingId) {
        const { data: existing, error: checkErr } = await supabase
          .from('marketing_promos')
          .select('id')
          .eq('pagina', pagina)
          .limit(1);
        if (!checkErr && existing && existing.length > 0) {
          existingId = existing[0].id;
        }
      }

      if (existingId) {
        // Update
        const { data, error } = await supabase
          .from('marketing_promos')
          .update(promoData)
          .eq('id', existingId)
          .select();
        if (error) throw error;
        savedPromo = data && data[0];
      } else {
        // Insert
        const { data, error } = await supabase
          .from('marketing_promos')
          .insert([{ ...promoData, created_at: new Date().toISOString() }])
          .select();
        if (error) throw error;
        savedPromo = data && data[0];
      }
    }

    // Sync local file too for full resilience!
    const localPromos = getLocalPromos();
    const existingIdx = localPromos.findIndex(p => p.pagina === pagina);
    const localPromoData = {
      id: savedPromo ? savedPromo.id : (id || 'local-home-promo'),
      ...promoData,
      created_at: savedPromo ? savedPromo.created_at : new Date().toISOString()
    };
    if (existingIdx > -1) {
      localPromos[existingIdx] = localPromoData;
    } else {
      localPromos.push(localPromoData);
    }
    saveLocalPromos(localPromos);

    return res.json({ success: true, promo: savedPromo || localPromoData });
  } catch (err) {
    console.error("⚠️ Errore salvataggio promo:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/settings/teams/rename - Rinomina una squadra in tutti i prodotti e nel catalogo squadre
app.post('/api/settings/teams/rename', async (req, res) => {
  try {
    const { oldName, newName } = req.body;
    if (!oldName || !newName) {
      return res.status(400).json({ success: false, error: "Nome vecchio e nuovo richiesti." });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      if (fs.existsSync(LOCAL_PRODUCTS_FILE)) {
        let products = JSON.parse(fs.readFileSync(LOCAL_PRODUCTS_FILE, 'utf8'));
        let updatedCount = 0;
        products = products.map(p => {
          if (p.squadra === oldName) {
            updatedCount++;
            return { ...p, squadra: newName };
          }
          return p;
        });
        fs.writeFileSync(LOCAL_PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf8');

        // Aggiorna anche il catalogo squadre locale
        let teams = getLocalTeams();
        teams = teams.map(t => t.name === oldName ? { ...t, name: newName } : t);
        saveLocalTeams(teams);

        return res.json({ success: true, count: updatedCount, message: `Rinominate ${updatedCount} squadre nel file locale.` });
      }
      throw new Error("Supabase non è configurato.");
    }

    // 1. Aggiorna la tabella prodotti
    const { data, error } = await supabase
      .from('products')
      .update({ squadra: newName })
      .eq('squadra', oldName)
      .select();

    if (error) throw error;

    // 2. Aggiorna la tabella teams
    const { error: teamUpdateError } = await supabase
      .from('teams')
      .update({ name: newName })
      .eq('name', oldName);

    if (teamUpdateError) {
      console.warn("⚠️ Attenzione: errore aggiornamento tabella teams:", teamUpdateError.message);
    }

    return res.json({ success: true, count: data ? data.length : 0 });
  } catch (err) {
    console.error("⚠️ Errore rinomina squadra:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/settings/teams/delete - Elimina una squadra se non ha prodotti collegati
app.post('/api/settings/teams/delete', async (req, res) => {
  try {
    const { teamName } = req.body;
    if (!teamName) {
      return res.status(400).json({ success: false, error: "Nome squadra richiesto." });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      if (fs.existsSync(LOCAL_PRODUCTS_FILE)) {
        let products = JSON.parse(fs.readFileSync(LOCAL_PRODUCTS_FILE, 'utf8'));
        const linkedProducts = products.filter(p => p.squadra === teamName);
        if (linkedProducts.length > 0) {
          return res.status(400).json({ 
            success: false, 
            error: `Questa squadra contiene ancora ${linkedProducts.length} prodotti e non può essere eliminata.` 
          });
        }

        // Elimina dal catalogo squadre locale
        let teams = getLocalTeams();
        teams = teams.filter(t => t.name !== teamName);
        saveLocalTeams(teams);

        return res.json({ success: true, message: `Squadra "${teamName}" eliminata.` });
      }
      throw new Error("Supabase non è configurato.");
    }

    // Double check with Supabase
    const { data: linkedProducts, error: fetchError } = await supabase
      .from('products')
      .select('id')
      .eq('squadra', teamName);

    if (fetchError) throw fetchError;

    if (linkedProducts && linkedProducts.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: `Questa squadra contiene ancora ${linkedProducts.length} prodotti e non può essere eliminata.` 
      });
    }

    // Elimina dalla tabella teams
    const { error: deleteError } = await supabase
      .from('teams')
      .delete()
      .eq('name', teamName);

    if (deleteError) {
      console.warn("⚠️ Attenzione: errore eliminazione tabella teams:", deleteError.message);
    }

    return res.json({ success: true, message: `Squadra "${teamName}" eliminata.` });
  } catch (err) {
    console.error("⚠️ Errore eliminazione squadra:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/settings/products/import - Importa array di prodotti direttamente con validazione
app.post('/api/settings/products/import', async (req, res) => {
  try {
    const { products } = req.body;
    if (!Array.isArray(products)) {
      return res.status(400).json({ success: false, error: "I dati devono essere un array di prodotti." });
    }

    const supabase = getSupabaseClient();
    const { squadreValide, campionatiValidi } = await ottieniListeValidazione(supabase);

    // Recupera la lista di tutte le squadre già presenti nel database per la normalizzazione
    let squadreEsistenti = [];
    if (supabase) {
      try {
        const { data: dbProds, error: dbError } = await supabase.from('products').select('squadra');
        if (!dbError && dbProds) {
          squadreEsistenti = [...new Set(dbProds.map(p => p.squadra).filter(Boolean))];
        }
      } catch (e) {
        console.error("⚠️ Errore lettura squadre in import:", e.message);
      }
    } else if (fs.existsSync(LOCAL_PRODUCTS_FILE)) {
      try {
        const localData = JSON.parse(fs.readFileSync(LOCAL_PRODUCTS_FILE, 'utf8'));
        squadreEsistenti = [...new Set(localData.map(p => p.squadra).filter(Boolean))];
      } catch (e) {
        console.error("⚠️ Errore lettura squadre locali in import:", e.message);
      }
    }

    const validProducts = [];
    const erroriDettagli = [];
    let countErrori = 0;
    const seenIds = new Set();

    products.forEach((p, index) => {
      const riga = index + 1;
      
      // Allinea ID se mancante
      if (p.id === undefined && p.legacy_id !== undefined) {
        p.id = p.legacy_id;
      }

      // Esegui validazione professionale
      const errori = validaDatiProdotto(p, riga, squadreValide, campionatiValidi);

      const pId = p.id !== undefined ? p.id : p.legacy_id;
      if (pId !== undefined && pId !== null && pId !== '') {
        if (seenIds.has(pId)) {
          errori.push(`ID univoco duplicato nel file: '${pId}'`);
        } else {
          seenIds.add(pId);
        }
      }

      if (errori.length > 0) {
        countErrori++;
        erroriDettagli.push({
          riga,
          errore: errori.join(', ')
        });
        return; // Salta il prodotto non valido
      }

      let cat = p.categoria || 'Kit';
      let tgt = p.target;
      if (cat === "Kit Bambino") {
        cat = "Kit";
        tgt = "Bambino";
      }
      if (!tgt) {
        const textToCheck = `${p.squadra || ''} ${p.versione || ''} ${cat}`.toLowerCase();
        if (textToCheck.includes('kids') || textToCheck.includes('bambino') || textToCheck.includes('child') || textToCheck.includes('youth')) {
          tgt = "Bambino";
        } else {
          tgt = "Adulto";
        }
      }

      const rawSquadra = p.squadra || 'Sconosciuta';
      const squadraNorm = normalizzaNomeSquadra(rawSquadra, squadreEsistenti);
      if (squadraNorm && !squadreEsistenti.includes(squadraNorm)) {
        squadreEsistenti.push(squadraNorm);
      }

      validProducts.push({
        squadra: squadraNorm,
        categoria: cat,
        target: tgt,
        stagione: p.stagione || '2024/2025',
        versione: p.versione || 'Home',
        prezzo: parseFloat(p.prezzo) || 23.99,
        prezzo_fornitore: parseFloat(p.prezzo_fornitore || p.prezzoFornitore || 0),
        immagine: p.immagine || '',
        legacy_id: pId ? Number(pId) : null
      });
    });

    if (validProducts.length === 0) {
      return res.json({
        success: true,
        count: 0,
        analizzati: products.length,
        importati: 0,
        aggiornati: 0,
        duplicati: 0,
        errori: countErrori,
        errori_dettagli: erroriDettagli
      });
    }

    if (!supabase) {
      if (fs.existsSync(LOCAL_PRODUCTS_FILE)) {
        let localProds = JSON.parse(fs.readFileSync(LOCAL_PRODUCTS_FILE, 'utf8'));
        const startId = localProds.length > 0 ? Math.max(...localProds.map(p => parseInt(p.id || p.legacy_id || 0))) + 1 : 1;
        const mapped = validProducts.map((p, i) => ({
          id: p.legacy_id || (startId + i),
          legacy_id: p.legacy_id || (startId + i),
          ...p
        }));
        localProds = [...localProds, ...mapped];
        fs.writeFileSync(LOCAL_PRODUCTS_FILE, JSON.stringify(localProds, null, 2), 'utf8');
        return res.json({
          success: true,
          count: mapped.length,
          analizzati: products.length,
          importati: mapped.length,
          aggiornati: 0,
          duplicati: 0,
          errori: countErrori,
          errori_dettagli: erroriDettagli,
          message: `Importati ${mapped.length} prodotti nel file locale.`
        });
      }
      throw new Error("Supabase non è configurato.");
    }

    const { data, error } = await supabase
      .from('products')
      .insert(validProducts)
      .select();

    if (error) throw error;

    return res.json({
      success: true,
      count: data ? data.length : 0,
      analizzati: products.length,
      importati: data ? data.length : 0,
      aggiornati: 0,
      duplicati: 0,
      errori: countErrori,
      errori_dettagli: erroriDettagli
    });
  } catch (err) {
    console.error("⚠️ Errore importazione prodotti:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/settings/products/import_batch - Batch import or update products con validazione
app.post('/api/settings/products/import_batch', async (req, res) => {
  try {
    const { products } = req.body;
    if (!Array.isArray(products)) {
      return res.status(400).json({ success: false, error: "I dati devono essere un array di prodotti." });
    }

    const supabase = getSupabaseClient();

    // -- AUTO-REGISTRATION OF UNKNOWN TEAMS TO DB --
    // Before validating products, check if there are any squads in the batch that are not yet in the teams database.
    // If we find them, automatically add them to the teams table (and local file) with their championship and category.
    // This reduces manual user work and ensures product validation always succeeds!
    try {
      let existingTeamNames = [];
      let existingTeamsList = [];
      if (supabase) {
        const { data: dbTeams, error: teamsError } = await supabase.from('teams').select('name, categoria, sezione');
        if (!teamsError && dbTeams) {
          existingTeamsList = dbTeams;
          existingTeamNames = dbTeams.map(t => t.name.toLowerCase().trim());
        }
      } else {
        existingTeamsList = getLocalTeams();
        existingTeamNames = existingTeamsList.map(t => t.name.toLowerCase().trim());
      }

      const teamsToCreate = [];
      const createdTeamNames = new Set(existingTeamNames);

      for (const p of products) {
        if (!p.squadra || p.squadra === 'Sconosciuta' || p.squadra.trim() === '') continue;
        const squadTrim = p.squadra.trim();
        const squadLower = squadTrim.toLowerCase();
        
        if (!createdTeamNames.has(squadLower)) {
          // Determine category based on league or category field
          let teamCat = 'Club';
          const campVal = (p.campionato || '').toLowerCase().trim();
          const catVal = (p.categoria || '').toLowerCase().trim();
          
          if (campVal === 'nazionali' || campVal === 'mondiali' || catVal === 'nazionali') {
            teamCat = 'Nazionali';
          } else if (campVal === 'nba' || catVal === 'nba') {
            teamCat = 'NBA';
          }
          
          const newTeam = {
            name: squadTrim,
            categoria: teamCat,
            sezione: p.campionato || 'Serie A'
          };
          
          teamsToCreate.push(newTeam);
          createdTeamNames.add(squadLower);
        }
      }

      if (teamsToCreate.length > 0) {
        if (supabase) {
          const { error: insertTeamsError } = await supabase.from('teams').insert(teamsToCreate);
          if (insertTeamsError) {
            console.error("⚠️ Errore inserimento squadre mancanti in import_batch:", insertTeamsError.message);
          } else {
            console.log(`[IMPORT_BATCH] Auto-created ${teamsToCreate.length} missing teams in Supabase teams table.`);
          }
        } else {
          const localTeams = getLocalTeams();
          saveLocalTeams([...localTeams, ...teamsToCreate]);
          console.log(`[IMPORT_BATCH] Auto-created ${teamsToCreate.length} missing teams in local JSON.`);
        }
      }
    } catch (teamRegErr) {
      console.error("⚠️ Errore durante l'auto-registrazione delle squadre:", teamRegErr.message);
    }

    const { squadreValide, campionatiValidi } = await ottieniListeValidazione(supabase);

    let countImportati = 0;
    let countAggiornati = 0;
    let countDuplicati = 0;
    const duplicatiDettagli = [];
    let countErrori = 0;
    const erroriDettagli = [];

    // Recupera la lista di tutte le squadre già presenti nel database per la normalizzazione
    let squadreEsistenti = [];
    if (supabase) {
      try {
        const { data: dbProds, error: dbError } = await supabase.from('products').select('squadra');
        if (!dbError && dbProds) {
          squadreEsistenti = [...new Set(dbProds.map(item => item.squadra).filter(Boolean))];
        }
      } catch (e) {
        console.error("⚠️ Errore lettura squadre in import_batch:", e.message);
      }
    } else if (fs.existsSync(LOCAL_PRODUCTS_FILE)) {
      try {
        const localData = JSON.parse(fs.readFileSync(LOCAL_PRODUCTS_FILE, 'utf8'));
        squadreEsistenti = [...new Set(localData.map(item => item.squadra).filter(Boolean))];
      } catch (e) {
        console.error("⚠️ Errore lettura squadre locali in import_batch:", e.message);
      }
    }

    // 1. Validazione di ciascun prodotto prima dell'importazione
    const validBatchProducts = [];
    const seenIds = new Set();

    products.forEach((p, index) => {
      const riga = index + 1;

      // Allinea ID se mancante
      if (p.id === undefined && p.legacy_id !== undefined) {
        p.id = p.legacy_id;
      }

      const errori = validaDatiProdotto(p, riga, squadreValide, campionatiValidi);

      const pId = p.id !== undefined ? p.id : p.legacy_id;
      if (pId !== undefined && pId !== null && pId !== '') {
        if (seenIds.has(pId)) {
          errori.push(`ID univoco duplicato nel file: '${pId}'`);
        } else {
          seenIds.add(pId);
        }
      }

      if (errori.length > 0) {
        countErrori++;
        erroriDettagli.push({
          riga,
          errore: errori.join(', ')
        });
      } else {
        validBatchProducts.push(p);
      }
    });

    if (!supabase) {
      if (fs.existsSync(LOCAL_PRODUCTS_FILE)) {
        let localProds = JSON.parse(fs.readFileSync(LOCAL_PRODUCTS_FILE, 'utf8'));
        
        for (const p of validBatchProducts) {
          const rawSquadra = p.squadra || 'Sconosciuta';
          const squadraNorm = normalizzaNomeSquadra(rawSquadra, squadreEsistenti);
          if (squadraNorm && !squadreEsistenti.includes(squadraNorm)) {
            squadreEsistenti.push(squadraNorm);
          }

          const pTarget = p.target || 'Adulto';
          let pImgUrl = '';
          if (Array.isArray(p.immagine)) {
            pImgUrl = p.immagine.length > 0 ? String(p.immagine[0]) : '';
          } else if (p.immagine !== undefined && p.immagine !== null) {
            pImgUrl = String(p.immagine);
          } else if (p.image !== undefined && p.image !== null) {
            pImgUrl = String(p.image);
          }
          pImgUrl = pImgUrl.split('#')[0].trim().toLowerCase();

          const existingIdx = pImgUrl ? localProds.findIndex(item => {
            let itemImg = '';
            if (Array.isArray(item.immagine)) {
              itemImg = item.immagine.length > 0 ? String(item.immagine[0]) : '';
            } else if (item.immagine !== undefined && item.immagine !== null) {
              itemImg = String(item.immagine);
            } else if (item.image !== undefined && item.image !== null) {
              itemImg = String(item.image);
            }
            return itemImg.split('#')[0].trim().toLowerCase() === pImgUrl;
          }) : -1;

          if (existingIdx !== -1) {
            duplicatiDettagli.push({
              id: p.id || p.legacy_id,
              squadra: squadraNorm,
              categoria: p.categoria,
              target: pTarget,
              stagione: p.stagione,
              versione: p.versione || p.nome_finale,
              immagine: pImgUrl,
              motivo: "Prodotto già presente (URL Immagine duplicato)"
            });

            // Duplicato segnalato: NON viene aggiornato e NON viene modificato il prodotto esistente
            countDuplicati++;
          } else {
            const payload = {
              squadra: traduciTestoProdotto(squadraNorm),
              categoria: p.categoria || 'Kit',
              target: pTarget,
              stagione: p.stagione || '2024/2025',
              versione: traduciTestoProdotto(p.versione || p.nome_finale || 'Home'),
              prezzo: parseFloat(p.prezzo) || 23.99,
              prezzo_fornitore: p.prezzo_fornitore !== null && p.prezzo_fornitore !== undefined ? parseFloat(p.prezzo_fornitore) : null,
              immagine: p.immagine || ''
            };

            const nextLegacyId =
              localProds.length > 0
                ? Math.max(...localProds.map(item => parseInt(item.id || item.legacy_id || 0))) + 1
                : 1;

            localProds.push({
              id: p.id || nextLegacyId,
              legacy_id: p.id || nextLegacyId,
              ...payload
            });

            countImportati++;
          }
        }
        
        fs.writeFileSync(LOCAL_PRODUCTS_FILE, JSON.stringify(localProds, null, 2), 'utf8');
        return res.json({
          success: true,
          analizzati: products.length,
          importati: countImportati,
          aggiornati: countAggiornati,
          duplicati: countDuplicati,
          errori: countErrori,
          errori_dettagli: erroriDettagli
        });
      }
      throw new Error("Supabase non è configurato.");
    }

    let dbProducts = [];
    try {
      dbProducts = await getAllProductsFromSupabase(supabase);
    } catch (fetchError) {
      throw fetchError;
    }

    for (const p of validBatchProducts) {
      const rawSquadra = p.squadra || 'Sconosciuta';
      const squadraNorm = normalizzaNomeSquadra(rawSquadra, squadreEsistenti);
      if (squadraNorm && !squadreEsistenti.includes(squadraNorm)) {
        squadreEsistenti.push(squadraNorm);
      }

      const pTarget = p.target || 'Adulto';
      let pImgUrl = '';
      if (Array.isArray(p.immagine)) {
        pImgUrl = p.immagine.length > 0 ? String(p.immagine[0]) : '';
      } else if (p.immagine !== undefined && p.immagine !== null) {
        pImgUrl = String(p.immagine);
      } else if (p.image !== undefined && p.image !== null) {
        pImgUrl = String(p.image);
      }
      pImgUrl = pImgUrl.split('#')[0].trim().toLowerCase();

      const existing = pImgUrl ? dbProducts.find(item => {
        let itemImg = '';
        if (Array.isArray(item.immagine)) {
          itemImg = item.immagine.length > 0 ? String(item.immagine[0]) : '';
        } else if (item.immagine !== undefined && item.immagine !== null) {
          itemImg = String(item.immagine);
        } else if (item.image !== undefined && item.image !== null) {
          itemImg = String(item.image);
        }
        return itemImg.split('#')[0].trim().toLowerCase() === pImgUrl;
      }) : null;

      if (existing) {
        duplicatiDettagli.push({
          ...p,
          database_id: existing.id,
          legacy_id_database: existing.legacy_id,
          immagine: pImgUrl,
          motivo: "Prodotto già presente (URL Immagine duplicato)"
        });

        // Duplicato segnalato: NON viene aggiornato e NON viene modificato il prodotto esistente
        countDuplicati++;
      } else {
        const payload = {
          squadra: traduciTestoProdotto(squadraNorm),
          categoria: p.categoria || 'Kit',
          target: pTarget,
          stagione: p.stagione || '2024/2025',
          versione: traduciTestoProdotto(p.versione || p.nome_finale || 'Home'),
          prezzo: parseFloat(p.prezzo) || 23.99,
          prezzo_fornitore: p.prezzo_fornitore !== null && p.prezzo_fornitore !== undefined ? parseFloat(p.prezzo_fornitore) : null,
          immagine: p.immagine || ''
        };

        const nextLegacyId = dbProducts.length > countImportati ? Math.max(...dbProducts.map(item => parseInt(item.legacy_id || 0))) + 1 + countImportati : 1 + countImportati;
        payload.legacy_id = p.id || nextLegacyId;

        const { error: insertError } = await supabase
          .from('products')
          .insert([payload]);

        if (insertError) {
          console.error("Errore inserimento prodotto:", insertError);
          countErrori++;
        } else {
          countImportati++;
          dbProducts.push({ id: payload.legacy_id, ...payload });
        }
      }
    }

    return res.json({
      success: true,
      analizzati: products.length,
      importati: countImportati,
      aggiornati: countAggiornati,
      duplicati: countDuplicati,
      duplicati_dettagli: duplicatiDettagli,
      errori: countErrori,
      errori_dettagli: erroriDettagli
    });

  } catch (err) {
    console.error("⚠️ Errore batch importazione prodotti:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/connections/status - Ottieni stato delle connessioni reali
app.get('/api/connections/status', async (req, res) => {
  try {
    const status = {
      supabase: { connected: false, count: 0 },
      lotti: { connected: true, count: 0 },
      lastUpdate: new Date().toLocaleString('it-IT')
    };

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { count, error } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true });
        
        if (!error) {
          status.supabase.connected = true;
          status.supabase.count = count || 0;
        }
      } catch (e) {
        console.warn("Supabase ping failed:", e.message);
      }
    }

    if (!status.supabase.connected && fs.existsSync(LOCAL_PRODUCTS_FILE)) {
      try {
        const localProds = JSON.parse(fs.readFileSync(LOCAL_PRODUCTS_FILE, 'utf8'));
        status.supabase.count = localProds.length;
      } catch (e) {}
    }

    try {
      const lotti = await getDbLotti();
      status.lotti.count = lotti.length;
    } catch (e) {
      console.warn("Failed to get lotti count:", e.message);
    }

    return res.json({ success: true, status });
  } catch (err) {
    console.error("⚠️ Errore verifica connessioni:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/products - Ottieni i prodotti directly from Supabase or with Local Fallback
app.get('/api/products', async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    let data = [];
    let source = 'supabase';

    if (supabase) {
      try {
        const startTime = Date.now();
        const allProductsRaw = await getAllProductsFromSupabase(supabase);
        const elapsed = Date.now() - startTime;
        console.log(`[API /api/products] Successfully loaded ${allProductsRaw.length} products from Supabase via helper in ${elapsed}ms`);
        data = allProductsRaw;
      } catch (dbErr) {
        console.warn("⚠️ Fallito recupero prodotti da Supabase, uso fallback locale:", dbErr.message);
        if (fs.existsSync(LOCAL_PRODUCTS_FILE)) {
          data = JSON.parse(fs.readFileSync(LOCAL_PRODUCTS_FILE, 'utf8'));
          source = 'local';
        } else {
          throw dbErr;
        }
      }
    } else if (fs.existsSync(LOCAL_PRODUCTS_FILE)) {
      data = JSON.parse(fs.readFileSync(LOCAL_PRODUCTS_FILE, 'utf8'));
      source = 'local';
    } else {
      throw new Error("Nessun database configurato o trovato.");
    }

    // Ordina i prodotti per legacy_id crescente per consistenza con il pannello
    const products = data.map(p => {
      let target = p.target;
      let categoria = normalizzaCategoria(p.categoria);
      
      // If category is "Kit" and the original category or target implies "Bambino"
      if (categoria === "Kit" && (p.categoria === "Kit Bambino" || target === "Bambino")) {
        target = "Bambino";
      }
      
      if (!target) {
        // Compatibility: check if it's Kids
        const textToCheck = `${p.squadra || ''} ${p.versione || ''} ${p.categoria || ''}`.toLowerCase();
        if (textToCheck.includes('kids') || textToCheck.includes('bambino') || textToCheck.includes('child') || textToCheck.includes('youth')) {
          target = "Bambino";
        } else {
          target = "Adulto";
        }
      }
      
      return {
        id: p.id,
        legacy_id: p.legacy_id !== undefined && p.legacy_id !== null ? p.legacy_id : p.id,
        squadra: p.squadra || '',
        categoria: categoria,
        target: target,
        versione: p.versione || '',
        stagione: p.stagione || '',
        prezzo: p.prezzo !== undefined ? Number(p.prezzo) : 23.99,
        prezzo_fornitore: p.prezzo_fornitore !== undefined && p.prezzo_fornitore !== null && p.prezzo_fornitore !== "" ? Number(p.prezzo_fornitore) : null,
        immagine: p.immagine || '',
        filtro_catalogo: p.filtro_catalogo || '',
        tag: p.tag || '',
        tipo: p.tipo || ''
      };
    });

    return res.json({ success: true, source, products });
  } catch (err) {
    console.warn("⚠️ Errore nel caricamento dei prodotti:", err.message);
    return res.json({ success: false, error: err.message, products: [] });
  }
});

// POST /api/products - Crea un prodotto direttamente su Supabase
app.post('/api/products', async (req, res) => {
  try {
    const { squadra, categoria, target, versione, stagione, prezzo, immagine, image_url, prezzo_fornitore } = req.body;
    if (!squadra || !categoria || !versione || !stagione) {
      return res.status(400).json({ success: false, error: "Campi obbligatori mancanti: squadra, categoria, versione, stagione" });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error("Supabase client is not configured.");
    }

    // Recupera l'ultimo legacy_id incrementale ordinando per legacy_id decrescente con limite 1
    const { data: maxProd, error: fetchError } = await supabase
      .from('products')
      .select('legacy_id')
      .order('legacy_id', { ascending: false })
      .limit(1);
    if (fetchError) throw fetchError;

    const maxLegacyId = maxProd && maxProd.length > 0 ? Number(maxProd[0].legacy_id) || 0 : 0;
    const newLegacyId = maxLegacyId + 1;
    const finalImmagine = immagine || image_url || "";
    const finalVersione = formattaNomenclaturaVersione(squadra, categoria, versione, stagione);

    const payload = {
      legacy_id: newLegacyId,
      squadra: traduciTestoProdotto(squadra),
      categoria: normalizzaCategoria(categoria),
      target: target || "Adulto",
      versione: traduciTestoProdotto(finalVersione),
      stagione,
      prezzo: Number(prezzo) || 23.99,
      prezzo_fornitore: prezzo_fornitore !== undefined && prezzo_fornitore !== null && prezzo_fornitore !== '' ? Number(prezzo_fornitore) : null,
      immagine: finalImmagine
    };

    const { data, error } = await supabase
      .from('products')
      .insert([payload])
      .select();

    if (error) throw error;

    return res.json({ success: true, source: 'supabase', product: data ? data[0] : payload });
  } catch (err) {
    console.warn("⚠️ Errore durante l'inserimento su Supabase:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/products/:id - Modifica un prodotto direttamente su Supabase
app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { squadra, categoria, target, versione, stagione, prezzo, immagine, image_url, prezzo_fornitore } = req.body;

    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error("Supabase client is not configured.");
    }

    // Recupera l'oggetto originale da Supabase per fondere i campi
    const { data: original, error: fetchError } = await supabase.from('products').select('*').eq('id', id).single();
    if (fetchError) {
      return res.status(404).json({ success: false, error: "Prodotto non trovato su Supabase: " + fetchError.message });
    }

    const finalImmagine = immagine !== undefined ? immagine : (image_url !== undefined ? image_url : undefined);
    const finalSquadra = squadra !== undefined ? squadra : original.squadra;
    const finalCategoria = categoria !== undefined ? categoria : original.categoria;
    const finalTarget = target !== undefined ? target : original.target;
    const finalStagione = stagione !== undefined ? stagione : original.stagione;
    const finalVersione = versione !== undefined ? formattaNomenclaturaVersione(finalSquadra, finalCategoria, versione, finalStagione) : original.versione;

    const payload = {
      squadra: traduciTestoProdotto(finalSquadra),
      categoria: normalizzaCategoria(finalCategoria),
      target: finalTarget || "Adulto",
      versione: traduciTestoProdotto(finalVersione),
      stagione: finalStagione,
      prezzo: prezzo !== undefined ? Number(prezzo) : original.prezzo,
      immagine: finalImmagine !== undefined ? finalImmagine : original.immagine,
      prezzo_fornitore: prezzo_fornitore !== undefined ? (prezzo_fornitore !== null && prezzo_fornitore !== '' ? Number(prezzo_fornitore) : null) : original.prezzo_fornitore
    };

    const { data, error } = await supabase
      .from('products')
      .update(payload)
      .eq('id', id)
      .select();

    if (error) throw error;

    return res.json({ success: true, source: 'supabase', product: data ? data[0] : payload });
  } catch (err) {
    console.warn("⚠️ Errore durante la modifica su Supabase:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/products/batch-update - Modifica massiva prodotti in un'unica operazione batch
app.post('/api/products/batch-update', async (req, res) => {
  try {
    const { ids, updates } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: "Specificare una lista di ID prodotti da modificare ('ids')." });
    }
    if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: "Nessuna modifica specificata in 'updates'." });
    }

    const payload = {};
    if (updates.squadra !== undefined && updates.squadra !== null && String(updates.squadra).trim() !== '') {
      payload.squadra = traduciTestoProdotto(String(updates.squadra).trim());
    }
    if (updates.categoria !== undefined && updates.categoria !== null && String(updates.categoria).trim() !== '') {
      payload.categoria = normalizzaCategoria(String(updates.categoria).trim());
    }
    if (updates.tipo !== undefined && updates.tipo !== null && String(updates.tipo).trim() !== '') {
      payload.tipo = String(updates.tipo).trim();
    }
    if (updates.target !== undefined && updates.target !== null && String(updates.target).trim() !== '') {
      payload.target = String(updates.target).trim();
    }
    if (updates.versione !== undefined && updates.versione !== null && String(updates.versione).trim() !== '') {
      payload.versione = traduciTestoProdotto(String(updates.versione).trim());
    }
    if (updates.stagione !== undefined && updates.stagione !== null && String(updates.stagione).trim() !== '') {
      payload.stagione = String(updates.stagione).trim();
    }
    if (updates.disponibilita !== undefined && updates.disponibilita !== null && String(updates.disponibilita).trim() !== '') {
      payload.disponibilita = updates.disponibilita === true || String(updates.disponibilita) === 'true';
    }
    if (updates.prezzo !== undefined && updates.prezzo !== null && updates.prezzo !== '' && !isNaN(Number(updates.prezzo))) {
      payload.prezzo = Number(updates.prezzo);
    }
    if (updates.filtro_catalogo !== undefined && updates.filtro_catalogo !== null && String(updates.filtro_catalogo).trim() !== '') {
      payload.filtro_catalogo = String(updates.filtro_catalogo).trim();
    }
    if (updates.tag !== undefined && updates.tag !== null && String(updates.tag).trim() !== '') {
      payload.tag = String(updates.tag).trim();
    }

    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ success: false, error: "Nessun campo valido da aggiornare." });
    }

    const supabase = getSupabaseClient();
    let updatedProducts = [];
    let source = 'local';

    if (supabase) {
      source = 'supabase';
      const numIds = ids.map(id => isNaN(Number(id)) ? id : Number(id));
      const strIds = ids.map(id => String(id));
      const allIds = Array.from(new Set([...numIds, ...strIds]));

      let { data, error } = await supabase
        .from('products')
        .update(payload)
        .in('id', allIds)
        .select();

      if (error) {
        console.warn("⚠️ Avviso aggiornamento batch Supabase (fallback campi core):", error.message);
        const corePayload = { ...payload };
        delete corePayload.tipo;
        delete corePayload.disponibilita;
        delete corePayload.filtro_catalogo;
        delete corePayload.tag;

        if (Object.keys(corePayload).length > 0) {
          const resRetry = await supabase
            .from('products')
            .update(corePayload)
            .in('id', allIds)
            .select();
          if (!resRetry.error) {
            data = resRetry.data;
            error = null;
          }
        }
      }

      if (error) throw error;
      updatedProducts = data || [];
    }

    if (fs.existsSync(LOCAL_PRODUCTS_FILE)) {
      try {
        let localProds = JSON.parse(fs.readFileSync(LOCAL_PRODUCTS_FILE, 'utf8'));
        const idSet = new Set(ids.map(id => String(id)));
        localProds = localProds.map(p => {
          if (idSet.has(String(p.id))) {
            return { ...p, ...payload };
          }
          return p;
        });
        fs.writeFileSync(LOCAL_PRODUCTS_FILE, JSON.stringify(localProds, null, 2), 'utf8');
      } catch (errLocal) {
        console.warn("⚠️ Impossibile aggiornare i prodotti nel file locale:", errLocal.message);
      }
    }

    return res.json({
      success: true,
      source,
      count: ids.length,
      payload,
      updatedProducts
    });
  } catch (err) {
    console.error("🔴 Errore in POST /api/products/batch-update:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/products/batch-custom-update - Aggiornamento massivo personalizzato per singolo prodotto (es. Trova e Sostituisci)
app.post('/api/products/batch-custom-update', async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: "Specificare un array di elementi 'items'." });
    }

    const supabase = getSupabaseClient();
    let updatedCount = 0;

    if (supabase) {
      const chunkSize = 50;
      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (item) => {
          if (!item.id || !item.updates || typeof item.updates !== 'object') return;
          const targetId = isNaN(Number(item.id)) ? item.id : Number(item.id);
          const { error } = await supabase
            .from('products')
            .update(item.updates)
            .eq('id', targetId);
          
          if (!error) {
            updatedCount++;
          } else {
            console.warn(`⚠️ Errore update per ID ${item.id}:`, error.message);
          }
        }));
      }
    }

    if (fs.existsSync(LOCAL_PRODUCTS_FILE)) {
      try {
        let localProds = JSON.parse(fs.readFileSync(LOCAL_PRODUCTS_FILE, 'utf8'));
        const itemMap = new Map(items.map(it => [String(it.id), it.updates]));
        localProds = localProds.map(p => {
          const pId = String(p.id);
          if (itemMap.has(pId)) {
            return { ...p, ...itemMap.get(pId) };
          }
          return p;
        });
        fs.writeFileSync(LOCAL_PRODUCTS_FILE, JSON.stringify(localProds, null, 2), 'utf8');
      } catch (errLocal) {
        console.warn("⚠️ Impossibile aggiornare file locale prodotti:", errLocal.message);
      }
    }

    return res.json({
      success: true,
      count: updatedCount || items.length
    });
  } catch (err) {
    console.error("🔴 Errore in POST /api/products/batch-custom-update:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/products/bulk/delete_unconfigured - Bulk delete products with null, 0.00 or empty prezzo_fornitore
app.delete('/api/products/bulk/delete_unconfigured', async (req, res) => {
  console.log("[BACKEND DEBUG] Ricevuta richiesta DELETE /api/products/bulk/delete_unconfigured");
  try {
    const isNotConfigured = (p) => {
      const val = p.prezzo_fornitore;
      if (val === null || val === undefined) return true;
      const str = String(val).trim();
      if (str === "" || str === "null" || str === "undefined") return true;
      const num = parseFloat(str);
      if (isNaN(num) || num === 0) return true;
      return false;
    };

    const supabase = getSupabaseClient();
    if (!supabase) {
      if (fs.existsSync(LOCAL_PRODUCTS_FILE)) {
        let localProds = JSON.parse(fs.readFileSync(LOCAL_PRODUCTS_FILE, 'utf8'));
        const originalCount = localProds.length;
        
        const nonConfiguredProds = localProds.filter(isNotConfigured);
        console.log(`[BACKEND DEBUG] Local: Trovati ${originalCount} prodotti totali. Non configurati trovati: ${nonConfiguredProds.length}`);

        localProds = localProds.filter(p => !isNotConfigured(p));
        const deletedCount = originalCount - localProds.length;
        
        fs.writeFileSync(LOCAL_PRODUCTS_FILE, JSON.stringify(localProds, null, 2), 'utf8');
        console.log(`[BACKEND DEBUG] Local: Eliminazione completata con successo. Eliminati ${deletedCount} prodotti.`);
        return res.json({ success: true, source: 'local', deletedCount });
      }
      throw new Error("Supabase client is not configured.");
    }

    console.log("[BACKEND DEBUG] Supabase: Avvio analisi prodotti da eliminare...");
    
    // Recupera tutti i prodotti per filtrarli accuratamente con la logica JS robusta
    let allProds = [];
    try {
      allProds = await getAllProductsFromSupabase(supabase);
    } catch (selectError) {
      console.error("🔴 [BACKEND DEBUG] Errore nel recupero prodotti da Supabase via helper:", selectError);
      throw selectError;
    }

    const nonConfiguredProds = allProds.filter(isNotConfigured);
    const idsToDelete = nonConfiguredProds.map(p => p.id);
    console.log(`[BACKEND DEBUG] Supabase: Trovati ${allProds.length} prodotti totali. Non configurati trovati: ${idsToDelete.length}`);

    let deletedCount = 0;
    if (idsToDelete.length > 0) {
      const { data: deleteData, error: deleteError } = await supabase
        .from('products')
        .delete()
        .in('id', idsToDelete)
        .select();

      if (deleteError) {
        console.error("🔴 [BACKEND DEBUG] Errore durante l'eliminazione massiva su Supabase:", deleteError);
        throw deleteError;
      }
      deletedCount = deleteData ? deleteData.length : idsToDelete.length;
    }

    console.log(`[BACKEND DEBUG] Supabase: Eliminazione completata con successo. Eliminati ${deletedCount} prodotti.`);
    return res.json({ success: true, source: 'supabase', deletedCount });
  } catch (err) {
    console.error("🔴 [BACKEND DEBUG] ERRORE IN BULK DELETE:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// MODULO SEPARATO & INDIPENDENTE: CATALOGO ACCESSORI
// =========================================================================
function getLocalAccessories() {
  try {
    if (fs.existsSync(LOCAL_ACCESSORIES_FILE)) {
      const raw = fs.readFileSync(LOCAL_ACCESSORIES_FILE, 'utf8');
      if (raw && raw.trim()) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch (err) {
    console.error("⚠️ [ACCESSORI] Errore lettura accessories_local.json:", err.message);
  }
  return [];
}

function saveLocalAccessories(accessories) {
  try {
    fs.writeFileSync(LOCAL_ACCESSORIES_FILE, JSON.stringify(accessories, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error("⚠️ [ACCESSORI] Errore salvataggio accessories_local.json:", err.message);
    return false;
  }
}

// GET /api/accessories - Endpoint dedicato esclusivamente al catalogo accessori
app.get('/api/accessories', (req, res) => {
  try {
    const accessories = getLocalAccessories();
    return res.json({
      success: true,
      count: accessories.length,
      accessories
    });
  } catch (err) {
    console.error("⚠️ [ACCESSORI] Errore GET /api/accessories:", err.message);
    return res.status(500).json({ success: false, error: err.message, accessories: [] });
  }
});

// GET /api/accessories/categories - Categorie dinamiche estratte dagli accessori
app.get('/api/accessories/categories', (req, res) => {
  try {
    const accessories = getLocalAccessories();
    const categoriesSet = new Set(['Calze', 'Calzettoni', 'Guanti', 'Palloni', 'Cappellini', 'Sciarpe', 'Borse', 'Fasce Capitano', 'Altri Accessori']);
    accessories.forEach(item => {
      if (item && item.categoria && String(item.categoria).trim() !== '') {
        categoriesSet.add(String(item.categoria).trim());
      }
    });
    return res.json({
      success: true,
      categories: Array.from(categoriesSet)
    });
  } catch (err) {
    console.error("⚠️ [ACCESSORI] Errore GET /api/accessories/categories:", err.message);
    return res.status(500).json({ success: false, error: err.message, categories: [] });
  }
});

// POST /api/accessories - Inserimento nuovo accessorio (struttura scalabile e indipendente)
app.post('/api/accessories', (req, res) => {
  try {
    const { categoria, nome, descrizione, immagine, prezzo, prezzo_fornitore, disponibile, stato, codice, taglia, opzioni, specifiche } = req.body;
    if (!nome || !categoria) {
      return res.status(400).json({ success: false, error: "Campi obbligatori mancanti: nome, categoria." });
    }

    const accessories = getLocalAccessories();
    const cleanNome = String(nome).trim();
    const cleanCategoria = String(categoria).trim();
    
    // Generazione ID univoco isolato per accessori
    let generatedId = req.body.id;
    if (!generatedId) {
      const maxNum = accessories.reduce((max, item) => {
        if (item && item.id && typeof item.id === 'string' && item.id.startsWith('accessorio-')) {
          const num = parseInt(item.id.replace('accessorio-', ''), 10);
          return !isNaN(num) && num > max ? num : max;
        }
        return max;
      }, 0);
      generatedId = `accessorio-${String(maxNum + 1).padStart(3, '0')}`;
    }

    const newAccessory = {
      id: generatedId,
      codice: codice ? String(codice).trim() : (req.body.cod_art ? String(req.body.cod_art).trim() : generatedId),
      categoria: cleanCategoria,
      nome: cleanNome,
      descrizione: descrizione !== undefined ? String(descrizione).trim() : "",
      immagine: immagine ? String(immagine).trim() : "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=600&auto=format&fit=crop&q=80",
      prezzo: (prezzo !== undefined && prezzo !== null && !isNaN(Number(prezzo))) ? Number(prezzo) : 0,
      prezzo_fornitore: (prezzo_fornitore !== undefined && prezzo_fornitore !== null && !isNaN(Number(prezzo_fornitore))) ? Number(prezzo_fornitore) : 0,
      disponibile: disponibile !== undefined ? Boolean(disponibile) : true,
      stato: stato !== undefined ? (String(stato).toLowerCase() === 'disattivato' || stato === false ? 'disattivato' : 'attivo') : 'attivo',
      tipo_catalogo: "accessori",
      taglia: taglia ? String(taglia).trim() : "Unica",
      opzioni: opzioni || specifiche || null,
      created_at: new Date().toISOString()
    };

    accessories.push(newAccessory);
    saveLocalAccessories(accessories);

    console.log(`[ACCESSORI] Nuovo accessorio aggiunto: #${newAccessory.id} - ${newAccessory.nome} (${newAccessory.categoria})`);
    return res.json({ success: true, accessory: newAccessory });
  } catch (err) {
    console.error("⚠️ [ACCESSORI] Errore POST /api/accessories:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/accessories/:id - Modifica accessorio esistente
app.put('/api/accessories/:id', (req, res) => {
  try {
    const accId = req.params.id;
    if (!accId) {
      return res.status(400).json({ success: false, error: "ID accessorio mancante." });
    }

    const accessories = getLocalAccessories();
    const index = accessories.findIndex(a => a && (a.id === accId || String(a.id) === String(accId)));

    if (index === -1) {
      return res.status(404).json({ success: false, error: "Accessorio non trovato." });
    }

    const current = accessories[index];
    const { categoria, nome, descrizione, immagine, prezzo, prezzo_fornitore, disponibile, stato, codice, taglia, opzioni, specifiche } = req.body;

    const updatedAccessory = {
      ...current,
      id: current.id,
      tipo_catalogo: "accessori",
      categoria: categoria !== undefined ? String(categoria).trim() : current.categoria,
      nome: nome !== undefined ? String(nome).trim() : current.nome,
      descrizione: descrizione !== undefined ? String(descrizione).trim() : (current.descrizione || ""),
      immagine: immagine !== undefined ? String(immagine).trim() : (current.immagine || ""),
      prezzo: prezzo !== undefined && prezzo !== null && !isNaN(Number(prezzo)) ? Number(prezzo) : current.prezzo,
      prezzo_fornitore: prezzo_fornitore !== undefined && prezzo_fornitore !== null && !isNaN(Number(prezzo_fornitore)) ? Number(prezzo_fornitore) : current.prezzo_fornitore,
      disponibile: disponibile !== undefined ? Boolean(disponibile) : (current.disponibile !== undefined ? Boolean(current.disponibile) : true),
      stato: stato !== undefined ? (String(stato).toLowerCase() === 'disattivato' || stato === false ? 'disattivato' : 'attivo') : (current.stato || 'attivo'),
      codice: codice !== undefined ? String(codice).trim() : (current.codice || current.id),
      taglia: taglia !== undefined ? String(taglia).trim() : (current.taglia || "Unica"),
      opzioni: opzioni !== undefined ? opzioni : (specifiche !== undefined ? specifiche : current.opzioni),
      updated_at: new Date().toISOString()
    };

    accessories[index] = updatedAccessory;
    saveLocalAccessories(accessories);

    console.log(`[ACCESSORI] Accessorio aggiornato: #${updatedAccessory.id} - ${updatedAccessory.nome}`);
    return res.json({ success: true, accessory: updatedAccessory });
  } catch (err) {
    console.error("⚠️ [ACCESSORI] Errore PUT /api/accessories/:id:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/accessories/:id - Eliminazione sicura e isolata di un singolo accessorio
app.delete('/api/accessories/:id', (req, res) => {
  try {
    const accId = req.params.id;
    if (!accId) {
      return res.status(400).json({ success: false, error: "ID accessorio mancante." });
    }

    const accessories = getLocalAccessories();
    const initialLen = accessories.length;
    const filtered = accessories.filter(a => a && (a.id !== accId && String(a.id) !== String(accId)));

    if (filtered.length === initialLen) {
      return res.status(404).json({ success: false, error: "Accessorio non trovato per l'eliminazione." });
    }

    saveLocalAccessories(filtered);
    console.log(`[ACCESSORI] Accessorio eliminato con successo: ID ${accId}`);
    return res.json({ success: true, message: `Accessorio ${accId} eliminato con successo.`, remainingCount: filtered.length });
  } catch (err) {
    console.error("⚠️ [ACCESSORI] Errore DELETE /api/accessories/:id:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/accessories/batch-delete - Eliminazione multipla accessori selezionati
app.post('/api/accessories/batch-delete', (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: "Nessun ID fornito per l'eliminazione multipla." });
    }

    const idsSet = new Set(ids.map(id => String(id)));
    const accessories = getLocalAccessories();
    const initialLen = accessories.length;
    const filtered = accessories.filter(a => a && !idsSet.has(String(a.id)));
    const deletedCount = initialLen - filtered.length;

    saveLocalAccessories(filtered);
    console.log(`[ACCESSORI] Eliminati ${deletedCount} accessori selezionati.`);
    return res.json({ success: true, deletedCount, remainingCount: filtered.length });
  } catch (err) {
    console.error("⚠️ [ACCESSORI] Errore POST /api/accessories/batch-delete:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/accessories/batch-status - Aggiornamento stato multiplo (attivo/disattivato) per accessori selezionati
app.post('/api/accessories/batch-status', (req, res) => {
  try {
    const { ids, stato, disponibile } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: "Nessun ID fornito per l'aggiornamento multiplo." });
    }

    const idsSet = new Set(ids.map(id => String(id)));
    const accessories = getLocalAccessories();
    let updatedCount = 0;

    const updatedList = accessories.map(a => {
      if (a && idsSet.has(String(a.id))) {
        updatedCount++;
        return {
          ...a,
          stato: stato !== undefined ? (String(stato).toLowerCase() === 'disattivato' || stato === false ? 'disattivato' : 'attivo') : a.stato,
          disponibile: disponibile !== undefined ? Boolean(disponibile) : a.disponibile,
          updated_at: new Date().toISOString()
        };
      }
      return a;
    });

    saveLocalAccessories(updatedList);
    console.log(`[ACCESSORI] Aggiornato stato per ${updatedCount} accessori.`);
    return res.json({ success: true, updatedCount });
  } catch (err) {
    console.error("⚠️ [ACCESSORI] Errore POST /api/accessories/batch-status:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/accessories/batch-update - Modifica massiva campi accessori selezionati
app.post('/api/accessories/batch-update', (req, res) => {
  try {
    const { ids, updates } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: "Nessun ID fornito per la modifica massiva." });
    }
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ success: false, error: "Dati di aggiornamento non validi." });
    }

    const idsSet = new Set(ids.map(id => String(id)));
    const accessories = getLocalAccessories();
    let updatedCount = 0;

    const updatedList = accessories.map(a => {
      if (a && idsSet.has(String(a.id))) {
        updatedCount++;
        const item = { ...a };
        if (updates.categoria !== undefined && updates.categoria !== '') item.categoria = String(updates.categoria).trim();
        if (updates.prezzo !== undefined && updates.prezzo !== '' && !isNaN(Number(updates.prezzo))) item.prezzo = Number(updates.prezzo);
        if (updates.prezzo_fornitore !== undefined && updates.prezzo_fornitore !== '' && !isNaN(Number(updates.prezzo_fornitore))) item.prezzo_fornitore = Number(updates.prezzo_fornitore);
        if (updates.disponibile !== undefined && updates.disponibile !== '') item.disponibile = updates.disponibile === 'true' || updates.disponibile === true;
        if (updates.stato !== undefined && updates.stato !== '') item.stato = updates.stato === 'disattivato' ? 'disattivato' : 'attivo';
        if (updates.taglia !== undefined && updates.taglia !== '') item.taglia = String(updates.taglia).trim();
        item.updated_at = new Date().toISOString();
        return item;
      }
      return a;
    });

    saveLocalAccessories(updatedList);
    console.log(`[ACCESSORI] Modifica massiva completata su ${updatedCount} accessori.`);
    return res.json({ success: true, updatedCount });
  } catch (err) {
    console.error("⚠️ [ACCESSORI] Errore POST /api/accessories/batch-update:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/accessories/import_batch - Importazione massiva JSON catalogo Accessori
app.post('/api/accessories/import_batch', (req, res) => {
  try {
    const { accessories } = req.body;
    if (!Array.isArray(accessories) || accessories.length === 0) {
      return res.status(400).json({ success: false, error: "Nessun accessorio fornito per l'importazione." });
    }

    const currentAccessories = getLocalAccessories();
    let countImportati = 0;
    let countAggiornati = 0;
    let countDuplicati = 0;
    let countErrori = 0;
    const erroriDettagli = [];

    // Helper per pulire numeri/prezzi
    const parsePrice = (val) => {
      if (val === undefined || val === null || val === '') return null;
      if (typeof val === 'number') return isNaN(val) ? null : val;
      let str = String(val).trim();
      if (str.includes('-')) {
        const parts = str.split('-');
        const v1 = parsePrice(parts[0]);
        const v2 = parsePrice(parts[1]);
        if (v1 !== null && v2 !== null) return Math.max(v1, v2);
        if (v1 !== null) return v1;
        if (v2 !== null) return v2;
      }
      if (str.includes(',') && !str.includes('.')) str = str.replace(/,/g, '.');
      str = str.replace(/[^0-9.]/g, '');
      const parts = str.split('.');
      if (parts.length > 2) str = parts[0] + '.' + parts.slice(1).join('');
      const n = parseFloat(str);
      return (isNaN(n) || n < 0) ? null : n;
    };

    // Helper per dedurre categoria se assente o generica
    const deduceCategory = (rawCat, rawName) => {
      const lowerCat = String(rawCat || '').toLowerCase().trim();
      if (lowerCat.includes('calzetton') || lowerCat.includes('socks knee')) return 'Calzettoni';
      if (lowerCat.includes('calz') || lowerCat.includes('grip') || lowerCat.includes('sock')) return 'Calze';
      if (lowerCat.includes('guant') || lowerCat.includes('glove')) return 'Guanti';
      if (lowerCat.includes('pallon') || lowerCat.includes('ball')) return 'Palloni';
      if (lowerCat.includes('cappellin') || lowerCat.includes('cap') || lowerCat.includes('hat') || lowerCat.includes('beanie')) return 'Cappellini';
      if (lowerCat.includes('sciarpa') || lowerCat.includes('scarf')) return 'Sciarpe';
      if (lowerCat.includes('borsa') || lowerCat.includes('bag') || lowerCat.includes('zaino') || lowerCat.includes('backpack')) return 'Borse';
      if (lowerCat.includes('fascia') || lowerCat.includes('capitano') || lowerCat.includes('armband')) return 'Fasce Capitano';

      if (rawCat && rawCat.toLowerCase() !== 'accessori' && rawCat.toLowerCase() !== 'accessories' && rawCat.toLowerCase() !== 'other') {
        return rawCat.trim();
      }

      const lowerName = String(rawName || '').toLowerCase();
      if (lowerName.includes('calzetton') || lowerName.includes('knee sock')) return 'Calzettoni';
      if (lowerName.includes('calz') || lowerName.includes('grip') || lowerName.includes('sock') || lowerName.includes('anti-slip')) return 'Calze';
      if (lowerName.includes('guant') || lowerName.includes('glove')) return 'Guanti';
      if (lowerName.includes('pallon') || lowerName.includes('ball')) return 'Palloni';
      if (lowerName.includes('cappellin') || lowerName.includes('cap') || lowerName.includes('hat') || lowerName.includes('beanie')) return 'Cappellini';
      if (lowerName.includes('sciarpa') || lowerName.includes('scarf')) return 'Sciarpe';
      if (lowerName.includes('borsa') || lowerName.includes('bag') || lowerName.includes('zaino') || lowerName.includes('backpack')) return 'Borse';
      if (lowerName.includes('fascia') || lowerName.includes('capitano') || lowerName.includes('armband')) return 'Fasce Capitano';

      return 'Altri Accessori';
    };

    // Helper per trovare accessorio esistente
    const findExistingIndex = (item, list) => {
      const targetId = item.id !== undefined && item.id !== null ? String(item.id).trim() : '';
      const targetCodice = item.codice !== undefined && item.codice !== null ? String(item.codice).trim().toLowerCase() : '';
      const targetNome = (item.nome || item.name || item.title || item.versione || item.nome_finale || '').trim().toLowerCase();
      const targetCat = deduceCategory(item.categoria || item.category, targetNome).toLowerCase();
      const targetTaglia = (item.taglia || item.size || '').trim().toLowerCase();

      return list.findIndex(acc => {
        if (!acc) return false;
        const accId = String(acc.id || '').trim();
        const accCodice = String(acc.codice || '').trim().toLowerCase();
        const accNome = String(acc.nome || '').trim().toLowerCase();
        const accCat = String(acc.categoria || '').trim().toLowerCase();
        const accTaglia = String(acc.taglia || '').trim().toLowerCase();

        // 1. Corrispondenza per ID esplicito
        if (targetId && accId && targetId === accId) return true;
        // 2. Corrispondenza per Codice articolo esplicito
        if (targetCodice && accCodice && targetCodice === accCodice) return true;
        // 3. Corrispondenza per Nome + Categoria (+ Taglia se specificata)
        if (targetNome && accNome && targetNome === accNome && targetCat === accCat) {
          if (targetTaglia && accTaglia) return targetTaglia === accTaglia;
          return true;
        }
        return false;
      });
    };

    let updatedList = [...currentAccessories];

    accessories.forEach((item, index) => {
      const riga = index + 1;
      const nome = (item.nome || item.name || item.title || item.versione || item.nome_finale || item.product_title || item.product_name || item.item_name || '').toString().trim();
      const categoria = deduceCategory(item.categoria || item.category || item.cat, nome);
      
      const rawPrice = item.prezzo !== undefined ? item.prezzo : (item.price !== undefined ? item.price : (item.prezzo_vendita !== undefined ? item.prezzo_vendita : item.sale_price));
      let pPrezzo = parsePrice(rawPrice);
      if (pPrezzo === null) {
        pPrezzo = 0;
      }

      const rawCost = item.prezzo_fornitore !== undefined ? item.prezzo_fornitore : (item.costo_fornitore !== undefined ? item.costo_fornitore : (item.costo !== undefined ? item.costo : item.supplier_price));
      let pCosto = parsePrice(rawCost);
      if (pCosto === null) {
        pCosto = 0;
      }

      // Validazione base
      const errori = [];
      if (!nome || typeof nome !== 'string' || nome.trim() === '') {
        errori.push("Nome accessorio mancante");
      }
      if (pPrezzo === null || pPrezzo < 0) {
        errori.push("Prezzo non valido o mancante");
      }

      if (errori.length > 0) {
        countErrori++;
        erroriDettagli.push({ riga, nome: nome || `Elemento #${riga}`, errore: errori.join(', ') });
        return;
      }

      const pDisponibile = item.disponibile !== undefined ? (item.disponibile === true || String(item.disponibile).toLowerCase() === 'true' || item.disponibile === 1 || String(item.disponibile) === '1') : (item.disponibilita !== undefined ? (item.disponibilita === true || String(item.disponibilita).toLowerCase() === 'true') : true);
      const pStato = (item.stato && String(item.stato).toLowerCase() === 'disattivato') ? 'disattivato' : 'attivo';
      const pTaglia = (Array.isArray(item.taglia) ? item.taglia.join(', ') : (item.taglia || item.size || 'Unica')).toString().trim();
      
      let pImmagine = item.immagine || item.image || item.imgUrl || item.img || item.product_image || item.foto || 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=400&auto=format&fit=crop&q=80';
      if (Array.isArray(pImmagine)) pImmagine = pImmagine[0] || '';
      else if (typeof pImmagine === 'object') pImmagine = pImmagine.url || pImmagine.src || '';
      pImmagine = String(pImmagine).trim();
      if (pImmagine.startsWith('//')) pImmagine = 'https:' + pImmagine;

      const pDescrizione = (item.descrizione || item.description || '').toString().trim();

      const existingIdx = findExistingIndex(item, updatedList);

      if (existingIdx !== -1) {
        // Aggiorna accessorio esistente
        const old = updatedList[existingIdx];
        updatedList[existingIdx] = {
          ...old,
          nome: nome.trim(),
          categoria: categoria.trim(),
          codice: item.codice || old.codice || old.id,
          prezzo: pPrezzo,
          prezzo_fornitore: isNaN(pCosto) ? old.prezzo_fornitore : pCosto,
          taglia: pTaglia || old.taglia,
          immagine: pImmagine || old.immagine,
          descrizione: pDescrizione || old.descrizione,
          disponibile: pDisponibile,
          stato: pStato,
          tipo_catalogo: 'accessori',
          updated_at: new Date().toISOString()
        };
        countAggiornati++;
      } else {
        // Crea nuovo accessorio
        const newId = (item.id && !updatedList.some(a => String(a.id) === String(item.id))) 
          ? String(item.id).trim() 
          : `acc_${Date.now()}_${Math.floor(Math.random() * 1000)}_${index}`;
        
        const newCodice = item.codice ? String(item.codice).trim() : `ACC-${String(updatedList.length + 1).padStart(4, '0')}`;

        const newAccessory = {
          id: newId,
          codice: newCodice,
          nome: nome.trim(),
          categoria: categoria.trim(),
          prezzo: pPrezzo,
          prezzo_fornitore: isNaN(pCosto) ? 0 : pCosto,
          taglia: pTaglia,
          immagine: pImmagine,
          descrizione: pDescrizione,
          disponibile: pDisponibile,
          stato: pStato,
          tipo_catalogo: 'accessori',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        updatedList.push(newAccessory);
        countImportati++;
      }
    });

    saveLocalAccessories(updatedList);
    console.log(`[ACCESSORI IMPORT] Importazione completata: ${countImportati} creati, ${countAggiornati} aggiornati, ${countErrori} errori.`);

    return res.json({
      success: true,
      analizzati: accessories.length,
      importati: countImportati,
      aggiornati: countAggiornati,
      duplicati: countDuplicati,
      errori: countErrori,
      errori_dettagli: erroriDettagli,
      totalCount: updatedList.length
    });
  } catch (err) {
    console.error("⚠️ [ACCESSORI IMPORT] Errore POST /api/accessories/import_batch:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/settings/products/translate_all - Traduce tutti i prodotti nel database (Supabase o locale)
app.post('/api/settings/products/translate_all', async (req, res) => {
  console.log("[BACKEND] Ricevuta richiesta di traduzione globale dei prodotti");
  try {
    const supabase = getSupabaseClient();
    
    let productsToProcess = [];
    let isSupabase = false;
    
    if (supabase) {
      isSupabase = true;
      try {
        productsToProcess = await getAllProductsFromSupabase(supabase);
      } catch (error) {
        throw error;
      }
    } else if (fs.existsSync(LOCAL_PRODUCTS_FILE)) {
      productsToProcess = JSON.parse(fs.readFileSync(LOCAL_PRODUCTS_FILE, 'utf8'));
    } else {
      throw new Error("Nessun database configurato o trovato.");
    }
    
    let totalAnalyzed = productsToProcess.length;
    let totalUpdated = 0;
    let totalUnchanged = 0;
    const translationLogs = []; // Array di { id, original_versione, translated_versione, original_squadra, translated_squadra }

    // Esegui la traduzione per ogni prodotto
    for (let p of productsToProcess) {
      const origVersione = p.versione || '';
      const origSquadra = p.squadra || '';
      
      const newVersione = traduciTestoProdotto(origVersione);
      const newSquadra = traduciTestoProdotto(origSquadra);
      
      const hasChanged = (newVersione !== origVersione) || (newSquadra !== origSquadra);
      
      if (hasChanged) {
        totalUpdated++;
        if (translationLogs.length < 50) { // Limita i log da mostrare in UI per non sovraccaricare il payload
          translationLogs.push({
            id: p.id,
            original_versione: origVersione,
            translated_versione: newVersione,
            original_squadra: origSquadra,
            translated_squadra: newSquadra
          });
        }
        
        // Applica le modifiche all'oggetto
        p.versione = newVersione;
        p.squadra = newSquadra;
        
        // Se siamo su Supabase, aggiorna immediatamente nel DB
        if (isSupabase) {
          const { error: updateError } = await supabase
            .from('products')
            .update({ versione: newVersione, squadra: newSquadra })
            .eq('id', p.id);
          if (updateError) {
            console.error(`[BACKEND] Errore aggiornamento prodotto ${p.id}:`, updateError.message);
          }
        }
      } else {
        totalUnchanged++;
      }
    }
    
    // Se siamo in modalità locale, salviamo le modifiche nel file
    if (!isSupabase && fs.existsSync(LOCAL_PRODUCTS_FILE)) {
      fs.writeFileSync(LOCAL_PRODUCTS_FILE, JSON.stringify(productsToProcess, null, 2), 'utf8');
    }
    
    return res.json({
      success: true,
      source: isSupabase ? 'supabase' : 'local',
      stats: {
        analyzed: totalAnalyzed,
        updated: totalUpdated,
        unchanged: totalUnchanged
      },
      logs: translationLogs
    });
  } catch (err) {
    console.error("🔴 [BACKEND] ERRORE TRADUZIONE GLOBALE:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/products/:id - Elimina un prodotto direttamente da Supabase
app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error("Supabase client is not configured.");
    }

    const { data, error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
      .select();

    if (error) throw error;

    return res.json({ success: true, source: 'supabase', deleted: data });
  } catch (err) {
    console.warn("⚠️ Errore durante l'eliminazione su Supabase:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/lotto - Ottieni lo stato del lotto corrente
app.get('/api/lotto', async (req, res) => {
  try {
    const lotto = await recalculateCurrentLotto();
    return res.json({ success: true, lotto });
  } catch (err) {
    console.error("⚠️ Error recalculating lotto in GET /api/lotto:", err.message);
    const lottoFile = path.join(__dirname, 'lotto.json');
    let lotto = {
      numero_totale_articoli: 0,
      costo_totale_prodotti_usd: 0.0,
      spedizione_corrente_usd: 4.0,
      costo_complessivo_lotto_usd: 4.0,
      costo_totale_personalizzazioni_usd: 0.0
    };
    if (fs.existsSync(lottoFile)) {
      try {
        lotto = JSON.parse(fs.readFileSync(lottoFile, 'utf8'));
      } catch (e) {}
    }
    return res.json({ success: true, lotto });
  }
});

// GET /api/lotto/excel - Genera e scarica on-demand l'Excel del lotto corrente (IN CORSO)
app.get([
  '/api/lotto/excel',
  '/api/lotto/current/excel'
], async (req, res) => {
  return handleDownloadExcelLotto(req, res, getCurrentActiveLottoId());
});

// GET /api/lotto/:id/excel - Genera e scarica on-demand l'Excel del lotto specificato (in corso o archiviato)
app.get([
  '/api/lotto/:id/excel',
  '/api/lotto/:id/excel/:filename'
], async (req, res) => {
  return handleDownloadExcelLotto(req, res, req.params.id);
});

// Helper per ottenere in modo sicuro e universale l'ID del lotto attivo
function getCurrentActiveLottoId() {
  const lottoFile = path.join(__dirname, 'lotto.json');
  if (fs.existsSync(lottoFile)) {
    try {
      const lottoData = JSON.parse(fs.readFileSync(lottoFile, 'utf8'));
      if (lottoData && lottoData.id) {
        return Number(lottoData.id);
      }
    } catch (e) {}
  }
  return 1;
}

// GET /api/lotto/archive - Ottieni la cronologia dei lotti archiviati
function pulisciLottiArchivio() {
  try {
    const archiveFile = path.join(__dirname, 'lotto_archive.json');
    if (!fs.existsSync(archiveFile)) {
      return;
    }

    let archive = [];
    try {
      archive = JSON.parse(fs.readFileSync(archiveFile, 'utf8'));
    } catch (parseErr) {
      console.error("⚠️ Archivio lotti non leggibile o corrotto:", parseErr.message);
      return;
    }

    if (!Array.isArray(archive)) {
      return;
    }

    const filteredArchive = archive.filter(l => {
      const numeroLotto = l.numero_lotto;
      
      // Estraiamo i dati di articoli, ordini, incasso, profitto
      const numArticoli = l.numero_articoli !== undefined ? Number(l.numero_articoli) : (Number(l.numero_totale_articoli) || 0);
      const numOrdini = l.numero_ordini !== undefined ? Number(l.numero_ordini) : (l.orders ? l.orders.length : 0);
      
      // Calcolo incasso e profitto da stringa o numero
      const incasso = typeof l.incasso_totale_eur === 'number' ? l.incasso_totale_eur : parseItalianFloat(l.incasso_totale_eur || '');
      const profitto = typeof l.profitto_eur === 'number' ? l.profitto_eur : parseItalianFloat(l.profitto_eur || '');
      const costoTotUsd = typeof l.costo_totale_usd === 'number' ? l.costo_totale_usd : parseItalianFloat(l.costo_totale_usd || l.costo_complessivo_lotto_usd || '');

      // Condizione 1: Record di test vuoto con 0 ordini, 0 articoli, incasso 0, profitto 0
      if (numArticoli === 0 && numOrdini === 0 && incasso === 0 && profitto === 0 && costoTotUsd === 0) {
        console.log(`[BACKEND CLEANUP] Rimosso lotto di test vuoto archived_at: ${l.archived_at}`);
        return false;
      }

      // Condizione 2: numero_lotto esplicitamente nullo, undefined o vuoto
      if (numeroLotto !== undefined && (numeroLotto === null || String(numeroLotto).trim() === "" || String(numeroLotto) === "undefined")) {
        console.log(`[BACKEND CLEANUP] Rimosso lotto con numero_lotto non valido archived_at: ${l.archived_at}`);
        return false;
      }

      return true;
    });

    // Per i lotti reali rimasti, ci assicuriamo che abbiano un ID valido e coerente e i campi moderni compilati
    // senza rinumerare quelli esistenti che hanno già un ID valido
    let currentId = 1;
    const finalArchive = filteredArchive.map((l) => {
      const repairedLot = { ...l };
      
      if (repairedLot.id === undefined || repairedLot.id === null || isNaN(Number(repairedLot.id)) || Number(repairedLot.id) <= 0) {
        repairedLot.id = currentId;
        repairedLot.numero_lotto = `Lotto #${currentId}`;
      } else {
        repairedLot.id = Number(repairedLot.id);
        if (!repairedLot.numero_lotto) {
          repairedLot.numero_lotto = `Lotto #${repairedLot.id}`;
        }
      }

      currentId = Math.max(currentId, repairedLot.id) + 1;

      // Assicuriamo i campi moderni
      repairedLot.numero_ordini = repairedLot.numero_ordini !== undefined ? Number(repairedLot.numero_ordini) : (repairedLot.orders ? repairedLot.orders.length : 1);
      repairedLot.numero_articoli = repairedLot.numero_articoli !== undefined ? Number(repairedLot.numero_articoli) : (Number(repairedLot.numero_totale_articoli) || 0);
      repairedLot.incasso_totale_eur = repairedLot.incasso_totale_eur !== undefined ? Number(repairedLot.incasso_totale_eur) : 0;
      repairedLot.costo_prodotti_usd = repairedLot.costo_prodotti_usd !== undefined ? Number(repairedLot.costo_prodotti_usd) : (Number(repairedLot.costo_totale_prodotti_usd) || 0);
      repairedLot.costo_spedizione_usd = repairedLot.costo_spedizione_usd !== undefined ? Number(repairedLot.costo_spedizione_usd) : (Number(repairedLot.spedizione_corrente_usd) || 0);
      repairedLot.costo_totale_usd = repairedLot.costo_totale_usd !== undefined ? Number(repairedLot.costo_totale_usd) : (Number(repairedLot.costo_complessivo_lotto_usd) || 0);
      repairedLot.costo_totale_eur = repairedLot.costo_totale_eur !== undefined ? Number(repairedLot.costo_totale_eur) : Number((repairedLot.costo_totale_usd * 0.92).toFixed(2));
      repairedLot.profitto_eur = repairedLot.profitto_eur !== undefined ? Number(repairedLot.profitto_eur) : 0;
      repairedLot.margine_percentuale = repairedLot.margine_percentuale !== undefined ? Number(repairedLot.margine_percentuale) : 0;
      repairedLot.orders = repairedLot.orders || [];

      // Rimuoviamo i vecchi campi legacy
      delete repairedLot.numero_totale_articoli;
      delete repairedLot.costo_totale_prodotti_usd;
      delete repairedLot.spedizione_corrente_usd;
      delete repairedLot.costo_complessivo_lotto_usd;

      return repairedLot;
    });

    fs.writeFileSync(archiveFile, JSON.stringify(finalArchive, null, 2), 'utf8');
    console.log(`[BACKEND CLEANUP] Pulizia lotti completata. Rimasti ${finalArchive.length} lotti reali.`);
  } catch (err) {
    console.error("⚠️ Errore durante la pulizia automatica dei lotti:", err.message);
  }
}

/**
 * Riconcilia gli ordini di un lotto archiviato con la tabella 'orders'.
 * Se esistono ordini reali con lotto_id === lotto.id, restituisce gli ordini reali.
 * Altrimenti restituisce l'array lotto.orders salvato nello snapshot come fallback.
 */
function getOrdersForArchivedLotto(lotto, allOrders = []) {
  if (!lotto) return [];
  const lottoIdNum = Number(lotto.id);
  const realOrders = (allOrders || []).filter(o => Number(o.lotto_id) === lottoIdNum);
  if (realOrders.length > 0) {
    return realOrders;
  }
  return Array.isArray(lotto.orders) ? lotto.orders : [];
}

function calcolaNumeroArticoliOrdini(orders) {
  if (!Array.isArray(orders)) return 0;
  let total = 0;
  orders.forEach(order => {
    let cartItems = order.carrello;
    if (Array.isArray(cartItems) && cartItems.length > 0) {
      cartItems.forEach(item => {
        const isSped = isTechnicalShippingOrServiceLine(item.squadra || item.nome);
        if (!isSped) {
          total += parseInt(item.quantita) || 1;
        }
      });
    } else if (order.squadra) {
      const parts = String(order.squadra).split('/').map(p => p.trim()).filter(Boolean);
      parts.forEach(p => {
        if (!isTechnicalShippingOrServiceLine(p)) {
          const m = p.match(/^(\d+)x/i);
          total += m ? parseInt(m[1]) : 1;
        }
      });
    }
  });
  return total;
}

app.get('/api/lotto/archive', async (req, res) => {
  try {
    const allLotti = await getDbLotti();
    const settings = getSettings();
    const profitData = await getDbProfitShares();
    const allOrders = await getDbOrders();
    let localProducts = [];
    try {
      localProducts = getLocalProducts();
    } catch (e) {}
    let supabaseProducts = [];
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        supabaseProducts = await getAllProductsFromSupabase(supabase);
      }
    } catch (e) {}
    const allDbProducts = supabaseProducts.length > 0 ? supabaseProducts : localProducts;

    // Filtra per mostrare nella Cronologia solo i lotti con stato concluso/archiviato
    // Esclude lotti con status 'ripristinato', 'attivo' o 'riaperto'
    const closedArchive = (allLotti || []).filter(l => {
      const st = String(l.status || '').trim().toLowerCase();
      if (st === 'ripristinato' || st === 'attivo' || st === 'riaperto') {
        return false;
      }
      return true;
    });

    const currentActiveLottoId = getCurrentActiveLottoId();

    const enrichedArchive = await Promise.all(closedArchive.map(async (l) => {
      try {
        const lotOrders = getOrdersForArchivedLotto(l, allOrders);
        const splitData = await computeProfitSplitForLotto(l.id, {
          allOrders,
          profitData,
          lottoArchive: allLotti,
          settings,
          allDbProducts,
          currentActiveLottoId
        });

        const calculatedArticoli = lotOrders.length > 0 ? calcolaNumeroArticoliOrdini(lotOrders) : (l.numero_articoli || 0);
        const incassoBase = Number((splitData && splitData.incasso_base > 0) ? splitData.incasso_base : (l.incasso_totale_eur || 0));
        const incassoEffettivo = (splitData && splitData.incasso_effettivo !== undefined) ? splitData.incasso_effettivo : incassoBase;

        const extraExpensesUsd = Number(splitData?.extra_expenses_total_usd || l.spese_extra_usd || 0);
        const extraExpensesEur = Number(splitData?.extra_expenses_total_eur || l.spese_extra_eur || 0);

        const costoProdottiUsd = Number(l.costo_prodotti_usd || 0);
        const costoSpedizioneUsd = Number(l.costo_spedizione_usd || 0);
        const costoFornitoreUsd = Number(l.costo_fornitore_usd || (costoProdottiUsd + costoSpedizioneUsd));
        const alibabaFeeUsd = Number(l.alibaba_fee_usd !== undefined ? l.alibaba_fee_usd : (costoFornitoreUsd * 0.03));
        const alibabaFeeEur = Number(l.alibaba_fee_eur || convertUsdToEur(alibabaFeeUsd, null, 'GET /api/lotto/archive'));
        
        let costoFornitoreEur = 0;
        if (lotOrders && lotOrders.length > 0) {
          costoFornitoreEur = lotOrders.reduce((sum, ord) => {
            return sum + parseItalianFloat(ord["Costo totale (EUR)"] || ord.costo_totale_eur || '0');
          }, 0);
        }
        if (costoFornitoreEur === 0 && l.costo_fornitore_eur !== undefined && l.costo_fornitore_eur !== null && Number(l.costo_fornitore_eur) > 0) {
          costoFornitoreEur = Number(l.costo_fornitore_eur);
        }
        if (costoFornitoreEur === 0 && l.costo_totale_eur && Number(l.costo_totale_eur) > 0) {
          costoFornitoreEur = Math.max(0, Number(l.costo_totale_eur) - alibabaFeeEur - extraExpensesEur);
        }
        if (costoFornitoreEur === 0 && costoFornitoreUsd > 0) {
          costoFornitoreEur = convertUsdToEur(costoFornitoreUsd, null, 'GET /api/lotto/archive fallback');
        }
        costoFornitoreEur = Number(costoFornitoreEur.toFixed(2));

        const costoTotaleUsd = Number((costoFornitoreUsd + alibabaFeeUsd + extraExpensesUsd).toFixed(2));
        const costoTotaleEur = Number((costoFornitoreEur + alibabaFeeEur + extraExpensesEur).toFixed(2));
        const profittoEur = (splitData && splitData.profitto_lotto !== undefined)
          ? Number(splitData.profitto_lotto)
          : Number((incassoBase - costoTotaleEur).toFixed(2));
        const marginePercentuale = incassoBase > 0 ? Number(((profittoEur / incassoBase) * 100).toFixed(2)) : 0;

        return {
          ...l,
          orders: lotOrders,
          numero_ordini: lotOrders.length > 0 ? lotOrders.length : (l.numero_ordini || 0),
          numero_articoli: calculatedArticoli || (l.numero_articoli || 0),
          incasso_base_eur: incassoBase,
          incasso_effettivo_eur: incassoEffettivo,
          incasso_netto_eur: incassoEffettivo,
          spese_extra_usd: extraExpensesUsd,
          spese_extra_eur: extraExpensesEur,
          costo_totale_usd: costoTotaleUsd,
          costo_totale_eur: costoTotaleEur,
          profitto_eur: profittoEur,
          margine_percentuale: marginePercentuale,
          profit_split_summary: splitData
        };
      } catch (e) {
        const lotOrders = getOrdersForArchivedLotto(l, allOrders);
        return {
          ...l,
          orders: lotOrders,
          numero_ordini: lotOrders.length > 0 ? lotOrders.length : (l.numero_ordini || 0)
        };
      }
    }));

    return res.json({ success: true, archive: enrichedArchive });
  } catch (err) {
    console.error("⚠️ Errore lettura archivio lotti:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/lotto/archive/:id - Elimina DEFINITIVAMENTE un lotto archiviato e TUTTI i suoi ordini
app.delete('/api/lotto/archive/:id', async (req, res) => {
  const { id } = req.params;
  const numId = Number(id);
  console.log(`[BACKEND ELIMINA LOTTO] Richiesta di eliminazione definitiva per il Lotto ID: ${id}`);
  try {
    const archive = await getDbLotti();
    const targetLot = archive.find(l => Number(l.id) === numId) || (function() {
      const archiveFile = path.join(__dirname, 'lotto_archive.json');
      if (fs.existsSync(archiveFile)) {
        try {
          const raw = JSON.parse(fs.readFileSync(archiveFile, 'utf8'));
          if (Array.isArray(raw)) return raw.find(l => Number(l.id) === numId);
        } catch (e) {}
      }
      return null;
    })();

    const lotName = targetLot ? (targetLot.numero_lotto || `Lotto #${targetLot.id}`) : `Lotto #${numId}`;
    
    // Individua TUTTI gli ordini appartenenti ESCLUSIVAMENTE a questo lotto tramite lotto_id reale o snapshot
    const allOrders = await getDbOrders();
    const localOrders = getLocalOrders();
    const targetOrderIds = new Set();
    const targetOrderDates = new Set();

    // 1. Dallo snapshot del lotto
    if (targetLot && Array.isArray(targetLot.orders)) {
      targetLot.orders.forEach(o => {
        if (o.id !== undefined && o.id !== null) targetOrderIds.add(Number(o.id));
        if (o.data) targetOrderDates.add(String(o.data).trim());
      });
    }

    // 2. Da tutti gli ordini del database
    allOrders.forEach(o => {
      if (Number(o.lotto_id) === numId) {
        if (o.id !== undefined && o.id !== null) targetOrderIds.add(Number(o.id));
        if (o.data) targetOrderDates.add(String(o.data).trim());
      }
    });

    // 3. Dalla cache locale
    localOrders.forEach(o => {
      if (Number(o.lotto_id) === numId) {
        if (o.id !== undefined && o.id !== null) targetOrderIds.add(Number(o.id));
        if (o.data) targetOrderDates.add(String(o.data).trim());
      }
    });

    const orderIdsArray = Array.from(targetOrderIds).filter(id => !isNaN(id) && id > 0);
    const orderDatesArray = Array.from(targetOrderDates);

    console.log(`[BACKEND ELIMINA LOTTO] Trovati ${orderIdsArray.length} ordini (${orderDatesArray.length} date) associati al ${lotName}.`);

    // A) ELIMINAZIONE DA SUPABASE
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        // 1. Individua record in customer_orders collegati tramite admin_order_id o lotto_id
        let customerOrderIds = [];
        if (orderIdsArray.length > 0) {
          const { data: custByAdminId } = await supabase
            .from('customer_orders')
            .select('id')
            .in('admin_order_id', orderIdsArray);
          if (custByAdminId && Array.isArray(custByAdminId)) {
            custByAdminId.forEach(co => {
              if (co && co.id) customerOrderIds.push(co.id);
            });
          }
        }

        try {
          const { data: custByLotto } = await supabase
            .from('customer_orders')
            .select('id')
            .eq('lotto_id', numId);
          if (custByLotto && Array.isArray(custByLotto)) {
            custByLotto.forEach(co => {
              if (co && co.id && !customerOrderIds.includes(co.id)) customerOrderIds.push(co.id);
            });
          }
        } catch (eLottoCust) {}

        // 2. Elimina gli item in customer_order_items (se presenti)
        if (customerOrderIds.length > 0) {
          try {
            await supabase.from('customer_order_items').delete().in('order_id', customerOrderIds);
          } catch (eItem1) {}
          try {
            await supabase.from('customer_order_items').delete().in('customer_order_id', customerOrderIds);
          } catch (eItem2) {}

          // 3. Elimina da customer_orders
          await supabase.from('customer_orders').delete().in('id', customerOrderIds);
        }

        if (orderIdsArray.length > 0) {
          await supabase.from('customer_orders').delete().in('admin_order_id', orderIdsArray);
        }
        try {
          await supabase.from('customer_orders').delete().eq('lotto_id', numId);
        } catch (eCustDel) {}

        // 4. Elimina da orders per lotto_id e per ID
        await supabase.from('orders').delete().eq('lotto_id', numId);
        if (orderIdsArray.length > 0) {
          await supabase.from('orders').delete().in('id', orderIdsArray);
        }

        // 5. Elimina eventuali profit_shares per questo lotto (tabella dedicata profit_shares se presente)
        try {
          await supabase.from('profit_shares').delete().eq('lotto_id', numId);
        } catch (ePs) {}

        console.log(`✅ [BACKEND ELIMINA LOTTO] Supabase: eliminati ordini e relazioni per ${lotName}.`);
      } catch (subErr) {
        console.error("⚠️ [BACKEND ELIMINA LOTTO] Errore eliminazione Supabase:", subErr.message);
      }
    }

    // B) ELIMINAZIONE DA CACHE E FILE LOCALI
    // 1. Elimina extra_expenses, modifiche e percentuali appartenenti esclusivamente a questo lotto da profit_shares (settings / local)
    try {
      const profitData = await getDbProfitShares();
      let hasProfitChanges = false;
      if (Array.isArray(profitData.extra_expenses)) {
        const initialLen = profitData.extra_expenses.length;
        profitData.extra_expenses = profitData.extra_expenses.filter(e => Number(e.lotto_id) !== numId);
        if (profitData.extra_expenses.length !== initialLen) {
          hasProfitChanges = true;
          console.log(`✅ [BACKEND ELIMINA LOTTO] Eliminate ${initialLen - profitData.extra_expenses.length} spese extra associate al ${lotName}.`);
        }
      }
      if (profitData.lot_percentages && (profitData.lot_percentages[String(numId)] || profitData.lot_percentages[numId])) {
        delete profitData.lot_percentages[String(numId)];
        delete profitData.lot_percentages[numId];
        hasProfitChanges = true;
      }
      if (profitData.modifications && typeof profitData.modifications === 'object') {
        const initialMods = Object.keys(profitData.modifications).length;
        const newMods = {};
        for (const [k, v] of Object.entries(profitData.modifications)) {
          const modLotId = v?.lotto_id !== undefined ? Number(v.lotto_id) : (orderIdsArray.includes(Number(k)) ? numId : null);
          if (modLotId !== numId) {
            newMods[k] = v;
          }
        }
        if (Object.keys(newMods).length !== initialMods) {
          profitData.modifications = newMods;
          hasProfitChanges = true;
        }
      }
      if (hasProfitChanges) {
        await saveDbProfitShares(profitData);
      }
    } catch (eProfitDel) {
      console.warn("⚠️ [BACKEND ELIMINA LOTTO] Errore pulizia profit_shares per il lotto eliminato:", eProfitDel.message);
    }
    // 1. Elimina da orders_local.json
    try {
      const currentLoc = getLocalOrders();
      const filteredLoc = currentLoc.filter(o => {
        if (Number(o.lotto_id) === numId) return false;
        if (o.id !== undefined && o.id !== null && targetOrderIds.has(Number(o.id))) return false;
        return true;
      });
      fs.writeFileSync(LOCAL_ORDERS_FILE, JSON.stringify(filteredLoc, null, 2), 'utf8');
      console.log(`✅ [BACKEND ELIMINA LOTTO] orders_local.json aggiornato: rimossi ordini del ${lotName}.`);
    } catch (eLoc) {
      console.warn("⚠️ [BACKEND ELIMINA LOTTO] Errore aggiornamento orders_local.json:", eLoc.message);
    }

    // 2. Elimina date da archived_orders.json
    try {
      if (orderDatesArray.length > 0) {
        let archivedKeys = getArchivedKeys();
        archivedKeys = archivedKeys.filter(k => !orderDatesArray.includes(String(k).trim()));
        saveArchivedKeys(archivedKeys);
      }
    } catch (eArch) {}

    // 3. Rimuovi file Excel fornitore
    try {
      const excelFileName = `LOTTO_${String(numId).padStart(4, '0')}.xlsx`;
      const excelFilePath = path.join(__dirname, 'lotti', excelFileName);
      if (fs.existsSync(excelFilePath)) {
        fs.unlinkSync(excelFilePath);
        console.log(`✅ [BACKEND ELIMINA LOTTO] File Excel rimosso: ${excelFileName}`);
      }
    } catch (eEx) {}

    // C) ELIMINA IL RECORD DEL LOTTO (Supabase 'lotti' table + lotto_archive.json)
    await deleteDbLotto(numId);

    // D) RICALCOLA LO STATO DEL LOTTO CORRENTE
    const updatedLotto = await recalculateCurrentLottoInternal();

    console.log(`[BACKEND ELIMINA LOTTO] ✅ ${lotName} e tutti i suoi ${orderIdsArray.length} ordini eliminati definitivamente.`);
    return res.json({ 
      success: true, 
      message: `${lotName} e tutti i suoi ${orderIdsArray.length} ordini sono stati eliminati definitivamente.`, 
      lotName, 
      deletedOrdersCount: orderIdsArray.length,
      lotto: updatedLotto
    });
  } catch (err) {
    console.error("⚠️ [BACKEND ELIMINA LOTTO] Errore durante l'eliminazione del lotto:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/lotto/archive/:id/restore (o /api/lotto/restore/:id) - Ripristina un lotto archiviato riportandolo allo stato ATTIVO
const handleLottoRestore = async (req, res) => {
  const { id } = req.params;
  const numId = Number(id);
  console.log(`[LOTTO RESTORE DEBUG]\nBACKEND ENDPOINT CHIAMATO\nlottoId: ${id}`);
  console.log(`[LOTTO RESTORE DEBUG]\nRICERCA LOTTO\nlottoId: ${numId}`);

  return runWithLottoLock(async () => {
    try {
      const archive = await getDbLotti();
      let targetLot = archive.find(l => Number(l.id) === numId);
      
      // Fallback: se non è nel db lotti, controlla direttamente lotto_archive.json
      if (!targetLot) {
        const archiveFile = path.join(__dirname, 'lotto_archive.json');
        if (fs.existsSync(archiveFile)) {
          try {
            const rawArchive = JSON.parse(fs.readFileSync(archiveFile, 'utf8'));
            if (Array.isArray(rawArchive)) {
              targetLot = rawArchive.find(l => Number(l.id) === numId);
            }
          } catch (e) {}
        }
      }

      console.log(`[LOTTO RESTORE DEBUG]\nLOTTO TROVATO: ${targetLot ? 'YES' : 'NO'}`);

      const allOrders = await getDbOrders();

      // Controllo idempotenza: se il lotto non è in archivio ma i suoi ordini sono già attivi
      if (!targetLot) {
        const alreadyActive = allOrders.filter(o => !o.is_archived && isOrderActiveForLotto(o) && Number(o.lotto_id) === numId);
        if (alreadyActive.length > 0) {
          console.log(`[BACKEND Ripristina Lotto] Lotto #${numId} è già attivo (richiesta idempotente).`);
          const currentLotto = await recalculateCurrentLottoInternal();
          return res.json({
            success: true,
            message: `Il Lotto #${numId} è già attivo.`,
            restoredOrdersCount: alreadyActive.length,
            lotto: currentLotto
          });
        }
        return res.status(404).json({ success: false, error: `Lotto con ID ${numId} non trovato nei lotti archiviati.` });
      }

      console.log(`[LOTTO RESTORE DEBUG]\nSTATO LOTTO ATTUALE: ${targetLot.status || 'ARCHIVIATO / CHIUSO'}`);
      let lotSnapshotOrders = (targetLot.orders || []).filter(o => !o.is_tracking_meta);
      
      // Se lo snapshot nel lotto è vuoto, cerca ordini associati a questo lotto_id nei file locali o db
      if (lotSnapshotOrders.length === 0) {
        const localMatched = getLocalOrders().filter(o => Number(o.lotto_id) === numId);
        if (localMatched.length > 0) {
          lotSnapshotOrders = localMatched;
          console.log(`[LOTTO RESTORE DEBUG] Recuperati ${lotSnapshotOrders.length} ordini associati al Lotto #${numId} da cache locale.`);
        }
      }

      console.log(`[LOTTO RESTORE DEBUG]\nORDINI ASSOCIATI AL LOTTO: ${lotSnapshotOrders.length}`);

      if (lotSnapshotOrders.length === 0) {
        return res.status(400).json({
          success: false,
          error: `Nessun ordine trovato nello snapshot del Lotto #${numId}. Impossibile ripristinare un lotto vuoto.`
        });
      }

      // Controllo conflitti: verifichiamo se esistono ordini attivi associati a un ALTRO lotto
      const otherActiveOrders = allOrders.filter(o => !o.is_archived && isOrderActiveForLotto(o) && o.lotto_id !== null && o.lotto_id !== undefined && Number(o.lotto_id) !== numId);
      if (otherActiveOrders.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Impossibile ripristinare il Lotto #${numId}: sono già presenti ${otherActiveOrders.length} ordini attivi associati a un altro lotto (Lotto #${otherActiveOrders[0].lotto_id || 'attivo'}). Concludi o archivia prima il lotto attivo.`
        });
      }

      const orderDates = lotSnapshotOrders.map(o => o.data).filter(Boolean);
      const orderAdminIds = lotSnapshotOrders.map(o => o.id).filter(Boolean);

      console.log(`[BACKEND Ripristina Lotto] Ripristino del Lotto #${numId} (${lotSnapshotOrders.length} ordini) allo stato ATTIVO.`);

      const supabase = getSupabaseClient();
      const localOrders = getLocalOrders();

      let restoredCount = 0;
      let existingCount = 0;
      let recreatedCount = 0;
      let failedOrders = [];

      // 1. Ripristino / Ricostruzione NON DISTRUTTIVA di ciascun ordine preservando CATEGORICAMENTE l'ID originale
      for (const snapOrder of lotSnapshotOrders) {
        const snapDate = snapOrder.data ? String(snapOrder.data).trim() : null;
        const snapId = snapOrder.id ? Number(snapOrder.id) : null;

        // Cerca se l'ordine esiste già nel DB o in memoria
        const existingDbOrder = allOrders.find(dbO => 
          (snapId && Number(dbO.id) === snapId) ||
          (snapDate && String(dbO.data).trim() === snapDate)
        );

        if (existingDbOrder) {
          existingCount++;
          // Ordine esistente: aggiorna is_archived = false e lotto_id = numId preservando l'ID
          if (supabase) {
            try {
              if (existingDbOrder.id) {
                await supabase.from('orders').update({
                  is_archived: false,
                  lotto_id: numId
                }).eq('id', existingDbOrder.id);
              } else if (existingDbOrder.data) {
                await supabase.from('orders').update({
                  is_archived: false,
                  lotto_id: numId
                }).eq('data', existingDbOrder.data);
              }
            } catch (errUpd) {
              console.warn(`⚠️ Errore aggiornamento ordine esistente ID ${existingDbOrder.id || existingDbOrder.data}:`, errUpd.message);
              failedOrders.push({ id: snapId, date: snapDate, reason: errUpd.message });
            }
          }
        } else {
          // Ordine non trovato su Supabase: REINSERISCILO PRESERVANDO L'ID ORIGINALE ESPLICITO
          recreatedCount++;
          console.log(`[BACKEND Ripristina Lotto] Ordine #${snapId || snapDate} mancante su Supabase: REINSERIMENTO CON ID ORIGINALE ${snapId}...`);
          
          const orderToUpsert = {
            ...(snapId ? { id: snapId } : {}), // PRESERVA CATEGORICAMENTE L'ID ORIGINALE!
            data: snapOrder.data || new Date().toLocaleString('it-IT'),
            nome: snapOrder.nome || 'Cliente',
            telefono: snapOrder.telefono || '',
            squadra: snapOrder.squadra || '',
            personalizzazione: snapOrder.personalizzazione || '',
            taglia: snapOrder.taglia || '',
            totale: snapOrder.totale || '0,00€',
            foto: snapOrder.foto || '',
            prezzo_fornitore: snapOrder["Prezzo fornitore"] || snapOrder.prezzo_fornitore || '',
            costo_prodotti_usd: snapOrder["Costo prodotti (USD)"] || snapOrder.costo_prodotti_usd || '0',
            costo_spedizione_usd: snapOrder["Costo spedizione (USD)"] || snapOrder["osto spedizione (USD)"] || snapOrder.costo_spedizione_usd || '0',
            costo_totale_usd: snapOrder["Costo totale (USD)"] || snapOrder.costo_totale_usd || '0',
            cambio_usd_eur: snapOrder["Cambio USD/EUR"] || snapOrder.cambio_usd_eur || '0',
            costo_totale_eur: snapOrder["Costo totale (EUR)"] || snapOrder.costo_totale_eur || '0',
            profitto_eur: snapOrder["Profitto (EUR)"] || snapOrder.profitto_eur || '0',
            is_archived: false,
            lotto_id: numId,
            carrello: snapOrder.carrello || [],
            coupon_code: snapOrder.coupon_code || null,
            coupon_discount: snapOrder.coupon_discount !== undefined && snapOrder.coupon_discount !== null ? Number(snapOrder.coupon_discount) : null,
            coupon_type: snapOrder.coupon_type || null,
            coupon_value: snapOrder.coupon_value !== undefined && snapOrder.coupon_value !== null ? Number(snapOrder.coupon_value) : null
          };

          if (supabase) {
            try {
              const { error: insErr } = await supabase
                .from('orders')
                .upsert(orderToUpsert, { onConflict: snapId ? 'id' : 'data' });
              if (insErr) {
                console.error(`⚠️ Errore reinserimento ordine #${snapId} su Supabase:`, insErr.message);
              } else {
                console.log(`✅ Ordine #${snapId} reinserito con successo su Supabase con ID originale immutato.`);
              }
            } catch (errRecreate) {
              console.error("⚠️ Eccezione durante la ricostruzione ordine:", errRecreate.message);
            }
          }
        }

        // Sincronizza lo stato nella cache locale orders_local.json preservando ID
        const locIdx = localOrders.findIndex(lo => 
          (snapId && Number(lo.id) === snapId) ||
          (snapDate && String(lo.data).trim() === snapDate)
        );
        if (locIdx !== -1) {
          localOrders[locIdx].is_archived = false;
          localOrders[locIdx].lotto_id = numId;
          if (snapId && !localOrders[locIdx].id) localOrders[locIdx].id = snapId;
        } else {
          localOrders.push({
            ...snapOrder,
            id: snapId || snapOrder.id,
            is_archived: false,
            lotto_id: numId
          });
        }
        restoredCount++;
      }

      // Salva la cache locale orders_local.json aggiornata
      try {
        fs.writeFileSync(LOCAL_ORDERS_FILE, JSON.stringify(localOrders, null, 2), 'utf8');
      } catch (errLocal) {
        console.warn("⚠️ Errore scrittura cache locale orders:", errLocal.message);
      }

      // 2. Aggiorna tabella customer_orders per riattivare lo stato a 'Ordine ricevuto'
      if (supabase && orderAdminIds.length > 0) {
        try {
          await supabase.from('customer_orders').update({
            status: 'Ordine ricevuto',
            updated_at: new Date().toISOString()
          }).in('admin_order_id', orderAdminIds);
          console.log(`✅ ${orderAdminIds.length} record in customer_orders riallineati a 'Ordine ricevuto'.`);
        } catch (subErr) {
          console.warn("⚠️ Errore aggiornamento customer_orders su Supabase:", subErr.message);
        }
      }

      // 3. REGOLA FONDAMENTALE #9: VERIFICA DI INTEGRITÀ AL 100% PRIMA DI CONFERMARE
      const updatedAllOrders = await getDbOrders();
      const verifiedActiveOrders = updatedAllOrders.filter(o => !o.is_archived && isOrderActiveForLotto(o) && Number(o.lotto_id) === numId);

      console.log("\n================ [LOTTO RESTORE AUDIT LOG] ================");
      console.log(`LOTTO_ID: ${numId}`);
      console.log(`EXPECTED_ORDERS: ${lotSnapshotOrders.length}`);
      console.log(`RESTORED_ORDERS: ${restoredCount}`);
      console.log(`VERIFIED_ACTIVE_ORDERS: ${verifiedActiveOrders.length}`);
      console.log(`EXISTING_ORDERS: ${existingCount}`);
      console.log(`RECREATED_ORDERS: ${recreatedCount}`);
      console.log(`ANOMALIES_DETECTED: ${failedOrders.length}`);
      console.log(`ID_PRESERVED: SI (100% immutabilità)`);
      console.log(`CUSTOMER_LINKS_PRESERVED: SI (admin_order_id preservati)`);
      console.log(`SNAPSHOT_PRESERVED: SI (NESSUNA CANCELLAZIONE DISTRUTTIVA)`);
      console.log("============================================================\n");

      if (verifiedActiveOrders.length < lotSnapshotOrders.length) {
        console.error(`🔴 [LOTTO RESTORE] VERIFICA FALLITA: attesi ${lotSnapshotOrders.length} ordini, verificati ${verifiedActiveOrders.length}`);
        return res.status(500).json({
          success: false,
          error: `Verifica ripristino incompleta: attesi ${lotSnapshotOrders.length} ordini, verificati ${verifiedActiveOrders.length}. Nessun dato è stato cancellato.`,
          expectedCount: lotSnapshotOrders.length,
          verifiedCount: verifiedActiveOrders.length,
          failedOrders
        });
      }

      // 4. Rimuovi il lotto dall'archivio (Supabase 'lotti' + lotto_archive.json) così che non compaia più nella Cronologia Lotti
      await deleteDbLotto(numId);
      console.log(`✅ Lotto #${numId} rimosso dalla Cronologia Lotti e riattivato come lotto corrente.`);

      // 5. Rimuovi le date da archived_orders.json SOLO ORA che la verifica è passata al 100%
      let archivedKeys = getArchivedKeys();
      archivedKeys = archivedKeys.filter(k => !orderDates.includes(k));
      saveArchivedKeys(archivedKeys);

      // 6. Ricalcola il lotto corrente attivo con tutti i dati completi
      const updatedLotto = await recalculateCurrentLottoInternal();

      console.log(`[BACKEND Ripristina Lotto] ✅ Lotto #${numId} ripristinato con successo allo stato ATTIVO (100% VERIFICATO).`);
      return res.json({
        success: true,
        message: `Lotto #${numId} (${lotSnapshotOrders.length} ordini) ripristinato con successo allo stato attivo!`,
        restoredOrdersCount: lotSnapshotOrders.length,
        verifiedOrdersCount: verifiedActiveOrders.length,
        lotto: updatedLotto
      });
    } catch (err) {
      console.error("⚠️ Errore durante il ripristino del lotto:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });
};

app.post('/api/lotto/archive/:id/restore', handleLottoRestore);
app.post('/api/lotto/restore/:id', handleLottoRestore);

// Helper parsing functions for server-side Lot aggregation
function parseFlexibleDecimal(valStr) {
  if (valStr === undefined || valStr === null) return 0;
  if (typeof valStr === 'number') return isNaN(valStr) ? 0 : valStr;
  let clean = valStr.toString().replace('€', '').replace('$', '').replace(/\s/g, '').trim();
  if (!clean) return 0;
  
  if (clean.includes(',') && clean.includes('.')) {
    if (clean.indexOf(',') > clean.indexOf('.')) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else {
      clean = clean.replace(/,/g, '');
    }
  } else if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  }
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}

function parseItalianFloat(str) {
  if (!str) return 0;
  let clean = String(str).replace('€', '').replace(/\s/g, '');
  if (clean.includes('.') && clean.includes(',')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  }
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}

function estraiNumeroArticoliServer(squadraStr) {
  if (!squadraStr) return 0;
  const tempOrder = { squadra: squadraStr };
  const cartItems = ricostruisciCarrelloDaStringhe(tempOrder);
  let totale = 0;
  cartItems.forEach(item => {
    const isSpedizione = item.squadra && isTechnicalShippingOrServiceLine(item.squadra);
    if (isSpedizione) return;
    totale += parseInt(item.quantita) || 1;
  });
  return totale;
}

function isOrderActiveForLotto(order) {
  if (!order) return false;
  const statusStr = String(order.status || order.data_status || order.stato || (order.data && order.data.status) || '').trim().toLowerCase();
  if (statusStr === 'annullato_dal_cliente' || statusStr === 'annullato dal cliente' || statusStr === 'annullato' || statusStr.includes('annullat') || statusStr === 'canceled' || statusStr === 'cancelled') {
    return false;
  }
  return true;
}

function parseOrderTotalCustomerPaid(order) {
  if (!order) return 0;
  const raw = order.totale !== undefined ? order.totale : (order.totale_ordine !== undefined ? order.totale_ordine : (order.total !== undefined ? order.total : 0));
  if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;
  const str = String(raw).trim().replace('€', '').replace(/\s/g, '');
  const parsed = parseFloat(str.replace(/\./g, '').replace(',', '.'));
  return isNaN(parsed) ? 0 : parsed;
}

function calculateLottoTotals(orders, settings, extraExpenses = []) {
  if (!settings) {
    settings = getSettings();
  }
  let numero_totale_articoli = 0;
  let costo_totale_prodotti_usd = 0.0;
  let costo_totale_personalizzazioni_usd = 0.0;

  orders.forEach(order => {
    if (!isOrderActiveForLotto(order)) return;

    let cartItems = order.carrello;
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      cartItems = ricostruisciCarrelloDaStringhe(order);
    }

    let order_items_count = 0;
    cartItems.forEach(item => {
      const isSpedizioneCliente = item.squadra && isTechnicalShippingOrServiceLine(item.squadra);
      if (isSpedizioneCliente) return;

      const q = parseInt(item.quantita) || 1;
      order_items_count += q;

      const persCost = calcolaCostoFornitoreProdotto(0, item.infoPerso || item.personalizzazione);
      costo_totale_personalizzazioni_usd += persCost * q;
    });

    numero_totale_articoli += order_items_count;

    const rawCost = order["Costo prodotti (USD)"] || order.costo_prodotti_usd || '0';
    costo_totale_prodotti_usd += parseItalianFloat(String(rawCost));
  });

  const spedizione_unitaria = getShippingRateByQuantity(numero_totale_articoli, settings);
  const spedizione_corrente_usd = Number((numero_totale_articoli * spedizione_unitaria).toFixed(2));
  const costo_fornitore_usd = Number((costo_totale_prodotti_usd + spedizione_corrente_usd).toFixed(2));
  const costo_complessivo_lotto_usd = costo_fornitore_usd;

  // Calcolo Spese Extra Lotto in USD ed EUR
  let spese_extra_usd = 0;
  let spese_extra_eur = 0;
  const exchangeRate = getOrderEffectiveExchangeRate({}, settings);

  if (Array.isArray(extraExpenses)) {
    for (const exp of extraExpenses) {
      const expUsd = Number(exp.total_usd) || (Number(exp.quantity || 1) * Number(exp.unit_price_usd || 0));
      const expRate = Number(exp.exchange_rate) > 0 ? Number(exp.exchange_rate) : exchangeRate;
      const expEur = Number(exp.total_eur) || convertUsdToEur(expUsd, expRate, 'calculateLottoTotals');
      spese_extra_usd += expUsd;
      spese_extra_eur += expEur;
    }
  }
  spese_extra_usd = Number(spese_extra_usd.toFixed(2));
  spese_extra_eur = Number(spese_extra_eur.toFixed(2));

  // Alibaba Payment Processing Fee (3% sul totale ordine fornitore in USD)
  const alibaba_fee_percent = (settings?.alibabaFee?.percentage !== undefined && settings?.alibabaFee?.percentage !== null)
    ? Number(settings.alibabaFee.percentage)
    : 3.0;
  const alibaba_fee_usd = Number((costo_complessivo_lotto_usd * (alibaba_fee_percent / 100)).toFixed(2));
  const alibaba_fee_eur = convertUsdToEur(alibaba_fee_usd, exchangeRate, 'calculateLottoTotals');

  // COSTO TOTALE LOTTO USD = Costo Prodotti USD + Spedizione USD + Fee USD + Spese Extra USD
  const costo_totale_reale_lotto_usd = Number((costo_fornitore_usd + alibaba_fee_usd + spese_extra_usd).toFixed(2));

  return {
    numero_totale_articoli,
    costo_totale_prodotti_usd: Number(costo_totale_prodotti_usd.toFixed(2)),
    spedizione_corrente_usd,
    costo_fornitore_usd,
    costo_complessivo_lotto_usd,
    spedizione_unitaria,
    costo_totale_personalizzazioni_usd: Number(costo_totale_personalizzazioni_usd.toFixed(2)),
    alibaba_fee_percent,
    alibaba_fee_usd,
    alibaba_fee_eur,
    spese_extra_usd,
    spese_extra_eur,
    costo_totale_usd: costo_totale_reale_lotto_usd,
    costo_totale_reale_lotto_usd
  };
}

async function getProssimoLottoId() {
  try {
    const archive = await getDbLotti();
    const archivedOnly = archive.filter(l => l.status === 'archived' || (l.archived_at && l.archived_at !== 'In corso' && l.archived_at !== 'Attivo'));
    const maxId = archivedOnly.reduce((max, l) => {
      const currentId = Number(l.id || 0);
      return currentId > max ? currentId : max;
    }, 0);
    return maxId + 1;
  } catch (err) {
    console.error("⚠️ Error calculating getProssimoLottoId, fallback to 1:", err.message);
    return 1;
  }
}

let lottoMutexPromise = Promise.resolve();

function runWithLottoLock(fn) {
  const next = lottoMutexPromise.then(() => fn()).catch(err => {
    console.error("⚠️ Errore nell'operazione atomica del lotto:", err);
    throw err;
  });
  lottoMutexPromise = next.catch(() => {});
  return next;
}

async function recalculateCurrentLottoInternal() {
  const lottoFile = path.join(__dirname, 'lotto.json');
  let settings = getSettings();
  let activeOrders = [];
  let currentLottoId = 1;
  let allOrders = [];
  try {
    const archive = await getDbLotti();
    allOrders = await getDbOrders();
    const unarchivedOrders = allOrders.filter(o => !o.is_archived && isOrderActiveForLotto(o));
    
    // Controlla se gli ordini non archiviati appartengono a un lotto_id esplicito (es. lotto ripristinato)
    const explicitLottoId = unarchivedOrders.find(o => o.lotto_id !== null && o.lotto_id !== undefined)?.lotto_id;
    
    if (explicitLottoId !== undefined && explicitLottoId !== null) {
      currentLottoId = Number(explicitLottoId);
    } else {
      const archivedOnly = archive.filter(l => l.status === 'archived' || (l.archived_at && l.archived_at !== 'In corso' && l.archived_at !== 'Attivo'));
      const maxArchivedId = archivedOnly.reduce((max, l) => {
        const cId = Number(l.id || 0);
        return cId > max ? cId : max;
      }, 0);
      currentLottoId = maxArchivedId + 1;
    }
    
    activeOrders = unarchivedOrders.filter(o => o.lotto_id === null || o.lotto_id === undefined || Number(o.lotto_id) === Number(currentLottoId));
  } catch (err) {
    console.error("⚠️ Error fetching active orders for recalculating lotto:", err.message);
    if (fs.existsSync(lottoFile)) {
      try {
        return JSON.parse(fs.readFileSync(lottoFile, 'utf8'));
      } catch (e) {}
    }
    return {
      id: 1,
      prossimo_lotto_id: 1,
      numero_totale_articoli: 0,
      costo_totale_prodotti_usd: 0.0,
      spedizione_corrente_usd: 0.0,
      costo_complessivo_lotto_usd: 0.0,
      costo_totale_personalizzazioni_usd: 0.0
    };
  }

  let lotExtraExpenses = [];
  try {
    const profitData = await getDbProfitShares();
    const allExtra = Array.isArray(profitData.extra_expenses) ? profitData.extra_expenses : [];
    lotExtraExpenses = allExtra.filter(e => e.lotto_id !== undefined && e.lotto_id !== null && Number(e.lotto_id) === Number(currentLottoId));
  } catch (errExp) {
    console.warn("⚠️ Impossibile caricare spese extra per ricalcolo lotto:", errExp.message);
  }

  const totals = calculateLottoTotals(activeOrders, settings, lotExtraExpenses);
  const currentUnitShippingRate = totals.spedizione_unitaria;

  // Sincronizza dinamicamente la tariffa di spedizione e tutti i calcoli economici di TUTTI gli ordini attivi del lotto
  if (activeOrders.length > 0) {
    let hasOrderChanges = false;
    const supabase = getSupabaseClient();

    for (const ord of activeOrders) {
      let cartItems = ord.carrello;
      if (!Array.isArray(cartItems) || cartItems.length === 0) {
        cartItems = ricostruisciCarrelloDaStringhe(ord);
      }

      let orderItemCount = 0;
      cartItems.forEach(item => {
        const isSpedizioneCliente = item.squadra && isTechnicalShippingOrServiceLine(item.squadra);
        if (!isSpedizioneCliente) {
          orderItemCount += parseInt(item.quantita) || 1;
        }
      });

      const rawProdCostUSD = parseItalianFloat(String(ord["Costo prodotti (USD)"] || ord.costo_prodotti_usd || '0'));
      const newShippingUSD = Number((orderItemCount * currentUnitShippingRate).toFixed(2));
      const newTotalCostUSD = Number((rawProdCostUSD + newShippingUSD).toFixed(2));
      const orderRate = getOrderEffectiveExchangeRate(ord, settings);
      const newTotalCostEUR = convertUsdToEur(newTotalCostUSD, orderRate, 'recalculateCurrentLottoInternal');
      const totalPaidCliente = parseOrderTotalCustomerPaid(ord);
      const newProfitEUR = Number((totalPaidCliente - newTotalCostEUR).toFixed(2));

      const prevShippingStr = String(ord["Costo spedizione (USD)"] || ord.costo_spedizione_usd || '');
      const newShippingStr = newShippingUSD.toFixed(2).replace('.', ',');

      if (prevShippingStr !== newShippingStr || !ord.costo_totale_eur || ord.costo_spedizione_usd !== newShippingStr) {
        hasOrderChanges = true;
      }

      ord["Costo spedizione (USD)"] = newShippingStr;
      ord["osto spedizione (USD)"] = newShippingStr;
      ord["Costo totale (USD)"] = newTotalCostUSD.toFixed(2).replace('.', ',');
      ord["Costo totale (EUR)"] = newTotalCostEUR.toFixed(2).replace('.', ',');
      ord["Profitto (EUR)"] = newProfitEUR.toFixed(2).replace('.', ',');

      ord.costo_spedizione_usd = newShippingStr;
      ord.costo_totale_usd = newTotalCostUSD.toFixed(2).replace('.', ',');
      ord.costo_totale_eur = newTotalCostEUR.toFixed(2).replace('.', ',');
      ord.profitto_eur = newProfitEUR.toFixed(2).replace('.', ',');

      if (supabase && ord.id) {
        try {
          await supabase.from('orders').update({
            costo_spedizione_usd: newShippingStr,
            costo_totale_usd: newTotalCostUSD.toFixed(2).replace('.', ','),
            costo_totale_eur: newTotalCostEUR.toFixed(2).replace('.', ','),
            profitto_eur: newProfitEUR.toFixed(2).replace('.', ',')
          }).eq('id', ord.id);
        } catch (supErr) {
          console.warn(`⚠️ Errore aggiornamento ordine ${ord.id} su Supabase durante ricalcolo lotto:`, supErr.message);
        }
      }
    }

    try {
      const localOrders = getLocalOrders();
      activeOrders.forEach(ao => {
        const idx = localOrders.findIndex(lo => (lo.id && String(lo.id) === String(ao.id)) || (lo.data && lo.data === ao.data));
        if (idx !== -1) {
          localOrders[idx] = { ...localOrders[idx], ...ao };
        }
      });
      fs.writeFileSync(LOCAL_ORDERS_FILE, JSON.stringify(localOrders, null, 2), 'utf8');
    } catch (errLocal) {
      console.warn("⚠️ Errore salvataggio local orders durante ricalcolo lotto:", errLocal.message);
    }
  }

  console.log(`[GLOBAL SHIPPING RECALC DEBUG]\nlottoId: ${currentLottoId}\ntotalQuantity: ${totals.numero_totale_articoli}\nshippingRate: ${currentUnitShippingRate}\nordersAffected: ${activeOrders.length}\ntotalShipping: ${totals.spedizione_corrente_usd}`);

  const updatedLotto = {
    id: currentLottoId,
    prossimo_lotto_id: currentLottoId,
    numero_totale_articoli: totals.numero_totale_articoli,
    costo_totale_prodotti_usd: totals.costo_totale_prodotti_usd,
    spedizione_corrente_usd: totals.spedizione_corrente_usd,
    costo_fornitore_usd: totals.costo_fornitore_usd,
    costo_complessivo_lotto_usd: totals.costo_totale_reale_lotto_usd,
    costo_totale_personalizzazioni_usd: totals.costo_totale_personalizzazioni_usd,
    alibaba_fee_percent: totals.alibaba_fee_percent,
    alibaba_fee_usd: totals.alibaba_fee_usd,
    alibaba_fee_eur: totals.alibaba_fee_eur,
    spese_extra_usd: totals.spese_extra_usd,
    spese_extra_eur: totals.spese_extra_eur,
    costo_totale_usd: totals.costo_totale_reale_lotto_usd,
    costo_totale_reale_lotto_usd: totals.costo_totale_reale_lotto_usd,
    extra_expenses: lotExtraExpenses
  };

  try {
    fs.writeFileSync(lottoFile, JSON.stringify(updatedLotto, null, 2), 'utf8');
  } catch (writeErr) {
    console.error("⚠️ Failed to write lotto.json:", writeErr.message);
  }

  return updatedLotto;
}

async function recalculateCurrentLotto() {
  return runWithLottoLock(() => recalculateCurrentLottoInternal());
}

let isArchivingInProgress = false;

// POST /api/lotto/archive - Chiudi Lotto: crea uno snapshot, archivia tutti gli ordini attivi e resetta il lotto
app.post('/api/lotto/archive', async (req, res) => {
  console.log("[BACKEND] Avvio procedura 'Chiudi Lotto' con snapshot e archiviazione progressiva.");

  // Protezione contro doppia chiusura simultanea
  if (isArchivingInProgress) {
    console.warn("⚠️ [BACKEND] Rifiutata chiusura lotto concorrente: operazione già in corso.");
    return res.status(409).json({
      success: false,
      error: "Chiusura lotto già in corso. Attendere il completamento."
    });
  }

  const wantsStream = (req.headers.accept && req.headers.accept.includes('text/event-stream')) || req.query.stream === '1' || (req.body && req.body.stream === true);

  if (wantsStream) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }
  }

  const sendProgress = (percent, stage, extra = {}) => {
    if (wantsStream) {
      try {
        res.write(`data: ${JSON.stringify({ percent, stage, ...extra })}\n\n`);
      } catch (e) {
        console.warn("⚠️ Errore invio progresso SSE:", e.message);
      }
    }
  };

  isArchivingInProgress = true;

  try {
    const result = await runWithLottoLock(async () => {
      // 1. Inizializzazione e verifica ordini (0% -> 10%)
      sendProgress(5, "Inizializzazione e verifica ordini attivi...", { phase: 1 });

      const lottoFile = path.join(__dirname, 'lotto.json');
      const archive = await getDbLotti();
      const orders = await getDbOrders();

      const unarchivedOrders = orders.filter(o => !o.is_archived && isOrderActiveForLotto(o));
      if (unarchivedOrders.length === 0) {
        throw new Error("Nessun ordine attivo da archiviare nel lotto.");
      }

      // Determina lottoId: se gli ordini hanno già un lotto_id esplicito (es. ripristinato), usalo! Altrimenti maxArchivedId + 1
      const explicitLottoId = unarchivedOrders.find(o => o.lotto_id !== null && o.lotto_id !== undefined)?.lotto_id;
      let lottoId;
      if (explicitLottoId !== undefined && explicitLottoId !== null) {
        lottoId = Number(explicitLottoId);
      } else {
        const maxId = archive.reduce((max, l) => {
          const currentId = Number(l.id || 0);
          return currentId > max ? currentId : max;
        }, 0);
        lottoId = maxId + 1;
      }

      // Filtra gli ordini attivi associati a questo lotto
      const activeOrders = unarchivedOrders.filter(o => o.lotto_id === null || o.lotto_id === undefined || Number(o.lotto_id) === Number(lottoId));
      console.log(`[BACKEND Chiudi Lotto] Trovati ${activeOrders.length} ordini attivi associati al Lotto #${lottoId}.`);

      if (activeOrders.length === 0) {
        throw new Error(`Nessun ordine attivo associato al Lotto #${lottoId} da archiviare.`);
      }

      sendProgress(12, `Verificati ${activeOrders.length} ordini per Lotto #${lottoId}`, {
        phase: 1,
        lottoId,
        totalOrders: activeOrders.length,
        ordersProcessed: 0
      });

      // 2. Elaborazione ordini e calcolo totali economici (12% -> 45%)
      sendProgress(15, "Elaborazione ordini in corso...", {
        phase: 2,
        lottoId,
        totalOrders: activeOrders.length,
        ordersProcessed: 0
      });

      const settings = getSettings();
      let lotExtraExpenses = [];
      try {
        const profitData = await getDbProfitShares();
        const allExtra = Array.isArray(profitData.extra_expenses) ? profitData.extra_expenses : [];
        lotExtraExpenses = allExtra.filter(e => e.lotto_id !== undefined && e.lotto_id !== null && Number(e.lotto_id) === Number(lottoId));
      } catch (errExp) {
        console.warn("⚠️ Impossibile caricare spese extra per chiusura lotto:", errExp.message);
      }

      const totals = calculateLottoTotals(activeOrders, settings, lotExtraExpenses);

      let totaleNumeroOrdini = activeOrders.length;
      let totaleNumeroArticoli = totals.numero_totale_articoli;
      let incassoTotaleEur = 0;
      let costoProdottiUsd = totals.costo_totale_prodotti_usd;
      let costoSpedizioneUsd = totals.spedizione_corrente_usd;
      let costoFornitoreUsd = totals.costo_fornitore_usd;
      let alibabaFeeUsd = totals.alibaba_fee_usd;
      let alibabaFeeEur = totals.alibaba_fee_eur;
      let speseExtraUsd = totals.spese_extra_usd || 0;
      let speseExtraEur = totals.spese_extra_eur || 0;
      let costoTotaleUsd = totals.costo_totale_reale_lotto_usd;
      let costoFornitoreEur = 0;

      for (let i = 0; i < activeOrders.length; i++) {
        const o = activeOrders[i];
        incassoTotaleEur += parseItalianFloat(o.totale || '');
        costoFornitoreEur += parseItalianFloat(o["Costo totale (EUR)"] || o.costo_totale_eur || '0');

        const orderProg = 15 + Math.round(((i + 1) / activeOrders.length) * 28);
        sendProgress(orderProg, "Elaborazione ordini...", {
          phase: 2,
          lottoId,
          ordersProcessed: i + 1,
          totalOrders: activeOrders.length
        });
      }

      const costoTotaleEur = Number((costoFornitoreEur + alibabaFeeEur + speseExtraEur).toFixed(2));
      const profittoEur = Number((incassoTotaleEur - costoTotaleEur).toFixed(2));
      const marginePercentuale = incassoTotaleEur > 0 ? (profittoEur / incassoTotaleEur) * 100 : 0;

      sendProgress(45, "Calcolo riepilogo economico completato", {
        phase: 2,
        lottoId,
        ordersProcessed: activeOrders.length,
        totalOrders: activeOrders.length
      });

      // 3. Genera automaticamente l'Excel del fornitore compilato ad alta fedeltà (45% -> 65%)
      sendProgress(50, "Generazione file Excel fornitore...", { phase: 3, lottoId });
      let excelUrl = "";
      try {
        excelUrl = await generaExcelLotto(lottoId, activeOrders);
        console.log(`[BACKEND Chiudi Lotto] Excel generato correttamente: ${excelUrl}`);
      } catch (excelErr) {
        console.error("⚠️ Errore nella generazione dell'Excel del fornitore:", excelErr.message);
      }
      sendProgress(65, "File Excel fornitore generato", { phase: 3, lottoId });

      // 4. Salva lo snapshot completo nel database Supabase (tabella 'lotti') (65% -> 80%)
      sendProgress(70, "Salvataggio snapshot e archiviazione lotto...", { phase: 4, lottoId });
      const archivedAt = (req.body && req.body.archived_at && typeof req.body.archived_at === 'string' && req.body.archived_at.trim() !== '')
        ? req.body.archived_at.trim()
        : new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' });

      const nuovoLottoArchiviato = {
        id: lottoId,
        numero_lotto: `Lotto #${lottoId}`,
        archived_at: archivedAt,
        status: 'archived',
        numero_ordini: totaleNumeroOrdini,
        numero_articoli: totaleNumeroArticoli,
        incasso_totale_eur: Number(incassoTotaleEur.toFixed(2)),
        costo_prodotti_usd: costoProdottiUsd,
        costo_spedizione_usd: costoSpedizioneUsd,
        costo_fornitore_usd: costoFornitoreUsd,
        spese_extra_usd: speseExtraUsd,
        spese_extra_eur: speseExtraEur,
        costo_totale_usd: costoTotaleUsd,
        alibaba_fee_usd: alibabaFeeUsd,
        alibaba_fee_eur: alibabaFeeEur,
        costo_fornitore_eur: Number(costoFornitoreEur.toFixed(2)),
        costo_totale_eur: costoTotaleEur,
        profitto_eur: profittoEur,
        margine_percentuale: Number(marginePercentuale.toFixed(2)),
        excel_url: excelUrl,
        orders: activeOrders,
        extra_expenses: lotExtraExpenses
      };

      await insertDbLotto(nuovoLottoArchiviato);
      console.log(`[BACKEND Chiudi Lotto] Snapshot archiviato con successo per Lotto #${lottoId} in data/ora '${archivedAt}'`);
      sendProgress(80, "Snapshot lotto salvato nel database", { phase: 4, lottoId });

      // 5. Segna tutti gli ordini attivi come archiviati su Supabase in batch con lotto_id = lottoId (80% -> 92%)
      sendProgress(82, "Aggiornamento stato ordini e sincronizzazione...", { phase: 5, lottoId });
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const orderDatas = activeOrders.map(o => o.data).filter(Boolean);
          const orderAdminIds = activeOrders.map(o => o.id).filter(Boolean);

          const updatePromises = [];
          if (orderDatas.length > 0) {
            updatePromises.push(
              supabase.from('orders').update({
                is_archived: true,
                lotto_id: lottoId
              }).in('data', orderDatas)
            );
          }

          if (orderAdminIds.length > 0) {
            updatePromises.push(
              supabase.from('customer_orders').update({
                status: 'In preparazione',
                updated_at: new Date().toISOString()
              }).in('admin_order_id', orderAdminIds)
            );
          }

          await Promise.all(updatePromises);
          console.log(`✅ ${activeOrders.length} ordini contrassegnati come archiviati su Supabase.`);
        } catch (err) {
          console.warn("⚠️ Errore durante l'aggiornamento degli ordini su Supabase:", err.message);
        }
      }

      // Aggiorna anche la cache locale di ordini
      const localOrders = getLocalOrders();
      localOrders.forEach(lo => {
        if (activeOrders.some(ao => ao.data === lo.data)) {
          lo.is_archived = true;
          lo.lotto_id = lottoId;
        }
      });
      fs.writeFileSync(LOCAL_ORDERS_FILE, JSON.stringify(localOrders, null, 2), 'utf8');

      // Aggiorna le chiavi archiviate locali
      const nuoveChiaviArchiviate = getArchivedKeys();
      activeOrders.forEach(o => {
        if (o.data && !nuoveChiaviArchiviate.includes(o.data)) {
          nuoveChiaviArchiviate.push(o.data);
        }
      });
      saveArchivedKeys(nuoveChiaviArchiviate);

      sendProgress(92, "Stato ordini e cache sincronizzati", { phase: 5, lottoId });

      // 6. Resetta il Lotto Corrente (lotto.json) per il prossimo lotto attivo (92% -> 98%)
      sendProgress(95, "Finalizzazione e reset lotto attivo...", { phase: 6, lottoId });
      const updatedLotto = await recalculateCurrentLottoInternal();
      console.log("[BACKEND Chiudi Lotto] Reset lotto.json eseguito.");

      // 7. Completamento (100%)
      sendProgress(100, "Lotto chiuso correttamente", {
        phase: 7,
        success: true,
        lottoId,
        lotto: updatedLotto,
        archived: nuovoLottoArchiviato
      });

      return { success: true, lotto: updatedLotto, archived: nuovoLottoArchiviato, lottoId };
    });

    if (wantsStream) {
      res.end();
    } else {
      return res.json(result);
    }
  } catch (err) {
    console.error("⚠️ [BACKEND] Errore riscontrato durante la chiusura e archiviazione del lotto:", err);
    if (wantsStream) {
      res.write(`data: ${JSON.stringify({ success: false, error: err.message, stage: "Errore durante la chiusura del lotto" })}\n\n`);
      res.end();
    } else {
      return res.status(500).json({ success: false, error: err.message });
    }
  } finally {
    isArchivingInProgress = false;
  }
});

// Gestione chiavi ordini archiviati
const ARCHIVED_ORDERS_FILE = path.join(__dirname, 'archived_orders.json');
function getArchivedKeys() {
  try {
    if (fs.existsSync(ARCHIVED_ORDERS_FILE)) {
      return JSON.parse(fs.readFileSync(ARCHIVED_ORDERS_FILE, 'utf8'));
    }
  } catch (err) {
    console.warn("⚠️ Errore lettura archived_orders.json:", err.message);
  }
  return [];
}

function saveArchivedKeys(keys) {
  try {
    fs.writeFileSync(ARCHIVED_ORDERS_FILE, JSON.stringify(keys, null, 2), 'utf8');
  } catch (err) {
    console.warn("⚠️ Errore scrittura archived_orders.json:", err.message);
  }
}

// Gestione locale ordini (cache di backup resiliente)
const LOCAL_ORDERS_FILE = path.join(__dirname, 'orders_local.json');

function getLocalOrders() {
  try {
    if (fs.existsSync(LOCAL_ORDERS_FILE)) {
      return JSON.parse(fs.readFileSync(LOCAL_ORDERS_FILE, 'utf8'));
    }
  } catch (err) {
    console.warn("⚠️ Errore lettura orders_local.json:", err.message);
  }
  return [];
}

function saveLocalOrder(order) {
  try {
    const orders = getLocalOrders();
    orders.push(order);
    fs.writeFileSync(LOCAL_ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
  } catch (err) {
    console.warn("⚠️ Errore scrittura orders_local.json:", err.message);
  }
}

function deleteLocalOrder(orderDate) {
  try {
    let orders = getLocalOrders();
    orders = orders.filter(o => o.data !== orderDate);
    fs.writeFileSync(LOCAL_ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
  } catch (err) {
    console.warn("⚠️ Errore durante l'eliminazione dell'ordine locale:", err.message);
  }
}

// Gestione Catalogo Squadre Centralizzato (Club, Nazionali, NBA)
const LOCAL_TEAMS_FILE = path.join(__dirname, 'teams_local.json');

const DEFAULT_TEAMS = [
  // Club - Premier League
  { name: "Manchester United", categoria: "Club", sezione: "Premier League" },
  { name: "Manchester City", categoria: "Club", sezione: "Premier League" },
  { name: "Arsenal F.C.", categoria: "Club", sezione: "Premier League" },
  { name: "Liverpool F.C.", categoria: "Club", sezione: "Premier League" },
  { name: "Chelsea F.C.", categoria: "Club", sezione: "Premier League" },
  { name: "Tottenham Hotspur", categoria: "Club", sezione: "Premier League" },
  { name: "Aston Villa", categoria: "Club", sezione: "Premier League" },
  { name: "Newcastle United", categoria: "Club", sezione: "Premier League" },
  // Club - Serie A
  { name: "Juventus", categoria: "Club", sezione: "Serie A" },
  { name: "Inter", categoria: "Club", sezione: "Serie A" },
  { name: "AC Milan", categoria: "Club", sezione: "Serie A" },
  { name: "AS Roma", categoria: "Club", sezione: "Serie A" },
  { name: "SS Lazio", categoria: "Club", sezione: "Serie A" },
  { name: "SSC Napoli", categoria: "Club", sezione: "Serie A" },
  { name: "Fiorentina", categoria: "Club", sezione: "Serie A" },
  { name: "Atalanta", categoria: "Club", sezione: "Serie A" },
  { name: "Bologna", categoria: "Club", sezione: "Serie A" },
  // Club - La Liga
  { name: "Real Madrid", categoria: "Club", sezione: "La Liga" },
  { name: "Barcellona", categoria: "Club", sezione: "La Liga" },
  { name: "Atletico Madrid", categoria: "Club", sezione: "La Liga" },
  { name: "Girona F.C.", categoria: "Club", sezione: "La Liga" },
  { name: "Siviglia", categoria: "Club", sezione: "La Liga" },
  { name: "Real Sociedad", categoria: "Club", sezione: "La Liga" },
  // Club - Bundesliga
  { name: "Bayern Monaco", categoria: "Club", sezione: "Bundesliga" },
  { name: "Borussia Dortmund", categoria: "Club", sezione: "Bundesliga" },
  { name: "Bayer Leverkusen", categoria: "Club", sezione: "Bundesliga" },
  { name: "Lipsia", categoria: "Club", sezione: "Bundesliga" },
  { name: "Stoccarda", categoria: "Club", sezione: "Bundesliga" },
  { name: "Eintracht Francoforte", categoria: "Club", sezione: "Bundesliga" },
  // Club - Ligue 1
  { name: "Paris Saint-Germain", categoria: "Club", sezione: "Ligue 1" },
  { name: "Olympique Marsiglia", categoria: "Club", sezione: "Ligue 1" },
  { name: "AS Monaco", categoria: "Club", sezione: "Ligue 1" },
  // Club - USA MLS
  { name: "Inter Miami", categoria: "Club", sezione: "USA MLS" },
  { name: "LA Galaxy", categoria: "Club", sezione: "USA MLS" },
  // Club - Saudi League
  { name: "Al-Nassr", categoria: "Club", sezione: "Saudi League" },
  { name: "Al-Hilal", categoria: "Club", sezione: "Saudi League" },
  // Club - Altri Club
  { name: "Benfica", categoria: "Club", sezione: "Altri Club" },
  { name: "Boca Juniors", categoria: "Club", sezione: "Altri Club" },
  { name: "Ajax", categoria: "Club", sezione: "Altri Club" },
  // Nazionali - Europa
  { name: "Italia", categoria: "Nazionali", sezione: "Europa" },
  { name: "Francia", categoria: "Nazionali", sezione: "Europa" },
  { name: "Germania", categoria: "Nazionali", sezione: "Europa" },
  { name: "Spagna", categoria: "Nazionali", sezione: "Europa" },
  { name: "Svizzera", categoria: "Nazionali", sezione: "Europa" },
  { name: "Austria", categoria: "Nazionali", sezione: "Europa" },
  { name: "Inghilterra", categoria: "Nazionali", sezione: "Europa" },
  { name: "Portogallo", categoria: "Nazionali", sezione: "Europa" },
  { name: "Olanda", categoria: "Nazionali", sezione: "Europa" },
  { name: "Croazia", categoria: "Nazionali", sezione: "Europa" },
  // Nazionali - Sud America
  { name: "Brasile", categoria: "Nazionali", sezione: "Sud America" },
  { name: "Argentina", categoria: "Nazionali", sezione: "Sud America" },
  { name: "Uruguay", categoria: "Nazionali", sezione: "Sud America" },
  { name: "Colombia", categoria: "Nazionali", sezione: "Sud America" },
  // Nazionali - Nord America
  { name: "Stati Uniti", categoria: "Nazionali", sezione: "Nord America" },
  { name: "Messico", categoria: "Nazionali", sezione: "Nord America" },
  // Nazionali - Asia
  { name: "Giappone", categoria: "Nazionali", sezione: "Asia" },
  { name: "Corea del Sud", categoria: "Nazionali", sezione: "Asia" },
  // Nazionali - Oceania
  { name: "Nuova Zelanda", categoria: "Nazionali", sezione: "Oceania" },
  // Nazionali - Africa
  { name: "Nigeria", categoria: "Nazionali", sezione: "Africa" },
  { name: "Marocco", categoria: "Nazionali", sezione: "Africa" },
  { name: "Senegal", categoria: "Nazionali", sezione: "Africa" },
  // NBA - Eastern Conference
  { name: "Boston Celtics", categoria: "NBA", sezione: "Eastern Conference" },
  { name: "Milwaukee Bucks", categoria: "NBA", sezione: "Eastern Conference" },
  { name: "Philadelphia 76ers", categoria: "NBA", sezione: "Eastern Conference" },
  { name: "Miami Heat", categoria: "NBA", sezione: "Eastern Conference" },
  { name: "New York Knicks", categoria: "NBA", sezione: "Eastern Conference" },
  { name: "Cleveland Cavaliers", categoria: "NBA", sezione: "Eastern Conference" },
  // NBA - Western Conference
  { name: "Los Angeles Lakers", categoria: "NBA", sezione: "Western Conference" },
  { name: "Golden State Warriors", categoria: "NBA", sezione: "Western Conference" },
  { name: "Phoenix Suns", categoria: "NBA", sezione: "Western Conference" },
  { name: "Denver Nuggets", categoria: "NBA", sezione: "Western Conference" },
  { name: "Dallas Mavericks", categoria: "NBA", sezione: "Western Conference" },
  { name: "Los Angeles Clippers", categoria: "NBA", sezione: "Western Conference" }
];

function getLocalTeams() {
  try {
    if (fs.existsSync(LOCAL_TEAMS_FILE)) {
      return JSON.parse(fs.readFileSync(LOCAL_TEAMS_FILE, 'utf8'));
    }
  } catch (err) {
    console.warn("⚠️ Errore lettura teams_local.json:", err.message);
  }
  saveLocalTeams(DEFAULT_TEAMS);
  return DEFAULT_TEAMS;
}

function saveLocalTeams(teams) {
  try {
    fs.writeFileSync(LOCAL_TEAMS_FILE, JSON.stringify(teams, null, 2), 'utf8');
  } catch (err) {
    console.warn("⚠️ Errore scrittura teams_local.json:", err.message);
  }
}

// GET /api/teams - Ottieni tutte le squadre (Club, Nazionali, NBA, ecc.)
app.get('/api/teams', async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error("Supabase non è configurato.");
    }
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .order('name', { ascending: true });
      
    if (error) {
      console.error("⚠️ Supabase error on GET /api/teams:", error.message);
      throw error;
    }

    let teams = data || [];
    if (teams.length === 0) {
      console.log("Initializing teams table with default teams in Supabase...");
      for (const team of DEFAULT_TEAMS) {
        try {
          await supabase.from('teams').insert(team);
        } catch (e) {
          console.warn("⚠️ Error inserting default team:", e.message);
        }
      }
      const { data: freshData, error: freshErr } = await supabase.from('teams').select('*').order('name', { ascending: true });
      if (!freshErr && freshData) {
        teams = freshData;
      }
    }
    return res.json({ success: true, teams });
  } catch (err) {
    console.error("⚠️ Errore GET /api/teams:", err.message);
    return res.status(500).json({ success: false, error: err.message, teams: [] });
  }
});

// POST /api/teams - Crea o aggiunge una nuova squadra
app.post('/api/teams', async (req, res) => {
  try {
    const { name, categoria, sezione } = req.body;
    if (!name || !categoria || !sezione) {
      return res.status(400).json({ success: false, error: "Campi obbligatori mancanti: name, categoria, sezione" });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error("Supabase non è configurato.");
    }

    const { data, error } = await supabase
      .from('teams')
      .insert({ name, categoria, sezione })
      .select();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ success: false, error: `La squadra "${name}" esiste già.` });
      }
      console.error("⚠️ Errore inserimento Supabase:", error.message);
      throw error;
    }

    const createdTeam = data ? data[0] : null;
    return res.json({ success: true, team: createdTeam || { name, categoria, sezione } });
  } catch (err) {
    console.error("⚠️ Errore POST /api/teams:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/teams - Rinomina una squadra nel catalogo e in tutti i prodotti
app.put('/api/teams', async (req, res) => {
  try {
    const { oldName, newName } = req.body;
    if (!oldName || !newName) {
      return res.status(400).json({ success: false, error: "Campi obbligatori mancanti: oldName, newName" });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error("Supabase non è configurato.");
    }

    let updatedCount = 0;

    // 1. Aggiorna in teams
    const { error: teamErr } = await supabase
      .from('teams')
      .update({ name: newName })
      .eq('name', oldName);
      
    if (teamErr) {
      console.error("⚠️ Errore update team su Supabase:", teamErr.message);
      throw teamErr;
    }

    // 2. Aggiorna in products
    const { data: updatedProds, error: prodErr } = await supabase
      .from('products')
      .update({ squadra: newName })
      .eq('squadra', oldName)
      .select();

    if (prodErr) {
      console.warn("⚠️ Errore update prodotti su Supabase:", prodErr.message);
    } else if (updatedProds) {
      updatedCount = updatedProds.length;
    }

    return res.json({ success: true, count: updatedCount });
  } catch (err) {
    console.error("⚠️ Errore PUT /api/teams:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/teams - Elimina una squadra se non collegata a prodotti
app.delete('/api/teams', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: "Nome squadra obbligatorio per eliminazione" });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error("Supabase non è configurato.");
    }

    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('name', name);
      
    if (error) {
      console.error("⚠️ Errore delete team su Supabase:", error.message);
      throw error;
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("⚠️ Errore DELETE /api/teams:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// ==========================================
// SISTEMA RECENSIONI VERIFICATE MAGLIA D'ORO (SUPABASE AS SINGLE SOURCE OF TRUTH)
// ATTENZIONE: la persistenza delle recensioni è separata dal resto del catalogo.
// Qualsiasi modifica a prodotti, categorie, catalog_settings, coupon, ordini, dashboard
// NON deve mai modificare o sovrascrivere il sistema delle recensioni.
// ==========================================

const LOCAL_REVIEWS_FILE = path.join(__dirname, 'reviews_local.json');

// Helper to safely upload review photos exclusively to Supabase Storage bucket 'reviews'
// Converts Base64 data URLs to Supabase Storage public URLs and preserves existing URLs (backward compatibility)
async function processReviewImages(images, reviewId = null) {
  if (!Array.isArray(images) || images.length === 0) return [];
  
  const processedUrls = [];
  const supabase = getSupabaseClient();

  for (let i = 0; i < images.length; i++) {
    const item = images[i];
    if (!item) continue;

    // If item is already an object { thumb, full } or a plain URL string
    let fullCandidate = typeof item === 'string' ? item : (item.full || item.thumb || '');

    // 1. If it's already a URL (HTTP, Supabase Storage, or legacy /uploads), preserve it
    if (typeof fullCandidate === 'string' && (fullCandidate.startsWith('http://') || fullCandidate.startsWith('https://') || fullCandidate.startsWith('/uploads/'))) {
      processedUrls.push(fullCandidate);
      continue;
    }

    // 2. If fullCandidate is a Base64 string that needs to be uploaded to Supabase Storage
    if (typeof fullCandidate === 'string' && fullCandidate.startsWith('data:image/')) {
      if (!supabase) {
        throw new Error("Supabase non è configurato. Impossibile caricare le foto delle recensioni su Supabase Storage.");
      }

      const matches = fullCandidate.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        throw new Error("Formato immagine Base64 non valido.");
      }

      const ext = matches[1] === 'jpeg' ? 'jpg' : (matches[1] || 'jpg');
      const fileBuffer = Buffer.from(matches[2], 'base64');
      const uniqueFilename = `rec-${reviewId || Date.now()}-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}.${ext}`;

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('reviews')
        .upload(uniqueFilename, fileBuffer, {
          contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
          upsert: true
        });

      if (uploadErr || !uploadData) {
        console.error("❌ Errore upload Supabase Storage bucket reviews:", uploadErr?.message || "Errore sconosciuto");
        throw new Error(`Impossibile caricare l'immagine su Supabase Storage (bucket 'reviews'): ${uploadErr?.message || 'Bucket non accessibile'}`);
      }

      const { data: publicUrlData } = supabase.storage.from('reviews').getPublicUrl(uniqueFilename);
      if (!publicUrlData || !publicUrlData.publicUrl) {
        throw new Error("Impossibile generare l'URL pubblico per l'immagine da Supabase Storage.");
      }

      processedUrls.push(publicUrlData.publicUrl);
      continue;
    }

    // If it's an unrecognized format, preserve it if string
    if (typeof fullCandidate === 'string') {
      processedUrls.push(fullCandidate);
    }
  }

  return processedUrls;
}

// Helper to get reviews from Supabase (native reviews table or settings key)
async function getDbReviews() {
  const supabase = getSupabaseClient();
  
  if (supabase) {
    // 1. Try native 'reviews' table first (if created by user)
    try {
      const { data, error } = await supabase.from('reviews').select('*').order('created_at', { ascending: false });
      if (!error && Array.isArray(data)) {
        return data.map(r => ({
          id: r.id,
          customer_id: r.customer_id || null,
          customer_name: r.customer_name || 'Cliente',
          email: r.email || null,
          order_id: r.order_id || null,
          order_number: r.order_number || null,
          product_id: r.product_id || null,
          product_name: r.product_name || null,
          product_image: r.product_image || null,
          purchase_date: r.purchase_date || null,
          rating: Number(r.rating) || 5,
          title: r.title || null,
          comment: r.comment || '',
          images: Array.isArray(r.images) ? r.images : (typeof r.images === 'string' ? JSON.parse(r.images || '[]') : []),
          status: r.status || 'pending',
          review_type: r.review_type || ((r.order_id || r.order_number) ? 'verified_purchase' : 'shared_experience'),
          created_at: r.created_at || new Date().toISOString()
        }));
      }
      
      // If error is a genuine database/network error (and NOT just table missing in schema cache)
      if (error && error.code !== 'PGRST205' && !error.message?.includes('schema cache')) {
        console.error("❌ Errore Supabase tabella reviews:", error.message);
        throw new Error(`Database error: ${error.message}`);
      }
    } catch (e) {
      if (e.message?.startsWith('Database error:')) {
        throw e;
      }
    }

    // 2. Read from 'settings' table key 'reviews' (Primary storage)
    try {
      const { data, error } = await supabase.from('settings').select('value').eq('key', 'reviews');
      if (error) {
        console.error("❌ Errore lettura recensioni da Supabase settings:", error.message);
        throw new Error(`Database error: ${error.message}`);
      }
      if (data && data.length > 0) {
        const val = data[0].value;
        if (Array.isArray(val)) {
          // If array exists (even if empty []), return it directly as valid data
          return val.map(r => ({
            id: r.id,
            customer_id: r.customer_id || null,
            customer_name: r.customer_name || 'Cliente',
            email: r.email || null,
            order_id: r.order_id || null,
            order_number: r.order_number || null,
            product_id: r.product_id || null,
            product_name: r.product_name || null,
            product_image: r.product_image || null,
            purchase_date: r.purchase_date || null,
            rating: Number(r.rating) || 5,
            title: r.title || null,
            comment: r.comment || '',
            images: Array.isArray(r.images) ? r.images : [],
            status: r.status || 'pending',
            review_type: r.review_type || ((r.order_id || r.order_number) ? 'verified_purchase' : 'shared_experience'),
            created_at: r.created_at || new Date().toISOString()
          }));
        }
      }
      // If settings key 'reviews' does not exist in DB, return empty array without modifying Supabase
      return [];
    } catch (e) {
      console.error("❌ Eccezione durante la lettura delle recensioni da Supabase:", e.message);
      throw e;
    }
  }
  
  // Offline development fallback ONLY when Supabase credentials are not configured at all
  try {
    if (fs.existsSync(LOCAL_REVIEWS_FILE)) {
      const content = fs.readFileSync(LOCAL_REVIEWS_FILE, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed.map(r => ({
          ...r,
          review_type: r.review_type || ((r.order_id || r.order_number) ? 'verified_purchase' : 'shared_experience')
        }));
      }
    }
  } catch (err) {
    console.error("ℹ️ Errore lettura locale reviews_local.json:", err.message);
  }
  return [];
}

// Helper to save a new review
async function insertDbReview(review) {
  const supabase = getSupabaseClient();
  
  if (supabase) {
    // 1. Try native 'reviews' table
    let insertedInTable = false;
    let createdRecord = null;
    try {
      const { data, error } = await supabase.from('reviews').insert([{
        customer_id: review.customer_id || null,
        customer_name: review.customer_name,
        email: review.email || null,
        order_id: review.order_id || null,
        order_number: review.order_number || null,
        product_id: review.product_id || null,
        product_name: review.product_name || null,
        product_image: review.product_image || null,
        purchase_date: review.purchase_date || null,
        rating: Number(review.rating) || 5,
        title: review.title || null,
        comment: review.comment,
        images: review.images || [],
        status: review.status || 'pending',
        review_type: review.review_type || 'shared_experience'
      }]).select();

      if (!error && data && data.length > 0) {
        insertedInTable = true;
        createdRecord = data[0];
      } else if (error && error.code !== 'PGRST205' && !error.message?.includes('schema cache')) {
        throw new Error(`Database error: ${error.message}`);
      }
    } catch (e) {
      if (e.message?.startsWith('Database error:')) throw e;
    }

    if (insertedInTable && createdRecord) {
      return createdRecord;
    }

    // 2. Persist to Supabase settings key 'reviews'
    const currentReviews = await getDbReviews();
    const newId = currentReviews.length > 0 ? Math.max(...currentReviews.map(r => Number(r.id) || 0)) + 1 : 1;
    const newReview = {
      id: newId,
      ...review,
      created_at: review.created_at || new Date().toISOString()
    };
    currentReviews.unshift(newReview);
    
    const { error: upsertErr } = await supabase.from('settings').upsert({
      key: 'reviews',
      value: currentReviews,
      updated_at: new Date().toISOString()
    });
    
    if (upsertErr) {
      throw new Error(`Database error: ${upsertErr.message}`);
    }
    
    // Update local cache safely
    try {
      fs.writeFileSync(LOCAL_REVIEWS_FILE, JSON.stringify(currentReviews, null, 2), 'utf8');
    } catch (e) {}
    
    return newReview;
  }
  
  // Offline development mode
  const currentReviews = await getDbReviews();
  const newId = currentReviews.length > 0 ? Math.max(...currentReviews.map(r => Number(r.id) || 0)) + 1 : 1;
  const newReview = {
    id: newId,
    ...review,
    created_at: review.created_at || new Date().toISOString()
  };
  currentReviews.unshift(newReview);
  try {
    fs.writeFileSync(LOCAL_REVIEWS_FILE, JSON.stringify(currentReviews, null, 2), 'utf8');
  } catch (err) {
    console.error("ℹ️ Errore scrittura local reviews:", err.message);
  }
  return newReview;
}

// Helper to update an existing review
async function updateDbReview(id, updateData) {
  const supabase = getSupabaseClient();
  
  if (supabase) {
    // 1. Try native 'reviews' table
    let updatedInTable = false;
    try {
      const { data, error } = await supabase.from('reviews').update(updateData).eq('id', id).select();
      if (!error && data && data.length > 0) {
        updatedInTable = true;
      } else if (error && error.code !== 'PGRST205' && !error.message?.includes('schema cache')) {
        throw new Error(`Database error: ${error.message}`);
      }
    } catch (e) {
      if (e.message?.startsWith('Database error:')) throw e;
    }

    if (updatedInTable) {
      return true;
    }

    // 2. Update in Supabase settings key 'reviews'
    const currentReviews = await getDbReviews();
    const idx = currentReviews.findIndex(r => String(r.id) === String(id));
    if (idx === -1) {
      return false;
    }
    
    currentReviews[idx] = {
      ...currentReviews[idx],
      ...updateData
    };
    
    const { error: upsertErr } = await supabase.from('settings').upsert({
      key: 'reviews',
      value: currentReviews,
      updated_at: new Date().toISOString()
    });
    
    if (upsertErr) {
      throw new Error(`Database error: ${upsertErr.message}`);
    }
    
    try {
      fs.writeFileSync(LOCAL_REVIEWS_FILE, JSON.stringify(currentReviews, null, 2), 'utf8');
    } catch (e) {}
    
    return true;
  }
  
  // Offline development mode
  const currentReviews = await getDbReviews();
  const idx = currentReviews.findIndex(r => String(r.id) === String(id));
  if (idx === -1) return false;
  currentReviews[idx] = { ...currentReviews[idx], ...updateData };
  try {
    fs.writeFileSync(LOCAL_REVIEWS_FILE, JSON.stringify(currentReviews, null, 2), 'utf8');
  } catch (err) {
    console.error("ℹ️ Errore scrittura local reviews:", err.message);
  }
  return true;
}

// Helper to delete a review
async function deleteDbReview(id) {
  const supabase = getSupabaseClient();
  
  if (supabase) {
    // 1. Try native 'reviews' table
    let deletedInTable = false;
    try {
      const { data, error } = await supabase.from('reviews').delete().eq('id', id).select();
      if (!error && data && data.length > 0) {
        deletedInTable = true;
      } else if (error && error.code !== 'PGRST205' && !error.message?.includes('schema cache')) {
        throw new Error(`Database error: ${error.message}`);
      }
    } catch (e) {
      if (e.message?.startsWith('Database error:')) throw e;
    }

    if (deletedInTable) {
      return true;
    }

    // 2. Delete in Supabase settings key 'reviews'
    const currentReviews = await getDbReviews();
    const originalLength = currentReviews.length;
    const targetReview = currentReviews.find(r => String(r.id) === String(id));
    const filteredReviews = currentReviews.filter(r => String(r.id) !== String(id));
    
    if (filteredReviews.length === originalLength) {
      return false;
    }
    
    const { error: upsertErr } = await supabase.from('settings').upsert({
      key: 'reviews',
      value: filteredReviews,
      updated_at: new Date().toISOString()
    });
    
    if (upsertErr) {
      throw new Error(`Database error: ${upsertErr.message}`);
    }

    // Safely remove associated storage objects from 'reviews' bucket
    if (targetReview && Array.isArray(targetReview.images)) {
      for (const imgUrl of targetReview.images) {
        if (typeof imgUrl === 'string' && imgUrl.includes('/storage/v1/object/public/reviews/')) {
          try {
            const fileName = imgUrl.split('/storage/v1/object/public/reviews/')[1];
            if (fileName && fileName.startsWith('rec-')) {
              await supabase.storage.from('reviews').remove([fileName]);
            }
          } catch (e) {
            // Non-blocking cleanup
          }
        }
      }
    }
    
    try {
      fs.writeFileSync(LOCAL_REVIEWS_FILE, JSON.stringify(filteredReviews, null, 2), 'utf8');
    } catch (e) {}
    
    return true;
  }
  
  // Offline development mode
  const currentReviews = await getDbReviews();
  const originalLength = currentReviews.length;
  const filteredReviews = currentReviews.filter(r => String(r.id) !== String(id));
  if (filteredReviews.length === originalLength) return false;
  try {
    fs.writeFileSync(LOCAL_REVIEWS_FILE, JSON.stringify(filteredReviews, null, 2), 'utf8');
  } catch (err) {
    console.error("ℹ️ Errore scrittura local reviews:", err.message);
  }
  return true;
}

// GET /api/reviews - Legge le recensioni approvate o tutte (per admin)
app.get('/api/reviews', async (req, res) => {
  try {
    const allReviews = await getDbReviews();
    const adminMode = req.query.admin === 'true';
    
    if (adminMode) {
      return res.json({ success: true, reviews: allReviews });
    } else {
      // Public view: only approved ones
      const approvedReviews = allReviews.filter(r => r.status === 'approved');
      return res.json({ success: true, reviews: approvedReviews });
    }
  } catch (err) {
    console.error("⚠️ Errore nel caricamento delle recensioni:", err.message);
    return res.status(500).json({ success: false, error: "Errore durante la lettura delle recensioni dal database.", details: err.message, reviews: [] });
  }
});

// POST /api/reviews - Invia una nuova recensione da parte di un cliente
app.post('/api/reviews', async (req, res) => {
  try {
    const {
      customer_id,
      customer_name,
      email,
      order_id,
      order_number,
      product_id,
      product_name,
      product_image,
      purchase_date,
      rating,
      title,
      comment,
      images,
      review_type
    } = req.body;

    if (!customer_name || !rating || !comment) {
      return res.status(400).json({ success: false, error: "Campi obbligatori mancanti: customer_name, rating, comment" });
    }

    let rawName = customer_name.trim();
    let maskedName = rawName;
    if (rawName.includes(' ')) {
      let nameParts = rawName.split(' ');
      maskedName = nameParts[0] + ' ' + nameParts[nameParts.length - 1].substring(0, 1).toUpperCase() + '.';
    }

    const finalReviewType = review_type || ((order_id || order_number) ? 'verified_purchase' : 'shared_experience');

    // Process images: upload to Storage/uploads and store clean URLs instead of raw Base64
    const processedImages = await processReviewImages(images);

    const review = {
      customer_id: customer_id || null,
      customer_name: maskedName,
      email: email ? String(email).trim() : null,
      order_id: order_id ? Number(order_id) : null,
      order_number: order_number || null,
      product_id: product_id || null,
      product_name: product_name || null,
      product_image: product_image || null,
      purchase_date: purchase_date || null,
      rating: Number(rating),
      title: title || null,
      comment: comment,
      images: processedImages,
      status: 'pending',
      review_type: finalReviewType,
      created_at: new Date().toISOString()
    };

    const savedReview = await insertDbReview(review);
    return res.json({ success: true, review: savedReview });
  } catch (err) {
    console.error("⚠️ Errore nel salvataggio della recensione:", err.message);
    return res.status(500).json({ success: false, error: "Errore durante il salvataggio della recensione nel database.", details: err.message });
  }
});

// POST /api/reviews/moderate - Approva, rifiuta o modifica una recensione (per admin)
app.post('/api/reviews/moderate', async (req, res) => {
  try {
    const { id, status, rating, comment, title, customer_name, email, review_type, images } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, error: "Specificare l'ID della recensione da moderare." });
    }

    const updateData = {};
    if (status !== undefined) updateData.status = status;
    if (rating !== undefined) updateData.rating = Number(rating);
    if (comment !== undefined) updateData.comment = comment;
    if (title !== undefined) updateData.title = title;
    if (customer_name !== undefined) updateData.customer_name = customer_name;
    if (email !== undefined) updateData.email = email;
    if (review_type !== undefined) updateData.review_type = review_type;
    if (images !== undefined) {
      updateData.images = await processReviewImages(images, id);
    }

    const success = await updateDbReview(id, updateData);
    if (success) {
      return res.json({ success: true, message: "Recensione moderata con successo!" });
    } else {
      return res.status(404).json({ success: false, error: "Recensione non trovata o aggiornamento fallito." });
    }
  } catch (err) {
    console.error("⚠️ Errore durante la moderazione della recensione:", err.message);
    return res.status(500).json({ success: false, error: "Errore durante l'aggiornamento della recensione.", details: err.message });
  }
});

// DELETE /api/reviews/:id - Elimina definitivamente una recensione (per admin)
app.delete('/api/reviews/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, error: "ID recensione mancante." });
    }

    const success = await deleteDbReview(id);
    if (success) {
      return res.json({ success: true, message: "Recensione eliminata definitivamente." });
    } else {
      return res.status(404).json({ success: false, error: "Recensione non trovata." });
    }
  } catch (err) {
    console.error("⚠️ Errore durante l'eliminazione della recensione:", err.message);
    return res.status(500).json({ success: false, error: "Errore durante l'eliminazione della recensione.", details: err.message });
  }
});

// GET /api/orders - Ottieni tutti gli ordini registrati con cache locale resiliente
app.get('/api/orders', async (req, res) => {
  try {
    await recalculateCurrentLotto();
    const orders = await getDbOrders();
    // Determina dinamicamente le chiavi archiviate dalle proprietà degli ordini, con fallback locale
    let archivedKeys = orders.filter(o => o.is_archived === true).map(o => o.data);
    if (archivedKeys.length === 0) {
      archivedKeys = getArchivedKeys();
    }
    return res.json({ success: true, orders, archivedKeys });
  } catch (err) {
    console.error("⚠️ Errore nel caricamento degli ordini:", err.message);
    return res.status(500).json({ success: false, error: err.message, orders: [], archivedKeys: [] });
  }
});

// POST /api/orders/delete - Elimina definitivamente un ordine
app.post('/api/orders/delete', async (req, res) => {
  try {
    const { data } = req.body;
    if (!data) {
      return res.status(400).json({ success: false, error: "Specificare la 'data' dell'ordine da eliminare." });
    }

    console.log(`🗑️ Eliminazione dell'ordine: ${data}`);
    await deleteDbOrderByDate(data);

    // Rimuovilo anche da archived_orders.json se presente
    let archived = getArchivedKeys();
    if (archived.includes(data)) {
      archived = archived.filter(k => k !== data);
      saveArchivedKeys(archived);
    }

    await recalculateCurrentLotto();

    return res.json({ success: true, deletedKey: data });
  } catch (err) {
    console.error("⚠️ Errore DELETE /api/orders/delete:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/orders/archive - Segna un ordine come archiviato
app.post('/api/orders/archive', async (req, res) => {
  try {
    const { data } = req.body;
    if (!data) {
      return res.status(400).json({ success: false, error: "Specificare la 'data' dell'ordine da archiviare." });
    }

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('orders').update({ is_archived: true }).eq('data', data);
      } catch (err) {
        console.warn("⚠️ Errore aggiornamento Supabase su archive:", err.message);
      }
    }

    const localOrders = getLocalOrders();
    const locIdx = localOrders.findIndex(o => o.data === data);
    if (locIdx !== -1) {
      localOrders[locIdx].is_archived = true;
      fs.writeFileSync(LOCAL_ORDERS_FILE, JSON.stringify(localOrders, null, 2), 'utf8');
    }

    let archived = getArchivedKeys();
    if (!archived.includes(data)) {
      archived.push(data);
      saveArchivedKeys(archived);
    }

    await recalculateCurrentLotto();

    return res.json({ success: true, archivedKeys: archived });
  } catch (err) {
    console.error("⚠️ Errore durante l'archiviazione dell'ordine:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/orders/unarchive - Disarchivia un ordine e lo riporta negli ordini attivi
app.post('/api/orders/unarchive', async (req, res) => {
  try {
    const { data } = req.body;
    if (!data) {
      return res.status(400).json({ success: false, error: "Specificare la 'data' dell'ordine da disarchiviare." });
    }

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data: updatedOrds } = await supabase.from('orders').update({
          is_archived: false,
          lotto_id: null
        }).eq('data', data).select();

        if (updatedOrds && updatedOrds.length > 0) {
          const adminId = updatedOrds[0].id;
          await supabase.from('customer_orders').update({
            status: 'Ordine ricevuto',
            updated_at: new Date().toISOString()
          }).eq('admin_order_id', adminId);
        }
      } catch (err) {
        console.warn("⚠️ Errore aggiornamento Supabase su unarchive:", err.message);
      }
    }

    const localOrders = getLocalOrders();
    const locIdx = localOrders.findIndex(o => o.data === data);
    if (locIdx !== -1) {
      localOrders[locIdx].is_archived = false;
      localOrders[locIdx].lotto_id = null;
      fs.writeFileSync(LOCAL_ORDERS_FILE, JSON.stringify(localOrders, null, 2), 'utf8');
    }

    let archived = getArchivedKeys();
    if (archived.includes(data)) {
      archived = archived.filter(k => k !== data);
      saveArchivedKeys(archived);
    }

    await recalculateCurrentLotto();

    return res.json({ success: true, archivedKeys: archived });
  } catch (err) {
    console.error("⚠️ Errore durante la disarchiviazione dell'ordine:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/orders/update-pricing & PUT /api/orders/:id/update-pricing - Modifica prezzo concordato o fasce di prezzo di uno specifico ordine
const handleUpdateOrderPricing = async (req, res) => {
  try {
    const { order_id, orderId, items, ripristina_tutto } = req.body || {};
    const targetId = order_id !== undefined ? order_id : (orderId !== undefined ? orderId : req.params.id);

    if (targetId === undefined || targetId === null || targetId === '') {
      return res.status(400).json({ success: false, error: "Identificativo ordine mancante." });
    }

    const allOrders = await getDbOrders();
    const targetIdStr = String(targetId).trim().replace(/^#/, '');
    const order = allOrders.find(o => 
      (o.id !== undefined && String(o.id).trim() === targetIdStr) || 
      (o.data && String(o.data).trim() === targetIdStr)
    );

    if (!order) {
      return res.status(404).json({ success: false, error: "Ordine non trovato." });
    }

    if (order.is_archived) {
      return res.status(400).json({ 
        success: false, 
        error: "Non è possibile modificare il prezzo di un ordine archiviato. Riporta prima l'ordine tra quelli attivi." 
      });
    }

    let cartItems = order.carrello;
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      cartItems = ricostruisciCarrelloDaStringhe(order);
    }

    // Se l'amministratore richiede di ripristinare tutti i prezzi originali
    if (ripristina_tutto === true) {
      cartItems.forEach(item => {
        if (item.prezzo_originale !== undefined && item.prezzo_originale !== null) {
          item.prezzo = Number(item.prezzo_originale);
        }
        delete item.prezzo_concordato;
        delete item.fasce_prezzo;
        delete item.ha_prezzo_concordato;
        delete item.prezzo_originale;
        delete item.totale_concordato;
      });
    } else if (Array.isArray(items)) {
      // Aggiorna ciascun articolo con i parametri inviati
      for (let i = 0; i < cartItems.length; i++) {
        const item = cartItems[i];
        const isSped = item.squadra && isTechnicalShippingOrServiceLine(item.squadra);
        if (isSped) continue;

        // Cerca l'aggiornamento corrispondente per ID, legacy_id o indice
        const update = items.find(u => 
          (u.id && item.id && String(u.id) === String(item.id)) ||
          (u.legacy_id && item.legacy_id && String(u.legacy_id) === String(item.legacy_id)) ||
          (u.index !== undefined && Number(u.index) === i)
        );

        if (!update) continue;

        const totalItemQty = parseInt(item.quantita, 10) || 1;

        if (update.ripristina === true) {
          if (item.prezzo_originale !== undefined && item.prezzo_originale !== null) {
            item.prezzo = Number(item.prezzo_originale);
          }
          delete item.prezzo_concordato;
          delete item.fasce_prezzo;
          delete item.ha_prezzo_concordato;
          delete item.prezzo_originale;
          delete item.totale_concordato;
        } else if (Array.isArray(update.fasce_prezzo) && update.fasce_prezzo.length > 0) {
          let sumQty = 0;
          let calculatedItemTotal = 0;
          const validatedTiers = [];

          for (const f of update.fasce_prezzo) {
            const q = parseInt(f.quantita, 10);
            const p = parseFloat(String(f.prezzo_unitario).replace(',', '.'));
            if (isNaN(q) || q <= 0) {
              return res.status(400).json({ success: false, error: `Quantità non valida nella fascia: ${f.quantita}` });
            }
            if (isNaN(p) || p < 0) {
              return res.status(400).json({ success: false, error: `Prezzo unitario non valido nella fascia: ${f.prezzo_unitario}` });
            }
            sumQty += q;
            calculatedItemTotal += (q * p);
            validatedTiers.push({ quantita: q, prezzo_unitario: Number(p.toFixed(2)) });
          }

          if (sumQty !== totalItemQty) {
            return res.status(400).json({ 
              success: false, 
              error: `La somma delle quantità delle fasce (${sumQty}) non coincide con la quantità totale dell'articolo (${totalItemQty}).` 
            });
          }

          if (item.prezzo_originale === undefined || item.prezzo_originale === null) {
            item.prezzo_originale = Number(item.prezzo) || 0;
          }
          item.fasce_prezzo = validatedTiers;
          item.prezzo_concordato = validatedTiers.length === 1 ? validatedTiers[0].prezzo_unitario : Number((calculatedItemTotal / totalItemQty).toFixed(2));
          item.prezzo = Number((calculatedItemTotal / totalItemQty).toFixed(4));
          item.ha_prezzo_concordato = true;
          item.totale_concordato = Number(calculatedItemTotal.toFixed(2));
        } else if (update.prezzo_concordato !== undefined && update.prezzo_concordato !== null && update.prezzo_concordato !== '') {
          const p = parseFloat(String(update.prezzo_concordato).replace(',', '.'));
          if (isNaN(p) || p < 0) {
            return res.status(400).json({ success: false, error: "Prezzo concordato non valido." });
          }
          if (item.prezzo_originale === undefined || item.prezzo_originale === null) {
            item.prezzo_originale = Number(item.prezzo) || 0;
          }
          item.prezzo = Number(p.toFixed(2));
          item.prezzo_concordato = Number(p.toFixed(2));
          item.fasce_prezzo = [{ quantita: totalItemQty, prezzo_unitario: Number(p.toFixed(2)) }];
          item.ha_prezzo_concordato = true;
          item.totale_concordato = Number((totalItemQty * p).toFixed(2));
        }
      }
    }

    order.carrello = cartItems;

    // Ricalcola il totale dell'ordine
    let itemsSubtotal = 0;
    cartItems.forEach(ci => {
      const isSped = ci.squadra && isTechnicalShippingOrServiceLine(ci.squadra);
      if (isSped) return;
      if (ci.totale_concordato !== undefined && ci.ha_prezzo_concordato) {
        itemsSubtotal += Number(ci.totale_concordato);
      } else if (Array.isArray(ci.fasce_prezzo) && ci.fasce_prezzo.length > 0) {
        itemsSubtotal += ci.fasce_prezzo.reduce((a, f) => a + (f.quantita * f.prezzo_unitario), 0);
      } else {
        itemsSubtotal += (Number(ci.prezzo) || 0) * (parseInt(ci.quantita, 10) || 1);
      }
    });

    const squadraStr = String(order.squadra || '').toLowerCase();
    const haSpedCliente = squadraStr.includes('spedizione');
    const spedizioneCliente = haSpedCliente ? 2.00 : 0.00;
    const couponDiscount = (order.coupon_discount !== undefined && order.coupon_discount !== null) ? Number(order.coupon_discount) : 0;
    const newOrderTotal = Math.max(0, Number((itemsSubtotal + spedizioneCliente - couponDiscount).toFixed(2)));

    // Mantieni intatti i costi fornitore reali
    const settings = getSettings();
    const orderRate = getOrderEffectiveExchangeRate(order, settings);
    const rawProdCostUSD = parseItalianFloat(String(order["Costo prodotti (USD)"] || order.costo_prodotti_usd || '0'));
    const rawShipUSD = parseItalianFloat(String(order["Costo spedizione (USD)"] || order.costo_spedizione_usd || '0'));
    const totalCostUSD = Number((rawProdCostUSD + rawShipUSD).toFixed(2));
    const costEur = order["Costo totale (EUR)"] ? parseItalianFloat(String(order["Costo totale (EUR)"])) : convertUsdToEur(totalCostUSD, orderRate, 'updatePricing');
    const newProfitEUR = Number((newOrderTotal - costEur).toFixed(2));

    const newTotaleStr = `${newOrderTotal.toFixed(2).replace('.', ',')}€`;
    const newProfitStr = newProfitEUR.toFixed(2).replace('.', ',');

    order.totale = newTotaleStr;
    order["Profitto (EUR)"] = newProfitStr;
    order.profitto_eur = newProfitStr;

    // Persistenza Supabase
    const supabase = getSupabaseClient();
    if (supabase && order.id) {
      try {
        await supabase.from('orders').update({
          totale: newTotaleStr,
          carrello: order.carrello,
          profitto_eur: newProfitStr
        }).eq('id', order.id);

        const { data: custOrd } = await supabase.from('customer_orders').select('id').eq('admin_order_id', order.id).maybeSingle();
        if (custOrd) {
          await supabase.from('customer_orders').update({
            subtotal: itemsSubtotal,
            total: newOrderTotal,
            updated_at: new Date().toISOString()
          }).eq('id', custOrd.id);
        }
      } catch (dbErr) {
        console.warn("⚠️ Errore salvataggio pricing ordine su Supabase:", dbErr.message);
      }
    }

    // Persistenza locale
    const localOrders = getLocalOrders();
    const idx = localOrders.findIndex(lo => (lo.id && String(lo.id) === String(order.id)) || (lo.data && lo.data === order.data));
    if (idx !== -1) {
      localOrders[idx] = { ...localOrders[idx], ...order };
      fs.writeFileSync(LOCAL_ORDERS_FILE, JSON.stringify(localOrders, null, 2), 'utf8');
    }

    // Ricalcolo economico completo del lotto
    const updatedLotto = await recalculateCurrentLotto();

    return res.json({
      success: true,
      order,
      lotto: updatedLotto,
      message: "Prezzo concordato aggiornato con successo."
    });
  } catch (err) {
    console.error("⚠️ Errore in update-pricing:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};

app.post('/api/orders/update-pricing', handleUpdateOrderPricing);
app.put('/api/orders/:id/update-pricing', handleUpdateOrderPricing);

// ==========================================
// SISTEMA COUPON - UTILS & API ENDPOINTS
// ==========================================
const LOCAL_COUPONS_FILE = path.join(__dirname, 'coupons_local.json');

function getLocalCoupons() {
  try {
    if (fs.existsSync(LOCAL_COUPONS_FILE)) {
      const content = fs.readFileSync(LOCAL_COUPONS_FILE, 'utf8');
      if (content && content.trim()) {
        return JSON.parse(content);
      }
    }
  } catch (err) {
    console.warn("⚠️ Errore lettura cache locale coupons_local.json:", err.message);
  }
  return [];
}

function saveLocalCoupons(coupons) {
  try {
    if (Array.isArray(coupons)) {
      fs.writeFileSync(LOCAL_COUPONS_FILE, JSON.stringify(coupons, null, 2), 'utf8');
    }
  } catch (err) {
    console.warn("⚠️ Errore scrittura cache locale coupons_local.json:", err.message);
  }
}

function mapTypeToDb(type) {
  if (!type) return 'percentage';
  const t = String(type).toLowerCase().trim();
  if (t === 'percentuale' || t === 'percentage') return 'percentage';
  if (t === 'fisso' || t === 'fixed_amount' || t === 'fixed') return 'fixed_amount';
  if (t === 'fornitore' || t === 'supplier_price' || t === 'supplier') return 'supplier_price';
  return 'percentage';
}

function mapTypeToFrontend(type) {
  if (!type) return 'percentuale';
  const t = String(type).toLowerCase().trim();
  if (t === 'percentage' || t === 'percentuale') return 'percentuale';
  if (t === 'fixed_amount' || t === 'fisso') return 'fisso';
  if (t === 'supplier_price' || t === 'fornitore') return 'fornitore';
  return 'percentuale';
}

async function getCoupons() {
  const supabase = getSupabaseClient();
  if (supabase) {
    console.log(`[COUPON DEBUG]\nOperazione: SELECT\nTabella: public.coupons`);
    const { data: cData, error: cError } = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });

    if (cError) {
      console.error(`[COUPON DEBUG]\nOperazione: SELECT\nTabella: public.coupons\nNumero coupon restituiti: 0\nErrore: ${cError.message}`);
      throw new Error(`Errore Supabase durante la lettura dei coupon: ${cError.message}`);
    }

    if (Array.isArray(cData)) {
      console.log(`[COUPON DEBUG]\nOperazione: SELECT\nTabella: public.coupons\nNumero coupon restituiti: ${cData.length}\nRisultato: SUCCESS`);
      const mappedData = cData.map(item => ({
        ...item,
        type: mapTypeToFrontend(item.type)
      }));
      // Salvataggio passivo nel backup locale
      saveLocalCoupons(mappedData);
      return mappedData;
    }
    throw new Error("Formato dati non valido restituito da Supabase per la tabella 'coupons'");
  }

  console.log(`[COUPON DEBUG]\nOperazione: SELECT\nNote: Supabase non configurato. Uso backup locale.`);
  return getLocalCoupons().map(item => ({ ...item, type: mapTypeToFrontend(item.type) }));
}

async function saveCouponLocal(couponData) {
  const supabase = getSupabaseClient();
  let savedRecord = null;

  const dbType = mapTypeToDb(couponData.type);
  const payload = {
    code: (couponData.code || '').toUpperCase().trim().replace(/\s+/g, ''),
    name: couponData.name || couponData.code || '',
    description: couponData.description || null,
    type: dbType,
    value: (dbType === 'supplier_price' || couponData.type === 'fornitore') ? 0 : (parseFloat(couponData.value) || 0),
    is_active: couponData.is_active !== false,
    usage_limit: couponData.usage_limit !== null && couponData.usage_limit !== undefined && couponData.usage_limit !== '' ? Number(couponData.usage_limit) : null,
    expires_at: couponData.expires_at || null,
    updated_at: new Date().toISOString()
  };

  if (couponData.used_count !== undefined) {
    payload.used_count = Number(couponData.used_count) || 0;
  }

  if (supabase) {
    const isUpdate = couponData.id && !isNaN(Number(couponData.id)) && Number(couponData.id) > 0;
    if (isUpdate) {
      const numericId = Number(couponData.id);
      console.log(`[COUPON DEBUG]\nOperazione: UPDATE\nID: ${numericId}\nTabella: public.coupons`);
      const { data, error } = await supabase
        .from('coupons')
        .update(payload)
        .eq('id', numericId)
        .select('*')
        .single();

      if (error) {
        console.error(`[COUPON DEBUG]\nOperazione: UPDATE\nID: ${numericId}\nRisultato Supabase: ERROR (${error.message})`);
        throw new Error(`Errore salvataggio Supabase: ${error.message}`);
      }
      console.log(`[COUPON DEBUG]\nOperazione: UPDATE\nID: ${numericId}\nRisultato Supabase: SUCCESS`);
      savedRecord = data;
    } else {
      console.log(`[COUPON DEBUG]\nOperazione: CREATE\nCodice: ${payload.code}\nID prima del salvataggio: (assegnato da PostgreSQL sequence)\nTabella: public.coupons`);
      payload.created_at = new Date().toISOString();
      payload.used_count = payload.used_count || 0;

      const { data, error } = await supabase
        .from('coupons')
        .insert([payload])
        .select('*')
        .single();

      if (error) {
        console.error(`[COUPON DEBUG]\nOperazione: CREATE\nCodice: ${payload.code}\nRisultato Supabase: ERROR (${error.message})`);
        throw new Error(`Errore inserimento Supabase: ${error.message}`);
      }
      console.log(`[COUPON DEBUG]\nOperazione: CREATE\nCodice: ${payload.code}\nRisultato Supabase: SUCCESS\nID restituito da Supabase: ${data.id}`);
      savedRecord = data;
    }
  } else {
    // Fallback locale solo se Supabase non è configurato
    let coupons = getLocalCoupons();
    if (couponData.id) {
      const index = coupons.findIndex(c => String(c.id) === String(couponData.id));
      if (index >= 0) {
        coupons[index] = { ...coupons[index], ...payload };
        savedRecord = coupons[index];
      }
    }
    if (!savedRecord) {
      savedRecord = { ...payload, id: Date.now(), created_at: new Date().toISOString(), used_count: 0 };
      coupons.push(savedRecord);
    }
    saveLocalCoupons(coupons);
  }

  // Sincronizza backup locale passivo
  if (supabase) {
    try {
      const { data: allCoupons } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
      if (Array.isArray(allCoupons)) saveLocalCoupons(allCoupons);
    } catch (e) {}
  }

  if (savedRecord) {
    savedRecord = { ...savedRecord, type: mapTypeToFrontend(savedRecord.type) };
  }

  return savedRecord;
}

async function deleteCouponLocal(id) {
  const numericId = Number(id);
  const supabase = getSupabaseClient();
  console.log(`[COUPON DEBUG]\nOperazione: DELETE\nID: ${id}\nTabella: public.coupons`);
  
  if (supabase) {
    if (isNaN(numericId)) {
      console.error(`[COUPON DEBUG]\nOperazione: DELETE\nID: ${id}\nRisultato Supabase: ERROR (ID non valido)`);
      throw new Error(`ID coupon non valido: ${id}`);
    }
    const { error } = await supabase
      .from('coupons')
      .delete()
      .eq('id', numericId);

    if (error) {
      console.error(`[COUPON DEBUG]\nOperazione: DELETE\nID: ${numericId}\nRisultato Supabase: ERROR (${error.message})`);
      throw new Error(`Errore eliminazione Supabase: ${error.message}`);
    }
    console.log(`[COUPON DEBUG]\nOperazione: DELETE\nID: ${numericId}\nRisultato Supabase: SUCCESS`);
  }

  // Sincronizza backup locale passivo
  let coupons = getLocalCoupons();
  coupons = coupons.filter(c => String(c.id) !== String(id));
  saveLocalCoupons(coupons);
}

async function incrementCouponUsage(code) {
  if (!code) return;
  const formattedCode = code.toUpperCase().trim();
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const { data: c, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', formattedCode)
        .maybeSingle();

      if (error) {
        console.error("⚠️ Errore recupero coupon per incremento utilizzi:", error.message);
        return;
      }

      if (c) {
        const newUsedCount = (c.used_count || 0) + 1;
        const { error: updateErr } = await supabase
          .from('coupons')
          .update({ used_count: newUsedCount, updated_at: new Date().toISOString() })
          .eq('id', c.id);

        if (updateErr) {
          console.error("⚠️ Errore aggiornamento used_count coupon su Supabase:", updateErr.message);
        } else {
          console.log(`[COUPONS] Incrementato utilizzazioni coupon '${formattedCode}' a ${newUsedCount}`);
        }
      }
    } catch (err) {
      console.error("⚠️ Eccezione incrementCouponUsage:", err.message);
    }
  } else {
    const coupons = getLocalCoupons();
    const c = coupons.find(item => item.code.toUpperCase() === formattedCode);
    if (c) {
      c.used_count = (c.used_count || 0) + 1;
      saveLocalCoupons(coupons);
    }
  }
}

function calcolaCostoFornitoreEur(carrello, exchangeRate, dbProducts = null) {
  let allProducts = dbProducts;
  if (!allProducts || !Array.isArray(allProducts) || allProducts.length === 0) {
    allProducts = getLocalProducts();
  }

  let costo_completini_usd = 0;
  let costo_personalizzazioni_usd = 0;
  let quant_total = 0;

  carrello.forEach(item => {
    const isSpedizioneCliente = item.squadra && isTechnicalShippingOrServiceLine(item.squadra);
    if (!isSpedizioneCliente) {
      const q = Number(item.quantita || 1);

      let matchedProd = null;
      if (item.id !== undefined && item.id !== null && String(item.id).trim() !== "" && String(item.id) !== "undefined") {
        matchedProd = allProducts.find(p => String(p.id) === String(item.id));
      }
      if (!matchedProd && item.legacy_id !== undefined && item.legacy_id !== null && String(item.legacy_id).trim() !== "" && String(item.legacy_id) !== "undefined") {
        matchedProd = allProducts.find(p => p.legacy_id !== undefined && String(p.legacy_id) === String(item.legacy_id));
      }
      if (!matchedProd) {
        matchedProd = allProducts.find(p => p.versione === item.squadra || p.squadra === item.squadra);
      }

      let baseKitUSD = 0;
      if (matchedProd && matchedProd.prezzo_fornitore !== undefined && matchedProd.prezzo_fornitore !== null && Number(matchedProd.prezzo_fornitore) > 0) {
        baseKitUSD = Number(matchedProd.prezzo_fornitore);
      } else if (item.prezzo_fornitore !== undefined && item.prezzo_fornitore !== null && Number(item.prezzo_fornitore) > 0) {
        baseKitUSD = Number(item.prezzo_fornitore);
      } else if (item.prezzo && Number(item.prezzo) > 0) {
        baseKitUSD = Number(item.prezzo) * 0.4;
      } else {
        baseKitUSD = 10.00;
      }

      const totalItemUSD = calcolaCostoFornitoreProdotto(baseKitUSD, item.infoPerso || item.personalizzazione || "");
      const persUnitUSD = totalItemUSD - baseKitUSD;

      costo_completini_usd += (baseKitUSD * q);
      costo_personalizzazioni_usd += (persUnitUSD * q);
      quant_total += q;
    }
  });

  const settings = getSettings();
  let spedizione_unitaria = 4.0;
  const rules = settings.spedizioneLotto;
  if (rules) {
    if (quant_total >= rules.range1_min && quant_total <= rules.range1_max) {
      spedizione_unitaria = parseFloat(rules.range1_cost);
    } else if (quant_total >= rules.range2_min && quant_total <= rules.range2_max) {
      spedizione_unitaria = parseFloat(rules.range2_cost);
    } else if (quant_total >= rules.range3_min) {
      spedizione_unitaria = parseFloat(rules.range3_cost);
    } else if (rules.range1_cost) {
      spedizione_unitaria = parseFloat(rules.range1_cost);
    }
  }

  const costo_spedizione_usd = quant_total * spedizione_unitaria;
  const costo_totale_usd = costo_completini_usd + costo_personalizzazioni_usd + costo_spedizione_usd;
  const prezzo_finale_eur = Number((costo_totale_usd * exchangeRate).toFixed(2));

  console.log("Costo completino USD:", Number(costo_completini_usd.toFixed(2)));
  console.log("Costo spedizione USD:", Number(costo_spedizione_usd.toFixed(2)));
  console.log("Costo personalizzazioni USD:", Number(costo_personalizzazioni_usd.toFixed(2)));
  console.log("Totale USD:", Number(costo_totale_usd.toFixed(2)));
  console.log("Cambio USD/EUR:", exchangeRate);
  console.log("Prezzo finale EUR:", prezzo_finale_eur);
  console.log("Totale cliente:", prezzo_finale_eur);

  return prezzo_finale_eur;
}

app.get('/api/coupons', async (req, res) => {
  try {
    const coupons = await getCoupons();
    return res.json({ success: true, coupons });
  } catch (err) {
    console.error("⚠️ Errore GET /api/coupons:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/coupons', async (req, res) => {
  try {
    const { id, code, type, value, is_active, usage_limit, expires_at } = req.body;
    if (!code || !type) {
      return res.status(400).json({ success: false, error: "Codice e tipo sono obbligatori." });
    }
    
    const formattedCode = code.toUpperCase().trim().replace(/\s+/g, '');
    const couponData = {
      id: id ? (isNaN(Number(id)) ? id : Number(id)) : undefined,
      code: formattedCode,
      type,
      value: type === 'fornitore' ? 0 : (parseFloat(value) || 0),
      is_active: is_active !== false,
      usage_limit: usage_limit ? Number(usage_limit) : null,
      expires_at: expires_at || null,
      updated_at: new Date().toISOString()
    };
    
    const coupons = await getCoupons();
    const existing = coupons.find(c => c.code.toUpperCase() === formattedCode.toUpperCase() && String(c.id) !== String(id));
    if (existing) {
      return res.status(400).json({ success: false, error: "Un coupon con questo codice esiste già." });
    }

    const savedCoupon = await saveCouponLocal(couponData);
    return res.json({ success: true, coupon: savedCoupon });
  } catch (err) {
    console.error("⚠️ Errore POST /api/coupons:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/coupons/duplicate', async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, error: "ID coupon mancante." });
    }
    
    const coupons = await getCoupons();
    const orig = coupons.find(c => String(c.id) === String(id));
    if (!orig) {
      return res.status(404).json({ success: false, error: "Coupon originale non trovato." });
    }
    
    let suffix = 1;
    let newCode = `${orig.code}_COPIA`;
    while (coupons.some(c => c.code.toUpperCase() === newCode.toUpperCase())) {
      newCode = `${orig.code}_COPIA${suffix}`;
      suffix++;
    }
    
    const dupData = {
      // id non specificato -> generato automaticamente da PostgreSQL
      code: newCode,
      name: `${orig.name || orig.code} (Copia)`,
      description: orig.description || null,
      type: orig.type,
      value: orig.value,
      is_active: orig.is_active,
      usage_limit: orig.usage_limit,
      expires_at: orig.expires_at,
      used_count: 0
    };
    
    const savedCoupon = await saveCouponLocal(dupData);
    return res.json({ success: true, coupon: savedCoupon });
  } catch (err) {
    console.error("⚠️ Errore POST /api/coupons/duplicate:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/coupons/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, error: "ID coupon mancante." });
    }
    
    await deleteCouponLocal(id);
    return res.json({ success: true });
  } catch (err) {
    console.error("⚠️ Errore DELETE /api/coupons/:id:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/coupons/validate', async (req, res) => {
  try {
    const { code, carrello } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, error: "Codice coupon mancante." });
    }
    if (!Array.isArray(carrello) || carrello.length === 0) {
      return res.status(400).json({ success: false, error: "Il carrello è vuoto." });
    }
    
    const coupons = await getCoupons();
    const c = coupons.find(item => item.code.toLowerCase() === code.toLowerCase().trim());
    if (!c) {
      return res.json({ success: true, valid: false, message: "Codice non valido." });
    }
    
    if (!c.is_active) {
      return res.json({ success: true, valid: false, message: "Codice disattivato." });
    }
    
    if (c.expires_at && new Date(c.expires_at) < new Date()) {
      return res.json({ success: true, valid: false, message: "Codice scaduto." });
    }
    
    if (c.usage_limit !== null && c.usage_limit !== undefined && c.used_count >= c.usage_limit) {
      return res.json({ success: true, valid: false, message: "Limite utilizzi raggiunto." });
    }
    
    let subtotal_eur = 0;
    carrello.forEach(item => {
      const isSpedizioneCliente = item.squadra && isTechnicalShippingOrServiceLine(item.squadra);
      if (!isSpedizioneCliente) {
        subtotal_eur += (Number(item.prezzo || 0) * Number(item.quantita || 1));
      }
    });
    
    const shipping_cost_eur = subtotal_eur >= 50 ? 0 : 2;
    
    let discount = 0;
    let supplier_cost_eur = null;
    if (c.type === 'percentuale') {
      discount = subtotal_eur * (parseFloat(c.value) / 100);
    } else if (c.type === 'fisso') {
      discount = Math.min(parseFloat(c.value), subtotal_eur + shipping_cost_eur);
    } else if (c.type === 'fornitore') {
      const settings = getSettings();
      let exchangeRate = 0.92;
      if (settings.cambioValuta.mode === 'manual') {
        exchangeRate = parseFloat(settings.cambioValuta.manual_rate) || 0.86;
      } else {
        try {
          const rateRes = await fetch('https://open.er-api.com/v6/latest/USD');
          if (rateRes.ok) {
            const rateData = await rateRes.json();
            if (rateData && rateData.rates && rateData.rates.EUR) {
              exchangeRate = rateData.rates.EUR;
            }
          }
        } catch (err) {
          exchangeRate = parseFloat(settings.cambioValuta.manual_rate) || 0.92;
        }
      }
      
      let allDbProducts = getLocalProducts();
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const sp = await getAllProductsFromSupabase(supabase);
          if (sp && sp.length > 0) allDbProducts = sp;
        } catch (e) {}
      }
      supplier_cost_eur = calcolaCostoFornitoreEur(carrello, exchangeRate, allDbProducts);
      discount = 0;
    }
    
    return res.json({
      success: true,
      valid: true,
      coupon: {
        code: c.code,
        type: c.type,
        value: c.value
      },
      discount: Number(discount.toFixed(2)),
      supplier_cost_eur: supplier_cost_eur ? Number(supplier_cost_eur.toFixed(2)) : null
    });
  } catch (err) {
    console.error("⚠️ Errore POST /api/coupons/validate:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// SEZIONE SUDDIVISIONE CONTI (SERGIO & RICCARDO)
// CONTABILITÀ INTERNA DEL PROFITTO — NON MODIFICA GLI ORDINI O ALTRI MODULI
// ============================================================================
const LOCAL_PROFIT_SHARES_FILE = path.join(__dirname, 'profit_shares_local.json');

function getLocalProfitShares() {
  try {
    if (fs.existsSync(LOCAL_PROFIT_SHARES_FILE)) {
      const content = fs.readFileSync(LOCAL_PROFIT_SHARES_FILE, 'utf8');
      if (content && content.trim()) {
        const parsed = JSON.parse(content);
        return {
          shares: (parsed && typeof parsed.shares === 'object' && !Array.isArray(parsed.shares)) ? parsed.shares : {},
          movements: (parsed && Array.isArray(parsed.movements)) ? parsed.movements : [],
          modifications: (parsed && typeof parsed.modifications === 'object' && !Array.isArray(parsed.modifications)) ? parsed.modifications : {},
          lot_percentages: (parsed && typeof parsed.lot_percentages === 'object' && !Array.isArray(parsed.lot_percentages)) ? parsed.lot_percentages : {},
          extra_expenses: (parsed && Array.isArray(parsed.extra_expenses)) ? parsed.extra_expenses : []
        };
      }
    }
  } catch (err) {
    console.warn("⚠️ Errore lettura backup locale profit_shares_local.json:", err.message);
  }
  return { shares: {}, movements: [], modifications: {}, lot_percentages: {}, extra_expenses: [] };
}

function saveLocalProfitShares(data) {
  try {
    const payload = {
      shares: (data && typeof data.shares === 'object' && !Array.isArray(data.shares)) ? data.shares : {},
      movements: (data && Array.isArray(data.movements)) ? data.movements : [],
      modifications: (data && typeof data.modifications === 'object' && !Array.isArray(data.modifications)) ? data.modifications : {},
      lot_percentages: (data && typeof data.lot_percentages === 'object' && !Array.isArray(data.lot_percentages)) ? data.lot_percentages : {},
      extra_expenses: (data && Array.isArray(data.extra_expenses)) ? data.extra_expenses : []
    };
    fs.writeFileSync(LOCAL_PROFIT_SHARES_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch (err) {
    console.warn("⚠️ Errore salvataggio backup locale profit_shares_local.json:", err.message);
  }
}

async function getDbProfitShares() {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'profit_shares')
        .maybeSingle();

      if (!error && data && data.value) {
        const val = data.value;
        const result = {
          shares: (val && typeof val.shares === 'object' && !Array.isArray(val.shares)) ? val.shares : {},
          movements: (val && Array.isArray(val.movements)) ? val.movements : [],
          modifications: (val && typeof val.modifications === 'object' && !Array.isArray(val.modifications)) ? val.modifications : {},
          lot_percentages: (val && typeof val.lot_percentages === 'object' && !Array.isArray(val.lot_percentages)) ? val.lot_percentages : {},
          extra_expenses: (val && Array.isArray(val.extra_expenses)) ? val.extra_expenses : []
        };
        saveLocalProfitShares(result);
        return result;
      }
    } catch (err) {
      console.warn("⚠️ Query profit_shares da settings fallita, uso cache:", err.message);
    }
  }
  return getLocalProfitShares();
}

async function saveDbProfitShares(data) {
  const payload = {
    shares: (data && typeof data.shares === 'object' && !Array.isArray(data.shares)) ? data.shares : {},
    movements: (data && Array.isArray(data.movements)) ? data.movements : [],
    modifications: (data && typeof data.modifications === 'object' && !Array.isArray(data.modifications)) ? data.modifications : {},
    lot_percentages: (data && typeof data.lot_percentages === 'object' && !Array.isArray(data.lot_percentages)) ? data.lot_percentages : {},
    extra_expenses: (data && Array.isArray(data.extra_expenses)) ? data.extra_expenses : []
  };

  // Salva backup locale
  saveLocalProfitShares(payload);

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({
          key: 'profit_shares',
          value: payload,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

      if (error) {
        console.error("⚠️ Errore salvataggio profit_shares su Supabase settings:", error.message);
      }
    } catch (err) {
      console.error("⚠️ Eccezione salvataggio profit_shares:", err.message);
    }
  }
  return payload;
}

function parseOrderProfitValue(order) {
  if (!order) return 0;
  const raw = order["Profitto (EUR)"] !== undefined ? order["Profitto (EUR)"] : (order.profitto_eur !== undefined ? order.profitto_eur : order.profitto);
  if (raw === undefined || raw === null) return 0;
  if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;
  const str = String(raw).trim().replace('€', '').replace(/\s/g, '');
  const parsed = parseFloat(str.replace(/\./g, '').replace(',', '.'));
  return isNaN(parsed) ? 0 : parsed;
}

function parseOrderCostEUR(order, exchangeRate = 0.92) {
  if (!order) return 0;
  const raw = order["Costo totale (EUR)"] !== undefined ? order["Costo totale (EUR)"]
    : (order["Costo (EUR)"] !== undefined ? order["Costo (EUR)"]
    : (order["Costo Fornitore (EUR)"] !== undefined ? order["Costo Fornitore (EUR)"]
    : (order["Costo Totale Fornitore (EUR)"] !== undefined ? order["Costo Totale Fornitore (EUR)"]
    : (order.costo_totale_eur !== undefined ? order.costo_totale_eur
    : (order.costo_eur !== undefined ? order.costo_eur
    : (order.cost_eur !== undefined ? order.cost_eur
    : (order.costo_fornitore_eur !== undefined ? order.costo_fornitore_eur
    : (order.costo !== undefined ? order.costo : undefined))))))));
  if (raw !== undefined && raw !== null) {
    if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;
    const str = String(raw).trim().replace('€', '').replace('$', '').replace(/\s/g, '');
    const parsed = parseFloat(str.replace(/\./g, '').replace(',', '.'));
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  // Fallback: Check USD cost fields and convert to EUR
  const rawUsd = order["Costo totale (USD)"] !== undefined ? order["Costo totale (USD)"]
    : (order["Costo (USD)"] !== undefined ? order["Costo (USD)"]
    : (order["Costo Fornitore (USD)"] !== undefined ? order["Costo Fornitore (USD)"]
    : (order.costo_totale_usd !== undefined ? order.costo_totale_usd
    : (order.costo_fornitore_usd !== undefined ? order.costo_fornitore_usd
    : (order.costo_usd !== undefined ? order.costo_usd : undefined)))));
  if (rawUsd !== undefined && rawUsd !== null) {
    let usdVal = 0;
    if (typeof rawUsd === 'number') usdVal = isNaN(rawUsd) ? 0 : rawUsd;
    else {
      const strUsd = String(rawUsd).trim().replace('$', '').replace('€', '').replace(/\s/g, '');
      usdVal = parseFloat(strUsd.replace(/\./g, '').replace(',', '.')) || 0;
    }
    if (usdVal > 0) {
      return Number((usdVal * (exchangeRate || 0.92)).toFixed(2));
    }
  }

  return 0;
}

// Recupera tutti gli articoli di un ordine e calcola dettagliatamente il costo fornitore in USD (Base + Personalizzazioni + Spedizione)
async function getOrderItemsDetailedSupplierCosts(order, allDbProducts = null, currentSettings = null, unitShippingOverride = null) {
  if (!order) return [];
  
  if (!allDbProducts) {
    let localProducts = [];
    try {
      localProducts = getLocalProducts();
    } catch (e) {}
    let supabaseProducts = [];
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        supabaseProducts = await getAllProductsFromSupabase(supabase);
      }
    } catch (e) {}
    allDbProducts = supabaseProducts.length > 0 ? supabaseProducts : localProducts;
  }

  const prodByIdMap = new Map();
  const prodByLegacyIdMap = new Map();
  const prodByExactVersioneMap = new Map();

  (allDbProducts || []).forEach(p => {
    if (p.id !== undefined && p.id !== null && String(p.id).trim() !== "") {
      prodByIdMap.set(String(p.id).trim(), p);
    }
    if (p.legacy_id !== undefined && p.legacy_id !== null && String(p.legacy_id).trim() !== "") {
      prodByLegacyIdMap.set(String(p.legacy_id).trim(), p);
    }
    if (p.versione) {
      prodByExactVersioneMap.set(String(p.versione).trim().toLowerCase(), p);
    }
  });

  let cartItems = order.carrello;
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    cartItems = ricostruisciCarrelloDaStringhe(order);
  }

  const settings = currentSettings || getSettings();
  const shippingUnitUSD = (unitShippingOverride !== null && unitShippingOverride !== undefined)
    ? Number(unitShippingOverride)
    : getShippingRateByQuantity(1, settings);

  const orderExchangeRate = getOrderEffectiveExchangeRate(order, settings);

  const items = [];
  (cartItems || []).forEach((item, idx) => {
    const isSpedizioneCliente = item.squadra && isTechnicalShippingOrServiceLine(item.squadra);
    if (isSpedizioneCliente) return;

    const q = Math.max(1, parseInt(item.quantita) || 1);

    // MATCHING RIGIDO
    let matchedProd = null;
    if (item.id !== undefined && item.id !== null && String(item.id).trim() !== "" && String(item.id) !== "undefined") {
      matchedProd = prodByIdMap.get(String(item.id).trim());
    }
    if (!matchedProd && item.legacy_id !== undefined && item.legacy_id !== null && String(item.legacy_id).trim() !== "" && String(item.legacy_id) !== "undefined") {
      const cand = prodByLegacyIdMap.get(String(item.legacy_id).trim());
      if (cand) {
        const itemSq = String(item.squadra || item.versione || "").trim().toLowerCase();
        const candVer = String(cand.versione || "").trim().toLowerCase();
        const candSq = String(cand.squadra || "").trim().toLowerCase();
        if (itemSq === candVer || itemSq === candSq || candVer.includes(itemSq) || itemSq.includes(candVer) || candSq.includes(itemSq)) {
          matchedProd = cand;
        }
      }
    }
    if (!matchedProd && item.squadra) {
      const sqKey = String(item.squadra).trim().toLowerCase();
      matchedProd = prodByExactVersioneMap.get(sqKey);
    }

    // PREZZO FORNITORE BASE IN USD
    let basePriceUSD = 0;
    if (matchedProd && matchedProd.prezzo_fornitore !== undefined && matchedProd.prezzo_fornitore !== null && Number(matchedProd.prezzo_fornitore) > 0) {
      basePriceUSD = Number(matchedProd.prezzo_fornitore);
    } else if (item.prezzo_fornitore !== undefined && item.prezzo_fornitore !== null && Number(item.prezzo_fornitore) > 0) {
      basePriceUSD = Number(item.prezzo_fornitore);
    } else if (item.Prezzo_fornitore !== undefined && item.Prezzo_fornitore !== null && Number(item.Prezzo_fornitore) > 0) {
      basePriceUSD = Number(item.Prezzo_fornitore);
    } else {
      basePriceUSD = 10.00;
    }

    // Calcolo personalizzazioni fornitore in USD (Formula ufficiale: $1 Nome, $1 Numero, $1 Patch)
    const rawInfoPerso = item.infoPerso || item.personalizzazione || "";
    const customDetails = parseCustomizationDetails(rawInfoPerso, item);
    const supplierCustomizationPriceUSD = customDetails.customizationCostUSD;

    const unitTotalCostUSD = Number((basePriceUSD + supplierCustomizationPriceUSD + shippingUnitUSD).toFixed(2));
    const totalPriceUSD = Number((unitTotalCostUSD * q).toFixed(2));

    const unitTotalCostEUR = convertUsdToEur(unitTotalCostUSD, orderExchangeRate, 'getOrderItemsDetailedSupplierCosts');
    const totalPriceEUR = Number((unitTotalCostEUR * q).toFixed(2));

    const titleItalian = matchedProd ? matchedProd.versione.trim() : (item.versione || item.squadra || "").trim();
    const squadra = matchedProd ? matchedProd.squadra.trim() : (item.squadra || "").trim();
    const imageUrl = (matchedProd && matchedProd.immagine) ? matchedProd.immagine.trim() : (item.imgUrl || item.immagine || "").trim();

    items.push({
      item_index: idx,
      product_id: matchedProd ? matchedProd.id : (item.id || null),
      title: titleItalian || squadra || `Articolo #${idx + 1}`,
      squadra: squadra,
      taglia: item.taglia || "-",
      quantita: q,
      info_perso: rawInfoPerso,
      has_customization: customDetails.hasCustomization,
      customization_cost_usd: Number(supplierCustomizationPriceUSD.toFixed(2)),
      base_price_usd: Number(basePriceUSD.toFixed(2)),
      shipping_unit_usd: Number(shippingUnitUSD.toFixed(2)),
      unit_total_cost_usd: unitTotalCostUSD,
      total_cost_usd: totalPriceUSD,
      unit_total_cost_eur: unitTotalCostEUR,
      total_cost_eur: totalPriceEUR,
      image_url: imageUrl,
      label: `${titleItalian || squadra} (Taglia: ${item.taglia || '-'}) — $ ${unitTotalCostUSD.toFixed(2)} USD (€ ${unitTotalCostEUR.toFixed(2)})`
    });
  });

  return items;
}

// Helper per calcolare la suddivisione economica completa di un lotto (attivo o archiviato)
async function computeProfitSplitForLotto(targetLottoId, options = {}) {
  const {
    allOrders = [],
    profitData = {},
    settings = {},
    allDbProducts = [],
    lottoArchive = [],
    currentActiveLottoId = getCurrentActiveLottoId()
  } = options;

  const lotIdNum = Number(targetLottoId);
  const isActiveLot = (lotIdNum === Number(currentActiveLottoId));
  const isArchivedLot = !isActiveLot;
  
  // Recupera il lotto dall'archivio se non è quello attivo
  const archivedLotto = (!isActiveLot) ? (lottoArchive.find(l => Number(l.id) === lotIdNum) || null) : null;
  const lottoName = archivedLotto?.numero_lotto || `Lotto #${lotIdNum}`;
  const lottoArchivedAt = archivedLotto?.archived_at || null;

  // Determina gli ordini di questo lotto
  let orders = [];
  if (isActiveLot) {
    orders = (allOrders || []).filter(o => !o.is_archived && isOrderActiveForLotto(o));
  } else {
    orders = getOrdersForArchivedLotto(archivedLotto, allOrders);
  }

  // Costi e tariffe di spedizione lotto
  let currentLotShippingRate = 4;
  let lotTotals = { alibaba_fee_usd: 0, alibaba_fee_eur: 0, spedizione_unitaria: 4 };
  if (isActiveLot) {
    lotTotals = calculateLottoTotals(orders, settings);
    currentLotShippingRate = lotTotals.spedizione_unitaria;
  } else if (archivedLotto) {
    lotTotals.alibaba_fee_usd = Number(archivedLotto.alibaba_fee_usd || ((Number(archivedLotto.costo_prodotti_usd || 0) + Number(archivedLotto.costo_spedizione_usd || 0)) * 0.03));
    lotTotals.alibaba_fee_eur = Number(archivedLotto.alibaba_fee_eur || 0);
  }

  const modifications = profitData.modifications || {};
  let totalProfit = 0;
  let sergioTotalWithdrawals = 0;
  let riccardoTotalWithdrawals = 0;
  let countCompletiniSergio = 0;
  let countCompletiniRiccardo = 0;
  let countCompletini5050 = 0;

  const modificationsList = [];
  const lotOrdersList = [];

  for (const o of orders) {
    const orderIdStr = String(o.id !== undefined && o.id !== null ? o.id : o.data);
    const dataKey = o.data ? String(o.data) : '';
    const orderNumber = o["Numero Ordine"] || o.order_number || (o.id ? `#${o.id}` : dataKey);
    const customerName = o.nome || 'Cliente';
    const orderDate = o.data || o.created_at || '';
    const orderExchangeRate = getOrderEffectiveExchangeRate(o, settings);
    
    // Profitto originale dell'ordine
    const profitTotal = parseOrderProfitValue(o);
    totalProfit += profitTotal;

    // Articoli con costi fornitore
    let orderItems = [];
    try {
      orderItems = await getOrderItemsDetailedSupplierCosts(o, allDbProducts, settings, currentLotShippingRate);
    } catch (e) {
      orderItems = [];
    }

    const eurDirect = parseOrderCostEUR(o, orderExchangeRate);
    const itemsUsd = orderItems.reduce((s, it) => s + (Number(it.total_cost_usd) || 0), 0);
    const calculatedEur = itemsUsd > 0 ? convertUsdToEur(itemsUsd, orderExchangeRate, '/api/profit-splits') : 0;
    const orderCostEur = (o.costo_eur !== undefined && o.costo_eur !== null && Number(o.costo_eur) > 0)
      ? Number(o.costo_eur)
      : (eurDirect > 0 ? eurDirect : (calculatedEur > 0 ? calculatedEur : (itemsUsd > 0 ? itemsUsd : 0)));
    const finalCostEur = Number(orderCostEur.toFixed(2));

    const productsSummary = orderItems.length > 0
      ? orderItems.map(it => `${it.title || it.squadra || 'Articolo'}${it.taglia && it.taglia !== '-' ? ` (${it.taglia})` : ''}`).join(', ')
      : (o.prodotto || o.descrizione || 'Articolo');

    // Verifica modifica manuale
    const mod = modifications[orderIdStr] || (dataKey ? modifications[dataKey] : null);
    const isModified = !!mod;

    if (isModified) {
      const division = mod.division || '100_sergio';
      const costToCharge = (mod.cost_eur !== undefined && mod.cost_eur !== null) ? Number(mod.cost_eur) : finalCostEur;
      
      let sergioCharge = 0;
      let riccardoCharge = 0;
      let divisionLabel = '50% Sergio / 50% Riccardo';

      if (division === '100_sergio') {
        sergioCharge = costToCharge;
        riccardoCharge = 0;
        divisionLabel = '100% Sergio';
        countCompletiniSergio++;
      } else if (division === '100_riccardo') {
        sergioCharge = 0;
        riccardoCharge = costToCharge;
        divisionLabel = '100% Riccardo';
        countCompletiniRiccardo++;
      } else if (division === '50_50') {
        sergioCharge = Number((costToCharge / 2).toFixed(2));
        riccardoCharge = Number((costToCharge / 2).toFixed(2));
        divisionLabel = '50% Sergio / 50% Riccardo';
        countCompletini5050++;
      }

      sergioTotalWithdrawals += sergioCharge;
      riccardoTotalWithdrawals += riccardoCharge;

      modificationsList.push({
        order_id: orderIdStr,
        order_data_key: dataKey,
        order_number: orderNumber,
        customer_name: customerName,
        order_date: orderDate,
        profit_eur: Number(profitTotal.toFixed(2)),
        profit_total: Number(profitTotal.toFixed(2)),
        cost_eur: costToCharge,
        division: division,
        division_label: divisionLabel,
        sergio_charge: sergioCharge,
        sergio_debit: sergioCharge,
        riccardo_charge: riccardoCharge,
        riccardo_debit: riccardoCharge,
        products_summary: productsSummary,
        items_text: productsSummary,
        items: orderItems,
        updated_at: mod.updated_at
      });
    }

    lotOrdersList.push({
      order_id: orderIdStr,
      order_data_key: dataKey,
      order_number: orderNumber,
      customer_name: customerName,
      order_date: orderDate,
      profit_eur: Number(profitTotal.toFixed(2)),
      profit_total: Number(profitTotal.toFixed(2)),
      cost_eur: finalCostEur,
      products_summary: productsSummary,
      items_text: productsSummary,
      items: orderItems,
      is_modified: isModified,
      current_division: isModified ? mod.division : null
    });
  }

  // Spese Extra del lotto
  const allExtraExpenses = Array.isArray(profitData.extra_expenses) ? profitData.extra_expenses : [];
  const lotExtraExpenses = allExtraExpenses.filter(e => e.lotto_id !== undefined && e.lotto_id !== null && Number(e.lotto_id) === lotIdNum);
  
  let extraExpensesSergio = 0;
  let extraExpensesRiccardo = 0;
  let extraExpensesOther = 0;
  let extraExpensesTotalUsd = 0;

  for (const exp of lotExtraExpenses) {
    extraExpensesSergio += Number(exp.sergio_eur) || 0;
    extraExpensesRiccardo += Number(exp.riccardo_eur) || 0;
    if (exp.assigned_to === 'altro' || exp.assigned_to === '50_50') {
      extraExpensesOther += Number(exp.total_eur) || 0;
    }
    extraExpensesTotalUsd += Number(exp.total_usd) || 0;
  }

  extraExpensesSergio = Number(extraExpensesSergio.toFixed(2));
  extraExpensesRiccardo = Number(extraExpensesRiccardo.toFixed(2));
  const extraExpensesTotalEur = Number((extraExpensesSergio + extraExpensesRiccardo).toFixed(2));
  extraExpensesTotalUsd = Number(extraExpensesTotalUsd.toFixed(2));

  // Profitto effettivo del lotto (Calcolo fresco, deterministico ed idempotente)
  let netTotalProfit = 0;
  let ordersProfitTotal = Number(totalProfit.toFixed(2));
  const alibabaFeeUsd = Number(lotTotals.alibaba_fee_usd || 0);
  const alibabaFeeEur = Number(lotTotals.alibaba_fee_eur || 0);

  if (orders.length > 0) {
    ordersProfitTotal = Number(totalProfit.toFixed(2));
    netTotalProfit = Number((ordersProfitTotal - alibabaFeeEur).toFixed(2));
  } else if (archivedLotto && Number(archivedLotto.profitto_eur) > 0) {
    netTotalProfit = Number(archivedLotto.profitto_eur);
    ordersProfitTotal = Number((netTotalProfit + alibabaFeeEur).toFixed(2));
  } else {
    netTotalProfit = Number((ordersProfitTotal - alibabaFeeEur).toFixed(2));
  }

  // Spese personali completini e totali
  const speseCompletiniSergio = Number(sergioTotalWithdrawals.toFixed(2));
  const speseCompletiniRiccardo = Number(riccardoTotalWithdrawals.toFixed(2));
  const speseSergio = Number((speseCompletiniSergio + extraExpensesSergio).toFixed(2));
  const speseRiccardo = Number((speseCompletiniRiccardo + extraExpensesRiccardo).toFixed(2));
  const speseTotali = Number((speseSergio + speseRiccardo).toFixed(2));

  // Profitto Residuo
  const profittoResiduo = Number((netTotalProfit - speseSergio - speseRiccardo).toFixed(2));

  // In modalità "In base alle spese personali" (by_expenses):
  // La suddivisione base è SEMPRE 50% Sergio e 50% Riccardo prima di considerare gli acquisti personali.
  // Le spese personali non alterano le percentuali base, ma vengono sottratte dalla quota base (50%) di ciascun socio.
  const autoSergioPercentage = 50;
  const autoRiccardoPercentage = 50;

  // Configurazione lotto salvata
  const lotPercentages = (profitData && typeof profitData.lot_percentages === 'object' && !Array.isArray(profitData.lot_percentages)) ? profitData.lot_percentages : {};
  const lotConfig = lotPercentages[String(lotIdNum)] || {};
  const splitMode = (lotConfig.split_mode === 'by_expenses') ? 'by_expenses' : 'manual';

  let manualSergioPercentage = 50;
  let manualRiccardoPercentage = 50;
  if (lotConfig.sergio_percentage !== undefined && lotConfig.sergio_percentage !== null) {
    const sp = Number(lotConfig.sergio_percentage);
    if (!isNaN(sp) && sp >= 0 && sp <= 100) {
      manualSergioPercentage = sp;
      manualRiccardoPercentage = Number((100 - sp).toFixed(2));
    }
  } else if (lotConfig.riccardo_percentage !== undefined && lotConfig.riccardo_percentage !== null) {
    const rp = Number(lotConfig.riccardo_percentage);
    if (!isNaN(rp) && rp >= 0 && rp <= 100) {
      manualRiccardoPercentage = rp;
      manualSergioPercentage = Number((100 - rp).toFixed(2));
    }
  }

  const sergioPercentage = (splitMode === 'by_expenses') ? autoSergioPercentage : manualSergioPercentage;
  const riccardoPercentage = (splitMode === 'by_expenses') ? autoRiccardoPercentage : manualRiccardoPercentage;

  // Quote lorde (Quote base prima degli acquisti personali)
  let sergioGrossShare = 0;
  let riccardoGrossShare = 0;
  if (sergioPercentage === 100) {
    sergioGrossShare = netTotalProfit;
    riccardoGrossShare = 0;
  } else if (riccardoPercentage === 100) {
    sergioGrossShare = 0;
    riccardoGrossShare = netTotalProfit;
  } else {
    // Gestione accurata dei centesimi in modo che sergioGrossShare + riccardoGrossShare === netTotalProfit
    sergioGrossShare = Number(((netTotalProfit * sergioPercentage) / 100).toFixed(2));
    riccardoGrossShare = Number((netTotalProfit - sergioGrossShare).toFixed(2));
  }

  // Quote nette / Saldi residui: Quota Base - Acquisti Personali
  const sergioResidualShare = Number((sergioGrossShare - speseSergio).toFixed(2));
  const riccardoResidualShare = Number((riccardoGrossShare - speseRiccardo).toFixed(2));
  const totaleProfittoAssegnato = Number((sergioResidualShare + riccardoResidualShare).toFixed(2));

  // Calcolo Incasso Clienti Base ed Effettivo (regola universale per tutti i lotti)
  let lotIncassoBase = 0;
  if (isActiveLot) {
    orders.forEach(o => {
      lotIncassoBase += parseFlexibleDecimal(o.totale || '');
    });
  } else if (archivedLotto && archivedLotto.incasso_totale_eur !== undefined && Number(archivedLotto.incasso_totale_eur) > 0) {
    lotIncassoBase = Number(archivedLotto.incasso_totale_eur);
  } else {
    orders.forEach(o => {
      lotIncassoBase += parseFlexibleDecimal(o.totale || '');
    });
  }
  lotIncassoBase = Number(lotIncassoBase.toFixed(2));

  // A) INCASSO BASE: Totale ordini del lotto
  // B) COSTO DEI PRODOTTI PERSONALI: Prodotti degli ordini assegnati a Sergio / Riccardo / 50-50
  const costoProdottiPersonali = Number((speseCompletiniSergio + speseCompletiniRiccardo).toFixed(2));

  // Profitto disponibile del lotto prima degli acquisti personali
  const profittoDisponibile = Number((netTotalProfit - extraExpensesTotalEur).toFixed(2));

  // Costo coperto dal profitto disponibile
  const costoCoperto = (profittoDisponibile > 0)
    ? Math.min(profittoDisponibile, costoProdottiPersonali)
    : 0;

  // C) DEFICIT: eventuale parte degli acquisti personali che supera il profitto disponibile
  const deficitTotale = (costoProdottiPersonali > profittoDisponibile)
    ? Number((costoProdottiPersonali - Math.max(0, profittoDisponibile)).toFixed(2))
    : 0;

  // INCASSO CLIENTI: incassoBase - costoCoperto + deficit
  const incassoEffettivo = Number((lotIncassoBase - costoCoperto + deficitTotale).toFixed(2));

  return {
    lotto_id: lotIdNum,
    numero_lotto: lottoName,
    archived_at: lottoArchivedAt,
    is_active: isActiveLot,
    is_archived: isArchivedLot,
    split_mode: splitMode,
    exchange_rate: getEffectiveExchangeRate(settings),
    total_orders: orders.length,
    orders_profit_total: ordersProfitTotal,
    alibaba_fee_usd: alibabaFeeUsd,
    alibaba_fee_eur: alibabaFeeEur,
    incasso_base: lotIncassoBase,
    incasso_totale_base: lotIncassoBase,
    costo_prodotti_personali: costoProdottiPersonali,
    profitto_disponibile: profittoDisponibile,
    costo_coperto: costoCoperto,
    deficit: deficitTotale,
    deficit_totale: deficitTotale,
    incasso_effettivo: incassoEffettivo,
    incasso_netto: incassoEffettivo,
    costi_acquisti_profitto: costoProdottiPersonali,
    total_profit: netTotalProfit,
    net_total_profit: netTotalProfit,
    profitto_lotto: netTotalProfit,
    profitto_disponibile: netTotalProfit,
    spese_completini_sergio: speseCompletiniSergio,
    spese_completini_riccardo: speseCompletiniRiccardo,
    extra_expenses_sergio: extraExpensesSergio,
    extra_expenses_riccardo: extraExpensesRiccardo,
    extra_expenses_other: extraExpensesOther,
    extra_expenses_total_eur: extraExpensesTotalEur,
    extra_expenses_total_usd: extraExpensesTotalUsd,
    extra_expenses_count: lotExtraExpenses.length,
    spese_sergio: speseSergio,
    spese_riccardo: speseRiccardo,
    spese_totali: speseTotali,
    saldo_residuo_sergio: sergioResidualShare,
    saldo_residuo_riccardo: riccardoResidualShare,
    credito_residuo_sergio: sergioResidualShare,
    credito_residuo_riccardo: riccardoResidualShare,
    somma_crediti_residui: totaleProfittoAssegnato,
    auto_sergio_percentage: autoSergioPercentage,
    auto_riccardo_percentage: autoRiccardoPercentage,
    manual_sergio_percentage: manualSergioPercentage,
    manual_riccardo_percentage: manualRiccardoPercentage,
    profitto_residuo: profittoResiduo,
    sergio_percentage: sergioPercentage,
    riccardo_percentage: riccardoPercentage,
    sergio_gross_share: sergioGrossShare,
    riccardo_gross_share: riccardoGrossShare,
    sergio_residual_share: sergioResidualShare,
    riccardo_residual_share: riccardoResidualShare,
    sergio_net: sergioResidualShare,
    riccardo_net: riccardoResidualShare,
    totale_profitto_assegnato: totaleProfittoAssegnato,
    total_modifications: modificationsList.length,
    completini_sergio_count: countCompletiniSergio,
    completini_riccardo_count: countCompletiniRiccardo,
    completini_50_50_count: countCompletini5050,
    total_net: profittoResiduo,
    sergio: {
      total_initial: sergioGrossShare,
      total_withdrawals: speseSergio,
      spese_completini: speseCompletiniSergio,
      spese_extra: extraExpensesSergio,
      saldo_residuo: sergioResidualShare,
      credito_residuo: sergioResidualShare,
      total_net: sergioResidualShare,
      residual_share: sergioResidualShare,
      percentage: sergioPercentage
    },
    riccardo: {
      total_initial: riccardoGrossShare,
      total_withdrawals: speseRiccardo,
      spese_completini: speseCompletiniRiccardo,
      spese_extra: extraExpensesRiccardo,
      saldo_residuo: riccardoResidualShare,
      credito_residuo: riccardoResidualShare,
      total_net: riccardoResidualShare,
      residual_share: riccardoResidualShare,
      percentage: riccardoPercentage
    },
    modifications: modificationsList,
    extra_expenses: lotExtraExpenses,
    lot_orders: lotOrdersList
  };
}

// GET /api/profit-splits - Recupera la suddivisione profitti per il lotto specificato o per quello attivo
app.get('/api/profit-splits', async (req, res) => {
  try {
    const allOrders = await getDbOrders();
    const profitData = await getDbProfitShares();
    const lottoArchive = await getDbLotti();

    // Carica prodotti completi una sola volta
    let localProducts = [];
    try {
      localProducts = getLocalProducts();
    } catch (e) {}
    let supabaseProducts = [];
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        supabaseProducts = await getAllProductsFromSupabase(supabase);
      }
    } catch (e) {}
    const allDbProducts = supabaseProducts.length > 0 ? supabaseProducts : localProducts;
    const settings = getSettings();

    // Determina l'ID del lotto attivo
    let currentActiveLottoId = 1;
    const lottoFile = path.join(__dirname, 'lotto.json');
    if (fs.existsSync(lottoFile)) {
      try {
        const lottoObj = JSON.parse(fs.readFileSync(lottoFile, 'utf8'));
        if (lottoObj && lottoObj.id) {
          currentActiveLottoId = Number(lottoObj.id);
        }
      } catch (e) {}
    } else {
      const explicitLottoId = (allOrders || []).find(o => !o.is_archived && o.lotto_id !== null && o.lotto_id !== undefined)?.lotto_id;
      if (explicitLottoId !== undefined && explicitLottoId !== null) {
        currentActiveLottoId = Number(explicitLottoId);
      }
    }

    // Se richiesto uno specifico lotto_id nei query params, usa quello; altrimenti usa il lotto attivo
    let targetLottoId = currentActiveLottoId;
    if (req.query && req.query.lotto_id !== undefined && req.query.lotto_id !== null && req.query.lotto_id !== '') {
      targetLottoId = Number(req.query.lotto_id) || currentActiveLottoId;
    }

    const computed = await computeProfitSplitForLotto(targetLottoId, {
      allOrders,
      profitData,
      settings,
      allDbProducts,
      lottoArchive,
      currentActiveLottoId
    });

    return res.json({
      success: true,
      summary: computed,
      modifications: computed.modifications,
      extra_expenses: computed.extra_expenses,
      lot_orders: computed.lot_orders
    });
  } catch (err) {
    console.error("⚠️ Errore GET /api/profit-splits:", err.message);
    return res.status(500).json({ success: false, error: err.message, modifications: [], extra_expenses: [], lot_orders: [] });
  }
});

// GET /api/profit-splits/history - Recupera la cronologia della suddivisione profitti di tutti i lotti
app.get('/api/profit-splits/history', async (req, res) => {
  try {
    const allOrders = await getDbOrders();
    const profitData = await getDbProfitShares();
    const lottoArchive = await getDbLotti();

    let localProducts = [];
    try {
      localProducts = getLocalProducts();
    } catch (e) {}
    let supabaseProducts = [];
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        supabaseProducts = await getAllProductsFromSupabase(supabase);
      }
    } catch (e) {}
    const allDbProducts = supabaseProducts.length > 0 ? supabaseProducts : localProducts;
    const settings = getSettings();

    // Determina l'ID del lotto attivo
    let currentActiveLottoId = 1;
    const lottoFile = path.join(__dirname, 'lotto.json');
    if (fs.existsSync(lottoFile)) {
      try {
        const lottoObj = JSON.parse(fs.readFileSync(lottoFile, 'utf8'));
        if (lottoObj && lottoObj.id) {
          currentActiveLottoId = Number(lottoObj.id);
        }
      } catch (e) {}
    }

    // Raccoglie tutti gli ID di lotti presenti (attivo + archiviati + percentuali/spese salvate)
    const lotIdsSet = new Set();
    lotIdsSet.add(currentActiveLottoId);
    (lottoArchive || []).forEach(l => {
      if (l && l.id) lotIdsSet.add(Number(l.id));
    });
    if (profitData && typeof profitData.lot_percentages === 'object') {
      Object.keys(profitData.lot_percentages).forEach(k => {
        const n = Number(k);
        if (!isNaN(n)) lotIdsSet.add(n);
      });
    }
    if (Array.isArray(profitData.extra_expenses)) {
      profitData.extra_expenses.forEach(e => {
        const n = Number(e.lotto_id);
        if (!isNaN(n)) lotIdsSet.add(n);
      });
    }

    const lotIds = Array.from(lotIdsSet).sort((a, b) => b - a);
    const historyList = [];

    for (const lId of lotIds) {
      const lotSummary = await computeProfitSplitForLotto(lId, {
        allOrders,
        profitData,
        settings,
        allDbProducts,
        lottoArchive,
        currentActiveLottoId
      });
      historyList.push(lotSummary);
    }

    return res.json({
      success: true,
      current_lotto_id: currentActiveLottoId,
      history: historyList
    });
  } catch (err) {
    console.error("⚠️ Errore GET /api/profit-splits/history:", err.message);
    return res.status(500).json({ success: false, error: err.message, history: [] });
  }
});

// POST /api/profit-splits/extra-expense - Aggiunge o aggiorna una spesa extra del lotto
app.post('/api/profit-splits/extra-expense', async (req, res) => {
  try {
    const { id, lotto_id, description, quantity, unit_price_usd, assigned_to, notes } = req.body;

    const descStr = String(description || '').trim();
    if (!descStr) {
      return res.status(400).json({ success: false, error: "Descrizione / nome articolo obbligatorio." });
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) {
      return res.status(400).json({ success: false, error: "La quantità deve essere un numero intero maggiore o uguale a 1." });
    }

    const rawUnitPrice = parseFloat(String(unit_price_usd).replace(',', '.'));
    if (isNaN(rawUnitPrice) || rawUnitPrice < 0) {
      return res.status(400).json({ success: false, error: "Il prezzo unitario in USD deve essere un valore numerico valido (>= 0)." });
    }

    const validAssignments = ['sergio', 'riccardo', '50_50', 'altro', '100_sergio', '100_riccardo'];
    let assignment = String(assigned_to || 'sergio').toLowerCase();
    if (!validAssignments.includes(assignment)) {
      assignment = 'sergio';
    }

    // Normalizza assegnazione
    if (assignment === '100_sergio') assignment = 'sergio';
    if (assignment === '100_riccardo') assignment = 'riccardo';
    if (assignment === '50_50') assignment = 'altro';

    // Validazione rigorosa del lotto_id: deve essere obbligatorio e numerico valido
    const parsedLotId = Number(lotto_id);
    if (lotto_id === undefined || lotto_id === null || isNaN(parsedLotId) || parsedLotId <= 0) {
      return res.status(400).json({ success: false, error: "Identificativo lotto (lotto_id) obbligatorio e valido per registrare la spesa extra." });
    }
    const lotId = parsedLotId;

    const settings = getSettings();
    const rate = getEffectiveExchangeRate(settings);

    const totalUsd = Number((qty * rawUnitPrice).toFixed(2));
    const unitPriceEur = convertUsdToEur(rawUnitPrice, rate, '/api/profit-splits/extra-expense');
    const totalEur = convertUsdToEur(totalUsd, rate, '/api/profit-splits/extra-expense');

    let sergioEur = 0;
    let riccardoEur = 0;
    let assignedLabel = 'Sergio (100%)';

    if (assignment === 'sergio') {
      sergioEur = totalEur;
      riccardoEur = 0;
      assignedLabel = 'Sergio (100%)';
    } else if (assignment === 'riccardo') {
      sergioEur = 0;
      riccardoEur = totalEur;
      assignedLabel = 'Riccardo (100%)';
    } else if (assignment === 'altro') {
      sergioEur = Number((totalEur / 2).toFixed(2));
      riccardoEur = Number((totalEur - sergioEur).toFixed(2));
      assignedLabel = 'Altro (50% / 50%)';
    }

    const expenseId = id ? String(id) : `extra_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const profitData = await getDbProfitShares();
    if (!Array.isArray(profitData.extra_expenses)) {
      profitData.extra_expenses = [];
    }

    const existingIndex = profitData.extra_expenses.findIndex(e => String(e.id) === expenseId);
    const expenseEntry = {
      id: expenseId,
      lotto_id: lotId,
      description: descStr,
      quantity: qty,
      unit_price_usd: Number(rawUnitPrice.toFixed(2)),
      total_usd: totalUsd,
      exchange_rate: rate,
      unit_price_eur: unitPriceEur,
      total_eur: totalEur,
      assigned_to: assignment,
      assigned_label: assignedLabel,
      sergio_eur: sergioEur,
      riccardo_eur: riccardoEur,
      notes: String(notes || '').trim(),
      updated_at: new Date().toISOString(),
      created_at: (existingIndex >= 0 && profitData.extra_expenses[existingIndex].created_at) ? profitData.extra_expenses[existingIndex].created_at : new Date().toISOString()
    };

    if (existingIndex >= 0) {
      profitData.extra_expenses[existingIndex] = expenseEntry;
    } else {
      profitData.extra_expenses.push(expenseEntry);
    }

    await saveDbProfitShares(profitData);
    try {
      await recalculateCurrentLottoInternal();
    } catch (eRecalc) {
      console.warn("⚠️ Errore ricalcolo lotto dopo salvataggio spesa extra:", eRecalc.message);
    }
    return res.json({ success: true, expense: expenseEntry });
  } catch (err) {
    console.error("⚠️ Errore POST /api/profit-splits/extra-expense:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/profit-splits/extra-expense/:id - Elimina una spesa extra del lotto
app.delete('/api/profit-splits/extra-expense/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, error: "Identificativo spesa mancante." });
    }

    const profitData = await getDbProfitShares();
    if (!Array.isArray(profitData.extra_expenses)) {
      profitData.extra_expenses = [];
    }

    const initialLen = profitData.extra_expenses.length;
    profitData.extra_expenses = profitData.extra_expenses.filter(e => String(e.id) !== String(id));
    const removed = profitData.extra_expenses.length < initialLen;

    if (removed) {
      await saveDbProfitShares(profitData);
      try {
        await recalculateCurrentLottoInternal();
      } catch (eRecalc) {
        console.warn("⚠️ Errore ricalcolo lotto dopo eliminazione spesa extra:", eRecalc.message);
      }
    }

    return res.json({ success: true, removed });
  } catch (err) {
    console.error("⚠️ Errore DELETE /api/profit-splits/extra-expense/:id:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/profit-splits/lot-percentage - Imposta la suddivisione del profitto residuo per il lotto
app.post('/api/profit-splits/lot-percentage', async (req, res) => {
  try {
    const { lotto_id, split_mode, sergio_percentage, riccardo_percentage } = req.body;
    const mode = (split_mode === 'by_expenses') ? 'by_expenses' : 'manual';

    let sPct = parseFloat(sergio_percentage);
    let rPct = parseFloat(riccardo_percentage);

    if (mode === 'manual') {
      if (isNaN(sPct) || isNaN(rPct)) {
        return res.status(400).json({ success: false, error: "Le percentuali devono essere valori numerici." });
      }

      if (sPct < 0 || sPct > 100 || rPct < 0 || rPct > 100) {
        return res.status(400).json({ success: false, error: "Le percentuali devono essere comprese tra 0% e 100%." });
      }

      if (Math.round(sPct + rPct) !== 100) {
        return res.status(400).json({ success: false, error: "La somma delle percentuali di Sergio e Riccardo deve fare esattamente 100%." });
      }
    } else {
      if (isNaN(sPct)) sPct = 50;
      if (isNaN(rPct)) rPct = 50;
    }

    let lotId = lotto_id;
    if (!lotId) {
      const lottoFile = path.join(__dirname, 'lotto.json');
      if (fs.existsSync(lottoFile)) {
        try {
          const lottoObj = JSON.parse(fs.readFileSync(lottoFile, 'utf8'));
          if (lottoObj && lottoObj.id) lotId = lottoObj.id;
        } catch (e) {}
      }
    }
    lotId = String(lotId || '1');

    const profitData = await getDbProfitShares();
    if (!profitData.lot_percentages || typeof profitData.lot_percentages !== 'object' || Array.isArray(profitData.lot_percentages)) {
      profitData.lot_percentages = {};
    }

    profitData.lot_percentages[lotId] = {
      lotto_id: lotId,
      split_mode: mode,
      sergio_percentage: Number(sPct.toFixed(2)),
      riccardo_percentage: Number(rPct.toFixed(2)),
      updated_at: new Date().toISOString()
    };

    await saveDbProfitShares(profitData);
    return res.json({
      success: true,
      lot_percentage: profitData.lot_percentages[lotId]
    });
  } catch (err) {
    console.error("⚠️ Errore POST /api/profit-splits/lot-percentage:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/profit-splits/modification - Salva o aggiorna una modifica manuale alla suddivisione
app.post('/api/profit-splits/modification', async (req, res) => {
  try {
    const { order_id, order_data_key, division, cost_eur } = req.body;
    if (!order_id) {
      return res.status(400).json({ success: false, error: "Identificativo ordine mancante." });
    }

    const validDivisions = ['100_sergio', '100_riccardo', '50_50'];
    if (!division || !validDivisions.includes(division)) {
      return res.status(400).json({ success: false, error: "Opzione di divisione non valida (deve essere '100_sergio', '100_riccardo' o '50_50')." });
    }

    const profitData = await getDbProfitShares();
    if (!profitData.modifications || typeof profitData.modifications !== 'object' || Array.isArray(profitData.modifications)) {
      profitData.modifications = {};
    }

    const orderIdStr = String(order_id);
    const dataKeyStr = order_data_key ? String(order_data_key) : '';

    let divisionLabel = '50% Sergio / 50% Riccardo';
    if (division === '100_sergio') divisionLabel = '100% Sergio';
    else if (division === '100_riccardo') divisionLabel = '100% Riccardo';

    const modEntry = {
      order_id: orderIdStr,
      order_data_key: dataKeyStr || null,
      division: division,
      division_label: divisionLabel,
      cost_eur: (cost_eur !== undefined && cost_eur !== null && !isNaN(Number(cost_eur))) ? Number(Number(cost_eur).toFixed(2)) : undefined,
      updated_at: new Date().toISOString()
    };

    profitData.modifications[orderIdStr] = modEntry;
    if (dataKeyStr) {
      profitData.modifications[dataKeyStr] = modEntry;
    }

    await saveDbProfitShares(profitData);
    try {
      await recalculateCurrentLottoInternal();
    } catch (eRecalc) {
      console.warn("⚠️ Errore ricalcolo lotto dopo salvataggio modifica suddivisione:", eRecalc.message);
    }
    return res.json({ success: true, modification: modEntry });
  } catch (err) {
    console.error("⚠️ Errore POST /api/profit-splits/modification:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/profit-splits/modification/:id - Rimuove un'eccezione/modifica (l'ordine torna alla regola 50/50 e NON viene cancellato)
app.delete('/api/profit-splits/modification/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, error: "Identificativo ordine mancante." });
    }

    const targetId = decodeURIComponent(String(id));
    const profitData = await getDbProfitShares();
    if (!profitData.modifications || typeof profitData.modifications !== 'object') {
      profitData.modifications = {};
    }

    // Trova e cancella sia per order_id che per order_data_key
    let found = false;
    for (const key of Object.keys(profitData.modifications)) {
      const entry = profitData.modifications[key];
      if (key === targetId || (entry && (String(entry.order_id) === targetId || String(entry.order_data_key) === targetId))) {
        delete profitData.modifications[key];
        found = true;
      }
    }

    if (found) {
      await saveDbProfitShares(profitData);
      try {
        await recalculateCurrentLottoInternal();
      } catch (eRecalc) {
        console.warn("⚠️ Errore ricalcolo lotto dopo rimozione modifica suddivisione:", eRecalc.message);
      }
    }
    return res.json({ success: true, removed: found });
  } catch (err) {
    console.error("⚠️ Errore DELETE /api/profit-splits/modification/:id:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/profit-splits/percentage - Imposta la divisione percentuale per un ordine
app.post('/api/profit-splits/percentage', async (req, res) => {
  try {
    const { order_id, order_data_key, sergio_percentage, riccardo_percentage } = req.body;
    if (!order_id) {
      return res.status(400).json({ success: false, error: "Identificativo ordine mancante." });
    }

    const sPct = parseFloat(sergio_percentage);
    const rPct = parseFloat(riccardo_percentage);

    if (isNaN(sPct) || isNaN(rPct)) {
      return res.status(400).json({ success: false, error: "Le percentuali devono essere valori numerici." });
    }

    if (sPct < 0 || sPct > 100 || rPct < 0 || rPct > 100) {
      return res.status(400).json({ success: false, error: "Le percentuali devono essere comprese tra 0% e 100%." });
    }

    if (Math.round(sPct + rPct) !== 100) {
      return res.status(400).json({ success: false, error: "La somma delle percentuali deve fare esattamente 100%." });
    }

    const profitData = await getDbProfitShares();
    const orderIdStr = String(order_id);

    profitData.shares[orderIdStr] = {
      order_id: orderIdStr,
      order_data_key: order_data_key ? String(order_data_key) : null,
      sergio_percentage: Number(sPct.toFixed(2)),
      riccardo_percentage: Number(rPct.toFixed(2)),
      updated_at: new Date().toISOString()
    };

    if (order_data_key) {
      profitData.shares[String(order_data_key)] = profitData.shares[orderIdStr];
    }

    await saveDbProfitShares(profitData);
    return res.json({ success: true, share: profitData.shares[orderIdStr] });
  } catch (err) {
    console.error("⚠️ Errore POST /api/profit-splits/percentage:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/profit-splits/movement - Aggiunge un prelievo/completino ad un ordine
app.post('/api/profit-splits/movement', async (req, res) => {
  try {
    const {
      order_id,
      order_data_key,
      recipient,
      type,
      amount,
      amount_usd,
      currency,
      description,
      item_index,
      item_title,
      base_price_usd,
      customization_price_usd,
      shipping_usd
    } = req.body;

    if (!order_id) {
      return res.status(400).json({ success: false, error: "Identificativo ordine mancante." });
    }

    if (!recipient || !['sergio', 'riccardo', 'shared'].includes(recipient)) {
      return res.status(400).json({ success: false, error: "Destinatario non valido (deve essere Sergio, Riccardo o Diviso 50/50)." });
    }

    const rawVal = amount_usd !== undefined && amount_usd !== null ? amount_usd : amount;
    const parsedAmount = parseFloat(String(rawVal).replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ success: false, error: "L'importo del costo deve essere un numero positivo maggiore di zero." });
    }

    // Calcola quote a carico di Sergio / Riccardo (i saldi possono diventare negativi)
    let sergioAmt = 0;
    let riccardoAmt = 0;
    if (recipient === 'sergio') {
      sergioAmt = parsedAmount;
      riccardoAmt = 0;
    } else if (recipient === 'riccardo') {
      sergioAmt = 0;
      riccardoAmt = parsedAmount;
    } else if (recipient === 'shared') {
      sergioAmt = parsedAmount / 2;
      riccardoAmt = parsedAmount / 2;
    }

    const orderIdStr = String(order_id);
    const dataKeyStr = order_data_key ? String(order_data_key) : '';

    const profitData = await getDbProfitShares();
    const movementType = type ? String(type).trim() : 'Completino';
    const movementDesc = description ? String(description).trim() : (item_title || movementType);

    const newMovement = {
      id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      order_id: orderIdStr,
      order_data_key: dataKeyStr || null,
      recipient: recipient,
      type: movementType,
      item_index: item_index !== undefined ? Number(item_index) : null,
      item_title: item_title ? String(item_title).trim() : null,
      base_price_usd: base_price_usd !== undefined && base_price_usd !== null ? Number(base_price_usd) : null,
      customization_price_usd: customization_price_usd !== undefined && customization_price_usd !== null ? Number(customization_price_usd) : null,
      shipping_usd: shipping_usd !== undefined && shipping_usd !== null ? Number(shipping_usd) : null,
      currency: currency || '$',
      amount: Number(parsedAmount.toFixed(2)),
      amount_usd: Number(parsedAmount.toFixed(2)),
      sergio_amount: Number(sergioAmt.toFixed(2)),
      riccardo_amount: Number(riccardoAmt.toFixed(2)),
      description: movementDesc,
      created_at: new Date().toISOString()
    };

    if (!Array.isArray(profitData.movements)) {
      profitData.movements = [];
    }
    profitData.movements.unshift(newMovement);

    await saveDbProfitShares(profitData);
    return res.json({ success: true, movement: newMovement });
  } catch (err) {
    console.error("⚠️ Errore POST /api/profit-splits/movement:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/profit-splits/movement/:id - Elimina un movimento/prelievo registrato
app.delete('/api/profit-splits/movement/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, error: "ID movimento mancante." });
    }

    const profitData = await getDbProfitShares();
    const initialLen = profitData.movements.length;
    profitData.movements = profitData.movements.filter(m => String(m.id) !== String(id));

    if (profitData.movements.length === initialLen) {
      return res.status(404).json({ success: false, error: "Movimento non trovato." });
    }

    await saveDbProfitShares(profitData);
    return res.json({ success: true });
  } catch (err) {
    console.error("⚠️ Errore DELETE /api/profit-splits/movement/:id:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/orders - Registra un ordine, aggiorna il lotto in tempo reale e salva su Supabase
app.post('/api/orders', async (req, res) => {
  try {
    console.log("=========================================");
    console.log("📬 [DEBUG SERVER] POST /api/orders RECEIVED!");
    console.log("1. Full Body sent by frontend:", JSON.stringify(req.body, null, 2));
    console.log("=========================================");

    const { nome, telefono, carrello, user_id, access_token, registered_name, coupon_code, coupon_discount, coupon_type, coupon_value } = req.body;

    let badRequestReason = "";
    if (!nome) badRequestReason += "Il campo 'nome' è vuoto o mancante. ";
    if (!telefono) badRequestReason += "Il campo 'telefono' è vuoto o mancante. ";
    if (!Array.isArray(carrello)) {
      badRequestReason += "Il campo 'carrello' non è un array valido. ";
    } else if (carrello.length === 0) {
      badRequestReason += "Il 'carrello' è vuoto (0 articoli). ";
    }

    if (badRequestReason) {
      console.error("❌ [DEBUG SERVER 400 Bad Request] Validation failed:", badRequestReason);
      return res.status(400).json({
        success: false,
        error: "Dati ordine mancanti o non validi.",
        reason: badRequestReason,
        details: {
          receivedNome: nome,
          receivedTelefono: telefono,
          isCarrelloArray: Array.isArray(carrello),
          carrelloLength: Array.isArray(carrello) ? carrello.length : null
        }
      });
    }

    // Carica tutti i prodotti da Supabase per reperire prezzo_fornitore
    let localProducts = getLocalProducts();
    let localAccessories = getLocalAccessories();
    let supabaseProducts = [];

    // Tenta di ottenere prodotti aggiornati da Supabase
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        supabaseProducts = await getAllProductsFromSupabase(supabase);
      }
    } catch (e) {
      console.warn("⚠️ Impossibile caricare prodotti da Supabase per l'ordine, utilizzo fallback locale:", e.message);
    }

    const allDbProducts = [...(supabaseProducts.length > 0 ? supabaseProducts : localProducts), ...localAccessories];

    // PRE-VALIDAZIONE RIGIDA SERVER-SIDE: Ogni articolo nel carrello (eccetto voci tecniche di spedizione/servizio) DEVE esistere realmente nel catalogo
    for (let index = 0; index < carrello.length; index++) {
      const item = carrello[index];
      const isSpedizioneCliente = item.squadra && isTechnicalShippingOrServiceLine(item.squadra);
      if (isSpedizioneCliente) continue;

      let matchedProd = null;
      if (item.id !== undefined && item.id !== null && String(item.id).trim() !== "" && String(item.id) !== "undefined") {
        matchedProd = allDbProducts.find(p => String(p.id) === String(item.id));
      }
      if (!matchedProd && item.legacy_id !== undefined && item.legacy_id !== null && String(item.legacy_id).trim() !== "" && String(item.legacy_id) !== "undefined") {
        matchedProd = allDbProducts.find(p => p.legacy_id !== undefined && p.legacy_id !== null && String(p.legacy_id) === String(item.legacy_id));
      }

      if (!matchedProd) {
        console.error(`❌ [SERVER 400 Bad Request] Articolo fantasma o inesistente nel carrello alla posizione ${index + 1}:`, item);
        return res.status(400).json({
          success: false,
          error: `Articolo non valido o non presente nel catalogo: "${item.squadra || item.versione || 'Sconosciuto'}"`,
          reason: "Tutti gli articoli dell'ordine devono corrispondere a prodotti reali presenti nel catalogo (tramite ID o legacy_id valido).",
          invalid_item: {
            index: index + 1,
            squadra: item.squadra || null,
            id: item.id || null,
            legacy_id: item.legacy_id || null
          }
        });
      }
    }

    // Calcoliamo i totali dell'ordine
    let totale_pagato_cliente = 0;
    let costo_prodotti_usd = 0;
    let quantita_totale_articoli = 0;
    const stringaSquadre = [];
    const stringaPersonalizzazioni = [];
    const stringaTaglie = [];
    const formuleImmagini = [];
    const itemSupplierPrices = [];

    console.log("2. Products in Cart:");
    carrello.forEach((item, index) => {
      console.log(`--- Cart Item #${index + 1} ---`);
      console.log("Item object:", JSON.stringify(item, null, 2));

      const isSpedizioneCliente = item.squadra && isTechnicalShippingOrServiceLine(item.squadra);
      const q = isSpedizioneCliente ? 0 : Number(item.quantita);
      const prezzoUnitarioEuro = Number(item.prezzo);

      console.log(`3. Prezzo (prezzo):`, item.prezzo, `(Parsed as: ${prezzoUnitarioEuro})`);
      console.log(`   Quantita (quantita):`, item.quantita, `(Parsed as: ${q})`);

      // Check for null, undefined, or NaN on item
      if (item.squadra === null || item.squadra === undefined) {
        console.log(`⚠️ Warning: item.squadra is null/undefined! Value:`, item.squadra);
      }
      if (item.quantita === null || item.quantita === undefined || Number.isNaN(q)) {
        console.log(`⚠️ Warning: item.quantita is null/undefined or NaN! Value:`, item.quantita, `, parsed:`, q);
      }
      if (item.prezzo === null || item.prezzo === undefined || Number.isNaN(prezzoUnitarioEuro)) {
        console.log(`⚠️ Warning: item.prezzo is null/undefined or NaN! Value:`, item.prezzo, `, parsed:`, prezzoUnitarioEuro);
      }

      totale_pagato_cliente += (prezzoUnitarioEuro * (Number(item.quantita) || 1));
      quantita_totale_articoli += q;

      // Cerca il prodotto per trovare il prezzo fornitore
      let matchedProd = null;
      let matchMethod = "";
      let matchLog = [];

      matchLog.push(`Prodotto nel carrello: "${item.squadra}" (id: ${item.id !== undefined ? item.id : 'N/A'}, legacy_id: ${item.legacy_id !== undefined ? item.legacy_id : 'N/A'})`);

      // 1. Prova tramite ID (se disponibile nel carrello)
      if (item.id !== undefined && item.id !== null && String(item.id).trim() !== "" && String(item.id) !== "undefined") {
        matchedProd = allDbProducts.find(p => String(p.id) === String(item.id));
        if (matchedProd) {
          matchMethod = `ID (${item.id})`;
        }
      }

      // 2. Prova tramite legacy_id (se disponibile nel carrello e se non abbiamo ancora trovato il prodotto)
      if (!matchedProd && item.legacy_id !== undefined && item.legacy_id !== null && String(item.legacy_id).trim() !== "" && String(item.legacy_id) !== "undefined") {
        matchedProd = allDbProducts.find(p => p.legacy_id !== undefined && p.legacy_id !== null && String(p.legacy_id) === String(item.legacy_id));
        if (matchedProd) {
          matchMethod = `legacy_id (${item.legacy_id})`;
        }
      }

      if (matchedProd) {
        matchLog.push(`Prodotto trovato nel catalogo: "${matchedProd.versione || matchedProd.nome || 'Articolo'}" (id: ${matchedProd.id}, legacy_id: ${matchedProd.legacy_id}) tramite ${matchMethod}`);
        const prezzoFornUnitarioUSD = matchedProd.prezzo_fornitore !== undefined && matchedProd.prezzo_fornitore !== null
          ? Number(matchedProd.prezzo_fornitore)
          : 0;
        matchLog.push(`Prezzo fornitore recuperato: $${prezzoFornUnitarioUSD.toFixed(2)}`);
      } else if (!isSpedizioneCliente) {
        matchLog.push(`Prodotto trovato su Supabase: Nessuna corrispondenza trovata.`);
        matchLog.push(`Prezzo fornitore recuperato: $0.00`);
      }

      // Stampa il log formattato come richiesto
      console.log("\n================ MATCHING REPORT ================");
      console.log(matchLog.join("\n↓\n"));
      console.log("=================================================\n");

      let prezzoFornUnitarioUSD = matchedProd && matchedProd.prezzo_fornitore !== undefined && matchedProd.prezzo_fornitore !== null
        ? Number(matchedProd.prezzo_fornitore)
        : 0; // Default a 0 se non specificato

      if (!isSpedizioneCliente) {
        prezzoFornUnitarioUSD = calcolaCostoFornitoreProdotto(prezzoFornUnitarioUSD, item.infoPerso);
      }

      costo_prodotti_usd += isSpedizioneCliente ? 0 : (prezzoFornUnitarioUSD * (q || 1));

      // Formatta prezzo_fornitore del singolo prodotto nel report
      const labelFornitore = prezzoFornUnitarioUSD > 0 ? `$${prezzoFornUnitarioUSD.toFixed(2)}` : "-";
      const qPrefix = isSpedizioneCliente ? 1 : (q || 1);
      itemSupplierPrices.push(`${qPrefix}x ${labelFornitore}`);

      stringaSquadre.push(`${qPrefix}x ${item.squadra}`);
      
      const persLabel = item.infoPerso && item.infoPerso.trim() !== "" ? item.infoPerso : "No";
      stringaPersonalizzazioni.push(`${qPrefix}x [${persLabel}]`);
      stringaTaglie.push(`${qPrefix}x [${item.taglia}]`);

      if (item.imgUrl) {
        formuleImmagini.push(`=IMAGE("${item.imgUrl}")`);
      }
    });

    const prezzoFornitoreString = itemSupplierPrices.join(' / ');

    // --- APPLICAZIONE SCONTO COUPON SUL SERVER ---
    let discount_eur = 0;
    let isSupplierCoupon = false;
    let supplierCostEur = 0;
    if (coupon_code) {
      const coupons = await getCoupons();
      const c = coupons.find(item => item.code.toLowerCase() === coupon_code.toLowerCase().trim());
      if (c && c.is_active) {
        const isExpired = c.expires_at && new Date(c.expires_at) < new Date();
        const isLimitReached = c.usage_limit !== null && c.usage_limit !== undefined && c.used_count >= c.usage_limit;
        
        if (!isExpired && !isLimitReached) {
          let subtotal_eur = 0;
          carrello.forEach(item => {
            const isSpedizioneCliente = item.squadra && isTechnicalShippingOrServiceLine(item.squadra);
            if (!isSpedizioneCliente) {
              subtotal_eur += (Number(item.prezzo || 0) * Number(item.quantita || 1));
            }
          });
          const shipping_cost_eur = subtotal_eur >= 50 ? 0 : 2;
          
          if (c.type === 'percentuale') {
            discount_eur = subtotal_eur * (parseFloat(c.value) / 100);
          } else if (c.type === 'fisso') {
            discount_eur = Math.min(parseFloat(c.value), subtotal_eur + shipping_cost_eur);
          } else if (c.type === 'fornitore') {
            const settings = getSettings();
            const exRate = await getLiveOrSettingsExchangeRate(settings);
            supplierCostEur = calcolaCostoFornitoreEur(carrello, exRate, allDbProducts);
            isSupplierCoupon = true;
          }
          
          await incrementCouponUsage(c.code);
        }
      }
    }

    if (isSupplierCoupon) {
      totale_pagato_cliente = supplierCostEur;
      discount_eur = 0;
    } else if (discount_eur > 0) {
      totale_pagato_cliente = Math.max(0, totale_pagato_cliente - discount_eur);
    }

    // 1. Recupera tasso di cambio USD/EUR live o manuale da settings
    const settings = getSettings();
    const exchangeRate = await getLiveOrSettingsExchangeRate(settings);

    // 2. Carica e calcola Lotto Corrente persistente
    const lottoFile = path.join(__dirname, 'lotto.json');
    let lotto = {
      numero_totale_articoli: 0,
      costo_totale_prodotti_usd: 0.0,
      spedizione_corrente_usd: 4.0,
      costo_complessivo_lotto_usd: 4.0
    };
    if (fs.existsSync(lottoFile)) {
      lotto = JSON.parse(fs.readFileSync(lottoFile, 'utf8'));
    }

    const nuovo_numero_totale_articoli = lotto.numero_totale_articoli + quantita_totale_articoli;
    const nuovo_costo_totale_prodotti_usd = lotto.costo_totale_prodotti_usd + costo_prodotti_usd;

    // Regola spedizione automatica dinamica su TUTTE le fasce del fornitore:
    const spedizione_unitaria = getShippingRateByQuantity(nuovo_numero_totale_articoli, settings);

    const spedizione_totale_lotto = Number((nuovo_numero_totale_articoli * spedizione_unitaria).toFixed(2));
    const nuovo_costo_complessivo_lotto_usd = Number((nuovo_costo_totale_prodotti_usd + spedizione_totale_lotto).toFixed(2));

    const updatedLotto = {
      numero_totale_articoli: nuovo_numero_totale_articoli,
      costo_totale_prodotti_usd: nuovo_costo_totale_prodotti_usd,
      spedizione_corrente_usd: spedizione_totale_lotto,
      costo_complessivo_lotto_usd: nuovo_costo_complessivo_lotto_usd
    };

    // 3. Prepara riga ordine per foglio "Ordini"
    const order_shipping_usd = Number((quantita_totale_articoli * spedizione_unitaria).toFixed(2));
    const costo_totale_usd = Number((costo_prodotti_usd + order_shipping_usd).toFixed(2));
    const costo_totale_eur = convertUsdToEur(costo_totale_usd, exchangeRate, 'POST /api/orders');
    const profitto_eur = Number((totale_pagato_cliente - costo_totale_eur).toFixed(2));

    console.log("=== OVERALL CALCULATIONS & VALUES ===");
    console.log(`- totale_pagato_cliente:`, totale_pagato_cliente);
    console.log(`- costo_prodotti_usd:`, costo_prodotti_usd);
    console.log(`- order_shipping_usd (spedizione):`, order_shipping_usd);
    console.log(`- costo_totale_usd:`, costo_totale_usd);
    console.log(`- exchangeRate:`, exchangeRate);
    console.log(`- costo_totale_eur:`, costo_totale_eur);
    console.log(`- profitto_eur (5. Profitto calcolato):`, profitto_eur);

    // 6. Controlliamo eventuali valori null, undefined o NaN nei calcoli finali
    let calculationErrorReason = "";
    const fieldsToCheck = {
      "totale_pagato_cliente": totale_pagato_cliente,
      "costo_prodotti_usd": costo_prodotti_usd,
      "quantita_totale_articoli": quantita_totale_articoli,
      "exchangeRate": exchangeRate,
      "spedizione": order_shipping_usd,
      "costo_totale_usd": costo_totale_usd,
      "costo_totale_eur": costo_totale_eur,
      "profitto_eur": profitto_eur
    };

    Object.entries(fieldsToCheck).forEach(([name, value]) => {
      if (value === null || value === undefined) {
        calculationErrorReason += `Il campo '${name}' è null o undefined. `;
      } else if (Number.isNaN(value)) {
        calculationErrorReason += `Il campo '${name}' è NaN (Not a Number). `;
      }
    });

    if (calculationErrorReason) {
      console.error("❌ [DEBUG SERVER 400 Bad Request] Calculation error detected:", calculationErrorReason);
      console.log("=== DEBUG ORDER END ===");
      return res.status(400).json({
        success: false,
        error: "Dati ordine non validi a causa di un errore di calcolo.",
        reason: calculationErrorReason,
        details: fieldsToCheck
      });
    }
    const rigaOrdine = {
      data: new Date().toLocaleString('it-IT'),
      nome: nome,
      telefono: telefono,
      squadra: stringaSquadre.join(' / '),
      personalizzazione: stringaPersonalizzazioni.join(' | '),
      taglia: stringaTaglie.join(' / '),
      totale: totale_pagato_cliente.toFixed(2).replace('.', ',') + "€",
      foto: formuleImmagini.length > 0 ? formuleImmagini[0] : "",
      
      // Nuove colonne aggiuntive
      "Prezzo fornitore": prezzoFornitoreString,
      "Costo prodotti (USD)": costo_prodotti_usd.toFixed(2).replace('.', ','),
      "Costo spedizione (USD)": order_shipping_usd.toFixed(2).replace('.', ','),
      "osto spedizione (USD)": order_shipping_usd.toFixed(2).replace('.', ','), // Compatibilità con typo nell'header del foglio Google
      "Costo totale (USD)": costo_totale_usd.toFixed(2).replace('.', ','),
      "Cambio USD/EUR": exchangeRate.toFixed(4).replace('.', ','),
      "Costo totale (EUR)": costo_totale_eur.toFixed(2).replace('.', ','),
      "Profitto (EUR)": profitto_eur.toFixed(2).replace('.', ','),

      // Coupon Sconto info
      coupon_code: coupon_code || null,
      coupon_discount: discount_eur,
      coupon_type: coupon_type || null,
      coupon_value: coupon_value !== undefined ? Number(coupon_value) : null
    };

    // Includiamo il carrello strutturato per l'esportazione ad alta fedeltà
    rigaOrdine.carrello = carrello;

    // Assegnazione dinamica del lotto attivo per i nuovi ordini
    rigaOrdine.lotto_id = (req.body && req.body.lotto_id !== undefined && req.body.lotto_id !== null && !isNaN(Number(req.body.lotto_id)))
      ? Number(req.body.lotto_id)
      : getCurrentActiveLottoId();

    // Salva l'ordine e ricalcola il lotto in modo atomico (sincronizzato) per evitare race condition
    const { insertedAdminOrder, finalLotto } = await runWithLottoLock(async () => {
      console.log("📤 Registrazione dell'ordine nel database Supabase (atomica)...");
      const insertedOrder = await insertDbOrder(rigaOrdine);
      console.log("📤 Ricalcolo automatico del lotto corrente (atomico)...");
      const lotto = await recalculateCurrentLottoInternal();
      return { insertedAdminOrder: insertedOrder, finalLotto: lotto };
    });

    // Se l'utente è autenticato ed è stato fornito un token, salviamo l'ordine nell'Area Cliente
    console.log("=================================");
console.log("DEBUG AREA CLIENTE");
console.log("insertedAdminOrder:", insertedAdminOrder);
console.log("user_id:", user_id);
console.log("access_token:", access_token ? "PRESENTE" : "ASSENTE");
console.log("=================================");
    if (insertedAdminOrder && user_id && access_token) {
      try {
        console.log(`👤 Utente autenticato rilevato (${user_id}). Associazione dell'ordine all'Area Cliente...`);
        const userSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
          auth: {
            persistSession: false,
            autoRefreshToken: false
          },
          global: {
            headers: {
              Authorization: `Bearer ${access_token}`
            }
          }
        });

        // Calcoliamo i totali per customer_orders (subtotale, spedizione, totale)
        let subtotal = 0;
        let shipping = 0;
        carrello.forEach(item => {
          const isSpedizione = item.squadra && isTechnicalShippingOrServiceLine(item.squadra);
          const itemPrezzo = (Number(item.prezzo) || 0) * (Number(item.quantita) || 1);
          if (isSpedizione) {
            shipping += itemPrezzo;
          } else {
            subtotal += itemPrezzo;
          }
        });
        const total = subtotal + shipping;

        const customerOrderData = {
          user_id: user_id,
          order_number: `ORD-${insertedAdminOrder.id}`,
          admin_order_id: insertedAdminOrder.id,
          subtotal: subtotal,
          shipping: shipping,
          total: isSupplierCoupon ? supplierCostEur : total - discount_eur, // Apply the actual coupon discount or supplier cost
          payment_status: 'pending',
          status: 'Ordine Ricevuto',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          coupon_code: coupon_code || null,
          coupon_discount: isSupplierCoupon ? 0 : discount_eur,
          coupon_type: coupon_type || null,
          coupon_value: coupon_value !== undefined ? Number(coupon_value) : null
        };

        console.log("📤 Inserimento in customer_orders:", customerOrderData);
        let custOrderRow = null;
        let custOrderErr = null;

        const initialInsert = await userSupabase
          .from('customer_orders')
          .insert(customerOrderData)
          .select();
        
        custOrderRow = initialInsert.data;
        custOrderErr = initialInsert.error;

        if (custOrderErr && (custOrderErr.message.includes("coupon_type") || custOrderErr.message.includes("column"))) {
          console.warn("⚠️ Colonna coupon_type non trovata su customer_orders (tabella non aggiornata). Riprovo l'inserimento senza coupon_type e coupon_value...");
          const { coupon_type, coupon_value, ...customerOrderDataFallback } = customerOrderData;
          const retryInsert = await userSupabase
            .from('customer_orders')
            .insert(customerOrderDataFallback)
            .select();
          custOrderRow = retryInsert.data;
          custOrderErr = retryInsert.error;
        }

        if (custOrderErr) {
          console.error("❌ Errore inserimento in customer_orders:", custOrderErr.message);
        } else if (custOrderRow && custOrderRow.length > 0) {
          const customerOrderId = custOrderRow[0].id;
          console.log("✅ Inserito in customer_orders con ID:", customerOrderId);

          const orderItemsToInsert = [];
          for (const item of carrello) {
            const isSpedizione = item.squadra && isTechnicalShippingOrServiceLine(item.squadra);
            if (isSpedizione) continue;

            // Cerca il prodotto nel database
            let matchedProd = allDbProducts.find(p => String(p.id) === String(item.id));
            if (!matchedProd && item.legacy_id) {
              matchedProd = allDbProducts.find(p => p.legacy_id !== undefined && p.legacy_id !== null && String(p.legacy_id) === String(item.legacy_id));
            }

            orderItemsToInsert.push({
              order_id: customerOrderId,
              product_id: matchedProd?.legacy_id ?? null,
              nome: item.squadra || '',
              categoria: matchedProd ? matchedProd.categoria : 'Kit',
              stagione: matchedProd ? matchedProd.stagione : '2026/2027',
              taglia: item.taglia || '-',
              personalizzazione: item.infoPerso || 'No',
              prezzo: Number(item.prezzo) || 0,
              quantita: Number(item.quantita) || 1
            });
          }

          if (orderItemsToInsert.length > 0) {
            console.log("📤 Inserimento in customer_order_items:", orderItemsToInsert);
            const { error: itemsErr } = await userSupabase
              .from('customer_order_items')
              .insert(orderItemsToInsert);
            
            if (itemsErr) {
              console.error("❌ Errore inserimento in customer_order_items:", itemsErr.message);
            } else {
              console.log("✅ Inseriti tutti i prodotti dell'ordine in customer_order_items!");
            }
          }
        }
      } catch (errArea) {
        console.error("⚠️ Eccezione durante l'associazione dell'ordine all'Area Cliente:", errArea.message);
      }
    }

    console.log("=== DEBUG SERVER SUCCESS ===");
    return res.json({ success: true, order: rigaOrdine, lotto: finalLotto });
  } catch (err) {
    console.error("⚠️ Errore durante la registrazione dell'ordine:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/customer/order-lotto/:id - Recupera l'ID del lotto partendo dall'ordine del cliente
app.get('/api/customer/order-lotto/:id', async (req, res) => {
  try {
    const rawId = req.params.id;
    if (!rawId || rawId === 'undefined' || rawId === 'null') {
      return res.json({ success: true, lotto_id: null });
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.json({ success: true, lotto_id: null });
    }

    const cleanId = String(rawId).trim();
    const isNumeric = /^\d+$/.test(cleanId);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);

    if (isNumeric) {
      const { data: ord } = await supabase
        .from('orders')
        .select('lotto_id')
        .eq('id', Number(cleanId))
        .maybeSingle();

      if (ord && ord.lotto_id) {
        return res.json({ success: true, lotto_id: ord.lotto_id });
      }
    } else if (isUuid) {
      const { data: custOrd } = await supabase
        .from('customer_orders')
        .select('admin_order_id')
        .eq('id', cleanId)
        .maybeSingle();

      if (custOrd && custOrd.admin_order_id && /^\d+$/.test(String(custOrd.admin_order_id))) {
        const { data: ord } = await supabase
          .from('orders')
          .select('lotto_id')
          .eq('id', Number(custOrd.admin_order_id))
          .maybeSingle();

        if (ord && ord.lotto_id) {
          return res.json({ success: true, lotto_id: ord.lotto_id });
        }
      }
    } else {
      const numPart = cleanId.replace(/^ORD-?/i, '');
      if (/^\d+$/.test(numPart)) {
        const { data: ord } = await supabase
          .from('orders')
          .select('lotto_id')
          .eq('id', Number(numPart))
          .maybeSingle();

        if (ord && ord.lotto_id) {
          return res.json({ success: true, lotto_id: ord.lotto_id });
        }
      }
    }
    
    return res.json({ success: true, lotto_id: null });
  } catch (err) {
    return res.json({ success: true, lotto_id: null });
  }
});

// GET /api/customer/orders - Recupera tutti gli ordini associati a un account cliente
app.get('/api/customer/orders', async (req, res) => {
  try {
    const userId = req.query.userId || req.headers['x-user-id'];
    if (!userId) {
      return res.status(400).json({ success: false, error: "Identificativo utente non fornito." });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(500).json({ success: false, error: "Database non configurato." });
    }

    // 1. Prendi ordini da customer_orders
    const { data: custOrders, error: custErr } = await supabase
      .from('customer_orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (custErr) {
      console.error("⚠️ Errore lettura customer_orders:", custErr.message);
      return res.status(500).json({ success: false, error: custErr.message });
    }

    if (!custOrders || custOrders.length === 0) {
      return res.json({ success: true, orders: [] });
    }

    const orderIds = custOrders.map(o => o.id);
    const adminOrderIds = custOrders.map(o => o.admin_order_id).filter(Boolean);

    // 2. Prendi gli item
    const { data: itemsData, error: itemsErr } = await supabase
      .from('customer_order_items')
      .select('*')
      .in('order_id', orderIds);

    const itemsMap = {};
    (itemsData || []).forEach(it => {
      if (!itemsMap[it.order_id]) itemsMap[it.order_id] = [];
      itemsMap[it.order_id].push(it);
    });

    // 3. Prendi i lotti associati via orders
    let adminOrdersMap = {};
    let lottiMap = {};
    if (adminOrderIds.length > 0) {
      const { data: adminOrders } = await supabase
        .from('orders')
        .select('id, lotto_id, data, totale, squadra, nome, telefono')
        .in('id', adminOrderIds);

      (adminOrders || []).forEach(ao => {
        adminOrdersMap[ao.id] = ao;
      });

      const lottoIds = [...new Set((adminOrders || []).map(ao => ao.lotto_id).filter(Boolean))];
      if (lottoIds.length > 0) {
        const { data: lottiData } = await supabase
          .from('lotti')
          .select('*')
          .in('id', lottoIds);

        (lottiData || []).forEach(l => {
          lottiMap[l.id] = l;
        });
      }
    }

    // Costruisci la lista finale degli ordini
    const resultOrders = custOrders.map(co => {
      const ao = co.admin_order_id ? adminOrdersMap[co.admin_order_id] : null;
      const lottoId = ao?.lotto_id || co.lotto_id || null;
      const lotto = lottoId ? lottiMap[lottoId] : null;
      const items = itemsMap[co.id] || [];

      let trackingUrl = '';
      if (lotto && lotto.tracking_code) {
        const carrier = (lotto.tracking_carrier || '').toLowerCase();
        if (carrier.includes('dhl')) {
          trackingUrl = `https://www.dhl.com/it-it/home/tracciamento.html?tracking-id=${encodeURIComponent(lotto.tracking_code)}`;
        } else if (carrier.includes('poste') || carrier.includes('sda')) {
          trackingUrl = `https://www.poste.it/cerca/index.html#/risultati-spedizioni/${encodeURIComponent(lotto.tracking_code)}`;
        } else if (carrier.includes('gls')) {
          trackingUrl = `https://www.gls-italy.com/?id=${encodeURIComponent(lotto.tracking_code)}`;
        } else if (carrier.includes('brt')) {
          trackingUrl = `https://www.brt.it/it/tracking?spId=${encodeURIComponent(lotto.tracking_code)}`;
        } else if (carrier.includes('ups')) {
          trackingUrl = `https://www.ups.com/track?tracknum=${encodeURIComponent(lotto.tracking_code)}`;
        } else {
          trackingUrl = `https://www.google.com/search?q=${encodeURIComponent((lotto.tracking_carrier || 'corriere') + ' tracking ' + lotto.tracking_code)}`;
        }
      }

      return {
        id: co.id,
        order_number: co.order_number || (co.admin_order_id ? `ORD-${co.admin_order_id}` : `ORD-${co.id.slice(0, 6).toUpperCase()}`),
        admin_order_id: co.admin_order_id,
        user_id: co.user_id,
        status: co.status || (lotto ? (lotto.tracking_status || 'In preparazione') : 'Ordine Ricevuto'),
        subtotal: Number(co.subtotal) || 0,
        shipping: Number(co.shipping) || 0,
        total: Number(co.total) || 0,
        payment_status: co.payment_status || 'pending',
        coupon_code: co.coupon_code || null,
        coupon_discount: Number(co.coupon_discount) || 0,
        created_at: co.created_at,
        updated_at: co.updated_at,
        lotto_id: lottoId,
        lotto_numero: lotto ? lotto.numero_lotto : (lottoId ? `Lotto #${lottoId}` : null),
        items: items,
        items_count: items.reduce((sum, item) => sum + (Number(item.quantita) || 1), 0),
        tracking: {
          has_lotto: !!lottoId,
          lotto_id: lottoId,
          lotto_number: lotto ? lotto.numero_lotto : (lottoId ? `Lotto #${lottoId}` : null),
          tracking_code: lotto?.tracking_code || '',
          carrier: lotto?.tracking_carrier || 'DHL Express Premium',
          status: lotto?.tracking_status || co.status || 'In preparazione',
          tracking_url: trackingUrl,
          events: (lotto?.tracking_events && Array.isArray(lotto.tracking_events)) ? lotto.tracking_events : []
        }
      };
    });

    return res.json({ success: true, orders: resultOrders });
  } catch (err) {
    console.error("⚠️ Errore GET /api/customer/orders:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/upload - Carica un'immagine in locale (utilizzato in assenza di Supabase)
app.post('/api/upload', (req, res) => {
  try {
    const { filename, base64 } = req.body;
    if (!filename || !base64) {
      return res.status(400).json({ success: false, error: "Dati caricamento mancanti (filename o base64)" });
    }

    const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ success: false, error: "Formato stringa base64 non valido" });
    }

    const fileBuffer = Buffer.from(matches[2], 'base64');
    const safeFilename = `${Date.now()}-${filename.replace(/[^A-Za-z0-9.]/g, '_')}`;
    const targetPath = path.join(UPLOADS_DIR, safeFilename);

    fs.writeFileSync(targetPath, fileBuffer);
    console.log(`📸 Immagine caricata in locale con successo: /uploads/${safeFilename}`);
    return res.json({ success: true, filePath: `/uploads/${safeFilename}` });
  } catch (err) {
    console.error("⚠️ Errore durante il caricamento dell'immagine locale:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/orders/update-customer-order - Permette all'utente di modificare un proprio ordine se non ancora archiviato (lotto aperto)
app.post('/api/orders/update-customer-order', async (req, res) => {
  try {
    const { order_id, carrello, access_token } = req.body;
    if (!order_id || !Array.isArray(carrello) || carrello.length === 0 || !access_token) {
      return res.status(400).json({ success: false, error: "Dati mancanti o non validi." });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(500).json({ success: false, error: "Database non configurato." });
    }

    const userSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${access_token}` } }
    });

    const { data: { user }, error: authErr } = await userSupabase.auth.getUser();
    if (authErr || !user) {
      return res.status(401).json({ success: false, error: "Non autorizzato o sessione scaduta." });
    }

    // Carichiamo l'ordine del cliente
    const { data: orderData, error: orderErr } = await supabase
      .from('customer_orders')
      .select('*')
      .eq('id', order_id)
      .eq('user_id', user.id)
      .single();

    if (orderErr || !orderData) {
      return res.status(404).json({ success: false, error: "Ordine non trovato o non appartenente all'utente." });
    }

    // Verifica lo stato del lotto/ordine
    const normalizedStatus = (orderData.status || '').trim().toLowerCase();
    if (normalizedStatus !== 'ordine ricevuto') {
      return res.status(400).json({ success: false, error: "Questo ordine non può più essere modificato poiché il lotto è stato chiuso." });
    }

    // Carica tutti i prodotti per i calcoli dei costi
    let localProducts = getLocalProducts();
    let supabaseProducts = [];
    try {
      supabaseProducts = await getAllProductsFromSupabase(supabase);
    } catch (e) {
      console.warn("⚠️ Utilizzo fallback prodotti locali:", e.message);
    }
    const allDbProducts = supabaseProducts.length > 0 ? supabaseProducts : localProducts;

    // Ricalcola i totali per questo ordine
    let subtotal = 0;
    let shipping = 0;
    let costo_prodotti_usd = 0;
    let quantita_totale_articoli = 0;

    const stringaSquadre = [];
    const stringaPersonalizzazioni = [];
    const stringaTaglie = [];
    const formuleImmagini = [];
    const itemSupplierPrices = [];

    const settings = getSettings();
    const rules = settings.spedizioneLotto;

    // Ricalcoliamo il lotto
    const lottoFile = path.join(__dirname, 'lotto.json');
    let lotto = { numero_totale_articoli: 0 };
    if (fs.existsSync(lottoFile)) {
      lotto = JSON.parse(fs.readFileSync(lottoFile, 'utf8'));
    }

    // Carica gli articoli precedenti dell'ordine per calcolare il delta quantità
    const { data: prevItems } = await supabase
      .from('customer_order_items')
      .select('*')
      .eq('order_id', order_id);

    const prevQty = prevItems ? prevItems.reduce((acc, item) => acc + (Number(item.quantita) || 1), 0) : 0;
    const newQty = carrello.reduce((acc, item) => {
      const isSpedizione = item.squadra && isTechnicalShippingOrServiceLine(item.squadra);
      return isSpedizione ? acc : acc + (Number(item.quantita) || 1);
    }, 0);

    const diffQty = newQty - prevQty;
    const nuovo_numero_totale_articoli = Math.max(0, lotto.numero_totale_articoli + diffQty);

    const spedizione_unitaria = getShippingRateByQuantity(nuovo_numero_totale_articoli, settings);

    carrello.forEach(item => {
      const isSpedizione = item.squadra && isTechnicalShippingOrServiceLine(item.squadra);
      const itemPrezzo = (Number(item.prezzo) || 0) * (Number(item.quantita) || 1);
      const q = isSpedizione ? 0 : Number(item.quantita);

      if (isSpedizione) {
        shipping += itemPrezzo;
      } else {
        subtotal += itemPrezzo;
        quantita_totale_articoli += q;

        let matchedProd = allDbProducts.find(p => String(p.id) === String(item.id));
        if (!matchedProd && item.legacy_id) {
          matchedProd = allDbProducts.find(p => p.legacy_id !== undefined && p.legacy_id !== null && String(p.legacy_id) === String(item.legacy_id));
        }
        if (!matchedProd) {
          matchedProd = allDbProducts.find(p => p.versione === item.squadra || p.squadra === item.squadra);
        }

        let prezzoFornUnitarioUSD = matchedProd && matchedProd.prezzo_fornitore ? Number(matchedProd.prezzo_fornitore) : 0;
        prezzoFornUnitarioUSD = calcolaCostoFornitoreProdotto(prezzoFornUnitarioUSD, item.infoPerso || item.personalizzazione);
        costo_prodotti_usd += (prezzoFornUnitarioUSD * q);

        const labelFornitore = prezzoFornUnitarioUSD > 0 ? `$${prezzoFornUnitarioUSD.toFixed(2)}` : "-";
        itemSupplierPrices.push(`${q}x ${labelFornitore}`);

        stringaSquadre.push(`${q}x ${item.squadra}`);
        const persLabel = item.infoPerso && item.infoPerso.trim() !== "" ? item.infoPerso : "No";
        stringaPersonalizzazioni.push(`${q}x [${persLabel}]`);
        stringaTaglie.push(`${q}x [${item.taglia}]`);

        if (item.imgUrl) {
          formuleImmagini.push(`=IMAGE("${item.imgUrl}")`);
        }
      }
    });

    const total = subtotal + shipping;

    // Cambio valuta
    const exchangeRate = await getLiveOrSettingsExchangeRate(settings);

    const order_shipping_usd = Number((quantita_totale_articoli * spedizione_unitaria).toFixed(2));
    const costo_totale_usd = Number((costo_prodotti_usd + order_shipping_usd).toFixed(2));
    const costo_totale_eur = convertUsdToEur(costo_totale_usd, exchangeRate, 'update-customer-order');
    const profitto_eur = Number((total - costo_totale_eur).toFixed(2));

    // 1. Aggiorna tabella customer_orders
    const { error: updateOrderErr } = await supabase
      .from('customer_orders')
      .update({
        subtotal: subtotal,
        shipping: shipping,
        total: total,
        updated_at: new Date().toISOString()
      })
      .eq('id', order_id);

    if (updateOrderErr) throw updateOrderErr;

    // 2. Aggiorna tabella customer_order_items (elimina e reinserisci)
    const { error: deleteItemsErr } = await supabase
      .from('customer_order_items')
      .delete()
      .eq('order_id', order_id);

    if (deleteItemsErr) throw deleteItemsErr;

    const orderItemsToInsert = [];
    for (const item of carrello) {
      const isSpedizione = item.squadra && isTechnicalShippingOrServiceLine(item.squadra);
      if (isSpedizione) continue;

      let matchedProd = allDbProducts.find(p => String(p.id) === String(item.id));
      if (!matchedProd && item.legacy_id) {
        matchedProd = allDbProducts.find(p => p.legacy_id !== undefined && p.legacy_id !== null && String(p.legacy_id) === String(item.legacy_id));
      }
      if (!matchedProd) {
        matchedProd = allDbProducts.find(p => p.versione === item.squadra || p.squadra === item.squadra);
      }

      orderItemsToInsert.push({
        order_id: order_id,
        product_id: matchedProd?.legacy_id ?? null,
        nome: item.squadra || '',
        categoria: matchedProd ? matchedProd.categoria : 'Kit',
        stagione: matchedProd ? matchedProd.stagione : '2026/2027',
        taglia: item.taglia || '-',
        personalizzazione: item.infoPerso || 'No',
        prezzo: Number(item.prezzo) || 0,
        quantita: Number(item.quantita) || 1
      });
    }

    if (orderItemsToInsert.length > 0) {
      const { error: insertItemsErr } = await supabase
        .from('customer_order_items')
        .insert(orderItemsToInsert);
      if (insertItemsErr) throw insertItemsErr;
    }

    // 3. Aggiorna tabella orders di Postgres (per l'Admin)
    const postgresOrderFields = {
      squadra: stringaSquadre.join(' / '),
      personalizzazione: stringaPersonalizzazioni.join(' | '),
      taglia: stringaTaglie.join(' / '),
      totale: total.toFixed(2).replace('.', ',') + "€",
      foto: formuleImmagini.length > 0 ? formuleImmagini[0] : "",
      prezzo_fornitore: itemSupplierPrices.join(' / '),
      costo_prodotti_usd: costo_prodotti_usd,
      costo_spedizione_usd: order_shipping_usd,
      costo_totale_usd: costo_totale_usd,
      cambio_usd_eur: exchangeRate,
      costo_totale_eur: costo_totale_eur,
      profitto_eur: profitto_eur,
      carrello: carrello
    };

    const { error: postgresUpdateErr } = await supabase
      .from('orders')
      .update(postgresOrderFields)
      .eq('id', orderData.admin_order_id);

    if (postgresUpdateErr) {
      console.warn("⚠️ Postgres orders table update failed:", postgresUpdateErr.message);
    }

    // Aggiorna cache locale e lotti
    try {
      const localOrders = getLocalOrders();
      const localOrdIdx = localOrders.findIndex(lo => Number(lo.id) === Number(orderData.admin_order_id));
      if (localOrdIdx !== -1) {
        localOrders[localOrdIdx] = {
          ...localOrders[localOrdIdx],
          ...postgresOrderFields
        };
        fs.writeFileSync(LOCAL_ORDERS_FILE, JSON.stringify(localOrders, null, 2), 'utf8');
      }

      await recalculateCurrentLotto();
    } catch (e) {
      console.warn("⚠️ Errore salvataggio cache locale:", e.message);
    }

    console.log(`✅ Ordine #${order_id} aggiornato con successo dall'utente.`);
    return res.json({ success: true, message: "Ordine modificato con successo!" });
  } catch (err) {
    console.error("❌ Errore in update-customer-order:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/orders/delete-customer-order - Permette all'utente di annullare interamente il proprio ordine prima della chiusura del lotto
app.post('/api/orders/delete-customer-order', async (req, res) => {
  try {
    const { order_id, access_token } = req.body;
    if (!order_id || !access_token) {
      return res.status(400).json({ success: false, error: "Dati mancanti." });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(500).json({ success: false, error: "Database non configurato." });
    }

    const userSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${access_token}` } }
    });

    const { data: { user }, error: authErr } = await userSupabase.auth.getUser();
    if (authErr || !user) {
      return res.status(401).json({ success: false, error: "Non autorizzato." });
    }

    const { data: orderData, error: orderErr } = await supabase
      .from('customer_orders')
      .select('*')
      .eq('id', order_id)
      .eq('user_id', user.id)
      .single();

    if (orderErr || !orderData) {
      return res.status(404).json({ success: false, error: "Ordine non trovato o non appartenente all'utente." });
    }

    const normalizedStatus = (orderData.status || '').trim().toLowerCase();
    if (normalizedStatus === 'annullato_dal_cliente' || normalizedStatus === 'annullato dal cliente') {
      return res.json({ success: true, message: "L'ordine risulta già annullato." });
    }
    if (normalizedStatus !== 'ordine ricevuto' && normalizedStatus !== 'in preparazione') {
      return res.status(400).json({ success: false, error: "Questo ordine non può più essere annullato poiché il lotto è stato chiuso." });
    }

    // NON cancelliamo alcun dato. Aggiorniamo lo stato a 'annullato_dal_cliente'.
    const { error: updateCustErr } = await supabase
      .from('customer_orders')
      .update({
        status: 'annullato_dal_cliente',
        updated_at: new Date().toISOString()
      })
      .eq('id', order_id);

    if (updateCustErr) {
      console.warn("⚠️ Errore aggiornamento stato customer_orders:", updateCustErr.message);
    }

    // Aggiorna anche la tabella orders (amministrativa) se presente
    if (orderData.admin_order_id) {
      try {
        await supabase
          .from('orders')
          .update({ status: 'annullato_dal_cliente' })
          .eq('id', orderData.admin_order_id);
      } catch (errOrd) {
        console.warn("⚠️ Errore aggiornamento stato orders:", errOrd.message);
      }
    }

    // Aggiorna cache locale e ricalcola il lotto corrente (escludendo gli ordini annullati)
    try {
      const localOrders = getLocalOrders();
      let updatedLocal = false;
      localOrders.forEach(lo => {
        if (Number(lo.id) === Number(orderData.admin_order_id) || lo.data === orderData.order_number) {
          lo.status = 'annullato_dal_cliente';
          updatedLocal = true;
        }
      });
      if (updatedLocal) {
        fs.writeFileSync(LOCAL_ORDERS_FILE, JSON.stringify(localOrders, null, 2), 'utf8');
      }

      await recalculateCurrentLotto();
    } catch (e) {
      console.warn("⚠️ Errore salvataggio cache locale:", e.message);
    }

    console.log(`✅ Ordine #${order_id} contrassegnato come annullato dal cliente.`);
    return res.json({ success: true, message: "Ordine annullato con successo." });
  } catch (err) {
    console.error("❌ Errore in delete-customer-order:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/products/seed - Popola il database locale in blocco (ignora Supabase)
app.post('/api/products/seed', async (req, res) => {
  try {
    const { products } = req.body;
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ success: false, error: "Fornire una lista di prodotti valida nell'array 'products'" });
    }

    const cleanProducts = products.map((p, index) => ({
      id: index + 1,
      squadra: p.squadra,
      categoria: p.categoria,
      versione: p.versione,
      stagione: p.stagione,
      prezzo: Number(p.prezzo) || 23.99,
      immagine: p.immagine || p.image_url || "",
      prezzo_fornitore: p.prezzo_fornitore !== undefined && p.prezzo_fornitore !== null ? Number(p.prezzo_fornitore) : null
    }));
    saveLocalProducts(cleanProducts);
    return res.json({ success: true, message: "Database locale popolato con successo (seeding locale)!", count: cleanProducts.length });
  } catch (err) {
    console.warn("⚠️ Errore durante il seeding locale:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// NUOVE API GESTIONE ORDINI, CRM CLIENTI, TRACKING, STATISTICHE E ATTIVITÀ
// =========================================================================

const CLIENTS_NOTES_FILE = path.join(__dirname, 'clients_notes.json');
const ACTIVITY_LOG_FILE = path.join(__dirname, 'activity_log.json');

function readClientsNotes() {
  if (!fs.existsSync(CLIENTS_NOTES_FILE)) {
    fs.writeFileSync(CLIENTS_NOTES_FILE, JSON.stringify({}, null, 2), 'utf8');
  }
  try {
    return JSON.parse(fs.readFileSync(CLIENTS_NOTES_FILE, 'utf8'));
  } catch (err) {
    console.error("⚠️ Errore lettura clients_notes.json:", err.message);
    return {};
  }
}

function saveClientsNotes(data) {
  try {
    fs.writeFileSync(CLIENTS_NOTES_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error("⚠️ Errore scrittura clients_notes.json:", err.message);
  }
}

function readActivityLog() {
  if (!fs.existsSync(ACTIVITY_LOG_FILE)) {
    fs.writeFileSync(ACTIVITY_LOG_FILE, JSON.stringify([], null, 2), 'utf8');
  }
  try {
    return JSON.parse(fs.readFileSync(ACTIVITY_LOG_FILE, 'utf8'));
  } catch (err) {
    console.error("⚠️ Errore lettura activity_log.json:", err.message);
    return [];
  }
}

function saveActivityLog(data) {
  try {
    fs.writeFileSync(ACTIVITY_LOG_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error("⚠️ Errore scrittura activity_log.json:", err.message);
  }
}

function addActivity(type, title, desc) {
  const activities = readActivityLog();
  const event = {
    id: 'ACT-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    time: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
    date: new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    type: type, // 'order', 'client', 'payment', 'tracking', 'shipped', 'delivered', 'lotto'
    title: title,
    desc: desc,
    timestamp: new Date().toISOString()
  };
  activities.unshift(event);
  if (activities.length > 200) {
    activities.pop();
  }
  saveActivityLog(activities);
}

// Struttura predisposta per notifiche future (Email, Push, Area Cliente)
async function inviaNotificheOrdine(evento, dati) {
  console.log(`📡 [PREPARAZIONE NOTIFICA FUTURA] Rilevato evento: ${evento}`);
  console.log(`📦 [DATI NOTIFICA]`, JSON.stringify(dati, null, 2));
  console.log(`💡 NOTA: Collegare a SendGrid / Firebase Cloud Messaging o WebSockets in produzione.`);
}

// Sincronizza dati completi e prodotti dell'ordine cliente su Supabase
async function aggiornaDatiOrdineClienteSupabase(adminOrderId, status, paymentStatus, carrello) {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    const pStatus = paymentStatus === 'Pagato' ? 'paid' : (paymentStatus === 'Rimborso' ? 'refunded' : 'unpaid');
    
    // Calcoliamo i totali per customer_orders
    let subtotal = 0;
    let shipping = 0;
    carrello.forEach(item => {
      const isSpedizione = item.squadra && isTechnicalShippingOrServiceLine(item.squadra);
      const itemPrezzo = (Number(item.prezzo) || 0) * (Number(item.quantita) || 1);
      if (isSpedizione) {
        shipping += itemPrezzo;
      } else {
        subtotal += itemPrezzo;
      }
    });
    const total = subtotal + shipping;

    // 1. Trova se esiste già un record in customer_orders
    const { data: existing, error: findErr } = await supabase
      .from('customer_orders')
      .select('id')
      .eq('admin_order_id', adminOrderId);

    if (findErr) {
      console.warn("⚠️ Find customer_orders failed:", findErr.message);
      return;
    }

    if (existing && existing.length > 0) {
      const customerOrderId = existing[0].id;
      
      // 2. Aggiorna customer_orders
      const { error: updErr } = await supabase
        .from('customer_orders')
        .update({
          status: status,
          payment_status: pStatus,
          subtotal: subtotal,
          shipping: shipping,
          total: total,
          updated_at: new Date().toISOString()
        })
        .eq('id', customerOrderId);

      if (updErr) {
        console.warn("⚠️ Update customer_orders failed:", updErr.message);
      }

      // 3. Elimina vecchi items
      const { error: delErr } = await supabase
        .from('customer_order_items')
        .delete()
        .eq('order_id', customerOrderId);

      if (delErr) {
        console.warn("⚠️ Delete customer_order_items failed:", delErr.message);
      }

      // 4. Inserisci nuovi items
      const orderItemsToInsert = [];
      for (const item of carrello) {
        orderItemsToInsert.push({
          order_id: customerOrderId,
          product_id: item.id || null,
          nome: item.nome || item.squadra || null,
          squadra: item.squadra || null,
          stagione: item.stagione || null,
          categoria: item.categoria || null,
          taglia: item.taglia || null,
          personalizzazione: item.infoPerso || item.personalizzazione || null,
          prezzo: Number(item.prezzo) || 0,
          quantita: Number(item.quantita) || 1
        });
      }

      const { error: insErr } = await supabase
        .from('customer_order_items')
        .insert(orderItemsToInsert);

      if (insErr) {
        console.warn("⚠️ Insert customer_order_items failed:", insErr.message);
      } else {
        console.log(`✅ Sincronizzato prodotti e totali ordine cliente ${adminOrderId} su Supabase`);
      }
    }
  } catch (err) {
    console.warn(`⚠️ Errore imprevisto aggiornaDatiOrdineClienteSupabase per ${adminOrderId}:`, err.message);
  }
}

// Unione dei dati orders + customer_orders + lotti tracking
async function getDbOrdersMerged() {
  const orders = await getDbOrders();
  let customerOrders = [];
  try {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data } = await supabase.from('customer_orders').select('*');
      if (data) customerOrders = data;
    }
  } catch (err) {
    console.warn("⚠️ Querying customer_orders fallito:", err.message);
  }
  
  // Recupera tutti i lotti per abbinare le informazioni di tracking
  let lotti = [];
  try {
    lotti = await getDbLotti();
  } catch (err) {
    console.warn("⚠️ Querying lotti fallito:", err.message);
  }
  
  return orders.map(ord => {
    const custOrd = customerOrders.find(co => String(co.admin_order_id) === String(ord.id));
    const lotto = ord.lotto_id ? lotti.find(l => Number(l.id) === Number(ord.lotto_id)) : null;
    
    // Lo stato della spedizione per l'ordine è governato ESCLUSIVAMENTE dallo stato di tracking del suo Lotto
    let trackingStatus = "In preparazione";
    let trackingCode = "";
    let trackingCarrier = "";
    let trackingHistory = [];
    let trackingShippingDate = "";
    let trackingDeliveryDate = "";
    let trackingLastUpdate = "";

    const isAnnullato = (custOrd && (custOrd.status === 'annullato_dal_cliente' || custOrd.status === 'Annullato dal Cliente')) ||
                        (ord && (ord.status === 'annullato_dal_cliente' || ord.status === 'Annullato dal Cliente'));

    if (isAnnullato) {
      trackingStatus = "annullato_dal_cliente";
    } else if (lotto) {
      const tracking = getLottoTracking(lotto);
      trackingStatus = tracking.shipping_status || "In preparazione";
      trackingCode = tracking.tracking_code || "";
      trackingCarrier = tracking.tracking_carrier || "";
      trackingHistory = tracking.tracking_history || [];
      trackingShippingDate = tracking.tracking_shipping_date || "";
      trackingDeliveryDate = tracking.tracking_delivery_date || "";
      trackingLastUpdate = tracking.tracking_last_update || "";
    } else if (custOrd && custOrd.status) {
      trackingStatus = custOrd.status;
    }

    const email = (custOrd && custOrd.email) || `${ord.nome.toLowerCase().replace(/\s+/g, '')}@gmail.com`;
    const paymentStatus = custOrd ? (custOrd.payment_status === 'paid' ? 'Pagato' : (custOrd.payment_status === 'refunded' ? 'Rimborso' : 'Da pagare')) : 'Da pagare';

    return {
      ...ord,
      email: email,
      payment_status: paymentStatus,
      status: trackingStatus, // Governed by Lotto tracking status!
      tracking_code: trackingCode,
      tracking_carrier: trackingCarrier,
      tracking_history: trackingHistory,
      tracking_shipping_date: trackingShippingDate,
      tracking_delivery_date: trackingDeliveryDate,
      tracking_last_update: trackingLastUpdate,
      notes: lotto ? lotto.tracking_notes || "" : "",
      updated_at: ord.created_at || new Date().toISOString(),
      audit_log: [
        { time: new Date(ord.created_at || Date.now()).toLocaleString('it-IT'), action: "Creazione ordine", description: "L'ordine è stato registrato nel pannello." }
      ],
      user_id: custOrd ? custOrd.user_id : null,
      registered_name: custOrd ? ord.nome : null
    };
  });
}

function compileCRMClienti(mergedOrders) {
  const clientsMap = {};
  
  mergedOrders.forEach(ord => {
    const phone = ord.telefono ? ord.telefono.trim() : "Non specificato";
    const email = ord.email ? ord.email.trim() : `${ord.nome.toLowerCase().replace(/\s+/g, '')}@gmail.com`;
    const key = phone !== "Non specificato" ? phone : email;
    
    if (!clientsMap[key]) {
      clientsMap[key] = {
        nome: ord.nome || "Cliente Anonimo",
        email: email,
        telefono: phone,
        ordini: [],
        totale_speso: 0,
        primo_ordine: ord.created_at || ord.data,
        ultimo_ordine: ord.created_at || ord.data,
        registrato_il: ord.created_at || ord.data,
        notes: ""
      };
    }
    
    const client = clientsMap[key];
    client.ordini.push(ord);
    if (isOrderActiveForLotto(ord)) {
      client.totale_speso += Number(ord.totale) || 0;
    }
    
    const oDate = new Date(ord.created_at || ord.data);
    const pDate = new Date(client.primo_ordine);
    const uDate = new Date(client.ultimo_ordine);
    
    if (oDate < pDate) {
      client.primo_ordine = ord.created_at || ord.data;
      client.registrato_il = ord.created_at || ord.data;
    }
    if (oDate > uDate) {
      client.ultimo_ordine = ord.created_at || ord.data;
      client.nome = ord.nome || client.nome;
      client.email = email;
    }
  });
  
  const clientsNotes = readClientsNotes();
  
  Object.keys(clientsMap).forEach(k => {
    clientsMap[k].notes = clientsNotes[k] || "";
  });
  
  return Object.values(clientsMap);
}

// ----------------------
// ENDPOINTS ADVANCED ADMIN
// ----------------------

// 1. GET /api/admin/gestione-ordini
app.get('/api/admin/gestione-ordini', async (req, res) => {
  try {
    const mergedOrders = await getDbOrdersMerged();
    return res.json({ success: true, orders: mergedOrders });
  } catch (err) {
    console.error("⚠️ Errore GET /api/admin/gestione-ordini:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 2. POST /api/admin/gestione-ordini/update
app.post('/api/admin/gestione-ordini/update', async (req, res) => {
  try {
    const { 
      id, 
      payment_status, 
      status, 
      notes, 
      email, 
      tracking_carrier,
      carrello,
      totale,
      costo_prodotti_usd,
      costo_spedizione_usd,
      costo_totale_usd,
      costo_totale_eur,
      profitto_eur,
      squadra,
      personalizzazione,
      taglia,
      prezzo_fornitore,
      registered_name,
      lotto_id
    } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, error: "Identificatore ordine mancante." });
    }
    
    // 1. Aggiorna il database Supabase (tabella 'orders')
    const supabase = getSupabaseClient();
    
    // Recupera l'ordine esistente per confrontare il carrello
    let existingOrder = null;
    let hasCartChanged = false;
    if (supabase) {
      try {
        const { data: ords } = await supabase.from('orders').select('*').eq('id', id);
        if (ords && ords.length > 0) {
          existingOrder = ords[0];
          
          if (carrello !== undefined) {
            const existingCartStr = typeof existingOrder.carrello === 'string' ? existingOrder.carrello.trim() : JSON.stringify(existingOrder.carrello || []);
            const incomingCartStr = typeof carrello === 'string' ? carrello.trim() : JSON.stringify(carrello || []);
            if (existingCartStr !== incomingCartStr) {
              hasCartChanged = true;
            }
          }
        }
      } catch (err) {
        console.warn("⚠️ Recupero ordine esistente fallito in update endpoint:", err.message);
      }
    }

    const updateData = {};
    if (carrello !== undefined) updateData.carrello = carrello;
    if (squadra !== undefined) updateData.squadra = squadra;
    if (personalizzazione !== undefined) updateData.personalizzazione = personalizzazione;
    if (taglia !== undefined) updateData.taglia = taglia;
    if (lotto_id !== undefined) {
      updateData.lotto_id = lotto_id ? Number(lotto_id) : null;
      if (updateData.lotto_id) {
        await ensureLottoExistsInDb(updateData.lotto_id);
      }
    }

    // Solo se il carrello è effettivamente cambiato o se l'ordine non è ancora presente,
    // andiamo ad aggiornare i dati economici sul database. In questo modo cambiano SOLO per modifiche reali al carrello.
    if (carrello !== undefined && (!existingOrder || hasCartChanged)) {
      if (totale !== undefined) updateData.totale = totale;
      if (costo_prodotti_usd !== undefined) updateData.costo_prodotti_usd = String(costo_prodotti_usd);
      if (costo_spedizione_usd !== undefined) updateData.costo_spedizione_usd = String(costo_spedizione_usd);
      if (costo_totale_usd !== undefined) updateData.costo_totale_usd = String(costo_totale_usd);
      if (costo_totale_eur !== undefined) updateData.costo_totale_eur = String(costo_totale_eur);
      if (profitto_eur !== undefined) updateData.profitto_eur = String(profitto_eur);
      if (prezzo_fornitore !== undefined) updateData.prezzo_fornitore = prezzo_fornitore;
    }

    if (supabase && Object.keys(updateData).length > 0) {
      try {
        const { error: ordErr } = await supabase
          .from('orders')
          .update(updateData)
          .eq('id', id);

        if (ordErr) {
          console.error(`❌ Errore aggiornamento ordine #${id} in Supabase:`, ordErr.message);
        } else {
          console.log(`✅ Ordine #${id} aggiornato con successo in Supabase 'orders'`);
        }
      } catch (e) {
        console.error(`⚠️ Eccezione aggiornamento ordine #${id} in Supabase:`, e.message);
      }
    }

    // 2. Aggiorna la cache locale backup 'orders_local.json'
    if (Object.keys(updateData).length > 0) {
      try {
        const localOrders = getLocalOrders();
        const localIdx = localOrders.findIndex(o => Number(o.id) === Number(id));
        if (localIdx !== -1) {
          localOrders[localIdx] = {
            ...localOrders[localIdx],
            ...updateData
          };
          fs.writeFileSync(LOCAL_ORDERS_FILE, JSON.stringify(localOrders, null, 2), 'utf8');
          console.log(`✅ Cache locale orders_local.json aggiornata per ordine #${id}`);
        }
      } catch (e) {
        console.warn("⚠️ Impossibile aggiornare cache locale orders_local.json:", e.message);
      }
    }
    
    // 3. Aggiorniamo su Supabase customer_orders per real-time sync Area Cliente
    if (supabase) {
      const dbPaymentStatus = payment_status === 'Pagato' ? 'paid' : (payment_status === 'Rimborso' ? 'refunded' : 'pending');
      const dbStatus = status || 'In preparazione';
      
      try {
        if (carrello !== undefined) {
          await supabase.from('customer_orders').update({
            status: dbStatus,
            payment_status: dbPaymentStatus,
            total: totale ? parseFloat(String(totale).replace('€', '').replace(',', '.')) : undefined,
            updated_at: new Date().toISOString()
          }).eq('admin_order_id', id);
        } else {
          await supabase.from('customer_orders').update({
            status: dbStatus,
            payment_status: dbPaymentStatus,
            updated_at: new Date().toISOString()
          }).eq('admin_order_id', id);
        }
      } catch (err) {
        console.warn("⚠️ Aggiornamento customer_orders fallito:", err.message);
      }
    }
    
    // Ricalcola il lotto corrente per sincronizzare le modifiche economiche
    await recalculateCurrentLotto();

    // Ritorna l'ordine unito aggiornato
    const mergedOrders = await getDbOrdersMerged();
    const updatedOrd = mergedOrders.find(o => Number(o.id) === Number(id));

    return res.json({ success: true, order: updatedOrd });
  } catch (err) {
    console.error("⚠️ Errore POST /api/admin/gestione-ordini/update:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Helper di tracciamento per i Lotti (Tracking Lotto)
function getLottoTracking(lotto) {
  const meta = (lotto.orders || []).find(o => o.is_tracking_meta);
  if (meta) {
    return {
      shipping_status: meta.shipping_status || "In preparazione",
      tracking_code: meta.tracking_code || "",
      tracking_url: meta.tracking_url || "",
      tracking_carrier: meta.tracking_carrier || "",
      tracking_history: meta.tracking_history || [],
      tracking_shipping_date: meta.tracking_shipping_date || "",
      tracking_delivery_date: meta.tracking_delivery_date || "",
      tracking_last_update: meta.tracking_last_update || ""
    };
  }
  return {
    shipping_status: "In preparazione",
    tracking_code: "",
    tracking_url: "",
    tracking_carrier: "",
    tracking_history: [],
    tracking_shipping_date: "",
    tracking_delivery_date: "",
    tracking_last_update: ""
  };
}

function setLottoTracking(lotto, trackingData) {
  if (!lotto.orders) lotto.orders = [];
  let metaIndex = lotto.orders.findIndex(o => o.is_tracking_meta);
  const metaObj = {
    is_tracking_meta: true,
    shipping_status: trackingData.shipping_status || "In preparazione",
    tracking_code: trackingData.tracking_code || "",
    tracking_url: trackingData.tracking_url || ""
  };
  if (metaIndex !== -1) {
    lotto.orders[metaIndex] = metaObj;
  } else {
    lotto.orders.push(metaObj);
  }
}

async function aggiornaStatiOrdiniDaLotto(lottoId, tracking) {
  const statusToApply = tracking.shipping_status || "In preparazione";
  console.log(`[BACKEND] Aggiornamento stati ordini in customer_orders per Lotto #${lottoId} a "${statusToApply}"`);
  
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data: ords, error: fetchErr } = await supabase
        .from('orders')
        .select('id')
        .eq('lotto_id', lottoId);
        
      if (!fetchErr && ords) {
        for (const o of ords) {
          if (o.id) {
            await supabase.from('customer_orders').update({
              status: statusToApply,
              updated_at: new Date().toISOString()
            }).eq('admin_order_id', o.id);
          }
        }
      }
    } catch (dbErr) {
      console.warn("⚠️ Errore durante l'aggiornamento degli ordini in Supabase:", dbErr.message);
    }
  }
}

// Nuovi Endpoint Gestione Tracking Lotto
app.post('/api/admin/lotto/save-tracking', async (req, res) => {
  try {
    const { id, shipping_status, tracking_code, tracking_url } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, error: "ID lotto mancante." });
    }
    
    const archive = await getDbLotti();
    const lotto = archive.find(l => Number(l.id) === Number(id));
    if (!lotto) {
      return res.status(404).json({ success: false, error: `Lotto con ID ${id} non trovato.` });
    }
    
    const tracking = {
      shipping_status: shipping_status || "In preparazione",
      tracking_code: tracking_code || "",
      tracking_url: tracking_url || ""
    };
    
    setLottoTracking(lotto, tracking);
    await insertDbLotto(lotto);
    await aggiornaStatiOrdiniDaLotto(lotto.id, tracking);

    return res.json({ success: true, lotto });
  } catch (err) {
    console.error("⚠️ Errore POST /api/admin/lotto/save-tracking:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/customer/order-tracking-info/:adminOrderId', async (req, res) => {
  try {
    const rawId = req.params.adminOrderId;
    if (!rawId || rawId === 'undefined' || rawId === 'null') {
      return res.json({
        success: true,
        has_lotto: false,
        shipping_status: "In preparazione",
        status: "In preparazione",
        tracking_code: "",
        tracking_url: "",
        message: "Nessun ID fornito."
      });
    }
    
    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.json({
        success: true,
        has_lotto: false,
        shipping_status: "In preparazione",
        status: "In preparazione",
        tracking_code: "",
        tracking_url: ""
      });
    }
    
    let order = null;
    let fallbackStatus = "In preparazione";
    
    const cleanId = String(rawId).trim();
    const isNumeric = /^\d+$/.test(cleanId);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);
    
    if (isNumeric) {
      const numericId = Number(cleanId);
      // 1. Cerca nella tabella admin 'orders'
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', numericId)
        .maybeSingle();
        
      if (!error && data) {
        order = data;
      } else {
        // Fallback: cerca in customer_orders per admin_order_id o order_number
        const { data: custOrder } = await supabase
          .from('customer_orders')
          .select('*')
          .or(`admin_order_id.eq.${numericId},order_number.eq.ORD-${numericId},order_number.eq.${numericId}`)
          .maybeSingle();
          
        if (custOrder) {
          fallbackStatus = custOrder.status || "In preparazione";
          if (custOrder.admin_order_id && /^\d+$/.test(String(custOrder.admin_order_id))) {
            const { data: ord } = await supabase
              .from('orders')
              .select('*')
              .eq('id', Number(custOrder.admin_order_id))
              .maybeSingle();
            if (ord) order = ord;
          }
        }
      }
    } else if (isUuid) {
      // adminOrderId è un UUID, quindi probabilmente l'id di customer_orders
      const { data: custOrder } = await supabase
        .from('customer_orders')
        .select('*')
        .eq('id', cleanId)
        .maybeSingle();
        
      if (custOrder) {
        fallbackStatus = custOrder.status || "In preparazione";
        const linkedAdminId = custOrder.admin_order_id;
        if (linkedAdminId && /^\d+$/.test(String(linkedAdminId))) {
          const { data } = await supabase
            .from('orders')
            .select('*')
            .eq('id', Number(linkedAdminId))
            .maybeSingle();
          if (data) {
            order = data;
          }
        }
      }
    } else {
      // Stringa generica tipo "ORD-4829" o altro
      const numPart = cleanId.replace(/^ORD-?/i, '');
      if (/^\d+$/.test(numPart)) {
        const { data: ord } = await supabase
          .from('orders')
          .select('*')
          .eq('id', Number(numPart))
          .maybeSingle();
        if (ord) order = ord;
      }
      if (!order) {
        const { data: custOrder } = await supabase
          .from('customer_orders')
          .select('*')
          .or(`order_number.eq.${cleanId},order_number.eq.ORD-${cleanId}`)
          .maybeSingle();
        if (custOrder) {
          fallbackStatus = custOrder.status || "In preparazione";
          if (custOrder.admin_order_id && /^\d+$/.test(String(custOrder.admin_order_id))) {
            const { data: ord } = await supabase
              .from('orders')
              .select('*')
              .eq('id', Number(custOrder.admin_order_id))
              .maybeSingle();
            if (ord) order = ord;
          }
        }
      }
    }
    
    if (!order) {
      return res.json({
        success: true,
        has_lotto: false,
        shipping_status: fallbackStatus,
        status: fallbackStatus,
        tracking_code: "",
        tracking_url: "",
        message: "Informazioni di spedizione collegate."
      });
    }
    
    // Se l'abbiamo trovato, procediamo con la logica normale!
    const lottoId = order.lotto_id;
    if (!lottoId) {
      return res.json({
        success: true,
        has_lotto: false,
        shipping_status: fallbackStatus || order.stato || "In preparazione",
        status: fallbackStatus || order.stato || "In preparazione",
        message: "In attesa di associazione a un lotto di spedizione."
      });
    }
    
    const archive = await getDbLotti();
    const lotto = archive.find(l => Number(l.id) === Number(lottoId));
    if (!lotto) {
      return res.json({
        success: true,
        has_lotto: false,
        shipping_status: fallbackStatus || order.stato || "In preparazione",
        status: fallbackStatus || order.stato || "In preparazione",
        message: "Lotto associato non ancora archiviato o pronto."
      });
    }
    
    const tracking = getLottoTracking(lotto);
    return res.json({
      success: true,
      has_lotto: true,
      shipping_status: tracking.shipping_status || fallbackStatus || "In preparazione",
      status: tracking.shipping_status || fallbackStatus || "In preparazione",
      tracking_code: tracking.tracking_code || "",
      tracking_url: tracking.tracking_url || ""
    });
  } catch (err) {
    return res.json({
      success: true,
      has_lotto: false,
      shipping_status: "In preparazione",
      status: "In preparazione",
      tracking_code: "",
      tracking_url: ""
    });
  }
});

// 5. GET /api/admin/clienti
app.get('/api/admin/clienti', async (req, res) => {
  try {
    const mergedOrders = await getDbOrdersMerged();
    const clients = compileCRMClienti(mergedOrders);
    return res.json({ success: true, clients });
  } catch (err) {
    console.error("⚠️ Errore GET /api/admin/clienti:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 6. POST /api/admin/clienti/notes
app.post('/api/admin/clienti/notes', async (req, res) => {
  try {
    const { key, notes } = req.body;
    if (!key) {
      return res.status(400).json({ success: false, error: "Identificativo cliente mancante (telefono o email)." });
    }
    
    const clientsNotes = readClientsNotes();
    clientsNotes[key] = notes || "";
    saveClientsNotes(clientsNotes);
    
    addActivity('client', "Note CRM Clienti Aggiornate", `Aggiornate note per il profilo cliente "${key}".`);
    
    return res.json({ success: true, notes: notes });
  } catch (err) {
    console.error("⚠️ Errore POST /api/admin/clienti/notes:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 7. GET /api/admin/statistiche
app.get('/api/admin/statistiche', async (req, res) => {
  try {
    const orders = await getDbOrdersMerged();
    
    const ora = new Date();
    const oggiStr = ora.toLocaleDateString('it-IT');
    
    // Calcoliamo inizio settimana ed inizio mese
    const inizioSettimana = new Date();
    inizioSettimana.setDate(ora.getDate() - ora.getDay());
    inizioSettimana.setHours(0,0,0,0);
    
    const inizioMese = new Date(ora.getFullYear(), ora.getMonth(), 1);
    
    let oggiCount = 0;
    let settimanaCount = 0;
    let meseCount = 0;
    let fatturato = 0;
    let profitto = 0;
    
    const prodottiVenduti = {};
    const categorieVendute = {};
    const venditeGiorni = {}; // Per grafico andamento
    
    // Raggruppamento per calcolare clienti nuovi/abituali
    const telefonoMappaCount = {};
    
    orders.forEach(o => {
      if (!isOrderActiveForLotto(o)) return;

      const oDate = new Date(o.created_at || o.data);
      const oDateStr = oDate.toLocaleDateString('it-IT');
      
      const totVal = Number(o.totale) || 0;
      
      telefonoMappaCount[o.telefono || o.nome] = (telefonoMappaCount[o.telefono || o.nome] || 0) + 1;
      
      // Filtri temporali
      if (oDateStr === oggiStr) oggiCount++;
      if (oDate >= inizioSettimana) settimanaCount++;
      if (oDate >= inizioMese) meseCount++;
      
      fatturato += totVal;
      // Stima del profitto premium al 45% del fatturato
      profitto += totVal * 0.45;
      
      // Andamento giornaliero
      const gChiave = oDate.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
      venditeGiorni[gChiave] = (venditeGiorni[gChiave] || 0) + totVal;
      
      // Prodotti & Categorie
      const listProd = o.carrello || [];
      listProd.forEach(p => {
        prodottiVenduti[p.nome] = (prodottiVenduti[p.nome] || 0) + (Number(p.quantita) || 1);
        categorieVendute[p.squadra || 'Altri Club'] = (categorieVendute[p.squadra || 'Altri Club'] || 0) + (Number(p.quantita) || 1);
      });
    });
    
    const aov = orders.length > 0 ? (fatturato / orders.length) : 0;
    
    // Clienti nuovi vs abituali
    let clientiNuovi = 0;
    let clientiAbituali = 0;
    Object.values(telefonoMappaCount).forEach(v => {
      if (v > 1) clientiAbituali++;
      else clientiNuovi++;
    });
    
    // Top Prodotti
    const topProdotti = Object.entries(prodottiVenduti)
      .sort((a,b) => b[1] - a[1])
      .slice(0, 5)
      .map(entry => ({ nome: entry[0], qt: entry[1] }));
      
    // Top Categorie
    const topCategorie = Object.entries(categorieVendute)
      .sort((a,b) => b[1] - a[1])
      .slice(0, 5)
      .map(entry => ({ nome: entry[0], qt: entry[1] }));
      
    // Serie per grafico andamento ordinato temporale
    const andamentoSerie = Object.entries(venditeGiorni)
      .slice(-7) // Ultimi 7 record registrati
      .map(entry => ({ giorno: entry[0], totale: entry[1] }));
      
    return res.json({
      success: true,
      stats: {
        oggiCount,
        settimanaCount,
        meseCount,
        fatturato,
        profitto,
        aov,
        clientiNuovi,
        clientiAbituali,
        topProdotti,
        topCategorie,
        andamentoSerie
      }
    });
  } catch (err) {
    console.error("⚠️ Errore GET /api/admin/statistiche:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 8. GET /api/admin/attivita
app.get('/api/admin/attivita', (req, res) => {
  try {
    const activities = readActivityLog();
    return res.json({ success: true, activities });
  } catch (err) {
    console.error("⚠️ Errore GET /api/admin/attivita:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 9. POST /api/admin/attivita/clean
app.post('/api/admin/attivita/clean', (req, res) => {
  try {
    saveActivityLog([]);
    addActivity('system', 'Log Pulito', 'La cronologia delle attività è stata ripulita dallo staff.');
    return res.json({ success: true, message: "Log pulito correttamente!" });
  } catch (err) {
    console.error("⚠️ Errore POST /api/admin/attivita/clean:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 10. GET /api/customer/tracking
app.get('/api/customer/tracking', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ success: false, error: "Identificativo ordine mancante." });
    }
    
    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(500).json({ success: false, error: "Database non configurato." });
    }
    
    // Recupera l'ordine da Supabase (tabella orders)
    const { data: ord, error: ordErr } = await supabase
      .from('orders')
      .select('lotto_id')
      .eq('id', id)
      .single();
      
    if (ordErr || !ord || !ord.lotto_id) {
      return res.json({
        success: false,
        message: "L'ordine non è ancora associato a una spedizione o a un lotto."
      });
    }
    
    // Recupera il lotto
    const { data: lotto, error: lottoErr } = await supabase
      .from('lotti')
      .select('*')
      .eq('id', ord.lotto_id)
      .single();
      
    if (lottoErr || !lotto || !lotto.tracking_code) {
      return res.json({
        success: false,
        message: "Nessun codice tracking attivo per questa spedizione."
      });
    }
    
    return res.json({
      success: true,
      order_id: id,
      tracking_code: lotto.tracking_code,
      carrier: lotto.tracking_carrier || "DHL Express Premium",
      status: lotto.tracking_status || "In Preparazione",
      timeline: lotto.tracking_history || lotto.tracking_events || [],
      updated_at: lotto.tracking_last_update || lotto.updated_at
    });
  } catch (err) {
    console.error("⚠️ Errore GET /api/customer/tracking:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});


// ==========================================================================
// CHAT ASSISTENZA ENDPOINTS & SERVIZIO (MAGLIA D'ORO PREMIUM)
// ==========================================================================

const CHAT_LOCAL_FILE = path.join(__dirname, 'chat_local.json');

function getLocalChat() {
  if (!fs.existsSync(CHAT_LOCAL_FILE)) {
    fs.writeFileSync(CHAT_LOCAL_FILE, JSON.stringify({ conversations: [], messages: [] }, null, 2));
  }
  try {
    return JSON.parse(fs.readFileSync(CHAT_LOCAL_FILE, 'utf8'));
  } catch (e) {
    return { conversations: [], messages: [] };
  }
}

function stringToUuid(str) {
  if (!str) return '00000000-0000-4000-8000-000000000000';
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (uuidRegex.test(str)) return str;
  const hash = crypto.createHash('md5').update(String(str)).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function saveLocalChat(data) {
  try {
    fs.writeFileSync(CHAT_LOCAL_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Error saving local chat:", e);
  }
}

async function dbGetOrCreateConversation(userId, nome, email) {
  const validUserId = stringToUuid(userId);
  const cleanEmail = email ? String(email).trim().toLowerCase() : '';
  const cleanNome = nome ? String(nome).trim() : 'Cliente';

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      // 1. Cerca per user_id
      let { data: convs, error } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('user_id', validUserId);
      
      if (!error && convs && convs.length > 0) {
        // Se l'email o il nome differiscono, aggiorna
        const existing = convs[0];
        if ((cleanEmail && existing.email !== cleanEmail) || (cleanNome && existing.nome !== cleanNome)) {
          await supabase
            .from('chat_conversations')
            .update({
              email: cleanEmail || existing.email,
              nome: cleanNome || existing.nome,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id);
          existing.email = cleanEmail || existing.email;
          existing.nome = cleanNome || existing.nome;
        }
        return existing;
      }

      // 2. Cerca per email se presente
      if (cleanEmail) {
        let { data: convsByEmail, error: emailErr } = await supabase
          .from('chat_conversations')
          .select('*')
          .ilike('email', cleanEmail);
        
        if (!emailErr && convsByEmail && convsByEmail.length > 0) {
          const existing = convsByEmail[0];
          await supabase
            .from('chat_conversations')
            .update({
              user_id: validUserId,
              nome: cleanNome || existing.nome,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id);
          existing.user_id = validUserId;
          existing.nome = cleanNome || existing.nome;
          return existing;
        }
      }
      
      // 3. Crea nuova conversazione in Supabase con UUID valido
      const newConv = {
        id: validUserId,
        user_id: validUserId,
        nome: cleanNome,
        email: cleanEmail,
        stato: 'Nuova',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_message_at: new Date().toISOString()
      };

      const { data: inserted, error: insertErr } = await supabase
        .from('chat_conversations')
        .insert(newConv)
        .select();
      
      if (!insertErr && inserted && inserted.length > 0) {
        return inserted[0];
      }
    } catch (err) {
      console.warn("Supabase chat_conversations get-or-create error, falling back:", err.message);
    }
  }

  // Backup locale sincrono
  const local = getLocalChat();
  let conv = local.conversations.find(c => c.user_id === validUserId || c.user_id === userId || (cleanEmail && c.email && c.email.toLowerCase() === cleanEmail));
  if (!conv) {
    conv = {
      id: validUserId,
      user_id: validUserId,
      nome: cleanNome,
      email: cleanEmail,
      stato: 'Nuova',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_message_at: new Date().toISOString()
    };
    local.conversations.push(conv);
    saveLocalChat(local);
  }
  return conv;
}

async function dbAddMessage(conversationId, sender, message, attachmentUrl = null, attachmentType = null) {
  const validConvId = stringToUuid(conversationId);
  const supabase = getSupabaseClient();
  const newMessage = {
    conversation_id: validConvId,
    sender,
    message: message || '',
    attachment_url: attachmentUrl,
    attachment_type: attachmentType,
    is_read: false,
    created_at: new Date().toISOString()
  };

  if (supabase) {
    try {
      const { data: inserted, error } = await supabase
        .from('chat_messages')
        .insert(newMessage)
        .select();
      
      if (!error && inserted && inserted.length > 0) {
        await supabase
          .from('chat_conversations')
          .update({
            last_message_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', validConvId);
        
        return inserted[0];
      }
    } catch (err) {
      console.warn("Supabase chat_messages insert error, falling back:", err.message);
    }
  }

  const local = getLocalChat();
  const msgWithId = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    ...newMessage
  };
  local.messages.push(msgWithId);

  const conv = local.conversations.find(c => c.id === validConvId || c.id === conversationId);
  if (conv) {
    conv.last_message_at = new Date().toISOString();
    conv.updated_at = new Date().toISOString();
  }
  saveLocalChat(local);
  return msgWithId;
}

async function dbGetMessages(conversationId) {
  const validConvId = stringToUuid(conversationId);
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', validConvId)
        .order('created_at', { ascending: true });
      
      if (!error && data) {
        return data;
      }
    } catch (err) {
      console.warn("Supabase dbGetMessages error, falling back:", err.message);
    }
  }

  const local = getLocalChat();
  return local.messages
    .filter(m => m.conversation_id === validConvId || m.conversation_id === conversationId)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

async function dbUpdateConversationStatus(conversationId, status) {
  const validConvId = stringToUuid(conversationId);
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { error } = await supabase
        .from('chat_conversations')
        .update({ stato: status, updated_at: new Date().toISOString() })
        .eq('id', validConvId);
      
      if (!error) return true;
    } catch (err) {
      console.warn("Supabase dbUpdateConversationStatus error, falling back:", err.message);
    }
  }

  const local = getLocalChat();
  const conv = local.conversations.find(c => c.id === validConvId || c.id === conversationId);
  if (conv) {
    conv.stato = status;
    conv.updated_at = new Date().toISOString();
    saveLocalChat(local);
    return true;
  }
  return false;
}

async function dbMarkMessagesAsRead(conversationId, senderToMark) {
  const validConvId = stringToUuid(conversationId);
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { error } = await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('conversation_id', validConvId)
        .eq('sender', senderToMark);
      
      if (!error) return true;
    } catch (err) {
      console.warn("Supabase dbMarkMessagesAsRead error, falling back:", err.message);
    }
  }

  const local = getLocalChat();
  let modified = false;
  local.messages.forEach(m => {
    if ((m.conversation_id === validConvId || m.conversation_id === conversationId) && m.sender === senderToMark && !m.is_read) {
      m.is_read = true;
      modified = true;
    }
  });
  if (modified) {
    saveLocalChat(local);
  }
  return true;
}

async function dbGetAllConversations() {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .select('*')
        .order('last_message_at', { ascending: false });
      
      if (!error && data) {
        return data;
      }
    } catch (err) {
      console.warn("Supabase dbGetAllConversations error, falling back:", err.message);
    }
  }

  const local = getLocalChat();
  return [...local.conversations].sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
}

// 1. POST /api/chat/get-or-create - Get or create conversation for customer
app.post('/api/chat/get-or-create', async (req, res) => {
  try {
    const { user_id, nome, email } = req.body;
    if (!user_id) {
      return res.status(400).json({ success: false, error: "Dati utente mancanti (user_id)" });
    }
    const conv = await dbGetOrCreateConversation(user_id, nome, email);
    const messages = await dbGetMessages(conv.id);
    return res.json({ success: true, conversation: conv, messages });
  } catch (err) {
    console.error("⚠️ Errore POST /api/chat/get-or-create:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 2. POST /api/chat/send-message - Client sends a message
app.post('/api/chat/send-message', async (req, res) => {
  try {
    const { user_id, nome, email, message, attachment_url, attachment_type } = req.body;
    if (!user_id) {
      return res.status(400).json({ success: false, error: "user_id mancante." });
    }

    // Ottieni o crea la conversazione
    const conv = await dbGetOrCreateConversation(user_id, nome, email);
    
    // Controlla se ci sono messaggi inviati prima dal cliente
    const existingMessages = await dbGetMessages(conv.id);
    const clientMessagesCount = existingMessages.filter(m => m.sender === 'client').length;

    // Aggiungi il messaggio del cliente
    const msg = await dbAddMessage(conv.id, 'client', message, attachment_url, attachment_type);
    
    // Cambia stato a 'In attesa'
    await dbUpdateConversationStatus(conv.id, 'In attesa');

    let botResponse = null;
    // Se è il primo messaggio del cliente, invia una risposta automatica
    if (clientMessagesCount === 0) {
      const automaticMessage = `Grazie per aver contattato l'assistenza di Maglia d'Oro.\nAbbiamo ricevuto correttamente il tuo messaggio.\nRispondiamo normalmente entro 24 ore lavorative.\nSe desideri essere ricontattato più rapidamente puoi inviarci il tuo numero di telefono direttamente in questa chat e un membro del nostro team ti richiamerà il prima possibile.\nGrazie per la fiducia.`;
      
      botResponse = await dbAddMessage(conv.id, 'admin', automaticMessage, null, null);
    }

    return res.json({ success: true, message: msg, botResponse });
  } catch (err) {
    console.error("⚠️ Errore POST /api/chat/send-message:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 3. POST /api/chat/mark-read - Marks admin messages as read for customer
app.post('/api/chat/mark-read', async (req, res) => {
  try {
    const { conversation_id, sender } = req.body;
    if (!conversation_id || !sender) {
      return res.status(400).json({ success: false, error: "conversation_id o sender mancante." });
    }
    await dbMarkMessagesAsRead(conversation_id, sender);
    return res.json({ success: true });
  } catch (err) {
    console.error("⚠️ Errore POST /api/chat/mark-read:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4. GET /api/admin/chats - Returns all conversations for admin panel, enriched with orders info
app.get('/api/admin/chats', async (req, res) => {
  try {
    const conversations = await dbGetAllConversations();
    const allMergedOrders = await getDbOrdersMerged();

    const enrichedConversations = await Promise.all(conversations.map(async (conv) => {
      // Trova ordini associati a questo utente per user_id o email
      const convEmail = conv.email ? String(conv.email).toLowerCase().trim() : '';
      const userOrders = allMergedOrders.filter(o => {
        const oEmail = o.email ? String(o.email).toLowerCase().trim() : '';
        return (conv.user_id && o.user_id === conv.user_id) || (convEmail && oEmail === convEmail);
      });

      const orderCount = userOrders.length;
      let lastOrder = null;
      let lottoId = null;

      if (orderCount > 0) {
        // Ordina per data decrescente
        userOrders.sort((a, b) => new Date(b.data || b.created_at) - new Date(a.data || a.created_at));
        lastOrder = userOrders[0];
        // Prendi il lotto associato se presente
        const ordWithLotto = userOrders.find(o => o.lotto_id);
        if (ordWithLotto) {
          lottoId = ordWithLotto.lotto_id;
        }
      }

      // Recupera messaggi per vedere se ci sono messaggi non letti
      const msgs = await dbGetMessages(conv.id);
      const unreadCount = msgs.filter(m => m.sender === 'client' && !m.is_read).length;

      return {
        ...conv,
        orderCount,
        lastOrder: lastOrder ? {
          id: lastOrder.id,
          order_number: lastOrder.order_number,
          data: lastOrder.data || lastOrder.created_at,
          totale: lastOrder.totale,
          status: lastOrder.status || lastOrder.shipping_status || 'In attesa'
        } : null,
        lottoId,
        unreadCount
      };
    }));

    return res.json({ success: true, conversations: enrichedConversations });
  } catch (err) {
    console.error("⚠️ Errore GET /api/admin/chats:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 5. GET /api/admin/chat/:id/messages - Get messages for a conversation
app.get('/api/admin/chat/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const messages = await dbGetMessages(id);
    return res.json({ success: true, messages });
  } catch (err) {
    console.error("⚠️ Errore GET /api/admin/chat/:id/messages:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 6. POST /api/admin/chat/respond - Admin responds to a conversation
app.post('/api/admin/chat/respond', async (req, res) => {
  try {
    const { conversation_id, message, attachment_url, attachment_type } = req.body;
    if (!conversation_id) {
      return res.status(400).json({ success: false, error: "conversation_id mancante." });
    }

    // Aggiungi messaggio admin
    const msg = await dbAddMessage(conversation_id, 'admin', message, attachment_url, attachment_type);
    
    // Cambia stato a 'Risposto'
    await dbUpdateConversationStatus(conversation_id, 'Risposto');

    return res.json({ success: true, message: msg });
  } catch (err) {
    console.error("⚠️ Errore POST /api/admin/chat/respond:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 7. POST /api/admin/chat/update-status - Update status manually (e.g. Close)
app.post('/api/admin/chat/update-status', async (req, res) => {
  try {
    const { conversation_id, stato } = req.body;
    if (!conversation_id || !stato) {
      return res.status(400).json({ success: false, error: "conversation_id o stato mancante." });
    }
    await dbUpdateConversationStatus(conversation_id, stato);
    return res.json({ success: true });
  } catch (err) {
    console.error("⚠️ Errore POST /api/admin/chat/update-status:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});


// =========================================================================
// SISTEMA TEMPORANEO DI REVISIONE E RICLASSIFICAZIONE PRODOTTI (FASE 1)
// =========================================================================
const RECLASSIFICATION_STATE_FILE = 'reclassification_state.json';
const RECLASSIFICATION_BACKUPS_FILE = 'reclassification_backups.json';

function getReclassificationBackups() {
  try {
    if (fs.existsSync(RECLASSIFICATION_BACKUPS_FILE)) {
      return JSON.parse(fs.readFileSync(RECLASSIFICATION_BACKUPS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error("⚠️ Errore lettura reclassification_backups.json:", err.message);
  }
  return [];
}

function saveReclassificationBackups(backups) {
  try {
    fs.writeFileSync(RECLASSIFICATION_BACKUPS_FILE, JSON.stringify(backups, null, 2), 'utf8');
  } catch (err) {
    console.error("⚠️ Errore scrittura reclassification_backups.json:", err.message);
  }
}

function getReclassificationState() {
  try {
    if (fs.existsSync(RECLASSIFICATION_STATE_FILE)) {
      return JSON.parse(fs.readFileSync(RECLASSIFICATION_STATE_FILE, 'utf8'));
    }
  } catch (err) {
    console.error("⚠️ Errore lettura reclassification_state.json:", err.message);
  }
  return [];
}

function saveReclassificationState(state) {
  try {
    fs.writeFileSync(RECLASSIFICATION_STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.error("⚠️ Errore scrittura reclassification_state.json:", err.message);
  }
}

async function initReclassificationState() {
  try {
    let currentState = getReclassificationState();
    const existingIds = new Set(currentState.map(item => String(item.product_id || item.legacy_id)));

    const supabase = getSupabaseClient();
    let allProducts = [];
    if (supabase) {
      try {
        allProducts = await getAllProductsFromSupabase(supabase);
      } catch (err) {
        console.warn("⚠️ [RECLASS] Errore fetch prodotti Supabase:", err.message);
      }
    }
    if (allProducts.length === 0 && fs.existsSync(LOCAL_PRODUCTS_FILE)) {
      allProducts = JSON.parse(fs.readFileSync(LOCAL_PRODUCTS_FILE, 'utf8'));
    }

    const nbaTeamNames = [
      "los angeles clippers", "boston celtics", "milwaukee bucks", "philadelphia 76ers",
      "miami heat", "new york knicks", "cleveland cavaliers", "los angeles lakers",
      "golden state warriors", "phoenix suns", "denver nuggets", "dallas mavericks"
    ];

    const nbaProducts = allProducts.filter(p => {
      const sqLower = (p.squadra || "").toLowerCase().trim();
      const catLower = (p.categoria || "").toLowerCase().trim();
      return catLower === "nba" || nbaTeamNames.includes(sqLower);
    });

    let stateUpdated = false;
    for (const prod of nbaProducts) {
      const prodId = String(prod.id || prod.legacy_id);
      if (!existingIds.has(prodId)) {
        const v = (prod.versione || "").trim();
        const s = (prod.squadra || "").trim();
        let proposedTeam = s;
        let proposedCategory = "Club";
        let proposedSection = "USA MLS";
        let proposedCountry = "USA";
        let proposedLeague = "MLS";
        let reasoning = "";

        if (/los angeles fc|lafc/i.test(v)) {
          proposedTeam = "Los Angeles FC (LAFC)";
          proposedSection = "USA MLS";
          proposedCategory = "Club";
          proposedCountry = "USA";
          proposedLeague = "MLS";
          reasoning = "Versione prodotto specifica espressamente 'Los Angeles FC'. Squadra corrispondente individuata nel catalogo: Los Angeles FC (LAFC).";
        } else if (/los angeles/i.test(v) && /clippers/i.test(s)) {
          proposedTeam = "Los Angeles FC (LAFC)";
          proposedSection = "USA MLS";
          proposedCategory = "Club";
          proposedCountry = "USA";
          proposedLeague = "MLS";
          reasoning = "Dicitura 'Los Angeles Casa' su kit MLS. Proposta associazione a 'Los Angeles FC (LAFC)'.";
        } else {
          reasoning = "Prodotto con associazione squadra NBA. Da verificare manualmente.";
        }

        currentState.push({
          product_id: prod.id,
          legacy_id: prod.legacy_id,
          nome: prod.nome || null,
          nome_finale: prod.nome_finale || `${prod.squadra} - ${prod.versione || ''}`,
          squadra_originale: prod.squadra,
          categoria_originale: prod.categoria,
          versione: prod.versione || "",
          stagione: prod.stagione || "",
          target: prod.target || "Adulto",
          prezzo: prod.prezzo || 0,
          immagine: prod.immagine || "",
          paese_originale: "USA",
          lega_originale: "NBA",
          sezione_originale: "Western Conference (NBA)",
          status: "pending_reclassification",
          note_verifica: "",
          proposta: {
            squadra_proposta: proposedTeam,
            categoria_proposta: proposedCategory,
            sezione_proposta: proposedSection,
            paese_proposto: proposedCountry,
            campionato_proposto: proposedLeague,
            motivo: reasoning
          },
          creato_il: new Date().toISOString(),
          ultimo_aggiornamento: new Date().toISOString()
        });
        stateUpdated = true;
      }
    }

    if (stateUpdated || !fs.existsSync(RECLASSIFICATION_STATE_FILE)) {
      saveReclassificationState(currentState);
      console.log(`✅ [RECLASS] Stato revisione inizializzato con ${currentState.length} prodotti.`);
    }
  } catch (err) {
    console.error("⚠️ [RECLASS] Errore inizializzazione stato revisione:", err.message);
  }
}

// GET /api/reclassification/items - Ottieni tutti gli elementi in revisione con metadati e squadre catalogo
app.get('/api/reclassification/items', async (req, res) => {
  try {
    let state = getReclassificationState();
    if (state.length === 0) {
      await initReclassificationState();
      state = getReclassificationState();
    }

    // Carica squadre dal catalogo teams per dropdown controllato senza duplicati
    const supabase = getSupabaseClient();
    let teams = [];
    if (supabase) {
      try {
        const { data: tData } = await supabase.from('teams').select('*').order('name', { ascending: true });
        if (tData) teams = tData;
      } catch (err) {}
    }
    if (teams.length === 0) {
      teams = getLocalTeams();
    }

    const availableSections = [
      'Serie A', 'Serie B', 'Premier League', 'La Liga', 'Bundesliga', 'Ligue 1',
      'USA MLS', 'Saudi Pro League', 'Brasileiro Serie A', 'Japan Series',
      'Altri Club Europei', 'Altri Club Mondo', 'Europa', 'Sud America', 'Nord America', 'Africa', 'Asia', 'Oceania'
    ];

    const availableCategories = ['Club', 'Nazionali', 'Mondiali'];

    const metrics = {
      total: state.length,
      pending: state.filter(s => s.status === 'pending_reclassification').length,
      approved: state.filter(s => s.status === 'approved' || s.status === 'approved_manual').length,
      needs_check: state.filter(s => s.status === 'needs_manual_check').length
    };

    res.json({
      success: true,
      metrics,
      items: state,
      available_teams: teams,
      available_sections: availableSections,
      available_categories: availableCategories
    });
  } catch (err) {
    console.error("⚠️ Errore GET /api/reclassification/items:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/reclassification/approve - Approva e applica la proposta di riclassificazione con snapshot di backup
app.post('/api/reclassification/approve', async (req, res) => {
  try {
    const { product_id, legacy_id, note, operatore } = req.body;
    if (!product_id && !legacy_id) {
      return res.status(400).json({ success: false, error: "Specificare product_id o legacy_id" });
    }

    const state = getReclassificationState();
    const itemIndex = state.findIndex(x => (product_id && x.product_id === product_id) || (legacy_id && x.legacy_id === legacy_id));
    if (itemIndex === -1) {
      return res.status(404).json({ success: false, error: "Elemento di revisione non trovato." });
    }

    const item = state[itemIndex];
    const proposed = item.proposta;

    // 1. CREAZIONE SNAPSHOT / BACKUP PRIMA DI MODIFICARE
    const backups = getReclassificationBackups();
    const snapshot = {
      backup_id: 'bk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      product_id: item.product_id,
      legacy_id: item.legacy_id,
      timestamp: new Date().toISOString(),
      operatore: operatore || 'Admin',
      tipo_operazione: 'APPROVE_PROPOSAL',
      note: note || '',
      dati_originali: {
        squadra: item.squadra_originale,
        categoria: item.categoria_originale,
        versione: item.versione,
        stagione: item.stagione,
        sezione: item.sezione_originale,
        paese: item.paese_originale,
        lega: item.lega_originale,
        target: item.target,
        prezzo: item.prezzo
      },
      dati_applicati: {
        squadra: proposed.squadra_proposta,
        categoria: item.categoria_originale, // preserva categoria prodotto (Kit/Fan/Player/ecc) o aggiorna squadra
        sezione: proposed.sezione_proposta,
        paese: proposed.paese_proposto,
        campionato: proposed.campionato_proposto
      }
    };
    backups.unshift(snapshot);
    saveReclassificationBackups(backups);

    // 2. APPLICAZIONE MODIFICA A SUPABASE
    const supabase = getSupabaseClient();
    if (supabase && item.product_id) {
      const { error: updateErr } = await supabase
        .from('products')
        .update({
          squadra: proposed.squadra_proposta
        })
        .eq('id', item.product_id);

      if (updateErr) {
        console.error("⚠️ Errore update prodotto su Supabase:", updateErr.message);
        throw updateErr;
      }
    }

    // Aggiorna anche local cache se presente
    if (fs.existsSync(LOCAL_PRODUCTS_FILE)) {
      try {
        const localProds = JSON.parse(fs.readFileSync(LOCAL_PRODUCTS_FILE, 'utf8'));
        const lIdx = localProds.findIndex(p => (item.product_id && p.id === item.product_id) || (item.legacy_id && p.legacy_id === item.legacy_id));
        if (lIdx !== -1) {
          localProds[lIdx].squadra = proposed.squadra_proposta;
          fs.writeFileSync(LOCAL_PRODUCTS_FILE, JSON.stringify(localProds, null, 2), 'utf8');
        }
      } catch (lErr) {}
    }

    // 3. AGGIORNA STATO REVISIONE
    item.status = 'approved';
    item.ultimo_aggiornamento = new Date().toISOString();
    item.note_verifica = note || 'Approvato con proposta automatica.';
    item.dati_finali_applicati = snapshot.dati_applicati;
    saveReclassificationState(state);

    res.json({
      success: true,
      message: `Prodotto #${item.legacy_id || item.product_id} riclassificato con successo in "${proposed.squadra_proposta}"! Snapshot di backup salvato.`,
      backup_id: snapshot.backup_id,
      item
    });
  } catch (err) {
    console.error("⚠️ Errore POST /api/reclassification/approve:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/reclassification/manual-update - Modifica manuale controllata con selezione da catalogo e backup
app.post('/api/reclassification/manual-update', async (req, res) => {
  try {
    const { product_id, legacy_id, squadra, categoria, sezione, paese, campionato, note, operatore } = req.body;
    if (!product_id && !legacy_id) {
      return res.status(400).json({ success: false, error: "Specificare product_id o legacy_id" });
    }
    if (!squadra || !squadra.trim()) {
      return res.status(400).json({ success: false, error: "Il nome della squadra è obbligatorio." });
    }

    const state = getReclassificationState();
    const itemIndex = state.findIndex(x => (product_id && x.product_id === product_id) || (legacy_id && x.legacy_id === legacy_id));
    if (itemIndex === -1) {
      return res.status(404).json({ success: false, error: "Elemento di revisione non trovato." });
    }

    const item = state[itemIndex];
    const squadraClean = squadra.trim();

    // 1. CREAZIONE SNAPSHOT / BACKUP
    const backups = getReclassificationBackups();
    const snapshot = {
      backup_id: 'bk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      product_id: item.product_id,
      legacy_id: item.legacy_id,
      timestamp: new Date().toISOString(),
      operatore: operatore || 'Admin',
      tipo_operazione: 'MANUAL_UPDATE',
      note: note || '',
      dati_originali: {
        squadra: item.squadra_originale,
        categoria: item.categoria_originale,
        versione: item.versione,
        stagione: item.stagione,
        sezione: item.sezione_originale,
        paese: item.paese_originale,
        lega: item.lega_originale,
        target: item.target,
        prezzo: item.prezzo
      },
      dati_applicati: {
        squadra: squadraClean,
        categoria: categoria || item.categoria_originale,
        sezione: sezione || item.sezione_originale,
        paese: paese || '',
        campionato: campionato || ''
      }
    };
    backups.unshift(snapshot);
    saveReclassificationBackups(backups);

    // 2. APPLICAZIONE MODIFICA A SUPABASE
    const supabase = getSupabaseClient();
    if (supabase && item.product_id) {
      const updatePayload = { squadra: squadraClean };
      if (categoria && categoria.trim()) {
        updatePayload.categoria = categoria.trim();
      }

      const { error: updateErr } = await supabase
        .from('products')
        .update(updatePayload)
        .eq('id', item.product_id);

      if (updateErr) {
        console.error("⚠️ Errore update manuale prodotto su Supabase:", updateErr.message);
        throw updateErr;
      }
    }

    // Aggiorna local cache se presente
    if (fs.existsSync(LOCAL_PRODUCTS_FILE)) {
      try {
        const localProds = JSON.parse(fs.readFileSync(LOCAL_PRODUCTS_FILE, 'utf8'));
        const lIdx = localProds.findIndex(p => (item.product_id && p.id === item.product_id) || (item.legacy_id && p.legacy_id === item.legacy_id));
        if (lIdx !== -1) {
          localProds[lIdx].squadra = squadraClean;
          if (categoria && categoria.trim()) localProds[lIdx].categoria = categoria.trim();
          fs.writeFileSync(LOCAL_PRODUCTS_FILE, JSON.stringify(localProds, null, 2), 'utf8');
        }
      } catch (lErr) {}
    }

    // 3. AGGIORNA STATO REVISIONE
    item.status = 'approved_manual';
    item.ultimo_aggiornamento = new Date().toISOString();
    item.note_verifica = note || 'Modificato manualmente e approvato.';
    item.dati_finali_applicati = snapshot.dati_applicati;
    saveReclassificationState(state);

    res.json({
      success: true,
      message: `Prodotto #${item.legacy_id || item.product_id} aggiornato con successo a "${squadraClean}"! Snapshot di backup registrato.`,
      backup_id: snapshot.backup_id,
      item
    });
  } catch (err) {
    console.error("⚠️ Errore POST /api/reclassification/manual-update:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/reclassification/mark-verify - Segna l'elemento come "Da Verificare" con motivazione
app.post('/api/reclassification/mark-verify', async (req, res) => {
  try {
    const { product_id, legacy_id, motivo, operatore } = req.body;
    if (!product_id && !legacy_id) {
      return res.status(400).json({ success: false, error: "Specificare product_id o legacy_id" });
    }

    const state = getReclassificationState();
    const itemIndex = state.findIndex(x => (product_id && x.product_id === product_id) || (legacy_id && x.legacy_id === legacy_id));
    if (itemIndex === -1) {
      return res.status(404).json({ success: false, error: "Elemento di revisione non trovato." });
    }

    const item = state[itemIndex];
    item.status = 'needs_manual_check';
    item.note_verifica = motivo || 'Segnalato per ulteriore controllo manuale.';
    item.ultimo_aggiornamento = new Date().toISOString();
    saveReclassificationState(state);

    res.json({
      success: true,
      message: `Prodotto #${item.legacy_id || item.product_id} contrassegnato come 'Da Verificare'. Nessuna modifica apportata ai dati.`,
      item
    });
  } catch (err) {
    console.error("⚠️ Errore POST /api/reclassification/mark-verify:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/reclassification/backups - Elenco di tutti gli snapshot di backup per audit e rollback
app.get('/api/reclassification/backups', (req, res) => {
  try {
    const backups = getReclassificationBackups();
    res.json({
      success: true,
      total: backups.length,
      backups
    });
  } catch (err) {
    console.error("⚠️ Errore GET /api/reclassification/backups:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/reclassification/restore-backup - Ripristina un prodotto ai valori originali salvati nello snapshot
app.post('/api/reclassification/restore-backup', async (req, res) => {
  try {
    const { backup_id } = req.body;
    if (!backup_id) {
      return res.status(400).json({ success: false, error: "Specificare backup_id" });
    }

    const backups = getReclassificationBackups();
    const bk = backups.find(b => b.backup_id === backup_id);
    if (!bk) {
      return res.status(404).json({ success: false, error: "Snapshot di backup non trovato." });
    }

    const orig = bk.dati_originali;
    const supabase = getSupabaseClient();
    if (supabase && bk.product_id) {
      const { error: updateErr } = await supabase
        .from('products')
        .update({
          squadra: orig.squadra,
          categoria: orig.categoria
        })
        .eq('id', bk.product_id);

      if (updateErr) throw updateErr;
    }

    // Aggiorna stato revisione
    const state = getReclassificationState();
    const item = state.find(x => x.product_id === bk.product_id);
    if (item) {
      item.status = 'pending_reclassification';
      item.note_verifica = `Ripristinato dal backup ${backup_id} ai valori originali.`;
      item.ultimo_aggiornamento = new Date().toISOString();
      delete item.dati_finali_applicati;
      saveReclassificationState(state);
    }

    res.json({
      success: true,
      message: `Prodotto #${bk.legacy_id || bk.product_id} ripristinato con successo ai valori originali (Squadra: ${orig.squadra}).`,
      restored_data: orig
    });
  } catch (err) {
    console.error("⚠️ Errore POST /api/reclassification/restore-backup:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// STRUMENTO DIAGNOSTICA: ARTICOLI SENZA FILTRO CATALOGO
// =========================================================================
app.get('/api/catalog/no-filter-audit', async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    let allProducts = [];
    if (supabase) {
      try {
        allProducts = await getAllProductsFromSupabase(supabase);
      } catch (err) {
        console.warn("⚠️ [NO-FILTER-AUDIT] Errore fetch prodotti Supabase:", err.message);
      }
    }
    if (allProducts.length === 0 && fs.existsSync(LOCAL_PRODUCTS_FILE)) {
      allProducts = JSON.parse(fs.readFileSync(LOCAL_PRODUCTS_FILE, 'utf8'));
    }

    const settings = getSettings();
    const filtriCatalogo = (settings && settings.filtriCatalogo) || [];
    const validFiltriNomi = filtriCatalogo
      .filter(f => (f.stato === 'attivo' || f.attivo !== false) && f.nome && f.nome.toLowerCase() !== 'tutti')
      .map(f => f.nome.trim());

    function getSuggestedFilter(p) {
      const cat = (p.categoria || "").trim().toLowerCase();
      const ver = (p.versione || "").trim().toLowerCase();
      const nome = (p.nome || "").trim().toLowerCase();
      const target = (p.target || "").trim().toLowerCase();
      const full = `${cat} ${ver} ${nome} ${target}`;

      if (cat === "player" || full.includes("versione player") || full.includes("player version")) return "Player";
      if (cat === "fan" || full.includes("fans version") || full.includes("versione fan") || full.includes("fan version")) return "Fan";
      if (cat === "retro" || full.includes("retro") || full.includes("vintage")) return "Retro";
      if (cat === "kit allenamento" || full.includes("allenamento") || full.includes("training")) return "Kit Allenamento";
      if (cat === "tuta" || full.includes("tuta") || full.includes("tracksuit") || full.includes("jackets sets")) return "Tuta";
      if (cat === "maniche lunghe" || full.includes("maniche lunghe") || full.includes("manica lunga") || full.includes("long sleeve")) return "Maniche Lunghe";
      if (cat === "smanicato" || cat === "smanicati" || full.includes("smanicato") || full.includes("smanicati") || full.includes("vest")) return "Smanicati";
      if (cat === "polo" || full.includes("polo")) return "Polo";
      if (cat === "kit" || cat === "kit bambino" || full.includes("kit") || target === "bambino") return "Kit";

      return "Da verificare";
    }

    function isProductWithoutFilter(p) {
      if (!p) return true;
      const f = p.filtro_catalogo;
      if (f === null || f === undefined) return true;
      if (Array.isArray(f) && f.length === 0) return true;
      const str = String(f).trim();
      if (str === '' || str.toLowerCase() === 'nessuno' || str.toLowerCase() === 'nessun filtro' || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined') {
        return true;
      }
      if (validFiltriNomi.length > 0) {
        const match = validFiltriNomi.some(v => v.toLowerCase() === str.toLowerCase());
        if (!match) return true;
      }
      return false;
    }

    const withoutFilterItems = [];
    const teamCount = {};
    const categoryCount = {};
    const suggestedCount = {};

    for (const p of allProducts) {
      if (isProductWithoutFilter(p)) {
        const suggested = getSuggestedFilter(p);
        const sq = (p.squadra || "Senza Squadra").trim();
        const cat = (p.categoria || "Altro").trim();

        teamCount[sq] = (teamCount[sq] || 0) + 1;
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
        suggestedCount[suggested] = (suggestedCount[suggested] || 0) + 1;

        withoutFilterItems.push({
          id: p.id,
          legacy_id: p.legacy_id !== undefined && p.legacy_id !== null ? p.legacy_id : p.id,
          squadra: p.squadra || '',
          categoria: p.categoria || '',
          versione: p.versione || '',
          nome: p.nome || p.versione || '',
          stagione: p.stagione || '',
          target: p.target || 'Adulto',
          prezzo: p.prezzo !== undefined ? Number(p.prezzo) : 23.99,
          immagine: p.immagine || '',
          filtro_catalogo: p.filtro_catalogo ? String(p.filtro_catalogo).trim() : 'Nessuno',
          filtro_suggerito: suggested
        });
      }
    }

    return res.json({
      success: true,
      total_products: allProducts.length,
      total_without_filter: withoutFilterItems.length,
      total_with_filter: allProducts.length - withoutFilterItems.length,
      teams_count: Object.keys(teamCount).length,
      categories_count: Object.keys(categoryCount).length,
      by_team: teamCount,
      by_category: categoryCount,
      by_suggested: suggestedCount,
      items: withoutFilterItems
    });
  } catch (err) {
    console.error("🔴 [NO-FILTER-AUDIT] Errore:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Catch-all per tutte le rotte API non trovate (evita di restituire l'HTML di index.html per le chiamate /api/*)
app.all('/api/*', (req, res) => {
  res.status(404).json({ success: false, error: `Endpoint API non trovato: ${req.method} ${req.path}` });
});

// Rotte esplicite per il Pannello Admin Accessori e Admin Principale
app.get(['/admin/accessori', '/admin/accessori/*'], (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'accessori', 'index.html'));
});

app.get(['/admin', '/admin/*'], (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// Fallback all routes to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  
  // Esegui la pulizia immediata dell'archivio dei lotti all'avvio del server
  try {
    console.log("=== INIZIO PULIZIA AUTOMATICA ARCHIVIO LOTTI ===");
    pulisciLottiArchivio();
    console.log("=== FINE PULIZIA AUTOMATICA ARCHIVIO LOTTI ===");
  } catch (err) {
    console.error("⚠️ Errore pulizia lotti all'avvio:", err.message);
  }
  
  // Standardizzazione automatica dei dati all'avvio
  setTimeout(async () => {
    try {
      console.log("=== CARICAMENTO IMPOSTAZIONI DA SUPABASE ALL'AVVIO ===");
      await loadSettingsFromSupabase();
    } catch (e) {
      console.error("⚠️ Errore caricamento impostazioni all'avvio:", e.message);
    }

    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      console.log("=== INIZIO STANDARDIZZAZIONE DATABASE SUPABASE ===");
      
      // 1. Leggiamo tutti i prodotti da Supabase
      let products = [];
      try {
        products = await getAllProductsFromSupabase(supabase);
      } catch (pError) {
        console.error("⚠️ [STDB] Errore caricamento prodotti via helper:", pError.message);
      }
      if (products.length > 0) {
        for (const p of products) {
          if (p.categoria === '__coupon__' || (p.categoria && p.categoria.startsWith('__'))) {
            continue;
          }
          const catNorm = normalizzaCategoria(p.categoria);
          if (p.categoria !== catNorm) {
            console.log(`[STDB] Aggiorno prodotto #${p.id} (${p.squadra || 'Senza Nome'}): '${p.categoria}' -> '${catNorm}'`);
            await supabase.from('products').update({ categoria: catNorm }).eq('id', p.id);
          }
        }
      }

      // 2. Leggiamo tutte le price_rules
      try {
        await supabase.from('price_rules').delete().like('categoria', '__%');
      } catch (e) {}

      const { data: rules, error: rError } = await supabase.from('price_rules').select('*');
      if (!rError && Array.isArray(rules)) {
        for (const r of rules) {
          if (r.categoria && r.categoria.startsWith('__')) {
            continue;
          }
          const catNorm = normalizzaCategoria(r.categoria);
          if (r.categoria !== catNorm) {
            console.log(`[STDB] Aggiorno regola: '${r.categoria}_${r.target}' -> '${catNorm}_${r.target}'`);
            await supabase.from('price_rules').delete().eq('categoria', r.categoria).eq('target', r.target);
            await supabase.from('price_rules').upsert({ categoria: catNorm, target: r.target, prezzo: r.prezzo });
          }
        }
      }
      
      console.log("=== COMPLETATO STANDARDIZZAZIONE DATABASE SUPABASE ===");
    } catch (err) {
      console.error("⚠️ Errore durante la standardizzazione automatica del database:", err.message);
    }

    // Inizializza il sistema di revisione e riclassificazione prodotti (FASE 1)
    try {
      await initReclassificationState();
    } catch (rErr) {
      console.error("⚠️ Errore inizializzazione modulo revisione riclassificazione:", rErr.message);
    }
  }, 3000);
});
