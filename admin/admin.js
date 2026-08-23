// admin/admin.js
// -------------------------------------------------------------
// Nuovo Pannello Amministratore Funzionante per Elite Tournament
// -------------------------------------------------------------

// Stato globale dell'applicazione
let prodotti = [];
let squadreCatalogo = [];
let ordini = [];
let currentActiveTab = 'dashboard';
let orderSelectionMode = null; // null | 'profitSplit'
let ordiniSearchQuery = '';

// Struttura centralizzata di alias facilmente estendibile per tradurre varianti internazionali nel nome ufficiale
const TEAM_ALIASES = {
    "greece": "Grecia",
    "wales": "Galles",
    "welsh": "Galles",
    "republic of ireland": "Irlanda",
    "ireland": "Irlanda",
    "north ireland": "Irlanda del Nord",
    "northern ireland": "Irlanda del Nord",
    "saudi arabia": "Arabia Saudita",
    "egypt": "Egitto",
    "czech republic": "Repubblica Ceca",
    "south africa": "Sudafrica",
    "curacao": "Curaçao",
    "jamaica": "Giamaica",
    "palestine": "Palestina",
    "hungary": "Ungheria",
    "soviet union": "Unione Sovietica",
    "ussr": "Unione Sovietica",
    
    // Altre nazioni ed alias internazionali
    "italy": "Italia",
    "germany": "Germania",
    "france": "Francia",
    "spain": "Spagna",
    "england": "Inghilterra",
    "netherlands": "Paesi Bassi",
    "holland": "Paesi Bassi",
    "belgium": "Belgio",
    "brazil": "Brasile",
    "argentina": "Argentina",
    "portugal": "Portogallo",
    "croatia": "Croazia",
    "sweden": "Svezia",
    "switzerland": "Svizzera",
    "morocco": "Marocco",
    "japan": "Giappone",
    "south korea": "Corea del Sud",
    "uruguay": "Uruguay",
    "colombia": "Colombia",
    "mexico": "Messico",
    "usa": "Stati Uniti",
    "united states": "Stati Uniti",
    "turkey": "Turchia",
    "austria": "Austria",
    "poland": "Polonia",
    "denmark": "Danimarca",
    "scotland": "Scozia",
    "ukraine": "Ucraina"
};

/**
 * Funzione di sanitizzazione HTML per prevenire corruzioni di attributi e XSS
 */
function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
}
window.escapeHtml = escapeHtml;

/**
 * Pulisce una stringa rimuovendo accenti, diacritici, punteggiatura e stop-words calcistiche.
 */
function pulisciStringaSquadra(str) {
    if (!str) return "";
    let s = str.toString().trim().toLowerCase();
    s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    s = s.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ");
    const stopwords = ["fc", "cf", "ac", "as", "afc", "ss", "sc", "us", "asd", "fk", "club", "calcio"];
    let words = s.split(/\s+/).filter(w => w.length > 0 && !stopwords.includes(w));
    return words.join(" ");
}

/**
 * Mappatura centralizzata di alias internazionali e abbreviazioni comuni
 * verso i nomi ufficiali delle squadre presenti nel database del sito.
 */
const ALIAS_SQUADRE_MAP = {
    // Premier League
    "man utd": "Manchester United",
    "manchester utd": "Manchester United",
    "man utd fc": "Manchester United",
    "manchester utd fc": "Manchester United",
    "manchester united fc": "Manchester United",
    "man city": "Manchester City",
    "mancity": "Manchester City",
    "manchester city fc": "Manchester City",
    "spurs": "Tottenham Hotspur",
    "tottenham": "Tottenham Hotspur",
    "arsenal fc": "Arsenal F.C.",
    "arsenal": "Arsenal F.C.",
    "chelsea fc": "Chelsea F.C.",
    "chelsea": "Chelsea F.C.",
    "liverpool fc": "Liverpool F.C.",
    "liverpool": "Liverpool F.C.",
    "aston villa": "Aston Villa",
    "newcastle": "Newcastle United",
    "newcastle united": "Newcastle United",

    // Serie A
    "inter milan": "Inter",
    "internazionale": "Inter",
    "fc internazionale": "Inter",
    "juve": "Juventus",
    "juventus fc": "Juventus",
    "milan": "AC Milan",
    "ac milan": "AC Milan",
    "roma": "AS Roma",
    "as roma": "AS Roma",
    "lazio": "SS Lazio",
    "ss lazio": "SS Lazio",
    "napoli": "SSC Napoli",
    "ssc napoli": "SSC Napoli",

    // La Liga
    "barcelona": "Barcellona",
    "barca": "Barcellona",
    "barça": "Barcellona",
    "fc barcelona": "Barcellona",
    "real madrid": "Real Madrid",
    "real madrid cf": "Real Madrid",
    "atletico madrid": "Atletico Madrid",
    "atletico de madrid": "Atletico Madrid",
    "sevilla": "Siviglia",
    "girona fc": "Girona F.C.",

    // Bundesliga
    "fc bayern": "Bayern Monaco",
    "bayern": "Bayern Monaco",
    "bayern munich": "Bayern Monaco",
    "bayern munchen": "Bayern Monaco",
    "bayern munchen fc": "Bayern Monaco",
    "dortmund": "Borussia Dortmund",
    "bvb": "Borussia Dortmund",
    "borussia dortmund": "Borussia Dortmund",
    "leverkusen": "Bayer Leverkusen",
    "bayer leverkusen": "Bayer Leverkusen",
    "leipzig": "Lipsia",
    "rb leipzig": "Lipsia",
    "frankfurt": "Eintracht Francoforte",

    // Ligue 1
    "psg": "Paris Saint-Germain",
    "paris sg": "Paris Saint-Germain",
    "paris saint germain": "Paris Saint-Germain",
    "marseille": "Olympique Marsiglia",
    "marsiglia": "Olympique Marsiglia",
    "olympique marseille": "Olympique Marsiglia",
    "olympique marsiglia": "Olympique Marsiglia",
    "monaco": "AS Monaco",
    "as monaco": "AS Monaco",

    // Nazionali (alias in varie lingue)
    "italy": "Italia",
    "france": "Francia",
    "germany": "Germania",
    "spain": "Spagna",
    "espana": "Spagna",
    "england": "Inghilterra",
    "netherlands": "Paesi Bassi",
    "holland": "Paesi Bassi",
    "belgium": "Belgio",
    "brazil": "Brasile",
    "brasil": "Brasile",
    "argentina": "Argentina",
    "portugal": "Portogallo",
    "croatia": "Croazia",
    "sweden": "Svezia",
    "switzerland": "Svizzera",
    "morocco": "Marocco",
    "japan": "Giappone",
    "south korea": "Corea del Sud",
    "uruguay": "Uruguay",
    "colombia": "Colombia",
    "mexico": "Messico",
    "usa": "Stati Uniti",
    "united states": "Stati Uniti",
    "turkey": "Turchia",
    "austria": "Austria",
    "poland": "Polonia",
    "denmark": "Danimarca",
    "scotland": "Scozia",
    "ukraine": "Ucraina",
    "greece": "Grecia",
    "wales": "Galles",
    "welsh": "Galles",
    "ireland": "Irlanda",
    "saudi arabia": "Arabia Saudita",
    "egypt": "Egitto",
    "czech republic": "Repubblica Ceca",
    "south africa": "Sudafrica",
    "peru": "Perù",
    "jamaica": "Giamaica",
    "hungary": "Ungheria"
};

/**
 * Cerca una squadra dal database ufficiale delle squadre del sito (squadreCatalogo)
 * basandosi sul testo di input fornito (es. p.squadra, p.name o p.alt_text).
 * Restituisce l'oggetto squadra completo dal database o null se non trovata.
 */
function trovaSquadraInDatabase(candidateText, dbSquadre) {
    if (!candidateText || typeof candidateText !== 'string') return null;
    const textRaw = candidateText.trim();
    if (!textRaw) return null;

    const textClean = pulisciStringaSquadra(textRaw);
    if (!textClean) return null;

    const listaTeams = Array.isArray(dbSquadre) && dbSquadre.length > 0 ? dbSquadre : squadreCatalogo;
    if (!Array.isArray(listaTeams) || listaTeams.length === 0) return null;

    const findByOfficialName = (targetName) => {
        if (!targetName) return null;
        const targetClean = pulisciStringaSquadra(targetName);
        return listaTeams.find(t => t.name && (
            t.name.toLowerCase() === targetName.toLowerCase() ||
            pulisciStringaSquadra(t.name) === targetClean
        ));
    };

    // 1. Controllo corrispondenza esatta o alias sul candidato completo
    for (const t of listaTeams) {
        if (t.name && t.name.trim().toLowerCase() === textRaw.toLowerCase()) {
            return t;
        }
        if (t.name && pulisciStringaSquadra(t.name) === textClean) {
            return t;
        }
    }

    if (ALIAS_SQUADRE_MAP[textClean]) {
        const dbMatch = findByOfficialName(ALIAS_SQUADRE_MAP[textClean]);
        if (dbMatch) return dbMatch;
    }

    // 2. Controllo se un alias o nome squadra del DB è contenuto nel testo candidato
    const aliasEntries = Object.entries(ALIAS_SQUADRE_MAP).sort((a, b) => b[0].length - a[0].length);
    for (const [aliasKey, officialName] of aliasEntries) {
        const aliasClean = pulisciStringaSquadra(aliasKey);
        if (aliasClean && aliasClean.length >= 3) {
            const regex = new RegExp("\\b" + aliasClean.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "\\b", "i");
            if (regex.test(textClean)) {
                const dbMatch = findByOfficialName(officialName);
                if (dbMatch) return dbMatch;
            }
        }
    }

    const dbTeamsSorted = [...listaTeams].sort((a, b) => {
        const lenA = pulisciStringaSquadra(a.name || "").length;
        const lenB = pulisciStringaSquadra(b.name || "").length;
        return lenB - lenA;
    });

    for (const t of dbTeamsSorted) {
        if (!t.name) continue;
        const tClean = pulisciStringaSquadra(t.name);
        if (tClean && tClean.length >= 3) {
            const regex = new RegExp("\\b" + tClean.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "\\b", "i");
            if (regex.test(textClean)) {
                return t;
            }
        }
    }

    return null;
}

/**
 * Estrae ed identifica la squadra ed il campionato dal JSON rispettando le priorità:
 * 1. Campo `squadra` (p.squadra, p.team, p.product_team, p.club, p.squadra_nome)
 * 2. Nome prodotto (p.name, p.title, p.nome, p.product_title, p.product_name)
 * 3. Alt text (p.alt_text, p.image_alt)
 * 
 * Mai utilizzare il nome del file. Mai utilizzare l'URL.
 */
function estraiEIdentificaSquadra(p, dbSquadre) {
    if (!p) {
        return {
            dbTeam: null,
            squadra: 'SQUADRA NON RICONOSCIUTA',
            campionato: 'SQUADRA NON RICONOSCIUTA'
        };
    }

    const listaTeams = Array.isArray(dbSquadre) && dbSquadre.length > 0 ? dbSquadre : squadreCatalogo;

    // Priorità 1: Campo squadra esplicito
    const rawSquadra = p.squadra || p.team || p.product_team || p.club || p.squadra_nome;
    if (rawSquadra && String(rawSquadra).trim() !== '') {
        const found = trovaSquadraInDatabase(String(rawSquadra), listaTeams);
        if (found) {
            return {
                dbTeam: found,
                squadra: found.name,
                campionato: found.sezione || found.campionato || found.categoria || 'SQUADRA NON RICONOSCIUTA'
            };
        }
    }

    // Priorità 2: Nome prodotto
    const rawName = p.name || p.title || p.nome || p.product_title || p.product_name;
    if (rawName && String(rawName).trim() !== '') {
        const found = trovaSquadraInDatabase(String(rawName), listaTeams);
        if (found) {
            return {
                dbTeam: found,
                squadra: found.name,
                campionato: found.sezione || found.campionato || found.categoria || 'SQUADRA NON RICONOSCIUTA'
            };
        }
    }

    // Priorità 3: Alt text
    const rawAlt = p.alt_text || p.image_alt;
    if (rawAlt && String(rawAlt).trim() !== '') {
        const found = trovaSquadraInDatabase(String(rawAlt), listaTeams);
        if (found) {
            return {
                dbTeam: found,
                squadra: found.name,
                campionato: found.sezione || found.campionato || found.categoria || 'SQUADRA NON RICONOSCIUTA'
            };
        }
    }

    // FALLBACK: Squadra NON trovata nel database del sito
    return {
        dbTeam: null,
        squadra: 'SQUADRA NON RICONOSCIUTA',
        campionato: 'SQUADRA NON RICONOSCIUTA'
    };
}

function risolviAliasSquadra(nomeInput, listaSquadreEsistenti) {
    if (!nomeInput) return null;
    const dbMatch = trovaSquadraInDatabase(nomeInput.toString(), squadreCatalogo);
    if (dbMatch) return dbMatch.name;
    return null;
}

function parseFlexibleDecimal(valStr) {
    if (valStr === undefined || valStr === null) return 0;
    let clean = valStr.toString().replace('€', '').replace('$', '').replace(/\s/g, '').trim();
    if (!clean) return 0;
    
    // Check if it has both . and ,
    if (clean.includes(',') && clean.includes('.')) {
        if (clean.indexOf(',') > clean.indexOf('.')) {
            // "1.234,56"
            clean = clean.replace(/\./g, '').replace(',', '.');
        } else {
            // "1,234.56"
            clean = clean.replace(/,/g, '');
        }
    } else if (clean.includes(',')) {
        // "12,50" -> "12.50"
        clean = clean.replace(',', '.');
    }
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
}

function normalizzaCategoria(categoria) {
    if (!categoria) return 'Kit';
    const rawStr = categoria.toString().trim();
    const lower = rawStr.toLowerCase();
    
    if (lower === '__coupon__' || rawStr === '__coupon__' || lower.startsWith('__')) {
        return '__coupon__';
    }

    const rules = typeof getRegoleImportazioneJson === 'function' ? getRegoleImportazioneJson() : null;
    if (Array.isArray(rules) && rules.length > 0) {
        // Match esatto
        const matchEsatto = rules.find(r => (r.valore_json || '').toString().trim().toLowerCase() === lower);
        if (matchEsatto && matchEsatto.categoria) {
            return matchEsatto.categoria;
        }
        // Match parziale (contenimento)
        const matchParziale = rules.find(r => {
            const v = (r.valore_json || '').toString().trim().toLowerCase();
            return v && (lower.includes(v) || v.includes(lower));
        });
        if (matchParziale && matchParziale.categoria) {
            return matchParziale.categoria;
        }
    }

    if (window.appSettings && Array.isArray(window.appSettings.categorie) && window.appSettings.categorie.length > 0) {
        const matchCat = window.appSettings.categorie.find(c => (c.nome || '').toString().trim().toLowerCase() === lower);
        if (matchCat && matchCat.nome) {
            return matchCat.nome;
        }
        const matchPartialCat = window.appSettings.categorie.find(c => {
            const cLower = (c.nome || '').toString().trim().toLowerCase();
            return cLower && (lower.includes(cLower) || cLower.includes(lower));
        });
        if (matchPartialCat && matchPartialCat.nome) {
            return matchPartialCat.nome;
        }
    }
    
    return rawStr || 'Kit';
}

function normalizzaNomeSquadra(nomeInput, listaSquadreEsistenti) {
    if (!nomeInput) return "";
    const cleanInput = nomeInput.trim();
    if (!listaSquadreEsistenti || listaSquadreEsistenti.length === 0) {
        return cleanInput;
    }

    // Risoluzione tramite il sistema di alias centralizzato
    const aliasResolved = risolviAliasSquadra(cleanInput, listaSquadreEsistenti);
    if (aliasResolved) {
        return aliasResolved;
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

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verifica autenticazione tramite auth.js
    try {
        if (typeof window.checkAuth === 'function') {
            const user = await window.checkAuth();
            if (user) {
                const emailEl = document.getElementById('user-email-display');
                if (emailEl) {
                    emailEl.innerText = user.email;
                }
            }
        }
    } catch (error) {
        console.error("Errore durante la verifica dell'autenticazione:", error);
    }

    // 2. Inizializza gli event listeners per i filtri e la ricerca
    inizializzaFiltri();

    // 3. Inizializza l'handler del form di aggiunta/modifica prodotto
    inizializzaFormProdotto();

    // 4. Inizializza l'azione del lotto
    inizializzaLottoAction();

    // 5. Carica i prodotti e le statistiche
    await caricaDati();

    // 6. Imposta la tab iniziale
    switchTab('dashboard');
});

/**
 * Gestisce l'inizializzazione degli event listeners per i filtri e la ricerca
 */
function inizializzaFiltri() {
    const filterSquadra = document.getElementById('filter-squadra');
    const filterCategoria = document.getElementById('filter-categoria');
    const filterStagione = document.getElementById('filter-stagione');
    const filterSenzaFornitore = document.getElementById('filter-senza-fornitore');

    const applyFilters = () => {
        currentProductsPage = 1;
        renderProdotti();
    };

    if (filterSquadra) filterSquadra.addEventListener('change', applyFilters);
    if (filterCategoria) filterCategoria.addEventListener('change', applyFilters);
    if (filterStagione) filterStagione.addEventListener('change', applyFilters);
    if (filterSenzaFornitore) filterSenzaFornitore.addEventListener('change', applyFilters);

    // Inizializza l'event delegation per la tabella prodotti
    inizializzaDelegazioneEventiTabellaProdotti();
}

/**
 * Gestisce l'inizializzazione del form di salvataggio prodotto
 */
function inizializzaFormProdotto() {
    const form = document.getElementById('add-product-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await salvaProdotto();
        });
    }

    // Inizializza eventi per Squadra (Searchable Select)
    const inputSquadra = document.getElementById('form-squadra');
    if (inputSquadra) {
        inputSquadra.addEventListener('focus', () => {
            mostraSquadraDropdown();
        });
        inputSquadra.addEventListener('input', (e) => {
            renderSquadraDropdown(e.target.value);
        });
        
        // Chiudi se clicca all'esterno
        document.addEventListener('click', (e) => {
            const container = document.getElementById('container-squadra');
            if (container && !container.contains(e.target)) {
                nascondiSquadraDropdown();
            }
        });
    }

    // Inizializza eventi per Categoria e Target (Prezzo automatico)
    const selectCategoria = document.getElementById('form-categoria');
    const selectTarget = document.getElementById('form-target');

    
    function aggiornaPrezzoConsigliato() {
        if (!selectCategoria) return;
        const cat = selectCategoria.value;
        const tgt = selectTarget ? selectTarget.value : 'Adulto';
        const prezzoInput = document.getElementById('form-prezzo');
        if (prezzoInput) {
            prezzoInput.value = getPrezzoVendita(cat, tgt);
        }
    }

    if (selectCategoria) {
        selectCategoria.addEventListener('change', aggiornaPrezzoConsigliato);
    }
    if (selectTarget) {
        selectTarget.addEventListener('change', aggiornaPrezzoConsigliato);
    }

    // Inizializza eventi per Versione (Select modificabile)
    const selectVersione = document.getElementById('form-versione-select');
    const inputVersione = document.getElementById('form-versione');
    if (selectVersione && inputVersione) {
        selectVersione.addEventListener('change', () => {
            if (selectVersione.value === 'custom') {
                inputVersione.value = "";
                inputVersione.classList.remove('hidden');
                inputVersione.required = true;
                inputVersione.focus();
            } else {
                inputVersione.value = selectVersione.value;
                inputVersione.classList.add('hidden');
                inputVersione.required = false;
            }
            aggiornaEditorImmagine();
        });
    }

    // Trigger per l'aggiornamento dell'anteprima real-time
    const inputsDaTracciare = [
        'form-squadra', 'form-categoria', 'form-target', 'form-stagione', 'form-versione',
        'form-prezzo', 'form-immagine', 'editor-zoom', 'editor-x', 'editor-y'
    ];
    inputsDaTracciare.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', aggiornaEditorImmagine);
            el.addEventListener('change', aggiornaEditorImmagine);
        }
    });
    
    // Aggancia i pulsanti dell'editor immagini
    const btnRipristina = document.getElementById('btn-ripristina-immagine');
    if (btnRipristina) {
        btnRipristina.addEventListener('click', ripristinaImmagine);
    }
    const btnAnteprimaSito = document.getElementById('btn-anteprima-sito');
    if (btnAnteprimaSito) {
        btnAnteprimaSito.addEventListener('click', apriAnteprimaSito);
    }
}

/**
 * Funzioni per gestire il dropdown delle squadre (Searchable Select)
 */
function renderSquadraDropdown(filtro = '') {
    const dropdown = document.getElementById('squadra-dropdown');
    if (!dropdown) return;

    // Estrai squadre uniche dal catalogo centrale delle squadre
    const squadreUniche = squadreCatalogo.length > 0
        ? [...new Set(squadreCatalogo.map(t => t.name).filter(Boolean))].sort()
        : [...new Set(prodotti.map(p => p.squadra).filter(Boolean))].sort();
    
    const term = filtro.toLowerCase().trim();
    const filtrate = term ? squadreUniche.filter(s => s.toLowerCase().includes(term)) : squadreUniche;

    if (filtrate.length === 0) {
        dropdown.innerHTML = `<div class="px-4 py-2.5 text-xs text-slate-400">Nessuna squadra trovata. Premi Invio o clicca fuori per usare il testo inserito.</div>`;
    } else {
        dropdown.innerHTML = filtrate.map(s => `
            <div class="px-4 py-2.5 hover:bg-slate-50 cursor-pointer text-sm text-slate-700 transition-colors" onclick="selezionaSquadra('${s.replace(/'/g, "\\'")}')">
                ${s}
            </div>
        `).join('');
    }
}

function selezionaSquadra(nome) {
    const input = document.getElementById('form-squadra');
    if (input) {
        input.value = nome;
    }
    nascondiSquadraDropdown();
}

function mostraSquadraDropdown() {
    const dropdown = document.getElementById('squadra-dropdown');
    const input = document.getElementById('form-squadra');
    if (dropdown && input) {
        renderSquadraDropdown(input.value);
        dropdown.classList.remove('hidden');
    }
}

function nascondiSquadraDropdown() {
    const dropdown = document.getElementById('squadra-dropdown');
    if (dropdown) {
        dropdown.classList.add('hidden');
    }
}

// Espone a window per click in HTML dinamico
window.selezionaSquadra = selezionaSquadra;

/**
 * Gestisce l'azione del lotto corrente
 */
function inizializzaLottoAction() {
    const btnLotto = document.getElementById('btn-lotto-effettuato');
    if (btnLotto) {
        btnLotto.addEventListener('click', async () => {
            console.log("[FRONTEND] Click su 'Segna come Ordine Effettuato' rilevato. Avvio procedura di archiviazione.");
            try {
                console.log("[FRONTEND] Invio richiesta POST a /api/lotto/archive...");
                const response = await fetch('/api/lotto/archive', { method: 'POST' });
                console.log("[FRONTEND] Risposta ricevuta con stato HTTP:", response.status);
                const result = await response.json();
                console.log("[FRONTEND] Dettaglio risposta del server:", JSON.stringify(result, null, 2));
                
                if (result.success) {
                    showToast("Lotto archiviato con successo!", "success");
                    console.log("[FRONTEND] Archiviazione riuscita. Lotto dopo il reset ricevuto dal server:", JSON.stringify(result.lotto, null, 2));
                    
                    // Azzeramento immediato lato client
                    const statsLotto = document.getElementById('stats-lotto-corrente');
                    if (statsLotto) {
                        statsLotto.innerText = "0 art.";
                    }
                    const elArticoli = document.getElementById('lotto-articoli');
                    const elCostoProd = document.getElementById('lotto-costo-prodotti');
                    const elSpedizione = document.getElementById('lotto-spedizione');
                    const elCostoPers = document.getElementById('lotto-costo-personalizzazioni');
                    const elCostoTotale = document.getElementById('lotto-costo-totale');

                    if (elArticoli) elArticoli.innerText = '0';
                    if (elCostoProd) elCostoProd.innerText = '$ 0.00';
                    if (elSpedizione) elSpedizione.innerText = '$ 4.00';
                    if (elCostoPers) elCostoPers.innerText = '$ 0.00';
                    if (elCostoTotale) elCostoTotale.innerText = '$ 0.00';

                    await caricaLotto();
                    await caricaOrdini();
                    await caricaCronologiaLotti();
                    console.log("[FRONTEND] Eseguite caricaLotto(), caricaOrdini() e caricaCronologiaLotti() per aggiornare l'interfaccia con i dati freschi.");
                } else {
                    console.error("[FRONTEND] Il server ha risposto con errore:", result.error);
                    showToast("Errore durante l'archiviazione: " + result.error, "error");
                }
            } catch (err) {
                console.error("[FRONTEND] Eccezione riscontrata durante l'archiviazione del lotto:", err);
                showToast("Errore di connessione.", "error");
            }
        });
    }
}

async function caricaSquadre() {
    try {
        const res = await fetch('/api/teams');
        if (res.ok) {
            const data = await res.json();
            if (data && data.success) {
                squadreCatalogo = data.teams || [];
            }
        }
    } catch (e) {
        console.error("Errore durante il caricamento delle squadre centrali:", e);
    }
}

function aggiornaCategorieSelezionabili() {
    const catSelect = document.getElementById('add-team-categoria');
    if (!catSelect) return;
    
    const prevVal = catSelect.value;
    
    // Genera l'elenco unico delle categorie presenti in squadreCatalogo
    const categories = [...new Set(squadreCatalogo.map(t => t.categoria).filter(Boolean))].sort();
    
    let html = "";
    categories.forEach(cat => {
        html += `<option value="${cat}">${cat}</option>`;
    });
    html += `<option value="custom">-- Scrivi categoria personalizzata --</option>`;
    
    catSelect.innerHTML = html;
    
    if (prevVal && (categories.includes(prevVal) || prevVal === 'custom')) {
        catSelect.value = prevVal;
    } else if (categories.length > 0) {
        catSelect.value = categories[0];
    } else {
        catSelect.value = "custom";
    }
    
    aggiornaSezioniSelezionabili();
}
window.aggiornaCategorieSelezionabili = aggiornaCategorieSelezionabili;

function aggiornaSezioniSelezionabili() {
    const catSelect = document.getElementById('add-team-categoria');
    const sezSelect = document.getElementById('add-team-sezione');
    const catContainer = document.getElementById('custom-categoria-container');
    const customCatInput = document.getElementById('add-team-categoria-custom');
    if (!catSelect || !sezSelect) return;
    
    const cat = catSelect.value;
    
    if (cat === 'custom') {
        if (catContainer) catContainer.classList.remove('hidden');
    } else {
        if (catContainer) catContainer.classList.add('hidden');
        if (customCatInput) customCatInput.value = "";
    }

    // Estrae dinamicamente le sezioni per la categoria selezionata
    let sezioni = [];
    if (cat !== 'custom') {
        sezioni = [...new Set(squadreCatalogo.filter(t => t.categoria === cat).map(t => t.sezione).filter(Boolean))].sort();
    }
    
    let html = "";
    sezioni.forEach(sez => {
        html += `<option value="${sez}">${sez}</option>`;
    });
    html += `<option value="custom">-- Scrivi sezione personalizzata --</option>`;
    
    sezSelect.innerHTML = html;
    gestisciNuovaSezioneScelta();
}
window.aggiornaSezioniSelezionabili = aggiornaSezioniSelezionabili;

function gestisciNuovaSezioneScelta() {
    const sezSelect = document.getElementById('add-team-sezione');
    const container = document.getElementById('custom-sezione-container');
    if (!sezSelect || !container) return;
    
    if (sezSelect.value === 'custom') {
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
        const customInput = document.getElementById('add-team-sezione-custom');
        if (customInput) customInput.value = "";
    }
}
window.gestisciNuovaSezioneScelta = gestisciNuovaSezioneScelta;

async function creaSquadraDaForm() {
    const nameInput = document.getElementById('add-team-name');
    const catSelect = document.getElementById('add-team-categoria');
    const sezSelect = document.getElementById('add-team-sezione');
    const customInput = document.getElementById('add-team-sezione-custom');
    const customCatInput = document.getElementById('add-team-categoria-custom');
    const catContainer = document.getElementById('custom-categoria-container');
    if (!nameInput || !catSelect || !sezSelect) return;

    const name = nameInput.value.trim();
    let categoria = catSelect.value;
    let sezione = sezSelect.value;

    if (categoria === 'custom') {
        if (customCatInput) {
            categoria = customCatInput.value.trim();
        }
    }

    if (sezione === 'custom') {
        if (customInput) {
            sezione = customInput.value.trim();
        }
    }

    if (!name) {
        showToast("Per favore, inserisci il nome della squadra.", "error");
        return;
    }
    if (!categoria) {
        showToast("Per favore, inserisci o seleziona una categoria.", "error");
        return;
    }
    if (!sezione) {
        showToast("Per favore, inserisci o seleziona una sezione.", "error");
        return;
    }

    try {
        const res = await fetch('/api/teams', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, categoria, sezione })
        });

        const data = await res.json();
        if (data && data.success) {
            showToast(`Squadra "${name}" (${categoria} - ${sezione}) aggiunta con successo!`, "success");
            nameInput.value = "";
            if (customInput) customInput.value = "";
            if (customCatInput) customCatInput.value = "";
            if (catSelect) catSelect.selectedIndex = 0;
            if (catContainer) catContainer.classList.add('hidden');
            
            // Ricarica tutte le squadre e aggiorna la UI
            await caricaSquadre();
            aggiornaCategorieSelezionabili();
            aggiornaSquadreDropdown();
            generaOpzioniFiltri();
        } else {
            showToast("Errore aggiunta squadra: " + (data.error || "errore sconosciuto"), "error");
        }
    } catch (e) {
        console.error("Errore durante l'aggiunta della squadra:", e);
        showToast("Errore di connessione.", "error");
    }
}
window.creaSquadraDaForm = creaSquadraDaForm;

/**
 * Carica tutti i prodotti da Supabase e aggiorna l'UI
 */
async function caricaDati() {
    await caricaSquadre();
    if (typeof aggiornaCategorieSelezionabili === 'function') {
        aggiornaCategorieSelezionabili();
    }
    // Carica impostazioni all'avvio per valorizzare i default e le opzioni
    if (typeof caricaSettings === 'function') {
        await caricaSettings();
    }
    try {
        const startTime = Date.now();
        const supabase = await window.getSupabaseClient();
        
        let allProductsRaw = [];
        let rangeStart = 0;
        const chunkSize = 1000;
        let hasMore = true;
        let batchIndex = 1;
        
        while (hasMore) {
            const rangeEnd = rangeStart + chunkSize - 1;
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('legacy_id', { ascending: true })
                .range(rangeStart, rangeEnd);
            
            if (error) {
                console.warn("Errore caricamento prodotti nel batch " + batchIndex + ":", error);
                throw error;
            }
            
            if (data && data.length > 0) {
                console.log(`Batch ${batchIndex} caricato: ${data.length} prodotti (Range: ${rangeStart}-${rangeEnd})`);
                allProductsRaw = allProductsRaw.concat(data);
                
                if (data.length < chunkSize) {
                    hasMore = false;
                } else {
                    rangeStart += chunkSize;
                    batchIndex++;
                }
            } else {
                hasMore = false;
            }
        }
        
        const elapsed = Date.now() - startTime;
        console.log(`Caricamento completato con successo in ${elapsed}ms`);
        console.log("Totale prodotti caricati da Supabase:", allProductsRaw.length);
        console.log(allProductsRaw);
        
        prodotti = allProductsRaw.map(p => ({
            id: p.id,
            legacy_id: p.legacy_id !== undefined && p.legacy_id !== null ? p.legacy_id : p.id,
            squadra: p.squadra || '',
            categoria: p.categoria || '',
            versione: p.versione || '',
            stagione: p.stagione || '',
            prezzo: p.prezzo !== undefined ? Number(p.prezzo) : 23.99,
            prezzo_fornitore: p.prezzo_fornitore !== undefined && p.prezzo_fornitore !== null && p.prezzo_fornitore !== "" ? Number(p.prezzo_fornitore) : null,
            immagine: p.immagine || '',
            target: p.target || 'Adulto',
            nome: p.nome || '',
            filtro_catalogo: p.filtro_catalogo || '',
            tag: p.tag || '',
            tipo: p.tipo || ''
        }));
        console.log("Prodotti salvati nell'array locale:", prodotti.length);
    } catch (err) {
        console.error("Chiamata a Supabase fallita o interrotta:", err);
        if (err && err.code) {
            console.log("SUPABASE ERROR CODE:", err.code);
            console.log("SUPABASE ERROR MESSAGE:", err.message);
            console.log("SUPABASE ERROR DETAILS:", err.details);
            console.log("SUPABASE ERROR HINT:", err.hint);
        }
        prodotti = [];
    }

    // Popola le opzioni dinamiche per i select dei filtri
    generaOpzioniFiltri();

    // Aggiorna le statistiche della dashboard
    aggiornaStatisticheDashboard();

    // Renderizza i prodotti in tabella
    renderProdotti();

    // Carica le info del lotto corrente
    await caricaLotto();

    // Carica tutti gli ordini registrati
    await caricaOrdini();

    // Carica la suddivisione profitto e allinea i flussi finanziari
    if (typeof caricaSuddivisioneConti === 'function') {
        await caricaSuddivisioneConti();
    }

    // Carica la cronologia dei lotti archiviati
    await caricaCronologiaLotti();
}

/**
 * Carica lo stato del lotto dall'API
 */
async function caricaLotto() {
    try {
        const response = await fetch('/api/lotto');
        if (response.ok) {
            const result = await response.json();
            if (result && result.success && result.lotto) {
                const lotto = result.lotto;
                window.currentLottoData = lotto;
                
                // Aggiorna dashboard card
                const statsLotto = document.getElementById('stats-lotto-corrente');
                if (statsLotto) {
                    statsLotto.innerText = `${lotto.numero_totale_articoli || 0} art.`;
                }

                const statsLottoCosto = document.getElementById('stats-lotto-costo');
                if (statsLottoCosto) {
                    const costComplessivo = Number(lotto.costo_fornitore_usd || lotto.costo_complessivo_lotto_usd || 0);
                    statsLottoCosto.innerText = `$ ${costComplessivo.toFixed(2)}`;
                }

                // Aggiorna sezione Lotto
                const elArticoli = document.getElementById('lotto-articoli');
                const elCostoProd = document.getElementById('lotto-costo-prodotti');
                const elSpedizione = document.getElementById('lotto-spedizione');
                const elCostoPers = document.getElementById('lotto-costo-personalizzazioni');
                const elCostoFornitoreUsd = document.getElementById('lotto-costo-fornitore-usd');
                const elAlibabaFeeUsd = document.getElementById('lotto-alibaba-fee-usd');
                const elCostoTotale = document.getElementById('lotto-costo-totale');

                if (elArticoli) elArticoli.innerText = lotto.numero_totale_articoli || 0;
                const costPers = Number(lotto.costo_totale_personalizzazioni_usd || 0);
                const costProdCombined = Number(lotto.costo_totale_prodotti_usd || 0);
                const costCompletiniOnly = Math.max(0, costProdCombined - costPers);
                const costoFornitoreUsd = Number(lotto.costo_fornitore_usd || lotto.costo_complessivo_lotto_usd || 0);
                const alibabaFeeUsd = Number(lotto.alibaba_fee_usd !== undefined ? lotto.alibaba_fee_usd : (costoFornitoreUsd * 0.03));
                const costoTotaleRealeUsd = Number(lotto.costo_totale_reale_lotto_usd || (costoFornitoreUsd + alibabaFeeUsd));
                
                if (elCostoProd) elCostoProd.innerText = `$ ${costCompletiniOnly.toFixed(2)}`;
                if (elSpedizione) elSpedizione.innerText = `$ ${Number(lotto.spedizione_corrente_usd || 0).toFixed(2)}`;
                if (elCostoPers) elCostoPers.innerText = `$ ${costPers.toFixed(2)}`;
                if (elCostoFornitoreUsd) elCostoFornitoreUsd.innerText = `$ ${costoFornitoreUsd.toFixed(2)}`;
                if (elAlibabaFeeUsd) elAlibabaFeeUsd.innerText = `$ ${alibabaFeeUsd.toFixed(2)}`;
                if (elCostoTotale) elCostoTotale.innerText = `$ ${costoTotaleRealeUsd.toFixed(2)}`;

                if (typeof aggiornaStatisticheDashboard === 'function') {
                    aggiornaStatisticheDashboard();
                }
                if (typeof aggiornaStatisticheLottoCorrente === 'function') {
                    aggiornaStatisticheLottoCorrente();
                }
            }
        }
    } catch (err) {
        console.error("Errore caricamento lotto:", err);
    }
}

let cronologiaLotti = [];

async function caricaCronologiaLotti() {
    try {
        const response = await fetch('/api/lotto/archive');
        if (response.ok) {
            const result = await response.json();
            if (result && result.success && Array.isArray(result.archive)) {
                cronologiaLotti = result.archive;
            } else {
                cronologiaLotti = [];
            }
        } else {
            cronologiaLotti = [];
        }
    } catch (err) {
        console.error("Errore caricamento cronologia lotti:", err);
        cronologiaLotti = [];
    }

    renderCronologiaLotti();
}

function renderCronologiaLotti() {
    const tbody = document.getElementById('lotti-archive-table-body');
    if (!tbody) return;

    if (cronologiaLotti.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="px-4 py-8 text-center text-slate-400 text-xs">
                    Nessun lotto concluso in archivio.
                </td>
            </tr>
        `;
        return;
    }

    // Render entries from newest to oldest
    const sorted = [...cronologiaLotti].reverse();

    tbody.innerHTML = sorted.map(l => {
        const incasso = Number(l.incasso_totale_eur || 0).toFixed(2).replace('.', ',') + '€';
        const profitto = Number(l.profitto_eur || 0).toFixed(2).replace('.', ',') + '€';
        
        return `
            <tr class="hover:bg-slate-50/50 transition-colors">
                <td class="px-4 py-3.5 text-xs font-bold text-slate-900">${l.numero_lotto || `Lotto #${l.id}`}</td>
                <td class="px-4 py-3.5 text-xs text-slate-500 font-medium font-mono">${l.archived_at || ''}</td>
                <td class="px-4 py-3.5 text-xs text-slate-600 font-semibold font-mono">${l.numero_ordini || 0}</td>
                <td class="px-4 py-3.5 text-xs text-slate-600 font-semibold font-mono">${l.numero_articoli || 0}</td>
                <td class="px-4 py-3.5 text-xs text-slate-900 font-extrabold font-mono">${incasso}</td>
                <td class="px-4 py-3.5 text-xs text-emerald-600 font-extrabold font-mono">${profitto}</td>
                <td class="px-4 py-3.5 text-xs text-right space-x-1">
                    <button onclick="apriDettaglioLotto(${l.id})" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 font-bold text-[10px] rounded-lg transition-all" title="Visualizza dettagli ed ordini del lotto">
                        Dettagli
                    </button>
                    <button onclick="ripristinaLotto(${l.id})" class="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 hover:text-amber-800 font-bold text-[10px] rounded-lg transition-all border border-amber-200/60" title="Riporta tutti gli ordini di questo lotto negli Ordini Attivi">
                        📥 Ripristina
                    </button>
                    <a href="${l.excel_url || `/lotti/LOTTO_${String(l.id).padStart(4, '0')}.xlsx`}" download class="inline-flex items-center px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 font-bold text-[10px] rounded-lg transition-all border border-emerald-100/50">
                        🟢 Excel Fornitore
                    </a>
                    <button onclick="chiediEliminaLotto(${l.id})" class="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[10px] rounded-lg transition-all">
                        🗑️ Elimina
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

window.currentDetailLottoId = null;

let isRestoringLotto = false;

window.chiediRipristinaLotto = function(id) {
    console.log(`[LOTTO RESTORE DEBUG]\nCLICK RIPRISTINA\nlottoId: ${id}`);
    console.log(`[LOTTO RESTORE DEBUG]\nlottoId ricevuto: ${id}`);

    const lotto = cronologiaLotti.find(l => Number(l.id) === Number(id));
    const lotName = lotto ? (lotto.numero_lotto || `Lotto #${lotto.id}`) : `Lotto #${id}`;
    
    // Set lot name in confirmation modal
    const nameEl = document.getElementById('restore-lotto-name');
    if (nameEl) {
        nameEl.innerText = lotName;
    }

    // Set confirm button handler
    const confirmBtn = document.getElementById('btn-conferma-ripristina-lotto');
    if (confirmBtn) {
        confirmBtn.onclick = async function() {
            closeRestoreLottoConfirmModal();
            await eseguiRipristinaLotto(id);
        };
    }

    // Open Confirmation Modal
    const modal = document.getElementById('restore-lotto-confirm-modal');
    const container = document.getElementById('restore-lotto-modal-container');
    if (modal && container) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            container.classList.remove('scale-95', 'opacity-0');
            container.classList.add('scale-100', 'opacity-100');
        }, 10);
    } else {
        // Fallback se la modale non è presente nel DOM
        eseguiRipristinaLotto(id);
    }
};

window.closeRestoreLottoConfirmModal = function() {
    const modal = document.getElementById('restore-lotto-confirm-modal');
    const container = document.getElementById('restore-lotto-modal-container');
    if (modal && container) {
        container.classList.remove('scale-100', 'opacity-100');
        container.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 200);
    }
};

window.ripristinaLotto = function(id) {
    return window.chiediRipristinaLotto(id);
};

window.eseguiRipristinaLotto = async function(id) {
    if (isRestoringLotto) return;
    
    console.log(`[LOTTO RESTORE DEBUG]\nCLICK RIPRISTINA (ESEGUI)\nlottoId: ${id}`);
    console.log(`[LOTTO RESTORE DEBUG]\nlottoId ricevuto: ${id}`);

    const lotto = cronologiaLotti.find(l => Number(l.id) === Number(id));
    const lotName = lotto ? (lotto.numero_lotto || `Lotto #${lotto.id}`) : `Lotto #${id}`;

    isRestoringLotto = true;
    showToast(`Ripristino ${lotName} allo stato attivo in corso...`, "info");

    const url = `/api/lotto/archive/${id}/restore`;
    const method = 'POST';
    console.log(`[LOTTO RESTORE DEBUG]\nFETCH START\nURL: ${url}\nMETHOD: ${method}\nBODY: null`);

    try {
        const response = await fetch(url, {
            method: method
        });
        
        console.log(`[LOTTO RESTORE DEBUG]\nFETCH RESPONSE\nHTTP STATUS: ${response.status}`);
        
        const result = await response.json();
        console.log(`[LOTTO RESTORE DEBUG]\nRESPONSE BODY:\n`, JSON.stringify(result, null, 2));

        if (response.ok && result && result.success) {
            showToast(result.message || `${lotName} ripristinato con successo allo stato attivo!`, "success");
            
            if (typeof closeLottoDetailsModal === 'function') {
                closeLottoDetailsModal();
            }

            await caricaLotto();
            await caricaOrdini();
            if (typeof caricaGestioneOrdini === 'function') {
                await caricaGestioneOrdini();
            }
            await caricaCronologiaLotti();
        } else {
            console.error("[LOTTO RESTORE DEBUG] Errore ripristino lotto:", result ? result.error : "Nessuna risposta");
            showToast("Ripristino lotto fallito: " + (result && result.error ? result.error : "Errore sconosciuto"), "error");
        }
    } catch (err) {
        console.error("[LOTTO RESTORE DEBUG] Eccezione ripristino lotto:", err);
        showToast("Ripristino lotto fallito: " + err.message, "error");
    } finally {
        isRestoringLotto = false;
    }
};

window.ripristinaLottoDaModale = async function() {
    if (window.currentDetailLottoId) {
        window.chiediRipristinaLotto(window.currentDetailLottoId);
    }
};

window.chiediEliminaLotto = function(id) {
    const lotto = cronologiaLotti.find(l => Number(l.id) === Number(id));
    if (!lotto) {
        showToast("Lotto non trovato.", "error");
        return;
    }

    const lotName = lotto.numero_lotto || `Lotto #${lotto.id}`;
    
    // Set lot name in confirmation modal
    const nameEl = document.getElementById('delete-lotto-name');
    if (nameEl) {
        nameEl.innerText = lotName;
    }

    // Set confirm button handler
    const confirmBtn = document.getElementById('btn-conferma-elimina-lotto');
    if (confirmBtn) {
        confirmBtn.onclick = async function() {
            closeDeleteLottoConfirmModal();
            await eseguiEliminaLotto(id, lotName);
        };
    }

    // Open Confirmation Modal
    const modal = document.getElementById('delete-lotto-confirm-modal');
    const container = document.getElementById('delete-lotto-modal-container');
    if (modal && container) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            container.classList.remove('scale-95', 'opacity-0');
            container.classList.add('scale-100', 'opacity-100');
        }, 10);
    }
};

window.closeDeleteLottoConfirmModal = function() {
    const modal = document.getElementById('delete-lotto-confirm-modal');
    const container = document.getElementById('delete-lotto-modal-container');
    if (modal && container) {
        container.classList.remove('scale-100', 'opacity-100');
        container.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 200);
    }
};

async function eseguiEliminaLotto(id, lotName) {
    showToast("Eliminazione lotto in corso...", "info");
    try {
        const response = await fetch(`/api/lotto/archive/${id}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (response.ok && result && result.success) {
            showToast(`Lotto ${lotName} eliminato con successo.`, "success");
            
            // Aggiorna l'interfaccia ricaricando i dati
            await caricaCronologiaLotti();
            await caricaOrdini();
        } else {
            console.error("[FRONTEND] Errore eliminazione lotto:", result.error);
            showToast("Errore durante l'eliminazione: " + (result.error || "Errore sconosciuto"), "error");
        }
    } catch (err) {
        console.error("[FRONTEND] Errore connessione durante eliminazione lotto:", err);
        showToast("Errore di connessione: " + err.message, "error");
    }
}

window.apriDettaglioLotto = function(id) {
    window.currentDetailLottoId = id;
    const lotto = cronologiaLotti.find(l => Number(l.id) === Number(id));
    if (!lotto) {
        showToast("Lotto non trovato.", "error");
        return;
    }

    // Modal elements
    const titleEl = document.getElementById('lotto-details-title');
    const dateEl = document.getElementById('lotto-details-date');
    const ordiniEl = document.getElementById('detail-lotto-ordini');
    const articoliEl = document.getElementById('detail-lotto-articoli');
    const incassoEl = document.getElementById('detail-lotto-incasso');
    const costoProdEl = document.getElementById('detail-lotto-costo-prodotti');
    const costoSpedEl = document.getElementById('detail-lotto-costo-spedizione');
    const alibabaFeeEl = document.getElementById('detail-lotto-alibaba-fee');
    const costoTotEl = document.getElementById('detail-lotto-costo-totale');
    const profittoEl = document.getElementById('detail-lotto-profitto');
    const margineEl = document.getElementById('detail-lotto-margine');
    const ordersContainer = document.getElementById('lotto-orders-cards-container');

    const feeUsd = Number(lotto.alibaba_fee_usd !== undefined ? lotto.alibaba_fee_usd : ((Number(lotto.costo_prodotti_usd || 0) + Number(lotto.costo_spedizione_usd || 0)) * 0.03));
    const feeEur = Number(lotto.alibaba_fee_eur || 0);

    if (titleEl) titleEl.innerText = lotto.numero_lotto || `Lotto #${lotto.id}`;
    if (dateEl) dateEl.innerText = `Chiuso il: ${lotto.archived_at || ''}`;
    if (ordiniEl) ordiniEl.innerText = lotto.numero_ordini || 0;
    if (articoliEl) articoliEl.innerText = lotto.numero_articoli || 0;
    if (incassoEl) incassoEl.innerText = `€ ${Number(lotto.incasso_totale_eur || 0).toFixed(2).replace('.', ',')}`;
    if (costoProdEl) costoProdEl.innerText = `$ ${Number(lotto.costo_prodotti_usd || 0).toFixed(2).replace('.', ',')}`;
    if (costoSpedEl) costoSpedEl.innerText = `$ ${Number(lotto.costo_spedizione_usd || 0).toFixed(2).replace('.', ',')}`;
    if (alibabaFeeEl) {
        if (feeEur > 0) {
            alibabaFeeEl.innerText = `$ ${feeUsd.toFixed(2).replace('.', ',')} (€ ${feeEur.toFixed(2).replace('.', ',')})`;
        } else {
            alibabaFeeEl.innerText = `$ ${feeUsd.toFixed(2).replace('.', ',')}`;
        }
    }
    if (costoTotEl) {
        const cTotUsd = Number(lotto.costo_totale_usd || 0);
        const cTotEur = Number(lotto.costo_totale_eur || 0);
        if (cTotEur > 0) {
            costoTotEl.innerText = `$ ${cTotUsd.toFixed(2).replace('.', ',')} (€ ${cTotEur.toFixed(2).replace('.', ',')})`;
        } else {
            costoTotEl.innerText = `$ ${cTotUsd.toFixed(2).replace('.', ',')}`;
        }
    }
    if (profittoEl) profittoEl.innerText = `€ ${Number(lotto.profitto_eur || 0).toFixed(2).replace('.', ',')}`;
    if (margineEl) margineEl.innerText = `${Number(lotto.margine_percentuale || 0).toFixed(2).replace('.', ',')}%`;

    // Configura pulsante download Excel Fornitore
    const excelEl = document.getElementById('lotto-details-excel');
    if (excelEl) {
        excelEl.href = lotto.excel_url || `/lotti/LOTTO_${String(lotto.id).padStart(4, '0')}.xlsx`;
        excelEl.classList.remove('hidden');
    }

    // Carica informazioni di tracciamento dal lotto
    const trackingMeta = (lotto.orders || []).find(o => o.is_tracking_meta) || {};
    const trackingStatusSelect = document.getElementById('lotto-shipping-status');
    const trackingCodeInput = document.getElementById('lotto-tracking-code');
    const trackingUrlInput = document.getElementById('lotto-tracking-url');

    if (trackingStatusSelect) {
        trackingStatusSelect.value = trackingMeta.shipping_status || "In preparazione";
    }
    if (trackingCodeInput) {
        trackingCodeInput.value = trackingMeta.tracking_code || "";
    }
    if (trackingUrlInput) {
        trackingUrlInput.value = trackingMeta.tracking_url || "";
    }

    // Configura pulsante di salvataggio
    const btnSave = document.getElementById('btn-save-lotto-tracking');
    if (btnSave) {
        btnSave.onclick = async function() {
            const status = (document.getElementById('lotto-shipping-status')?.value || 'In preparazione').trim();
            const code = (document.getElementById('lotto-tracking-code')?.value || '').trim();
            const url = (document.getElementById('lotto-tracking-url')?.value || '').trim();

            btnSave.disabled = true;
            btnSave.innerText = "💾 Salvataggio...";

            try {
                const res = await fetch('/api/admin/lotto/save-tracking', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: lotto.id,
                        shipping_status: status,
                        tracking_code: code,
                        tracking_url: url
                    })
                });
                const result = await res.json();
                if (result.success) {
                    showToast("Spedizione salvata con successo nel Lotto!", "success");
                    const updatedLot = result.lotto;
                    const idx = cronologiaLotti.findIndex(l => Number(l.id) === Number(lotto.id));
                    if (idx !== -1) {
                        cronologiaLotti[idx] = updatedLot;
                    }
                    window.apriDettaglioLotto(lotto.id);
                } else {
                    showToast("Errore durante il salvataggio: " + result.error, "error");
                }
            } catch (err) {
                showToast("Errore di connessione: " + err.message, "error");
            } finally {
                btnSave.disabled = false;
                btnSave.innerText = "💾 Salva Spedizione";
            }
        };
    }

    // Render orders belonging to this Lot inside modal
    if (ordersContainer) {
        const lottoOrders = (lotto.orders || []).filter(o => !o.is_tracking_meta);
        if (lottoOrders.length === 0) {
            ordersContainer.innerHTML = `
                <div class="col-span-full py-12 text-center text-slate-400 text-sm">
                    Nessun ordine associato a questo lotto.
                </div>
            `;
        } else {
            ordersContainer.innerHTML = lottoOrders.map((order, idx) => {
                const nomeCliente = order.nome || 'N/D';
                const telefonoCliente = order.telefono || 'N/D';
                const dataOrdine = order.data || 'N/D';
                const totaleOrdine = order.totale || '0,00€';
                const prodottiOrdinati = order.squadra || '';
                const tagliaOrdinata = order.taglia || '';
                const personalizzazione = order.personalizzazione || '';
                const profitto = order["Profitto (EUR)"] || '0,00';
                
                const numArticoli = estraiNumeroArticoli(order);
                const cleanPhone = telefonoCliente.replace(/\D/g, '');
                const waLink = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('39') ? '' : '39'}${cleanPhone}` : '#';

                const costoFornitoreEur = order["Costo totale (EUR)"] || '';
                const costoFornitoreUsd = order["Costo totale (USD)"] || '';
                const costoProdottiUsd = order["Costo prodotti (USD)"] || '';
                
                const parsedTotalUsd = parseFloat((costoFornitoreUsd || '0').replace(/\./g, '').replace(',', '.')) || 0;
                const parsedProductsUsd = parseFloat((costoProdottiUsd || '0').replace(/\./g, '').replace(',', '.')) || 0;
                const fallbackSpedizioneUsdVal = Math.max(0, parsedTotalUsd - parsedProductsUsd);
                const costoSpedizioneUsd = order["Costo spedizione (USD)"] || order["osto spedizione (USD)"] || String(fallbackSpedizioneUsdVal);
                const cambioValuta = order["Cambio USD/EUR"] || '';

                const itemsHTML = renderOrderItemsHTML(order);

                return `
                    <div class="bg-[#111111] border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between">
                        <!-- Header: Date, Status -->
                        <div class="px-4 py-3 border-b border-[rgba(255,255,255,0.08)] flex items-center justify-between bg-[#0B0B0B]">
                            <div class="flex flex-col">
                                <span class="text-xs font-bold text-[rgba(255,255,255,0.65)] font-mono">ORD-${idx + 1}</span>
                                <span class="text-[10px] text-[rgba(255,255,255,0.65)] font-mono mt-0.5">${dataOrdine}</span>
                            </div>
                            <div>
                                <span class="px-2 py-0.5 text-[9px] leading-5 font-bold rounded-full bg-[#0B0B0B] text-[rgba(255,255,255,0.88)] border border-[rgba(255,255,255,0.08)] uppercase tracking-wider font-sans">
                                    Concluso
                                </span>
                            </div>
                        </div>
                        
                        <!-- Body: Customer info & Items -->
                        <div class="p-4 flex-grow space-y-3.5">
                            <!-- Cliente Info -->
                            <div class="flex items-center justify-between">
                                <div>
                                    <h4 class="text-sm font-bold text-white leading-tight">${nomeCliente}</h4>
                                    <span class="text-[11px] text-[rgba(255,255,255,0.65)] font-mono block mt-0.5">📞 ${telefonoCliente}</span>
                                </div>
                                ${cleanPhone ? `
                                    <a href="${waLink}" target="_blank" class="h-7 w-7 bg-emerald-950/20 text-emerald-400 hover:bg-emerald-900/40 border border-emerald-900/30 rounded-full flex items-center justify-center text-xs transition-all shadow-inner" title="Contatta su WhatsApp">
                                        💬
                                    </a>
                                ` : ''}
                            </div>
                            
                            <!-- Items Box -->
                            <div class="bg-[#0B0B0B] px-3 py-2.5 rounded-xl border border-[rgba(255,255,255,0.08)]">
                                <div class="text-[10px] font-bold text-[rgba(255,255,255,0.65)] uppercase tracking-wider pb-1.5 border-b border-[rgba(255,255,255,0.08)] flex justify-between items-center">
                                    <span>Articoli Ordinati</span>
                                    <span class="text-[rgba(255,255,255,0.65)] font-mono text-[9px]">(${numArticoli} unit${numArticoli === 1 ? 'à' : 'à'})</span>
                                </div>
                                <div class="divide-y divide-[rgba(255,255,255,0.08)]">
                                    ${itemsHTML}
                                </div>
                            </div>

                            <!-- Riepilogo Economico -->
                            <div class="bg-[#0B0B0B] p-4 rounded-xl border border-[rgba(255,255,255,0.08)] space-y-3 font-sans">
                                <div class="text-[10px] font-bold text-[rgba(255,255,255,0.65)] uppercase tracking-wider">Riepilogo Finanziario</div>
                                
                                <div class="space-y-1.5 text-xs text-[rgba(255,255,255,0.88)]">
                                    <!-- Subtotale prodotti -->
                                    <div class="flex justify-between items-center py-0.5">
                                        <span class="text-[rgba(255,255,255,0.65)]">Subtotale Prodotti:</span>
                                        <span class="font-mono font-semibold text-white">
                                            € ${(() => {
                                                const totIncassato = parseFloat(totaleOrdine.replace(/[^0-9,.-]/g, '').replace(',', '.')) || 0;
                                                const haSpedCliente = prodottiOrdinati.toLowerCase().includes('spedizione');
                                                const spedCliente = haSpedCliente ? 2.00 : 0.00;
                                                const couponDiscount = (order.coupon_discount !== undefined && order.coupon_discount !== null) ? Number(order.coupon_discount) : 0;
                                                return (totIncassato + couponDiscount - spedCliente).toFixed(2).replace('.', ',');
                                             })()}
                                        </span>
                                    </div>
                                    <!-- Coupon (se presente) -->
                                    ${(() => {
                                        const cCode = order.coupon_code || '';
                                        const cDiscount = (order.coupon_discount !== undefined && order.coupon_discount !== null) ? Number(order.coupon_discount) : 0;
                                        if (cCode || cDiscount > 0) {
                                            return `
                                            <div class="flex justify-between items-center py-0.5 text-emerald-400 font-medium">
                                                <span class="flex items-center gap-1">
                                                    <span>🎟️</span> Coupon: <strong class="font-bold uppercase">${cCode || 'SCONTO'}</strong>
                                                </span>
                                                <span class="font-mono font-bold">-€ ${cDiscount.toFixed(2).replace('.', ',')}</span>
                                            </div>
                                            `;
                                        }
                                        return '';
                                    })()}
                                    <!-- Spedizione cliente -->
                                    <div class="flex justify-between items-center py-0.5">
                                        <span class="text-[rgba(255,255,255,0.65)]">Spedizione Cliente:</span>
                                        <span class="font-mono font-bold text-white">
                                            ${(() => {
                                                const haSpedCliente = prodottiOrdinati.toLowerCase().includes('spedizione');
                                                return haSpedCliente ? '€ 2,00' : '<span class="text-brand-gold font-bold">GRATUITA</span>';
                                            })()}
                                        </span>
                                    </div>
                                    <!-- Totale Incassato -->
                                    <div class="flex justify-between items-center py-1 border-b border-dashed border-[rgba(255,255,255,0.08)] font-bold">
                                        <span class="text-white font-bold">Totale Incassato:</span>
                                        <span class="font-extrabold text-white font-mono text-sm">${totaleOrdine}</span>
                                    </div>
                                    <!-- Costo Prodotti -->
                                    <div class="flex justify-between items-center py-0.5">
                                        <span class="text-[rgba(255,255,255,0.65)]">Costo Prodotti (Fornitore):</span>
                                        <span class="font-mono font-semibold text-white">
                                            € ${(() => {
                                                const r = parseFloat((cambioValuta || '0.92').replace(/\./g, '').replace(',', '.')) || 0.92;
                                                const p = parseFloat((costoProdottiUsd || '0').replace(/\./g, '').replace(',', '.')) || 0;
                                                return (p * r).toFixed(2).replace('.', ',');
                                            })()} 
                                            <span class="text-[10px] text-[rgba(255,255,255,0.5)] font-normal">($${(() => {
                                                const p = parseFloat((costoProdottiUsd || '0').replace(/\./g, '').replace(',', '.')) || 0;
                                                return p.toFixed(2).replace('.', ',');
                                            })()})</span>
                                        </span>
                                    </div>
                                    <!-- Spedizione Fornitore -->
                                    <div class="flex justify-between items-center py-0.5">
                                        <span class="text-[rgba(255,255,255,0.65)]">Spedizione Fornitore (Costo):</span>
                                        <span class="font-mono font-semibold text-white">
                                            € ${(() => {
                                                const r = parseFloat((cambioValuta || '0.92').replace(/\./g, '').replace(',', '.')) || 0.92;
                                                const s = parseFloat((costoSpedizioneUsd || '0').replace(/\./g, '').replace(',', '.')) || 0;
                                                return (s * r).toFixed(2).replace('.', ',');
                                            })()} 
                                            <span class="text-[10px] text-[rgba(255,255,255,0.5)] font-normal">($${(() => {
                                                const s = parseFloat((costoSpedizioneUsd || '0').replace(/\./g, '').replace(',', '.')) || 0;
                                                return s.toFixed(2).replace('.', ',');
                                            })()})</span>
                                        </span>
                                    </div>
                                    <!-- Costo Totale Reale -->
                                    <div class="flex justify-between items-center py-1.5 border-t border-[rgba(255,255,255,0.08)] mt-1 font-bold">
                                        <span class="text-[rgba(255,255,255,0.88)] font-extrabold text-xs uppercase tracking-tight">Costo Totale Reale:</span>
                                        <span class="font-mono font-black text-white text-sm">
                                            € ${(() => {
                                                const val = parseFloat((costoFornitoreEur || '0').replace(/\./g, '').replace(',', '.')) || 0;
                                                return val.toFixed(2).replace('.', ',');
                                            })()} 
                                            <span class="text-[10px] text-[rgba(255,255,255,0.5)] font-bold">($${(() => {
                                                const val = parseFloat((costoFornitoreUsd || '0').replace(/\./g, '').replace(',', '.')) || 0;
                                                return val.toFixed(2).replace('.', ',');
                                            })()})</span>
                                        </span>
                                    </div>
                                    <!-- Margine Reale (Profitto) -->
                                    <div class="flex justify-between items-center p-2 bg-emerald-950/20 rounded-lg border border-emerald-900/30 mt-2">
                                        <span class="text-emerald-400 font-bold text-xs uppercase tracking-tight">Margine Reale:</span>
                                        <span class="font-mono font-black text-emerald-400 text-sm">
                                            +€ ${profitto}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    // Open Modal
    const modal = document.getElementById('lotto-details-modal');
    const container = document.getElementById('lotto-details-modal-container');
    if (modal && container) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            container.classList.remove('scale-95', 'opacity-0');
            container.classList.add('scale-100', 'opacity-100');
        }, 10);
    }
};

window.closeLottoDetailsModal = function() {
    const modal = document.getElementById('lotto-details-modal');
    const container = document.getElementById('lotto-details-modal-container');
    if (modal && container) {
        container.classList.remove('scale-100', 'opacity-100');
        container.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 200);
    }
};

/**
 * Calcola e mostra i dati statistici nella dashboard
 */
/**
 * Calcola e mostra i dati statistici nella dashboard
 */
function isOrderCanceled(o) {
    if (!o) return false;
    const st = String(o.status || o.data_status || o.stato || (o.data && o.data.status) || '').trim().toLowerCase();
    return st === 'annullato_dal_cliente' || st === 'annullato dal cliente' || st === 'annullato' || st.includes('annullat') || st === 'canceled' || st === 'cancelled';
}

function isOrderActive(o) {
    if (!o || isOrderCanceled(o)) return false;
    if (o.is_archived === true) return false;
    if (Array.isArray(archivedKeys) && archivedKeys.includes(o.data)) return false;
    return true;
}

/**
 * Calcola l'incasso effettivo da recuperare dai clienti in base alle modifiche di Suddivisione Profitto.
 * Formula: INCASSO_EFFETTIVO = INCASSO_BASE_CLIENTI - COSTI_ACQUISTI_COPERTI_DAL_PROFITTO + DEFICIT_DOVUTO_A_SALDI_NEGATIVI
 */
function calcolaIncassoEffettivo(incassoBase) {
    const incasso_base = Number(incassoBase) || 0;
    let costi_acquisti_profitto = 0;
    let deficit_totale = 0;

    if (profitSplitData && profitSplitData.summary) {
        const summary = profitSplitData.summary;
        const sWithd = Number(summary.sergio?.total_withdrawals) || 0;
        const rWithd = Number(summary.riccardo?.total_withdrawals) || 0;
        costi_acquisti_profitto = sWithd + rWithd;

        const sNet = Number(summary.sergio?.total_net) || 0;
        const rNet = Number(summary.riccardo?.total_net) || 0;

        const deficitSergio = sNet < 0 ? Math.abs(sNet) : 0;
        const deficitRiccardo = rNet < 0 ? Math.abs(rNet) : 0;
        deficit_totale = deficitSergio + deficitRiccardo;
    }

    const correzione_incasso = -costi_acquisti_profitto + deficit_totale;
    const incasso_effettivo = Math.max(0, incasso_base + correzione_incasso);

    console.log(`[PROFIT SPLIT CASHFLOW DEBUG] incasso_base: ${incasso_base.toFixed(2)}, costi_acquisti_profitto: ${costi_acquisti_profitto.toFixed(2)}, deficit_totale: ${deficit_totale.toFixed(2)}, correzione_incasso: ${correzione_incasso.toFixed(2)}, incasso_effettivo: ${incasso_effettivo.toFixed(2)}`);

    return {
        incasso_base,
        costi_acquisti_profitto,
        deficit_totale,
        correzione_incasso,
        incasso_effettivo
    };
}
window.calcolaIncassoEffettivo = calcolaIncassoEffettivo;

function aggiornaStatisticheDashboard() {
    // Totale prodotti
    const totProdottiEl = document.getElementById('stats-totale-prodotti');
    if (totProdottiEl) {
        totProdottiEl.innerText = prodotti.length;
    }

    // Senza prezzo fornitore
    const senzaFornitoreEl = document.getElementById('stats-senza-fornitore');
    if (senzaFornitoreEl) {
        const countSenzaFornitore = prodotti.filter(p => p.prezzo_fornitore === null || p.prezzo_fornitore === undefined || p.prezzo_fornitore === "" || p.prezzo_fornitore === 0).length;
        senzaFornitoreEl.innerText = countSenzaFornitore;
    }

    // Ordini Attivi (Lotto Corrente)
    const activeOrders = ordini.filter(isOrderActive);
    const ordiniAttiviEl = document.getElementById('stats-ordini-attivi');
    if (ordiniAttiviEl) {
        ordiniAttiviEl.innerText = activeOrders.length;
    }

    // Ordini Completati / Archiviati
    const completedOrders = ordini.filter(o => !isOrderActive(o) && !isOrderCanceled(o));
    const ordiniCompletatiEl = document.getElementById('stats-ordini-completati');
    if (ordiniCompletatiEl) {
        ordiniCompletatiEl.innerText = completedOrders.length;
    }

    // Financial Metrics per il LOTTO CORRENTE ATTIVO
    let incassoLottoCorrente = 0;
    let costoFornitoreLottoEur = 0;
    let profittoOrdiniLottoEur = 0;
    let articoliLottoCorrente = 0;

    activeOrders.forEach(o => {
        incassoLottoCorrente += parseFlexibleDecimal(o.totale || '');
        
        const costoStr = o["Costo totale (EUR)"] || o.costo_totale_eur || '0';
        costoFornitoreLottoEur += parseFlexibleDecimal(costoStr);

        const profittoStr = o["Profitto (EUR)"] || o.profitto_eur || '0';
        profittoOrdiniLottoEur += parseFlexibleDecimal(profittoStr);

        articoliLottoCorrente += estraiNumeroArticoli(o);
    });

    // Alibaba Payment Fee (3% del costo fornitore in USD convertito in EUR)
    let alibabaFeeUsd = 0;
    let alibabaFeeEur = 0;
    if (window.currentLottoData) {
        alibabaFeeUsd = Number(window.currentLottoData.alibaba_fee_usd || 0);
        alibabaFeeEur = Number(window.currentLottoData.alibaba_fee_eur || 0);
    }
    if (alibabaFeeEur === 0 && window.currentLottoData && window.currentLottoData.costo_fornitore_usd) {
        alibabaFeeUsd = Number(window.currentLottoData.costo_fornitore_usd) * 0.03;
        const tasso = (window.cachedSettings && window.cachedSettings.exchangeRate) ? Number(window.cachedSettings.exchangeRate) : 1.05;
        alibabaFeeEur = alibabaFeeUsd / tasso;
    }

    const costoTotaleLottoEur = costoFornitoreLottoEur + alibabaFeeEur;
    const profittoRealeLotto = Math.max(-999999, incassoLottoCorrente - costoTotaleLottoEur);

    // Calcolo Incasso Effettivo integrato con Suddivisione Profitto
    const cashflow = calcolaIncassoEffettivo(incassoLottoCorrente);
    const incassoDaMostrare = cashflow.incasso_effettivo;

    // 1. Incasso Totale Clienti
    const incassoTotaleEl = document.getElementById('stats-incasso-totale');
    if (incassoTotaleEl) {
        incassoTotaleEl.innerText = `€ ${incassoDaMostrare.toFixed(2).replace('.', ',')}`;
        if (cashflow.correzione_incasso !== 0) {
            incassoTotaleEl.title = `Incasso Base: € ${cashflow.incasso_base.toFixed(2).replace('.', ',')} | Costi Coperti da Profitto: -€ ${cashflow.costi_acquisti_profitto.toFixed(2).replace('.', ',')} | Deficit: +€ ${cashflow.deficit_totale.toFixed(2).replace('.', ',')} = Incasso Effettivo: € ${cashflow.incasso_effettivo.toFixed(2).replace('.', ',')}`;
        } else {
            incassoTotaleEl.title = `Incasso Totale: € ${cashflow.incasso_base.toFixed(2).replace('.', ',')}`;
        }
    }

    // 2. Costo Fornitore
    const costoTotaleProdottiEl = document.getElementById('stats-costo-totale-prodotti');
    if (costoTotaleProdottiEl) {
        costoTotaleProdottiEl.innerText = `€ ${costoFornitoreLottoEur.toFixed(2).replace('.', ',')}`;
    }

    // 3. Alibaba Payment Fee
    const alibabaFeeEl = document.getElementById('stats-alibaba-fee');
    const alibabaFeeUsdEl = document.getElementById('stats-alibaba-fee-usd');
    if (alibabaFeeEl) {
        alibabaFeeEl.innerText = `€ ${alibabaFeeEur.toFixed(2).replace('.', ',')}`;
    }
    if (alibabaFeeUsdEl) {
        alibabaFeeUsdEl.innerText = `$ ${alibabaFeeUsd.toFixed(2).replace('.', ',')}`;
    }

    // 4. Costo Totale Lotto
    const costoTotaleLottoEl = document.getElementById('stats-costo-totale-lotto-eur');
    if (costoTotaleLottoEl) {
        costoTotaleLottoEl.innerText = `€ ${costoTotaleLottoEur.toFixed(2).replace('.', ',')}`;
    }

    // 5. Profitto Reale
    const profittoTotaleEl = document.getElementById('stats-profitto-totale');
    if (profittoTotaleEl) {
        profittoTotaleEl.innerText = `€ ${profittoRealeLotto.toFixed(2).replace('.', ',')}`;
    }

    // Margine Reale Lotto Corrente (%)
    const margineMedioEl = document.getElementById('stats-margine-medio');
    if (margineMedioEl) {
        const margine = incassoDaMostrare > 0 ? (profittoRealeLotto / incassoDaMostrare) * 100 : (incassoLottoCorrente > 0 ? (profittoRealeLotto / incassoLottoCorrente) * 100 : 0);
        margineMedioEl.innerText = `${margine.toFixed(2).replace('.', ',')}%`;
    }

    // Articoli nel Lotto Corrente
    const articoliVendutiEl = document.getElementById('stats-articoli-venduti');
    if (articoliVendutiEl) {
        articoliVendutiEl.innerText = articoliLottoCorrente;
    }

    // Ultimo Ordine Attivo
    const ultimoOrdineEl = document.getElementById('stats-ultimo-ordine');
    if (ultimoOrdineEl) {
        if (activeOrders.length > 0) {
            const last = activeOrders[activeOrders.length - 1];
            const maxLen = 25;
            let label = `${last.nome} (${last.totale})`;
            if (label.length > maxLen) {
                label = label.substring(0, maxLen - 3) + '...';
            }
            ultimoOrdineEl.innerText = label;
            ultimoOrdineEl.title = `${last.nome} (${last.totale}) - ${last.data}`;
        } else {
            ultimoOrdineEl.innerText = "Nessuno";
            ultimoOrdineEl.title = "Nessun ordine attivo nel lotto corrente";
        }
    }

    // Profitto Stimato Lotto Corrente
    const lottoProfittoEl = document.getElementById('stats-lotto-profitto');
    if (lottoProfittoEl) {
        lottoProfittoEl.innerText = `€ ${profittoRealeLotto.toFixed(2).replace('.', ',')}`;
    }
}

/**
 * Calcola e mostra i dati finanziari stimati per il lotto corrente
 */
function aggiornaStatisticheLottoCorrente() {
    const activeOrders = ordini.filter(isOrderActive);
    let incassoPrevisto = 0;
    let costoFornitoreEur = 0;

    activeOrders.forEach(o => {
        incassoPrevisto += parseFlexibleDecimal(o.totale || '');
        const cStr = o["Costo totale (EUR)"] || o.costo_totale_eur || '0';
        costoFornitoreEur += parseFlexibleDecimal(cStr);
    });

    let alibabaFeeUsd = 0;
    let alibabaFeeEur = 0;
    if (window.currentLottoData) {
        alibabaFeeUsd = Number(window.currentLottoData.alibaba_fee_usd || 0);
        alibabaFeeEur = Number(window.currentLottoData.alibaba_fee_eur || 0);
    }
    if (alibabaFeeEur === 0 && window.currentLottoData && window.currentLottoData.costo_fornitore_usd) {
        alibabaFeeUsd = Number(window.currentLottoData.costo_fornitore_usd) * 0.03;
        const tasso = (window.cachedSettings && window.cachedSettings.exchangeRate) ? Number(window.cachedSettings.exchangeRate) : 1.05;
        alibabaFeeEur = alibabaFeeUsd / tasso;
    }

    const costoTotaleEur = costoFornitoreEur + alibabaFeeEur;
    const profittoPrevisto = incassoPrevisto - costoTotaleEur;

    const cashflowLotto = calcolaIncassoEffettivo(incassoPrevisto);
    const incassoPrevistoEffettivo = cashflowLotto.incasso_effettivo;
    const marginePrevisto = incassoPrevistoEffettivo > 0 ? (profittoPrevisto / incassoPrevistoEffettivo) * 100 : (incassoPrevisto > 0 ? (profittoPrevisto / incassoPrevisto) * 100 : 0);

    const incassoPrevistoEl = document.getElementById('lotto-incasso-previsto');
    if (incassoPrevistoEl) {
        incassoPrevistoEl.innerText = `€ ${incassoPrevistoEffettivo.toFixed(2).replace('.', ',')}`;
        if (cashflowLotto.correzione_incasso !== 0) {
            incassoPrevistoEl.title = `Incasso Base: € ${cashflowLotto.incasso_base.toFixed(2).replace('.', ',')} | Costi Coperti da Profitto: -€ ${cashflowLotto.costi_acquisti_profitto.toFixed(2).replace('.', ',')} | Deficit: +€ ${cashflowLotto.deficit_totale.toFixed(2).replace('.', ',')} = Incasso Effettivo: € ${cashflowLotto.incasso_effettivo.toFixed(2).replace('.', ',')}`;
        } else {
            incassoPrevistoEl.title = `Incasso Previsto dai clienti: € ${cashflowLotto.incasso_base.toFixed(2).replace('.', ',')}`;
        }
    }

    const costoFornitoreEurEl = document.getElementById('lotto-costo-fornitore-eur');
    if (costoFornitoreEurEl) {
        costoFornitoreEurEl.innerText = `€ ${costoFornitoreEur.toFixed(2).replace('.', ',')}`;
    }

    const alibabaFeeEurEl = document.getElementById('lotto-alibaba-fee-eur');
    if (alibabaFeeEurEl) {
        alibabaFeeEurEl.innerText = `€ ${alibabaFeeEur.toFixed(2).replace('.', ',')}`;
    }

    const costoTotaleEurEl = document.getElementById('lotto-costo-totale-eur');
    if (costoTotaleEurEl) {
        costoTotaleEurEl.innerText = `€ ${costoTotaleEur.toFixed(2).replace('.', ',')}`;
    }

    const profittoPrevistoEl = document.getElementById('lotto-profitto-previsto');
    if (profittoPrevistoEl) {
        profittoPrevistoEl.innerText = `€ ${profittoPrevisto.toFixed(2).replace('.', ',')}`;
    }

    const marginePrevistoEl = document.getElementById('lotto-margine-previsto');
    if (marginePrevistoEl) {
        marginePrevistoEl.innerText = `${marginePrevisto.toFixed(2).replace('.', ',')}%`;
    }
}

/**
 * Genera dinamicamente le opzioni per i select dei filtri (Squadra, Stagione, Categoria) leggendo i prodotti reali
 */
function generaOpzioniFiltri() {
    const filterSquadra = document.getElementById('filter-squadra');
    const filterStagione = document.getElementById('filter-stagione');
    const filterCategoria = document.getElementById('filter-categoria');

    if (!filterSquadra || !filterStagione || !filterCategoria) return;

    // Salva i valori attualmente selezionati
    const querySquadra = filterSquadra.value;
    const queryStagione = filterStagione.value;
    const queryCategoria = filterCategoria.value;

    // Estrai valori univoci e ordinati
    const squadre = squadreCatalogo.length > 0
        ? [...new Set(squadreCatalogo.map(t => t.name).filter(Boolean))].sort()
        : [...new Set(prodotti.map(p => p.squadra).filter(Boolean))].sort();
    const stagioni = [...new Set(prodotti.map(p => p.stagione).filter(Boolean))].sort().reverse();
    const prodCategorie = [...new Set(prodotti.map(p => p.categoria).filter(Boolean))];
    const filtriConfigurati = (window.appSettings?.filtriCatalogo || [])
        .filter(f => f.stato === 'attivo' || f.attivo !== false)
        .map(f => f.nome.trim())
        .filter(Boolean);

    const categorie = [...new Set([...filtriConfigurati, ...prodCategorie])]
        .filter(c => c.toLowerCase() !== 'tutti' && c.toLowerCase() !== 'tutto')
        .sort();

    // Aggiorna select squadra
    filterSquadra.innerHTML = '<option value="">Tutte le squadre</option>' + 
        squadre.map(sq => `<option value="${sq}" ${sq === querySquadra ? 'selected' : ''}>${sq}</option>`).join('');

    // Aggiorna select stagione
    filterStagione.innerHTML = '<option value="">Tutte le stagioni</option>' + 
        stagioni.map(st => `<option value="${st}" ${st === queryStagione ? 'selected' : ''}>${st}</option>`).join('');

    // Aggiorna select categoria
    filterCategoria.innerHTML = '<option value="">Tutte le categorie</option>' + 
        categorie.map(cat => `<option value="${cat}" ${cat === queryCategoria ? 'selected' : ''}>${cat}</option>`).join('');
}

/**
 * Normalizza il testo rimuovendo gli accenti, convertendo in minuscolo,
 * e normalizzando gli spazi doppi.
 */
function normalizeTextForSearch(text) {
    if (!text) return "";
    return text.toString()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Rimuove gli accenti
        .replace(/\s+/g, ' ')            // Rimpiazza spazi multipli con un singolo spazio
        .trim();
}

let activeSearchQuery = "";
let currentProductsPage = 1;
const productsPerPage = 10;

// Stato dell'ordinamento principale per la tabella prodotti
let currentProductSortColumn = null; // 'prezzo' | 'prezzo_fornitore' | null
let currentProductSortDirection = null; // 'desc' | 'asc' | null

/**
 * Converte qualsiasi rappresentazione di prezzo (stringa, numero, valuta €, $, virgola, punto)
 * in un valore numerico puro (float) per il corretto ordinamento matematico.
 */
function estraiValoreNumericoPrezzo(val) {
    if (val === undefined || val === null || val === '') return null;
    if (typeof val === 'number') {
        return isNaN(val) ? null : val;
    }
    let str = val.toString()
        .replace(/€/g, '')
        .replace(/\$/g, '')
        .replace(/EUR/gi, '')
        .replace(/USD/gi, '')
        .replace(/\s+/g, '')
        .trim();
    if (!str) return null;

    // Gestione combinata di virgole e punti (es. "1.234,56" o "1,234.56")
    if (str.includes(',') && str.includes('.')) {
        if (str.indexOf(',') > str.indexOf('.')) {
            // Formato europeo standard "1.234,56"
            str = str.replace(/\./g, '').replace(',', '.');
        } else {
            // Formato americano "1,234.56"
            str = str.replace(/,/g, '');
        }
    } else if (str.includes(',')) {
        // Formato con sola virgola decimale "49,99" -> "49.99"
        str = str.replace(',', '.');
    }

    const num = parseFloat(str);
    return isNaN(num) ? null : num;
}
window.estraiValoreNumericoPrezzo = estraiValoreNumericoPrezzo;

/**
 * Funzione di comparazione numerica rigorosa per l'ordinamento.
 * Garantisce che 9,99 < 100 e posiziona correttamente i valori null/vuoti.
 */
function comparaValoriNumericiPrezzo(valA, valB, direction) {
    const numA = estraiValoreNumericoPrezzo(valA);
    const numB = estraiValoreNumericoPrezzo(valB);

    // Se entrambi sono null/vuoti mantieni l'ordine
    if (numA === null && numB === null) return 0;
    // Gli elementi privi di prezzo vengono sempre posizionati alla fine
    if (numA === null) return 1;
    if (numB === null) return -1;

    if (direction === 'asc') {
        // Dal più basso al più alto (es. 7.50 -> 12 -> 15 -> 18 -> 26 -> 49.99 -> 100)
        return numA - numB;
    } else {
        // Dal più alto al più basso (es. 100 -> 49.99 -> 26 -> 18 -> 15 -> 12 -> 7.50)
        return numB - numA;
    }
}

/**
 * Gestisce il toggle dell'ordinamento al click sull'intestazione della colonna.
 * Ciclo: Dal più ALTO al più BASSO (DESC) -> Dal più BASSO al più ALTO (ASC) -> Nessuno (Ripristina ordine predefinito)
 * Se si clicca su una colonna diversa, diventa essa l'unico ordinamento attivo.
 */
function toggleOrdinamentoProdotti(colonna) {
    if (currentProductSortColumn !== colonna) {
        // Nuova colonna attiva: inizia con ordine decrescente (più alto -> più basso)
        currentProductSortColumn = colonna;
        currentProductSortDirection = 'desc';
    } else {
        // Stessa colonna: cicla DESC -> ASC -> DEFAULT
        if (currentProductSortDirection === 'desc') {
            currentProductSortDirection = 'asc';
        } else if (currentProductSortDirection === 'asc') {
            currentProductSortColumn = null;
            currentProductSortDirection = null;
        } else {
            currentProductSortDirection = 'desc';
        }
    }

    currentProductsPage = 1; // Riporta alla prima pagina
    aggiornaIndicatoriOrdinamento();
    renderProdotti();
}
window.toggleOrdinamentoProdotti = toggleOrdinamentoProdotti;

/**
 * Imposta esplicitamente l'ordinamento
 */
function impostaOrdinamentoProdotti(colonna, direzione) {
    currentProductSortColumn = colonna;
    currentProductSortDirection = direzione;
    currentProductsPage = 1;
    aggiornaIndicatoriOrdinamento();
    renderProdotti();
}
window.impostaOrdinamentoProdotti = impostaOrdinamentoProdotti;

/**
 * Ripristina l'ordinamento dei prodotti all'ordine originale
 */
function resetOrdinamentoProdotti() {
    currentProductSortColumn = null;
    currentProductSortDirection = null;
    currentProductsPage = 1;
    aggiornaIndicatoriOrdinamento();
    renderProdotti();
}
window.resetOrdinamentoProdotti = resetOrdinamentoProdotti;

/**
 * Ripristina sia tutti i filtri sia l'ordinamento attivo
 */
function resetTuttiFiltriEOrdinamento() {
    currentProductSortColumn = null;
    currentProductSortDirection = null;
    activeSearchQuery = "";

    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = "";

    const filterSquadra = document.getElementById('filter-squadra');
    if (filterSquadra) filterSquadra.value = "";

    const filterCategoria = document.getElementById('filter-categoria');
    if (filterCategoria) filterCategoria.value = "";

    const filterStagione = document.getElementById('filter-stagione');
    if (filterStagione) filterStagione.value = "";

    const filterSenzaFornitore = document.getElementById('filter-senza-fornitore');
    if (filterSenzaFornitore) filterSenzaFornitore.checked = false;

    currentProductsPage = 1;
    aggiornaIndicatoriOrdinamento();
    renderProdotti();
}
window.resetTuttiFiltriEOrdinamento = resetTuttiFiltriEOrdinamento;

/**
 * Aggiorna gli indicatori visivi delle intestazioni tabella e il banner di stato
 */
function aggiornaIndicatoriOrdinamento() {
    const thPrezzo = document.getElementById('th-sort-prezzo');
    const labelPrezzo = document.getElementById('label-sort-prezzo');
    const indicatorPrezzo = document.getElementById('sort-indicator-prezzo');

    const thFornitore = document.getElementById('th-sort-prezzo-fornitore');
    const labelFornitore = document.getElementById('label-sort-prezzo-fornitore');
    const indicatorFornitore = document.getElementById('sort-indicator-prezzo-fornitore');

    const activeSortBanner = document.getElementById('active-sort-banner');
    const activeSortText = document.getElementById('active-sort-text');

    // Colonna Prezzo Cliente (€)
    if (thPrezzo && labelPrezzo && indicatorPrezzo) {
        if (currentProductSortColumn === 'prezzo') {
            thPrezzo.className = "px-4 py-3 text-[11px] font-black uppercase tracking-wider cursor-pointer select-none bg-amber-500/15 border-b-2 border-brand-gold text-amber-950 transition-all w-28";
            labelPrezzo.className = "text-amber-950 font-black";
            if (currentProductSortDirection === 'desc') {
                indicatorPrezzo.innerHTML = `<span class="inline-flex items-center justify-center w-5 h-5 rounded bg-brand-gold text-white font-black text-xs shadow-xs" title="Decrescente (Alto → Basso)">↓</span>`;
                thPrezzo.title = "Ordinamento attivo: Prezzo (€) dal più alto al più basso. Clicca per ordinare dal più basso al più alto.";
            } else {
                indicatorPrezzo.innerHTML = `<span class="inline-flex items-center justify-center w-5 h-5 rounded bg-brand-gold text-white font-black text-xs shadow-xs" title="Crescente (Basso → Alto)">↑</span>`;
                thPrezzo.title = "Ordinamento attivo: Prezzo (€) dal più basso al più alto. Clicca per rimuovere l'ordinamento.";
            }
        } else {
            thPrezzo.className = "px-4 py-3 text-[11px] font-bold uppercase tracking-wider cursor-pointer select-none transition-all group hover:bg-slate-100/80 w-28";
            labelPrezzo.className = "text-slate-400 group-hover:text-slate-700 transition-colors";
            indicatorPrezzo.innerHTML = `<span class="text-slate-400 group-hover:text-slate-600 font-bold transition-colors">↕</span>`;
            thPrezzo.title = "Clicca per ordinare per Prezzo (€) dal più alto al più basso";
        }
    }

    // Colonna Prezzo Fornitore ($)
    if (thFornitore && labelFornitore && indicatorFornitore) {
        if (currentProductSortColumn === 'prezzo_fornitore') {
            thFornitore.className = "px-4 py-3 text-[11px] font-black uppercase tracking-wider cursor-pointer select-none bg-amber-500/15 border-b-2 border-brand-gold text-amber-950 transition-all w-36";
            labelFornitore.className = "text-amber-950 font-black";
            if (currentProductSortDirection === 'desc') {
                indicatorFornitore.innerHTML = `<span class="inline-flex items-center justify-center w-5 h-5 rounded bg-brand-gold text-white font-black text-xs shadow-xs" title="Decrescente (Alto → Basso)">↓</span>`;
                thFornitore.title = "Ordinamento attivo: Prezzo Fornitore ($) dal più alto al più basso. Clicca per ordinare dal più basso al più alto.";
            } else {
                indicatorFornitore.innerHTML = `<span class="inline-flex items-center justify-center w-5 h-5 rounded bg-brand-gold text-white font-black text-xs shadow-xs" title="Crescente (Basso → Alto)">↑</span>`;
                thFornitore.title = "Ordinamento attivo: Prezzo Fornitore ($) dal più basso al più alto. Clicca per rimuovere l'ordinamento.";
            }
        } else {
            thFornitore.className = "px-4 py-3 text-[11px] font-bold uppercase tracking-wider cursor-pointer select-none transition-all group hover:bg-slate-100/80 w-36";
            labelFornitore.className = "text-slate-400 group-hover:text-slate-700 transition-colors";
            indicatorFornitore.innerHTML = `<span class="text-slate-400 group-hover:text-slate-600 font-bold transition-colors">↕</span>`;
            thFornitore.title = "Clicca per ordinare per Prezzo Fornitore ($) dal più alto al più basso";
        }
    }

    // Banner riassuntivo
    if (activeSortBanner && activeSortText) {
        if (currentProductSortColumn) {
            const nomeCol = currentProductSortColumn === 'prezzo' ? 'Prezzo Cliente (€)' : 'Prezzo Fornitore ($)';
            const dirLabel = currentProductSortDirection === 'desc' 
                ? '<strong>dal più alto al più basso (↓)</strong>' 
                : '<strong>dal più basso al più alto (↑)</strong>';
            activeSortText.innerHTML = `Ordinamento numerico attivo: <strong>${nomeCol}</strong> ${dirLabel}`;
            activeSortBanner.classList.remove('hidden');
        } else {
            activeSortBanner.classList.add('hidden');
        }
    }
}
window.aggiornaIndicatoriOrdinamento = aggiornaIndicatoriOrdinamento;

/**
 * Trova un prodotto dato il suo identificatore univoco reale (id o legacy_id),
 * senza mai basarsi su indici di array, posizione della riga o pagina corrente.
 */
function trovaProdottoPerId(productId) {
    if (productId === undefined || productId === null || productId === '') return null;
    const targetIdStr = String(productId).trim();
    const targetIdNum = Number(targetIdStr);

    // 1. Cerca nell'array globale master dei prodotti (per ID primario)
    let prod = prodotti.find(p => p && String(p.id).trim() === targetIdStr);
    if (prod) return prod;

    // 2. Cerca nell'array globale master dei prodotti (per legacy_id)
    prod = prodotti.find(p => p && p.legacy_id !== undefined && p.legacy_id !== null && String(p.legacy_id).trim() === targetIdStr);
    if (prod) return prod;

    // 3. Fallback per corrispondenza numerica diretta
    if (!isNaN(targetIdNum)) {
        prod = prodotti.find(p => p && (Number(p.id) === targetIdNum || Number(p.legacy_id) === targetIdNum));
        if (prod) return prod;
    }

    // 4. Fallback di sicurezza: cerca nella lista filtrata/ordinata corrente
    if (Array.isArray(currentFilteredProductsList)) {
        prod = currentFilteredProductsList.find(p => p && (
            String(p.id).trim() === targetIdStr || 
            (p.legacy_id !== undefined && p.legacy_id !== null && String(p.legacy_id).trim() === targetIdStr) ||
            (!isNaN(targetIdNum) && (Number(p.id) === targetIdNum || Number(p.legacy_id) === targetIdNum))
        ));
        if (prod) return prod;
    }

    // 5. Fallback di sicurezza: cerca nella lista paginata corrente
    if (Array.isArray(currentPaginatedProductsList)) {
        prod = currentPaginatedProductsList.find(p => p && (
            String(p.id).trim() === targetIdStr || 
            (p.legacy_id !== undefined && p.legacy_id !== null && String(p.legacy_id).trim() === targetIdStr) ||
            (!isNaN(targetIdNum) && (Number(p.id) === targetIdNum || Number(p.legacy_id) === targetIdNum))
        ));
        if (prod) return prod;
    }

    return null;
}
window.trovaProdottoPerId = trovaProdottoPerId;

let isProductsTableDelegationInitialized = false;

/**
 * Inizializza l'Event Delegation stabile sul contenitore della tabella prodotti.
 * Garantisce che i click sui pulsanti Modifica / Elimina funzionino sempre
 * recuperando direttamente l'ID reale (data-product-id), indipendentemente
 * da filtri, ordinamento per prezzo o paginazione.
 */
function inizializzaDelegazioneEventiTabellaProdotti() {
    if (isProductsTableDelegationInitialized) return;

    document.addEventListener('click', (e) => {
        // 1. Pulsante Modifica Prodotto
        const editBtn = e.target.closest('[data-action="edit"], .btn-modifica-prodotto, .btn-edit-product, button[title="Modifica"]');
        if (editBtn && editBtn.closest('#products-table-body, #products-table')) {
            e.preventDefault();
            e.stopPropagation();
            const productId = editBtn.getAttribute('data-product-id') || editBtn.closest('tr')?.getAttribute('data-product-id');
            if (productId) {
                preparaModificaProdotto(productId);
            }
            return;
        }

        // 2. Pulsante Elimina Prodotto
        const deleteBtn = e.target.closest('[data-action="delete"], .btn-elimina-prodotto, .btn-delete-product, button[title="Elimina"]');
        if (deleteBtn && deleteBtn.closest('#products-table-body, #products-table')) {
            e.preventDefault();
            e.stopPropagation();
            const productId = deleteBtn.getAttribute('data-product-id') || deleteBtn.closest('tr')?.getAttribute('data-product-id');
            if (productId) {
                eliminaProdotto(productId);
            }
            return;
        }
    }, true);

    // Event delegation per le checkbox di selezione dei singoli prodotti
    document.addEventListener('change', (e) => {
        const selectCb = e.target.closest('.product-select-checkbox, [data-action="select"]');
        if (selectCb && selectCb.closest('#products-table-body, #products-table')) {
            const productId = selectCb.getAttribute('data-product-id') || selectCb.value;
            if (productId) {
                toggleSelectProdotto(productId, selectCb.checked);
            }
        }
    }, true);

    isProductsTableDelegationInitialized = true;
}
window.inizializzaDelegazioneEventiTabellaProdotti = inizializzaDelegazioneEventiTabellaProdotti;

function eseguiRicercaProdotti() {
    const searchInput = document.getElementById('search-input');
    activeSearchQuery = searchInput ? searchInput.value : "";
    currentProductsPage = 1;
    renderProdotti();
}
window.eseguiRicercaProdotti = eseguiRicercaProdotti;

function cambiaPaginaProdotti(page) {
    currentProductsPage = page;
    renderProdotti();
}
window.cambiaPaginaProdotti = cambiaPaginaProdotti;

/**
 * UNICA funzione responsabile del rendering della riga prodotto HTML.
 * Riceve l'oggetto prodotto completo e genera SEMPRE tutte le colonne,
 * inclusa obbligatoriamente la colonna AZIONI con i pulsanti ✏️ Modifica e 🗑️ Cestino.
 */
function renderRigaProdotto(p) {
    if (!p) return "";

    const rawId = (p.id !== undefined && p.id !== null && p.id !== '') ? p.id : (p.legacy_id !== undefined && p.legacy_id !== null ? p.legacy_id : '');
    const idProdotto = String(rawId);
    const legacyId = (p.legacy_id !== undefined && p.legacy_id !== null && p.legacy_id !== '') ? p.legacy_id : idProdotto;
    const imgUrl = p.immagine || "";
    const transform = parseImageTransform(imgUrl);
    const squadra = p.squadra || "";
    const categoria = p.categoria || "";
    const versione = p.versione || "";
    const stagione = p.stagione || "";
    const prezzoEuro = Number(p.prezzo || 0).toFixed(2);
    const prezzoFornitore = p.prezzo_fornitore !== null && p.prezzo_fornitore !== undefined ? p.prezzo_fornitore : '';
    const isSelected = selectedProductIds.has(String(idProdotto));

    const idEscaped = escapeHtml(idProdotto);
    const legacyIdEscaped = escapeHtml(String(legacyId));
    const squadraEscaped = escapeHtml(squadra);
    const categoriaEscaped = escapeHtml(categoria);
    const versioneEscaped = escapeHtml(versione);
    const stagioneEscaped = escapeHtml(stagione);
    const imgUrlEscaped = escapeHtml(imgUrl);
    const prezzoFornitoreEscaped = escapeHtml(String(prezzoFornitore));

    return `
        <tr class="hover:bg-slate-800/40 transition-colors ${isSelected ? 'bg-amber-500/10' : ''}" id="row-product-${idEscaped}" data-product-id="${idEscaped}">
            <!-- 1. Checkbox Seleziona -->
            <td class="px-4 py-3 text-center w-12">
                <input type="checkbox" value="${idEscaped}" 
                    data-product-id="${idEscaped}"
                    data-action="select"
                    onchange="toggleSelectProdotto('${idEscaped}', this.checked)" 
                    class="product-select-checkbox rounded border-slate-700 text-amber-600 focus:ring-amber-500 h-4 w-4 cursor-pointer" 
                    ${isSelected ? 'checked' : ''}
                >
            </td>

            <!-- 2. Immagine -->
            <td class="px-4 py-3 w-16 text-center">
                ${imgUrl ? `
                    <div class="h-10 w-10 mx-auto overflow-hidden rounded-lg border border-slate-800 shadow-sm flex items-center justify-center bg-slate-900">
                        <img src="${imgUrlEscaped}" alt="${squadraEscaped}" class="h-full w-full object-contain" style="transform: scale(${transform.zoom}) translate(${transform.x}%, ${transform.y}%); transform-origin: center center;" onerror="this.onerror=null; this.parentNode.parentNode.innerHTML='<div class=\\'h-10 w-10 mx-auto bg-slate-800 rounded-lg flex items-center justify-center text-lg border border-slate-700 shadow-sm\\'>👕</div>';">
                    </div>
                ` : `
                    <div class="h-10 w-10 mx-auto bg-slate-800 rounded-lg flex items-center justify-center text-lg border border-slate-700 shadow-sm">👕</div>
                `}
            </td>
            
            <!-- 3. Squadra e ID reale visibile -->
            <td class="px-4 py-3 font-semibold text-slate-100 text-sm min-w-[140px]">
                <div>${squadraEscaped}</div>
                <div class="text-[10px] text-slate-400 font-mono">ID: ${legacyIdEscaped}</div>
            </td>

            <!-- 4. Categoria -->
            <td class="px-4 py-3 text-slate-300 text-xs w-24">
                <span class="px-2 py-1 bg-slate-800 rounded-full font-semibold text-slate-300 text-[10px] uppercase border border-slate-700/60">${categoriaEscaped}</span>
            </td>

            <!-- 5. Versione -->
            <td class="px-4 py-3 text-slate-300 text-xs truncate max-w-[150px] w-28" title="${versioneEscaped}">
                ${versioneEscaped}
            </td>

            <!-- 6. Stagione -->
            <td class="px-4 py-3 text-slate-300 text-xs font-mono w-24">
                ${stagioneEscaped}
            </td>

            <!-- 7. Prezzo (€) -->
            <td class="px-4 py-3 font-mono font-bold text-amber-400 text-xs w-28">
                € ${prezzoEuro}
            </td>

            <!-- 8. Prezzo Fornitore ($) (Modificabile in tabella) -->
            <td class="px-4 py-3 w-36">
                <div class="flex items-center gap-1.5 group">
                    <span class="text-xs text-slate-400 font-bold">$</span>
                    <input type="number" step="0.01" min="0" 
                        value="${prezzoFornitoreEscaped}" 
                        placeholder="0.00" 
                        data-product-id="${idEscaped}"
                        class="w-20 bg-slate-900 border border-slate-700/80 hover:border-slate-600 focus:border-brand-gold focus:bg-slate-950 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-200 transition-all outline-none"
                        oninput="handleSupplierPriceInput(this, '${idEscaped}')"
                        onkeydown="if(event.key === 'Enter') { event.preventDefault(); saveSupplierPrice('${idEscaped}', this.value); }"
                    >
                    <button id="save-supplier-btn-${idEscaped}" onclick="saveSupplierPrice('${idEscaped}', this.previousElementSibling.value)" 
                        data-product-id="${idEscaped}"
                        data-action="save-supplier-price"
                        class="text-green-400 hover:text-green-300 font-bold text-xs hidden px-1.5 py-1 bg-green-950/60 border border-green-700/50 rounded-md transition-all cursor-pointer" title="Salva">
                        ✓
                    </button>
                </div>
            </td>

            <!-- 9. Azioni: SEMPRE PRESENTE PER OGNI PRODOTTO -->
            <td class="px-4 py-3 text-right whitespace-nowrap w-24 sticky right-0 bg-[#111111] z-10 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.3)]">
                <div class="flex items-center justify-end gap-1.5">
                    <button type="button" 
                        data-action="edit" 
                        data-product-id="${idEscaped}"
                        onclick="preparaModificaProdotto('${idEscaped}')" 
                        class="btn-modifica-prodotto btn-edit-product p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-brand-gold transition-colors cursor-pointer inline-flex items-center justify-center" 
                        title="Modifica">
                        ✏️
                    </button>
                    <button type="button" 
                        data-action="delete" 
                        data-product-id="${idEscaped}"
                        onclick="eliminaProdotto('${idEscaped}')" 
                        class="btn-elimina-prodotto btn-delete-product p-1.5 hover:bg-red-950/40 rounded-lg text-slate-400 hover:text-red-400 transition-colors cursor-pointer inline-flex items-center justify-center" 
                        title="Elimina">
                        🗑️
                    </button>
                </div>
            </td>
        </tr>
    `;
}
window.renderRigaProdotto = renderRigaProdotto;

/**
 * Filtra, ordina numericamente e renderizza i prodotti nella tabella con paginazione a 10 elementi.
 * Ordine di elaborazione:
 * PRODOTTI -> FILTRI -> ORDINAMENTO NUMERICO -> PAGINAZIONE -> renderRigaProdotto
 */
function renderProdotti() {
    const tableBody = document.getElementById('products-table-body');
    if (!tableBody) return;

    // Assicura l'inizializzazione dell'event delegation sul tbody stabile
    inizializzaDelegazioneEventiTabellaProdotti();

    // Aggiorna gli indicatori grafici dell'ordinamento
    aggiornaIndicatoriOrdinamento();

    // Leggi i filtri correnti
    const querySearch = activeSearchQuery || "";
    const querySquadra = document.getElementById('filter-squadra')?.value || "";
    const queryCategoria = document.getElementById('filter-categoria')?.value || "";
    const queryStagione = document.getElementById('filter-stagione')?.value || "";
    const querySenzaFornitore = document.getElementById('filter-senza-fornitore')?.checked || false;

    // 1. FILTRI: Filtra i prodotti dall'array master (senza mutare l'array originale)
    let prodottiFiltrati = prodotti.filter(p => {
        // 1. Filtro Ricerca Istantanea Globale (utilizza activeSearchQuery)
        if (querySearch.trim() !== "") {
            const cleanSearch = normalizeTextForSearch(querySearch);
            const terms = cleanSearch.split(' ').filter(Boolean);

            if (terms.length > 0) {
                // Prepara i sinonimi per il target (ad esempio, 'bambino' -> 'kids', 'child')
                const targetLower = (p.target || "").toLowerCase();
                let targetSynonyms = "";
                if (targetLower.includes("bambino")) {
                    targetSynonyms = "bambino bambini kids kid child children";
                } else if (targetLower.includes("adulto")) {
                    targetSynonyms = "adulto adulti adult adults";
                }

                // Prepara i sinonimi per la versione
                const versioneLower = (p.versione || "").toLowerCase();
                let versioneSynonyms = "";
                if (versioneLower.includes("home")) versioneSynonyms += " casa";
                if (versioneLower.includes("away")) versioneSynonyms += " trasferta";
                if (versioneLower.includes("third")) versioneSynonyms += " terza";
                if (versioneLower.includes("fourth")) versioneSynonyms += " quarta";
                if (versioneLower.includes("special")) versioneSynonyms += " speciale";

                // Combina tutti i campi in un'unica stringa normalizzata di ricerca per il prodotto
                const productSearchText = normalizeTextForSearch([
                    p.nome || "",
                    p.nome_finale || "",
                    p.squadra || "",
                    p.versione || "",
                    versioneSynonyms,
                    p.categoria || "",
                    p.target || "",
                    targetSynonyms,
                    p.stagione || ""
                ].join(" "));

                // Verifica che TUTTI i termini di ricerca siano inclusi nella stringa del prodotto (AND search)
                const matchesAllTerms = terms.every(term => productSearchText.includes(term));
                if (!matchesAllTerms) {
                    return false;
                }
            }
        }

        // 2. Filtro Squadra
        if (querySquadra && p.squadra !== querySquadra) return false;

        // 3. Filtro Categoria
        if (queryCategoria && p.categoria !== queryCategoria) return false;

        // 4. Filtro Stagione
        if (queryStagione && p.stagione !== queryStagione) return false;

        // 5. Filtro Senza Prezzo Fornitore
        if (querySenzaFornitore) {
            const hasNoSupplierPrice = p.prezzo_fornitore === null || p.prezzo_fornitore === undefined || p.prezzo_fornitore === "" || p.prezzo_fornitore === 0;
            if (!hasNoSupplierPrice) return false;
        }

        return true;
    });

    // 2. ORDINAMENTO NUMERICO: Viene applicato PRIMA della paginazione sull'intero set filtrato
    if (currentProductSortColumn) {
        prodottiFiltrati.sort((a, b) => {
            const valA = currentProductSortColumn === 'prezzo' ? a.prezzo : a.prezzo_fornitore;
            const valB = currentProductSortColumn === 'prezzo' ? b.prezzo : b.prezzo_fornitore;
            return comparaValoriNumericiPrezzo(valA, valB, currentProductSortDirection);
        });
    }

    // 3. Memorizza la lista completa dei prodotti filtrati E ordinati per la selezione massiva globale
    currentFilteredProductsList = prodottiFiltrati;

    const paginationContainer = document.getElementById('products-pagination');

    // Se non ci sono prodotti filtrati
    if (prodottiFiltrati.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" class="px-6 py-12 text-center text-slate-400 text-sm">
                    <div class="flex flex-col items-center justify-center gap-3">
                        <span class="text-4xl">🔎</span>
                        <p class="font-semibold text-slate-500">Nessun prodotto corrisponde ai filtri impostati</p>
                        <p class="text-xs text-slate-400">Prova a modificare i termini di ricerca o a reimpostare i filtri.</p>
                    </div>
                </td>
            </tr>
        `;
        if (paginationContainer) {
            paginationContainer.innerHTML = '';
            paginationContainer.classList.add('hidden');
        }
        aggiornaStatoSelezioneMassiva();
        return;
    }

    const totalCount = prodottiFiltrati.length;
    const totalPages = Math.ceil(totalCount / productsPerPage) || 1;

    // Assicurati che la pagina corrente sia valida
    if (currentProductsPage > totalPages) {
        currentProductsPage = totalPages;
    }
    if (currentProductsPage < 1) {
        currentProductsPage = 1;
    }

    const startIndex = (currentProductsPage - 1) * productsPerPage;
    const endIndex = startIndex + productsPerPage;
    const paginatedProducts = prodottiFiltrati.slice(startIndex, endIndex);
    currentPaginatedProductsList = paginatedProducts;

    // 4. RENDERING RIGHE: Genera le righe tramite l'unica funzione renderRigaProdotto(p)
    tableBody.innerHTML = paginatedProducts.map(p => renderRigaProdotto(p)).join('');

    // Renderizza i controlli della paginazione
    if (paginationContainer) {
        paginationContainer.classList.remove('hidden');

        let pagesHtml = '';

        // Tasto Precedente
        const prevDisabled = currentProductsPage === 1;
        pagesHtml += `
            <button onclick="${prevDisabled ? '' : 'cambiaPaginaProdotti(' + (currentProductsPage - 1) + ')'}" 
                class="px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1 ${
                    prevDisabled 
                    ? 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }">
                &larr; Prec.
            </button>
        `;

        pagesHtml += `<div class="flex items-center gap-1">`;

        let startPage = Math.max(1, currentProductsPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4);
        }

        if (startPage > 1) {
            pagesHtml += `
                <button onclick="cambiaPaginaProdotti(1)" class="w-8 h-8 rounded-lg text-xs font-semibold hover:bg-slate-100 text-slate-600">1</button>
                ${startPage > 2 ? '<span class="text-slate-400 text-xs px-1">...</span>' : ''}
            `;
        }

        for (let i = startPage; i <= endPage; i++) {
            if (i >= 1 && i <= totalPages) {
                const isCurrent = i === currentProductsPage;
                pagesHtml += `
                    <button onclick="cambiaPaginaProdotti(${i})" 
                        class="w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                            isCurrent 
                            ? 'bg-brand-gold text-white shadow-sm' 
                            : 'hover:bg-slate-100 text-slate-600 font-semibold'
                        }">
                        ${i}
                    </button>
                `;
            }
        }

        if (endPage < totalPages) {
            pagesHtml += `
                ${endPage < totalPages - 1 ? '<span class="text-slate-400 text-xs px-1">...</span>' : ''}
                <button onclick="cambiaPaginaProdotti(${totalPages})" class="w-8 h-8 rounded-lg text-xs font-semibold hover:bg-slate-100 text-slate-600">${totalPages}</button>
            `;
        }

        pagesHtml += `</div>`;

        // Tasto Successivo
        const nextDisabled = currentProductsPage === totalPages;
        pagesHtml += `
            <button onclick="${nextDisabled ? '' : 'cambiaPaginaProdotti(' + (currentProductsPage + 1) + ')'}" 
                class="px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1 ${
                    nextDisabled 
                    ? 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }">
                Succ. &rarr;
            </button>
        `;

        paginationContainer.innerHTML = `
            <span class="text-xs text-slate-500 font-medium">
                Mostrati <strong class="text-slate-700">${startIndex + 1}-${Math.min(endIndex, totalCount)}</strong> di <strong class="text-slate-700">${totalCount}</strong> prodotti
            </span>
            <div class="flex items-center gap-2">
                ${pagesHtml}
            </div>
        `;
    }

    // Aggiorna lo stato visivo della selezione massiva
    aggiornaStatoSelezioneMassiva();
}

/* =========================================================
   GESTIONE MODIFICA MASSIVA PRODOTTI
   ========================================================= */
let selectedProductIds = new Set();
let currentFilteredProductsList = [];
let currentPaginatedProductsList = [];
let selectionScopeMode = 'tutti'; // 'pagina' oppure 'tutti'
let pendingBatchUpdates = {};

window.cambiaModalitaSelezione = function(mode) {
    selectionScopeMode = mode;
    const btnPagina = document.getElementById('btn-select-scope-pagina');
    const btnTutti = document.getElementById('btn-select-scope-tutti');

    if (btnPagina && btnTutti) {
        if (mode === 'pagina') {
            btnPagina.className = 'px-1.5 py-0.5 rounded-md bg-white text-slate-900 shadow-xs font-bold transition-all cursor-pointer';
            btnTutti.className = 'px-1.5 py-0.5 rounded-md text-slate-500 hover:text-slate-800 transition-all font-semibold cursor-pointer';
        } else {
            btnTutti.className = 'px-1.5 py-0.5 rounded-md bg-white text-slate-900 shadow-xs font-bold transition-all cursor-pointer';
            btnPagina.className = 'px-1.5 py-0.5 rounded-md text-slate-500 hover:text-slate-800 transition-all font-semibold cursor-pointer';
        }
    }
    aggiornaStatoSelezioneMassiva();
};

window.toggleSelectProdotto = function(id, isChecked) {
    const strId = String(id);
    if (isChecked) {
        selectedProductIds.add(strId);
    } else {
        selectedProductIds.delete(strId);
    }
    const row = document.getElementById(`row-product-${id}`);
    if (row) {
        if (isChecked) {
            row.classList.add('bg-amber-500/10');
        } else {
            row.classList.remove('bg-amber-500/10');
        }
    }
    aggiornaStatoSelezioneMassiva();
};

window.toggleSelectAllProducts = function(isChecked) {
    const targetList = (selectionScopeMode === 'pagina') ? currentPaginatedProductsList : currentFilteredProductsList;
    if (!targetList || targetList.length === 0) return;

    if (isChecked) {
        targetList.forEach(p => {
            const pId = (p.id !== undefined && p.id !== null && p.id !== '') ? p.id : p.legacy_id;
            selectedProductIds.add(String(pId));
        });
    } else {
        targetList.forEach(p => {
            const pId = (p.id !== undefined && p.id !== null && p.id !== '') ? p.id : p.legacy_id;
            selectedProductIds.delete(String(pId));
        });
    }
    renderProdotti();
    aggiornaStatoSelezioneMassiva();
};

window.deselezionaTuttiProdotti = function() {
    selectedProductIds.clear();
    const selectAllCb = document.getElementById('select-all-products-checkbox');
    if (selectAllCb) selectAllCb.checked = false;
    renderProdotti();
    aggiornaStatoSelezioneMassiva();
};

function aggiornaStatoSelezioneMassiva() {
    const count = selectedProductIds.size;
    const actionBar = document.getElementById('batch-edit-action-bar');
    const countSpan = document.getElementById('batch-selected-count');
    const selectAllCb = document.getElementById('select-all-products-checkbox');

    if (actionBar) {
        if (count >= 1) {
            actionBar.classList.remove('hidden');
            if (countSpan) {
                countSpan.textContent = count === 1 ? `1 prodotto selezionato` : `${count} prodotti selezionati`;
            }
        } else {
            actionBar.classList.add('hidden');
        }
    }

    if (selectAllCb) {
        const targetList = (selectionScopeMode === 'pagina') ? currentPaginatedProductsList : currentFilteredProductsList;
        if (targetList && targetList.length > 0) {
            const allChecked = targetList.every(p => {
                const pId = (p.id !== undefined && p.id !== null && p.id !== '') ? p.id : p.legacy_id;
                return selectedProductIds.has(String(pId));
            });
            selectAllCb.checked = allChecked;
        } else {
            selectAllCb.checked = false;
        }
    }
}

window.apriPannelloModificaMassiva = function() {
    if (selectedProductIds.size < 1) {
        showToast("Seleziona almeno 1 prodotto per la modifica massiva.", "warning");
        return;
    }

    aggiornaMenuCategorieForm();
    aggiornaMenuFiltriCatalogoForm();

    const modal = document.getElementById('batch-edit-products-modal');
    const subtitle = document.getElementById('batch-edit-subtitle');
    if (subtitle) {
        subtitle.textContent = `Modifica per ${selectedProductIds.size} prodotti selezionati`;
    }

    // Reset campi form Modifica Campi Comuni
    const elemSquadra = document.getElementById('batch-squadra');
    const elemCategoria = document.getElementById('batch-categoria');
    const elemTipo = document.getElementById('batch-tipo');
    const elemTarget = document.getElementById('batch-target');
    const elemVersioneSelect = document.getElementById('batch-versione-select');
    const elemVersioneCustom = document.getElementById('batch-versione-custom');
    const elemStagione = document.getElementById('batch-stagione');
    const elemDisponibilita = document.getElementById('batch-disponibilita');
    const elemPrezzo = document.getElementById('batch-prezzo');
    const elemFiltroCatalogo = document.getElementById('batch-filtro-catalogo');
    const elemTag = document.getElementById('batch-tag');

    if (elemSquadra) elemSquadra.value = '';
    if (elemCategoria) elemCategoria.value = '';
    if (elemTipo) elemTipo.value = '';
    if (elemTarget) elemTarget.value = '';
    if (elemVersioneSelect) elemVersioneSelect.value = '';
    if (elemVersioneCustom) {
        elemVersioneCustom.value = '';
        elemVersioneCustom.classList.add('hidden');
    }
    if (elemStagione) elemStagione.value = '';
    if (elemDisponibilita) elemDisponibilita.value = '';
    if (elemPrezzo) elemPrezzo.value = '';
    if (elemFiltroCatalogo) elemFiltroCatalogo.value = '';
    if (elemTag) elemTag.value = '';

    // Reset campi Trova e Sostituisci
    const elemSearch = document.getElementById('findreplace-search');
    const elemReplace = document.getElementById('findreplace-replace');
    const elemCase = document.getElementById('findreplace-case-sensitive');
    const elemWord = document.getElementById('findreplace-whole-word');
    if (elemSearch) elemSearch.value = '';
    if (elemReplace) elemReplace.value = '';
    if (elemCase) elemCase.checked = false;
    if (elemWord) elemWord.checked = false;

    // Default tab: comune
    if (typeof switchBatchModalTab === 'function') {
        switchBatchModalTab('common');
    }

    if (modal) {
        modal.classList.remove('hidden');
    }
};

window.chiudiPannelloModificaMassiva = function() {
    const modal = document.getElementById('batch-edit-products-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
};

// --- LOGICA MODIFICA MASSIVA: TROVA E SOSTITUISCI ---
let findreplacePendingList = [];

function applicaFindReplaceAStringa(originale, trova, sostituisci, caseSensitive, soloParolaIntera) {
    if (originale === null || originale === undefined) return '';
    const strOriginale = String(originale);
    if (!trova) return strOriginale;

    // Escape dei caratteri speciali per Regex
    const escapedTrova = trova.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let pattern = escapedTrova;

    if (soloParolaIntera) {
        pattern = `\\b${pattern}\\b`;
    }

    const flags = caseSensitive ? 'g' : 'gi';
    try {
        const regex = new RegExp(pattern, flags);
        return strOriginale.replace(regex, sostituisci || '');
    } catch (e) {
        console.error("Errore regex find&replace:", e);
        return strOriginale;
    }
}

window.switchBatchModalTab = function(tabName) {
    const btnCommon = document.getElementById('tab-btn-batch-common');
    const btnFindReplace = document.getElementById('tab-btn-batch-findreplace');
    const contentCommon = document.getElementById('batch-tab-content-common');
    const contentFindReplace = document.getElementById('batch-tab-content-findreplace');

    if (tabName === 'findreplace') {
        if (btnCommon) {
            btnCommon.classList.remove('border-brand-gold', 'text-amber-700');
            btnCommon.classList.add('border-transparent', 'text-slate-500');
        }
        if (btnFindReplace) {
            btnFindReplace.classList.remove('border-transparent', 'text-slate-500');
            btnFindReplace.classList.add('border-brand-gold', 'text-amber-700');
        }
        if (contentCommon) contentCommon.classList.add('hidden');
        if (contentFindReplace) contentFindReplace.classList.remove('hidden');

        calcolaAnteprimaFindReplace();
    } else {
        if (btnCommon) {
            btnCommon.classList.remove('border-transparent', 'text-slate-500');
            btnCommon.classList.add('border-brand-gold', 'text-amber-700');
        }
        if (btnFindReplace) {
            btnFindReplace.classList.remove('border-brand-gold', 'text-amber-700');
            btnFindReplace.classList.add('border-transparent', 'text-slate-500');
        }
        if (contentCommon) contentCommon.classList.remove('hidden');
        if (contentFindReplace) contentFindReplace.classList.add('hidden');
    }
};

window.calcolaAnteprimaFindReplace = function() {
    const fieldSelect = document.getElementById('findreplace-field');
    const searchInput = document.getElementById('findreplace-search');
    const replaceInput = document.getElementById('findreplace-replace');
    const caseSensitiveCb = document.getElementById('findreplace-case-sensitive');
    const wholeWordCb = document.getElementById('findreplace-whole-word');

    const badge = document.getElementById('findreplace-preview-badge');
    const container = document.getElementById('findreplace-preview-container');
    const footerCount = document.getElementById('findreplace-footer-count');
    const btnApplica = document.getElementById('btn-applica-findreplace');

    const campo = fieldSelect ? fieldSelect.value : 'nome';
    const trova = searchInput ? searchInput.value : '';
    const sostituisci = replaceInput ? replaceInput.value : '';
    const caseSensitive = caseSensitiveCb ? caseSensitiveCb.checked : false;
    const wholeWord = wholeWordCb ? wholeWordCb.checked : false;

    const totalSelected = selectedProductIds.size;
    if (footerCount) {
        footerCount.textContent = `${totalSelected} prodotti selezionati`;
    }

    findreplacePendingList = [];

    const labelCampi = {
        'nome': 'Nome prodotto',
        'versione': 'Versione',
        'squadra': 'Squadra',
        'stagione': 'Stagione',
        'descrizione': 'Descrizione'
    };
    const nomeCampoLeggibile = labelCampi[campo] || campo;

    if (!trova || trova.trim() === '') {
        if (badge) badge.textContent = "Inserisci testo per generare l'anteprima";
        if (container) {
            container.innerHTML = `<div class="text-center py-6 text-xs text-slate-400 font-medium">
                Digita la parola o frase da cercare nel campo <strong>"${escapeHtml(nomeCampoLeggibile)}"</strong> per visualizzare l'anteprima sui prodotti selezionati.
            </div>`;
        }
        if (btnApplica) {
            btnApplica.disabled = true;
            btnApplica.className = "px-5 py-2.5 rounded-xl bg-slate-200 text-slate-400 text-xs font-extrabold transition-all flex items-center gap-2 cursor-not-allowed";
            btnApplica.innerHTML = `<span>🔄 Applica Sostituzione</span>`;
        }
        return;
    }

    const selectedProds = (prodotti || []).filter(p => selectedProductIds.has(String(p.id)));

    selectedProds.forEach(p => {
        let val = '';
        if (campo === 'nome') val = p.nome || p.title || '';
        else if (campo === 'versione') val = p.versione || '';
        else if (campo === 'squadra') val = p.squadra || '';
        else if (campo === 'stagione') val = p.stagione || '';
        else if (campo === 'descrizione') val = p.descrizione || p.description || '';

        const nuovoValore = applicaFindReplaceAStringa(val, trova, sostituisci, caseSensitive, wholeWord);

        if (val !== nuovoValore) {
            findreplacePendingList.push({
                id: p.id,
                prodotto: p,
                vecchioValore: val,
                nuovoValore: nuovoValore,
                campo: campo
            });
        }
    });

    const modifiedCount = findreplacePendingList.length;

    if (modifiedCount === 0) {
        if (badge) badge.textContent = "0 prodotti interessati";
        if (container) {
            container.innerHTML = `<div class="bg-amber-50 border border-amber-200/80 rounded-xl p-6 text-center text-xs text-amber-900 space-y-1 my-2">
                <p class="font-extrabold text-sm">⚠️ Nessuna corrispondenza trovata</p>
                <p class="text-amber-800">Nessun prodotto tra i <strong>${totalSelected}</strong> selezionati contiene il testo "<span class="font-extrabold">${escapeHtml(trova)}</span>" nel campo <strong>${escapeHtml(nomeCampoLeggibile)}</strong>.</p>
            </div>`;
        }
        if (btnApplica) {
            btnApplica.disabled = true;
            btnApplica.className = "px-5 py-2.5 rounded-xl bg-slate-200 text-slate-400 text-xs font-extrabold transition-all flex items-center gap-2 cursor-not-allowed";
            btnApplica.innerHTML = `<span>🔄 Applica Sostituzione</span>`;
        }
    } else {
        if (badge) {
            badge.textContent = `Verranno modificati ${modifiedCount} prodotti`;
        }
        if (btnApplica) {
            btnApplica.disabled = false;
            btnApplica.className = "px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold shadow transition-all flex items-center gap-2 cursor-pointer";
            btnApplica.innerHTML = `<span>🔄 Applica Sostituzione (${modifiedCount})</span>`;
        }

        let html = `
        <div class="mb-3 px-3 py-2 bg-amber-50 rounded-xl border border-amber-200/80 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2">
            <span class="font-extrabold text-amber-900">Verranno modificati ${modifiedCount} prodotti.</span>
            <span class="text-slate-600 font-medium">Campo: <strong>${escapeHtml(nomeCampoLeggibile)}</strong> ("${escapeHtml(trova)}" → "${escapeHtml(sostituisci)}")</span>
        </div>
        <div class="space-y-2">`;

        findreplacePendingList.forEach((item, index) => {
            const prodName = item.prodotto.nome || item.prodotto.title || item.prodotto.squadra || `Prodotto #${item.id}`;
            html += `
            <div class="bg-white border border-slate-200 rounded-xl p-3 shadow-sm text-xs space-y-2 hover:border-amber-300 transition-all">
                <div class="flex items-center justify-between gap-2">
                    <span class="font-extrabold text-slate-900 truncate" title="${escapeHtml(prodName)}">
                        ${index + 1}. ${escapeHtml(prodName)}
                    </span>
                    <span class="text-[10px] font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200 shrink-0">ID: ${escapeHtml(String(item.id))}</span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                    <div class="bg-red-50 text-red-800 p-2 rounded-lg border border-red-100 break-words">
                        <span class="font-sans font-extrabold text-red-600 text-[10px] block uppercase tracking-wider mb-0.5">Prima</span>
                        ${escapeHtml(item.vecchioValore || '(vuoto)')}
                    </div>
                    <div class="bg-emerald-50 text-emerald-900 p-2 rounded-lg border border-emerald-100 break-words font-extrabold">
                        <span class="font-sans font-extrabold text-emerald-700 text-[10px] block uppercase tracking-wider mb-0.5">Dopo</span>
                        ${escapeHtml(item.nuovoValore || '(vuoto)')}
                    </div>
                </div>
            </div>`;
        });

        html += `</div>`;
        if (container) container.innerHTML = html;
    }
};

window.confermaEseguiFindReplace = async function() {
    if (!findreplacePendingList || findreplacePendingList.length === 0) {
        showToast("Nessun prodotto valido da modificare con i criteri inseriti.", "warning");
        return;
    }

    const searchInput = document.getElementById('findreplace-search');
    const replaceInput = document.getElementById('findreplace-replace');
    const fieldSelect = document.getElementById('findreplace-field');

    const trova = searchInput ? searchInput.value : '';
    const sostituisci = replaceInput ? replaceInput.value : '';
    const campo = fieldSelect ? fieldSelect.value : 'nome';

    const labelCampi = {
        'nome': 'Nome prodotto',
        'versione': 'Versione',
        'squadra': 'Squadra',
        'stagione': 'Stagione',
        'descrizione': 'Descrizione'
    };
    const nomeCampoLeggibile = labelCampi[campo] || campo;

    const count = findreplacePendingList.length;
    const msg = `Sei sicuro di voler sostituire "${trova}" con "${sostituisci}" nel campo "${nomeCampoLeggibile}" per ${count} prodotti?`;

    if (!confirm(msg)) {
        return;
    }

    const btnApplica = document.getElementById('btn-applica-findreplace');
    const originalContent = btnApplica ? btnApplica.innerHTML : '';

    try {
        if (btnApplica) {
            btnApplica.disabled = true;
            btnApplica.innerHTML = `<span>⏳ Applicazione sostituzioni...</span>`;
        }

        const itemsPayload = findreplacePendingList.map(item => {
            const updates = {};
            const c = item.campo;
            if (c === 'nome') {
                updates.nome = item.nuovoValore;
                if (item.prodotto.title !== undefined) updates.title = item.nuovoValore;
            } else if (c === 'versione') {
                updates.versione = item.nuovoValore;
            } else if (c === 'squadra') {
                updates.squadra = item.nuovoValore;
            } else if (c === 'stagione') {
                updates.stagione = item.nuovoValore;
            } else if (c === 'descrizione') {
                updates.descrizione = item.nuovoValore;
                if (item.prodotto.description !== undefined) updates.description = item.nuovoValore;
            }
            return { id: item.id, updates };
        });

        const response = await fetch('/api/products/batch-custom-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: itemsPayload })
        });

        const data = await response.json();

        if (data && data.success) {
            showToast(`Sostituzione completata con successo su ${data.count || count} prodotti!`, "success");

            findreplacePendingList.forEach(item => {
                const prod = (prodotti || []).find(p => String(p.id) === String(item.id));
                if (prod) {
                    const c = item.campo;
                    if (c === 'nome') {
                        prod.nome = item.nuovoValore;
                        if (prod.title !== undefined) prod.title = item.nuovoValore;
                    } else if (c === 'versione') {
                        prod.versione = item.nuovoValore;
                    } else if (c === 'squadra') {
                        prod.squadra = item.nuovoValore;
                    } else if (c === 'stagione') {
                        prod.stagione = item.nuovoValore;
                    } else if (c === 'descrizione') {
                        prod.descrizione = item.nuovoValore;
                        if (prod.description !== undefined) prod.description = item.nuovoValore;
                    }
                }
            });

            chiudiPannelloModificaMassiva();
            selectedProductIds.clear();

            if (typeof renderProdottiTabella === 'function') {
                renderProdottiTabella();
            } else if (typeof renderProdotti === 'function') {
                renderProdotti();
            } else {
                await caricaDati();
            }

            if (typeof sincronizzaReportDuplicati === 'function') {
                sincronizzaReportDuplicati();
            }

            aggiornaStatoSelezioneMassiva();
        } else {
            showToast("Errore durante la sostituzione: " + (data ? data.error : 'Errore sconosciuto'), "error");
        }
    } catch (err) {
        console.error("Errore durante Trova e Sostituisci:", err);
        showToast("Errore di connessione durante l'operazione.", "error");
    } finally {
        if (btnApplica) {
            btnApplica.disabled = false;
            btnApplica.innerHTML = originalContent;
        }
    }
};

window.toggleBatchVersioneCustom = function(val) {
    const customInput = document.getElementById('batch-versione-custom');
    if (customInput) {
        if (val === 'custom') {
            customInput.classList.remove('hidden');
            customInput.focus();
        } else {
            customInput.classList.add('hidden');
        }
    }
};

window.preparaConfermaModificaMassiva = function() {
    const squadra = (document.getElementById('batch-squadra')?.value || '').trim();
    const categoria = (document.getElementById('batch-categoria')?.value || '').trim();
    const tipo = (document.getElementById('batch-tipo')?.value || '').trim();
    const target = (document.getElementById('batch-target')?.value || '').trim();

    const versioneSel = (document.getElementById('batch-versione-select')?.value || '').trim();
    const versioneCust = (document.getElementById('batch-versione-custom')?.value || '').trim();
    let versione = versioneSel === 'custom' ? versioneCust : versioneSel;

    const stagione = (document.getElementById('batch-stagione')?.value || '').trim();
    const disponibilita = (document.getElementById('batch-disponibilita')?.value || '').trim();
    const prezzo = (document.getElementById('batch-prezzo')?.value || '').trim();
    const filtroCatalogo = (document.getElementById('batch-filtro-catalogo')?.value || '').trim();
    const tag = (document.getElementById('batch-tag')?.value || '').trim();

    pendingBatchUpdates = {};
    const summaryItems = [];

    if (squadra) {
        pendingBatchUpdates.squadra = squadra;
        summaryItems.push(`✓ Squadra → <strong>${squadra}</strong>`);
    }
    if (categoria) {
        pendingBatchUpdates.categoria = categoria;
        summaryItems.push(`✓ Categoria → <strong>${categoria}</strong>`);
    }
    if (tipo) {
        pendingBatchUpdates.tipo = tipo;
        summaryItems.push(`✓ Tipo prodotto → <strong>${tipo}</strong>`);
    }
    if (target) {
        pendingBatchUpdates.target = target;
        summaryItems.push(`✓ Target → <strong>${target}</strong>`);
    }
    if (versione) {
        pendingBatchUpdates.versione = versione;
        summaryItems.push(`✓ Versione → <strong>${versione}</strong>`);
    }
    if (stagione) {
        pendingBatchUpdates.stagione = stagione;
        summaryItems.push(`✓ Stagione → <strong>${stagione}</strong>`);
    }
    if (disponibilita !== '') {
        const isDisp = disponibilita === 'true';
        pendingBatchUpdates.disponibilita = isDisp;
        summaryItems.push(`✓ Disponibilità → <strong>${isDisp ? 'Disponibile (Sì)' : 'Non disponibile (No)'}</strong>`);
    }
    if (prezzo !== '') {
        pendingBatchUpdates.prezzo = prezzo;
        summaryItems.push(`✓ Prezzo di vendita → <strong>€ ${Number(prezzo).toFixed(2)}</strong>`);
    }
    if (filtroCatalogo) {
        pendingBatchUpdates.filtro_catalogo = filtroCatalogo;
        summaryItems.push(`✓ Filtro Catalogo → <strong>${filtroCatalogo}</strong>`);
    }
    if (tag) {
        pendingBatchUpdates.tag = tag;
        summaryItems.push(`✓ Tag → <strong>${tag}</strong>`);
    }

    if (summaryItems.length === 0) {
        showToast("Nessuna modifica inserita. Modifica almeno un campo prima di procedere.", "warning");
        return;
    }

    const confirmCount = document.getElementById('batch-confirm-count');
    if (confirmCount) {
        confirmCount.innerHTML = `Stai per modificare: <strong>${selectedProductIds.size} prodotti</strong>`;
    }

    const changesList = document.getElementById('batch-confirm-changes-list');
    if (changesList) {
        changesList.innerHTML = summaryItems.map(item => `<li>${item}</li>`).join('');
    }

    const confirmModal = document.getElementById('batch-edit-confirm-modal');
    if (confirmModal) {
        confirmModal.classList.remove('hidden');
    }
};

window.chiudiConfermaModificaMassiva = function() {
    const confirmModal = document.getElementById('batch-edit-confirm-modal');
    if (confirmModal) {
        confirmModal.classList.add('hidden');
    }
};

window.eseguiAggiornamentoMassivoBatch = async function() {
    if (selectedProductIds.size < 1 || Object.keys(pendingBatchUpdates).length === 0) {
        showToast("Operazione non valida o nessuna modifica selezionata.", "error");
        return;
    }

    const btnApplica = document.getElementById('btn-applica-modifica-massiva');
    const originalText = btnApplica ? btnApplica.innerHTML : '';

    try {
        if (btnApplica) {
            btnApplica.disabled = true;
            btnApplica.innerHTML = `<span>⏳ Salvataggio in corso...</span>`;
        }

        const idsArray = Array.from(selectedProductIds);
        const response = await fetch('/api/products/batch-update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ids: idsArray,
                updates: pendingBatchUpdates
            })
        });

        const data = await response.json();

        if (data && data.success) {
            showToast(`Modificati con successo ${data.count || idsArray.length} prodotti in batch!`, "success");
            
            // Chiudi i modal
            chiudiConfermaModificaMassiva();
            chiudiPannelloModificaMassiva();

            // Deseleziona prodotti
            selectedProductIds.clear();

            // Ricarica i dati per aggiornare la tabella
            await caricaDati();
        } else {
            showToast("Errore durante l'aggiornamento batch: " + (data ? data.error : 'Errore sconosciuto'), "error");
        }
    } catch (err) {
        console.error("Errore durante l'aggiornamento batch prodotti:", err);
        showToast("Errore di connessione durante la modifica massiva.", "error");
    } finally {
        if (btnApplica) {
            btnApplica.disabled = false;
            btnApplica.innerHTML = originalText;
        }
    }
};

/**
 * Gestisce l'apparizione del pulsante di salvataggio rapido quando il prezzo fornitore viene modificato
 */
function handleSupplierPriceInput(input, productId) {
    const saveBtn = document.getElementById(`save-supplier-btn-${productId}`);
    if (saveBtn) {
        saveBtn.classList.remove('hidden');
    }
}

/**
 * Salva rapidamente il prezzo fornitore direttamente dalla tabella
 */
async function saveSupplierPrice(productId, value) {
    const numericValue = value !== "" ? parseFloat(value) : null;
    const saveBtn = document.getElementById(`save-supplier-btn-${productId}`);

    try {
        const supabase = await window.getSupabaseClient();
        const { error } = await supabase
            .from('products')
            .update({ prezzo_fornitore: numericValue })
            .eq('id', productId);

        if (!error) {
            showToast("Prezzo fornitore salvato!", "success");
            
            // Aggiorna l'array locale
            const idx = prodotti.findIndex(p => String(p.id) === String(productId));
            if (idx !== -1) {
                prodotti[idx].prezzo_fornitore = numericValue;
            }

            // Nascondi il pulsante di salvataggio
            if (saveBtn) {
                saveBtn.classList.add('hidden');
            }

            // Aggiorna le statistiche della dashboard
            aggiornaStatisticheDashboard();

            // Ricarica la tabella (questo gestisce anche la sparizione automatica se il filtro "Senza prezzo fornitore" è attivo)
            renderProdotti();
        } else {
            showToast("Errore durante il salvataggio: " + error.message, "error");
        }
    } catch (err) {
        console.error("Errore salvataggio rapido prezzo fornitore:", err);
        showToast("Errore di connessione.", "error");
    }
}

/**
 * Gestisce il salvataggio (creazione o modifica) del prodotto tramite form nel modal
 */
async function salvaProdotto() {
    const id = document.getElementById('form-id').value;
    const tipo = document.getElementById('form-tipo').value;
    const rawSquadra = document.getElementById('form-squadra').value.trim();
    const squadreEsistenti = [...new Set(prodotti.map(p => p.squadra).filter(Boolean))].sort();
    const squadra = normalizzaNomeSquadra(rawSquadra, squadreEsistenti);
    
    // Aggiorna l'input nella form con il nome normalizzato
    document.getElementById('form-squadra').value = squadra;

    const categoria = document.getElementById('form-categoria').value.trim();
    const filtro_catalogo = (document.getElementById('form-filtro-catalogo')?.value || '').trim();
    const stagione = document.getElementById('form-stagione').value.trim();
    
    const versioneSelect = document.getElementById('form-versione-select').value;
    const versioneInput = document.getElementById('form-versione').value.trim();
    const versione = versioneSelect === 'custom' ? versioneInput : versioneSelect;

    const prezzo = parseFloat(document.getElementById('form-prezzo').value) || 23.99;
    
    const inputFornitore = document.getElementById('form-prezzo-fornitore').value;
    const prezzo_fornitore = inputFornitore !== "" ? parseFloat(inputFornitore) : null;
    
    const rawImmagine = document.getElementById('form-immagine').value.trim();
    const zoom = parseFloat(document.getElementById('editor-zoom')?.value) || 1.2;
    const x = parseFloat(document.getElementById('editor-x')?.value) || 0;
    const y = parseFloat(document.getElementById('editor-y')?.value) || 0;
    const immagine = buildImageUrlWithTransform(rawImmagine, zoom, x, y);

    const target = document.getElementById('form-target').value;

    const formattedVersione = formattaNomenclaturaVersione(squadra, categoria, versione, stagione);

    const payload = {
        squadra: traduciTestoProdotto(squadra),
        categoria,
        filtro_catalogo,
        target,
        tipo,
        stagione,
        versione: traduciTestoProdotto(formattedVersione),
        prezzo,
        prezzo_fornitore,
        immagine
    };

    const isModifica = id !== "";
    
    try {
        const supabase = await window.getSupabaseClient();
        let resultError = null;

        if (isModifica) {
            const { error } = await supabase
                .from('products')
                .update(payload)
                .eq('id', id);
            resultError = error;
        } else {
            // Genera legacy_id incrementale univoco sul client
            const newLegacyId = prodotti.length > 0 ? Math.max(...prodotti.map(p => Number(p.legacy_id) || 0)) + 1 : 1;
            payload.legacy_id = newLegacyId;

            const { error } = await supabase
                .from('products')
                .insert([payload]);
            resultError = error;
        }

        if (!resultError) {
            showToast(isModifica ? "Prodotto modificato con successo!" : "Prodotto aggiunto con successo!", "success");
            closeAddProductModal();
            resetFormProdotto();
            
            // Ricarica i dati per sincronizzarsi al 100% con la sorgente dati reale
            await caricaDati();
            sincronizzaReportDuplicati();
            if (typeof sincronizzaReportSenzaFiltro === 'function') sincronizzaReportSenzaFiltro();
        } else {
            showToast("Errore durante il salvataggio: " + resultError.message, "error");
        }
    } catch (err) {
        console.error("Errore durante il salvataggio del prodotto:", err);
        showToast("Errore di connessione.", "error");
    }
}

/**
 * Riempie il form con i dati del prodotto selezionato per la modifica
 * identificando il prodotto in modo univoco tramite il suo ID reale.
 */
function preparaModificaProdotto(productId) {
    const prod = trovaProdottoPerId(productId);
    if (!prod) {
        console.error("Prodotto non trovato nel database per ID:", productId);
        showToast("Prodotto non trovato nel database", "error");
        return;
    }

    // Aggiorna le opzioni dei menu a tendina dinamici prima di impostare i valori
    if (typeof aggiornaMenuCategorieForm === 'function') {
        aggiornaMenuCategorieForm();
    }
    if (typeof aggiornaMenuFiltriCatalogoForm === 'function') {
        aggiornaMenuFiltriCatalogoForm();
    }

    // Popola il form con l'ID reale e i dati del prodotto
    const formId = document.getElementById('form-id');
    if (formId) formId.value = prod.id !== undefined && prod.id !== null ? prod.id : "";

    const formSquadra = document.getElementById('form-squadra');
    if (formSquadra) formSquadra.value = prod.squadra || "";

    const formCategoria = document.getElementById('form-categoria');
    if (formCategoria) formCategoria.value = prod.categoria || "";

    const elFiltro = document.getElementById('form-filtro-catalogo');
    if (elFiltro) {
        elFiltro.value = prod.filtro_catalogo || "";
    }

    const formTarget = document.getElementById('form-target');
    if (formTarget) formTarget.value = prod.target || "Adulto";

    const formTipo = document.getElementById('form-tipo');
    if (formTipo) formTipo.value = prod.tipo || "Club";

    const formStagione = document.getElementById('form-stagione');
    if (formStagione) formStagione.value = prod.stagione || "";
    
    const versioneSelect = document.getElementById('form-versione-select');
    const versioneInput = document.getElementById('form-versione');
    const v = prod.versione || "";
    const standardVersions = ["Home", "Away", "Third", "Fourth", "Goalkeeper", "Training", "Concept", "Special Edition"];
    if (versioneSelect && versioneInput) {
        if (standardVersions.includes(v)) {
            versioneSelect.value = v;
            versioneInput.value = v;
            versioneInput.classList.add('hidden');
            versioneInput.required = false;
        } else {
            versioneSelect.value = "custom";
            versioneInput.value = v;
            versioneInput.classList.remove('hidden');
            versioneInput.required = true;
        }
    }

    const formPrezzo = document.getElementById('form-prezzo');
    if (formPrezzo) formPrezzo.value = prod.prezzo !== undefined && prod.prezzo !== null ? prod.prezzo : "23.99";

    const formPrezzoFornitore = document.getElementById('form-prezzo-fornitore');
    if (formPrezzoFornitore) formPrezzoFornitore.value = prod.prezzo_fornitore !== null && prod.prezzo_fornitore !== undefined ? prod.prezzo_fornitore : "";

    const formImmagine = document.getElementById('form-immagine');
    if (formImmagine) formImmagine.value = prod.immagine || "";

    // Decodifica zoom, x, y dall'immagine
    if (typeof parseImageTransform === 'function') {
        const transform = parseImageTransform(prod.immagine);
        const zoomSlider = document.getElementById('editor-zoom');
        const xSlider = document.getElementById('editor-x');
        const ySlider = document.getElementById('editor-y');
        if (zoomSlider) zoomSlider.value = transform.zoom;
        if (xSlider) xSlider.value = transform.x;
        if (ySlider) ySlider.value = transform.y;
    }

    // Forza l'aggiornamento dell'anteprima
    if (typeof aggiornaEditorImmagine === 'function') {
        aggiornaEditorImmagine();
    }

    // Aggiorna titolo del modal mostrando legacy_id o id come ID del prodotto
    const modalTitle = document.getElementById('modal-title');
    if (modalTitle) {
        const displayId = prod.legacy_id !== undefined && prod.legacy_id !== null ? prod.legacy_id : prod.id;
        modalTitle.innerText = `Modifica Prodotto (ID: ${displayId})`;
    }

    // Apre il modal
    openAddProductModal();
}

/**
 * Gestisce l'eliminazione di un prodotto tramite il suo ID reale
 */
async function eliminaProdotto(productId) {
    const prod = trovaProdottoPerId(productId);
    const realId = prod ? prod.id : productId;
    const legacyIdText = prod ? ` con ID ${prod.legacy_id || prod.id}` : '';
    
    const chiediConferma = !window.appSettings || window.appSettings.sicurezza?.conferma_elimina_prodotto !== false;
    let confirmed = true;
    if (chiediConferma) {
        confirmed = confirm(`Sei sicuro di voler eliminare definitivamente il prodotto${legacyIdText}? Questa operazione aggiornerà direttamente il database di Supabase.`);
    }

    if (confirmed) {
        try {
            const supabase = await window.getSupabaseClient();
            const { error } = await supabase
                .from('products')
                .delete()
                .eq('id', realId);

            if (!error) {
                showToast("Prodotto eliminato con successo!", "success");
                await caricaDati();
                sincronizzaReportDuplicati();
            } else {
                showToast("Errore durante l'eliminazione: " + error.message, "error");
            }
        } catch (err) {
            console.error("Errore durante l'eliminazione del prodotto:", err);
            showToast("Errore di connessione.", "error");
        }
    }
}

/**
 * Resetta i campi del form prodotto
 */
function resetFormProdotto() {
    const form = document.getElementById('add-product-form');
    if (form) {
        form.reset();
    }
    document.getElementById('form-id').value = "";
    
    // Carica valori predefiniti da settings se presenti
    const defs = (window.appSettings && window.appSettings.valoriPredefiniti) ? window.appSettings.valoriPredefiniti : {
        "stagione": "2024/2025",
        "categoria": "Kit",
        "versione": "Home"
    };

    const dStagione = document.getElementById('form-stagione');
    if (dStagione) dStagione.value = defs.stagione;

    const dCategoria = document.getElementById('form-categoria');
    if (dCategoria) dCategoria.value = defs.categoria;

    const dTarget = document.getElementById('form-target');
    if (dTarget) dTarget.value = "Adulto";

    const versioneSelect = document.getElementById('form-versione-select');
    const versioneInput = document.getElementById('form-versione');
    
    // Se la versione predefinita è in lista, la seleziona
    if (versioneSelect) {
        let exists = false;
        for (let i = 0; i < versioneSelect.options.length; i++) {
            if (versioneSelect.options[i].value === defs.versione) {
                exists = true;
                break;
            }
        }
        if (exists) {
            versioneSelect.value = defs.versione;
            if (versioneInput) {
                versioneInput.value = defs.versione;
                versioneInput.classList.add('hidden');
                versioneInput.required = false;
            }
        } else {
            versioneSelect.value = "custom";
            if (versioneInput) {
                versioneInput.value = defs.versione;
                versioneInput.classList.remove('hidden');
                versioneInput.required = true;
            }
        }
    }

    // Applica prezzo predefinito per la categoria predefinita
    const prezzi = (window.appSettings && window.appSettings.prezziPredefiniti) ? window.appSettings.prezziPredefiniti : {
        'Kit': 23.99,
        'Player': 22.99,
        'Fan': 22.99,
        'Kit Allenamento': 25.99,
        'Retro': 23.99,
        'Tuta': 44.99,
        'Kit Bambino': 19.99
    };
    const prezzoInput = document.getElementById('form-prezzo');
    if (prezzoInput && prezzi[defs.categoria] !== undefined) {
        prezzoInput.value = prezzi[defs.categoria];
    }
    
    const modalTitle = document.getElementById('modal-title');
    if (modalTitle) {
        modalTitle.innerText = "Aggiungi Nuovo Prodotto";
    }
}

/**
 * Mostra un toast di feedback visivo
 */
function showToast(message, type = "info") {
    // Rimuovi eventuali toast preesistenti
    const existingToast = document.getElementById('admin-toast');
    if (existingToast) existingToast.remove();

    // Crea il nuovo toast container
    const toast = document.createElement('div');
    toast.id = "admin-toast";
    
    // Stili in base al tipo
    let bgClass = "bg-slate-900 border-slate-800 text-white";
    let icon = "ℹ️";
    if (type === "success") {
        bgClass = "bg-green-900 border-green-800 text-white";
        icon = "✅";
    } else if (type === "error") {
        bgClass = "bg-red-900 border-red-800 text-white";
        icon = "❌";
    }

    toast.className = `fixed bottom-5 right-5 z-50 ${bgClass} border px-4 py-3 rounded-2xl flex items-center gap-3 shadow-2xl animate-fade-in text-sm font-semibold max-w-md`;
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    
    document.body.appendChild(toast);

    // Rimuovi dopo 3 secondi
    setTimeout(() => {
        toast.classList.add('opacity-0', 'transition-all', 'duration-500');
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

/**
 * Gestisce lo switch tra le diverse tab del pannello amministratore.
 * @param {string} tabId - L'id della tab da attivare
 */
function switchTab(tabId, preserveSelectionMode = false) {
    if (!preserveSelectionMode) {
        orderSelectionMode = null;
    }
    currentActiveTab = tabId;

    // Sezioni disponibili
    const sections = [
        'dashboard', 'prodotti', 'ordini', 'lotto', 
        'gestione-ordini', 'tracking', 'impostazioni', 'gestione-catalogo', 'revisione-riclassificazione', 'marketing', 'recensioni', 'coupon', 'suddivisione-conti', 'chat'
    ];
    
    // Mappa dei titoli dell'header
    const titlesMap = {
        'dashboard': 'Dashboard',
        'prodotti': 'Prodotti',
        'ordini': 'Ordini Prodotti',
        'lotto': 'Lotti',
        'gestione-ordini': 'Gestione Ordini',
        'tracking': 'Tracking Spedizioni',
        'impostazioni': 'Impostazioni',
        'gestione-catalogo': 'Gestione Catalogo',
        'revisione-riclassificazione': 'Revisione & Riclassificazione Prodotti',
        'marketing': 'Gestione Promo Home',
        'recensioni': 'Moderazione Recensioni',
        'coupon': 'Gestione Coupon Sconto',
        'suddivisione-conti': 'Suddivisione Conti (Sergio & Riccardo)',
        'chat': 'Chat Assistenza Live'
    };

    // Aggiorna visibilità sezioni
    sections.forEach(sec => {
        const sectionEl = document.getElementById(`section-${sec}`);
        if (sectionEl) {
            if (sec === tabId) {
                sectionEl.classList.remove('hidden');
            } else {
                sectionEl.classList.add('hidden');
            }
        }
    });

    // Aggiorna classi della sidebar
    sections.forEach(sec => {
        const navEl = document.getElementById(`nav-${sec}`);
        if (navEl) {
            if (sec === tabId) {
                // Stile Attivo (Arancione/Oro)
                navEl.className = "nav-item flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 text-white bg-brand-gold/15 border-l-4 border-brand-gold";
            } else {
                // Stile Inattivo
                navEl.className = "nav-item flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 text-slate-400 hover:text-white hover:bg-slate-800/40 border-l-4 border-transparent";
            }
        }
    });

    // Aggiorna titolo header
    const titleEl = document.getElementById('current-section-title');
    if (titleEl) {
        titleEl.innerText = titlesMap[tabId] || 'Pannello Amministratore';
    }

    // Caricamento dati contestuale alla tab attiva
    if (tabId === 'impostazioni' || tabId === 'gestione-catalogo') {
        if (typeof caricaSettings === 'function') {
            caricaSettings();
        }
        if (tabId === 'impostazioni' && typeof controllaStatoConnessioni === 'function') {
            controllaStatoConnessioni();
        }
    } else if (tabId === 'gestione-ordini') {
        caricaGestioneOrdini();
    } else if (tabId === 'revisione-riclassificazione') {
        if (typeof caricaRevisioneRiclassificazione === 'function') {
            caricaRevisioneRiclassificazione();
        }
    } else if (tabId === 'marketing') {
        loadMarketingPromo();
    } else if (tabId === 'recensioni') {
        caricaRecensioniAdmin();
    } else if (tabId === 'coupon') {
        caricaCoupon();
    } else if (tabId === 'suddivisione-conti') {
        caricaSuddivisioneConti();
    } else if (tabId === 'chat') {
        if (typeof caricaConversazioniAdmin === 'function') {
            caricaConversazioniAdmin();
        }
    }

    // Chiude sidebar su mobile dopo la selezione
    const overlayEl = document.getElementById('sidebar-overlay');
    if (overlayEl && !overlayEl.classList.contains('hidden')) {
        toggleMobileSidebar();
    }
}

/**
 * Gestisce l'apertura e la chiusura della sidebar su dispositivi mobile.
 */
function toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (sidebar && overlay) {
        if (sidebar.classList.contains('-translate-x-full')) {
            sidebar.classList.remove('-translate-x-full');
            overlay.classList.remove('hidden');
        } else {
            sidebar.classList.add('-translate-x-full');
            overlay.classList.add('hidden');
        }
    }
}

/**
 * Gestisce l'apertura del modal per l'aggiunta di un nuovo prodotto.
 */
function openAddProductModal() {
    aggiornaMenuCategorieForm();
    aggiornaMenuFiltriCatalogoForm();

    const modal = document.getElementById('add-product-modal');
    const container = document.getElementById('modal-container');
    
    if (modal && container) {
        modal.classList.remove('hidden');
        // Trigger reflow per avviare transizione
        setTimeout(() => {
            container.classList.remove('scale-95', 'opacity-0');
            container.classList.add('opacity-100');
        }, 10);
    }
}

/**
 * Gestisce la chiusura del modal per l'aggiunta di un nuovo prodotto.
 */
function closeAddProductModal() {
    const modal = document.getElementById('add-product-modal');
    const container = document.getElementById('modal-container');
    
    if (modal && container) {
        container.classList.remove('opacity-100', 'scale-100');
        container.classList.add('opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
            resetFormProdotto(); // Resetta il form quando si chiude
        }, 200);
    }
}

// Espone le funzioni a livello globale per gli handler HTML inline
window.switchTab = switchTab;
// Espone i vari event handler e callback del form
window.toggleMobileSidebar = toggleMobileSidebar;
window.openAddProductModal = openAddProductModal;
window.closeAddProductModal = closeAddProductModal;
window.preparaModificaProdotto = preparaModificaProdotto;
window.eliminaProdotto = eliminaProdotto;
window.handleSupplierPriceInput = handleSupplierPriceInput;
window.saveSupplierPrice = saveSupplierPrice;

/**
 * Formatta la nomenclatura della versione in base alla categoria
 */
function formattaNomenclaturaVersione(squadra, categoria, versione, stagione) {
    let cat = normalizzaCategoria(categoria);
    const versioneLower = (versione || '').toLowerCase();
    
    if (cat && cat.toLowerCase() === 'kit bambino') {
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

/**
 * Carica tutti gli ordini registrati da Google Sheets tramite il backend
 */
let subTabOrdini = 'attivi';
let archivedKeys = [];

async function caricaOrdini() {
    try {
        const response = await fetch('/api/orders');
        if (response.ok) {
            const result = await response.json();
            if (result && result.success && Array.isArray(result.orders)) {
                ordini = result.orders;
                archivedKeys = Array.isArray(result.archivedKeys) ? result.archivedKeys : [];
            } else {
                console.warn("Nessun ordine restituito o formato errato:", result);
                ordini = [];
                archivedKeys = [];
            }
        } else {
            console.warn("Errore HTTP nel caricamento degli ordini:", response.status);
            ordini = [];
            archivedKeys = [];
        }
    } catch (err) {
        console.error("Errore nel caricamento degli ordini:", err);
        ordini = [];
        archivedKeys = [];
    }

    // Aggiorna tutte le statistiche della dashboard e del lotto corrente
    aggiornaStatisticheDashboard();
    aggiornaStatisticheLottoCorrente();

    // Renderizza gli ordini
    renderOrdini();
}

/**
 * Gestione dello switch tra Tab Ordini Attivi e Tab Ordini Archiviati
 */
window.switchSubTabOrdini = function(tab) {
    subTabOrdini = tab;
    
    const btnAttivi = document.getElementById('btn-ordini-attivi');
    const btnArchiviati = document.getElementById('btn-ordini-archiviati');
    
    if (btnAttivi && btnArchiviati) {
        if (tab === 'attivi') {
            btnAttivi.className = "px-4 py-2.5 text-xs font-bold rounded-xl bg-brand-gold text-white shadow-sm border border-brand-gold transition-all duration-150 flex items-center gap-1.5";
            btnArchiviati.className = "px-4 py-2.5 text-xs font-bold rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200/80 border border-transparent transition-all duration-150 flex items-center gap-1.5";
        } else {
            btnAttivi.className = "px-4 py-2.5 text-xs font-bold rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200/80 border border-transparent transition-all duration-150 flex items-center gap-1.5";
            btnArchiviati.className = "px-4 py-2.5 text-xs font-bold rounded-xl bg-brand-gold text-white shadow-sm border border-brand-gold transition-all duration-150 flex items-center gap-1.5";
        }
    }
    
    renderOrdini();
};

/**
 * Gestisce l'archiviazione e disarchiviazione
 */
window.gestisciArchiviazione = async function(dataKey, isArchived) {
    const endpoint = isArchived ? '/api/orders/unarchive' : '/api/orders/archive';
    const actionLabel = isArchived ? 'ripristinato negli Ordini Attivi' : 'archiviato';
    
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: dataKey })
        });
        const result = await response.json();
        if (result && result.success) {
            showToast(`Ordine ${actionLabel} con successo!`, "success");
            await caricaLotto();
            await caricaOrdini();
            if (typeof caricaGestioneOrdini === 'function') {
                await caricaGestioneOrdini();
            }
            await caricaCronologiaLotti();
        } else {
            showToast("Errore durante l'operazione: " + (result.error || "errore sconosciuto"), "error");
        }
    } catch (err) {
        console.error("Errore archiviazione:", err);
        showToast("Errore di connessione.", "error");
    }
};

/**
 * Gestisce l'eliminazione definitiva dell'ordine dal database
 */
window.gestisciEliminazione = async function(dataKey) {
    const chiediConferma = !window.appSettings || window.appSettings.sicurezza?.conferma_elimina_ordine !== false;
    let confirmed = true;
    if (chiediConferma) {
        confirmed = confirm("Sei assolutamente sicuro di voler ELIMINARE definitivamente questo ordine? Questa azione non può essere annullata ed eliminerà l'ordine in modo permanente dal database.");
    }
    
    if (!confirmed) {
        return;
    }
    
    try {
        showToast("Eliminazione in corso...", "info");
        const response = await fetch('/api/orders/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: dataKey })
        });
        const result = await response.json();
        if (result && result.success) {
            showToast("Ordine eliminato definitivamente con successo!", "success");
            await caricaOrdini();
        } else {
            showToast("Errore durante l'eliminazione: " + (result.error || "errore sconosciuto"), "error");
        }
    } catch (err) {
        console.error("Errore eliminazione:", err);
        showToast("Errore di connessione.", "error");
    }
};

/**
 * Funzione ausiliaria per estrarre la quantità totale di articoli ordinati
 */
function isTechnicalShippingOrServiceLine(name) {
    if (!name) return false;
    const lower = String(name).toLowerCase().trim();
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

function estraiNumeroArticoli(param) {
    if (!param) return 0;
    
    // Se viene passato l'oggetto ordine con carrello popolato (stessa logica usata nei Lotti)
    if (typeof param === 'object') {
        if (Array.isArray(param.carrello) && param.carrello.length > 0) {
            let total = 0;
            param.carrello.forEach(item => {
                const sq = item.squadra || item.nome || '';
                if (isTechnicalShippingOrServiceLine(sq)) return;
                total += parseInt(item.quantita, 10) || 1;
            });
            return total;
        }
    }
    
    // Fallback su stringa squadra/prodotti (utilizza ' / ' con spazi per evitare di spezzare stagioni tipo '26/27')
    const squadraStr = typeof param === 'string' ? param : (param.squadra || '');
    if (!squadraStr) return 0;
    
    let totale = 0;
    const parti = squadraStr.split(/\s+\/\s+/);
    parti.forEach(p => {
        const text = p.trim();
        if (!text) return;
        if (isTechnicalShippingOrServiceLine(text)) return;
        
        const match = text.match(/^(\d+)x\s*/i);
        if (match) {
            totale += parseInt(match[1], 10);
        } else {
            totale += 1;
        }
    });
    return totale || 0;
}

function getOrderTimestampForSorting(o) {
    if (!o) return 0;
    if (o.created_at) {
        const t = new Date(o.created_at).getTime();
        if (!isNaN(t) && t > 0) return t;
    }
    if (o.data) {
        const str = String(o.data).trim();
        const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})[,\s]+(\d{2}):(\d{2}):?(\d{2})?/);
        if (match) {
            const [, day, month, year, hours, minutes, seconds] = match;
            const d = new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes), Number(seconds || 0));
            if (!isNaN(d.getTime())) return d.getTime();
        }
        const d = new Date(str);
        if (!isNaN(d.getTime())) return d.getTime();
    }
    if (o.id && !isNaN(Number(o.id))) {
        return Number(o.id);
    }
    return 0;
}

/**
 * Estrae l'URL pulito dell'immagine da un valore o formula =IMAGE("url")
 */
function estraiUrlImmaginePulito(val) {
    if (!val || typeof val !== 'string') return '';
    let str = val.trim();
    const match = str.match(/=IMAGE\(\s*["']([^"']+)["']\s*\)/i);
    if (match && match[1]) {
        return match[1].trim();
    }
    if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('/') || str.startsWith('data:')) {
        return str;
    }
    return '';
}

/**
 * Estrae gli articoli acquistati con le relative immagini, categorie, quantità e dettagli
 * associati specificamente all'ordine salvato (snapshot fedele all'acquisto).
 */
function estraiArticoliOrdineConImmagini(order) {
    if (!order) return [];
    const items = [];
    
    let cart = [];
    if (Array.isArray(order.carrello)) {
        cart = order.carrello;
    } else if (typeof order.carrello === 'string' && order.carrello.trim()) {
        try {
            cart = JSON.parse(order.carrello);
        } catch(e) {
            cart = [];
        }
    }

    const orderMainImg = estraiUrlImmaginePulito(order.foto);

    if (Array.isArray(cart) && cart.length > 0) {
        cart.forEach(c => {
            const sq = c.squadra || c.nome || '';
            if (isTechnicalShippingOrServiceLine(sq)) return;
            
            const rawImg = c.imgUrl || c.immagine || c.image || c.foto || orderMainImg;
            const imgUrl = estraiUrlImmaginePulito(rawImg);
            
            let pers = c.infoPerso || c.personalizzazione || 'Nessuna';
            if (pers === 'No' || pers === 'No | No' || !pers || pers.trim() === '') {
                pers = 'Nessuna';
            }

            items.push({
                nome: sq,
                categoria: c.categoria || '',
                quantita: parseInt(c.quantita, 10) || 1,
                taglia: c.taglia || 'N/D',
                prezzo: parseFloat(c.prezzo) || 0,
                infoPerso: pers,
                imgUrl: imgUrl
            });
        });
    }

    // Se non è stato possibile estrarre articoli dal carrello strutturato, usa il parsing delle stringhe
    if (items.length === 0) {
        const prodottiOrdinati = order.squadra || '';
        const tagliaOrdinata = order.taglia || '';
        const personalizzazione = order.personalizzazione || '';

        const parsedItems = prodottiOrdinati.split(/\s+\/\s+/);
        const sizes = tagliaOrdinata ? tagliaOrdinata.split(/\s+\/\s+/) : [];
        const persList = personalizzazione ? personalizzazione.split(/\s+\|\s+/) : [];

        parsedItems.forEach((p, idx) => {
            const rawName = p ? p.trim() : '';
            if (!rawName || isTechnicalShippingOrServiceLine(rawName)) return;

            let qty = 1;
            let cleanName = rawName;
            const matchQty = rawName.match(/^(\d+)x\s*(.+)$/i);
            if (matchQty) {
                qty = parseInt(matchQty[1], 10) || 1;
                cleanName = matchQty[2].trim();
            }

            let itemSize = sizes[idx] ? sizes[idx].trim() : 'N/D';
            itemSize = itemSize.replace(/^\d+x\s*\[?/, '').replace(/\]?$/, '').trim() || 'N/D';

            let itemPers = persList[idx] ? persList[idx].trim() : 'Nessuna';
            itemPers = itemPers.replace(/^\d+x\s*\[?/, '').replace(/\]?$/, '').trim();
            if (itemPers === 'No' || itemPers === 'No | No' || !itemPers) {
                itemPers = 'Nessuna';
            }

            items.push({
                nome: cleanName,
                categoria: '',
                quantita: qty,
                taglia: itemSize,
                prezzo: 0,
                infoPerso: itemPers,
                imgUrl: orderMainImg
            });
        });
    }

    return items;
}

/**
 * Genera l'HTML per la lista dei prodotti ordinati con miniature, categorie e dettagli
 */
function renderOrderItemsHTML(order) {
    const items = estraiArticoliOrdineConImmagini(order);
    if (!items || items.length === 0) {
        return `<div class="py-2 text-xs text-[rgba(255,255,255,0.4)] italic">Nessun articolo rilevato.</div>`;
    }

    const placeholderImg = "https://placehold.co/100x120/111111/d6a43a?text=Maglia";

    return items.map((item) => {
        const hasImg = !!item.imgUrl;
        const displayImg = item.imgUrl || placeholderImg;
        const safeName = (item.nome || 'Prodotto').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        const safeImgUrl = (item.imgUrl || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

        return `
            <div class="flex items-center gap-3 py-2.5 border-b border-[rgba(255,255,255,0.08)] last:border-0">
                <!-- Thumbnail Immagine Prodotto -->
                <div class="relative w-14 h-16 sm:w-16 sm:h-20 bg-[#070707] border border-[rgba(255,255,255,0.08)] rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 group ${hasImg ? 'cursor-pointer' : ''}"
                     ${hasImg ? `onclick="window.apriPreviewImmagineOrdine('${safeImgUrl}', '${safeName}')" title="Clicca per ingrandire"` : ''}>
                    <img src="${displayImg}" 
                         alt="${safeName}" 
                         class="w-full h-full object-contain p-1 rounded-lg transition-transform duration-200 ${hasImg ? 'group-hover:scale-105' : ''}" 
                         loading="lazy" 
                         onerror="this.onerror=null; this.src='${placeholderImg}';" />
                    ${hasImg ? `
                        <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-bold">
                            🔍
                        </div>
                    ` : ''}
                </div>

                <!-- Dettagli Prodotto -->
                <div class="flex-1 min-w-0 space-y-1">
                    <div class="flex items-start justify-between gap-2">
                        <span class="text-xs font-bold text-white leading-tight break-words">${item.nome}</span>
                        <span class="px-1.5 py-0.5 bg-[#0B0B0B] text-[rgba(255,255,255,0.88)] border border-[rgba(255,255,255,0.08)] font-mono font-bold text-[9px] rounded-md flex-shrink-0">
                            TGL: ${item.taglia}
                        </span>
                    </div>
                    
                    <div class="flex items-center flex-wrap gap-x-2.5 gap-y-0.5 text-[10px] text-[rgba(255,255,255,0.65)] font-sans">
                        ${item.categoria ? `<span class="inline-flex items-center gap-1">Categoria: <strong class="text-slate-200 font-semibold">${item.categoria}</strong></span>` : ''}
                        <span class="inline-flex items-center gap-1">Quantità: <strong class="text-white font-mono font-bold">${item.quantita}</strong></span>
                        ${item.prezzo > 0 ? `<span class="inline-flex items-center gap-1">Prezzo: <strong class="text-white font-mono font-semibold">€${(item.prezzo * item.quantita).toFixed(2).replace('.', ',')}</strong></span>` : ''}
                    </div>

                    <div class="text-[10px] text-[rgba(255,255,255,0.65)] flex items-center gap-1 font-sans">
                        <span class="text-xs">✍️</span> 
                        <span>Pers.: <strong class="${item.infoPerso !== 'Nessuna' ? 'text-brand-gold font-bold' : 'text-[rgba(255,255,255,0.5)] font-normal'}">${item.infoPerso}</strong></span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Apre il modal di ingrandimento dell'immagine prodotto acquistato
 */
function apriPreviewImmagineOrdine(imgUrl, nomeProdotto) {
    if (!imgUrl) return;
    const modal = document.getElementById('modal-anteprima-immagine-ordine');
    const container = document.getElementById('modal-anteprima-immagine-ordine-container');
    const imgEl = document.getElementById('modal-img-order-src');
    const titleEl = document.getElementById('modal-img-order-title');
    const linkEl = document.getElementById('modal-img-order-link');

    if (imgEl) imgEl.src = imgUrl;
    if (titleEl) titleEl.innerText = nomeProdotto || 'Dettaglio Prodotto Acquistato';
    if (linkEl) {
        linkEl.href = imgUrl;
        linkEl.style.display = imgUrl.startsWith('http') ? 'inline-flex' : 'none';
    }

    if (modal && container) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            container.classList.remove('scale-95', 'opacity-0');
            container.classList.add('scale-100', 'opacity-100');
        }, 10);
    }
}

/**
 * Chiude il modal di ingrandimento dell'immagine prodotto acquistato
 */
function chiudiPreviewImmagineOrdine() {
    const modal = document.getElementById('modal-anteprima-immagine-ordine');
    const container = document.getElementById('modal-anteprima-immagine-ordine-container');
    if (modal && container) {
        container.classList.remove('scale-100', 'opacity-100');
        container.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 200);
    }
}

// Chiusura al click sul backdrop del modal anteprima immagine
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('modal-anteprima-immagine-ordine');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                chiudiPreviewImmagineOrdine();
            }
        });
    }
});

// Chiusura con tasto Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        chiudiPreviewImmagineOrdine();
    }
});

/**
 * Helper per recuperare la modifica salvata per un ordine
 */
function getModificaForOrder(order) {
    if (!profitSplitData) return null;
    const orderIdStr = String(order.id !== undefined && order.id !== null ? order.id : '');
    const dataKey = order.data ? String(order.data) : '';

    const list = Array.isArray(profitSplitData.modifications) 
        ? profitSplitData.modifications 
        : (profitSplitData.modifications && typeof profitSplitData.modifications === 'object' ? Object.values(profitSplitData.modifications) : []);

    return list.find(m => 
        (orderIdStr && String(m.order_id) === orderIdStr) ||
        (dataKey && (String(m.order_id) === dataKey || String(m.order_data_key) === dataKey))
    ) || null;
}

/**
 * Renderizza l'elenco degli ordini come grid di card moderne nel pannello
 */
function renderOrdini() {
    const cardsContainer = document.getElementById('orders-cards-container');
    const countBadge = document.getElementById('ordini-count-badge');
    const bannerEl = document.getElementById('ordini-selection-banner');
    const subtabsEl = document.getElementById('ordini-subtabs-container');
    if (!cardsContainer) return;

    const isSelectionMode = orderSelectionMode === 'profitSplit';

    // Gestione visuale del banner e sotto-tab
    if (bannerEl) {
        if (isSelectionMode) {
            bannerEl.classList.remove('hidden');
        } else {
            bannerEl.classList.add('hidden');
        }
    }
    if (subtabsEl) {
        if (isSelectionMode) {
            subtabsEl.classList.add('hidden');
        } else {
            subtabsEl.classList.remove('hidden');
        }
    }

    // Filtra gli ordini in base al sotto-tab corrente o alla modalità di selezione
    const ordiniFiltrati = ordini.filter(order => {
        const isArchived = archivedKeys.includes(order.data);
        const tabMatch = isSelectionMode
            ? (!isArchived && !isOrderCanceled(order))
            : (subTabOrdini === 'archiviati' ? isArchived : (!isArchived && !isOrderCanceled(order)));

        if (!tabMatch) return false;

        if (ordiniSearchQuery) {
            const query = ordiniSearchQuery.toLowerCase();
            const haystack = `${order.nome || ''} ${order.telefono || ''} ${order.squadra || ''} ${order.taglia || ''} ${order.id || ''} ${order.data || ''}`.toLowerCase();
            return haystack.includes(query);
        }
        return true;
    });

    if (countBadge) {
        countBadge.innerText = `${ordiniFiltrati.length} ${ordiniFiltrati.length === 1 ? 'ordine' : 'ordini'}${isSelectionMode ? ' disponibili' : ''}`;
    }

    if (ordiniFiltrati.length === 0) {
        let emptyMessage = "Nessun ordine presente";
        let emptySubtitle = "Non ci sono ordini registrati o attivi nel database.";
        
        if (isSelectionMode) {
            emptyMessage = "Nessun ordine attivo trovato";
            emptySubtitle = ordiniSearchQuery 
                ? "Nessun ordine corrisponde alla ricerca corrente." 
                : "Non ci sono ordini attivi disponibili nel lotto.";
        } else if (subTabOrdini === 'archiviati') {
            emptyMessage = "Nessun ordine archiviato";
            emptySubtitle = "Gli ordini che sposti in archivio verranno mostrati qui.";
        } else if (ordiniSearchQuery) {
            emptyMessage = "Nessun ordine trovato";
            emptySubtitle = "Nessun ordine corrisponde ai criteri di ricerca.";
        }
            
        cardsContainer.innerHTML = `
            <div class="col-span-full py-16 bg-white border border-slate-200/80 rounded-2xl flex flex-col items-center justify-center gap-3 shadow-sm">
                <span class="text-5xl">📦</span>
                <p class="font-extrabold text-slate-700 text-base">${emptyMessage}</p>
                <p class="text-xs text-slate-400 max-w-md text-center px-4">${emptySubtitle}</p>
            </div>
        `;
        return;
    }

    // 1. Ordina l'intero array degli ordini in ordine CRONOLOGICO (dal più vecchio al più recente)
    // per assegnare il numero progressivo reale (#1 al primo ordine mai fatto, #2 al secondo, ecc.)
    const ordiniCronologici = [...ordini].sort((a, b) => {
        const tA = getOrderTimestampForSorting(a);
        const tB = getOrderTimestampForSorting(b);
        if (tA !== tB) return tA - tB;
        return (Number(a.id) || 0) - (Number(b.id) || 0);
    });

    // 2. Ordina gli ordini filtrati dal PIÙ RECENTE al PIÙ VECCHIO per la visualizzazione in pagina
    const ordiniDaMostrare = [...ordiniFiltrati].sort((a, b) => {
        const tA = getOrderTimestampForSorting(a);
        const tB = getOrderTimestampForSorting(b);
        if (tA !== tB) return tB - tA;
        return (Number(b.id) || 0) - (Number(a.id) || 0);
    });

    // 3. Mappa ciascun ordine con il suo numero progressivo cronologico reale (1-based)
    const ordiniConDettagli = ordiniDaMostrare.map(order => {
        const cronoIndex = ordiniCronologici.findIndex(o => (o.id && order.id ? Number(o.id) === Number(order.id) : o.data === order.data));
        return {
            order,
            displayIndex: cronoIndex !== -1 ? (cronoIndex + 1) : 'N/D'
        };
    });

    cardsContainer.innerHTML = ordiniConDettagli.map(({ order, displayIndex }) => {
        const nomeCliente = order.nome || 'N/D';
        const telefonoCliente = order.telefono || 'N/D';
        const dataOrdine = order.data || 'N/D';
        const totaleOrdine = order.totale || '0,00€';
        const prodottiOrdinati = order.squadra || '';
        const tagliaOrdinata = order.taglia || '';
        const personalizzazione = order.personalizzazione || '';
        const profitto = order["Profitto (EUR)"] || '0,00';
        const isArchived = archivedKeys.includes(order.data);

        const numArticoli = estraiNumeroArticoli(order);

        // Formattazione telefono per il link WhatsApp
        const cleanPhone = telefonoCliente.replace(/\D/g, '');
        const waLink = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('39') ? '' : '39'}${cleanPhone}` : '#';

        const safeOrderId = escapeHtml(String(order.id !== undefined && order.id !== null ? order.id : order.data));
        const existingMod = isSelectionMode ? getModificaForOrder(order) : null;

        // Gestione stili e badge per modalità standard vs selezione
        let statusBadgeHTML = '';
        let cardContainerClass = 'bg-[#111111] border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col justify-between';

        if (isSelectionMode) {
            if (existingMod) {
                if (existingMod.division === '100_sergio') {
                    cardContainerClass = 'bg-[#111111] border-2 border-amber-500/70 rounded-2xl shadow-lg ring-1 ring-amber-500/30 overflow-hidden flex flex-col justify-between';
                    statusBadgeHTML = `<span class="px-2.5 py-1 text-[10px] font-black rounded-full bg-amber-500/20 text-brand-gold border border-amber-500/40 uppercase tracking-wider font-sans">👤 100% Sergio (Personale)</span>`;
                } else if (existingMod.division === '100_riccardo') {
                    cardContainerClass = 'bg-[#111111] border-2 border-blue-500/70 rounded-2xl shadow-lg ring-1 ring-blue-500/30 overflow-hidden flex flex-col justify-between';
                    statusBadgeHTML = `<span class="px-2.5 py-1 text-[10px] font-black rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/40 uppercase tracking-wider font-sans">👤 100% Riccardo (Personale)</span>`;
                } else {
                    cardContainerClass = 'bg-[#111111] border-2 border-purple-500/70 rounded-2xl shadow-lg ring-1 ring-purple-500/30 overflow-hidden flex flex-col justify-between';
                    statusBadgeHTML = `<span class="px-2.5 py-1 text-[10px] font-black rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 uppercase tracking-wider font-sans">⚖️ 50% / 50% Modificato</span>`;
                }
            } else {
                cardContainerClass = 'bg-[#111111] border border-[rgba(255,255,255,0.12)] hover:border-amber-500/50 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col justify-between';
                statusBadgeHTML = `<span class="px-2 py-0.5 text-[9px] leading-5 font-semibold rounded-full bg-slate-900 text-slate-400 border border-slate-800 uppercase tracking-wider font-sans">50/50 Standard</span>`;
            }
        } else {
            const statusLabel = isArchived ? 'Archiviato' : 'Completato';
            const statusClass = isArchived 
                ? 'bg-[#0B0B0B] text-[rgba(255,255,255,0.88)] border-[rgba(255,255,255,0.08)]' 
                : 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30';
            statusBadgeHTML = `<span class="px-2 py-0.5 text-[9px] leading-5 font-bold rounded-full ${statusClass} border uppercase tracking-wider font-sans">${statusLabel}</span>`;
        }

        const costoFornitoreEur = order["Costo totale (EUR)"] || '';
        const costoFornitoreUsd = order["Costo totale (USD)"] || '';
        const costoProdottiUsd = order["Costo prodotti (USD)"] || '';
        
        // Calcolo di fallback robusto: Spedizione = Costo totale (USD) - Costo prodotti (USD)
        const parsedTotalUsd = parseFloat((costoFornitoreUsd || '0').replace(/\./g, '').replace(',', '.')) || 0;
        const parsedProductsUsd = parseFloat((costoProdottiUsd || '0').replace(/\./g, '').replace(',', '.')) || 0;
        const fallbackSpedizioneUsdVal = Math.max(0, parsedTotalUsd - parsedProductsUsd);
        
        const costoSpedizioneUsd = order["Costo spedizione (USD)"] || order["osto spedizione (USD)"] || String(fallbackSpedizioneUsdVal);
        const cambioValuta = order["Cambio USD/EUR"] || '';

        // Genera la lista degli articoli acquistati con immagini, taglie e dettagli
        const itemsHTML = renderOrderItemsHTML(order);

        // Footer Card (Azioni)
        let footerActionHTML = '';
        if (isSelectionMode) {
            if (existingMod) {
                footerActionHTML = `
                    <div class="px-4 py-3 border-t border-[rgba(255,255,255,0.08)] bg-[#0B0B0B] flex gap-2">
                        <button onclick="selezionaOrdinePerModificaSuddivisione('${safeOrderId}')" class="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer font-sans">
                            <span>✏️</span> Modifica Suddivisione Esistente
                        </button>
                    </div>
                `;
            } else {
                footerActionHTML = `
                    <div class="px-4 py-3 border-t border-[rgba(255,255,255,0.08)] bg-[#0B0B0B] flex gap-2">
                        <button onclick="selezionaOrdinePerModificaSuddivisione('${safeOrderId}')" class="w-full py-2.5 bg-gradient-to-r from-brand-gold to-amber-500 hover:from-amber-400 hover:to-brand-gold text-slate-950 font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer font-sans">
                            <span>⚖️</span> Seleziona questo Ordine
                        </button>
                    </div>
                `;
            }
        } else {
            footerActionHTML = `
                <div class="px-4 py-3 border-t border-[rgba(255,255,255,0.08)] bg-[#0B0B0B] flex gap-2">
                    <button onclick="gestisciArchiviazione('${order.data}', ${isArchived})" class="flex-1 py-1.5 bg-[#111111] hover:bg-[#0B0B0B] text-[rgba(255,255,255,0.88)] font-bold text-[10px] rounded-xl transition-all border border-[rgba(255,255,255,0.08)] flex items-center justify-center gap-1 font-sans cursor-pointer">
                        <span>${isArchived ? '📥 Ripristina' : '🗄️ Archivia'}</span>
                    </button>
                    <button onclick="gestisciEliminazione('${order.data}')" class="px-3 py-1.5 bg-red-950/20 hover:bg-red-900/40 text-red-400 font-bold text-[10px] rounded-xl transition-all border border-red-900/30 flex items-center justify-center gap-1 font-sans cursor-pointer" title="Elimina Ordine">
                        <span>🗑️ Elimina</span>
                    </button>
                </div>
            `;
        }

        return `
            <div class="${cardContainerClass}">
                <!-- Header: ID, Date, Status -->
                <div class="px-4 py-3 border-b border-[rgba(255,255,255,0.08)] flex items-center justify-between bg-[#0B0B0B]">
                    <div class="flex flex-col">
                        <span class="text-xs font-bold text-[rgba(255,255,255,0.65)] font-mono">ORD-#${displayIndex}</span>
                        <span class="text-[10px] text-[rgba(255,255,255,0.65)] font-mono mt-0.5">${dataOrdine}</span>
                    </div>
                    <div>
                        ${statusBadgeHTML}
                    </div>
                </div>
                
                <!-- Body: Customer info & Items -->
                <div class="p-4 flex-grow space-y-3.5">
                    <!-- Cliente Info -->
                    <div class="flex items-center justify-between">
                        <div>
                            <h4 class="text-sm font-bold text-white leading-tight">${nomeCliente}</h4>
                            <span class="text-[11px] text-[rgba(255,255,255,0.65)] font-mono block mt-0.5">📞 ${telefonoCliente}</span>
                        </div>
                        ${cleanPhone ? `
                            <a href="${waLink}" target="_blank" class="h-7 w-7 bg-emerald-950/20 text-emerald-400 hover:bg-emerald-900/40 border border-emerald-900/30 rounded-full flex items-center justify-center text-xs transition-all shadow-inner" title="Contatta su WhatsApp">
                                💬
                            </a>
                        ` : ''}
                    </div>
                    
                    <!-- Items Box -->
                    <div class="bg-[#0B0B0B] px-3 py-2.5 rounded-xl border border-[rgba(255,255,255,0.08)]">
                        <div class="text-[10px] font-bold text-[rgba(255,255,255,0.65)] uppercase tracking-wider pb-1.5 border-b border-[rgba(255,255,255,0.08)] flex justify-between items-center">
                            <span>Articoli Ordinati</span>
                            <span class="text-[rgba(255,255,255,0.65)] font-mono text-[9px]">(${numArticoli} unit${numArticoli === 1 ? 'à' : 'à'})</span>
                        </div>
                        <div class="divide-y divide-[rgba(255,255,255,0.08)]">
                            ${itemsHTML}
                        </div>
                    </div>

                    <!-- Riepilogo Economico -->
                    <div class="bg-[#0B0B0B] p-4 rounded-xl border border-[rgba(255,255,255,0.08)] space-y-3 font-sans">
                        <div class="text-[10px] font-bold text-[rgba(255,255,255,0.65)] uppercase tracking-wider">Riepilogo Finanziario</div>
                        
                        <div class="space-y-1.5 text-xs text-[rgba(255,255,255,0.88)]">
                            <!-- Subtotale prodotti -->
                            <div class="flex justify-between items-center py-0.5">
                                <span class="text-[rgba(255,255,255,0.65)]">Subtotale Prodotti:</span>
                                <span class="font-mono font-semibold text-white">
                                    € ${(() => {
                                        const totIncassato = parseFloat(totaleOrdine.replace(/[^0-9,.-]/g, '').replace(',', '.')) || 0;
                                        const haSpedCliente = prodottiOrdinati.toLowerCase().includes('spedizione');
                                        const spedCliente = haSpedCliente ? 2.00 : 0.00;
                                        const couponDiscount = (order.coupon_discount !== undefined && order.coupon_discount !== null) ? Number(order.coupon_discount) : 0;
                                        return (totIncassato + couponDiscount - spedCliente).toFixed(2).replace('.', ',');
                                    })()}
                                </span>
                            </div>
                            <!-- Coupon (se presente) -->
                            ${(() => {
                                const cCode = order.coupon_code || '';
                                const cDiscount = (order.coupon_discount !== undefined && order.coupon_discount !== null) ? Number(order.coupon_discount) : 0;
                                if (cCode || cDiscount > 0) {
                                    return `
                                    <div class="flex justify-between items-center py-0.5 text-emerald-400 font-medium">
                                        <span class="flex items-center gap-1">
                                            <span>🎟️</span> Coupon: <strong class="font-bold uppercase">${cCode || 'SCONTO'}</strong>
                                        </span>
                                        <span class="font-mono font-bold">-€ ${cDiscount.toFixed(2).replace('.', ',')}</span>
                                    </div>
                                    `;
                                }
                                return '';
                            })()}
                            <!-- Spedizione cliente -->
                            <div class="flex justify-between items-center py-0.5">
                                <span class="text-[rgba(255,255,255,0.65)]">Spedizione Cliente:</span>
                                <span class="font-mono font-bold text-white">
                                    ${(() => {
                                        const haSpedCliente = prodottiOrdinati.toLowerCase().includes('spedizione');
                                        return haSpedCliente ? '€ 2,00' : '<span class="text-brand-gold font-bold">GRATUITA</span>';
                                    })()}
                                </span>
                            </div>
                            <!-- Totale Incassato -->
                            <div class="flex justify-between items-center py-1 border-b border-dashed border-[rgba(255,255,255,0.08)] font-bold">
                                <span class="text-white font-bold">Totale Incassato:</span>
                                <span class="font-extrabold text-white font-mono text-sm">${totaleOrdine}</span>
                            </div>
                            <!-- Costo Prodotti -->
                            <div class="flex justify-between items-center py-0.5">
                                <span class="text-[rgba(255,255,255,0.65)]">Costo Prodotti (Fornitore):</span>
                                <span class="font-mono font-semibold text-white">
                                    € ${(() => {
                                        const r = parseFloat((cambioValuta || '0.92').replace(/\./g, '').replace(',', '.')) || 0.92;
                                        const p = parseFloat((costoProdottiUsd || '0').replace(/\./g, '').replace(',', '.')) || 0;
                                        return (p * r).toFixed(2).replace('.', ',');
                                    })()} 
                                    <span class="text-[10px] text-[rgba(255,255,255,0.5)] font-normal">($${(() => {
                                        const p = parseFloat((costoProdottiUsd || '0').replace(/\./g, '').replace(',', '.')) || 0;
                                        return p.toFixed(2).replace('.', ',');
                                    })()})</span>
                                </span>
                            </div>
                            <!-- Spedizione Fornitore -->
                            <div class="flex justify-between items-center py-0.5">
                                <span class="text-[rgba(255,255,255,0.65)]">Spedizione Fornitore (Costo):</span>
                                <span class="font-mono font-semibold text-white">
                                    € ${(() => {
                                        const r = parseFloat((cambioValuta || '0.92').replace(/\./g, '').replace(',', '.')) || 0.92;
                                        const s = parseFloat((costoSpedizioneUsd || '0').replace(/\./g, '').replace(',', '.')) || 0;
                                        return (s * r).toFixed(2).replace('.', ',');
                                    })()} 
                                    <span class="text-[10px] text-[rgba(255,255,255,0.5)] font-normal">($${(() => {
                                        const s = parseFloat((costoSpedizioneUsd || '0').replace(/\./g, '').replace(',', '.')) || 0;
                                        return s.toFixed(2).replace('.', ',');
                                    })()})</span>
                                </span>
                            </div>
                            <!-- Costo Totale Reale -->
                            <div class="flex justify-between items-center py-1.5 border-t border-[rgba(255,255,255,0.08)] mt-1 font-bold">
                                <span class="text-[rgba(255,255,255,0.88)] font-extrabold text-xs uppercase tracking-tight">Costo Totale Reale:</span>
                                <span class="font-mono font-black text-white text-sm">
                                    € ${(() => {
                                        const val = parseFloat((costoFornitoreEur || '0').replace(/\./g, '').replace(',', '.')) || 0;
                                        return val.toFixed(2).replace('.', ',');
                                    })()} 
                                    <span class="text-[10px] text-[rgba(255,255,255,0.5)] font-bold">($${(() => {
                                        const val = parseFloat((costoFornitoreUsd || '0').replace(/\./g, '').replace(',', '.')) || 0;
                                        return val.toFixed(2).replace('.', ',');
                                    })()})</span>
                                </span>
                            </div>
                            <!-- Margine Reale (Profitto) -->
                            <div class="flex justify-between items-center p-2 bg-emerald-950/20 rounded-lg border border-emerald-900/30 mt-2">
                                <span class="text-emerald-400 font-bold text-xs uppercase tracking-tight">Margine Reale:</span>
                                <span class="font-mono font-black text-emerald-400 text-sm">
                                    +€ ${profitto}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Footer: Actions -->
                ${footerActionHTML}
            </div>
        `;
    }).join('');
}

// -------------------------------------------------------------------------
// SEZIONE IMPOSTAZIONI: FUNZIONI DI GESTIONE E PERSISTENZA
// -------------------------------------------------------------------------

/**
 * Carica le impostazioni dal server e popola l'UI
 */
async function caricaSettings() {
    try {
        const res = await fetch('/api/settings');
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.settings) {
                window.appSettings = data.settings;
                popolaSettingsUI();
            }
        }
    } catch (e) {
        console.error("Errore nel caricamento delle impostazioni:", e);
    }
}

/**
 * Popola gli input dell'interfaccia delle impostazioni con i dati correnti
 */
function popolaSettingsUI() {
    if (!window.appSettings) return;

    // 1. Prezzi predefiniti
    const prezzi = window.appSettings.prezziPredefiniti || {};
    const prezziMap = {
        'kit': 'Kit',
        'player': 'Player',
        'fan': 'Fan',
        'allenamento': 'Kit Allenamento',
        'retro': 'Retro',
        'tuta': 'Tuta',
        'bambino': 'Kit Bambino'
    };
    for (const [key, label] of Object.entries(prezziMap)) {
        const input = document.getElementById(`setting-prezzo-${key}`);
        if (input && prezzi[label] !== undefined) {
            input.value = prezzi[label];
        }
    }

    // 2. Regole di spedizione
    const shipping = window.appSettings.spedizioneLotto || {};
    const range1 = document.getElementById('setting-shipping-range1');
    const range2 = document.getElementById('setting-shipping-range2');
    const range3 = document.getElementById('setting-shipping-range3');
    if (range1 && shipping.range1_cost !== undefined) range1.value = shipping.range1_cost;
    if (range2 && shipping.range2_cost !== undefined) range2.value = shipping.range2_cost;
    if (range3 && shipping.range3_cost !== undefined) range3.value = shipping.range3_cost;

    const range1Min = document.getElementById('setting-shipping-range1-min');
    const range1Max = document.getElementById('setting-shipping-range1-max');
    const range2Min = document.getElementById('setting-shipping-range2-min');
    const range2Max = document.getElementById('setting-shipping-range2-max');
    const range3Min = document.getElementById('setting-shipping-range3-min');
    if (range1Min && shipping.range1_min !== undefined) range1Min.value = shipping.range1_min;
    if (range1Max && shipping.range1_max !== undefined) range1Max.value = shipping.range1_max;
    if (range2Min && shipping.range2_min !== undefined) range2Min.value = shipping.range2_min;
    if (range2Max && shipping.range2_max !== undefined) range2Max.value = shipping.range2_max;
    if (range3Min && shipping.range3_min !== undefined) range3Min.value = shipping.range3_min;

    // 3. Tasso di cambio USD / EUR
    const valuta = window.appSettings.cambioValuta || {};
    setValutaMode(valuta.mode || 'auto', false);
    const valutaRateInput = document.getElementById('setting-valuta-rate');
    if (valutaRateInput && valuta.manual_rate !== undefined) {
        valutaRateInput.value = valuta.manual_rate;
    }

    // 4. Contatti
    const contatti = window.appSettings.contatti || {};
    const whatsappInput = document.getElementById('setting-whatsapp');
    const emailInput = document.getElementById('setting-email');
    if (whatsappInput && contatti.whatsapp_number !== undefined) whatsappInput.value = contatti.whatsapp_number;
    if (emailInput && contatti.support_email !== undefined) emailInput.value = contatti.support_email;

    // 5. Valori form predefiniti
    const defaults = window.appSettings.valoriPredefiniti || {};
    const dStagione = document.getElementById('setting-default-stagione');
    const dCategoria = document.getElementById('setting-default-categoria');
    const dVersione = document.getElementById('setting-default-versione');
    if (dStagione && defaults.stagione !== undefined) dStagione.value = defaults.stagione;
    if (dCategoria && defaults.categoria !== undefined) dCategoria.value = defaults.categoria;
    if (dVersione && defaults.versione !== undefined) dVersione.value = defaults.versione;

    // 6. Sicurezza
    const sicurezza = window.appSettings.sicurezza || {};
    const confermaProdotto = document.getElementById('setting-conferma-prodotto');
    const confermaOrdine = document.getElementById('setting-conferma-ordine');
    const confermaRecensione = document.getElementById('setting-conferma-recensione');
    if (confermaProdotto && sicurezza.conferma_elimina_prodotto !== undefined) {
        confermaProdotto.checked = sicurezza.conferma_elimina_prodotto;
    }
    if (confermaOrdine && sicurezza.conferma_elimina_ordine !== undefined) {
        confermaOrdine.checked = sicurezza.conferma_elimina_ordine;
    }
    if (confermaRecensione && sicurezza.conferma_elimina_recensione !== undefined) {
        confermaRecensione.checked = sicurezza.conferma_elimina_recensione;
    }

    // 7. Regole prezzi & Categorie (Dinamiche)
    renderRegolePrezziTabella();
    aggiornaMenuCategorieForm();
    renderFiltriCatalogoTabella();
    renderRegoleImportazioneJsonTabella();

    // Aggiorna select per rinomina squadre
    aggiornaSquadreDropdown();
}

// -------------------------------------------------------------------------
// SEZIONE REGOLE IMPORTAZIONE JSON
// -------------------------------------------------------------------------

/**
 * Restituisce le regole di importazione JSON memorizzate nelle impostazioni o quelle predefinite
 */
function getRegoleImportazioneJson() {
    if (window.appSettings && Array.isArray(window.appSettings.regoleImportazioneJson)) {
        return window.appSettings.regoleImportazioneJson;
    }
    return [
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
    ];
}

/**
 * Renderizza la tabella delle Regole Importazione JSON nella sezione Impostazioni
 */
function renderRegoleImportazioneJsonTabella() {
    const tbody = document.getElementById('regole-importazione-json-tbody');
    if (!tbody) return;

    if (!window.appSettings) window.appSettings = {};
    if (!Array.isArray(window.appSettings.regoleImportazioneJson)) {
        window.appSettings.regoleImportazioneJson = getRegoleImportazioneJson();
    }

    const termInput = document.getElementById('search-regole-json-input');
    const term = termInput ? termInput.value.toLowerCase().trim() : '';

    const regole = window.appSettings.regoleImportazioneJson;
    const filtrate = regole.filter(r => {
        if (!term) return true;
        const val = (r.valore_json || '').toLowerCase();
        const cat = (r.categoria || '').toLowerCase();
        return val.includes(term) || cat.includes(term);
    });

    if (filtrate.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" class="px-4 py-8 text-center text-xs text-slate-400 font-semibold">
                    ${term ? 'Nessuna regola trovata per la ricerca.' : 'Nessuna regola di importazione configurata. Clicca su "+ Nuova Regola".'}
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtrate.map(r => `
        <tr class="hover:bg-slate-50/80 transition-colors border-b border-slate-100 last:border-0">
            <td class="px-4 py-3 font-mono text-xs font-extrabold text-slate-800">
                <span class="px-2.5 py-1 bg-slate-100 border border-slate-200/80 rounded-lg text-slate-900 inline-block shadow-2xs">
                    ${escapeHtml(r.valore_json || '')}
                </span>
            </td>
            <td class="px-4 py-3 text-xs font-extrabold text-slate-800">
                <span class="px-2.5 py-1 bg-brand-gold/20 text-slate-950 rounded-lg inline-block border border-brand-gold/30">
                    ${escapeHtml(r.categoria || '')}
                </span>
            </td>
            <td class="px-4 py-3 text-center">
                <div class="flex items-center justify-center gap-1.5">
                    <button type="button" onclick="apriModalNuovaRegolaJson('${r.id}')" class="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors" title="Modifica regola">
                        ✏️
                    </button>
                    <button type="button" onclick="eliminaRegolaJson('${r.id}')" class="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors border border-rose-100" title="Elimina regola">
                        🗑️
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

/**
 * Apri modal per inserire o modificare una regola di importazione JSON
 */
function apriModalNuovaRegolaJson(idRegola = null) {
    const modal = document.getElementById('modal-regola-json');
    const container = document.getElementById('modal-regola-json-container');
    const title = document.getElementById('modal-regola-json-title');
    const idInput = document.getElementById('modal-regola-json-id');
    const valInput = document.getElementById('modal-regola-json-valore');
    const catSelect = document.getElementById('modal-regola-json-categoria');

    if (!modal || !container || !catSelect) return;

    // Popola select delle categorie disponibili dalle Regole Prezzi
    let categorieDisponibili = getListaCategorieRegolePrezzi();
    if (categorieDisponibili.length === 0) {
        categorieDisponibili = ['Kit', 'Player', 'Fan', 'Kit Allenamento', 'Tuta', 'Retro', 'Kit Bambino'];
    }

    catSelect.innerHTML = categorieDisponibili.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

    if (idRegola) {
        const regole = getRegoleImportazioneJson();
        const trovata = regole.find(r => r.id === idRegola);
        if (trovata) {
            title.innerText = "Modifica Regola Importazione JSON";
            idInput.value = trovata.id;
            valInput.value = trovata.valore_json || '';
            
            if (!categorieDisponibili.includes(trovata.categoria)) {
                const opt = document.createElement('option');
                opt.value = trovata.categoria;
                opt.innerText = trovata.categoria;
                catSelect.appendChild(opt);
            }
            catSelect.value = trovata.categoria;
        }
    } else {
        title.innerText = "Nuova Regola Importazione JSON";
        idInput.value = "";
        valInput.value = "";
        catSelect.value = "Kit";
    }

    modal.classList.remove('hidden');
    setTimeout(() => {
        container.classList.remove('scale-95', 'opacity-0');
        container.classList.add('scale-100', 'opacity-100');
        valInput.focus();
    }, 10);
}

/**
 * Chiudi modal regola importazione JSON
 */
function chiudiModalRegolaJson() {
    const modal = document.getElementById('modal-regola-json');
    const container = document.getElementById('modal-regola-json-container');
    if (!modal || !container) return;

    container.classList.remove('scale-100', 'opacity-100');
    container.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 200);
}

/**
 * Salva la regola inserita nel modal
 */
function salvaRegolaJsonModal() {
    const idRegola = document.getElementById('modal-regola-json-id').value;
    const valore = document.getElementById('modal-regola-json-valore').value.trim();
    const categoria = document.getElementById('modal-regola-json-categoria').value.trim();

    if (!valore) {
        showToast("Inserisci il valore trovato nel JSON.", "error");
        return;
    }
    if (!categoria) {
        showToast("Seleziona la categoria da assegnare.", "error");
        return;
    }

    if (!window.appSettings) window.appSettings = {};
    if (!Array.isArray(window.appSettings.regoleImportazioneJson)) {
        window.appSettings.regoleImportazioneJson = getRegoleImportazioneJson();
    }

    if (idRegola) {
        const idx = window.appSettings.regoleImportazioneJson.findIndex(r => r.id === idRegola);
        if (idx !== -1) {
            window.appSettings.regoleImportazioneJson[idx].valore_json = valore;
            window.appSettings.regoleImportazioneJson[idx].categoria = categoria;
        }
    } else {
        const newId = 'rule_' + Date.now();
        window.appSettings.regoleImportazioneJson.push({
            id: newId,
            valore_json: valore,
            categoria: categoria
        });
    }

    renderRegoleImportazioneJsonTabella();
    chiudiModalRegolaJson();
    showToast("Regola aggiunta. Clicca 'Salva Regole Importazione JSON' per salvare le modifiche.", "info");
}

/**
 * Rimuove una regola di importazione JSON
 */
function eliminaRegolaJson(idRegola) {
    if (!window.appSettings || !Array.isArray(window.appSettings.regoleImportazioneJson)) return;
    
    window.appSettings.regoleImportazioneJson = window.appSettings.regoleImportazioneJson.filter(r => r.id !== idRegola);
    renderRegoleImportazioneJsonTabella();
    showToast("Regola eliminata. Clicca 'Salva Regole Importazione JSON' per salvare le modifiche.", "info");
}

/**
 * Salva le regole di importazione JSON sul server
 */
async function salvaRegoleImportazioneJson() {
    if (!window.appSettings) return;
    
    try {
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings: window.appSettings })
        });
        const data = await res.json();
        if (data.success) {
            if (data.settings) {
                window.appSettings = data.settings;
                renderRegoleImportazioneJsonTabella();
            }
            showToast("✅ Regole Importazione JSON salvate con successo!", "success");
        } else {
            showToast("Errore durante il salvataggio: " + (data.error || "Sconosciuto"), "error");
        }
    } catch (err) {
        showToast("Errore durante il salvataggio: " + err.message, "error");
    }
}

/**
 * Esegue lo scroll verso la scheda delle Regole Importazione JSON
 */
function scrollaARegoleImportazioneJson() {
    setTimeout(() => {
        const card = document.getElementById('card-regole-importazione-json');
        if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.classList.add('ring-2', 'ring-brand-gold');
            setTimeout(() => card.classList.remove('ring-2', 'ring-brand-gold'), 3000);
        }
    }, 150);
}

window.getRegoleImportazioneJson = getRegoleImportazioneJson;
window.renderRegoleImportazioneJsonTabella = renderRegoleImportazioneJsonTabella;
window.apriModalNuovaRegolaJson = apriModalNuovaRegolaJson;
window.chiudiModalRegolaJson = chiudiModalRegolaJson;
window.salvaRegolaJsonModal = salvaRegolaJsonModal;
window.eliminaRegolaJson = eliminaRegolaJson;
window.salvaRegoleImportazioneJson = salvaRegoleImportazioneJson;
window.scrollaARegoleImportazioneJson = scrollaARegoleImportazioneJson;

/**
 * Gestisce la selezione del cambio valuta Automatico / Manuale
 */
function setValutaMode(mode, triggerSave = true) {
    const autoBtn = document.getElementById('setting-valuta-mode-auto');
    const manualBtn = document.getElementById('setting-valuta-mode-manual');
    const manualContainer = document.getElementById('setting-valuta-manual-container');

    if (mode === 'auto') {
        if (autoBtn) autoBtn.className = "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all bg-slate-950 text-white shadow-sm";
        if (manualBtn) manualBtn.className = "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all text-slate-700 hover:bg-slate-200/50";
        if (manualContainer) manualContainer.classList.add('hidden');
    } else {
        if (autoBtn) autoBtn.className = "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all text-slate-700 hover:bg-slate-200/50";
        if (manualBtn) manualBtn.className = "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all bg-slate-950 text-white shadow-sm";
        if (manualContainer) manualContainer.classList.remove('hidden');
    }

    if (window.appSettings && window.appSettings.cambioValuta) {
        window.appSettings.cambioValuta.mode = mode;
    }
}

/**
 * Salva una specifica sezione delle impostazioni sul server
 */
async function salvaSezioneSettings(sezione) {
    if (!window.appSettings) window.appSettings = {};

    if (sezione === 'prezzi') {
        window.appSettings.prezziPredefiniti = {
            "Kit": parseFloat(document.getElementById('setting-prezzo-kit').value) || 23.99,
            "Player": parseFloat(document.getElementById('setting-prezzo-player').value) || 22.99,
            "Fan": parseFloat(document.getElementById('setting-prezzo-fan').value) || 22.99,
            "Kit Allenamento": parseFloat(document.getElementById('setting-prezzo-allenamento').value) || 25.99,
            "Retro": parseFloat(document.getElementById('setting-prezzo-retro').value) || 23.99,
            "Tuta": parseFloat(document.getElementById('setting-prezzo-tuta').value) || 44.99,
            "Kit Bambino": parseFloat(document.getElementById('setting-prezzo-bambino').value) || 19.99
        };
    } else if (sezione === 'spedizione') {
        window.appSettings.spedizioneLotto = {
            "range1_min": parseInt(document.getElementById('setting-shipping-range1-min').value) || 1,
            "range1_max": parseInt(document.getElementById('setting-shipping-range1-max').value) || 10,
            "range1_cost": parseFloat(document.getElementById('setting-shipping-range1').value) || 4.0,
            "range2_min": parseInt(document.getElementById('setting-shipping-range2-min').value) || 11,
            "range2_max": parseInt(document.getElementById('setting-shipping-range2-max').value) || 20,
            "range2_cost": parseFloat(document.getElementById('setting-shipping-range2').value) || 3.0,
            "range3_min": parseInt(document.getElementById('setting-shipping-range3-min').value) || 21,
            "range3_cost": parseFloat(document.getElementById('setting-shipping-range3').value) || 2.0
        };
    } else if (sezione === 'valuta') {
        const mode = document.getElementById('setting-valuta-manual-container').classList.contains('hidden') ? 'auto' : 'manual';
        window.appSettings.cambioValuta = {
            "mode": mode,
            "manual_rate": parseFloat(document.getElementById('setting-valuta-rate').value) || 0.86
        };
    } else if (sezione === 'contatti') {
        const rawPhone = document.getElementById('setting-whatsapp').value.trim();
        window.appSettings.contatti = {
            "whatsapp_number": normalizzaNumeroWhatsApp(rawPhone) || "393282218320",
            "support_email": document.getElementById('setting-email').value.trim() || "assistenza@elitetournamentstore.com"
        };
    } else if (sezione === 'valoriPredefiniti') {
        window.appSettings.valoriPredefiniti = {
            "stagione": document.getElementById('setting-default-stagione').value.trim() || "2024/2025",
            "categoria": document.getElementById('setting-default-categoria').value,
            "versione": document.getElementById('setting-default-versione').value
        };
    } else if (sezione === 'sicurezza') {
        const pCheck = document.getElementById('setting-conferma-prodotto');
        const oCheck = document.getElementById('setting-conferma-ordine');
        const rCheck = document.getElementById('setting-conferma-recensione');
        window.appSettings.sicurezza = {
            "conferma_elimina_prodotto": pCheck ? pCheck.checked : true,
            "conferma_elimina_ordine": oCheck ? oCheck.checked : true,
            "conferma_elimina_recensione": rCheck ? rCheck.checked : true
        };
    }

    try {
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(window.appSettings)
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                window.appSettings = data.settings;
                showToast("Impostazioni salvate con successo!", "success");
                popolaSettingsUI();
            } else {
                showToast("Errore durante il salvataggio.", "error");
            }
        } else {
            showToast("Errore di connessione al server.", "error");
        }
    } catch (e) {
        console.error(e);
        showToast("Errore di rete.", "error");
    }
}

// ==========================================
// GESTIONE CATEGORIE DINAMICHE & REGOLE PREZZI
// ==========================================

function assicuratiCategorieDinamiche() {
    if (!window.appSettings) window.appSettings = {};
    if (!Array.isArray(window.appSettings.categorie) || window.appSettings.categorie.length === 0) {
        const regole = window.appSettings.regolePrezzi || {};
        const defaultCats = [
            { id: 'cat_kit', nome: 'Kit', prezzo_adulto: 26.99, prezzo_bambino: 21.99, ordine: 1, stato: 'attivo' },
            { id: 'cat_player', nome: 'Player', prezzo_adulto: 21.99, prezzo_bambino: 19.99, ordine: 2, stato: 'attivo' },
            { id: 'cat_fan', nome: 'Fan', prezzo_adulto: 21.99, prezzo_bambino: 19.99, ordine: 3, stato: 'attivo' },
            { id: 'cat_retro', nome: 'Retro', prezzo_adulto: 21.99, prezzo_bambino: 19.99, ordine: 4, stato: 'attivo' },
            { id: 'cat_allenamento', nome: 'Kit Allenamento', prezzo_adulto: 25.99, prezzo_bambino: 21.99, ordine: 5, stato: 'attivo' },
            { id: 'cat_tuta', nome: 'Tuta', prezzo_adulto: 44.99, prezzo_bambino: 40.00, ordine: 6, stato: 'attivo' }
        ];

        window.appSettings.categorie = defaultCats.map((cat, idx) => {
            const keyA = `${cat.nome}_Adulto`;
            const keyB = `${cat.nome}_Bambino`;
            return {
                id: cat.id || `cat_${Date.now()}_${idx}`,
                nome: cat.nome,
                prezzo_adulto: regole[keyA] !== undefined ? parseFloat(regole[keyA]) : cat.prezzo_adulto,
                prezzo_bambino: regole[keyB] !== undefined ? parseFloat(regole[keyB]) : cat.prezzo_bambino,
                ordine: idx + 1,
                stato: 'attivo'
            };
        });
    }
}

/**
 * Restituisce l'elenco dinamico unico delle categorie definite nelle Regole Prezzi
 */
function getListaCategorieRegolePrezzi() {
    assicuratiCategorieDinamiche();
    const list = [];
    if (window.appSettings && Array.isArray(window.appSettings.categorie)) {
        window.appSettings.categorie.forEach(c => {
            if (c && c.nome && typeof c.nome === 'string' && c.nome.trim() !== '') {
                const nameTrim = c.nome.trim();
                if (!list.includes(nameTrim)) {
                    list.push(nameTrim);
                }
            }
        });
    }
    return list;
}

function renderRegolePrezziTabella() {
    assicuratiCategorieDinamiche();
    const tbody = document.getElementById('regole-prezzi-tbody');
    if (!tbody) return;

    window.appSettings.categorie.sort((a, b) => (Number(a.ordine) || 0) - (Number(b.ordine) || 0));

    let html = '';
    window.appSettings.categorie.forEach((cat, index) => {
        const isAttivo = cat.stato === 'attivo' || cat.attivo !== false;
        html += `
            <tr data-cat-id="${cat.id || index}" class="hover:bg-slate-50/80 transition-all border-b border-slate-100 last:border-0">
                <td class="px-4 py-3 text-center">
                    <input type="number" value="${cat.ordine !== undefined ? cat.ordine : (index + 1)}" min="1" 
                        onchange="aggiornaCampoCategoria('${cat.id || index}', 'ordine', this.value)"
                        class="w-16 mx-auto block text-center bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-xs font-semibold focus:outline-none focus:border-brand-gold transition-all">
                </td>
                <td class="px-4 py-3">
                    <input type="text" value="${cat.nome || ''}" 
                        onchange="aggiornaCampoCategoria('${cat.id || index}', 'nome', this.value)"
                        class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-brand-gold transition-all">
                </td>
                <td class="px-4 py-3">
                    <input type="number" step="0.01" min="0" value="${cat.prezzo_adulto !== undefined ? cat.prezzo_adulto : 23.99}" 
                        onchange="aggiornaCampoCategoria('${cat.id || index}', 'prezzo_adulto', this.value)"
                        class="w-28 mx-auto block text-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-brand-gold transition-all">
                </td>
                <td class="px-4 py-3">
                    <input type="number" step="0.01" min="0" value="${cat.prezzo_bambino !== undefined ? cat.prezzo_bambino : 19.99}" 
                        onchange="aggiornaCampoCategoria('${cat.id || index}', 'prezzo_bambino', this.value)"
                        class="w-28 mx-auto block text-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-brand-gold transition-all">
                </td>
                <td class="px-4 py-3 text-center">
                    <select onchange="aggiornaCampoCategoria('${cat.id || index}', 'stato', this.value)"
                        class="px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${isAttivo ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}">
                        <option value="attivo" ${isAttivo ? 'selected' : ''}>Attivo</option>
                        <option value="inattivo" ${!isAttivo ? 'selected' : ''}>Inattivo</option>
                    </select>
                </td>
                <td class="px-4 py-3 text-center">
                    <button type="button" onclick="eliminaCategoria('${cat.id || index}')" title="Elimina Categoria"
                        class="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all">
                        🗑️
                    </button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    aggiornaMenuCategorieForm();
}

function aggiornaCampoCategoria(idOrIndex, field, value) {
    assicuratiCategorieDinamiche();
    const cat = window.appSettings.categorie.find((c, idx) => c.id === idOrIndex || String(idx) === String(idOrIndex));
    if (cat) {
        if (field === 'ordine' || field === 'prezzo_adulto' || field === 'prezzo_bambino') {
            cat[field] = parseFloat(value) || 0;
        } else {
            cat[field] = value;
        }
        aggiornaMenuCategorieForm();
    }
}

function apriModalNuovaCategoria() {
    const modal = document.getElementById('categoria-modal');
    const container = document.getElementById('categoria-modal-container');
    if (!modal || !container) return;

    const maxOrdine = (window.appSettings?.categorie || []).reduce((max, c) => Math.max(max, Number(c.ordine) || 0), 0);

    const elNome = document.getElementById('categoria-form-nome');
    const elAdulto = document.getElementById('categoria-form-prezzo-adulto');
    const elBambino = document.getElementById('categoria-form-prezzo-bambino');
    const elOrdine = document.getElementById('categoria-form-ordine');
    const elStato = document.getElementById('categoria-form-stato');

    if (elNome) elNome.value = '';
    if (elAdulto) elAdulto.value = '26.99';
    if (elBambino) elBambino.value = '21.99';
    if (elOrdine) elOrdine.value = maxOrdine + 1;
    if (elStato) elStato.value = 'attivo';

    modal.classList.remove('hidden');
    setTimeout(() => {
        container.classList.remove('scale-95', 'opacity-0');
        container.classList.add('scale-100', 'opacity-100');
    }, 10);
}

function chiudiModalNuovaCategoria() {
    const modal = document.getElementById('categoria-modal');
    const container = document.getElementById('categoria-modal-container');
    if (!modal || !container) return;

    container.classList.remove('scale-100', 'opacity-100');
    container.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 200);
}

function salvaNuovaCategoria() {
    assicuratiCategorieDinamiche();
    const nome = (document.getElementById('categoria-form-nome')?.value || '').trim();
    const prezzoAdulto = parseFloat(document.getElementById('categoria-form-prezzo-adulto')?.value || 0);
    const prezzoBambino = parseFloat(document.getElementById('categoria-form-prezzo-bambino')?.value || 0);
    const ordine = parseInt(document.getElementById('categoria-form-ordine')?.value || 0, 10) || (window.appSettings.categorie.length + 1);
    const stato = document.getElementById('categoria-form-stato')?.value || 'attivo';

    if (!nome) {
        showToast("Inserisci un nome per la categoria.", "warning");
        return;
    }

    const giaPresente = window.appSettings.categorie.some(c => c.nome.toLowerCase() === nome.toLowerCase());
    if (giaPresente) {
        showToast("Una categoria con questo nome esiste già.", "warning");
        return;
    }

    const nuovaCat = {
        id: 'cat_' + Date.now(),
        nome: nome,
        prezzo_adulto: prezzoAdulto,
        prezzo_bambino: prezzoBambino,
        ordine: ordine,
        stato: stato
    };

    window.appSettings.categorie.push(nuovaCat);
    chiudiModalNuovaCategoria();
    renderRegolePrezziTabella();
    aggiornaMenuCategorieForm();
    showToast(`✅ Categoria "${nome}" creata. Clicca "Salva Regole Prezzi" per salvare le modifiche.`, "success");
}

function eliminaCategoria(idOrIndex) {
    assicuratiCategorieDinamiche();
    const idx = window.appSettings.categorie.findIndex((c, i) => c.id === idOrIndex || String(i) === String(idOrIndex));
    if (idx === -1) return;

    const cat = window.appSettings.categorie[idx];
    if (!confirm(`Sei sicuro di voler eliminare la categoria "${cat.nome}"?`)) {
        return;
    }

    window.appSettings.categorie.splice(idx, 1);
    renderRegolePrezziTabella();
    aggiornaMenuCategorieForm();
    showToast(`Categoria "${cat.nome}" eliminata. Clicca "Salva Regole Prezzi" per salvare le modifiche.`, "info");
}

function aggiornaMenuCategorieForm() {
    assicuratiCategorieDinamiche();

    const categorieAttive = (window.appSettings?.categorie || [])
        .filter(c => c.stato === 'attivo' || c.attivo !== false)
        .sort((a, b) => (Number(a.ordine) || 0) - (Number(b.ordine) || 0));

    const nomiCategorie = categorieAttive.map(c => c.nome);

    // 1. Single Product Edit Modal (#form-categoria)
    const selectSingle = document.getElementById('form-categoria');
    if (selectSingle) {
        const currentVal = selectSingle.value;
        selectSingle.innerHTML = '<option value="" disabled selected>Seleziona Categoria</option>';
        nomiCategorie.forEach(catNome => {
            const opt = document.createElement('option');
            opt.value = catNome;
            opt.textContent = catNome;
            if (currentVal && currentVal.toLowerCase() === catNome.toLowerCase()) {
                opt.selected = true;
            }
            selectSingle.appendChild(opt);
        });
        if (currentVal && !nomiCategorie.some(n => n.toLowerCase() === currentVal.toLowerCase())) {
            const opt = document.createElement('option');
            opt.value = currentVal;
            opt.textContent = currentVal;
            opt.selected = true;
            selectSingle.appendChild(opt);
        }
    }

    // 2. Batch Product Edit Modal (#batch-categoria)
    const selectBatch = document.getElementById('batch-categoria');
    if (selectBatch) {
        const currentVal = selectBatch.value;
        selectBatch.innerHTML = '<option value="">-- Lascia invariato --</option>';
        nomiCategorie.forEach(catNome => {
            const opt = document.createElement('option');
            opt.value = catNome;
            opt.textContent = catNome;
            if (currentVal && currentVal.toLowerCase() === catNome.toLowerCase()) {
                opt.selected = true;
            }
            selectBatch.appendChild(opt);
        });
    }

    // 3. Product List Filter Header (#filter-categoria)
    const selectFilter = document.getElementById('filter-categoria');
    if (selectFilter) {
        const currentVal = selectFilter.value;
        selectFilter.innerHTML = '<option value="">Tutte le categorie</option>';
        nomiCategorie.forEach(catNome => {
            const opt = document.createElement('option');
            opt.value = catNome;
            opt.textContent = catNome;
            if (currentVal && currentVal.toLowerCase() === catNome.toLowerCase()) {
                opt.selected = true;
            }
            selectFilter.appendChild(opt);
        });
    }
}

function aggiornaMenuFiltriCatalogoForm() {
    assicuratiFiltriDinamici();

    const filtriAttivi = (window.appSettings?.filtriCatalogo || [])
        .filter(f => f.stato === 'attivo' || f.attivo !== false)
        .sort((a, b) => (Number(a.ordine) || 0) - (Number(b.ordine) || 0));

    const nomiFiltri = filtriAttivi.map(f => f.nome);

    // 1. Single Product Edit Modal (#form-filtro-catalogo)
    const selectSingle = document.getElementById('form-filtro-catalogo');
    if (selectSingle) {
        const currentVal = selectSingle.value;
        selectSingle.innerHTML = '<option value="">Nessun filtro</option>';
        nomiFiltri.forEach(filtroNome => {
            const opt = document.createElement('option');
            opt.value = filtroNome;
            opt.textContent = filtroNome;
            if (currentVal && currentVal.toLowerCase() === filtroNome.toLowerCase()) {
                opt.selected = true;
            }
            selectSingle.appendChild(opt);
        });
        if (currentVal && !nomiFiltri.some(n => n.toLowerCase() === currentVal.toLowerCase())) {
            const opt = document.createElement('option');
            opt.value = currentVal;
            opt.textContent = currentVal;
            opt.selected = true;
            selectSingle.appendChild(opt);
        }
    }

    // 2. Batch Product Edit Modal (#batch-filtro-catalogo)
    const selectBatch = document.getElementById('batch-filtro-catalogo');
    if (selectBatch) {
        const currentVal = selectBatch.value;
        selectBatch.innerHTML = '<option value="">-- Lascia invariato --</option>';
        nomiFiltri.forEach(filtroNome => {
            const opt = document.createElement('option');
            opt.value = filtroNome;
            opt.textContent = filtroNome;
            if (currentVal && currentVal.toLowerCase() === filtroNome.toLowerCase()) {
                opt.selected = true;
            }
            selectBatch.appendChild(opt);
        });
    }
}

window.aggiornaMenuCategorieForm = aggiornaMenuCategorieForm;
window.aggiornaMenuFiltriCatalogoForm = aggiornaMenuFiltriCatalogoForm;

/**
 * Salva le regole di prezzo & categorie
 */
async function salvaRegolePrezzi(applyToExisting = false) {
    if (!window.appSettings) window.appSettings = {};
    assicuratiCategorieDinamiche();

    // Sincronizza mappa regolePrezzi per retrocompatibilità
    const rules = {};
    const targetPairsToUpdate = [];

    window.appSettings.categorie.forEach(cat => {
        if (cat.nome) {
            const pA = parseFloat(cat.prezzo_adulto) || 0;
            const pB = parseFloat(cat.prezzo_bambino) || 0;
            rules[`${cat.nome}_Adulto`] = pA;
            rules[`${cat.nome}_Bambino`] = pB;

            targetPairsToUpdate.push({ categoria: cat.nome, target: 'Adulto', prezzo: pA });
            targetPairsToUpdate.push({ categoria: cat.nome, target: 'Bambino', prezzo: pB });
        }
    });

    window.appSettings.regolePrezzi = rules;

    if (applyToExisting) {
        try {
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    applyToExisting: true,
                    settings: window.appSettings,
                    targetPairsToUpdate: targetPairsToUpdate
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    window.appSettings = data.settings;
                    popolaSettingsUI();
                    showToast("✅ Aggiornamento completato.", "success");
                    if (data.summary) {
                        alert("✅ Aggiornamento completato.\n\n" + data.summary);
                    }
                    if (typeof caricaDati === 'function') {
                        await caricaDati();
                    }
                } else {
                    showToast("Errore durante l'aggiornamento: " + (data.error || "Errore sconosciuto"), "error");
                }
            } else {
                showToast("Errore di connessione durante l'aggiornamento.", "error");
            }
        } catch (e) {
            console.error("Errore applicazione regole prezzi:", e);
            showToast("Si è verificato un errore: " + e.message, "error");
        }
        return;
    }

    try {
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                applyToExisting: false,
                settings: window.appSettings,
                targetPairsToUpdate: targetPairsToUpdate
            })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                window.appSettings = data.settings;
                popolaSettingsUI();
                showToast("✅ Regole prezzi e categorie salvate correttamente.", "success");
            } else {
                showToast("Errore durante il salvataggio: " + (data.error || "Errore sconosciuto"), "error");
            }
        } else {
            showToast("Errore di connessione durante il salvataggio.", "error");
        }
    } catch (e) {
        console.error("Errore salvataggio regole prezzi:", e);
        showToast("Si è verificato un errore: " + e.message, "error");
    }
}

window.apriModalNuovaCategoria = apriModalNuovaCategoria;
window.chiudiModalNuovaCategoria = chiudiModalNuovaCategoria;
window.salvaNuovaCategoria = salvaNuovaCategoria;
window.eliminaCategoria = eliminaCategoria;
window.aggiornaCampoCategoria = aggiornaCampoCategoria;
window.salvaRegolePrezzi = salvaRegolePrezzi;
window.renderRegolePrezziTabella = renderRegolePrezziTabella;
window.aggiornaMenuCategorieForm = aggiornaMenuCategorieForm;

/**
 * Popola il menu a tendina di gestione squadre con tutte le squadre distinte presenti nel catalogo
 */
function aggiornaSquadreDropdown() {
    const select = document.getElementById('rename-team-select');
    if (!select) return;

    // Ottiene squadre distinte dal catalogo centrale
    const squadreUniche = squadreCatalogo.length > 0
        ? [...new Set(squadreCatalogo.map(t => t.name).filter(Boolean))].sort()
        : [...new Set(prodotti.map(p => p.squadra).filter(Boolean))].sort();

    select.innerHTML = '<option value="" disabled selected>Seleziona Squadra da Rinominare</option>';
    squadreUniche.forEach(sq => {
        const opt = document.createElement('option');
        opt.value = sq;
        opt.innerText = sq;
        select.appendChild(opt);
    });
}

/**
 * Invia la richiesta di rinomina in massa per una squadra al server
 */
async function gestisciRinominaSquadra() {
    const oldName = document.getElementById('rename-team-select').value;
    const newName = document.getElementById('rename-team-newname').value.trim();

    if (!oldName || !newName) {
        showToast("Per favore seleziona una squadra e inserisci il nuovo nome.", "error");
        return;
    }

    if (!confirm(`Sei sicuro di voler rinominare la squadra "${oldName}" in "${newName}" per tutti i prodotti e nel catalogo centralizzato?`)) {
        return;
    }

    try {
        const res = await fetch('/api/teams', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oldName, newName })
        });

        if (res.ok) {
            const result = await res.json();
            if (result.success) {
                showToast(`Aggiornati con successo ${result.count || 0} prodotti e la squadra centrale!`, "success");
                document.getElementById('rename-team-newname').value = "";
                await caricaDati();
                aggiornaSquadreDropdown();
            } else {
                showToast("Errore rinomina: " + (result.error || ""), "error");
            }
        } else {
            showToast("Errore di connessione.", "error");
        }
    } catch (e) {
        console.error(e);
        showToast("Errore di rete.", "error");
    }
}

/**
 * Gestisce l'eliminazione di una squadra se non contiene prodotti
 */
async function gestisciEliminaSquadra() {
    const selectedTeam = document.getElementById('rename-team-select').value;
    if (!selectedTeam) {
        showToast("Per favore seleziona una squadra da eliminare.", "error");
        return;
    }

    // Contiamo quanti prodotti sono collegati a questa squadra
    const prodottiCollegati = prodotti.filter(p => p.squadra === selectedTeam);
    const count = prodottiCollegati.length;

    if (count > 0) {
        alert(`Questa squadra contiene ancora ${count} prodotti e non può essere eliminata.`);
        return;
    }

    //if (!confirm(`Sei sicuro di voler eliminare la squadra "${selectedTeam}" dal catalogo delle squadre?`)) {
    //    return;
    //}

    try {
        const res = await fetch('/api/teams', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: selectedTeam })
        });

        if (res.ok) {
            const result = await res.json();
            if (result.success) {
                showToast(`Squadra "${selectedTeam}" eliminata con successo dal catalogo!`, "success");
                await caricaDati();
                aggiornaSquadreDropdown();
            } else {
                showToast("Errore eliminazione: " + (result.error || ""), "error");
            }
        } else {
            showToast("Errore di connessione.", "error");
        }
    } catch (e) {
        console.error(e);
        showToast("Errore di rete.", "error");
    }
}

/**
 * Legge un file come stringa di testo (Promise-based)
 */
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = err => reject(err);
        reader.readAsText(file);
    });
}

/**
 * Determina categoria e sezione per una squadra sconosciuta in base a nome file e primo prodotto
 */
function determinaCategoriaESezionePerSquadra(filename, firstProduct) {
    const fn = filename.toLowerCase();
    let categoria = "Club";
    let sezione = "Altri Club";

    // 1. NBA
    if (fn.includes('nba') || fn.includes('conference') || (firstProduct && String(firstProduct.categoria || '').toLowerCase().includes('nba'))) {
        categoria = "NBA";
        if (fn.includes('eastern')) {
            sezione = "Eastern Conference";
        } else if (fn.includes('western')) {
            sezione = "Western Conference";
        } else {
            sezione = "Eastern Conference";
        }
        return { categoria, sezione };
    }

    // 2. Nazionali
    if (fn.includes('nazionali') || fn.includes('europa') || fn.includes('sud_america') || fn.includes('sudamerica') || fn.includes('africa') || fn.includes('asia') || fn.includes('oceania') || fn.includes('america')) {
        categoria = "Nazionali";
        if (fn.includes('europa')) {
            sezione = "Europa";
        } else if (fn.includes('sud_america') || fn.includes('sudamerica')) {
            sezione = "Sud America";
        } else if (fn.includes('nord_america') || fn.includes('nordamerica') || fn.includes('america')) {
            sezione = "Nord America";
        } else if (fn.includes('africa')) {
            sezione = "Africa";
        } else if (fn.includes('asia')) {
            sezione = "Asia";
        } else if (fn.includes('oceania')) {
            sezione = "Oceania";
        } else {
            sezione = "Europa";
        }
        return { categoria, sezione };
    }

    // 3. Club
    const knownLeagues = [
        { key: "premier", value: "Premier League" },
        { key: "bundesliga", value: "Bundesliga" },
        { key: "serie a", value: "Serie A" },
        { key: "serie_a", value: "Serie A" },
        { key: "la liga", value: "La Liga" },
        { key: "laliga", value: "La Liga" },
        { key: "ligue 1", value: "Ligue 1" },
        { key: "ligue1", value: "Ligue 1" },
        { key: "liga mx", value: "Liga MX" },
        { key: "ligamx", value: "Liga MX" },
        { key: "usa mls", value: "USA MLS" },
        { key: "mls", value: "USA MLS" },
        { key: "brasileirao", value: "Brasileirao" },
        { key: "j-league", value: "J-League" },
        { key: "jleague", value: "J-League" },
        { key: "saudi", value: "Saudi League" }
    ];

    for (const league of knownLeagues) {
        if (fn.includes(league.key)) {
            return { categoria: "Club", sezione: league.value };
        }
    }

    // Pulizia e capitalizzazione nome file
    let cleaned = filename.replace(/\.json$/i, '').replace(/[_-]/g, ' ').trim();
    if (cleaned) {
        const words = cleaned.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
        const guessedName = words.join(' ');
        
        const isKnownTeam = popularClubs.some(club => 
            club.name.toLowerCase() === guessedName.toLowerCase() || 
            club.keys.some(k => k.toLowerCase() === guessedName.toLowerCase())
        );

        if (!isKnownTeam && guessedName.length > 3) {
            sezione = guessedName;
        }
    }

    return { categoria, sezione };
}

/**
 * Gestisce la chiusura del modal di riepilogo dell'importazione multipla
 */
function closeMultiImportResultsModal() {
    const modal = document.getElementById('multi-import-results-modal');
    const container = document.getElementById('multi-results-modal-container');
    if (modal && container) {
        container.classList.add('scale-95', 'opacity-0');
        container.classList.remove('scale-100', 'opacity-100');
        setTimeout(() => {
            modal.classList.add('hidden');
            caricaDati();
        }, 300);
    }
}
window.closeMultiImportResultsModal = closeMultiImportResultsModal;

/**
 * Gestisce il caricamento del file JSON o di multipli file JSON per l'importazione automatica in sequenza
 */
/**
 * Gestisce la scansione, l'estrazione e l'unificazione di prodotti da file multipli prima della revisione
 */
async function handleImportFile(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Se viene selezionato un singolo file, lo carichiamo anche nella textarea per mantenere l'interfaccia coerente
    if (files.length === 1) {
        try {
            const file = files[0];
            const text = await readFileAsText(file);
            document.getElementById('import-json-textarea').value = text;
        } catch (e) {
            console.error("Errore lettura singolo file nella textarea:", e);
        }
    }

    const totalFiles = files.length;
    let allProductsMerged = [];
    
    // Mostra progresso iniziale scansione dei file
    mostraProgressoImportazione("Lettura File JSON", `Inizio lettura di ${totalFiles} file...`, 2, `File: 0/${totalFiles}`);

    for (let i = 0; i < totalFiles; i++) {
        const file = files[i];
        
        // Aggiorna il progresso della lettura
        const pct = Math.round(((i + 1) / totalFiles) * 10);
        mostraProgressoImportazione("Lettura File JSON", `Lettura file: ${file.name}`, pct, `File: ${i + 1}/${totalFiles}`);
        await new Promise(resolve => setTimeout(resolve, 50)); // piccolissima pausa per rendering grafico iniziale
        
        try {
            const text = await readFileAsText(file);
            const parsed = JSON.parse(text);
            const productsArray = Array.isArray(parsed) ? parsed : [parsed];
            allProductsMerged.push(...productsArray);
        } catch (err) {
            console.error(`Errore di lettura o parsing nel file ${file.name}:`, err);
            showToast(`File "${file.name}" saltato: formato JSON non valido.`, "error");
        }
    }

    // Svuota l'input file per consentire caricamenti futuri
    event.target.value = '';

    if (allProductsMerged.length === 0) {
        nascondiProgressoImportazione();
        showToast("Nessun prodotto valido è stato trovato nei file scansionati.", "error");
        return;
    }

    // Passa l'array unificato al nostro motore di revisione interattivo
    await processaArrayProdottiScansionati(allProductsMerged, totalFiles);
}

/**
 * Funzione principale unificata che analizza, mappa, traduce ed inserisce i prodotti nell'area di revisione
 */
async function processaArrayProdottiScansionati(productsArray, totalFiles = 1) {
    scanStartTime = Date.now();
    importCurrentPage = 1;
    
    // Mostra barra di caricamento iniziale
    mostraProgressoImportazione("Analisi Catalogo", "Preparazione dati di validazione...", 10, `Prodotti: 0/${productsArray.length}`);

    // Assicuriamoci che squadreCatalogo sia caricato più recente possibile
    await caricaSquadre();

    const squadreEsistenti = [...new Set(squadreCatalogo.map(t => t.name).filter(Boolean))].sort();

    selezionatiInAnteprima.clear();
    filtroAnteprima = 'all';
    ricercaAnteprima = '';
    mostraSoloErrori = false;
    aggiornaStatoFiltroVisivo();
    
    // Ripristina l'intestazione checkbox di selezione globale
    const selectAllCheckbox = document.getElementById('select-all-import-checkbox');
    if (selectAllCheckbox) selectAllCheckbox.checked = false;

    const tempProdottiInAnteprima = [];
    const chunkMinSize = 50;

    const categorieNonRiconosciuteSet = new Set();
    const regoleImport = getRegoleImportazioneJson();

    // Mappatura ed arricchimento dei prodotti scansionati in modo sequenziale per garantire ID univoci sicuri
    for (let index = 0; index < productsArray.length; index++) {
        const p = productsArray[index];

        const rawCategoryVal = (p.categoria || p.category || p.cat || p.type || p.category_name || '').toString().trim();
        if (rawCategoryVal) {
            const lowerRaw = rawCategoryVal.toLowerCase();
            const isMatched = regoleImport.some(r => {
                const val = (r.valore_json || '').toString().trim().toLowerCase();
                return val && (val === lowerRaw || lowerRaw.includes(val));
            });
            if (!isMatched) {
                categorieNonRiconosciuteSet.add(rawCategoryVal);
            }
        }

        let rawImg = p.image || p.product_image || p.immagine || p.imgUrl || p.img || '';
        let imgUrl = '';
        if (Array.isArray(rawImg)) {
            imgUrl = rawImg.length > 0 ? String(rawImg[0]) : '';
        } else if (rawImg && typeof rawImg === 'object') {
            imgUrl = String(rawImg.url || rawImg.src || rawImg.href || '');
        } else {
            imgUrl = String(rawImg || '');
        }
        imgUrl = imgUrl.trim();

        if (imgUrl.startsWith('//')) {
            imgUrl = 'https:' + imgUrl;
        } else if (imgUrl.startsWith('/') && !imgUrl.startsWith('//')) {
            imgUrl = 'https://jerseys-catalog.com' + imgUrl;
        } else if (imgUrl && !imgUrl.startsWith('http://') && !imgUrl.startsWith('https://')) {
            imgUrl = 'https://jerseys-catalog.com/' + imgUrl;
        }

        const alt = p.alt_text || p.image_alt || '';
        
        // 1. Estrazione ed Identificazione Squadra & Campionato dal Database
        const infoSquadra = estraiEIdentificaSquadra(p, squadreCatalogo);
        const squadra = infoSquadra.squadra;
        const campionato = infoSquadra.campionato;

        // 2. Estrazione Categoria
        const categoria = extractCategoria(p);

        // 4. Estrazione Target / Tipo Kit (Adulto/Bambino)
        const target = extractTarget(p);
        
        // 5. Estrazione Stagione
        const stagione = extractStagione(p);
        
        // 6. Versione e Nome Prodotto (normalizzato e tradotto)
        const versioneOriginale = p.name || p.title || p.product_title || p.nome || alt || 'Prodotto Importato';
        const versione = traduciTestoProdotto(versioneOriginale);
        const nomeFinale = versione;

        // 7. Estrazione Prezzi (Fornitore e Vendita suggerita)
        const prezzoFornitore = extractPrezzoFornitore(p);
        const prezzoVendita = getPrezzoVendita(categoria, target);

        // 8. Disponibilità (default true)
        const disponibilita = p.disponibilita !== undefined ? (p.disponibilita === true || String(p.disponibilita).toLowerCase() === 'true' || p.disponibilita === 1) : true;

        // 9. ID Univoco (non cerchiamo legacy_id o id inesistenti, ma generiamo automaticamente)
        let legacyId = undefined;

        const mappedProd = {
            id_anteprima: index,
            immagine: imgUrl,
            nome_finale: nomeFinale,
            squadra: squadra,
            categoria: categoria,
            campionato: campionato,
            target: target,
            stagione: stagione,
            versione: versione,
            prezzo: prezzoVendita,
            prezzo_fornitore: prezzoFornitore,
            disponibilita: disponibilita,
            id_autogenerato: false
        };

        // Genera sempre l'ID univoco sicuro automaticamente
        mappedProd.legacy_id = generaIdUnivocoSicuro(mappedProd, tempProdottiInAnteprima);
        mappedProd.id_autogenerato = true;

        tempProdottiInAnteprima.push(mappedProd);

        // Ogni batch di 50 elementi aggiorna la UI e fa riposare il thread principale
        if (index > 0 && (index % chunkMinSize === 0 || index === productsArray.length - 1)) {
            const pct = Math.round(10 + (index / productsArray.length) * 90);
            const elapsed = Date.now() - scanStartTime;
            const avgTime = elapsed / (index + 1);
            const remaining = productsArray.length - (index + 1);
            const estRemainingMs = avgTime * remaining;
            
            let etaString = '';
            if (index > 10 && estRemainingMs > 0) {
                const seconds = Math.round(estRemainingMs / 1000);
                if (seconds < 1) {
                    etaString = 'Qualche istante';
                } else if (seconds < 60) {
                    etaString = `${seconds}s stimati`;
                } else {
                    const mins = Math.floor(seconds / 60);
                    const secs = seconds % 60;
                    etaString = `${mins}m ${secs}s stimati`;
                }
            } else {
                etaString = 'Calcolo stima...';
            }

            const infoStr = `Scansione prodotto ${index + 1} di ${productsArray.length} | ETA: ${etaString}`;
            const countStr = `Processati: ${index + 1}/${productsArray.length} (File: ${totalFiles})`;
            mostraProgressoImportazione("Scansione Prodotti", infoStr, pct, countStr);

            // Cede l'esecuzione al browser per aggiornare la barra grafica
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    prodottiInAnteprima = tempProdottiInAnteprima;
    initialImportCount = prodottiInAnteprima.length;

    // Reset duplicate and validation caches
    invalidateDuplicateCache();

    // Pre-warm errors and duplicates caching in a single rapid pass
    prodottiInAnteprima.forEach(p => {
        p._errors = validaProdotto(p);
        p._dup = rilevaDuplicato(p);
    });

    // Avviso per categorie non riconosciute
    const alertBox = document.getElementById('import-unrecognized-categories-alert');
    if (alertBox) {
        if (categorieNonRiconosciuteSet.size > 0) {
            const lista = Array.from(categorieNonRiconosciuteSet);
            alertBox.innerHTML = `
                <div class="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div class="flex items-start gap-3">
                        <span class="text-2xl">⚠️</span>
                        <div>
                            <h4 class="text-xs font-black text-amber-900 uppercase tracking-wider">Categorie non riconosciute nel file JSON</h4>
                            <p class="text-xs text-amber-800 mt-0.5">
                                I seguenti valori non possiedono una regola di importazione e <strong>NON</strong> sono stati assegnati automaticamente ad un'altra categoria:
                                <strong class="font-bold text-amber-950">${lista.map(c => `"${escapeHtml(c)}"`).join(', ')}</strong>
                            </p>
                        </div>
                    </div>
                    <button onclick="closeImportPreviewModal(); switchTab('gestione-catalogo'); scrollaARegoleImportazioneJson();" type="button" class="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm whitespace-nowrap self-end sm:self-auto">
                        ⚙️ Gestisci Regole Importazione
                    </button>
                </div>
            `;
            alertBox.classList.remove('hidden');
        } else {
            alertBox.innerHTML = '';
            alertBox.classList.add('hidden');
        }
    }

    nascondiProgressoImportazione();
    renderAnteprimaTabella();
    openImportPreviewModal();
    showToast(`Analisi completata con successo! ${prodottiInAnteprima.length} prodotti in revisione.`, "success");
}

/**
 * Estrae o indovina la lega/campionato del prodotto in base alle regole ed alle squadre esistenti
 */
function extractCampionato(p, squadra, squadreCatalogo) {
    const info = estraiEIdentificaSquadra(p, squadreCatalogo);
    return info.campionato;
}

/**
 * Algoritmo sicuro che genera un ID univoco numerico non conflittuale per il prodotto
 */
function generaIdUnivocoSicuro(p, tempArray) {
    const existingIds = new Set();
    
    // 1. Raccoglie gli ID attivi del database catalogo
    if (Array.isArray(prodotti)) {
        prodotti.forEach(prod => {
            const uid = prod.id !== undefined ? prod.id : prod.legacy_id;
            if (uid !== undefined && uid !== null) {
                existingIds.add(Number(uid));
            }
        });
    }

    // 2. Raccoglie gli ID già assegnati nell'anteprima corrente
    const arrToUse = Array.isArray(tempArray) ? tempArray : prodottiInAnteprima;
    if (Array.isArray(arrToUse)) {
        arrToUse.forEach(prod => {
            if (prod && prod.id_anteprima !== p.id_anteprima && prod.legacy_id) {
                existingIds.add(Number(prod.legacy_id));
            }
        });
    }

    // 3. Ricerca il primo intero progressivo libero
    let nextId = Math.max(...Array.from(existingIds).filter(id => !isNaN(id)), 0) + 1;
    while (existingIds.has(nextId)) {
        nextId++;
    }
    return nextId;
}

/**
 * Rigenera l'ID per un singolo prodotto in anteprima su richiesta manuale
 */
function rigeneraIdProdottoAnteprima(id_anteprima) {
    const pIndex = findProdIndex(id_anteprima);
    if (pIndex === -1) return;
    
    const p = prodottiInAnteprima[pIndex];
    p.legacy_id = generaIdUnivocoSicuro(p);
    p.id_autogenerato = false; // L'utente ha chiesto un nuovo ID manuale/confermato
    
    // Aggiorna l'input testuale visivo in riga
    const row = document.getElementById(`import-row-${id_anteprima}`);
    if (row) {
        const idInput = row.querySelector(`input[onchange*="'legacy_id'"]`) || row.querySelector(`input[placeholder="ID"]`);
        if (idInput) {
            idInput.value = p.legacy_id;
        }
    }
    
    // Ricalcola lo stato e aggiorna i conteggi generali
    aggiornaCampoAnteprima(id_anteprima, 'legacy_id', p.legacy_id);
    showToast(`ID rigenerato con successo: ${p.legacy_id}`, "success");
}

// State and functions for Import Preview
let prodottiInAnteprima = [];
let selezionatiInAnteprima = new Set();
let mostraSoloErrori = false;
let initialImportCount = 0;
let filtroAnteprima = 'all';
let ricercaAnteprima = '';
let scanStartTime = null;
let importCurrentPage = 1;
const importPageSize = 100;

 const popularClubs = [

/* =========================
   PREMIER LEAGUE
========================= */

{ keys:["arsenal"], name:"Arsenal" },
{ keys:["aston villa","villa"], name:"Aston Villa" },
{ keys:["bournemouth","afc bournemouth"], name:"AFC Bournemouth" },
{ keys:["brentford"], name:"Brentford" },
{ keys:["brighton","brighton hove","brighton & hove","brighton and hove albion"], name:"Brighton & Hove Albion" },
{ keys:["burnley"], name:"Burnley" },
{ keys:["chelsea"], name:"Chelsea" },
{ keys:["crystal palace","palace"], name:"Crystal Palace" },
{ keys:["everton"], name:"Everton" },
{ keys:["fulham"], name:"Fulham" },
{ keys:["ipswich","ipswich town"], name:"Ipswich Town" },
{ keys:["leicester","leicester city"], name:"Leicester City" },
{ keys:["liverpool"], name:"Liverpool" },
{ keys:["manchester city","man city","man_city"], name:"Manchester City" },
{ keys:["manchester united","man utd","manchester utd"], name:"Manchester United" },
{ keys:["newcastle","newcastle united"], name:"Newcastle United" },
{ keys:["nottingham forest","forest"], name:"Nottingham Forest" },
{ keys:["southampton"], name:"Southampton" },
{ keys:["tottenham","spurs","tottenham hotspur"], name:"Tottenham Hotspur" },
{ keys:["west ham","west ham united"], name:"West Ham United" },
{ keys:["wolves","wolverhampton","wolverhampton wanderers"], name:"Wolverhampton Wanderers" },

/* =========================
   SERIE A
========================= */

{ keys:["atalanta"], name:"Atalanta" },
{ keys:["bologna"], name:"Bologna" },
{ keys:["cagliari"], name:"Cagliari" },
{ keys:["como"], name:"Como" },
{ keys:["empoli"], name:"Empoli" },
{ keys:["fiorentina"], name:"Fiorentina" },
{ keys:["genoa"], name:"Genoa" },
{ keys:["hellas verona","verona"], name:"Hellas Verona" },
{ keys:["inter","internazionale","inter milan"], name:"Inter" },
{ keys:["juventus","juve"], name:"Juventus" },
{ keys:["lazio"], name:"Lazio" },
{ keys:["lecce"], name:"Lecce" },
{ keys:["milan","ac milan"], name:"AC Milan" },
{ keys:["monza"], name:"Monza" },
{ keys:["napoli"], name:"Napoli" },
{ keys:["parma"], name:"Parma" },
{ keys:["pisa"], name:"Pisa" },
{ keys:["roma","as roma"], name:"Roma" },
{ keys:["sassuolo"], name:"Sassuolo" },
{ keys:["torino"], name:"Torino" },
{ keys:["udinese"], name:"Udinese" },
{ keys:["venezia"], name:"Venezia" },

/* =========================
   LA LIGA
========================= */

{ keys:["real madrid"], name:"Real Madrid" },
{ keys:["barcelona","barcellona","fc barcelona"], name:"Barcellona" },
{ keys:["atletico madrid","atlético madrid","atletico"], name:"Atletico Madrid" },
{ keys:["athletic bilbao","athletic"], name:"Athletic Bilbao" },
{ keys:["real sociedad"], name:"Real Sociedad" },
{ keys:["villarreal"], name:"Villarreal" },
{ keys:["real betis","betis"], name:"Real Betis" },
{ keys:["sevilla"], name:"Siviglia" },
{ keys:["valencia"], name:"Valencia" },
{ keys:["girona"], name:"Girona" },
{ keys:["celta vigo","celta"], name:"Celta Vigo" },
{ keys:["osasuna"], name:"Osasuna" },
{ keys:["mallorca"], name:"Mallorca" },
{ keys:["getafe"], name:"Getafe" },
{ keys:["rayo vallecano","rayo"], name:"Rayo Vallecano" },
{ keys:["espanyol"], name:"Espanyol" },
{ keys:["alaves","alavés"], name:"Alavés" },
{ keys:["leganes","leganés"], name:"Leganés" },
{ keys:["las palmas"], name:"Las Palmas" },

/* =========================
   BUNDESLIGA
========================= */

{ keys:["bayern","bayern munich","bayern monaco","fc bayern"], name:"Bayern Monaco" },
{ keys:["borussia dortmund","dortmund"], name:"Borussia Dortmund" },
{ keys:["leverkusen","bayer leverkusen"], name:"Bayer Leverkusen" },
{ keys:["rb leipzig","leipzig"], name:"RB Leipzig" },
{ keys:["eintracht frankfurt","frankfurt"], name:"Eintracht Francoforte" },
{ keys:["stuttgart"], name:"Stoccarda" },
{ keys:["wolfsburg"], name:"Wolfsburg" },
{ keys:["freiburg"], name:"Friburgo" },
{ keys:["mainz"], name:"Mainz" },
{ keys:["hoffenheim"], name:"Hoffenheim" },
{ keys:["werder bremen","werder"], name:"Werder Brema" },
{ keys:["augsburg"], name:"Augsburg" },
{ keys:["union berlin"], name:"Union Berlino" },
{ keys:["borussia monchengladbach","monchengladbach"], name:"Borussia Mönchengladbach" },
{ keys:["bochum"], name:"Bochum" },
{ keys:["heidenheim"], name:"Heidenheim" },
{ keys:["st pauli","st. pauli"], name:"St. Pauli" },
{ keys:["koln","cologne","colonia"], name:"Colonia" },

/* =========================
   LIGUE 1
========================= */

{ keys:["psg","paris saint germain","paris sg"], name:"PSG" },
{ keys:["marseille","olympique marseille"], name:"Marsiglia" },
{ keys:["lyon","olympique lyon"], name:"Lione" },
{ keys:["monaco"], name:"Monaco" },
{ keys:["lille"], name:"Lille" },
{ keys:["lens"], name:"Lens" },
{ keys:["rennes"], name:"Rennes" },
{ keys:["nice"], name:"Nizza" },
{ keys:["brest"], name:"Brest" },
{ keys:["strasbourg"], name:"Strasburgo" },
{ keys:["nantes"], name:"Nantes" },
{ keys:["reims"], name:"Reims" },
{ keys:["toulouse"], name:"Tolosa" },
{ keys:["auxerre"], name:"Auxerre" },
{ keys:["angers"], name:"Angers" },
{ keys:["le havre"], name:"Le Havre" },
{ keys:["metz"], name:"Metz" },
{ keys:["lorient"], name:"Lorient" },

/* =========================
   NAZIONALI
========================= */

{ keys:["italia","italy"], name:"Italia" },
{ keys:["france","francia"], name:"Francia" },
{ keys:["england","inghilterra"], name:"Inghilterra" },
{ keys:["spain","spagna"], name:"Spagna" },
{ keys:["germany","germania"], name:"Germania" },
{ keys:["portugal","portogallo"], name:"Portogallo" },
{ keys:["brazil","brasile"], name:"Brasile" },
{ keys:["argentina"], name:"Argentina" },
{ keys:["netherlands","holland","olanda"], name:"Olanda" },
{ keys:["belgium","belgio"], name:"Belgio" },
{ keys:["croatia","croazia"], name:"Croazia" },
{ keys:["uruguay"], name:"Uruguay" },
{ keys:["mexico","messico"], name:"Messico" },

/* =========================
   EREDIVISIE
========================= */

{ keys:["psv","psv eindhoven"], name:"PSV Eindhoven" },
{ keys:["ajax"], name:"Ajax" },
{ keys:["feyenoord"], name:"Feyenoord" },
{ keys:["az alkmaar","az"], name:"AZ Alkmaar" },
{ keys:["twente","fc twente"], name:"FC Twente" },
{ keys:["utrecht","fc utrecht"], name:"FC Utrecht" },
{ keys:["heerenveen"], name:"Heerenveen" },
{ keys:["groningen"], name:"Groningen" },
{ keys:["go ahead eagles"], name:"Go Ahead Eagles" },
{ keys:["nec nijmegen","nec"], name:"NEC Nijmegen" },
{ keys:["sparta rotterdam"], name:"Sparta Rotterdam" },
{ keys:["heracles"], name:"Heracles Almelo" },
{ keys:["pec zwolle"], name:"PEC Zwolle" },
{ keys:["fortuna sittard"], name:"Fortuna Sittard" },
{ keys:["nac breda"], name:"NAC Breda" },
{ keys:["rkc waalwijk"], name:"RKC Waalwijk" },

/* =========================
   PRIMEIRA LIGA
========================= */

{ keys:["porto","fc porto"], name:"Porto" },
{ keys:["benfica"], name:"Benfica" },
{ keys:["sporting","sporting cp","sporting lisbon"], name:"Sporting CP" },
{ keys:["braga"], name:"Braga" },
{ keys:["vitoria guimaraes","guimaraes"], name:"Vitória Guimarães" },
{ keys:["boavista"], name:"Boavista" },
{ keys:["estoril"], name:"Estoril" },
{ keys:["famalicao"], name:"Famalicão" },
{ keys:["gil vicente"], name:"Gil Vicente" },
{ keys:["rio ave"], name:"Rio Ave" },

/* =========================
   MLS
========================= */

{ keys:["inter miami"], name:"Inter Miami" },
{ keys:["la galaxy"], name:"LA Galaxy" },
{ keys:["los angeles fc","lafc"], name:"Los Angeles FC" },
{ keys:["new york city","nycfc"], name:"New York City FC" },
{ keys:["new york red bulls"], name:"New York Red Bulls" },
{ keys:["atlanta united"], name:"Atlanta United" },
{ keys:["charlotte fc"], name:"Charlotte FC" },
{ keys:["fc cincinnati"], name:"FC Cincinnati" },
{ keys:["columbus crew"], name:"Columbus Crew" },
{ keys:["dc united"], name:"DC United" },
{ keys:["orlando city"], name:"Orlando City" },
{ keys:["philadelphia union"], name:"Philadelphia Union" },
{ keys:["seattle sounders"], name:"Seattle Sounders" },
{ keys:["sporting kansas city"], name:"Sporting Kansas City" },

/* =========================
   BRASILEIRAO
========================= */

{ keys:["flamengo"], name:"Flamengo" },
{ keys:["palmeiras"], name:"Palmeiras" },
{ keys:["corinthians"], name:"Corinthians" },
{ keys:["santos"], name:"Santos" },
{ keys:["sao paulo","são paulo"], name:"São Paulo" },
{ keys:["fluminense"], name:"Fluminense" },
{ keys:["vasco","vasco da gama"], name:"Vasco da Gama" },
{ keys:["botafogo"], name:"Botafogo" },
{ keys:["gremio","grêmio"], name:"Grêmio" },
{ keys:["internacional porto alegre","internacional"], name:"Internacional" },
{ keys:["cruzeiro"], name:"Cruzeiro" },
{ keys:["atletico mineiro","atlético mineiro"], name:"Atlético Mineiro" },

/* =========================
   ARGENTINA
========================= */

{ keys:["boca juniors"], name:"Boca Juniors" },
{ keys:["river plate"], name:"River Plate" },
{ keys:["racing club"], name:"Racing Club" },
{ keys:["independiente"], name:"Independiente" },
{ keys:["san lorenzo"], name:"San Lorenzo" },

/* =========================
   SAUDI PRO LEAGUE
========================= */

{ keys:["al nassr"], name:"Al Nassr" },
{ keys:["al hilal"], name:"Al Hilal" },
{ keys:["al ittihad"], name:"Al Ittihad" },
{ keys:["al ahli"], name:"Al Ahli" },
{ keys:["al shabab"], name:"Al Shabab" },

/* =========================
   NAZIONALI AGGIUNTIVE
========================= */

{ keys:["belgium","belgio"], name:"Belgio" },
{ keys:["netherlands","holland","olanda"], name:"Olanda" },
{ keys:["croatia","croazia"], name:"Croazia" },
{ keys:["morocco","marocco"], name:"Marocco" },
{ keys:["japan","giappone"], name:"Giappone" },
{ keys:["south korea","corea del sud"], name:"Corea del Sud" },
{ keys:["usa","united states"], name:"Stati Uniti" },
{ keys:["mexico","messico"], name:"Messico" },
{ keys:["uruguay"], name:"Uruguay" },
{ keys:["colombia"], name:"Colombia" },
{ keys:["ecuador"], name:"Ecuador" },
{ keys:["chile"], name:"Cile" },
{ keys:["switzerland","svizzera"], name:"Svizzera" },
{ keys:["denmark","danimarca"], name:"Danimarca" },
{ keys:["sweden","svezia"], name:"Svezia" },
{ keys:["norway","norvegia"], name:"Norvegia" },
{ keys:["turkey","turchia"], name:"Turchia" },
{ keys:["poland","polonia"], name:"Polonia" },
{ keys:["austria"], name:"Austria" },
{ keys:["serbia"], name:"Serbia" },
{ keys:["cameroon","camerun"], name:"Camerun" },
{ keys:["nigeria"], name:"Nigeria" },
{ keys:["ghana"], name:"Ghana" },
{ keys:["senegal"], name:"Senegal" },

/* =========================
   TURKISH SUPER LIG
========================= */

{ keys:["galatasaray"], name:"Galatasaray" },
{ keys:["fenerbahce","fenerbahçe"], name:"Fenerbahçe" },
{ keys:["besiktas","beşiktaş"], name:"Beşiktaş" },
{ keys:["trabzonspor"], name:"Trabzonspor" },

/* =========================
   SCOTTISH PREMIERSHIP
========================= */

{ keys:["celtic"], name:"Celtic" },
{ keys:["rangers"], name:"Rangers" },
{ keys:["aberdeen"], name:"Aberdeen" },
{ keys:["hearts"], name:"Heart of Midlothian" },
{ keys:["hibernian","hibs"], name:"Hibernian" },

/* =========================
   BELGIO
========================= */

{ keys:["club brugge","brugge"], name:"Club Brugge" },
{ keys:["anderlecht"], name:"Anderlecht" },
{ keys:["genk"], name:"Genk" },
{ keys:["gent"], name:"Gent" },
{ keys:["royal antwerp","antwerp"], name:"Royal Antwerp" },
{ keys:["standard liege","standard liège"], name:"Standard Liège" },

/* =========================
   SVIZZERA
========================= */

{ keys:["young boys"], name:"Young Boys" },
{ keys:["basel"], name:"Basel" },
{ keys:["zurich","zürich"], name:"Zurigo" },
{ keys:["servette"], name:"Servette" },
{ keys:["lugano"], name:"Lugano" },

/* =========================
   AUSTRIA
========================= */

{ keys:["red bull salzburg","salzburg"], name:"RB Salzburg" },
{ keys:["rapid vienna","rapid wien"], name:"Rapid Vienna" },
{ keys:["austria vienna"], name:"Austria Vienna" },
{ keys:["sturm graz"], name:"Sturm Graz" },
{ keys:["lask"], name:"LASK" },

/* =========================
   CROAZIA
========================= */

{ keys:["dinamo zagreb"], name:"Dinamo Zagabria" },
{ keys:["hajduk split"], name:"Hajduk Split" },
{ keys:["rijeka"], name:"Rijeka" },

/* =========================
   SERBIA
========================= */

{ keys:["red star","crvena zvezda"], name:"Stella Rossa" },
{ keys:["partizan"], name:"Partizan Belgrado" },

/* =========================
   GRECIA
========================= */

{ keys:["olympiacos"], name:"Olympiacos" },
{ keys:["panathinaikos"], name:"Panathinaikos" },
{ keys:["aek athens"], name:"AEK Atene" },
{ keys:["paok"], name:"PAOK" },

/* =========================
   UCRAINA
========================= */

{ keys:["dynamo kyiv","dynamo kiev"], name:"Dynamo Kyiv" },
{ keys:["shakhtar"], name:"Shakhtar Donetsk" },

/* =========================
   REPUBBLICA CECA
========================= */

{ keys:["sparta prague"], name:"Sparta Praga" },
{ keys:["slavia prague"], name:"Slavia Praga" },
{ keys:["viktoria plzen"], name:"Viktoria Plzeň" },

/* =========================
   DANIMARCA
========================= */

{ keys:["copenhagen","fc copenhagen"], name:"FC Copenhagen" },
{ keys:["midtjylland"], name:"Midtjylland" },
{ keys:["brondby","brøndby"], name:"Brøndby" },

/* =========================
   NORVEGIA
========================= */

{ keys:["bodo glimt","bodø glimt"], name:"Bodø/Glimt" },
{ keys:["rosenborg"], name:"Rosenborg" },
{ keys:["molde"], name:"Molde" },

/* =========================
   SVEZIA
========================= */

{ keys:["malmo","malmö"], name:"Malmö FF" },
{ keys:["aik"], name:"AIK" },
{ keys:["hammarby"], name:"Hammarby" },

/* =========================
   GIAPPONE
========================= */

{ keys:["urawa reds"], name:"Urawa Red Diamonds" },
{ keys:["kawasaki frontale"], name:"Kawasaki Frontale" },
{ keys:["yokohama f marinos"], name:"Yokohama F. Marinos" },
{ keys:["vissel kobe"], name:"Vissel Kobe" },

/* =========================
   COREA DEL SUD
========================= */

{ keys:["jeonbuk"], name:"Jeonbuk Hyundai Motors" },
{ keys:["ulsan"], name:"Ulsan HD" },
{ keys:["fc seoul"], name:"FC Seoul" },

/* =========================
   CINA
========================= */

{ keys:["shanghai port"], name:"Shanghai Port" },
{ keys:["shandong taishan"], name:"Shandong Taishan" },
{ keys:["beijing guoan"], name:"Beijing Guoan" },

/* =========================
   PREMIER LEAGUE EXTRA
========================= */

{ keys:["wolves","wolverhampton","wolverhampton wanderers"], name:"Wolverhampton Wanderers" },
{ keys:["west brom","west bromwich","west bromwich albion"], name:"West Bromwich Albion" },
{ keys:["blackburn"], name:"Blackburn Rovers" },
{ keys:["sunderland"], name:"Sunderland" },
{ keys:["middlesbrough"], name:"Middlesbrough" },
{ keys:["stoke","stoke city"], name:"Stoke City" },
{ keys:["watford"], name:"Watford" },
{ keys:["norwich","norwich city"], name:"Norwich City" },
{ keys:["sheffield united"], name:"Sheffield United" },
{ keys:["sheffield wednesday"], name:"Sheffield Wednesday" },
{ keys:["qpr","queens park rangers"], name:"Queens Park Rangers" },
{ keys:["reading"], name:"Reading" },
{ keys:["coventry"], name:"Coventry City" },
{ keys:["hull","hull city"], name:"Hull City" },
{ keys:["portsmouth"], name:"Portsmouth" },
{ keys:["blackpool"], name:"Blackpool" },
{ keys:["preston"], name:"Preston North End" },
{ keys:["millwall"], name:"Millwall" },
{ keys:["luton"], name:"Luton Town" },
{ keys:["oxford united"], name:"Oxford United" },
{ keys:["derby","derby county"], name:"Derby County" },
{ keys:["cardiff"], name:"Cardiff City" },
{ keys:["swansea"], name:"Swansea City" },
{ keys:["plymouth argyle"], name:"Plymouth Argyle" },
{ keys:["bristol city"], name:"Bristol City" },
{ keys:["birmingham"], name:"Birmingham City" },

/* =========================
   LA LIGA EXTRA
========================= */

{ keys:["cadiz","cádiz"], name:"Cadice" },
{ keys:["granada"], name:"Granada" },
{ keys:["elche"], name:"Elche" },
{ keys:["eibar"], name:"Eibar" },
{ keys:["valladolid","real valladolid"], name:"Real Valladolid" },
{ keys:["zaragoza","real zaragoza"], name:"Real Zaragoza" },
{ keys:["deportivo","deportivo la coruna"], name:"Deportivo La Coruña" },
{ keys:["malaga","málaga"], name:"Malaga" },
{ keys:["sporting gijon"], name:"Sporting Gijón" },
{ keys:["oviedo","real oviedo"], name:"Real Oviedo" },

/* =========================
   SERIE A / B EXTRA
========================= */

{ keys:["palermo"], name:"Palermo" },
{ keys:["bari"], name:"Bari" },
{ keys:["sampdoria"], name:"Sampdoria" },
{ keys:["cremonese"], name:"Cremonese" },
{ keys:["catanzaro"], name:"Catanzaro" },
{ keys:["spezia"], name:"Spezia" },
{ keys:["modena"], name:"Modena" },
{ keys:["reggiana"], name:"Reggiana" },
{ keys:["frosinone"], name:"Frosinone" },
{ keys:["salernitana"], name:"Salernitana" },
{ keys:["cesena"], name:"Cesena" },
{ keys:["mantova"], name:"Mantova" },
{ keys:["sudtirol","südtirol"], name:"Sudtirol" },
{ keys:["cosenza"], name:"Cosenza" },
{ keys:["brescia"], name:"Brescia" },
{ keys:["pescara"], name:"Pescara" },
{ keys:["ternana"], name:"Ternana" },
{ keys:["vicenza"], name:"Vicenza" },

/* =========================
   BUNDESLIGA EXTRA
========================= */

{ keys:["hamburg","hamburger sv"], name:"Amburgo" },
{ keys:["schalke","schalke 04"], name:"Schalke 04" },
{ keys:["kaiserslautern"], name:"Kaiserslautern" },
{ keys:["hannover","hannover 96"], name:"Hannover 96" },
{ keys:["nurnberg","nürnberg"], name:"Norimberga" },
{ keys:["darmstadt"], name:"Darmstadt" },
{ keys:["karlsruhe"], name:"Karlsruher SC" },

/* =========================
   LIGUE 1 EXTRA
========================= */

{ keys:["montpellier"], name:"Montpellier" },
{ keys:["saint etienne","st etienne"], name:"Saint-Étienne" },
{ keys:["clermont"], name:"Clermont Foot" },
{ keys:["caen"], name:"Caen" },
{ keys:["sochaux"], name:"Sochaux" },
{ keys:["bordeaux"], name:"Bordeaux" },

/* =========================
   PORTOGALLO EXTRA
========================= */

{ keys:["avista","avista fc"], name:"Aves" },
{ keys:["farense"], name:"Farense" },
{ keys:["casa pia"], name:"Casa Pia" },
{ keys:["moreirense"], name:"Moreirense" },
{ keys:["nacional"], name:"Nacional" },
{ keys:["arouca"], name:"Arouca" },
{ keys:["vizela"], name:"Vizela" },
{ keys:["chaves"], name:"Chaves" },
{ keys:["portimonense"], name:"Portimonense" },

/* =========================
   OLANDA EXTRA
========================= */

{ keys:["almere city"], name:"Almere City" },
{ keys:["excelsior"], name:"Excelsior" },
{ keys:["volendam"], name:"Volendam" },
{ keys:["vitesse"], name:"Vitesse Arnhem" },
{ keys:["willem ii"], name:"Willem II" },
{ keys:["den bosch"], name:"FC Den Bosch" },
{ keys:["de graafschap"], name:"De Graafschap" }

];


const colorsMapping = {
    "black": { m: "Nero", f: "Nera" },
    "white": { m: "Bianco", f: "Bianca" },
    "red": { m: "Rosso", f: "Rossa" },
    "blue": { m: "Blu", f: "Blu" },
    "green": { m: "Verde", f: "Verde" },
    "yellow": { m: "Giallo", f: "Gialla" },
    "purple": { m: "Viola", f: "Viola" },
    "pink": { m: "Rosa", f: "Rosa" },
    "orange": { m: "Arancione", f: "Arancione" },
    "navy": { m: "Blu Navy", f: "Blu Navy" },
    "grey": { m: "Grigio", f: "Grigia" },
    "gray": { m: "Grigio", f: "Grigia" },
    "sky blue": { m: "Azzurro", f: "Azzurra" },
    "gold": { m: "Oro", f: "Oro" },
    "silver": { m: "Argento", f: "Argento" }
};

function extractSquadra(p, squadreEsistenti) {
    const info = estraiEIdentificaSquadra(p, squadreCatalogo);
    return info.squadra;
}

function extractCategoria(p) {
    if (!p) return 'Kit';

    const regole = getRegoleImportazioneJson();

    // 1. Cerca prima un valore di categoria esplicito nel JSON
    const rawVal = (p.categoria || p.category || p.cat || p.type || p.category_name || '').toString().trim();
    if (rawVal) {
        const lowerRaw = rawVal.toLowerCase();

        // Cerca prima corrispondenza esatta
        const matchEsatto = regole.find(r => (r.valore_json || '').toString().trim().toLowerCase() === lowerRaw);
        if (matchEsatto && matchEsatto.categoria) {
            return matchEsatto.categoria;
        }

        // Cerca poi corrispondenza contenuta
        const matchParziale = regole.find(r => {
            const v = (r.valore_json || '').toString().trim().toLowerCase();
            return v && lowerRaw.includes(v);
        });
        if (matchParziale && matchParziale.categoria) {
            return matchParziale.categoria;
        }

        // Se nel JSON c'era un valore di categoria esplicito ma non corrisponde a nessuna regola:
        // Ritorna il valore originale SENZA riassegnarlo automaticamente ad un'altra categoria!
        return rawVal;
    }

    // 2. Se non c'è un campo categoria esplicito nel JSON, cerca nei campi di testo (nome, titolo, alt text, link)
    const nameVal = p.name || p.title || p.nome || p.product_title || '';
    const altVal = p.alt_text || p.image_alt || '';
    const linkVal = p.product_link || '';
    const cleanedLink = linkVal ? decodeURIComponent(linkVal).toLowerCase().replace(/[\/_.-]/g, " ") : "";
    const fields = [nameVal, altVal, linkVal, cleanedLink].filter(Boolean);
    const text = fields.join(' ').toLowerCase();

    // Ordina regole per lunghezza del valore_json decrescente per matchare prima le stringhe più specifiche
    const regoleOrdinate = [...regole].sort((a, b) => (b.valore_json || '').length - (a.valore_json || '').length);
    for (const r of regoleOrdinate) {
        const valRule = (r.valore_json || '').toString().trim().toLowerCase();
        if (valRule && text.includes(valRule)) {
            return r.categoria;
        }
    }

    return 'Kit';
}

function extractTarget(p) {
    if (!p) return 'Adulto';
    const nameVal = p.name || p.title || p.nome || p.product_title || '';
    const altVal = p.alt_text || p.image_alt || '';
    const linkVal = p.product_link || '';
    const cleanedLink = linkVal ? linkVal.replace(/%20/g, ' ').replace(/[\/_.-]/g, ' ') : '';
    const extractedCat = extractCategoria(p);
    
    const fields = [p.target, nameVal, altVal, linkVal, cleanedLink, p.categoria, extractedCat].filter(Boolean);
    const t = fields.join(' ').toLowerCase();
    
    if (t.includes('kids') || t.includes('child') || t.includes('youth') || t.includes('junior') || t.includes('baby') || t.includes('bambino')) {
        return 'Bambino';
    }
    return 'Adulto';
}

function extractStagione(p) {
    if (!p) return '2024/2025';
    const nameVal = p.name || p.title || p.nome || p.product_title || '';
    const altVal = p.alt_text || p.image_alt || '';
    const linkVal = p.product_link || '';
    let decodedLink = '';
    try {
        decodedLink = linkVal ? decodeURIComponent(linkVal) : '';
    } catch(e) {
        decodedLink = linkVal || '';
    }
    
    const fields = [p.stagione, nameVal, altVal, linkVal, decodedLink].filter(Boolean);
    const searchStr = fields.join(' ');
    
    const match1 = searchStr.match(/\b(19\d{2}|20\d{2})[/-](\d{2,4})\b/);
    if (match1) {
        let y1 = match1[1];
        let y2 = match1[2];
        if (y2.length === 2) {
            y2 = y1.substring(0, 2) + y2;
        }
        return `${y1}/${y2}`;
    }
    const match2 = searchStr.match(/\b(\d{2})[/-](\d{2})\b/);
    if (match2) {
        let y1 = parseInt(match2[1]);
        let y2 = parseInt(match2[2]);
        let prefix1 = y1 >= 90 ? "19" : "20";
        let prefix2 = y2 >= 90 ? "19" : "20";
        return `${prefix1}${match2[1]}/${prefix2}${match2[2]}`;
    }
    const match3 = searchStr.match(/\b(19\d{2}|20\d{2})\b/);
    if (match3) {
        const y = parseInt(match3[1]);
        return `${y}/${y + 1}`;
    }
    return '2024/2025';
}

function extractVersione(imageAlt) {
    if (!imageAlt) return 'Home';
    const altLower = imageAlt.toLowerCase();
    let parts = [];
    if (altLower.includes('home') || altLower.includes('casa')) parts.push('Home');
    else if (altLower.includes('away') || altLower.includes('trasferta') || altLower.includes('fuori casa')) parts.push('Away');
    else if (altLower.includes('third') || altLower.includes('terza')) parts.push('Third');
    else if (altLower.includes('fourth') || altLower.includes('quarta')) parts.push('Fourth');
    else if (altLower.includes('special') || altLower.includes('speciale')) parts.push('Special');
    else if (altLower.includes('goalkeeper') || altLower.includes('portiere')) parts.push('Portiere');
    else if (altLower.includes('training') || altLower.includes('allenamento')) parts.push('Training');
    
    if (parts.length === 0) return 'Home';
    return parts.join(' ');
}

function traduciNome(nome) {
    if (!nome) return '';
    let tradotto = nome;
    const words = [
        ["special edition", "Edizione Speciale"],
        ["pre-match", "Pre-partita"],
        ["warm up", "Riscaldamento"],
        ["home", "Casa"],
        ["away", "Trasferta"],
        ["third", "Terza"],
        ["jersey", "Maglia"],
        ["shirt", "Maglia"],
        ["kit", "Completo"],
        ["training", "Allenamento"],
        ["player", "Giocatore (Player)"],
        ["version", "Versione"],
        ["kids", "Bambino"],
        ["youth", "Bambino"],
        ["women", "Donna"],
        ["retro", "Retro"],
        ["goalkeeper", "Portiere"],
        ["tracksuit", "Tuta"],
        ["jacket", "Giacca"],
        ["pants", "Pantaloni"],
        ["shorts", "Pantaloncini"],
        ["socks", "Calzettoni"],
        ["edition", "Edizione"],
        ["black", "Nero"],
        ["white", "Bianco"],
        ["red", "Rosso"],
        ["blue", "Blu"],
        ["green", "Verde"],
        ["yellow", "Giallo"]
    ];
    for (const [en, it] of words) {
        const regex = new RegExp(`\\b${en}\\b`, 'gi');
        tradotto = tradotto.replace(regex, it);
    }
    return tradotto.charAt(0).toUpperCase() + tradotto.slice(1);
}

function extractPrezzoFornitore(p) {
    let pr = p.price !== undefined ? p.price : (p.prezzo_fornitore !== undefined ? p.prezzo_fornitore : (p.prezzoFornitore !== undefined ? p.prezzoFornitore : 0));
    const originalValue = String(pr);
    
    let firstValue = null;
    let secondValue = null;
    let maxSelected = 0;
    
    // Convert to a string if it's an array or object
    let strVal = "";
    if (Array.isArray(pr)) {
        strVal = pr.join(" - ");
    } else if (typeof pr === 'object' && pr !== null) {
        strVal = Object.values(pr).join(" - ");
    } else {
        strVal = String(pr);
    }
    
    // Helper function to extract a clean float from a string part
    function parseSingleValue(s) {
        if (!s) return null;
        let clean = String(s).trim();
        if (clean.includes(',') && !clean.includes('.')) {
            clean = clean.replace(/,/g, '.');
        }
        clean = clean.replace(/[^0-9.]/g, '');
        const parts = clean.split('.');
        if (parts.length > 2) {
            clean = parts[0] + '.' + parts.slice(1).join('');
        }
        const parsed = parseFloat(clean);
        return isNaN(parsed) ? null : parsed;
    }
    
    // Now check if there's a range
    if (strVal.includes('-')) {
        const parts = strVal.split('-');
        firstValue = parseSingleValue(parts[0]);
        if (parts.length > 1) {
            secondValue = parseSingleValue(parts[1]);
        }
    } else {
        firstValue = parseSingleValue(strVal);
    }
    
    // Compute max selected
    const v1 = firstValue !== null ? firstValue : 0;
    const v2 = secondValue !== null ? secondValue : 0;
    maxSelected = Math.max(v1, v2);
    
    const savedValue = maxSelected;
    
    // Print to console exactly as requested
    console.log("=========================================");
    console.log(`price originale: ${originalValue}`);
    console.log("↓");
    console.log(`primo valore trovato: ${firstValue !== null ? firstValue : 'N/A'}`);
    console.log("↓");
    console.log(`secondo valore trovato: ${secondValue !== null ? secondValue : 'N/A'}`);
    console.log("↓");
    console.log(`valore massimo scelto: ${maxSelected}`);
    console.log("↓");
    console.log(`prezzo_fornitore salvato: ${savedValue}`);
    console.log("=========================================");
    
    return savedValue;
}

function getPrezzoVendita(categoria, target) {
    const tgt = target || "Adulto";
    const regole = (window.appSettings && window.appSettings.regolePrezzi) ? window.appSettings.regolePrezzi : null;

    let cat = normalizzaCategoria(categoria);
    let actualTgt = tgt;

    if (regole) {
        const key = `${cat}_${actualTgt}`;
        if (regole[key] !== undefined) {
            return Number(regole[key]);
        }
    }

    // Fallback behavior
    const prezziPredefiniti = (window.appSettings && window.appSettings.prezziPredefiniti) ? window.appSettings.prezziPredefiniti : {
        "Kit": 23.99,
        "Player": 22.99,
        "Fan": 22.99,
        "Kit Allenamento": 25.99,
        "Retro": 23.99,
        "Tuta": 44.99,
        "Kit Bambino": 19.99
    };

    if (actualTgt === "Bambino") {
        return prezziPredefiniti["Kit Bambino"] || 19.99;
    }
    return prezziPredefiniti[cat] || 23.99;
}

function normalizzaUrlImmaginePerDuplicati(p) {
    if (!p) return '';
    let str = '';
    if (typeof p === 'object' && p !== null) {
        str = Array.isArray(p.immagine) ? (p.immagine[0] || '') : (p.immagine || p.image || '');
    } else {
        str = String(p || '');
    }
    return str.split('#')[0].trim().toLowerCase();
}

function checkGiaPresente(p) {
    if (!p) return false;
    const img = normalizzaUrlImmaginePerDuplicati(p);
    if (!img) return false;
    if (cacheDbImages) {
        return cacheDbImages.has(img);
    }
    return prodotti.some(other => normalizzaUrlImmaginePerDuplicati(other) === img);
}

let cacheDbImages = null;
let cacheBatchImages = null;

function invalidateDuplicateCache() {
    cacheDbImages = null;
    cacheBatchImages = null;
}
window.invalidateDuplicateCache = invalidateDuplicateCache;

function rilevaDuplicato(p) {
    if (!p) return null;
    const imgUrl = normalizzaUrlImmaginePerDuplicati(p);
    if (!imgUrl) return null;

    // Lazy initialization of DB cache (based exclusively on Image URL normalized without fragment)
    if (!cacheDbImages) {
        cacheDbImages = new Set();
        prodotti.forEach(other => {
            const otherImg = normalizzaUrlImmaginePerDuplicati(other);
            if (otherImg) {
                cacheDbImages.add(otherImg);
            }
        });
    }

    // Lazy initialization of Batch cache (based exclusively on Image URL normalized without fragment)
    if (!cacheBatchImages) {
        cacheBatchImages = new Map(); // imgUrl -> list of id_anteprima
        const batch = (window.prodottiInAnteprima || prodottiInAnteprima || []);
        batch.forEach(other => {
            const otherImg = normalizzaUrlImmaginePerDuplicati(other);
            if (otherImg) {
                if (!cacheBatchImages.has(otherImg)) {
                    cacheBatchImages.set(otherImg, []);
                }
                cacheBatchImages.get(otherImg).push(other.id_anteprima);
            }
        });
    }

    const duplicatoInDb = cacheDbImages.has(imgUrl);
    const batchImgIds = cacheBatchImages.get(imgUrl) || [];
    const duplicatoInBatch = batchImgIds.some(id => id !== p.id_anteprima);

    if (duplicatoInDb || duplicatoInBatch) {
        return { 
            level: 'duplicato', 
            desc: 'Duplicato Immagine (URL già presente)', 
            location: duplicatoInDb ? 'Database' : 'Anteprima' 
        };
    }

    return null;
}

/* ========================================================
   STRUMENTO PROFESSIONALE: ANALISI DUPLICATI CATALOGO
   ======================================================== */

let reportDuplicatiData = [];
let reportDuplicatiEccezioni = [];
let selectedDuplicatiIds = new Set();
let tabDuplicatiCorrente = 'attivi'; // 'attivi' | 'autorizzati'
let urlDuplicatoDaAutorizzare = null;

async function caricaEccezioniDuplicati() {
    try {
        const res = await fetch('/api/catalog/duplicate-exceptions');
        if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.exceptions)) {
                reportDuplicatiEccezioni = data.exceptions;
            }
        }
    } catch (e) {
        console.warn("⚠️ Errore caricamento eccezioni duplicati da Supabase:", e);
    }
    return reportDuplicatiEccezioni;
}

async function avviaAnalisiDuplicati() {
    const btnScansiona = document.getElementById('btn-scansiona-duplicati');
    if (btnScansiona) btnScansiona.disabled = true;

    const modalLoading = document.getElementById('modal-loading-scansione-duplicati');
    const progressBar = document.getElementById('scan-progress-bar');
    const progressPercent = document.getElementById('scan-progress-percent');

    // Reset steps UI
    for (let i = 1; i <= 4; i++) {
        const stepEl = document.getElementById(`scan-step-${i}`);
        const iconEl = document.getElementById(`scan-step-${i}-icon`);
        if (stepEl) stepEl.className = "flex items-center gap-2 text-slate-400";
        if (iconEl) iconEl.textContent = "⏳";
    }
    if (progressBar) progressBar.style.width = "0%";
    if (progressPercent) progressPercent.textContent = "0%";
    if (modalLoading) modalLoading.classList.remove('hidden');

    const updateStep = (stepNum, percent) => {
        const stepEl = document.getElementById(`scan-step-${stepNum}`);
        const iconEl = document.getElementById(`scan-step-${stepNum}-icon`);
        if (stepEl) stepEl.className = "flex items-center gap-2 text-emerald-600 font-bold";
        if (iconEl) iconEl.textContent = "✓";
        if (progressBar) progressBar.style.width = `${percent}%`;
        if (progressPercent) progressPercent.textContent = `${percent}%`;
    };

    // FASE 1 - SCANSIONE
    try {
        // Step 1: Caricamento prodotti
        await new Promise(r => setTimeout(r, 200));
        if (typeof caricaDati === 'function' && (!prodotti || prodotti.length === 0)) {
            await caricaDati();
        }
        updateStep(1, 25);

        // Step 2: Caricamento eccezioni duplicati autorizzati da Supabase
        await new Promise(r => setTimeout(r, 200));
        await caricaEccezioniDuplicati();
        invalidateDuplicateCache();
        updateStep(2, 55);

        // Map delle eccezioni autorizzate (normalizzate)
        const exceptionSet = new Set(reportDuplicatiEccezioni.map(ex => String(ex.image_url_normalized || '').toLowerCase().trim()));

        // Step 3: Ricerca duplicati
        await new Promise(r => setTimeout(r, 250));
        const groupsMap = new Map(); // cleanUrl -> Product[]
        prodotti.forEach(p => {
            const cleanUrl = normalizzaUrlImmaginePerDuplicati(p);
            if (!cleanUrl) return;
            if (!groupsMap.has(cleanUrl)) {
                groupsMap.set(cleanUrl, []);
            }
            groupsMap.get(cleanUrl).push(p);
        });

        reportDuplicatiData = [];
        groupsMap.forEach((prods, cleanUrl) => {
            // Se prods >= 2 e NON è presente tra le eccezioni autorizzate su Supabase, segnala come duplicato attivo
            if (prods.length >= 2 && !exceptionSet.has(cleanUrl)) {
                reportDuplicatiData.push({
                    cleanUrl: cleanUrl,
                    products: prods
                });
            }
        });
        updateStep(3, 85);

        // Step 4: Generazione report
        await new Promise(r => setTimeout(r, 200));
        updateStep(4, 100);

        await new Promise(r => setTimeout(r, 300));
    } catch (err) {
        console.error("Errore durante la scansione duplicati:", err);
    } finally {
        if (modalLoading) modalLoading.classList.add('hidden');
        if (btnScansiona) btnScansiona.disabled = false;
    }

    // FASE 2 - APERTURA MODALE REPORT
    selectedDuplicatiIds.clear();
    const modalReport = document.getElementById('modal-analisi-duplicati-report');
    if (modalReport) modalReport.classList.remove('hidden');
    renderReportDuplicati();
}

function setTabDuplicati(tab) {
    tabDuplicatiCorrente = tab;

    const btnAttivi = document.getElementById('tab-duplicati-attivi');
    const btnAutorizzati = document.getElementById('tab-duplicati-autorizzati');

    if (btnAttivi) {
        btnAttivi.className = tab === 'attivi'
            ? "px-4 py-2 text-xs font-bold rounded-t-xl bg-white border-t border-x border-slate-200 text-slate-900 shadow-sm flex items-center gap-1.5 transition-all"
            : "px-4 py-2 text-xs font-bold rounded-t-xl bg-slate-100 border-t border-x border-transparent text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition-all";
    }
    if (btnAutorizzati) {
        btnAutorizzati.className = tab === 'autorizzati'
            ? "px-4 py-2 text-xs font-bold rounded-t-xl bg-white border-t border-x border-slate-200 text-slate-900 shadow-sm flex items-center gap-1.5 transition-all"
            : "px-4 py-2 text-xs font-bold rounded-t-xl bg-slate-100 border-t border-x border-transparent text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition-all";
    }

    renderReportDuplicati();
}

function renderReportDuplicati() {
    const totAnalizzati = (prodotti || []).length;
    const totGruppi = reportDuplicatiData.length;
    const totDuplicati = reportDuplicatiData.reduce((acc, g) => acc + g.products.length, 0);
    const totAutorizzati = reportDuplicatiEccezioni.length;

    const elAnalizzati = document.getElementById('stat-duplicati-totali-analizzati');
    const elTrovati = document.getElementById('stat-duplicati-totali-trovati');
    const elGruppi = document.getElementById('stat-duplicati-gruppi-totali');
    const elAutorizzati = document.getElementById('stat-duplicati-autorizzati');
    const elTabAttiviCount = document.getElementById('count-tab-duplicati-attivi');
    const elTabAutorizzatiCount = document.getElementById('count-tab-duplicati-autorizzati');

    if (elAnalizzati) elAnalizzati.textContent = totAnalizzati;
    if (elTrovati) elTrovati.textContent = totDuplicati;
    if (elGruppi) elGruppi.textContent = totGruppi;
    if (elAutorizzati) elAutorizzati.textContent = totAutorizzati;
    if (elTabAttiviCount) elTabAttiviCount.textContent = totGruppi;
    if (elTabAutorizzatiCount) elTabAutorizzatiCount.textContent = totAutorizzati;

    const container = document.getElementById('duplicati-gruppi-container');
    if (!container) return;

    // Salva la posizione dello scroll prima di aggiornare il DOM
    const savedScrollTop = container.scrollTop;

    // --- TAB 1: DUPLICATI ATTIVI DA CORREGGERE ---
    if (tabDuplicatiCorrente === 'attivi') {
        if (reportDuplicatiData.length === 0) {
            container.innerHTML = `
                <div class="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-4 my-8 shadow-sm">
                    <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-3xl mx-auto font-black">🎉</div>
                    <h4 class="text-lg font-black text-slate-900">Nessun duplicato attivo trovato!</h4>
                    <p class="text-xs text-slate-500 max-w-md mx-auto">Tutti i prodotti analizzati hanno URL univoci o appartengono alla lista dei duplicati autorizzati.</p>
                </div>
            `;
            aggiornaActionBarDuplicati();
            return;
        }

        let html = '';
        reportDuplicatiData.forEach((group, gIdx) => {
            const isAllGroupSelected = group.products.length > 0 && group.products.every(p => selectedDuplicatiIds.has(String(p.id)));

            html += `
            <div class="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
                <!-- Header Gruppo -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div class="flex items-center gap-3">
                        <span class="px-3 py-1 bg-red-100 text-red-700 font-black text-xs rounded-xl flex items-center gap-1.5 shrink-0">
                            <span>🔴</span> DUPLICATO #${gIdx + 1}
                        </span>
                        <div class="text-xs truncate max-w-xl">
                            <span class="text-slate-400 font-semibold">URL Immagine:</span>
                            <span class="font-mono text-slate-800 font-bold ml-1 break-all">${escapeHtml(group.cleanUrl)}</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 self-end sm:self-auto flex-wrap sm:flex-nowrap">
                        <span class="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 font-bold text-xs rounded-xl">
                            ${group.products.length} prodotti trovati
                        </span>
                        <button type="button" onclick="richiediAutorizzazioneDuplicato('${escapeHtml(group.cleanUrl)}')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-1.5 shrink-0">
                            <span>✓</span> Autorizza duplicato
                        </button>
                        <label class="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer hover:text-slate-900 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
                            <input type="checkbox" onchange="toggleSelectGruppoDuplicato(${gIdx}, this.checked)" ${isAllGroupSelected ? 'checked' : ''} class="w-4 h-4 rounded text-brand-gold focus:ring-brand-gold">
                            <span>Seleziona Gruppo</span>
                        </label>
                    </div>
                </div>

                <!-- Grid Card Prodotti -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            `;

            group.products.forEach(p => {
                const pId = String(p.id);
                const isSelected = selectedDuplicatiIds.has(pId);
                const rawImg = Array.isArray(p.immagine) ? p.immagine[0] : (p.immagine || p.image || '');
                const imgSrc = rawImg || 'https://via.placeholder.com/150?text=No+Image';

                html += `
                    <div class="border ${isSelected ? 'border-red-500 bg-red-50/30 shadow-md' : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'} rounded-2xl p-3.5 flex flex-col justify-between space-y-3 transition-all relative">
                        <div class="flex items-start gap-3">
                            <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(p.nome || 'Prodotto')}" class="w-16 h-16 object-cover rounded-xl border border-slate-200 bg-white shrink-0">
                            <div class="min-w-0 flex-1 space-y-0.5">
                                <h5 class="text-xs font-black text-slate-900 truncate" title="${escapeHtml(p.nome || '')}">
                                    ${escapeHtml(p.nome || p.title || 'Senza Nome')}
                                </h5>
                                <div class="text-[11px] text-slate-500 space-y-0.5">
                                    <div><strong class="text-slate-700">Squadra:</strong> ${escapeHtml(p.squadra || '-')}</div>
                                    <div><strong class="text-slate-700">Categoria:</strong> ${escapeHtml(p.categoria || '-')}</div>
                                    <div><strong class="text-slate-700">Stagione:</strong> ${escapeHtml(p.stagione || '-')}</div>
                                    <div class="font-mono text-[10px] text-slate-400">ID: ${escapeHtml(pId)}</div>
                                </div>
                            </div>
                        </div>

                        <div class="flex items-center justify-between pt-2 border-t border-slate-200/60">
                            <button type="button" onclick="apriProdottoDaDuplicati('${pId}')" class="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-[11px] rounded-lg transition-colors flex items-center gap-1">
                                <span>👁️</span> Apri
                            </button>

                            <label class="flex items-center gap-2 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-slate-200 hover:border-slate-300">
                                <input type="checkbox" onchange="toggleSelectProdottoDuplicato('${pId}')" ${isSelected ? 'checked' : ''} class="w-4 h-4 rounded text-red-600 focus:ring-red-500">
                                <span class="text-xs font-bold text-slate-700">Seleziona</span>
                            </label>
                        </div>
                    </div>
                `;
            });

            html += `
                </div>
            </div>
            `;
        });

        container.innerHTML = html;
        container.scrollTop = savedScrollTop;
        aggiornaActionBarDuplicati();
        return;
    }

    // --- TAB 2: DUPLICATI AUTORIZZATI ---
    if (tabDuplicatiCorrente === 'autorizzati') {
        const actionBar = document.getElementById('duplicati-action-bar');
        if (actionBar) actionBar.classList.add('hidden');

        if (reportDuplicatiEccezioni.length === 0) {
            container.innerHTML = `
                <div class="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-4 my-8 shadow-sm">
                    <div class="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center text-3xl mx-auto font-black">🛡️</div>
                    <h4 class="text-lg font-black text-slate-900">Nessun duplicato autorizzato</h4>
                    <p class="text-xs text-slate-500 max-w-md mx-auto">Non hai ancora autorizzato nessun duplicato di immagine intenzionale. Quando ne autorizzi uno, verrà mostrato qui.</p>
                </div>
            `;
            return;
        }

        let html = '';
        reportDuplicatiEccezioni.forEach((ex, eIdx) => {
            const normUrl = ex.image_url_normalized || '';
            const matchingProds = (prodotti || []).filter(p => normalizzaUrlImmaginePerDuplicati(p) === normUrl);
            const dateStr = ex.created_at ? new Date(ex.created_at).toLocaleDateString('it-IT') : 'Recentemente';

            html += `
            <div class="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
                <!-- Header Eccezione -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div class="flex items-center gap-3 min-w-0">
                        <span class="px-3 py-1 bg-emerald-100 text-emerald-800 font-black text-xs rounded-xl flex items-center gap-1.5 shrink-0">
                            <span>✅</span> AUTORIZZATO #${eIdx + 1}
                        </span>
                        <div class="text-xs truncate max-w-xl">
                            <span class="text-slate-400 font-semibold">URL Immagine:</span>
                            <span class="font-mono text-slate-800 font-bold ml-1 break-all">${escapeHtml(normUrl)}</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-3 self-end sm:self-auto shrink-0">
                        <span class="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-xs rounded-xl">
                            ${matchingProds.length} prodotti
                        </span>
                        <span class="text-xs text-slate-500 font-medium">
                            Autorizzato il ${escapeHtml(dateStr)}
                        </span>
                        <button type="button" onclick="revocaAutorizzazioneDuplicato('${escapeHtml(normUrl)}', '${ex.id}')" class="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs rounded-xl transition-all flex items-center gap-1">
                            <span>✕</span> Revoca autorizzazione
                        </button>
                    </div>
                </div>

                <!-- Prodotti collegati a questo duplicato autorizzato -->
                ${matchingProds.length > 0 ? `
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    ${matchingProds.map(p => {
                        const rawImg = Array.isArray(p.immagine) ? p.immagine[0] : (p.immagine || p.image || '');
                        const imgSrc = rawImg || 'https://via.placeholder.com/150?text=No+Image';
                        return `
                        <div class="border border-slate-200 bg-slate-50/50 rounded-2xl p-3.5 flex items-start gap-3">
                            <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(p.nome || '')}" class="w-14 h-14 object-cover rounded-xl border border-slate-200 bg-white shrink-0">
                            <div class="min-w-0 flex-1 space-y-0.5">
                                <h5 class="text-xs font-black text-slate-900 truncate" title="${escapeHtml(p.nome || '')}">
                                    ${escapeHtml(p.nome || p.title || 'Senza Nome')}
                                </h5>
                                <div class="text-[11px] text-slate-500">
                                    <div><strong>Squadra:</strong> ${escapeHtml(p.squadra || '-')}</div>
                                    <div><strong>Categoria:</strong> ${escapeHtml(p.categoria || '-')}</div>
                                    <div class="font-mono text-[10px] text-slate-400">ID: ${escapeHtml(String(p.id))}</div>
                                </div>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
                ` : '<div class="text-xs text-slate-400 italic">Nessun prodotto attualmente collegato a questo URL immagine nel catalogo caricato.</div>'}
            </div>
            `;
        });

        container.innerHTML = html;
        container.scrollTop = savedScrollTop;
    }
}

function richiediAutorizzazioneDuplicato(cleanUrl) {
    urlDuplicatoDaAutorizzare = cleanUrl;
    const previewEl = document.getElementById('preview-url-autorizza-duplicato');
    if (previewEl) {
        previewEl.textContent = cleanUrl;
    }
    const modal = document.getElementById('modal-conferma-autorizza-duplicato');
    if (modal) modal.classList.remove('hidden');
}

function chiudiConfermaAutorizzaDuplicato() {
    urlDuplicatoDaAutorizzare = null;
    const modal = document.getElementById('modal-conferma-autorizza-duplicato');
    if (modal) modal.classList.add('hidden');
}

async function confermaAutorizzaDuplicato() {
    if (!urlDuplicatoDaAutorizzare) return;
    const targetUrl = urlDuplicatoDaAutorizzare;
    chiudiConfermaAutorizzaDuplicato();

    try {
        const res = await fetch('/api/catalog/duplicate-exceptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_url_normalized: targetUrl })
        });
        const data = await res.json();
        if (data.success) {
            if (typeof mostraNotifica === 'function') {
                mostraNotifica('✓ Duplicato autorizzato con successo', 'success');
            } else if (typeof showToast === 'function') {
                showToast('✓ Duplicato autorizzato con successo', 'success');
            }

            // Rimuovi subito dal gruppo attivi
            reportDuplicatiData = reportDuplicatiData.filter(g => g.cleanUrl !== targetUrl);

            // Aggiungi alla lista delle eccezioni
            const newEx = data.exception || {
                id: Date.now(),
                image_url_normalized: targetUrl,
                created_at: new Date().toISOString()
            };
            reportDuplicatiEccezioni = reportDuplicatiEccezioni.filter(e => e.image_url_normalized !== targetUrl);
            reportDuplicatiEccezioni.unshift(newEx);

            // Aggiorna interfaccia immediatamente senza scansione
            renderReportDuplicati();
        } else {
            alert('Errore durante l\'autorizzazione del duplicato: ' + (data.error || 'Errore sconosciuto'));
        }
    } catch (err) {
        console.error('Errore autorizzazione duplicato:', err);
        alert('Si è verificato un errore durante il salvataggio dell\'autorizzazione su Supabase.');
    }
}

async function revocaAutorizzazioneDuplicato(cleanUrl, id) {
    if (!confirm(`Sei sicuro di voler revocare l'autorizzazione per questo duplicato?\n\nURL: ${cleanUrl}\n\nAlla prossima scansione il duplicato tornerà ad essere rilevato.`)) {
        return;
    }

    try {
        const identifier = id || encodeURIComponent(cleanUrl);
        const res = await fetch(`/api/catalog/duplicate-exceptions/${identifier}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        if (data.success) {
            if (typeof mostraNotifica === 'function') {
                mostraNotifica('Autorizzazione revocata con successo', 'info');
            } else if (typeof showToast === 'function') {
                showToast('Autorizzazione revocata con successo', 'info');
            }

            // Rimuovi dalle eccezioni
            reportDuplicatiEccezioni = reportDuplicatiEccezioni.filter(e => e.image_url_normalized !== cleanUrl && String(e.id) !== String(id));

            // Riavvia scansione per ri-rilevare il duplicato tra gli attivi
            await avviaAnalisiDuplicati();
        } else {
            alert('Errore durante la revoca dell\'autorizzazione: ' + (data.error || 'Errore sconosciuto'));
        }
    } catch (err) {
        console.error('Errore revoca autorizzazione:', err);
        alert('Si è verificato un errore durante la revoca dell\'autorizzazione da Supabase.');
    }
}

function apriProdottoDaDuplicati(productId) {
    if (typeof preparaModificaProdotto === 'function') {
        preparaModificaProdotto(productId);
    }
}

function sincronizzaReportDuplicati() {
    const modalReport = document.getElementById('modal-analisi-duplicati-report');
    if (!modalReport || modalReport.classList.contains('hidden')) {
        return; // La modale duplicati non è aperta
    }

    // Invalida cache per ricalcolare immagini normalizzate
    invalidateDuplicateCache();

    // Aggiorna ciascun gruppo di duplicati con i dati correnti di `prodotti`
    reportDuplicatiData = reportDuplicatiData.map(group => {
        const updatedProducts = group.products
            .map(p => (prodotti || []).find(latest => String(latest.id) === String(p.id)))
            .filter(Boolean) // rimuove eventuali eliminati
            .filter(p => normalizzaUrlImmaginePerDuplicati(p) === group.cleanUrl); // rimuove se l'immagine non coincide più con l'URL del gruppo

        return {
            cleanUrl: group.cleanUrl,
            products: updatedProducts
        };
    }).filter(group => group.products.length >= 2); // rimuove gruppi con meno di 2 prodotti

    // Rimuovi dalla selezione gli ID che non esistono più nei report
    const validIds = new Set();
    reportDuplicatiData.forEach(g => {
        g.products.forEach(p => validIds.add(String(p.id)));
    });
    selectedDuplicatiIds = new Set([...selectedDuplicatiIds].filter(id => validIds.has(id)));

    // Rirenderizza la modale duplicati mantenendo scroll e selezioni
    renderReportDuplicati();
}

function toggleSelectProdottoDuplicato(productId) {
    if (selectedDuplicatiIds.has(productId)) {
        selectedDuplicatiIds.delete(productId);
    } else {
        selectedDuplicatiIds.add(productId);
    }
    aggiornaActionBarDuplicati();
    renderReportDuplicati();
}

function toggleSelectGruppoDuplicato(gIdx, isChecked) {
    const group = reportDuplicatiData[gIdx];
    if (!group) return;
    group.products.forEach(p => {
        const id = String(p.id);
        if (isChecked) {
            selectedDuplicatiIds.add(id);
        } else {
            selectedDuplicatiIds.delete(id);
        }
    });
    aggiornaActionBarDuplicati();
    renderReportDuplicati();
}

function aggiornaActionBarDuplicati() {
    const count = selectedDuplicatiIds.size;
    const actionBar = document.getElementById('duplicati-action-bar');
    const countLabel = document.getElementById('duplicati-selected-count-label');

    if (actionBar && countLabel) {
        if (count > 0) {
            countLabel.textContent = `${count} prodotti selezionati`;
            actionBar.classList.remove('hidden');
        } else {
            actionBar.classList.add('hidden');
        }
    }
}

function richiediConfermaEliminazioneDuplicati() {
    if (selectedDuplicatiIds.size === 0) return;
    const countEl = document.getElementById('count-elimina-duplicati');
    if (countEl) countEl.textContent = selectedDuplicatiIds.size;
    const modal = document.getElementById('modal-conferma-eliminazione-duplicati');
    if (modal) modal.classList.remove('hidden');
}

function chiudiConfermaEliminazioneDuplicati() {
    const modal = document.getElementById('modal-conferma-eliminazione-duplicati');
    if (modal) modal.classList.add('hidden');
}

function chiudiModalReportDuplicati() {
    const modal = document.getElementById('modal-analisi-duplicati-report');
    if (modal) modal.classList.add('hidden');
}

async function confermaEliminaDuplicatiSelezionati() {
    const btn = document.getElementById('btn-conferma-delete-duplicati');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = "⌛ Eliminazione...";
    }

    const idsToDelete = Array.from(selectedDuplicatiIds);
    let deletedCount = 0;

    for (const id of idsToDelete) {
        try {
            const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
            if (res.ok) {
                deletedCount++;
            }
        } catch (e) {
            console.error("Errore durante l'eliminazione del prodotto ID " + id, e);
        }
    }

    // 1. Rimuovi dallo stato globale prodotti
    prodotti = prodotti.filter(p => !idsToDelete.includes(String(p.id)));

    // 2. Invalida cache e sincronizza
    invalidateDuplicateCache();

    // 3. Rimuovi i prodotti eliminati dai gruppi in memoria
    reportDuplicatiData = reportDuplicatiData.map(group => {
        return {
            cleanUrl: group.cleanUrl,
            products: group.products.filter(p => !idsToDelete.includes(String(p.id)))
        };
    }).filter(group => group.products.length >= 2); // Rimuovi automaticamente i gruppi che hanno solo 1 o 0 prodotti rimasti!

    // 4. Pulisci selezione
    selectedDuplicatiIds.clear();

    // 5. Chiudi modale di conferma e ripristina bottone
    chiudiConfermaEliminazioneDuplicati();
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = "Elimina definitivamente";
    }

    // 6. Aggiorna interfaccia e report in tempo reale
    aggiornaActionBarDuplicati();
    renderReportDuplicati();

    if (typeof renderProdottiTabella === 'function') {
        renderProdottiTabella();
    } else if (typeof renderProdotti === 'function') {
        renderProdotti();
    }

    if (typeof showToast === 'function') {
        showToast(`✅ ${deletedCount} prodotti eliminati definitivamente con successo!`, "success");
    }
}

function esportaReportDuplicatiCSV() {
    if (!reportDuplicatiData || reportDuplicatiData.length === 0) {
        if (typeof showToast === 'function') {
            showToast("Nessun duplicato da esportare", "warning");
        }
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "ID,Nome,Squadra,Categoria,Stagione,URL immagine,Product Link,Numero duplicati\n";

    reportDuplicatiData.forEach(group => {
        group.products.forEach(p => {
            const pId = String(p.id || '');
            const pNome = `"${(p.nome || p.title || '').replace(/"/g, '""')}"`;
            const pSquadra = `"${(p.squadra || '').replace(/"/g, '""')}"`;
            const pCategoria = `"${(p.categoria || '').replace(/"/g, '""')}"`;
            const pStagione = `"${(p.stagione || '').replace(/"/g, '""')}"`;
            const pImg = `"${(group.cleanUrl || '').replace(/"/g, '""')}"`;
            const pLink = `"${window.location.origin}/prodotto.html?id=${pId}"`;
            const pNumDuplicati = group.products.length;

            csvContent += `${pId},${pNome},${pSquadra},${pCategoria},${pStagione},${pImg},${pLink},${pNumDuplicati}\n`;
        });
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `report_duplicati_catalogo_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (typeof showToast === 'function') {
        showToast("📊 Report CSV esportato con successo!", "success");
    }
}

// Exposure
window.avviaAnalisiDuplicati = avviaAnalisiDuplicati;
window.renderReportDuplicati = renderReportDuplicati;
window.apriProdottoDaDuplicati = apriProdottoDaDuplicati;
window.toggleSelectProdottoDuplicato = toggleSelectProdottoDuplicato;
window.toggleSelectGruppoDuplicato = toggleSelectGruppoDuplicato;
window.aggiornaActionBarDuplicati = aggiornaActionBarDuplicati;
window.richiediConfermaEliminazioneDuplicati = richiediConfermaEliminazioneDuplicati;
window.chiudiConfermaEliminazioneDuplicati = chiudiConfermaEliminazioneDuplicati;
window.confermaEliminaDuplicatiSelezionati = confermaEliminaDuplicatiSelezionati;
window.sincronizzaReportDuplicati = sincronizzaReportDuplicati;
window.chiudiModalReportDuplicati = chiudiModalReportDuplicati;
window.esportaReportDuplicatiCSV = esportaReportDuplicatiCSV;
window.setTabDuplicati = setTabDuplicati;
window.caricaEccezioniDuplicati = caricaEccezioniDuplicati;
window.richiediAutorizzazioneDuplicato = richiediAutorizzazioneDuplicato;
window.chiudiConfermaAutorizzaDuplicato = chiudiConfermaAutorizzaDuplicato;
window.confermaAutorizzaDuplicato = confermaAutorizzaDuplicato;
window.revocaAutorizzazioneDuplicato = revocaAutorizzazioneDuplicato;

function openImportPreviewModal() {
    aggiornaStatoFiltroVisivo();
    const modal = document.getElementById('import-preview-modal');
    const container = document.getElementById('import-modal-container');
    if (modal && container) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            container.classList.remove('scale-95', 'opacity-0');
            container.classList.add('scale-100', 'opacity-100');
        }, 10);
    }
}

function closeImportPreviewModal() {
    const modal = document.getElementById('import-preview-modal');
    const container = document.getElementById('import-modal-container');
    if (modal && container) {
        container.classList.remove('scale-100', 'opacity-100');
        container.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    }
}

function openImportResultsModal() {
    const modal = document.getElementById('import-results-modal');
    const container = document.getElementById('results-modal-container');
    if (modal && container) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            container.classList.remove('scale-95', 'opacity-0');
            container.classList.add('scale-100', 'opacity-100');
        }, 10);
    }
}

function closeImportResultsModal() {
    const modal = document.getElementById('import-results-modal');
    const container = document.getElementById('results-modal-container');
    if (modal && container) {
        container.classList.remove('scale-100', 'opacity-100');
        container.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
            window.location.reload();
        }, 300);
    }
}


function validaProdotto(p) {
    const errori = [];
    if (!p.nome_finale || p.nome_finale.trim() === '') {
        errori.push("Nome prodotto mancante");
    }
    if (!p.squadra || p.squadra.trim() === '' || p.squadra === 'Sconosciuta' || p.squadra === 'SQUADRA NON RICONOSCIUTA') {
        errori.push("Squadra non riconosciuta nel database");
    }
    const catsPrezzi = getListaCategorieRegolePrezzi();
    const rulesImport = typeof getRegoleImportazioneJson === 'function' ? getRegoleImportazioneJson() : [];
    const catsRules = rulesImport.map(r => r.categoria).filter(Boolean);
    const categorieValide = Array.from(new Set([...catsPrezzi, ...catsRules]));

    if (!p.categoria || p.categoria.trim() === '') {
        errori.push("Categoria mancante");
    } else if (categorieValide.length > 0 && !categorieValide.some(c => c.toLowerCase() === p.categoria.trim().toLowerCase())) {
        errori.push(`Categoria non valida o non supportata: '${p.categoria}'`);
    }
    
    const campionatiValidi = [
        'Premier League', 'Serie A', 'La Liga', 'Bundesliga', 'Ligue 1', 'Champions League',
        'USA MLS', 'Saudi League', 'Altri Club', 'Europa', 'Sud America', 'Nord America',
        'Asia', 'Oceania', 'Africa', 'Eastern Conference', 'Western Conference', 'Liga Mx',
        'Brasileiro Serie A', 'Japan Series', 'Nazionali', 'Mondiali', 'NBA'
    ];
    if (!p.campionato || p.campionato.trim() === '' || p.campionato === 'SQUADRA NON RICONOSCIUTA') {
        errori.push("Campionato non riconosciuto");
    } else {
        const foundCamp = campionatiValidi.some(l => l.toLowerCase() === p.campionato.trim().toLowerCase());
        if (!foundCamp) {
            errori.push("Campionato non supportato");
        }
    }

    if (p.prezzo === undefined || p.prezzo === null || isNaN(p.prezzo) || p.prezzo <= 0) {
        errori.push("Prezzo vendita non valido");
    }
    if (!p.stagione || p.stagione.trim() === '') {
        errori.push("Stagione mancante");
    } else {
        const regex = /^\d{2,4}\/\d{2,4}$/;
        if (!regex.test(p.stagione.trim())) {
            errori.push("Stagione formato non valido (es. 2024/25)");
        }
    }
    if (!p.immagine || p.immagine.trim() === '') {
        errori.push("Immagine mancante");
    }
    
    return errori;
}

function findProdIndex(id_anteprima) {
    return prodottiInAnteprima.findIndex(p => p.id_anteprima === id_anteprima);
}

/**
 * Aggiorna lo stato visivo (classi CSS) dei pulsanti di filtro dell'anteprima importazione JSON.
 * Mantiene sempre attivo UN SOLO filtro alla volta, rimuovendo lo stato "active" dagli altri.
 */
function aggiornaStatoFiltroVisivo() {
    const currentFilter = filtroAnteprima || 'all';

    // 1. Aggiorna per ID specifico (es. btn-filter-all, btn-filter-duplicates, tab-preview-*)
    const tabs = ['all', 'valid', 'errors', 'verify', 'duplicates'];
    tabs.forEach(t => {
        const btn = document.getElementById(`btn-filter-${t}`) || document.getElementById(`tab-preview-${t}`);
        if (btn) {
            if (t === currentFilter) {
                btn.className = "px-4 py-2 text-xs font-bold rounded-xl bg-slate-950 text-white shadow-sm transition-all";
            } else {
                btn.className = "px-4 py-2 text-xs font-bold rounded-xl text-slate-600 hover:text-slate-900 transition-all";
            }
        }
    });

    // 2. Meccanismo dinamico per qualsiasi filtro/pulsante presente o futuro con onclick setFiltroAnteprima
    const allFilterButtons = document.querySelectorAll('[onclick*="setFiltroAnteprima"]');
    allFilterButtons.forEach(btn => {
        const onclickAttr = btn.getAttribute('onclick') || '';
        const match = onclickAttr.match(/setFiltroAnteprima\(['"]([^'"]+)['"]\)/);
        if (match && match[1]) {
            const filterVal = match[1];
            if (filterVal === currentFilter) {
                btn.className = "px-4 py-2 text-xs font-bold rounded-xl bg-slate-950 text-white shadow-sm transition-all";
            } else {
                btn.className = "px-4 py-2 text-xs font-bold rounded-xl text-slate-600 hover:text-slate-900 transition-all";
            }
        }
    });
}

/**
 * Gestisce il cambio di tab filtro nella revisione
 */
function setFiltroAnteprima(filtro) {
    filtroAnteprima = filtro;
    importCurrentPage = 1;
    
    aggiornaStatoFiltroVisivo();
    renderAnteprimaTabella();
}

/**
 * Aggiorna la ricerca testuale nell'anteprima
 */
let debounceTimerAnteprima = null;
function aggiornaRicercaAnteprima(query) {
    if (debounceTimerAnteprima) {
        clearTimeout(debounceTimerAnteprima);
    }
    debounceTimerAnteprima = setTimeout(() => {
        ricercaAnteprima = query.toLowerCase().trim();
        importCurrentPage = 1;
        renderAnteprimaTabella();
    }, 250); // Debounce of 250 ms
}

function toggleSelezionaProdotto(id_anteprima, isChecked) {
    if (isChecked) {
        selezionatiInAnteprima.add(id_anteprima);
    } else {
        selezionatiInAnteprima.delete(id_anteprima);
    }
    aggiornaConteggiAnteprima();
}

function toggleSelectAllImport(isChecked) {
    // Ottiene solo i prodotti visibili attualmente nel filtro e ricerca
    let prodottiVisualizzati = ottieniProdottiFiltratiVisibili();
    
    prodottiVisualizzati.forEach(p => {
        if (isChecked) {
            selezionatiInAnteprima.add(p.id_anteprima);
        } else {
            selezionatiInAnteprima.delete(p.id_anteprima);
        }
    });
    
    // Aggiorna lo stato delle checkbox nel DOM senza rigenerare l'HTML della tabella completa
    const tbody = document.getElementById('import-preview-tbody');
    if (tbody) {
        const checkboxes = tbody.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = isChecked;
        });
    }
    
    aggiornaConteggiAnteprima();
}

function eliminaProdottoAnteprima(id_anteprima) {
    prodottiInAnteprima = prodottiInAnteprima.filter(p => p.id_anteprima !== id_anteprima);
    selezionatiInAnteprima.delete(id_anteprima);
    invalidateDuplicateCache();
    renderAnteprimaTabella();
    showToast("Prodotto escluso dall'importazione", "success");
}

function eliminaSelezionatiAnteprima() {
    if (selezionatiInAnteprima.size === 0) return;
    const deletedCount = selezionatiInAnteprima.size;
    prodottiInAnteprima = prodottiInAnteprima.filter(p => !selezionatiInAnteprima.has(p.id_anteprima));
    selezionatiInAnteprima.clear();
    invalidateDuplicateCache();
    renderAnteprimaTabella();
    showToast(`${deletedCount} prodotti esclusi con successo`, "success");
}

/**
 * Restituisce i prodotti in anteprima filtrati per tab e ricerca attiva
 */
function ottieniProdottiFiltratiVisibili() {
    let prodottiVisualizzati = prodottiInAnteprima;
    
    // 1. Applica filtro di ricerca testuale
    if (ricercaAnteprima) {
        prodottiVisualizzati = prodottiVisualizzati.filter(p => {
            if (p._matchText === undefined) {
                p._matchText = [
                    p.squadra, p.nome_finale, p.campionato, p.categoria, p.stagione, p.legacy_id, p.id
                ].filter(Boolean).join(' ').toLowerCase();
            }
            return p._matchText.includes(ricercaAnteprima);
        });
    }

    // 2. Applica tab attiva
    if (filtroAnteprima === 'valid') {
        prodottiVisualizzati = prodottiVisualizzati.filter(p => {
            if (p._errors === undefined) p._errors = validaProdotto(p);
            return p._errors.length === 0;
        });
    } else if (filtroAnteprima === 'errors') {
        prodottiVisualizzati = prodottiVisualizzati.filter(p => {
            if (p._errors === undefined) p._errors = validaProdotto(p);
            return p._errors.length > 0;
        });
    } else if (filtroAnteprima === 'verify') {
        const squadreEsistentiSet = new Set(squadreCatalogo.map(t => (t.name || "").toLowerCase()).filter(Boolean));
        prodottiVisualizzati = prodottiVisualizzati.filter(p => {
            if (p._errors === undefined) p._errors = validaProdotto(p);
            if (p._dup === undefined) p._dup = rilevaDuplicato(p);
            const dup = p._dup;
            const checkDuplicate = dup !== null;
            const hasError = p._errors.length > 0;
            const isAutogen = p.id_autogenerato;
            
            const teamLower = (p.squadra || "").toLowerCase();
            const isNewTeam = teamLower && teamLower !== 'sconosciuta' && !squadreEsistentiSet.has(teamLower);

            return !hasError && (checkDuplicate || isAutogen || isNewTeam);
        });
    } else if (filtroAnteprima === 'duplicates') {
        prodottiVisualizzati = prodottiVisualizzati.filter(p => {
            if (p._dup === undefined) p._dup = rilevaDuplicato(p);
            return p._dup !== null;
        });
    }

    return prodottiVisualizzati;
}

/**
 * Disegna la tabella di revisione e attiva i datalists di supporto autocompletamento
 */
function renderAnteprimaTabella() {
    aggiornaStatoFiltroVisivo();
    const tbody = document.getElementById('import-preview-tbody');
    if (!tbody) return;

    let prodottiVisualizzati = ottieniProdottiFiltratiVisibili();

    if (prodottiVisualizzati.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="14" class="px-6 py-12 text-center text-slate-400 text-sm font-semibold">
                    Nessun prodotto corrisponde ai criteri di ricerca selezionati.
                </td>
            </tr>
        `;
        const paginationDiv = document.getElementById('import-preview-pagination');
        if (paginationDiv) paginationDiv.classList.add('hidden');
        aggiornaConteggiAnteprima();
        return;
    }

    const totalCount = prodottiVisualizzati.length;
    const totalPages = Math.ceil(totalCount / importPageSize) || 1;
    if (importCurrentPage > totalPages) importCurrentPage = totalPages;
    if (importCurrentPage < 1) importCurrentPage = 1;

    const startIndex = (importCurrentPage - 1) * importPageSize;
    const endIndex = Math.min(startIndex + importPageSize, totalCount);
    const prodottiPagina = prodottiVisualizzati.slice(startIndex, endIndex);

    // Generazione dinamica dei datalist di aiuto
    const listSquadre = [...new Set(squadreCatalogo.map(t => t.name).filter(Boolean))].sort();
    const listCampionati = [
        'Premier League', 'Serie A', 'La Liga', 'Bundesliga', 'Ligue 1', 'Champions League',
        'USA MLS', 'Saudi League', 'Altri Club', 'Europa', 'Sud America', 'Nord America',
        'Asia', 'Oceania', 'Africa', 'Eastern Conference', 'Western Conference', 'Liga Mx',
        'Brasileiro Serie A', 'Japan Series', 'Nazionali', 'Mondiali', 'NBA'
    ];

    let datalistSquadre = document.getElementById('datalist-squadre');
    if (!datalistSquadre) {
        datalistSquadre = document.createElement('datalist');
        datalistSquadre.id = 'datalist-squadre';
        document.body.appendChild(datalistSquadre);
    }
    datalistSquadre.innerHTML = listSquadre.map(s => `<option value="${escapeHtml(s)}">`).join('');

    let datalistCampionati = document.getElementById('datalist-campionati');
    if (!datalistCampionati) {
        datalistCampionati = document.createElement('datalist');
        datalistCampionati.id = 'datalist-campionati';
        document.body.appendChild(datalistCampionati);
    }
    datalistCampionati.innerHTML = listCampionati.map(c => `<option value="${escapeHtml(c)}">`).join('');

    // Create high-speed lookup set outside of map loop
    const squadreEsistentiSet = new Set(squadreCatalogo.map(t => (t.name || "").toLowerCase()).filter(Boolean));

    tbody.innerHTML = prodottiPagina.map((p) => {
        if (p._errors === undefined) p._errors = validaProdotto(p);
        if (p._dup === undefined) p._dup = rilevaDuplicato(p);

        const dupStatus = p._dup;
        const checkDuplicate = dupStatus !== null;
        const errorsList = p._errors;
        const hasError = errorsList.length > 0;
        
        const teamLower = (p.squadra || "").toLowerCase();
        const isNewTeam = teamLower && teamLower !== 'sconosciuta' && !squadreEsistentiSet.has(teamLower);

        let statoBadge = '';
        if (hasError) {
            statoBadge = `
                <div class="text-red-600 font-bold space-y-1 text-left text-[11px] leading-tight max-w-[150px]">
                    ${errorsList.map(err => `<div>❌ ${err}</div>`).join('')}
                </div>
            `;
        } else if (dupStatus) {
            statoBadge = `<span class="px-3 py-1.5 bg-amber-100 text-amber-950 border border-amber-300 rounded-full font-extrabold text-xs uppercase tracking-wider block text-center shadow-sm" title="${dupStatus.desc} (${dupStatus.location})">🔁 Duplicato</span>`;
        } else if (checkGiaPresente(p)) {
            statoBadge = `<span class="px-3 py-1.5 bg-amber-100 text-amber-950 border border-amber-300 rounded-full font-extrabold text-xs uppercase tracking-wider block text-center shadow-sm">🔁 Duplicato</span>`;
        } else if (p.id_autogenerato) {
            statoBadge = `<span class="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full font-extrabold text-xs uppercase tracking-wider block text-center">ID Auto ⚡</span>`;
        } else if (isNewTeam) {
            statoBadge = `<span class="px-3 py-1.5 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-full font-extrabold text-xs uppercase tracking-wider block text-center">Club Nuovo 🆕</span>`;
        } else {
            statoBadge = `<span class="px-3 py-1.5 bg-green-100 text-green-800 border border-green-300 rounded-full font-extrabold text-xs uppercase tracking-wider block text-center shadow-sm">Pronto 🟢</span>`;
        }

        const target = p.target || 'Adulto';
        const targetOpts = ["Adulto", "Bambino"];
        const targetOptionsHtml = targetOpts.map(t => 
            `<option value="${t}" ${target === t ? 'selected' : ''}>${t}</option>`
        ).join('');

        const categorieOpts = getListaCategorieRegolePrezzi();
        if (p.categoria && !categorieOpts.includes(p.categoria)) {
            categorieOpts.push(p.categoria);
        }
        const selectOptionsHtml = categorieOpts.map(c => 
            `<option value="${escapeHtml(c)}" ${p.categoria === c ? 'selected' : ''}>${escapeHtml(c)}</option>`
        ).join('');

        const borderError = 'border-red-300 focus:border-red-500 bg-red-50/50';
        const borderNormal = 'border-slate-200 focus:border-brand-gold bg-slate-50/50';

        const teamErr = !p.squadra || p.squadra.trim() === '' || p.squadra === 'Sconosciuta';
        const campErr = !p.campionato || p.campionato.trim() === '' || !listCampionati.some(l => l.toLowerCase() === p.campionato.trim().toLowerCase());
        const idErr = !p.legacy_id || p.legacy_id === '';

        return `
            <tr class="hover:bg-slate-50/40 transition-colors border-b border-slate-200/80 last:border-0" id="import-row-${p.id_anteprima}">
                <!-- Checkbox -->
                <td class="px-5 py-4 text-center align-middle">
                    <input type="checkbox" onchange="toggleSelezionaProdotto(${p.id_anteprima}, this.checked)" ${selezionatiInAnteprima.has(p.id_anteprima) ? 'checked' : ''} class="rounded border-slate-300 text-brand-gold focus:ring-brand-gold cursor-pointer h-5 w-5">
                </td>

                <!-- Immagine -->
                <td class="px-5 py-4 text-center align-middle">
                    <div class="flex flex-col items-center gap-2">
                        ${p.immagine ? `
                            <img src="${p.immagine}" alt="Foto" class="h-14 w-14 object-cover rounded-xl border border-slate-200 shadow-md mx-auto" onerror="this.onerror=null; this.parentNode.innerHTML='<div class=\\'h-14 w-14 bg-slate-100 rounded-xl flex items-center justify-center text-sm border border-slate-200 mx-auto\\'>👕</div>';">
                        ` : `
                            <div class="h-14 w-14 bg-slate-100 rounded-xl flex items-center justify-center text-sm border border-slate-200 mx-auto">👕</div>
                        `}
                        <input type="text" value="${escapeHtml(p.immagine)}" 
                            onchange="aggiornaCampoAnteprima(${p.id_anteprima}, 'immagine', this.value)"
                            class="w-28 text-[9px] font-mono border border-slate-200 rounded px-1.5 py-1 text-center mt-1 focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/10" placeholder="Percorso URL">
                    </div>
                </td>

                <!-- Nome Prodotto -->
                <td class="px-5 py-4 align-middle">
                    <input type="text" value="${escapeHtml(p.nome_finale)}" 
                        onchange="aggiornaCampoAnteprima(${p.id_anteprima}, 'nome_finale', this.value)"
                        class="w-full text-xs font-extrabold text-slate-850 rounded-xl px-3 py-2.5 border ${!p.nome_finale ? borderError : borderNormal} outline-none focus:bg-white focus:ring-2 focus:ring-brand-gold/10 transition-all">
                </td>

                <!-- Squadra -->
                <td class="px-5 py-4 align-middle">
                    <input type="text" list="datalist-squadre" value="${escapeHtml(p.squadra)}" 
                        onchange="aggiornaCampoAnteprima(${p.id_anteprima}, 'squadra', this.value)"
                        class="w-full text-xs font-bold text-slate-800 rounded-xl px-3 py-2.5 border ${teamErr ? borderError : borderNormal} outline-none focus:bg-white focus:ring-2 focus:ring-brand-gold/10 transition-all" placeholder="Es. Real Madrid">
                </td>

                <!-- Categoria -->
                <td class="px-5 py-4 align-middle">
                    <select onchange="aggiornaCampoAnteprima(${p.id_anteprima}, 'categoria', this.value)"
                        class="w-full text-xs font-bold text-slate-800 rounded-xl px-3 py-2.5 border ${!p.categoria ? borderError : borderNormal} outline-none focus:bg-white focus:ring-2 focus:ring-brand-gold/10 transition-all bg-slate-50/50">
                        <option value="" disabled ${!p.categoria ? 'selected' : ''}>Seleziona...</option>
                        ${selectOptionsHtml}
                    </select>
                </td>

                <!-- Campionato -->
                <td class="px-5 py-4 align-middle">
                    <input type="text" list="datalist-campionati" value="${escapeHtml(p.campionato || '')}" 
                        onchange="aggiornaCampoAnteprima(${p.id_anteprima}, 'campionato', this.value)"
                        class="w-full text-xs font-bold text-slate-800 rounded-xl px-3 py-2.5 border ${campErr ? borderError : borderNormal} outline-none focus:bg-white focus:ring-2 focus:ring-brand-gold/10 transition-all" placeholder="Es. Serie A">
                </td>

                <!-- Target -->
                <td class="px-5 py-4 align-middle">
                    <select onchange="aggiornaCampoAnteprima(${p.id_anteprima}, 'target', this.value)"
                        class="w-full text-xs font-bold text-slate-800 rounded-xl px-3 py-2.5 border border-slate-200 focus:border-brand-gold bg-slate-50/50 outline-none focus:bg-white focus:ring-2 focus:ring-brand-gold/10 transition-all">
                        ${targetOptionsHtml}
                    </select>
                </td>

                <!-- Stagione -->
                <td class="px-5 py-4 align-middle">
                    <input type="text" value="${escapeHtml(p.stagione)}" 
                        onchange="aggiornaCampoAnteprima(${p.id_anteprima}, 'stagione', this.value)"
                        class="w-full text-xs font-bold text-slate-800 rounded-xl px-3 py-2.5 border ${!p.stagione || !/^\d{2,4}\/\d{2,4}$/.test(p.stagione) ? borderError : borderNormal} outline-none focus:bg-white focus:ring-2 focus:ring-brand-gold/10 transition-all" placeholder="Es. 2024/2025">
                </td>

                <!-- Prezzo Fornitore -->
                <td class="px-5 py-4 align-middle">
                    <input type="number" step="0.01" min="0" value="${p.prezzo_fornitore || ''}" 
                        onchange="aggiornaCampoAnteprima(${p.id_anteprima}, 'prezzo_fornitore', parseFloat(this.value) || 0)"
                        class="w-full text-xs text-slate-700 font-mono rounded-xl px-3 py-2.5 border ${borderNormal} outline-none focus:bg-white focus:ring-2 focus:ring-brand-gold/10 transition-all" placeholder="0.00">
                </td>

                <!-- Prezzo Vendita -->
                <td class="px-5 py-4 align-middle">
                    <input type="number" step="0.01" min="0" value="${p.prezzo}" 
                        onchange="aggiornaCampoAnteprima(${p.id_anteprima}, 'prezzo', parseFloat(this.value) || 0)"
                        class="w-full text-xs font-extrabold text-slate-850 font-mono rounded-xl px-3 py-2.5 border ${p.prezzo <= 0 ? borderError : borderNormal} outline-none focus:bg-white focus:ring-2 focus:ring-brand-gold/10 transition-all">
                </td>

                <!-- Disp. -->
                <td class="px-5 py-4 text-center align-middle">
                    <select onchange="aggiornaCampoAnteprima(${p.id_anteprima}, 'disponibilita', this.value === 'true')"
                        class="w-full text-xs font-bold text-slate-800 rounded-xl px-2.5 py-2.5 border border-slate-200 outline-none focus:bg-white focus:ring-2 focus:ring-brand-gold/10 transition-all bg-slate-50/50">
                        <option value="true" ${p.disponibilita !== false ? 'selected' : ''}>Sì</option>
                        <option value="false" ${p.disponibilita === false ? 'selected' : ''}>No</option>
                    </select>
                </td>

                <!-- ID Univoco -->
                <td class="px-5 py-4 align-middle">
                    <div class="flex items-center gap-1.5 justify-center">
                        <input type="text" value="${escapeHtml(p.legacy_id || p.id || '')}" 
                            onchange="aggiornaCampoAnteprima(${p.id_anteprima}, 'legacy_id', this.value)"
                            class="w-28 text-xs font-mono font-bold text-slate-700 rounded-xl px-2.5 py-2.5 border ${idErr ? borderError : borderNormal} outline-none focus:bg-white focus:ring-2 focus:ring-brand-gold/10 transition-all text-center" placeholder="ID">
                        <button type="button" onclick="rigeneraIdProdottoAnteprima(${p.id_anteprima})" class="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl border border-slate-200 transition-colors" title="Genera automaticamente">
                            ⚡
                        </button>
                    </div>
                </td>

                <!-- Stato -->
                <td class="px-5 py-4 text-center align-middle" id="stato-badge-${p.id_anteprima}">
                    ${statoBadge}
                </td>

                <!-- Azioni -->
                <td class="px-5 py-4 text-center align-middle">
                    <button type="button" onclick="eliminaProdottoAnteprima(${p.id_anteprima})" class="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-extrabold text-xs rounded-xl transition-colors inline-flex items-center gap-1.5 border border-red-100 shadow-sm" title="Escludi dall'importazione">
                        🗑️ Escludi
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    aggiornaConteggiAnteprima();
    renderPaginationControls(totalCount);
}

/**
 * Disegna i bottoni di controllo della paginazione nel modal di importazione
 */
function renderPaginationControls(totalCount) {
    const startSpan = document.getElementById('pagination-start-index');
    const endSpan = document.getElementById('pagination-end-index');
    const totalSpan = document.getElementById('pagination-total-count');
    const buttonsContainer = document.getElementById('pagination-controls-buttons');
    const paginationDiv = document.getElementById('import-preview-pagination');
    
    if (!paginationDiv) return;

    if (totalCount === 0) {
        paginationDiv.classList.add('hidden');
        return;
    }
    paginationDiv.classList.remove('hidden');

    const totalPages = Math.ceil(totalCount / importPageSize) || 1;
    if (importCurrentPage > totalPages) importCurrentPage = totalPages;

    const startIndex = totalCount === 0 ? 0 : (importCurrentPage - 1) * importPageSize + 1;
    const endIndex = Math.min(importCurrentPage * importPageSize, totalCount);

    if (startSpan) startSpan.innerText = startIndex;
    if (endSpan) endSpan.innerText = endIndex;
    if (totalSpan) totalSpan.innerText = totalCount;

    if (!buttonsContainer) return;
    buttonsContainer.innerHTML = '';

    const createButton = (label, targetPage, isCurrent, isDisabled) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.innerText = label;
        btn.onclick = () => {
            if (isDisabled || isCurrent) return;
            importCurrentPage = targetPage;
            renderAnteprimaTabella();
        };

        if (isCurrent) {
            btn.className = "px-3 py-1.5 bg-brand-gold text-white font-bold text-xs rounded-lg shadow-sm cursor-default";
        } else if (isDisabled) {
            btn.className = "px-3 py-1.5 bg-slate-50 text-slate-300 font-semibold text-xs rounded-lg border border-slate-100 cursor-not-allowed";
        } else {
            btn.className = "px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-lg border border-slate-200 shadow-sm transition-all cursor-pointer";
        }
        return btn;
    };

    // Primo page button
    buttonsContainer.appendChild(createButton('«', 1, false, importCurrentPage === 1));
    // Previous page button
    buttonsContainer.appendChild(createButton('‹', importCurrentPage - 1, false, importCurrentPage === 1));

    // Page window (max 5 page buttons)
    const maxVisiblePages = 5;
    let startPage = Math.max(1, importCurrentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    if (startPage > 1) {
        const dots = document.createElement('span');
        dots.className = "text-slate-400 font-bold px-1";
        dots.innerText = "...";
        buttonsContainer.appendChild(createButton('1', 1, false, false));
        if (startPage > 2) buttonsContainer.appendChild(dots);
    }

    for (let p = startPage; p <= endPage; p++) {
        buttonsContainer.appendChild(createButton(String(p), p, p === importCurrentPage, false));
    }

    if (endPage < totalPages) {
        const dots = document.createElement('span');
        dots.className = "text-slate-400 font-bold px-1";
        dots.innerText = "...";
        if (endPage < totalPages - 1) buttonsContainer.appendChild(dots);
        buttonsContainer.appendChild(createButton(String(totalPages), totalPages, false, false));
    }

    // Next page button
    buttonsContainer.appendChild(createButton('›', importCurrentPage + 1, false, importCurrentPage === totalPages));
    // Last page button
    buttonsContainer.appendChild(createButton('»', totalPages, false, importCurrentPage === totalPages));
}

/**
 * Aggiorna lo stato di un singolo prodotto in anteprima preservando il focus di battitura
 */
function aggiornaCampoAnteprima(id_anteprima, field, value) {
    const pIndex = findProdIndex(id_anteprima);
    if (pIndex === -1) return;
    
    if (field === 'squadra') {
        const dbMatch = trovaSquadraInDatabase(value, squadreCatalogo);
        if (dbMatch) {
            prodottiInAnteprima[pIndex]['squadra'] = dbMatch.name;
            if (dbMatch.sezione) {
                prodottiInAnteprima[pIndex]['campionato'] = dbMatch.sezione;
            }
        } else {
            prodottiInAnteprima[pIndex]['squadra'] = value.trim();
        }
        prodottiInAnteprima[pIndex]._errors = validaProdotto(prodottiInAnteprima[pIndex]);
        renderAnteprimaTabella();
        return;
    }

    prodottiInAnteprima[pIndex][field] = value;

    // Se l'utente corregge categoria o target, ricalcola automaticamente il prezzo di vendita consigliato
    if (field === 'categoria' || field === 'target') {
        const catVal = field === 'categoria' ? value : prodottiInAnteprima[pIndex]['categoria'];
        const tgtVal = field === 'target' ? value : (prodottiInAnteprima[pIndex]['target'] || 'Adulto');
        const nuovoPrezzo = getPrezzoVendita(catVal, tgtVal);
        prodottiInAnteprima[pIndex]['prezzo'] = nuovoPrezzo;
        
        // Trattandosi di ricalcoli a cascata che coinvolgono più campi visibili della riga,
        // ridisegniamo la tabella per mantenere l'interfaccia perfettamente allineata
        renderAnteprimaTabella();
        return;
    }

    const p = prodottiInAnteprima[pIndex];
    const checkDuplicate = checkGiaPresente(p);
    const errorsList = validaProdotto(p);
    const hasError = errorsList.length > 0;
    
    // Aggiornamento selettivo in riga degli stili dei bordi per non distruggere il focus
    const row = document.getElementById(`import-row-${id_anteprima}`);
    if (row) {
        const inputs = row.querySelectorAll('input, select');
        const listCampionati = [
            'Premier League', 'Serie A', 'La Liga', 'Bundesliga', 'Ligue 1', 'Champions League',
            'USA MLS', 'Saudi League', 'Altri Club', 'Europa', 'Sud America', 'Nord America',
            'Asia', 'Oceania', 'Africa', 'Eastern Conference', 'Western Conference', 'Liga Mx',
            'Brasileiro Serie A', 'Japan Series', 'Nazionali', 'Mondiali', 'NBA'
        ];
        inputs.forEach(input => {
            const onChangeAttr = input.getAttribute('onchange') || input.getAttribute('oninput') || '';
            if (onChangeAttr.includes('nome_finale')) {
                input.className = input.className.replace(/border-(red-300|slate-200)/g, !p.nome_finale ? 'border-red-300' : 'border-slate-200');
            } else if (onChangeAttr.includes('squadra')) {
                const teamErr = !p.squadra || p.squadra.trim() === '' || p.squadra === 'Sconosciuta';
                input.className = input.className.replace(/border-(red-300|slate-200)/g, teamErr ? 'border-red-300' : 'border-slate-200');
            } else if (onChangeAttr.includes('campionato')) {
                const campErr = !p.campionato || p.campionato.trim() === '' || !listCampionati.some(l => l.toLowerCase() === p.campionato.trim().toLowerCase());
                input.className = input.className.replace(/border-(red-300|slate-200)/g, campErr ? 'border-red-300' : 'border-slate-200');
            } else if (onChangeAttr.includes('categoria')) {
                input.className = input.className.replace(/border-(red-300|slate-200)/g, !p.categoria ? 'border-red-300' : 'border-slate-200');
            } else if (onChangeAttr.includes('stagione')) {
                const stagErr = !p.stagione || !/^\d{2,4}\/\d{2,4}$/.test(p.stagione);
                input.className = input.className.replace(/border-(red-300|slate-200)/g, stagErr ? 'border-red-300' : 'border-slate-200');
            } else if (onChangeAttr.includes('prezzo') && !onChangeAttr.includes('prezzo_fornitore')) {
                const priceErr = p.prezzo === undefined || p.prezzo === null || p.prezzo <= 0;
                input.className = input.className.replace(/border-(red-300|slate-200)/g, priceErr ? 'border-red-300' : 'border-slate-200');
            } else if (onChangeAttr.includes('legacy_id')) {
                const idErr = !p.legacy_id || p.legacy_id === '';
                input.className = input.className.replace(/border-(red-300|slate-200)/g, idErr ? 'border-red-300' : 'border-slate-200');
            }
        });
    }

    // Aggiornamento selettivo in riga del badge di stato
    const badgeContainer = document.getElementById(`stato-badge-${id_anteprima}`);
    if (badgeContainer) {
        const teamExists = squadreCatalogo.some(t => t.name && t.name.toLowerCase() === p.squadra.toLowerCase());
        const isNewTeam = !teamExists && p.squadra && p.squadra !== 'Sconosciuta';
        const dupStatus = rilevaDuplicato(p);
        if (hasError) {
            badgeContainer.innerHTML = `
                <div class="text-red-600 font-bold space-y-1 text-left text-[11px] leading-tight max-w-[150px]">
                    ${errorsList.map(err => `<div>❌ ${err}</div>`).join('')}
                </div>
            `;
        } else if (dupStatus) {
            badgeContainer.innerHTML = `<span class="px-3 py-1.5 bg-amber-100 text-amber-950 border border-amber-300 rounded-full font-extrabold text-xs uppercase tracking-wider block text-center shadow-sm" title="${dupStatus.desc} (${dupStatus.location})">🔁 Duplicato</span>`;
        } else if (checkGiaPresente(p)) {
            badgeContainer.innerHTML = `<span class="px-3 py-1.5 bg-amber-100 text-amber-950 border border-amber-300 rounded-full font-extrabold text-xs uppercase tracking-wider block text-center shadow-sm">🔁 Duplicato</span>`;
        } else if (p.id_autogenerato) {
            badgeContainer.innerHTML = `<span class="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full font-extrabold text-xs uppercase tracking-wider block text-center">ID Auto ⚡</span>`;
        } else if (isNewTeam) {
            badgeContainer.innerHTML = `<span class="px-3 py-1.5 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-full font-extrabold text-xs uppercase tracking-wider block text-center">Club Nuovo 🆕</span>`;
        } else {
            badgeContainer.innerHTML = `<span class="px-3 py-1.5 bg-green-100 text-green-800 border border-green-300 rounded-full font-extrabold text-xs uppercase tracking-wider block text-center shadow-sm">Pronto 🟢</span>`;
        }
    }

    // Ricalcola i totali in tempo reale sul pannello riepilogo e tab counters
    aggiornaConteggiAnteprima();
}

/**
 * Ricalcola i contatori statistici e aggiorna i pulsanti di controllo della revisione
 */
function aggiornaConteggiAnteprima() {
    let totRemaining = prodottiInAnteprima.length;
    let totAnalizzati = initialImportCount;
    let nuovi = 0;
    let duplicati = 0;
    let errori = 0;
    let eliminati = initialImportCount - totRemaining;
    let prontiAllImportazione = 0;

    const squadreSet = new Set();
    const campionatiSet = new Set();
    const categorieSet = new Set();

    // Map existing teams for ultra-fast lookup (O(1)) instead of calling .some in loops
    const squadreEsistentiSet = new Set(squadreCatalogo.map(t => (t.name || "").toLowerCase()).filter(Boolean));

    const countAll = prodottiInAnteprima.length;
    let countValid = 0;
    let countErrors = 0;
    let countVerify = 0;
    let countDuplicates = 0;

    prodottiInAnteprima.forEach(p => {
        // Lazily compute cache if not already present
        if (p._errors === undefined) p._errors = validaProdotto(p);
        if (p._dup === undefined) p._dup = rilevaDuplicato(p);

        const errorsList = p._errors;
        const hasError = errorsList.length > 0;
        
        if (hasError) {
            errori++;
            countErrors++;
        } else {
            countValid++;
            prontiAllImportazione++;
            
            const dup = p._dup;
            const checkDuplicate = dup !== null;
            if (checkDuplicate) {
                duplicati++;
                countDuplicates++;
            } else {
                nuovi++;
            }

            const isAutogen = p.id_autogenerato;
            const teamLower = (p.squadra || "").toLowerCase();
            const isNewTeam = teamLower && teamLower !== 'sconosciuta' && !squadreEsistentiSet.has(teamLower);

            if (checkDuplicate || isAutogen || isNewTeam) {
                countVerify++;
            }
        }
        if (p.squadra && p.squadra !== 'Sconosciuta') squadreSet.add(p.squadra);
        if (p.campionato) campionatiSet.add(p.campionato);
        if (p.categoria) categorieSet.add(p.categoria);
    });

    // Make sure we include all duplicates (even those that might have errors, for counting consistency)
    countDuplicates = prodottiInAnteprima.filter(p => {
        if (p._dup === undefined) p._dup = rilevaDuplicato(p);
        return p._dup !== null;
    }).length;

    const squadreTrovate = Array.from(squadreSet).sort();
    const campionatiTrovati = Array.from(campionatiSet).sort();
    const categorieTrovate = Array.from(categorieSet).sort();

    // Aggiorna la riga delle statistiche in calce
    const summaryContainer = document.getElementById('import-stats-summary');
    if (summaryContainer) {
        summaryContainer.className = "text-xs font-semibold text-slate-600 grid grid-cols-2 md:grid-cols-6 gap-4 w-full bg-slate-50 p-4 rounded-2xl border border-slate-100";
        summaryContainer.innerHTML = `
            <div>📋 Totale Scansionati: <strong class="text-slate-900 font-mono">${totAnalizzati}</strong></div>
            <div class="text-green-600">📥 Nuovi/Pronti: <strong class="font-mono">${nuovi}</strong></div>
            <div class="text-amber-600">⚠️ Già nel DB: <strong class="font-mono">${duplicati}</strong></div>
            <div class="text-red-600">❌ Con Errori: <strong class="font-mono">${errori}</strong></div>
            <div class="text-slate-500">🗑️ Esclusi: <strong class="font-mono">${eliminati}</strong></div>
            <div class="text-brand-gold">✨ Pronti all'Importazione: <strong class="font-mono">${prontiAllImportazione}</strong></div>
            <div class="col-span-2 md:col-span-6 mt-2 border-t border-slate-200/60 pt-2 flex flex-wrap gap-4 text-[10px] text-slate-500">
                <span>⚽ Club coinvolti: <strong class="text-slate-700">${squadreTrovate.length}</strong> (${squadreTrovate.slice(0, 5).join(', ')}${squadreTrovate.length > 5 ? '...' : ''})</span>
                <span>🏆 Campionati: <strong class="text-slate-700">${campionatiTrovati.length}</strong> (${campionatiTrovati.slice(0, 5).join(', ')}${campionatiTrovati.length > 5 ? '...' : ''})</span>
                <span>🏷️ Categorie: <strong class="text-slate-700">${categorieTrovate.length}</strong> (${categorieTrovate.join(', ')})</span>
            </div>
        `;
    }

    if (document.getElementById('count-preview-all')) document.getElementById('count-preview-all').innerText = countAll;
    if (document.getElementById('count-preview-valid')) document.getElementById('count-preview-valid').innerText = countValid;
    if (document.getElementById('count-preview-errors')) document.getElementById('count-preview-errors').innerText = countErrors;
    if (document.getElementById('count-preview-verify')) document.getElementById('count-preview-verify').innerText = countVerify;
    if (document.getElementById('count-preview-duplicates'))
        document.getElementById('count-preview-duplicates').innerText = countDuplicates;

    // Aggiorna lo stato della checkbox "Seleziona Tutto" visiva
    const selectAllCheckbox = document.getElementById('select-all-import-checkbox');
    if (selectAllCheckbox) {
        let prodottiVisualizzati = ottieniProdottiFiltratiVisibili();
        const allSelected = prodottiVisualizzati.length > 0 && prodottiVisualizzati.every(p => selezionatiInAnteprima.has(p.id_anteprima));
        selectAllCheckbox.checked = allSelected;
    }

    // Aggiorna lo stato e il contatore del pulsante Eliminazione Massiva
    const bulkBtn = document.getElementById('bulk-delete-preview-btn');
    const bulkCount = document.getElementById('bulk-delete-count');
    if (bulkBtn && bulkCount) {
        const count = selezionatiInAnteprima.size;
        bulkCount.innerText = count;
        if (count > 0) {
            bulkBtn.disabled = false;
            bulkBtn.className = "px-4 py-2.5 bg-red-100 hover:bg-red-200 text-red-700 border border-red-200 font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm";
        } else {
            bulkBtn.disabled = true;
            bulkBtn.className = "px-4 py-2.5 bg-slate-100 text-slate-400 border border-slate-200 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-not-allowed";
        }
    }

    // Aggiorna lo stato del pulsante "Conferma ed Importa"
    const confirmBtn = document.getElementById('confirm-import-btn');
    if (confirmBtn) {
        if (prontiAllImportazione === 0) {
            confirmBtn.disabled = true;
            confirmBtn.className = "px-5 py-2.5 bg-slate-200 text-slate-400 font-bold text-xs rounded-xl cursor-not-allowed opacity-60";
            confirmBtn.title = "Correggi gli errori per abilitare l'importazione";
        } else {
            confirmBtn.disabled = false;
            confirmBtn.className = "px-5 py-2.5 bg-brand-gold hover:bg-brand-goldHover text-white font-bold text-xs rounded-xl shadow-md shadow-brand-gold/15 transition-all cursor-pointer";
            confirmBtn.title = `Esegui l'importazione di ${prontiAllImportazione} prodotti`;
        }
    }
}

async function eseguiImportazioneSottoConferma() {
    const prodottiValidi = prodottiInAnteprima.filter(p => {
        if (p._errors === undefined) p._errors = validaProdotto(p);
        return p._errors.length === 0;
    });
    if (prodottiValidi.length === 0) {
        showToast("Nessun prodotto valido pronto per l'importazione.", "error");
        return;
    }

    const confirmBtn = document.getElementById('confirm-import-btn');
    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerText = "Salvataggio...";
    }

    // Mostra la finestra di avanzamento nello stato "Salvataggio..."
    mostraProgressoImportazione(
        "Salvataggio nel Database",
        `Salvataggio di ${prodottiValidi.length} prodotti nel database in corso...`,
        50,
        `Prodotti: 0/${prodottiValidi.length}`
    );

    showToast("Importazione in corso...", "info");

    try {
        const res = await fetch('/api/settings/products/import_batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ products: prodottiValidi })
        });

        if (res.ok) {
            const result = await res.json();
            if (result.success && (!result.errori || result.errori === 0)) {
                // Intercettazione completamento: tutte le Promise di salvataggio sono concluse con successo
                const countImportati = result.importati || prodottiValidi.length;
                mostraProgressoImportazione(
                    "✅ Importazione completata",
                    `✅ ${countImportati} prodotti salvati correttamente nel database.`,
                    100,
                    `Completato: ${countImportati}/${prodottiValidi.length}`
                );
                if (confirmBtn) {
                    confirmBtn.innerText = "✅ Importazione completata";
                }

                // Attende circa 1 secondo per consentire la lettura del messaggio di successo
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Chiude automaticamente la finestra di avanzamento e la modal di anteprima
                nascondiProgressoImportazione();
                closeImportPreviewModal();
                
                // Aggiornamento report di importazione
                const elAnalizzati = document.getElementById('res-analizzati');
                if (elAnalizzati) elAnalizzati.innerText = result.analizzati || prodottiValidi.length;

                const elValidi = document.getElementById('res-validi');
                if (elValidi) elValidi.innerText = result.validi || prodottiValidi.length;

                const elImportati = document.getElementById('res-importati');
                if (elImportati) elImportati.innerText = result.importati || 0;

                const elDuplicati = document.getElementById('res-duplicati');
                if (elDuplicati) elDuplicati.innerText = result.duplicati || 0;

                const elEsclusi = document.getElementById('res-esclusi');
                if (elEsclusi) elEsclusi.innerText = result.esclusi || 0;

                const elErrori = document.getElementById('res-errori');
                if (elErrori) elErrori.innerText = result.errori || 0;

                const errContainer = document.getElementById('import-errors-log-container');
                const errLog = document.getElementById('import-errors-log');
                if (errLog) {
                    errLog.innerHTML = '';
                    if (result.errori_dettagli && result.errori_dettagli.length > 0) {
                        if (errContainer) errContainer.classList.remove('hidden');
                        result.errori_dettagli.forEach(err => {
                            const div = document.createElement('div');
                            div.className = 'border-b border-slate-200/55 pb-1.5 mb-1.5 last:border-0 last:pb-0 last:mb-0 text-left';
                            div.innerHTML = `<span class="font-bold text-slate-700">Riga ${err.riga}:</span> <span class="text-red-500 font-semibold">${escapeHtml(err.errore)}</span>`;
                            errLog.appendChild(div);
                        });
                    } else {
                        if (errContainer) errContainer.classList.add('hidden');
                    }
                }

                openImportResultsModal();
                showToast("Importazione batch completata con successo!", "success");

                // Aggiorna la tabella dei prodotti nel database / catalogo
                if (typeof caricaDati === 'function') {
                    await caricaDati();
                }
            } else {
                // In caso di errore o prodotti non salvati, NON chiudiamo automaticamente la finestra
                const countImportati = result.importati || 0;
                const countErrori = result.errori || 1;
                const msgError = result.error || `${countImportati} prodotti importati, ${countErrori} falliti.`;

                mostraProgressoImportazione(
                    "❌ Errore durante l'importazione",
                    `⚠️ Importati: ${countImportati} | Falliti: ${countErrori}. ${msgError}`,
                    100,
                    `Errori: ${countErrori}`
                );

                showToast("Errore di importazione: " + msgError, "error");
                if (confirmBtn) {
                    confirmBtn.disabled = false;
                    confirmBtn.innerText = "Conferma Importazione";
                }
            }
        } else {
            // Errore HTTP Server
            mostraProgressoImportazione(
                "❌ Errore Comunicazione Server",
                "Impossibile completare il salvataggio nel database.",
                100,
                "Errore HTTP"
            );
            showToast("Errore di comunicazione col server.", "error");
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.innerText = "Conferma Importazione";
            }
        }
    } catch (err) {
        // Errore eccezione di rete
        mostraProgressoImportazione(
            "❌ Errore Inaspettato",
            "Errore durante l'importazione: " + err.message,
            100,
            "Errore"
        );
        showToast("Errore: " + err.message, "error");
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerText = "Conferma Importazione";
        }
    }
}

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

function generaNomeTradottoAutomatico(p, squadraRiconosciuta, categoriaRiconosciuta, targetRiconosciuto) {
    const rawText = [p.name, p.title, p.nome, p.image_alt, p.product_link].filter(Boolean).join(' ').toLowerCase();
    
    // 1. Determina Categoria / Tipo Base in Italiano
    let baseType = "Kit";
    let isFeminine = false;
    
    if (categoriaRiconosciuta === 'Player') {
        baseType = "Maglia Player";
        isFeminine = true;
    } else if (categoriaRiconosciuta === 'Fan') {
        baseType = "Maglia Fan";
        isFeminine = true;
    } else if (categoriaRiconosciuta === 'Retro') {
        baseType = "Maglia Retrò";
        isFeminine = true;
    } else if (categoriaRiconosciuta === 'Kit Allenamento') {
        baseType = "Kit Allenamento";
        isFeminine = false;
    } else if (categoriaRiconosciuta === 'Tuta') {
        baseType = "Tuta";
        isFeminine = true;
    } else {
        // Fallback o Kit generico vs Maglia
        if (rawText.includes('jersey') || rawText.includes('shirt') || rawText.includes('maglia') || rawText.includes('vest')) {
            baseType = "Maglia";
            isFeminine = true;
        } else if (rawText.includes('kit') || rawText.includes('completo') || rawText.includes('shorts')) {
            baseType = "Kit";
            isFeminine = false;
        } else {
            baseType = "Maglia";
            isFeminine = true;
        }
    }
    
    // Aggiunge la versione se presente (Casa, Trasferta, ecc.)
    let versionPart = "";
    if (rawText.includes('home') || rawText.includes('casa')) {
        versionPart = "Casa";
    } else if (rawText.includes('away') || rawText.includes('trasferta')) {
        versionPart = "Trasferta";
    } else if (rawText.includes('third') || rawText.includes('terza')) {
        versionPart = "Third";
    } else if (rawText.includes('fourth') || rawText.includes('quarta')) {
        versionPart = "Quarta";
    } else if (rawText.includes('special') || rawText.includes('speciale')) {
        versionPart = "Speciale";
    }
    
    if (versionPart) {
        baseType = `${baseType} ${versionPart}`;
    }

    // 2. Componente Target
    let targetPart = "";
    if (targetRiconosciuto === 'Bambino') {
        targetPart = "Bambino";
    }
    
    // 3. Componente Colore
    let colorPart = "";
    for (const [engColor, translations] of Object.entries(colorsMapping)) {
        if (rawText.includes(engColor)) {
            colorPart = isFeminine ? translations.f : translations.m;
            break;
        }
    }
    
    // 4. Costruisci le parti finali del nome
    const parts = [baseType];
    if (targetPart) parts.push(targetPart);
    if (colorPart) parts.push(colorPart);
    if (squadraRiconosciuta && squadraRiconosciuta !== 'Sconosciuta') {
        parts.push(squadraRiconosciuta);
    }
    
    return parts.join(' ');
}

function generaNomeUniforme(p) {
    const squadreEsistenti = [...new Set(prodotti.map(prod => prod.squadra).filter(Boolean))].sort();
    const squadra = extractSquadra(p, squadreEsistenti);
    const categoria = extractCategoria(p);
    const target = extractTarget(p);
    return generaNomeTradottoAutomatico(p, squadra, categoria, target);
}

/**
 * Processa l'importazione dei prodotti via JSON
 */
function chiediInserimentoSquadra(nomeSquadra) {
    return new Promise((resolve) => {
        // Create modal backdrop
        const backdrop = document.createElement('div');
        backdrop.className = "fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in";
        
        // Create modal box
        const box = document.createElement('div');
        box.className = "bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 shadow-2xl flex flex-col gap-4 transform scale-100 transition-all duration-300 ease-out";
        
        box.innerHTML = `
            <div class="flex items-center gap-3 text-brand-gold">
                <span class="text-3xl">⚠️</span>
                <h3 class="text-lg font-black text-slate-800">Squadra Mancante</h3>
            </div>
            <p class="text-sm text-slate-600 leading-relaxed">
                La squadra <strong class="text-slate-800">"${nomeSquadra}"</strong> non è presente nel catalogo generale. Come vuoi procedere per l'importazione?
            </p>
            <div class="flex flex-col gap-2 mt-2">
                <button id="add-as-club-btn" class="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all">
                    ⚽ Aggiungi come Club
                </button>
                <button id="add-as-naz-btn" class="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all">
                    🌍 Aggiungi come Nazionale
                </button>
                <button id="add-as-nba-btn" class="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all">
                    🏀 Aggiungi come NBA
                </button>
                <button id="skip-team-btn" class="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs rounded-xl transition-all border border-rose-100">
                    ⏭️ Salta Prodotti di questa Squadra
                </button>
            </div>
        `;
        
        backdrop.appendChild(box);
        document.body.appendChild(backdrop);
        
        // Bind buttons
        box.querySelector('#add-as-club-btn').onclick = () => {
            document.body.removeChild(backdrop);
            resolve({ action: 'add', sezione: 'Club' });
        };
        box.querySelector('#add-as-naz-btn').onclick = () => {
            document.body.removeChild(backdrop);
            resolve({ action: 'add', sezione: 'Nazionali' });
        };
        box.querySelector('#add-as-nba-btn').onclick = () => {
            document.body.removeChild(backdrop);
            resolve({ action: 'add', sezione: 'NBA' });
        };
        box.querySelector('#skip-team-btn').onclick = () => {
            document.body.removeChild(backdrop);
            resolve({ action: 'skip' });
        };
    });
}

/**
 * Processa l'importazione dei prodotti via JSON
 */
async function processaImportazioneJSON() {
    const text = document.getElementById('import-json-textarea').value.trim();
    if (!text) {
        showToast("Per favore inserisci o carica del testo JSON.", "error");
        return;
    }

    try {
        const parsed = JSON.parse(text);
        const productsArray = Array.isArray(parsed) ? parsed : [parsed];

        showToast("Analisi del file in corso...", "info");

        // Assicuriamoci che squadreCatalogo sia caricato dal database del sito
        await caricaSquadre();

        // Processa direttamente utilizzando il riconoscimento ufficiale dal database squadre
        await processaArrayProdottiScansionati(productsArray);

    } catch (e) {
        showToast("Formato JSON non valido: " + e.message, "error");
    }
}

function toggleMostraSoloErrori() {
    mostraSoloErrori = !mostraSoloErrori;
    if (typeof renderAnteprimaTabella === 'function') {
        renderAnteprimaTabella();
    }
}

// Expose handlers to window scope
window.handleImportFile = handleImportFile;
window.processaImportazioneJSON = processaImportazioneJSON;
window.closeImportPreviewModal = closeImportPreviewModal;
window.closeImportResultsModal = closeImportResultsModal;
window.aggiornaCampoAnteprima = aggiornaCampoAnteprima;
window.eseguiImportazioneSottoConferma = eseguiImportazioneSottoConferma;
window.toggleMostraSoloErrori = toggleMostraSoloErrori;
window.toggleSelezionaProdotto = toggleSelezionaProdotto;
window.toggleSelectAllImport = toggleSelectAllImport;
window.eliminaProdottoAnteprima = eliminaProdottoAnteprima;
window.eliminaSelezionatiAnteprima = eliminaSelezionatiAnteprima;

/**
 * Esporta il catalogo corrente in formato JSON o CSV
 */
function esportaCatalogo(format) {
    if (prodotti.length === 0) {
        showToast("Nessun prodotto disponibile da esportare.", "error");
        return;
    }

    if (format === 'json') {
        const jsonStr = JSON.stringify(prodotti, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `prodotti_catalogo_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast("Catalogo JSON esportato con successo!", "success");
    } else if (format === 'csv') {
        const headers = ["ID", "Legacy ID", "Squadra", "Categoria", "Versione", "Stagione", "Prezzo EUR", "Prezzo Fornitore USD", "Immagine"];
        const rows = prodotti.map(p => [
            p.id,
            p.legacy_id,
            `"${(p.squadra || '').replace(/"/g, '""')}"`,
            `"${(p.categoria || '').replace(/"/g, '""')}"`,
            `"${(p.versione || '').replace(/"/g, '""')}"`,
            `"${(p.stagione || '').replace(/"/g, '""')}"`,
            p.prezzo,
            p.prezzo_fornitore || "",
            `"${(p.immagine || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `prodotti_catalogo_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast("Catalogo CSV esportato con successo!", "success");
    }
}

/**
 * Controlla lo stato delle connessioni a Supabase e dei Lotti Archiviati
 */
async function controllaStatoConnessioni() {
    const supabaseStatus = document.getElementById('connection-supabase-status');
    const supabaseCount = document.getElementById('connection-supabase-count');
    const lottiStatus = document.getElementById('connection-lotti-status');
    const lottiCount = document.getElementById('connection-lotti-count');
    const lastUpdate = document.getElementById('connection-last-update');

    if (supabaseStatus) {
        supabaseStatus.className = "inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-700 animate-pulse";
        supabaseStatus.innerText = "Verifica in corso...";
    }
    if (lottiStatus) {
        lottiStatus.className = "inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-700 animate-pulse";
        lottiStatus.innerText = "Verifica in corso...";
    }

    try {
        const res = await fetch('/api/connections/status');
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.status) {
                const s = data.status;
                
                if (supabaseStatus) {
                    if (s.supabase.connected) {
                        supabaseStatus.className = "inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800";
                        supabaseStatus.innerText = "● Connesso";
                    } else {
                        supabaseStatus.className = "inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold rounded-full bg-rose-100 text-rose-800";
                        supabaseStatus.innerText = "○ Disconnesso (Locale)";
                    }
                }
                if (supabaseCount) {
                    supabaseCount.innerText = s.supabase.count;
                }

                if (lottiStatus) {
                    if (s.lotti && s.lotti.connected) {
                        lottiStatus.className = "inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800";
                        lottiStatus.innerText = "● Connesso";
                    } else {
                        lottiStatus.className = "inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold rounded-full bg-rose-100 text-rose-800";
                        lottiStatus.innerText = "○ Disconnesso";
                    }
                }
                if (lottiCount) {
                    lottiCount.innerText = s.lotti ? s.lotti.count : 0;
                }

                if (lastUpdate) {
                    lastUpdate.innerText = s.lastUpdate || new Date().toLocaleString('it-IT');
                }
            }
        }
    } catch (e) {
        console.error("Errore verifica connessioni:", e);
        if (supabaseStatus) {
            supabaseStatus.className = "inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold rounded-full bg-rose-100 text-rose-800";
            supabaseStatus.innerText = "Errore di rete";
        }
        if (lottiStatus) {
            lottiStatus.className = "inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold rounded-full bg-rose-100 text-rose-800";
            lottiStatus.innerText = "Errore di rete";
        }
    }
}

// Espone le funzioni a livello globale per renderle cliccabili da HTML inline onclick handlers
window.caricaSettings = caricaSettings;
window.popolaSettingsUI = popolaSettingsUI;
window.setValutaMode = setValutaMode;
window.salvaSezioneSettings = salvaSezioneSettings;
window.aggiornaSquadreDropdown = aggiornaSquadreDropdown;
window.gestisciRinominaSquadra = gestisciRinominaSquadra;
window.gestisciEliminaSquadra = gestisciEliminaSquadra;
window.handleImportFile = handleImportFile;
window.processaImportazioneJSON = processaImportazioneJSON;
window.esportaCatalogo = esportaCatalogo;
window.controllaStatoConnessioni = controllaStatoConnessioni;

/**
 * Normalizza il formato del numero di telefono WhatsApp
 */
function normalizzaNumeroWhatsApp(phone) {
    if (!phone) return "";
    let clean = phone.trim();
    const hasPlus = clean.startsWith('+');
    clean = clean.replace(/[^0-9]/g, '');
    
    // Se ha 9 o 10 cifre e inizia con 3 (tipico cellulare italiano senza prefisso), aggiungi 39
    if (!hasPlus && clean.length <= 10 && clean.startsWith('3')) {
        clean = '39' + clean;
    }
    return clean;
}

/**
 * Estrae le impostazioni di trasformazione dell'immagine dall'URL (hash fragment)
 */
function parseImageTransform(url) {
    const defaults = { zoom: 1.2, x: 0, y: 0 };
    if (!url) return defaults;
    try {
        const hashIndex = url.indexOf('#');
        if (hashIndex === -1) return defaults;
        const hash = url.substring(hashIndex + 1);
        const params = new URLSearchParams(hash);
        if (params.has('zoom') || params.has('x') || params.has('y')) {
            return {
                zoom: parseFloat(params.get('zoom')) || 1.2,
                x: parseFloat(params.get('x')) || 0,
                y: parseFloat(params.get('y')) || 0
            };
        }
    } catch (e) {
        console.error("Error parsing image transform:", e);
    }
    return defaults;
}

/**
 * Costruisce l'URL dell'immagine includendo le trasformazioni nell'hash fragment
 */
function buildImageUrlWithTransform(url, zoom, x, y) {
    if (!url) return "";
    const baseUrl = url.split('#')[0];
    if (zoom === 1.0 && x === 0 && y === 0) {
        return baseUrl;
    }
    return `${baseUrl}#zoom=${zoom}&x=${x}&y=${y}`;
}

/**
 * Aggiorna l'editor di immagini e la card di anteprima real-time
 */
function aggiornaEditorImmagine() {
    const zoom = parseFloat(document.getElementById('editor-zoom')?.value) || 1.2;
    const x = parseFloat(document.getElementById('editor-x')?.value) || 0;
    const y = parseFloat(document.getElementById('editor-y')?.value) || 0;
    
    // Aggiorna le etichette degli slider
    const lblZoom = document.getElementById('label-editor-zoom');
    const lblX = document.getElementById('label-editor-x');
    const lblY = document.getElementById('label-editor-y');
    if (lblZoom) lblZoom.innerText = zoom.toFixed(2) + 'x';
    if (lblX) lblX.innerText = x + '%';
    if (lblY) lblY.innerText = y + '%';
    
    // Aggiorna immagine dell'anteprima card
    const previewImg = document.getElementById('preview-card-img');
    const imgUrlInput = document.getElementById('form-immagine')?.value || "";
    if (previewImg) {
        previewImg.src = imgUrlInput || "https://placehold.co/240x240/eaeef3/1e293b?text=Nessuna+Immagine";
        previewImg.style.transform = `scale(${zoom}) translate(${x}%, ${y}%)`;
    }
    
    // Aggiorna testi dell'anteprima card
    const squad = document.getElementById('form-squadra')?.value || "Nome Squadra";
    const cat = document.getElementById('form-categoria')?.value || "Kit";
    const stag = document.getElementById('form-stagione')?.value || "2024/2025";
    const selectVer = document.getElementById('form-versione-select')?.value || "Home";
    const inputVer = document.getElementById('form-versione')?.value || "";
    const ver = selectVer === "custom" ? inputVer : selectVer;
    const prezzo = parseFloat(document.getElementById('form-prezzo')?.value) || 23.99;
    
    const previewTitle = document.getElementById('preview-card-title');
    const previewTag = document.getElementById('preview-card-tag');
    const previewPrice = document.getElementById('preview-card-price');
    const previewBadge = document.getElementById('preview-badge-tipo');
    
    if (previewTitle) previewTitle.innerText = squad;
    if (previewTag) previewTag.innerText = `${ver} ${stag}`;
    if (previewPrice) previewPrice.innerText = prezzo.toFixed(2).replace('.', ',') + '€';
    if (previewBadge) previewBadge.innerText = cat;
}

/**
 * Ripristina zoom e posizione ai valori predefiniti
 */
function ripristinaImmagine() {
    const zoomSlider = document.getElementById('editor-zoom');
    const xSlider = document.getElementById('editor-x');
    const ySlider = document.getElementById('editor-y');
    if (zoomSlider) zoomSlider.value = 1.2;
    if (xSlider) xSlider.value = 0;
    if (ySlider) ySlider.value = 0;
    aggiornaEditorImmagine();
}

/**
 * Apre l'anteprima della pagina prodotto cliente (stile sito pubblico)
 */
function apriAnteprimaSito() {
    const squad = document.getElementById('form-squadra')?.value || "Nome Squadra";
    const cat = document.getElementById('form-categoria')?.value || "Kit";
    const stag = document.getElementById('form-stagione')?.value || "2024/2025";
    const selectVer = document.getElementById('form-versione-select')?.value || "Home";
    const inputVer = document.getElementById('form-versione')?.value || "";
    const ver = selectVer === "custom" ? inputVer : selectVer;
    const prezzo = parseFloat(document.getElementById('form-prezzo')?.value) || 23.99;
    const imgUrl = document.getElementById('form-immagine')?.value || "";
    
    const zoom = parseFloat(document.getElementById('editor-zoom')?.value) || 1.2;
    const x = parseFloat(document.getElementById('editor-x')?.value) || 0;
    const y = parseFloat(document.getElementById('editor-y')?.value) || 0;
    
    const dImg = document.getElementById('detail-preview-img');
    const dBadge = document.getElementById('detail-preview-badge');
    const dTitle = document.getElementById('detail-preview-title');
    const dSubtitle = document.getElementById('detail-preview-subtitle');
    const dPrice = document.getElementById('detail-preview-price');
    
    if (dImg) {
        dImg.src = imgUrl || "https://placehold.co/240x240/eaeef3/1e293b?text=Nessuna+Immagine";
        dImg.style.transform = `scale(${zoom}) translate(${x}%, ${y}%)`;
    }
    if (dBadge) dBadge.innerText = cat;
    if (dTitle) dTitle.innerText = squad;
    if (dSubtitle) dSubtitle.innerText = `Versione ${ver} - Stagione ${stag}`;
    if (dPrice) dPrice.innerText = prezzo.toFixed(2).replace('.', ',') + ' €';
    
    // Mostra il modal di anteprima della pagina prodotto
    const modal = document.getElementById('site-product-preview-modal');
    const container = document.getElementById('product-preview-container');
    if (modal && container) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            container.classList.remove('scale-95', 'opacity-0');
            container.classList.add('scale-100', 'opacity-100');
        }, 10);
    }
}

/**
 * Chiude l'anteprima della pagina prodotto cliente
 */
function closeProductPreviewModal() {
    const modal = document.getElementById('site-product-preview-modal');
    const container = document.getElementById('product-preview-container');
    if (modal && container) {
        container.classList.remove('scale-100', 'opacity-100');
        container.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 200);
    }
}

// Esposizione globale delle nuove funzioni utili
window.normalizzaNumeroWhatsApp = normalizzaNumeroWhatsApp;
window.parseImageTransform = parseImageTransform;
window.buildImageUrlWithTransform = buildImageUrlWithTransform;
window.aggiornaEditorImmagine = aggiornaEditorImmagine;
window.ripristinaImmagine = ripristinaImmagine;
window.apriAnteprimaSito = apriAnteprimaSito;
window.closeProductPreviewModal = closeProductPreviewModal;

function eliminaProdottiNonConfigurati() {
    console.log("[FRONTEND DEBUG] Click sul pulsante 'Elimina Non Configurati'.");
    const modal = document.getElementById('delete-unconfigured-confirm-modal');
    const container = document.getElementById('delete-unconfigured-modal-container');
    if (modal && container) {
        console.log("[FRONTEND DEBUG] Apertura modal di conferma.");
        modal.classList.remove('hidden');
        setTimeout(() => {
            container.classList.remove('scale-95', 'opacity-0');
            container.classList.add('scale-100', 'opacity-100');
        }, 10);
    } else {
        console.error("[FRONTEND DEBUG] Elementi modal non trovati nel DOM!");
    }
}

function closeDeleteUnconfiguredConfirmModal() {
    console.log("[FRONTEND DEBUG] Chiusura modal di conferma.");
    const modal = document.getElementById('delete-unconfigured-confirm-modal');
    const container = document.getElementById('delete-unconfigured-modal-container');
    if (modal && container) {
        container.classList.remove('scale-100', 'opacity-100');
        container.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 200);
    }
}

async function confermaEliminaProdottiNonConfigurati() {
    console.log("[FRONTEND DEBUG] Conferma ricevuta dall'utente. Avvio fetch...");
    closeDeleteUnconfiguredConfirmModal();

    try {
        showToast("Eliminazione massiva in corso...", "info");
        console.log("[FRONTEND DEBUG] Invio richiesta DELETE a /api/products/bulk/delete_unconfigured");
        
        const res = await fetch('/api/products/bulk/delete_unconfigured', {
            method: 'DELETE'
        });
        
        console.log("[FRONTEND DEBUG] Risposta ricevuta dal server. Status:", res.status);
        const data = await res.json();
        console.log("[FRONTEND DEBUG] Dati di risposta decodificati:", data);
        
        if (data && data.success) {
            showToast(`Pulizia completata! Eliminati ${data.deletedCount} prodotti non configurati.`, "success");
            // Ricarica tutti i dati del catalogo automaticamente
            console.log("[FRONTEND DEBUG] Ricaricamento dei dati del catalogo in corso...");
            await caricaDati();
            console.log("[FRONTEND DEBUG] Catalogo aggiornato con successo.");
        } else {
            showToast("Errore durante l'eliminazione: " + (data.error || "errore sconosciuto"), "error");
            console.error("[FRONTEND DEBUG] Errore segnalato dal server:", data.error);
        }
    } catch (err) {
        console.error("[FRONTEND DEBUG] Errore di rete o eccezione durante l'eliminazione massiva:", err);
        showToast("Errore di connessione.", "error");
    }
}

window.eliminaProdottiNonConfigurati = eliminaProdottiNonConfigurati;
window.closeDeleteUnconfiguredConfirmModal = closeDeleteUnconfiguredConfirmModal;
window.confermaEliminaProdottiNonConfigurati = confermaEliminaProdottiNonConfigurati;

async function avviaTraduzioneMassiva() {
    console.log("[FRONTEND DEBUG] Avvio della traduzione massiva.");
    const btn = document.getElementById('btn-mass-translate');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span>⏳</span> Traduzione in corso...`;
    }

    try {
        showToast("Traduzione e normalizzazione globale del catalogo in corso...", "info");
        const res = await fetch('/api/settings/products/translate_all', {
            method: 'POST'
        });
        const data = await res.json();
        
        if (data && data.success) {
            showToast("Traduzione massiva completata con successo!", "success");
            
            // Popola le statistiche
            document.getElementById('trans-analizzati').innerText = data.stats.analyzed;
            document.getElementById('trans-aggiornati').innerText = data.stats.updated;
            document.getElementById('trans-invariati').innerText = data.stats.unchanged;
            
            // Popola i log delle traduzioni
            const logList = document.getElementById('trans-log-list');
            if (logList) {
                if (data.logs && data.logs.length > 0) {
                    logList.innerHTML = data.logs.map(log => `
                        <div class="py-2 text-xs">
                            <div class="font-bold text-slate-800">ID #${log.id}</div>
                            <div class="flex items-center gap-2 mt-1">
                                <span class="px-1.5 py-0.5 bg-red-50 text-red-700 rounded border border-red-100 line-through truncate max-w-[200px]" title="${log.original_versione}">${log.original_versione}</span>
                                <span class="text-slate-400">➡️</span>
                                <span class="px-1.5 py-0.5 bg-green-50 text-green-700 rounded border border-green-100 font-bold truncate max-w-[200px]" title="${log.translated_versione}">${log.translated_versione}</span>
                            </div>
                        </div>
                    `).join('');
                } else {
                    logList.innerHTML = `<div class="text-slate-400 text-center py-4">Tutti i prodotti erano già perfettamente tradotti e normalizzati!</div>`;
                }
            }

            // Mostra il modal
            const modal = document.getElementById('translation-results-modal');
            const container = document.getElementById('translation-modal-container');
            if (modal && container) {
                modal.classList.remove('hidden');
                setTimeout(() => {
                    container.classList.remove('scale-95', 'opacity-0');
                    container.classList.add('scale-100', 'opacity-100');
                }, 10);
            }
        } else {
            showToast("Errore durante la traduzione: " + (data.error || "errore sconosciuto"), "error");
        }
    } catch (err) {
        console.error("Errore durante la traduzione massiva:", err);
        showToast("Errore di connessione.", "error");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<span>🌍</span> Traduci Catalogo Esistente`;
        }
    }
}

function closeTranslationResultsModal() {
    console.log("[FRONTEND DEBUG] Chiusura modal risultati traduzione.");
    const modal = document.getElementById('translation-results-modal');
    const container = document.getElementById('translation-modal-container');
    if (modal && container) {
        container.classList.remove('scale-100', 'opacity-100');
        container.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
            // Ricarica tutti i dati del catalogo automaticamente
            caricaDati();
        }, 200);
    }
}

window.avviaTraduzioneMassiva = avviaTraduzioneMassiva;
window.closeTranslationResultsModal = closeTranslationResultsModal;

function mostraProgressoImportazione(titolo, info, percentuale, fileCountString) {
    const modal = document.getElementById('import-progress-modal');
    const titleEl = document.getElementById('progress-title');
    const infoEl = document.getElementById('progress-file-info');
    const fillEl = document.getElementById('progress-bar-fill');
    const pctEl = document.getElementById('progress-percentage');
    const countEl = document.getElementById('progress-file-count');

    if (modal) modal.classList.remove('hidden');
    if (titleEl) titleEl.innerText = titolo;
    if (infoEl) infoEl.innerText = info;
    if (fillEl) fillEl.style.width = `${percentuale}%`;
    if (pctEl) pctEl.innerText = `${percentuale}%`;
    if (countEl) countEl.innerText = fileCountString || '';
}

function nascondiProgressoImportazione() {
    const modal = document.getElementById('import-progress-modal');
    if (modal) modal.classList.add('hidden');
}

window.mostraProgressoImportazione = mostraProgressoImportazione;
window.nascondiProgressoImportazione = nascondiProgressoImportazione;

// =========================================================================
// MODULO GESTIONE AVANZATA AMMINISTRATIVA (MAGLIA D'ORO ADMIN EXTENSION)
// =========================================================================

window.gestioneOrdiniList = [];

// 1. GESTIONE ORDINI
async function caricaGestioneOrdini() {
    try {
        const response = await fetch('/api/admin/gestione-ordini');
        if (response.ok) {
            const data = await response.json();
            if (data && data.success) {
                window.gestioneOrdiniList = data.orders || [];
                renderGestioneOrdini();
            }
        }
    } catch (err) {
        console.error("⚠️ Errore caricamento gestione ordini:", err);
    }
}

function renderGestioneOrdini() {
    const tbody = document.getElementById('gestione-ordini-table-body');
    if (!tbody) return;

    // Recupera filtri
    const searchVal = (document.getElementById('gestione-ordini-search')?.value || '').toLowerCase().trim();
    const filterPagamento = document.getElementById('gestione-ordini-filter-pagamento')?.value || 'all';
    const filterSpedizione = document.getElementById('gestione-ordini-filter-spedizione')?.value || 'all';
    const filterDataInizio = document.getElementById('gestione-ordini-filter-data-inizio')?.value || '';
    const filterDataFine = document.getElementById('gestione-ordini-filter-data-fine')?.value || '';

    let filtrate = [...window.gestioneOrdiniList];

    // Applica Ricerca
    if (searchVal) {
        filtrate = filtrate.filter(ord => {
            const matchId = String(ord.id).includes(searchVal);
            const matchNome = (ord.nome || '').toLowerCase().includes(searchVal);
            const matchTel = (ord.telefono || '').toLowerCase().includes(searchVal);
            const matchMail = (ord.email || '').toLowerCase().includes(searchVal);
            return matchId || matchNome || matchTel || matchMail;
        });
    }

    // Applica Filtro Pagamento
    if (filterPagamento !== 'all') {
        filtrate = filtrate.filter(ord => ord.payment_status === filterPagamento);
    }

    // Applica Filtro Spedizione
    if (filterSpedizione !== 'all') {
        filtrate = filtrate.filter(ord => ord.status === filterSpedizione);
    }

    // Applica Filtro Date
    if (filterDataInizio) {
        const dInizio = new Date(filterDataInizio);
        filtrate = filtrate.filter(ord => new Date(ord.created_at || ord.data) >= dInizio);
    }
    if (filterDataFine) {
        const dFine = new Date(filterDataFine);
        dFine.setHours(23, 59, 59, 999);
        filtrate = filtrate.filter(ord => new Date(ord.created_at || ord.data) <= dFine);
    }

    if (filtrate.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-10 text-center text-slate-400 text-xs font-medium">
                    Nessun ordine trovato con i criteri di ricerca correnti.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtrate.map(ord => {
        const normSt = String(ord.status || '').trim().toLowerCase();
        const isAnnullato = normSt === 'annullato_dal_cliente' || normSt === 'annullato dal cliente' || normSt === 'annullato';

        let pagClass = "bg-rose-50 text-rose-700 border-rose-200/50";
        if (ord.payment_status === 'Pagato') pagClass = "bg-emerald-50 text-emerald-700 border-emerald-200/50";
        else if (ord.payment_status === 'Rimborso') pagClass = "bg-amber-50 text-amber-700 border-amber-200/50";

        let dateObj = null;
        if (ord.created_at) {
            dateObj = new Date(ord.created_at);
        } else if (ord.data) {
            const parts = ord.data.split('/');
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const yearParts = parts[2].split(',');
                const year = parseInt(yearParts[0], 10);
                dateObj = new Date(year, month, day);
            } else {
                dateObj = new Date(ord.data);
            }
        }
        if (!dateObj || isNaN(dateObj.getTime())) {
            dateObj = new Date();
        }

        const formattedDate = dateObj.toLocaleDateString('it-IT', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        const isRegistrato = !!ord.user_id;
        const displayName = ord.registered_name || ord.nome || 'N/D';
        const clientBadge = isRegistrato
            ? `<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-bold text-[8px] uppercase tracking-wider"><span>👤</span> Registrato</span>`
            : `<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-md font-bold text-[8px] uppercase tracking-wider">Ospite</span>`;

        return `
            <tr class="hover:bg-slate-50/50 transition-colors ${isAnnullato ? 'bg-rose-50/30' : ''}">
                <!-- 1. ORDINE -->
                <td class="px-5 py-4">
                    <div class="flex flex-col">
                        <span class="text-xs font-bold text-slate-900 font-mono">#${ord.id}</span>
                        <span class="text-[10px] text-slate-400 font-mono">${formattedDate}</span>
                        ${isAnnullato ? `<span class="mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300 uppercase tracking-wider w-fit">🚫 Annullato dal Cliente</span>` : ''}
                    </div>
                </td>
                <!-- 2. CLIENTE -->
                <td class="px-5 py-4">
                    <div class="flex flex-col">
                        <span class="text-xs font-bold text-slate-800">${displayName}</span>
                        <div class="flex items-center gap-1.5 mt-0.5">
                            <span class="text-[10px] text-slate-400 font-mono">${ord.telefono || 'N/D'}</span>
                            ${clientBadge}
                        </div>
                    </div>
                </td>
                <!-- 3. LOTTO -->
                <td class="px-5 py-4 text-xs font-bold">
                    ${isAnnullato
                        ? `<span class="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200/60 rounded-md text-[10px] uppercase font-bold tracking-wider">Annullato</span>`
                        : (ord.lotto_id 
                            ? `<span class="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200/60 rounded-md text-[10px] uppercase font-bold tracking-wider">Lotto #${ord.lotto_id}</span>`
                            : `<span class="px-2 py-0.5 bg-slate-100 text-slate-400 border border-slate-200/60 rounded-md text-[10px] uppercase font-bold tracking-wider">Da assegnare</span>`
                          )
                    }
                </td>
                <!-- 4. SITUAZIONE ECONOMICA -->
                <td class="px-5 py-4">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-xs font-black text-slate-950 font-mono">€${Number(ord.totale).toFixed(2).replace('.', ',')}</span>
                        <span class="px-2 py-0.5 text-[9px] font-extrabold rounded-md border ${pagClass}">
                            ${ord.payment_status}
                        </span>
                        ${isAnnullato ? `<span class="px-2 py-0.5 text-[9px] font-extrabold rounded-md bg-rose-100 text-rose-800 border border-rose-300 uppercase">Annullato</span>` : ''}
                    </div>
                </td>
                <!-- 5. AZIONI -->
                <td class="px-5 py-4 text-right">
                    <button onclick="apriGestioneOrdineModal(${ord.id})" class="px-3 py-1.5 bg-brand-gold text-slate-950 hover:bg-brand-gold/90 font-bold text-[10px] rounded-lg transition-all shadow-sm">
                        ⚙️ Gestisci
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Aggancia eventi per i filtri di Gestione Ordini
document.getElementById('gestione-ordini-search')?.addEventListener('input', renderGestioneOrdini);
document.getElementById('gestione-ordini-filter-pagamento')?.addEventListener('change', renderGestioneOrdini);
document.getElementById('gestione-ordini-filter-spedizione')?.addEventListener('change', renderGestioneOrdini);
document.getElementById('gestione-ordini-filter-data-inizio')?.addEventListener('change', renderGestioneOrdini);
document.getElementById('gestione-ordini-filter-data-fine')?.addEventListener('change', renderGestioneOrdini);

// MODAL GESTIONE ORDINE SINGOLO
window.currentGestioneOrderId = null;
window.currentOrdineProdotti = [];
window.currentEconomicSummary = {};

function ricostruisciCarrelloDaStringheLocal(order) {
    const items = [];
    const squadre = (order.squadra || "").split(' / ');
    const taglie = (order.taglia || "").split(' / ');
    const personalizzazioni = (order.personalizzazione || "").split(' | ');

    squadre.forEach((sq, idx) => {
        if (!sq.trim()) return;
        if (sq.toLowerCase().includes('spedizione')) return; // ignora spedizione!
        
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

        const totaleEuro = parseFloat(String(order.totale).replace(',', '.'));
        const prezzoDiviso = isNaN(totaleEuro) ? 23.99 : (totaleEuro / squadre.length);

        items.push({
            squadra: nomeProdotto,
            categoria: "Casa",
            stagione: "2026/2027",
            versione: "",
            target: "Adulto",
            taglia: tagliaStr,
            infoPerso: persStr,
            quantita: quantita,
            prezzo: prezzoDiviso,
            prezzo_fornitore: 14.50
        });
    });

    return items;
}

async function apriGestioneOrdineModal(id) {
    window.currentGestioneOrderId = id;
    const ord = window.gestioneOrdiniList.find(o => Number(o.id) === Number(id));
    if (!ord) return;

    // Valorizza campi form nel modal
    const inputEmail = document.getElementById('gestione-ordine-cliente-email');
    const selectPagamento = document.getElementById('gestione-ordine-payment-status');
    const inputNotes = document.getElementById('gestione-ordine-notes');
    
    if (inputEmail) inputEmail.value = ord.email || '';
    if (selectPagamento) selectPagamento.value = ord.payment_status || 'Da pagare';
    if (inputNotes) inputNotes.value = ord.notes || '';

    // Lotto Associato dropdown population
    const selectLotto = document.getElementById('gestione-ordine-lotto-id');
    if (selectLotto) {
        selectLotto.innerHTML = '<option value="">Da assegnare</option>';
        const lottiMap = new Map();
        
        // Add existing archived/historical lotti
        if (Array.isArray(cronologiaLotti)) {
            cronologiaLotti.forEach(l => {
                if (l && l.id) {
                    lottiMap.set(Number(l.id), l.numero_lotto || `Lotto #${l.id}`);
                }
            });
        }
        
        // Add currently assigned lotto_id if present
        if (ord.lotto_id) {
            lottiMap.set(Number(ord.lotto_id), `Lotto #${ord.lotto_id}`);
        }
        
        // Fetch active lotto
        try {
            fetch('/api/lotto')
                .then(r => r.json())
                .then(data => {
                    if (data && data.success && data.lotto && data.lotto.id) {
                        const activeLottoId = Number(data.lotto.id);
                        if (!lottiMap.has(activeLottoId)) {
                            lottiMap.set(activeLottoId, `Lotto #${activeLottoId} (Corrente)`);
                        }
                    }
                    
                    lottiMap.forEach((name, id) => {
                        const opt = document.createElement('option');
                        opt.value = id;
                        opt.innerText = name;
                        if (Number(ord.lotto_id) === Number(id)) {
                            opt.selected = true;
                        }
                        selectLotto.appendChild(opt);
                    });
                })
                .catch(e => {
                    console.warn("Impossibile caricare lotto attivo per select:", e);
                    lottiMap.forEach((name, id) => {
                        const opt = document.createElement('option');
                        opt.value = id;
                        opt.innerText = name;
                        if (Number(ord.lotto_id) === Number(id)) {
                            opt.selected = true;
                        }
                        selectLotto.appendChild(opt);
                    });
                });
        } catch (e) {
            lottiMap.forEach((name, id) => {
                const opt = document.createElement('option');
                opt.value = id;
                opt.innerText = name;
                if (Number(ord.lotto_id) === Number(id)) {
                    opt.selected = true;
                }
                selectLotto.appendChild(opt);
            });
        }
    }

    // Dettagli header e pannello cliente
    const ordIdEl = document.getElementById('gestione-ordine-id');
    const cliEl = document.getElementById('gestione-ordine-cliente-nome');
    const telEl = document.getElementById('gestione-ordine-cliente-telefono');
    const indEl = document.getElementById('gestione-ordine-cliente-indirizzo');
    
    if (ordIdEl) ordIdEl.innerText = `#${ord.id}`;
    
    // Gestione visualizzazione Nome e Cognome in base a registrazione
    const isRegistrato = !!ord.user_id;
    const badgePlaceholder = document.getElementById('gestione-ordine-cliente-badge-placeholder');
    if (badgePlaceholder) {
        badgePlaceholder.innerHTML = isRegistrato
            ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 text-[10px] font-black rounded-lg uppercase tracking-wider">👤 Registrato</span>`
            : `<span class="inline-flex items-center gap-1 px-2.5 py-1 bg-[#0B0B0B] text-[rgba(255,255,255,0.65)] border border-[rgba(255,255,255,0.08)] text-[10px] font-bold rounded-lg uppercase tracking-wider">Ospite</span>`;
    }

    const displayName = ord.registered_name || ord.nome || 'N/D';
    if (cliEl) cliEl.innerText = displayName;
    if (telEl) telEl.innerText = ord.telefono || 'N/D';
    if (indEl) indEl.innerText = ord.indirizzo || 'Indirizzo di Spedizione Premium registrato';

    // Aggiorna box informazioni Coupon se presente
    const couponBox = document.getElementById('gestione-ordine-coupon-box');
    const couponCodeEl = document.getElementById('gestione-ordine-coupon-code');
    const couponDiscountEl = document.getElementById('gestione-ordine-coupon-discount');
    if (couponBox) {
        const cCode = ord.coupon_code || '';
        const cDiscount = (ord.coupon_discount !== undefined && ord.coupon_discount !== null) ? Number(ord.coupon_discount) : 0;
        if (cCode || cDiscount > 0) {
            if (couponCodeEl) couponCodeEl.innerText = cCode || 'SCONTO';
            if (couponDiscountEl) couponDiscountEl.innerText = `-€${cDiscount.toFixed(2).replace('.', ',')}`;
            couponBox.classList.remove('hidden');
        } else {
            couponBox.classList.add('hidden');
        }
    }

    // Prepariamo l'elenco dei prodotti copiandolo localmente per consentire editing temporaneo
    window.currentOrdineProdotti = [];
    if (Array.isArray(ord.carrello)) {
        window.currentOrdineProdotti = JSON.parse(JSON.stringify(ord.carrello));
    } else if (typeof ord.carrello === 'string' && ord.carrello.trim()) {
        try {
            window.currentOrdineProdotti = JSON.parse(ord.carrello);
        } catch (e) {
            console.error("⚠️ Errore parsing carrello:", e);
        }
    }

    if (window.currentOrdineProdotti.length === 0) {
        window.currentOrdineProdotti = ricostruisciCarrelloDaStringheLocal(ord);
    }

    // Assicuriamo che ogni articolo abbia un prezzo_fornitore valido
    window.currentOrdineProdotti.forEach(item => {
        if (item.prezzo_fornitore === undefined || item.prezzo_fornitore === null) {
            const p = (prodotti || []).find(p => String(p.id) === String(item.id) || (item.legacy_id && String(p.legacy_id) === String(item.legacy_id)));
            item.prezzo_fornitore = p && p.prezzo_fornitore !== undefined ? p.prezzo_fornitore : 14.50;
        }
    });

    // Renderizza i prodotti modificabili e ricalcola i dati economici
    renderProdottiModificabili();

    // Renderizza l'Audit Log storico interno dell'ordine
    const auditContainer = document.getElementById('gestione-ordine-audit-log');
    if (auditContainer) {
        const audit = ord.audit_log || [];
        if (audit.length === 0) {
            auditContainer.innerHTML = `<div class="text-xs text-[rgba(255,255,255,0.65)] py-2">Nessun log registrato.</div>`;
        } else {
            auditContainer.innerHTML = audit.map(log => `
                <div class="flex items-start gap-2 text-[11px] leading-relaxed border-b border-[rgba(255,255,255,0.08)] pb-2 last:border-0 last:pb-0">
                    <span class="text-[rgba(255,255,255,0.5)] font-mono flex-shrink-0">${log.time}</span>
                    <div class="flex flex-col">
                        <strong class="text-white font-semibold">${log.action}</strong>
                        <span class="text-[rgba(255,255,255,0.65)]">${log.description}</span>
                    </div>
                </div>
            `).join('');
        }
    }

    // Mostra il modal con animazione premium
    const modal = document.getElementById('gestione-ordine-modal');
    const container = document.getElementById('gestione-ordine-modal-container');
    if (modal && container) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            container.classList.remove('scale-95', 'opacity-0');
            container.classList.add('scale-100', 'opacity-100');
        }, 10);
    }
}

function chiudiGestioneOrdineModal() {
    const modal = document.getElementById('gestione-ordine-modal');
    const container = document.getElementById('gestione-ordine-modal-container');
    if (modal && container) {
        container.classList.remove('scale-100', 'opacity-100');
        container.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
            window.currentGestioneOrderId = null;
            window.currentOrdineProdotti = [];
            window.currentEconomicSummary = {};
        }, 200);
    }
}

function renderProdottiModificabili() {
    const container = document.getElementById('gestione-ordine-prodotti-list');
    if (!container) return;

    if (window.currentOrdineProdotti.length === 0) {
        container.innerHTML = `
            <div class="text-center py-6 bg-[#0B0B0B] border border-dashed border-[rgba(255,255,255,0.08)] rounded-2xl text-xs text-[rgba(255,255,255,0.65)] font-medium">
                Nessun articolo presente in questo ordine. Aggiungine uno usando il pannello qui sotto.
            </div>
        `;
        calcolaESituazioneEconomica();
        return;
    }

    container.innerHTML = window.currentOrdineProdotti.map((item, idx) => {
        const squadra = item.squadra || item.nome || '';
        const categoria = item.categoria || 'Casa';
        const stagione = item.stagione || '2026/2027';
        const versione = item.versione || '';
        const target = item.target || 'Adulto';
        const taglia = item.taglia || 'M';
        const quantita = item.quantita || 1;
        const infoPerso = item.infoPerso || item.personalizzazione || 'No';
        const prezzo = parseFloat(item.prezzo) || 23.99;
        const prezzoForn = parseFloat(item.prezzo_fornitore) || 14.50;

        return `
            <div class="bg-[#111111] border border-[rgba(255,255,255,0.08)] p-4 rounded-xl space-y-3 relative shadow-sm">
                <!-- Delete Button -->
                <button onclick="gestioneEliminaProdotto(${idx})" class="absolute top-3 right-3 text-red-400 hover:text-red-300 font-black text-xs transition-colors p-1 bg-red-950/20 hover:bg-red-900/40 border border-red-900/30 rounded-lg" title="Elimina prodotto">
                    🗑 Elimina Prodotto
                </button>

                <!-- Righe del Prodotto -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                    <div class="md:col-span-2">
                        <label class="text-[9px] font-bold text-[rgba(255,255,255,0.65)] uppercase tracking-wide block mb-0.5">Nome Prodotto / Squadra</label>
                        <input type="text" value="${squadra}" oninput="aggiornaDatoProdottoSingolo(${idx}, 'squadra', this.value)" class="w-full p-2 border border-[rgba(255,255,255,0.08)] rounded-lg focus:outline-none focus:border-brand-gold font-bold text-white bg-[#0B0B0B]">
                    </div>
                    <div>
                        <label class="text-[9px] font-bold text-[rgba(255,255,255,0.65)] uppercase tracking-wide block mb-0.5">Categoria</label>
                        <select onchange="aggiornaDatoProdottoSingolo(${idx}, 'categoria', this.value)" class="w-full p-2 border border-[rgba(255,255,255,0.08)] rounded-lg focus:outline-none focus:border-brand-gold font-bold text-white bg-[#0B0B0B]">
                            <option value="Casa" ${categoria === 'Casa' ? 'selected' : ''}>Casa</option>
                            <option value="Trasferta" ${categoria === 'Trasferta' ? 'selected' : ''}>Trasferta</option>
                            <option value="Terza" ${categoria === 'Terza' ? 'selected' : ''}>Terza</option>
                            <option value="Special" ${categoria === 'Special' ? 'selected' : ''}>Special</option>
                            <option value="Retro" ${categoria === 'Retro' ? 'selected' : ''}>Retro</option>
                            <option value="Kit" ${categoria === 'Kit' ? 'selected' : ''}>Kit</option>
                            <option value="Tuta" ${categoria === 'Tuta' ? 'selected' : ''}>Tuta</option>
                            <option value="Giacca" ${categoria === 'Giacca' ? 'selected' : ''}>Giacca</option>
                            <option value="Allenamento" ${categoria === 'Allenamento' ? 'selected' : ''}>Allenamento</option>
                            <option value="Accessori" ${categoria === 'Accessori' ? 'selected' : ''}>Accessori</option>
                            <option value="Altro" ${categoria === 'Altro' ? 'selected' : ''}>Altro</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-[9px] font-bold text-[rgba(255,255,255,0.65)] uppercase tracking-wide block mb-0.5">Stagione</label>
                        <input type="text" value="${stagione}" oninput="aggiornaDatoProdottoSingolo(${idx}, 'stagione', this.value)" class="w-full p-2 border border-[rgba(255,255,255,0.08)] rounded-lg focus:outline-none focus:border-brand-gold font-bold text-white bg-[#0B0B0B]">
                    </div>
                    <div>
                        <label class="text-[9px] font-bold text-[rgba(255,255,255,0.65)] uppercase tracking-wide block mb-0.5">Versione</label>
                        <input type="text" value="${versione}" oninput="aggiornaDatoProdottoSingolo(${idx}, 'versione', this.value)" class="w-full p-2 border border-[rgba(255,255,255,0.08)] rounded-lg focus:outline-none focus:border-brand-gold font-bold text-white bg-[#0B0B0B]">
                    </div>
                    <div>
                        <label class="text-[9px] font-bold text-[rgba(255,255,255,0.65)] uppercase tracking-wide block mb-0.5">Target</label>
                        <select onchange="aggiornaDatoProdottoSingolo(${idx}, 'target', this.value)" class="w-full p-2 border border-[rgba(255,255,255,0.08)] rounded-lg focus:outline-none focus:border-brand-gold font-bold text-white bg-[#0B0B0B]">
                            <option value="Adulto" ${target === 'Adulto' ? 'selected' : ''}>Adulto</option>
                            <option value="Bambino" ${target === 'Bambino' ? 'selected' : ''}>Bambino</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-[9px] font-bold text-[rgba(255,255,255,0.65)] uppercase tracking-wide block mb-0.5">Taglia</label>
                        <input type="text" value="${taglia}" oninput="aggiornaDatoProdottoSingolo(${idx}, 'taglia', this.value)" class="w-full p-2 border border-[rgba(255,255,255,0.08)] rounded-lg focus:outline-none focus:border-brand-gold font-bold text-white bg-[#0B0B0B]">
                    </div>
                    <div>
                        <label class="text-[9px] font-bold text-[rgba(255,255,255,0.65)] uppercase tracking-wide block mb-0.5">Quantità</label>
                        <input type="number" min="1" value="${quantita}" oninput="aggiornaDatoProdottoSingolo(${idx}, 'quantita', this.value)" class="w-full p-2 border border-[rgba(255,255,255,0.08)] rounded-lg focus:outline-none focus:border-brand-gold font-bold text-white bg-[#0B0B0B] font-mono">
                    </div>
                    <div class="md:col-span-2">
                        <label class="text-[9px] font-bold text-[rgba(255,255,255,0.65)] uppercase tracking-wide block mb-0.5">Personalizzazione</label>
                        <input type="text" value="${infoPerso}" oninput="aggiornaDatoProdottoSingolo(${idx}, 'infoPerso', this.value)" class="w-full p-2 border border-[rgba(255,255,255,0.08)] rounded-lg focus:outline-none focus:border-brand-gold font-bold text-white bg-[#0B0B0B]">
                    </div>
                    <div>
                        <label class="text-[9px] font-bold text-[rgba(255,255,255,0.65)] uppercase tracking-wide block mb-0.5">Prezzo (€)</label>
                        <input type="number" step="0.01" value="${prezzo}" oninput="aggiornaDatoProdottoSingolo(${idx}, 'prezzo', this.value)" class="w-full p-2 border border-[rgba(255,255,255,0.08)] rounded-lg focus:outline-none focus:border-brand-gold font-bold text-white bg-[#0B0B0B] font-mono">
                    </div>
                    <div>
                        <label class="text-[9px] font-bold text-[rgba(255,255,255,0.65)] uppercase tracking-wide block mb-0.5">Prezzo Fornitore ($)</label>
                        <input type="number" step="0.01" value="${prezzoForn}" oninput="aggiornaDatoProdottoSingolo(${idx}, 'prezzo_fornitore', this.value)" class="w-full p-2 border border-[rgba(255,255,255,0.08)] rounded-lg focus:outline-none focus:border-brand-gold font-bold text-white bg-[#0B0B0B] font-mono">
                    </div>
                </div>
            </div>
        `;
    }).join('');

    calcolaESituazioneEconomica();
}

window.aggiornaDatoProdottoSingolo = function(idx, key, value) {
    if (!window.currentOrdineProdotti[idx]) return;
    
    if (key === 'quantita') {
        window.currentOrdineProdotti[idx][key] = parseInt(value, 10) || 1;
    } else if (key === 'prezzo' || key === 'prezzo_fornitore') {
        window.currentOrdineProdotti[idx][key] = parseFloat(value) || 0;
    } else {
        window.currentOrdineProdotti[idx][key] = value;
    }

    calcolaESituazioneEconomica();
};

window.gestioneEliminaProdotto = function(idx) {
    if (confirm("Sei sicuro di voler eliminare questo prodotto dall'ordine?")) {
        window.currentOrdineProdotti.splice(idx, 1);
        showToast("Prodotto rimosso.", "info");
        renderProdottiModificabili();
    }
};

function extractShippingTiersClient(spedizioneLotto) {
    if (!spedizioneLotto || typeof spedizioneLotto !== 'object') {
        return [{ min: 1, max: Infinity, cost: 4.0 }];
    }
    const tiers = [];
    for (let i = 1; i <= 20; i++) {
        const minVal = spedizioneLotto[`range${i}_min`];
        const maxVal = spedizioneLotto[`range${i}_max`];
        const costVal = spedizioneLotto[`range${i}_cost`];
        if (costVal !== undefined && costVal !== null && String(costVal).trim() !== '') {
            const min = (minVal !== undefined && minVal !== null && String(minVal).trim() !== '') ? parseInt(minVal, 10) : 1;
            const max = (maxVal !== undefined && maxVal !== null && String(maxVal).trim() !== '') ? parseInt(maxVal, 10) : Infinity;
            const cost = parseFloat(costVal) || 0.0;
            tiers.push({ min: isNaN(min) ? 1 : min, max: isNaN(max) ? Infinity : max, cost: isNaN(cost) ? 0.0 : cost });
        }
    }
    if (tiers.length === 0) {
        return [{ min: 1, max: Infinity, cost: 4.0 }];
    }
    tiers.sort((a, b) => a.min - b.min);
    return tiers;
}

function getShippingRateByQuantityClient(quantity, settings) {
    const qty = Math.max(0, parseInt(quantity, 10) || 0);
    const tiers = extractShippingTiersClient(settings?.spedizioneLotto);
    for (const tier of tiers) {
        if (qty >= tier.min && qty <= tier.max) {
            return tier.cost;
        }
    }
    return tiers[0]?.cost !== undefined ? tiers[0].cost : 4.0;
}

async function calcolaESituazioneEconomica() {
    let totArticoli = 0;
    let costoProdUSD = 0;
    let totaleOrdineEUR = 0;
    let exchangeRate = 0.92;
    let costoSpedizioneUSD = 0;
    let costoTotaleUSD = 0;
    let costoTotaleEUR = 0;
    let profittoEUR = 0;

    let appSettings = window.appSettings || {};
    try {
        if (!appSettings || !appSettings.cambioValuta) {
            const resSettings = await fetch('/api/settings');
            const setJson = await resSettings.json();
            if (setJson && setJson.success && setJson.settings) {
                appSettings = setJson.settings;
                window.appSettings = appSettings;
            }
        }
    } catch (e) {
        console.warn("Utilizzo parametri locali per calcolo economico:", e);
    }

    if (appSettings?.cambioValuta?.mode === 'manual') {
        exchangeRate = parseFloat(appSettings.cambioValuta.manual_rate) || 0.86;
    } else {
        exchangeRate = parseFloat(appSettings?.cambio_usd_eur) || parseFloat(appSettings?.cambioValuta?.manual_rate) || 0.92;
    }

    let usaDatiOriginali = false;
    if (window.currentGestioneOrderId) {
        const ord = window.gestioneOrdiniList.find(o => Number(o.id) === Number(window.currentGestioneOrderId));
        if (ord) {
            let originalCart = ord.carrello || [];
            if (typeof originalCart === 'string' && originalCart.trim()) {
                try {
                    originalCart = JSON.parse(originalCart);
                } catch(e) {
                    originalCart = [];
                }
            }
            if (!Array.isArray(originalCart) || originalCart.length === 0) {
                if (typeof ricostruisciCarrelloDaStringheLocal === 'function') {
                    originalCart = ricostruisciCarrelloDaStringheLocal(ord);
                }
            }

            const currentCart = window.currentOrdineProdotti || [];
            
            const itemsEqual = (a, b) => {
                const aName = String(a.squadra || a.nome || '').trim().toLowerCase();
                const bName = String(b.squadra || b.nome || '').trim().toLowerCase();
                const aTaglia = String(a.taglia || '').trim().toLowerCase();
                const bTaglia = String(b.taglia || '').trim().toLowerCase();
                const aPers = String(a.personalizzazione || a.infoPerso || '').trim().toLowerCase();
                const bPers = String(b.personalizzazione || b.infoPerso || '').trim().toLowerCase();
                const aPrice = parseFloat(a.prezzo) || 0;
                const bPrice = parseFloat(b.prezzo) || 0;
                const aForn = parseFloat(a.prezzo_fornitore) || 0;
                const bForn = parseFloat(b.prezzo_fornitore) || 0;
                const aQty = parseInt(a.quantita) || 1;
                const bQty = parseInt(b.quantita) || 1;
                
                return aName === bName &&
                       aTaglia === bTaglia &&
                       aPers === bPers &&
                       Math.abs(aPrice - bPrice) < 0.01 &&
                       Math.abs(aForn - bForn) < 0.01 &&
                       aQty === bQty;
            };

            const cartsMatch = Array.isArray(originalCart) && Array.isArray(currentCart) &&
                               originalCart.length === currentCart.length &&
                               currentCart.every((item, idx) => itemsEqual(item, originalCart[idx]));

            if (cartsMatch) {
                usaDatiOriginali = true;
                
                const parseVal = (v) => {
                    if (v === undefined || v === null) return 0;
                    let s = String(v).replace('€', '').replace('$', '').replace(/\s+/g, '').trim();
                    if (s.includes(',') && s.includes('.')) {
                        s = s.replace(/\./g, '').replace(',', '.');
                    } else if (s.includes(',')) {
                        s = s.replace(',', '.');
                    }
                    return parseFloat(s) || 0;
                };
                
                costoProdUSD = parseVal(ord.costo_prodotti_usd || ord["Costo prodotti (USD)"]);
                costoSpedizioneUSD = parseVal(ord.costo_spedizione_usd || ord["Costo spedizione (USD)"]);
                costoTotaleUSD = parseVal(ord.costo_totale_usd || ord["Costo totale (USD)"]);
                exchangeRate = parseVal(ord.cambio_usd_eur || ord["Cambio USD/EUR"]) || exchangeRate;
                costoTotaleEUR = parseVal(ord.costo_totale_eur || ord["Costo totale (EUR)"] || ord["Costo Fornitore (EUR)"]);
                profittoEUR = parseVal(ord.profitto_eur || ord["Profitto (EUR)"]);
                totaleOrdineEUR = parseVal(ord.totale);
                
                if (costoProdUSD === 0 && costoTotaleUSD === 0 && totaleOrdineEUR === 0) {
                    usaDatiOriginali = false;
                }
            }
        }
    }

    if (!usaDatiOriginali) {
        window.currentOrdineProdotti.forEach(prod => {
            const q = parseInt(prod.quantita, 10) || 1;
            totArticoli += q;
            const pUSD = parseFloat(prod.prezzo_fornitore) || 14.50;
            costoProdUSD += (pUSD * q);
            const pEUR = parseFloat(prod.prezzo) || 23.99;
            totaleOrdineEUR += (pEUR * q);
        });

        // Calcolo spedizione unitaria dinamica per articolo basata sulla quantità totale del lotto corrente
        const activeOrders = Array.isArray(ordini) ? ordini.filter(isOrderActive) : [];
        let totalLotArticles = activeOrders.reduce((sum, o) => sum + estraiNumeroArticoli(o), 0);
        if (totalLotArticles <= 0) totalLotArticles = totArticoli;
        const spedizioneUnitaria = getShippingRateByQuantityClient(totalLotArticles, appSettings);

        costoSpedizioneUSD = Number((totArticoli * spedizioneUnitaria).toFixed(2));
        costoTotaleUSD = Number((costoProdUSD + costoSpedizioneUSD).toFixed(2));
        costoTotaleEUR = Number((costoTotaleUSD * exchangeRate).toFixed(2));
        profittoEUR = Number((totaleOrdineEUR - costoTotaleEUR).toFixed(2));
    }

    // Aggiorna elementi dell'interfaccia
    const totOrdEl = document.getElementById('eco-totale-ordine-eur');
    const costProdEl = document.getElementById('eco-costo-prodotti-usd');
    const costSpedEl = document.getElementById('eco-costo-spedizione-usd');
    const costTotUSDEl = document.getElementById('eco-costo-totale-usd');
    const rateEl = document.getElementById('eco-tasso-cambio');
    const costTotEUREl = document.getElementById('eco-costo-totale-eur');
    const profitEl = document.getElementById('eco-profitto-eur');

    if (totOrdEl) totOrdEl.innerText = `€${totaleOrdineEUR.toFixed(2).replace('.', ',')}`;
    if (costProdEl) costProdEl.innerText = `$${costoProdUSD.toFixed(2)}`;
    if (costSpedEl) costSpedEl.innerText = `$${costoSpedizioneUSD.toFixed(2)}`;
    if (costTotUSDEl) costTotUSDEl.innerText = `$${costoTotaleUSD.toFixed(2)}`;
    if (rateEl) rateEl.innerText = exchangeRate.toFixed(4);
    if (costTotEUREl) costTotEUREl.innerText = `€${costoTotaleEUR.toFixed(2).replace('.', ',')}`;
    
    if (profitEl) {
        profitEl.innerText = `€${profittoEUR.toFixed(2).replace('.', ',')}`;
        if (profittoEUR >= 0) {
            profitEl.className = "text-sm font-black font-mono text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200/50";
        } else {
            profitEl.className = "text-sm font-black font-mono text-rose-600 bg-rose-50 px-2.5 py-1 rounded-xl border border-rose-200/50";
        }
    }

    // Salva per invio successivo
    window.currentEconomicSummary = {
        totale_ordine_eur: totaleOrdineEUR,
        costo_prodotti_usd: costoProdUSD,
        costo_spedizione_usd: costoSpedizioneUSD,
        costo_totale_usd: costoTotaleUSD,
        costo_totale_eur: costoTotaleEUR,
        profitto_eur: profittoEUR
    };
}

window.gestioneCercaInCatalogo = function() {
    const term = (document.getElementById('gestione-add-cerca')?.value || '').toLowerCase().trim();
    const suggestions = document.getElementById('gestione-add-suggerimenti');
    if (!suggestions) return;

    if (!term || term.length < 2) {
        suggestions.classList.add('hidden');
        suggestions.innerHTML = '';
        return;
    }

    // Filtra prodotti dal catalogo globale caricato
    const matched = (prodotti || []).filter(p => {
        const title = `${p.squadra || ''} ${p.versione || ''} ${p.stagione || ''}`.toLowerCase();
        return title.includes(term);
    }).slice(0, 10);

    if (matched.length === 0) {
        suggestions.innerHTML = `
            <div class="p-2.5 text-xs text-slate-400 font-medium text-center">Nessun prodotto trovato. Procedi con l'inserimento libero.</div>
        `;
        suggestions.classList.remove('hidden');
        return;
    }

    suggestions.innerHTML = matched.map(p => {
        const dispName = `${p.squadra || ''} - ${p.versione || 'Regular'} (${p.stagione || '2026/2027'})`;
        const priceLabel = p.prezzo_consigliato ? `€${Number(p.prezzo_consigliato).toFixed(2)}` : '€23.99';
        return `
            <div onclick="gestioneSelezionaProdottoCatalogo(${p.id})" class="p-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 text-xs flex justify-between items-center transition-all">
                <div class="flex flex-col">
                    <span class="font-bold text-slate-800">${dispName}</span>
                    <span class="text-[10px] text-slate-400 font-mono">Categoria: ${p.categoria || 'Casa'} | ID: ${p.id}</span>
                </div>
                <span class="font-bold text-brand-gold font-mono">${priceLabel}</span>
            </div>
        `;
    }).join('');
    suggestions.classList.remove('hidden');
};

window.gestioneSelezionaProdottoCatalogo = function(id) {
    const prod = (prodotti || []).find(p => Number(p.id) === Number(id));
    const suggestions = document.getElementById('gestione-add-suggerimenti');
    if (suggestions) suggestions.classList.add('hidden');

    if (!prod) return;

    // Popola i campi form di aggiunta articolo
    const squadraInput = document.getElementById('add-prod-squadra');
    const categoriaSelect = document.getElementById('add-prod-categoria');
    const stagioneInput = document.getElementById('add-prod-stagione');
    const versioneInput = document.getElementById('add-prod-versione');
    const prezzoInput = document.getElementById('add-prod-prezzo');
    const supplierInput = document.getElementById('add-prod-prezzo-fornitore');

    if (squadraInput) squadraInput.value = prod.squadra || '';
    if (categoriaSelect) categoriaSelect.value = prod.categoria || 'Casa';
    if (stagioneInput) stagioneInput.value = prod.stagione || '2026/2027';
    if (versioneInput) versioneInput.value = prod.versione || '';
    if (prezzoInput) prezzoInput.value = prod.prezzo_consigliato || 23.99;
    if (supplierInput) supplierInput.value = prod.prezzo_fornitore || 14.50;

    window.lastSelectedCatalogProductId = prod.id;
    window.lastSelectedCatalogProductLegacyId = prod.legacy_id || prod.id;

    showToast(`Caricato: ${prod.squadra}`, "info");
};

window.gestioneInserisciNuovoProdotto = function() {
    const squadra = document.getElementById('add-prod-squadra')?.value.trim() || '';
    const categoria = document.getElementById('add-prod-categoria')?.value || 'Casa';
    const stagione = document.getElementById('add-prod-stagione')?.value.trim() || '2026/2027';
    const versione = document.getElementById('add-prod-versione')?.value.trim() || '';
    const target = document.getElementById('add-prod-target')?.value || 'Adulto';
    const taglia = document.getElementById('add-prod-taglia')?.value.trim().toUpperCase() || 'M';
    const quantita = parseInt(document.getElementById('add-prod-quantita')?.value, 10) || 1;
    const infoPerso = document.getElementById('add-prod-perso')?.value.trim() || 'No';
    const prezzo = parseFloat(document.getElementById('add-prod-prezzo')?.value) || 23.99;
    const prezzo_fornitore = parseFloat(document.getElementById('add-prod-prezzo-fornitore')?.value) || 14.50;

    if (!squadra) {
        showToast("Per favore, inserisci il nome del prodotto o la squadra.", "error");
        return;
    }

    const newItem = {
        id: window.lastSelectedCatalogProductId || Date.now(),
        legacy_id: window.lastSelectedCatalogProductLegacyId || null,
        squadra: squadra,
        categoria: categoria,
        stagione: stagione,
        versione: versione,
        target: target,
        taglia: taglia,
        quantita: quantita,
        infoPerso: infoPerso,
        prezzo: prezzo,
        prezzo_fornitore: prezzo_fornitore
    };

    window.currentOrdineProdotti.push(newItem);
    showToast("Prodotto inserito con successo!", "success");

    svuotaAggiungiForm();
    renderProdottiModificabili();
};

window.svuotaAggiungiForm = function() {
    const inputCerca = document.getElementById('gestione-add-cerca');
    if (inputCerca) inputCerca.value = '';

    const suggestions = document.getElementById('gestione-add-suggerimenti');
    if (suggestions) suggestions.classList.add('hidden');

    document.getElementById('add-prod-squadra').value = '';
    document.getElementById('add-prod-categoria').value = 'Casa';
    document.getElementById('add-prod-stagione').value = '2026/2027';
    document.getElementById('add-prod-versione').value = '';
    document.getElementById('add-prod-target').value = 'Adulto';
    document.getElementById('add-prod-taglia').value = '';
    document.getElementById('add-prod-quantita').value = '1';
    document.getElementById('add-prod-perso').value = '';
    document.getElementById('add-prod-prezzo').value = '23.99';
    document.getElementById('add-prod-prezzo-fornitore').value = '14.50';

    window.lastSelectedCatalogProductId = null;
    window.lastSelectedCatalogProductLegacyId = null;
};

window.salvaTuttiModificheOrdine = async function() {
    if (!window.currentGestioneOrderId) return;

    const email = document.getElementById('gestione-ordine-cliente-email').value.trim();
    const payment_status = document.getElementById('gestione-ordine-payment-status').value;
    const notes = document.getElementById('gestione-ordine-notes').value.trim();
    const lottoIdVal = document.getElementById('gestione-ordine-lotto-id')?.value;
    const lotto_id = lottoIdVal ? Number(lottoIdVal) : null;

    const payload = {
        id: window.currentGestioneOrderId,
        email: email,
        payment_status: payment_status,
        notes: notes,
        lotto_id: lotto_id
    };

    showToast("Salvataggio modifiche in corso...", "info");

    try {
        const response = await fetch('/api/admin/gestione-ordini/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const resData = await response.json();
        if (response.ok && resData.success) {
            showToast("Ordine salvato e sincronizzato!", "success");
            chiudiGestioneOrdineModal();
            if (typeof caricaGestioneOrdini === 'function') {
                await caricaGestioneOrdini();
            }
            if (typeof caricaLotto === 'function') {
                await caricaLotto();
            }
            if (typeof caricaCronologiaLotti === 'function') {
                await caricaCronologiaLotti();
            }
        } else {
            showToast("Errore durante il salvataggio: " + (resData.error || "errore"), "error");
        }
    } catch (err) {
        console.error("Error saving modifications:", err);
        showToast("Impossibile salvare l'ordine. Verifica la connessione.", "error");
    }
};

window.filtraGestioneOrdini = function() {
    renderGestioneOrdini();
};

window.apriGestioneOrdineModal = apriGestioneOrdineModal;
window.chiudiGestioneOrdineModal = chiudiGestioneOrdineModal;
window.closeGestioneOrdineModal = chiudiGestioneOrdineModal;





// 3. SEZIONE TRACKING AUTOMATICO 17TRACK (Rifattorizzata per Gestione Ordini)
async function sincronizzaTuttiTrackingBackend() {
    showToast("Aggiornamento di tutte le spedizioni in corso...", "info");
    try {
        const response = await fetch('/api/admin/gestione-ordini/sync-all-tracking', {
            method: 'POST'
        });
        if (response.ok) {
            showToast("Sincronizzazione globale completata con successo!", "success");
            if (typeof caricaGestioneOrdini === 'function') {
                await caricaGestioneOrdini();
            }
        } else {
            showToast("Errore durante la sincronizzazione globale.", "error");
        }
    } catch (err) {
        console.error("⚠️ Errore sincronizzazione globale:", err);
    }
}

window.currentPromoId = null;

let promoPreviewTimerInterval = null;
let currentPreviewDevice = 'desktop';

function initMarketingPromoLiveListeners() {
    const form = document.getElementById('form-marketing-promo');
    if (!form) return;

    // Listener tempo reale su tutti i campi del form
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        input.removeEventListener('input', updateLivePromoPreview);
        input.removeEventListener('change', updateLivePromoPreview);
        input.removeEventListener('keyup', updateLivePromoPreview);

        input.addEventListener('input', updateLivePromoPreview);
        input.addEventListener('change', updateLivePromoPreview);
        input.addEventListener('keyup', updateLivePromoPreview);
    });

    // Listener speciale per Upload File Immagine con FileReader
    const fileInput = document.getElementById('promo-immagine-file');
    if (fileInput) {
        fileInput.addEventListener('change', async function(e) {
            const file = e.target.files && e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    const dataUrl = event.target.result;
                    const urlInput = document.getElementById('promo-immagine');
                    if (urlInput) urlInput.value = dataUrl;
                    
                    const thumb = document.getElementById('promo-form-img-thumb');
                    const thumbContainer = document.getElementById('promo-form-img-preview-container');
                    const nameEl = document.getElementById('promo-form-img-name');
                    if (thumb && thumbContainer && nameEl) {
                        thumb.src = dataUrl;
                        nameEl.textContent = file.name;
                        thumbContainer.classList.remove('hidden');
                    }
                    updateLivePromoPreview();
                };
                reader.readAsDataURL(file);

                // Auto-upload su backend se disponibile
                try {
                    const formData = new FormData();
                    formData.append('immagine', file);
                    const uploadRes = await fetch('/api/upload', {
                        method: 'POST',
                        body: formData
                    });
                    const uploadData = await uploadRes.json();
                    if (uploadData.success && uploadData.filePath) {
                        document.getElementById('promo-immagine').value = uploadData.filePath;
                        updateLivePromoPreview();
                    }
                } catch (err) {
                    console.log("ℹ️ Immagine anteprima in locale tramite Data URL");
                }
            }
        });
    }

    // Sincronizzazione miniatura URL
    const urlInput = document.getElementById('promo-immagine');
    if (urlInput) {
        urlInput.addEventListener('input', function() {
            const val = this.value.trim();
            const thumbContainer = document.getElementById('promo-form-img-preview-container');
            const thumb = document.getElementById('promo-form-img-thumb');
            const nameEl = document.getElementById('promo-form-img-name');
            if (val) {
                if (thumb) thumb.src = val;
                if (nameEl) nameEl.textContent = "URL Esterno";
                if (thumbContainer) thumbContainer.classList.remove('hidden');
            } else {
                if (thumbContainer) thumbContainer.classList.add('hidden');
            }
        });
    }

    // Avvio Ticker per Countdown Timer
    if (!promoPreviewTimerInterval) {
        promoPreviewTimerInterval = setInterval(() => {
            const timerChecked = document.getElementById('promo-mostra-timer')?.checked;
            if (timerChecked) {
                updateLiveCountdownDigits();
            }
        }, 1000);
    }

    updateLivePromoPreview();
}

function clearPromoImage() {
    const fileInput = document.getElementById('promo-immagine-file');
    const urlInput = document.getElementById('promo-immagine');
    const thumbContainer = document.getElementById('promo-form-img-preview-container');
    
    if (fileInput) fileInput.value = '';
    if (urlInput) urlInput.value = '';
    if (thumbContainer) thumbContainer.classList.add('hidden');
    
    updateLivePromoPreview();
}

function resetPromoForm() {
    const form = document.getElementById('form-marketing-promo');
    if (form) form.reset();
    clearPromoImage();
    updateLivePromoPreview();
}

function setPromoPreviewDevice(device) {
    currentPreviewDevice = device;
    const viewport = document.getElementById('promo-preview-viewport');
    const topBar = document.getElementById('promo-device-top-bar');
    const btnDesktop = document.getElementById('btn-device-desktop');
    const btnTablet = document.getElementById('btn-device-tablet');
    const btnMobile = document.getElementById('btn-device-mobile');

    if (!viewport) return;

    [btnDesktop, btnTablet, btnMobile].forEach(btn => {
        if (btn) {
            btn.className = "px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 text-slate-400 hover:text-white";
        }
    });

    if (device === 'desktop') {
        viewport.className = "w-full transition-all duration-300 mx-auto";
        if (topBar) topBar.classList.add('hidden');
        if (btnDesktop) btnDesktop.className = "px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 bg-brand-gold text-slate-900 shadow-sm";
    } else if (device === 'tablet') {
        viewport.className = "w-full max-w-[440px] transition-all duration-300 mx-auto";
        if (topBar) topBar.classList.remove('hidden');
        if (btnTablet) btnTablet.className = "px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 bg-brand-gold text-slate-900 shadow-sm";
    } else if (device === 'mobile') {
        viewport.className = "w-full max-w-[340px] transition-all duration-300 mx-auto";
        if (topBar) topBar.classList.remove('hidden');
        if (btnMobile) btnMobile.className = "px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 bg-brand-gold text-slate-900 shadow-sm";
    }

    updateLivePromoPreview();
}

function updateLivePromoPreview() {
    const target = document.getElementById('promo-card-preview-target');
    const validationContainer = document.getElementById('preview-validation-container');
    const statusBadge = document.getElementById('promo-status-badge');
    const positionLabel = document.getElementById('promo-preview-position-label');

    if (!target) return;

    // Lettura valori dinamici dal form
    const attiva = document.getElementById('promo-attiva')?.checked || false;
    const badge = document.getElementById('promo-badge')?.value?.trim() || '';
    const titolo = document.getElementById('promo-titolo')?.value?.trim() || '';
    const sottotitolo = document.getElementById('promo-sottotitolo')?.value?.trim() || '';
    const codiceSconto = document.getElementById('promo-codice-sconto')?.value?.trim() || '';
    const descrizione = document.getElementById('promo-descrizione')?.value?.trim() || '';
    const immagine = document.getElementById('promo-immagine')?.value?.trim() || '';
    const bottoneTesto = document.getElementById('promo-bottone-testo')?.value?.trim() || 'Scopri Ora';
    const bottoneLink = document.getElementById('promo-bottone-link')?.value?.trim() || '#';
    const tema = document.getElementById('promo-tema')?.value || 'gold';
    const posizione = document.getElementById('promo-posizione')?.value || 'right';
    const mostraTimer = document.getElementById('promo-mostra-timer')?.checked || false;

    const dataInizio = document.getElementById('promo-data-inizio')?.value || '';
    const oraInizio = document.getElementById('promo-ora-inizio')?.value || '';
    const dataFine = document.getElementById('promo-data-fine')?.value || '';
    const oraFine = document.getElementById('promo-ora-fine')?.value || '';

    // Aggiornamento Badge di Stato nel form
    if (statusBadge) {
        if (attiva) {
            statusBadge.className = "px-2.5 py-1 text-[10px] font-bold uppercase rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200";
            statusBadge.textContent = "Attiva";
        } else {
            statusBadge.className = "px-2.5 py-1 text-[10px] font-bold uppercase rounded-lg bg-slate-200 text-slate-700 border border-slate-300";
            statusBadge.textContent = "Disattivata";
        }
    }

    // Label Posizione Hero
    if (positionLabel) {
        if (posizione === 'left') {
            positionLabel.textContent = "Posizione: Sinistra (Hero)";
        } else if (posizione === 'center') {
            positionLabel.textContent = "Posizione: Centro (Hero)";
        } else {
            positionLabel.textContent = "Posizione: Destra (Hero)";
        }
    }

    // 1. Engine Validazione Live
    const alerts = [];

    if (!titolo) {
        alerts.push({
            type: 'error',
            msg: '⚠️ Campo Obbligatorio Mancante: Inserisci il Titolo della Promozione'
        });
    }

    if (mostraTimer && (!dataFine || !oraFine)) {
        alerts.push({
            type: 'warning',
            msg: '⚠️ Countdown Attivo: Specifica Data e Ora di Fine per mostrare il timer'
        });
    }

    if (dataInizio && dataFine && oraInizio && oraFine) {
        const startTs = new Date(`${dataInizio}T${oraInizio}`).getTime();
        const endTs = new Date(`${dataFine}T${oraFine}`).getTime();
        const nowTs = Date.now();

        if (endTs <= startTs) {
            alerts.push({
                type: 'error',
                msg: '⚠️ Errore Date: La Data di Fine deve essere successiva alla Data di Inizio'
            });
        } else if (nowTs < startTs) {
            alerts.push({
                type: 'info',
                msg: `📅 Promo Programmata: Inizierà il ${new Date(startTs).toLocaleString('it-IT')}`
            });
        } else if (nowTs > endTs) {
            alerts.push({
                type: 'warning',
                msg: '⌛ Promo Scaduta: La data di fine è già passata'
            });
        }
    }

    if (!attiva) {
        alerts.push({
            type: 'neutral',
            msg: '⏸️ Promozione disattivata. Spunta "Attiva Promozione" per renderla visibile.'
        });
    }

    if (titolo && attiva && alerts.filter(a => a.type === 'error').length === 0) {
        alerts.push({
            type: 'success',
            msg: '✅ Promozione valida e pronta per la pubblicazione in Home Page'
        });
    }

    // Render Avvisi Validazione
    if (validationContainer) {
        validationContainer.innerHTML = alerts.map(a => {
            let bgClass = "bg-amber-500/20 text-amber-300 border-amber-500/30";
            if (a.type === 'error') bgClass = "bg-red-500/20 text-red-300 border-red-500/30";
            if (a.type === 'success') bgClass = "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
            if (a.type === 'info') bgClass = "bg-blue-500/20 text-blue-300 border-blue-500/30";
            if (a.type === 'neutral') bgClass = "bg-slate-800 text-slate-300 border-slate-700";

            return `<div class="px-3 py-1.5 rounded-xl border text-[11px] font-semibold flex items-center gap-2 ${bgClass}">
                <span>${a.msg}</span>
            </div>`;
        }).join('');
    }

    // 2. Mappatura Stili Temi
    let themeConfig = {
        cardBg: "bg-slate-900/95 border-amber-500/40 text-white shadow-amber-500/10",
        badgeBg: "bg-brand-gold text-slate-950 font-black",
        accentText: "text-brand-gold",
        btnClass: "bg-brand-gold text-slate-950 hover:bg-yellow-400 shadow-amber-500/20",
        timerBg: "bg-black/60 border-amber-500/30 text-amber-400"
    };

    if (tema === 'red') {
        themeConfig = {
            cardBg: "bg-slate-950/95 border-red-500/40 text-white shadow-red-500/10",
            badgeBg: "bg-red-600 text-white font-black",
            accentText: "text-red-400",
            btnClass: "bg-red-600 text-white hover:bg-red-500 shadow-red-600/20",
            timerBg: "bg-black/60 border-red-500/30 text-red-400"
        };
    } else if (tema === 'blue') {
        themeConfig = {
            cardBg: "bg-slate-950/95 border-blue-500/40 text-white shadow-blue-500/10",
            badgeBg: "bg-blue-600 text-white font-black",
            accentText: "text-blue-400",
            btnClass: "bg-blue-600 text-white hover:bg-blue-500 shadow-blue-600/20",
            timerBg: "bg-black/60 border-blue-500/30 text-blue-400"
        };
    } else if (tema === 'green') {
        themeConfig = {
            cardBg: "bg-slate-950/95 border-emerald-500/40 text-white shadow-emerald-500/10",
            badgeBg: "bg-emerald-500 text-slate-950 font-black",
            accentText: "text-emerald-400",
            btnClass: "bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-emerald-500/20",
            timerBg: "bg-black/60 border-emerald-500/30 text-emerald-400"
        };
    } else if (tema === 'dark') {
        themeConfig = {
            cardBg: "bg-slate-950 border-slate-800 text-slate-100 shadow-black/40",
            badgeBg: "bg-slate-800 text-slate-200 border border-slate-700 font-black",
            accentText: "text-slate-300",
            btnClass: "bg-white text-slate-950 hover:bg-slate-200 shadow-white/10",
            timerBg: "bg-slate-900 border-slate-800 text-white"
        };
    } else if (tema === 'purple') {
        themeConfig = {
            cardBg: "bg-slate-950/95 border-purple-500/40 text-white shadow-purple-500/10",
            badgeBg: "bg-purple-600 text-white font-black",
            accentText: "text-purple-300",
            btnClass: "bg-purple-600 text-white hover:bg-purple-500 shadow-purple-600/20",
            timerBg: "bg-black/60 border-purple-500/30 text-purple-300"
        };
    }

    // 3. Render Card Promo HTML
    const displayTitle = titolo || "Edizione Limitata Oro";
    const displayBadge = badge || "OFFERTA FLASH";
    const displaySub = sottotitolo || "Sottotitolo promozionale";
    const displayDesc = descrizione || "Descrizione completa dell'offerta speciale per i clienti.";

    target.innerHTML = `
        <div class="relative rounded-2xl p-5 border backdrop-blur-md transition-all duration-300 shadow-2xl ${themeConfig.cardBg}">
            
            <!-- Top Header Badge & Image -->
            <div class="flex items-start justify-between gap-4 mb-3">
                <div class="space-y-1.5 min-w-0 flex-1">
                    <span class="inline-block px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg shadow-sm ${themeConfig.badgeBg}">
                        ${displayBadge}
                    </span>
                    <h3 class="text-base sm:text-lg font-black tracking-tight leading-tight text-white">
                        ${displayTitle}
                    </h3>
                    ${displaySub ? `<p class="text-xs font-semibold ${themeConfig.accentText}">${displaySub}</p>` : ''}
                </div>

                ${immagine ? `
                    <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-white/10 shrink-0 bg-slate-800 shadow-md">
                        <img src="${immagine}" alt="Promo" class="w-full h-full object-cover" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\'w-full h-full flex items-center justify-center text-xs text-slate-500\'>🖼️ Img</div>';">
                    </div>
                ` : ''}
            </div>

            <!-- Descrizione -->
            ${displayDesc ? `<p class="text-xs text-slate-300/90 line-clamp-3 mb-3 leading-relaxed">${displayDesc}</p>` : ''}

            <!-- Codice Sconto Box -->
            ${codiceSconto ? `
                <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-mono font-bold text-amber-300 mb-3 select-all">
                    <span>🎟️ CODICE SCONTO:</span>
                    <span class="tracking-widest bg-amber-400/20 px-2 py-0.5 rounded border border-amber-400/30 text-white">${codiceSconto}</span>
                </div>
            ` : ''}

            <!-- Live Timer Container -->
            ${mostraTimer ? `
                <div class="mb-4 p-3 rounded-xl border ${themeConfig.timerBg}">
                    <div class="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1 flex items-center justify-between">
                        <span>⏳ Offerta a Tempo Limitato</span>
                        <span class="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                    </div>
                    <div id="live-promo-countdown-digits" class="grid grid-cols-4 gap-1.5 text-center font-mono">
                        <!-- Digits inseriti da updateLiveCountdownDigits() -->
                    </div>
                </div>
            ` : ''}

            <!-- Button CTA -->
            <div class="pt-1 flex items-center justify-between gap-3">
                <a href="${bottoneLink}" onclick="event.preventDefault();" class="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all shadow-md hover:scale-[1.02] ${themeConfig.btnClass}">
                    <span>${bottoneTesto}</span>
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                </a>
                <span class="text-[10px] text-slate-500 font-mono hidden sm:inline truncate max-w-[120px]" title="${bottoneLink}">${bottoneLink}</span>
            </div>

        </div>
    `;

    if (mostraTimer) {
        updateLiveCountdownDigits();
    }
}

function updateLiveCountdownDigits() {
    const digitsTarget = document.getElementById('live-promo-countdown-digits');
    if (!digitsTarget) return;

    const dataFine = document.getElementById('promo-data-fine')?.value;
    const oraFine = document.getElementById('promo-ora-fine')?.value;

    if (!dataFine || !oraFine) {
        digitsTarget.innerHTML = `
            <div class="bg-black/40 p-1.5 rounded-lg border border-white/5"><span class="text-xs font-bold block text-white">00</span><span class="text-[8px] text-slate-400 block font-bold">GIORNI</span></div>
            <div class="bg-black/40 p-1.5 rounded-lg border border-white/5"><span class="text-xs font-bold block text-white">00</span><span class="text-[8px] text-slate-400 block font-bold">ORE</span></div>
            <div class="bg-black/40 p-1.5 rounded-lg border border-white/5"><span class="text-xs font-bold block text-white">00</span><span class="text-[8px] text-slate-400 block font-bold">MIN</span></div>
            <div class="bg-black/40 p-1.5 rounded-lg border border-white/5"><span class="text-xs font-bold block text-white">00</span><span class="text-[8px] text-slate-400 block font-bold">SEC</span></div>
        `;
        return;
    }

    const targetDate = new Date(`${dataFine}T${oraFine}`).getTime();
    const now = Date.now();
    const diff = targetDate - now;

    if (diff <= 0) {
        digitsTarget.innerHTML = `
            <div class="col-span-4 py-1 text-center text-xs font-bold text-red-400 bg-red-500/10 rounded-lg border border-red-500/20">
                ⌛ PROMOZIONE SCADUTA
            </div>
        `;
        return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    const pad = (n) => String(n).padStart(2, '0');

    digitsTarget.innerHTML = `
        <div class="bg-black/40 p-1.5 rounded-lg border border-white/5"><span class="text-xs font-black block text-white">${pad(days)}</span><span class="text-[8px] text-slate-400 block font-bold">GIORNI</span></div>
        <div class="bg-black/40 p-1.5 rounded-lg border border-white/5"><span class="text-xs font-black block text-white">${pad(hours)}</span><span class="text-[8px] text-slate-400 block font-bold">ORE</span></div>
        <div class="bg-black/40 p-1.5 rounded-lg border border-white/5"><span class="text-xs font-black block text-white">${pad(minutes)}</span><span class="text-[8px] text-slate-400 block font-bold">MIN</span></div>
        <div class="bg-black/40 p-1.5 rounded-lg border border-white/5"><span class="text-xs font-black block text-amber-400 animate-pulse">${pad(seconds)}</span><span class="text-[8px] text-slate-400 block font-bold">SEC</span></div>
    `;
}

async function loadMarketingPromo() {
    try {
        const res = await fetch('/api/marketing-promos');
        const data = await res.json();
        
        if (data.success && data.promos && data.promos.length > 0) {
            const promo = data.promos.find(p => p.pagina === 'home') || data.promos[0];
            window.currentPromoId = promo.id;
            
            if (document.getElementById('promo-attiva')) document.getElementById('promo-attiva').checked = Boolean(promo.attiva);
            if (document.getElementById('promo-badge')) document.getElementById('promo-badge').value = promo.badge || '';
            if (document.getElementById('promo-titolo')) document.getElementById('promo-titolo').value = promo.titolo || '';
            if (document.getElementById('promo-sottotitolo')) document.getElementById('promo-sottotitolo').value = promo.sottotitolo || '';
            if (document.getElementById('promo-codice-sconto')) document.getElementById('promo-codice-sconto').value = promo.codice_sconto || '';
            if (document.getElementById('promo-descrizione')) document.getElementById('promo-descrizione').value = promo.descrizione || '';
            if (document.getElementById('promo-immagine')) document.getElementById('promo-immagine').value = promo.immagine || '';
            if (document.getElementById('promo-bottone-testo')) document.getElementById('promo-bottone-testo').value = promo.bottone_testo || '';
            if (document.getElementById('promo-bottone-link')) document.getElementById('promo-bottone-link').value = promo.bottone_link || '';
            if (document.getElementById('promo-tema')) document.getElementById('promo-tema').value = promo.tema || 'gold';
            if (document.getElementById('promo-mostra-timer')) document.getElementById('promo-mostra-timer').checked = Boolean(promo.mostra_timer);
            if (document.getElementById('promo-posizione')) document.getElementById('promo-posizione').value = promo.posizione || 'right';
            
            const pad = (n) => String(n).padStart(2, '0');
            const splitTimestamp = (tsStr) => {
                if (!tsStr) return { date: '', time: '' };
                const d = new Date(tsStr);
                if (isNaN(d.getTime())) return { date: '', time: '' };
                const year = d.getFullYear();
                const month = pad(d.getMonth() + 1);
                const day = pad(d.getDate());
                const hours = pad(d.getHours());
                const minutes = pad(d.getMinutes());
                return {
                    date: `${year}-${month}-${day}`,
                    time: `${hours}:${minutes}`
                };
            };
            
            const start = splitTimestamp(promo.data_inizio);
            if (document.getElementById('promo-data-inizio')) document.getElementById('promo-data-inizio').value = start.date;
            if (document.getElementById('promo-ora-inizio')) document.getElementById('promo-ora-inizio').value = start.time;
            
            const end = splitTimestamp(promo.data_fine);
            if (document.getElementById('promo-data-fine')) document.getElementById('promo-data-fine').value = end.date;
            if (document.getElementById('promo-ora-fine')) document.getElementById('promo-ora-fine').value = end.time;

            // Thumbnail preview if image exists
            if (promo.immagine) {
                const thumb = document.getElementById('promo-form-img-thumb');
                const thumbContainer = document.getElementById('promo-form-img-preview-container');
                const nameEl = document.getElementById('promo-form-img-name');
                if (thumb && thumbContainer) {
                    thumb.src = promo.immagine;
                    if (nameEl) nameEl.textContent = "Immagine Salvata";
                    thumbContainer.classList.remove('hidden');
                }
            }
        } else {
            window.currentPromoId = null;
        }

        initMarketingPromoLiveListeners();
    } catch (err) {
        console.error("⚠️ Errore caricamento promo:", err);
        showToast("Errore durante il caricamento della promo", "error");
    }
}

async function saveMarketingPromo() {
    try {
        const dateInizio = document.getElementById('promo-data-inizio')?.value || '';
        const oraInizio = document.getElementById('promo-ora-inizio')?.value || '';
        const dateFine = document.getElementById('promo-data-fine')?.value || '';
        const oraFine = document.getElementById('promo-ora-fine')?.value || '';
        
        const data_inizio = dateInizio && oraInizio ? new Date(`${dateInizio}T${oraInizio}`).toISOString() : null;
        const data_fine = dateFine && oraFine ? new Date(`${dateFine}T${oraFine}`).toISOString() : null;
        
        if (data_inizio && data_fine && new Date(data_inizio) >= new Date(data_fine)) {
            showToast("La data di fine deve essere successiva alla data di inizio!", "error");
            return;
        }
        
        const payload = {
            id: window.currentPromoId,
            pagina: 'home',
            attiva: document.getElementById('promo-attiva')?.checked || false,
            badge: document.getElementById('promo-badge')?.value || '',
            titolo: document.getElementById('promo-titolo')?.value || '',
            sottotitolo: document.getElementById('promo-sottotitolo')?.value || '',
            codice_sconto: document.getElementById('promo-codice-sconto')?.value || '',
            descrizione: document.getElementById('promo-descrizione')?.value || '',
            immagine: document.getElementById('promo-immagine')?.value || '',
            bottone_testo: document.getElementById('promo-bottone-testo')?.value || '',
            bottone_link: document.getElementById('promo-bottone-link')?.value || '',
            tema: document.getElementById('promo-tema')?.value || 'gold',
            mostra_timer: document.getElementById('promo-mostra-timer')?.checked || false,
            posizione: document.getElementById('promo-posizione')?.value || 'right',
            data_inizio,
            data_fine
        };
        
        const res = await fetch('/api/marketing-promos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        if (data.success) {
            showToast("Promozione salvata con successo!", "success");
            if (data.promo && data.promo.id) window.currentPromoId = data.promo.id;
            updateLivePromoPreview();
        } else {
            showToast("Errore durante il salvataggio della promo: " + (data.error || ""), "error");
        }
    } catch (err) {
        console.error("⚠️ Errore salvataggio promo:", err);
        showToast("Impossibile salvare la promozione", "error");
    }
}

window.sincronizzaTuttiTrackingBackend = sincronizzaTuttiTrackingBackend;
window.loadMarketingPromo = loadMarketingPromo;
window.saveMarketingPromo = saveMarketingPromo;
window.initMarketingPromoLiveListeners = initMarketingPromoLiveListeners;
window.updateLivePromoPreview = updateLivePromoPreview;
window.setPromoPreviewDevice = setPromoPreviewDevice;
window.clearPromoImage = clearPromoImage;
window.resetPromoForm = resetPromoForm;

// =========================================================================
// STABILIZZAZIONE ESPLICITA FUNZIONI GLOBALI GESTISCI ORDINE PER LA UI
// =========================================================================
function closeGestioneOrdineModal() {
    if (typeof window.chiudiGestioneOrdineModal === 'function') {
        window.chiudiGestioneOrdineModal();
    }
}
function gestioneInserisciNuovoProdotto() {
    const fn = window.gestioneInserisciNuovoProdotto;
    if (typeof fn === 'function' && fn !== gestioneInserisciNuovoProdotto) {
        fn();
    }
}
function gestioneEliminaProdotto(idx) {
    const fn = window.gestioneEliminaProdotto;
    if (typeof fn === 'function' && fn !== gestioneEliminaProdotto) {
        fn(idx);
    }
}
function salvaTuttiModificheOrdine() {
    const fn = window.salvaTuttiModificheOrdine;
    if (typeof fn === 'function' && fn !== salvaTuttiModificheOrdine) {
        fn();
    }
}
function aggiornaDatoProdottoSingolo(idx, key, value) {
    const fn = window.aggiornaDatoProdottoSingolo;
    if (typeof fn === 'function' && fn !== aggiornaDatoProdottoSingolo) {
        fn(idx, key, value);
    }
}

// Bind direct global references
window.closeGestioneOrdineModal = closeGestioneOrdineModal;
window.gestioneInserisciNuovoProdotto = window.gestioneInserisciNuovoProdotto || gestioneInserisciNuovoProdotto;
window.gestioneEliminaProdotto = window.gestioneEliminaProdotto || gestioneEliminaProdotto;
window.salvaTuttiModificheOrdine = window.salvaTuttiModificheOrdine || salvaTuttiModificheOrdine;
window.aggiornaDatoProdottoSingolo = window.aggiornaDatoProdottoSingolo || aggiornaDatoProdottoSingolo;


// =========================================================================
// GESTIONE RECENSIONI - MAGLIA D'ORO ADMIN PANEL
// =========================================================================
let localAdminReviews = [];
let editRecSelectedImages = [];

async function caricaRecensioniAdmin(silente = false) {
    try {
        const res = await fetch('/api/reviews?admin=true');
        if (!res.ok) {
            if (!silente) showToast("Errore nel caricamento delle recensioni: " + res.status, "error");
            return;
        }
        const data = await res.json();
        
        if (data && data.success) {
            localAdminReviews = data.reviews || [];
            
            // Aggiorna metriche
            const totale = localAdminReviews.length;
            const pending = localAdminReviews.filter(r => r.status === 'pending').length;
            const approved = localAdminReviews.filter(r => r.status === 'approved').length;
            const rejected = localAdminReviews.filter(r => r.status === 'rejected').length;
            
            const totEl = document.getElementById('rec-stat-totale');
            const penEl = document.getElementById('rec-stat-attesa');
            const appEl = document.getElementById('rec-stat-approvate');
            const rejEl = document.getElementById('rec-stat-rifiutate');
            
            if (totEl) totEl.innerText = totale;
            if (penEl) penEl.innerText = pending;
            if (appEl) appEl.innerText = approved;
            if (rejEl) rejEl.innerText = rejected;
            
            // Aggiorna badge notifiche visive nel menu laterale per Recensioni in attesa di approvazione
            const recBadgeEl = document.getElementById('admin-recensioni-badge');
            if (recBadgeEl) {
                if (pending > 0) {
                    recBadgeEl.innerText = pending;
                    recBadgeEl.classList.remove('hidden');
                } else {
                    recBadgeEl.classList.add('hidden');
                }
            }
            
            if (typeof currentActiveTab !== 'undefined' && currentActiveTab === 'recensioni') {
                applicaFiltriRecensioni();
            }
        } else {
            if (!silente) showToast("Errore nel caricamento delle recensioni: " + (data ? data.error : ''), "error");
        }
    } catch (err) {
        if (!silente) {
            console.error("Errore caricaRecensioniAdmin:", err);
            showToast("Errore di rete durante il caricamento delle recensioni.", "error");
        }
    }
}

function applicaFiltriRecensioni() {
    const searchEl = document.getElementById('rec-search');
    const statusEl = document.getElementById('rec-filter-status');
    const ratingEl = document.getElementById('rec-filter-rating');
    const typeEl = document.getElementById('rec-filter-type');
    
    const searchText = searchEl ? searchEl.value.toLowerCase().trim() : '';
    const statusFilter = statusEl ? statusEl.value : 'all';
    const ratingFilter = ratingEl ? ratingEl.value : 'all';
    const typeFilter = typeEl ? typeEl.value : 'all';
    
    let filtered = [...localAdminReviews];
    
    if (statusFilter !== 'all') {
        filtered = filtered.filter(r => r.status === statusFilter);
    }

    if (typeFilter !== 'all') {
        if (typeFilter === 'verified_purchase') {
            filtered = filtered.filter(r => r.review_type ? r.review_type === 'verified_purchase' : (r.order_id || r.order_number));
        } else if (typeFilter === 'shared_experience') {
            filtered = filtered.filter(r => r.review_type ? r.review_type === 'shared_experience' : (!r.order_id && !r.order_number));
        }
    }
    
    if (ratingFilter !== 'all') {
        filtered = filtered.filter(r => String(r.rating) === String(ratingFilter));
    }
    
    if (searchText) {
        filtered = filtered.filter(r => {
            const cliente = (r.customer_name || '').toLowerCase();
            const email = (r.email || '').toLowerCase();
            const commento = (r.comment || '').toLowerCase();
            const titolo = (r.title || '').toLowerCase();
            const prodotto = (r.product_name || '').toLowerCase();
            const ordine = (r.order_number || '').toLowerCase();
            return cliente.includes(searchText) || email.includes(searchText) || commento.includes(searchText) || titolo.includes(searchText) || prodotto.includes(searchText) || ordine.includes(searchText);
        });
    }
    
    renderRecensioniAdmin(filtered);
}

function renderRecensioniAdmin(reviews) {
    const container = document.getElementById('recensioni-admin-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (reviews.length === 0) {
        container.innerHTML = `
            <div class="bg-white border border-slate-150 rounded-3xl p-12 text-center space-y-3 shadow-sm">
                <span class="text-4xl">⭐</span>
                <h4 class="text-sm font-extrabold text-slate-800">Nessuna recensione trovata</h4>
                <p class="text-xs text-slate-400 max-w-sm mx-auto">Non ci sono recensioni corrispondenti ai criteri di ricerca impostati.</p>
            </div>
        `;
        return;
    }
    
    reviews.forEach(rec => {
        const card = document.createElement('div');
        card.className = "bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all duration-200 space-y-4 relative overflow-hidden";
        
        // Status Badge
        let statusBadge = '';
        if (rec.status === 'pending') {
            statusBadge = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold uppercase tracking-wider">🟡 In attesa</span>';
        } else if (rec.status === 'approved') {
            statusBadge = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">🟢 Approvata</span>';
        } else {
            statusBadge = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold uppercase tracking-wider">🔴 Rifiutata</span>';
        }
        
        // Product Info if available
        let productSection = '';
        if (rec.product_name) {
            const imgHtml = rec.product_image ? `<img src="${rec.product_image}" class="w-8 h-10 object-cover rounded border border-slate-100">` : '<div class="w-8 h-10 bg-slate-100 flex items-center justify-center rounded text-xs text-slate-400">👕</div>';
            productSection = `
                <div class="flex items-center gap-2.5 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl max-w-xs">
                    ${imgHtml}
                    <div class="min-w-0">
                        <p class="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Prodotto Acquistato</p>
                        <p class="text-[11px] font-extrabold text-slate-700 truncate">${rec.product_name}</p>
                    </div>
                </div>
            `;
        }
        
        // Render rating stars
        const starsHtml = '⭐'.repeat(rec.rating) + '☆'.repeat(5 - rec.rating);
        
        // Render photos if present
        let photosHtml = '';
        if (rec.images && rec.images.length > 0) {
            const imgs = rec.images.map(imgUrl => {
                const src = typeof imgUrl === 'string' ? imgUrl : (imgUrl.thumb || imgUrl.full || '');
                const fullSrc = typeof imgUrl === 'string' ? imgUrl : (imgUrl.full || imgUrl.thumb || '');
                return `
                    <a href="${fullSrc}" target="_blank" class="block w-12 h-12 rounded-lg border border-slate-200 overflow-hidden hover:opacity-80 transition-all bg-slate-50">
                        <img src="${src}" class="w-full h-full object-cover">
                    </a>
                `;
            }).join('');
            photosHtml = `
                <div class="space-y-1.5">
                    <p class="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Foto del cliente</p>
                    <div class="flex flex-wrap gap-2">${imgs}</div>
                </div>
            `;
        }
        
        // Date formatting
        let displayDate = '';
        if (rec.purchase_date) {
            displayDate = `Ordine del ${rec.purchase_date}`;
        } else if (rec.created_at) {
            const d = new Date(rec.created_at);
            displayDate = d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
        }
        
        // Order identifier
        const orderInfo = rec.order_number ? `<span class="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-bold">${rec.order_number}</span>` : '';
        
        // Type Badge
        const isShared = rec.review_type ? rec.review_type === 'shared_experience' : (!rec.order_id && !rec.order_number);
        const typeBadge = isShared ? `<span class="text-blue-600 font-bold">👤 Esperienza condivisa</span>` : `<span class="text-emerald-600 font-bold">✅ Acquisto verificato</span>`;
        const emailInfo = rec.email ? `<span class="text-slate-500 font-medium">📧 ${rec.email}</span>` : '';

        // Title if available
        const titleHtml = rec.title ? `<h4 class="text-xs font-extrabold text-slate-800 tracking-tight">"${rec.title}"</h4>` : '';
        
        card.innerHTML = `
            <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <!-- Left Details -->
                <div class="space-y-3 flex-grow">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-full bg-slate-800 text-brand-gold border border-slate-700 flex items-center justify-center font-black text-sm tracking-wide">
                            ${(rec.customer_name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <h3 class="text-xs font-black text-slate-900 tracking-tight">${rec.customer_name || 'Cliente'}</h3>
                                ${statusBadge}
                            </div>
                            <p class="text-[10px] text-slate-400 font-semibold flex flex-wrap items-center gap-1.5 mt-0.5">
                                ${typeBadge}
                                ${emailInfo ? `<span>•</span>${emailInfo}` : ''}
                                <span>•</span>
                                <span>${displayDate}</span>
                                ${orderInfo}
                            </p>
                        </div>
                    </div>
                    
                    <div class="space-y-1">
                        <div class="text-brand-gold text-xs leading-none tracking-wider">${starsHtml}</div>
                        ${titleHtml}
                        <p class="text-xs text-slate-600 font-medium leading-relaxed max-w-3xl whitespace-pre-line">${rec.comment}</p>
                    </div>
                    
                    ${photosHtml}
                </div>
                
                <!-- Right Controls & Product -->
                <div class="flex flex-col justify-between items-end gap-3 self-stretch md:min-w-[180px]">
                    ${productSection}
                    
                    <div class="flex gap-2 w-full justify-end">
                        <button onclick="modificaRecensioneUI('${rec.id}')" class="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 font-bold text-[10px] rounded-xl transition-all duration-150 flex items-center gap-1">
                            <span>✏️</span> Modifica
                        </button>
                        <button onclick="eliminaRecensioneUI('${rec.id}')" class="px-3 py-2 bg-red-50 hover:bg-red-100 border border-red-100 text-red-600 font-bold text-[10px] rounded-xl transition-all duration-150 flex items-center gap-1">
                            <span>🗑️</span> Elimina
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Quick Moderation Buttons at footer -->
            ${rec.status === 'pending' ? `
                <div class="mt-4 pt-4 border-t border-slate-100 flex justify-end gap-3">
                    <button onclick="moderaRecensione('${rec.id}', 'rejected')" class="px-4 py-2 bg-rose-600/10 hover:bg-rose-600 text-rose-600 hover:text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all duration-150 flex items-center gap-1.5">
                        <span>✕</span> Rifiuta Recensione
                    </button>
                    <button onclick="moderaRecensione('${rec.id}', 'approved')" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all duration-150 flex items-center gap-1.5 shadow-md shadow-emerald-600/10">
                        <span>✔</span> Approva Recensione
                    </button>
                </div>
            ` : `
                <div class="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                    <button onclick="moderaRecensione('${rec.id}', 'pending')" class="text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-all flex items-center gap-1">
                        <span>↩️</span> Riporta in stato "In attesa"
                    </button>
                </div>
            `}
        `;
        
        container.appendChild(card);
    });
}

async function moderaRecensione(id, action) {
    try {
        const res = await fetch('/api/reviews/moderate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status: action })
        });
        const data = await res.json();
        if (data.success) {
            let msg = '';
            if (action === 'approved') msg = "Recensione approvata!";
            else if (action === 'rejected') msg = "Recensione rifiutata!";
            else msg = "Recensione riportata in attesa.";
            
            showToast(msg, "success");
            caricaRecensioniAdmin();
        } else {
            showToast("Errore durante la moderazione: " + data.error, "error");
        }
    } catch (err) {
        console.error("Errore moderaRecensione:", err);
        showToast("Errore di rete.", "error");
    }
}

function modificaRecensioneUI(id) {
    const rec = localAdminReviews.find(r => String(r.id) === String(id));
    if (!rec) {
        showToast("Recensione non trovata.", "error");
        return;
    }
    
    document.getElementById('edit-rec-id').value = rec.id;
    if (document.getElementById('edit-rec-cliente')) document.getElementById('edit-rec-cliente').value = rec.customer_name || '';
    if (document.getElementById('edit-rec-email')) document.getElementById('edit-rec-email').value = rec.email || '';
    if (document.getElementById('edit-rec-type')) document.getElementById('edit-rec-type').value = rec.review_type || ((rec.order_id || rec.order_number) ? 'verified_purchase' : 'shared_experience');
    if (document.getElementById('edit-rec-stelle')) document.getElementById('edit-rec-stelle').value = rec.rating;
    if (document.getElementById('edit-rec-title')) document.getElementById('edit-rec-title').value = rec.title || '';
    if (document.getElementById('edit-rec-testo')) document.getElementById('edit-rec-testo').value = rec.comment || '';
    
    editRecSelectedImages = [...(rec.images || [])];
    renderEditReviewImages();
    
    const modal = document.getElementById('edit-review-modal');
    const container = document.getElementById('edit-review-container');
    if (modal && container) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            container.classList.remove('scale-95', 'opacity-0');
            container.classList.add('scale-100', 'opacity-100');
        }, 10);
    }
}

function closeEditReviewModal() {
    const modal = document.getElementById('edit-review-modal');
    const container = document.getElementById('edit-review-container');
    if (modal && container) {
        container.classList.remove('scale-100', 'opacity-100');
        container.classList.add('scale-95', 'opacity-0');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
}

function rimuoviFotoDettaglioRecensione(index) {
    editRecSelectedImages.splice(index, 1);
    renderEditReviewImages();
}

function renderEditReviewImages() {
    const container = document.getElementById('edit-rec-foto-container');
    if (!container) return;
    container.innerHTML = '';
    
    if (editRecSelectedImages.length === 0) {
        container.innerHTML = '<p class="text-[10px] text-slate-400 font-semibold italic">Nessuna fotografia allegata.</p>';
        return;
    }
    
    editRecSelectedImages.forEach((img, index) => {
        const div = document.createElement('div');
        div.className = 'relative w-16 h-16 rounded-lg border border-slate-200 overflow-hidden group shadow-sm bg-slate-50';
        div.innerHTML = `
            <img src="${img}" class="w-full h-full object-cover">
            <button type="button" onclick="rimuoviFotoDettaglioRecensione(${index})" class="absolute top-1 right-1 w-4 h-4 bg-red-600 hover:bg-red-700 text-white font-bold text-[8px] rounded-full flex items-center justify-center shadow-md transition-all">
                ✕
            </button>
        `;
        container.appendChild(div);
    });
}

async function salvaModificheRecensione(event) {
    if (event) event.preventDefault();
    
    const id = document.getElementById('edit-rec-id').value;
    const customer_name = document.getElementById('edit-rec-cliente') ? document.getElementById('edit-rec-cliente').value.trim() : '';
    const email = document.getElementById('edit-rec-email') ? document.getElementById('edit-rec-email').value.trim() : '';
    const review_type = document.getElementById('edit-rec-type') ? document.getElementById('edit-rec-type').value : 'verified_purchase';
    const rating = document.getElementById('edit-rec-stelle').value;
    const title = document.getElementById('edit-rec-title') ? document.getElementById('edit-rec-title').value.trim() : '';
    const comment = document.getElementById('edit-rec-testo').value;
    
    if (!id || !rating || !comment || !customer_name) {
        showToast("Per favore, compila tutti i campi richiesti.", "error");
        return;
    }
    
    try {
        const res = await fetch('/api/reviews/moderate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: id,
                customer_name: customer_name,
                email: email,
                review_type: review_type,
                title: title,
                rating: Number(rating),
                comment: comment,
                images: editRecSelectedImages
            })
        });
        const result = await res.json();
        if (result.success) {
            showToast("Recensione modificata con successo!", "success");
            closeEditReviewModal();
            caricaRecensioniAdmin();
        } else {
            showToast("Errore durante il salvataggio: " + result.error, "error");
        }
    } catch (err) {
        console.error("Errore salvaModificheRecensione:", err);
        showToast("Errore di connessione al server.", "error");
    }
}

async function eliminaRecensioneUI(id) {
    const chiediConferma = !window.appSettings || window.appSettings.sicurezza?.conferma_elimina_recensione !== false;
    if (chiediConferma) {
        if (!confirm("Sei sicuro di voler eliminare definitivamente questa recensione? Questa azione non può essere annullata.")) {
            return;
        }
    }
    
    try {
        const res = await fetch(`/api/reviews/${id}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        if (data.success) {
            showToast("Recensione eliminata definitivamente.", "success");
            caricaRecensioniAdmin();
        } else {
            showToast("Errore durante l'eliminazione: " + data.error, "error");
        }
    } catch (err) {
        console.error("Errore eliminaRecensioneUI:", err);
        showToast("Errore di rete.", "error");
    }
}

// Bind reviews methods to window object for global usage
window.caricaRecensioniAdmin = caricaRecensioniAdmin;
window.applicaFiltriRecensioni = applicaFiltriRecensioni;
window.modificaRecensioneUI = modificaRecensioneUI;
window.closeEditReviewModal = closeEditReviewModal;
window.rimuoviFotoDettaglioRecensione = rimuoviFotoDettaglioRecensione;
window.salvaModificheRecensione = salvaModificheRecensione;
window.moderaRecensione = moderaRecensione;
window.eliminaRecensioneUI = eliminaRecensioneUI;


// ==========================================================================
// LOGICA CHAT ASSISTENZA AMMINISTRATORE (MAGLIA D'ORO PREMIUM)
// ==========================================================================

let conversazioniAdminList = [];
let conversazioneSelezionataId = null;
let adminChatPollingInterval = null;
let adminGlobalBadgePollingInterval = null;
let adminChatAllegatoCorrente = null;

async function caricaConversazioniAdmin(silente = false) {
    try {
        const res = await fetch('/api/admin/chats');
        if (!res.ok) {
            if (!silente) console.warn("Risposta non OK da /api/admin/chats:", res.status);
            return;
        }
        const data = await res.json();
        if (data && data.success) {
            conversazioniAdminList = data.conversations || [];
            if (typeof currentActiveTab !== 'undefined' && currentActiveTab === 'chat') {
                renderConversazioniLista();
            }
            
            // Calcola il badge delle chat con messaggi non letti dal cliente o in attesa di risposta
            const chatDaLeggere = conversazioniAdminList.filter(c => (c.unreadCount && c.unreadCount > 0) || c.stato === 'in_attesa').length;
            const badgeEl = document.getElementById('admin-chat-badge');
            if (badgeEl) {
                if (chatDaLeggere > 0) {
                    badgeEl.innerText = chatDaLeggere;
                    badgeEl.classList.remove('hidden');
                } else {
                    badgeEl.classList.add('hidden');
                }
            }

            // Se c'è una conversazione attiva selezionata, ricarica i messaggi
            if (conversazioneSelezionataId) {
                await caricaMessaggiConversazioneCorrente(silente);
                
                // Aggiorna anche i dati in tempo reale del record selezionato (nel caso cambi lo stato)
                const convCorrente = conversazioniAdminList.find(c => c.id === conversazioneSelezionataId);
                if (convCorrente) {
                    const selectEl = document.getElementById('admin-chat-stato-select');
                    if (selectEl && selectEl.value !== convCorrente.stato) {
                        selectEl.value = convCorrente.stato;
                    }
                }
            }
        }
    } catch (err) {
        if (!silente) {
            console.warn("Avviso caricaConversazioniAdmin:", err);
        }
    }
}

function renderConversazioniLista() {
    const container = document.getElementById('admin-conversazioni-lista');
    if (!container) return;

    if (conversazioniAdminList.length === 0) {
        container.innerHTML = `
            <div class="p-8 text-center text-slate-500 text-xs">
                Nessuna conversazione di assistenza registrata.
            </div>
        `;
        return;
    }

    let html = '';
    conversazioniAdminList.forEach(conv => {
        const isSelezionata = conv.id === conversazioneSelezionataId;
        const bgClass = isSelezionata ? 'bg-slate-800/50 border-l-4 border-brand-gold' : 'hover:bg-slate-800/20 border-l-4 border-transparent';
        
        // Colori in base allo stato
        let statoBadgeHtml = '';
        if (conv.stato === 'Nuova') {
            statoBadgeHtml = `<span class="px-2 py-0.5 bg-red-500/10 border border-red-500/30 text-red-400 font-extrabold text-[9px] rounded-full uppercase">Nuova</span>`;
        } else if (conv.stato === 'In attesa') {
            statoBadgeHtml = `<span class="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 font-extrabold text-[9px] rounded-full uppercase">In attesa</span>`;
        } else if (conv.stato === 'Risposto') {
            statoBadgeHtml = `<span class="px-2 py-0.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 font-extrabold text-[9px] rounded-full uppercase">Risposto</span>`;
        } else if (conv.stato === 'Chiusa') {
            statoBadgeHtml = `<span class="px-2 py-0.5 bg-slate-500/15 border border-slate-500/30 text-slate-400 font-extrabold text-[9px] rounded-full uppercase">Chiusa</span>`;
        }

        // Unread Badge
        const unreadBadge = conv.unreadCount > 0 
            ? `<span class="px-1.5 py-0.5 bg-red-600 text-white text-[9px] font-black rounded-full animate-pulse min-w-[16px] text-center">${conv.unreadCount}</span>` 
            : '';

        // Formatta data
        let dataStr = '';
        if (conv.last_message_at) {
            const dataObj = new Date(conv.last_message_at);
            dataStr = dataObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + dataObj.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
        }

        // Nome pulito
        const nomeCliente = conv.nome || 'Cliente Anonimo';

        html += `
            <div onclick="selezionaConversazioneAdmin('${conv.id}')" class="p-4 cursor-pointer transition-all flex flex-col gap-1.5 ${bgClass}">
                <div class="flex items-center justify-between">
                    <span class="text-white font-extrabold text-xs tracking-wide">${nomeCliente}</span>
                    <span class="text-[9px] text-slate-500 font-mono font-medium">${dataStr}</span>
                </div>
                <div class="flex items-center justify-between gap-2">
                    <p class="text-slate-400 text-[11px] truncate max-w-[180px]">${conv.email || ''}</p>
                    <div class="flex items-center gap-1.5">
                        ${statoBadgeHtml}
                        ${unreadBadge}
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

async function selezionaConversazioneAdmin(id) {
    conversazioneSelezionataId = id;
    renderConversazioniLista();

    const conv = conversazioniAdminList.find(c => c.id === id);
    if (!conv) return;

    // Gestione reattiva layout mobile/desktop
    const listCol = document.getElementById('admin-chat-list-column');
    const activeCol = document.getElementById('admin-chat-active-column');
    if (listCol && activeCol) {
        listCol.classList.add('hidden');
        activeCol.classList.remove('hidden');
        activeCol.classList.add('flex');
    }

    // Mostra l'interfaccia di chat attiva
    document.getElementById('admin-chat-empty-state').classList.add('hidden');
    document.getElementById('admin-chat-active-container').classList.remove('hidden');

    // Imposta info del cliente
    document.getElementById('admin-chat-cliente-nome').innerText = conv.nome || 'Cliente Anonimo';
    document.getElementById('admin-chat-cliente-email').innerText = conv.email || 'Nessuna email fornita';
    document.getElementById('admin-chat-stato-select').value = conv.stato;

    // Imposta metadata degli ordini e lotti
    document.getElementById('admin-chat-meta-ordini-count').innerText = `${conv.orderCount || 0} ordini`;
    
    const ultimoOrdineInfoEl = document.getElementById('admin-chat-meta-ultimo-ordine-info');
    if (conv.lastOrder) {
        ultimoOrdineInfoEl.innerText = `${conv.lastOrder.order_number} (${new Date(conv.lastOrder.data).toLocaleDateString()}) - ${conv.lastOrder.status} - €${parseFloat(conv.lastOrder.totale).toFixed(2)}`;
    } else {
        ultimoOrdineInfoEl.innerText = 'Nessun ordine effettuato';
    }

    const lottoEl = document.getElementById('admin-chat-meta-lotto');
    if (conv.lottoId) {
        lottoEl.innerText = `Lotto #${conv.lottoId}`;
        lottoEl.className = "text-emerald-400 font-extrabold uppercase tracking-wide";
    } else {
        lottoEl.innerText = 'Nessuno';
        lottoEl.className = "text-slate-400 font-medium";
    }

    // Segna i messaggi del cliente come letti
    try {
        await fetch('/api/chat/mark-read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conversation_id: id, sender: 'client' })
        });
    } catch (err) {
        console.error("Errore mark-read:", err);
    }

    // Carica messaggi
    await caricaMessaggiConversazioneCorrente(false);
    
    // Attiva polling per la chat attiva ogni 4 secondi
    if (adminChatPollingInterval) clearInterval(adminChatPollingInterval);
    adminChatPollingInterval = setInterval(() => {
        caricaMessaggiConversazioneCorrente(true);
    }, 4000);
}

function tornaAListaConversazioniAdmin() {
    conversazioneSelezionataId = null;
    if (adminChatPollingInterval) {
        clearInterval(adminChatPollingInterval);
        adminChatPollingInterval = null;
    }

    const listCol = document.getElementById('admin-chat-list-column');
    const activeCol = document.getElementById('admin-chat-active-column');
    if (listCol && activeCol) {
        listCol.classList.remove('hidden');
        activeCol.classList.add('hidden');
    }

    const emptyState = document.getElementById('admin-chat-empty-state');
    const activeContainer = document.getElementById('admin-chat-active-container');
    if (emptyState && activeContainer) {
        emptyState.classList.remove('hidden');
        activeContainer.classList.add('hidden');
    }

    renderConversazioniLista();
}

function tornaAListaConversazioniMobile() {
    tornaAListaConversazioniAdmin();
}

async function caricaMessaggiConversazioneCorrente(silente = false) {
    if (!conversazioneSelezionataId) return;
    try {
        const res = await fetch(`/api/admin/chat/${conversazioneSelezionataId}/messages`);
        if (!res.ok) {
            if (!silente) console.warn("Risposta non OK messaggi chat:", res.status);
            return;
        }
        const data = await res.json();
        if (data && data.success) {
            renderMessaggiAdmin(data.messages || [], silente);
        }
    } catch (err) {
        if (!silente) {
            console.warn("Avviso caricaMessaggiConversazioneCorrente:", err);
        }
    }
}

function renderMessaggiAdmin(messages, silente = false) {
    const stream = document.getElementById('admin-chat-messaggi-stream');
    if (!stream) return;

    let html = '';
    messages.forEach(msg => {
        const isAdmin = msg.sender === 'admin';
        const bubbleBg = isAdmin 
            ? 'bg-gradient-to-r from-[#D6A43A]/20 to-[#B8860B]/25 border border-[#D6A43A]/30 text-white ml-auto rounded-2xl rounded-tr-none' 
            : 'bg-slate-800/80 border border-slate-700/50 text-white mr-auto rounded-2xl rounded-tl-none';
        
        const timestamp = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Gestisci allegato
        let allegatoHtml = '';
        if (msg.attachment_url) {
            if (msg.attachment_type === 'pdf') {
                allegatoHtml = `
                    <div class="my-2 p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center gap-2">
                        <span class="text-xl">📄</span>
                        <div class="text-[10px] truncate max-w-[150px]">
                            <p class="text-white font-extrabold truncate">Allegato PDF</p>
                            <a href="${msg.attachment_url}" download class="text-brand-gold hover:underline font-bold">Scarica Documento</a>
                        </div>
                    </div>
                `;
            } else {
                // Immagine
                allegatoHtml = `
                    <div class="my-2 max-w-[220px] rounded-xl overflow-hidden border border-slate-800/60 shadow-md">
                        <img src="${msg.attachment_url}" alt="Allegato" loading="lazy" decoding="async" onclick="window.open('${msg.attachment_url}')" class="w-full h-auto object-cover cursor-pointer hover:opacity-90 transition-all">
                    </div>
                `;
            }
        }

        // Sostituisce i newline con br
        const formattedText = msg.message ? msg.message.replace(/\n/g, '<br>') : '';

        html += `
            <div class="flex flex-col max-w-[85%] ${isAdmin ? 'ml-auto' : 'mr-auto'}">
                <div class="p-3.5 ${bubbleBg} shadow-md">
                    ${formattedText ? `<p class="text-xs font-medium leading-relaxed select-text">${formattedText}</p>` : ''}
                    ${allegatoHtml}
                </div>
                <span class="text-[9px] text-slate-500 font-mono mt-1 ${isAdmin ? 'text-right' : 'text-left'}">${timestamp}</span>
            </div>
        `;
    });

    const isAtBottom = stream.scrollHeight - stream.scrollTop <= stream.clientHeight + 100;
    stream.innerHTML = html;

    // Scorri in basso se era già in fondo o se non è un aggiornamento silente
    if (!silente || isAtBottom) {
        stream.scrollTop = stream.scrollHeight;
    }
}

async function cambiaStatoConversazioneSelezionata(nuovoStato) {
    if (!conversazioneSelezionataId) return;
    try {
        const res = await fetch('/api/admin/chat/update-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conversation_id: conversazioneSelezionataId, stato: nuovoStato })
        });
        const data = await res.json();
        if (data.success) {
            showToast(`Stato conversazione aggiornato a "${nuovoStato}".`, "success");
            await caricaConversazioniAdmin(true);
        } else {
            showToast("Errore aggiornamento stato: " + data.error, "error");
        }
    } catch (err) {
        console.error("Errore cambiaStatoConversazioneSelezionata:", err);
    }
}

async function inviaMessaggioAdmin() {
    if (!conversazioneSelezionataId) return;
    
    const inputEl = document.getElementById('admin-chat-input-text');
    const text = inputEl.value.trim();

    if (!text && !adminChatAllegatoCorrente) {
        return; // Niente da inviare
    }

    try {
        const payload = {
            conversation_id: conversazioneSelezionataId,
            message: text,
            attachment_url: adminChatAllegatoCorrente ? adminChatAllegatoCorrente.url : null,
            attachment_type: adminChatAllegatoCorrente ? adminChatAllegatoCorrente.type : null
        };

        const res = await fetch('/api/admin/chat/respond', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success) {
            inputEl.value = '';
            annullaAllegatoAdmin();
            await caricaMessaggiConversazioneCorrente(false);
            await caricaConversazioniAdmin(true);
        } else {
            showToast("Errore invio messaggio: " + data.error, "error");
        }
    } catch (err) {
        console.error("Errore inviaMessaggioAdmin:", err);
        showToast("Impossibile inviare il messaggio.", "error");
    }
}

function comprimiImmagine(file, maxDim, quality, callback) {
    if (!file.type.startsWith('image/')) {
        callback(null);
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            let w = img.width;
            let h = img.height;
            
            if (w > h) {
                if (w > maxDim) {
                    h = Math.round((h * maxDim) / w);
                    w = maxDim;
                }
            } else {
                if (h > maxDim) {
                    w = Math.round((w * maxDim) / h);
                    h = maxDim;
                }
            }
            
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            
            const base64 = canvas.toDataURL('image/jpeg', quality);
            callback(base64);
        };
        img.onerror = function() {
            callback(null);
        };
        img.src = e.target.result;
    };
    reader.onerror = function() {
        callback(null);
    };
    reader.readAsDataURL(file);
}

function comprimiImmagineAsync(file, maxDim, quality) {
    return new Promise((resolve) => {
        comprimiImmagine(file, maxDim, quality, (base64) => {
            resolve(base64);
        });
    });
}

async function gestisciAllegatoAdmin(input) {
    const file = input.files[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf';
    const isImage = file.type.startsWith('image/');

    if (!isPdf && !isImage) {
        showToast("Tipo di file non supportato. Carica un'immagine o un file PDF.", "error");
        input.value = '';
        return;
    }

    const previewBox = document.getElementById('admin-chat-attachment-preview-box');
    const nameEl = document.getElementById('admin-chat-attachment-name');
    const typeEl = document.getElementById('admin-chat-attachment-type-lbl');
    const thumbEl = document.getElementById('admin-chat-attachment-thumb');

    // Mostra indicatore caricamento nell'anteprima
    if (previewBox) previewBox.classList.remove('hidden');
    if (nameEl) nameEl.innerText = "Elaborazione...";
    if (typeEl) typeEl.innerText = isPdf ? "Documento PDF" : "Immagine";
    if (thumbEl) thumbEl.innerText = "⏳";

    // Mostra l'anteprima immediata dell'immagine localmente
    if (isImage && thumbEl) {
        const localReader = new FileReader();
        localReader.onload = (e) => {
            thumbEl.innerHTML = `<img src="${e.target.result}" class="w-full h-full object-cover">`;
        };
        localReader.readAsDataURL(file);
    }

    try {
        let base64ToSend = '';
        if (isImage) {
            if (nameEl) nameEl.innerText = "Compressione...";
            base64ToSend = await comprimiImmagineAsync(file, 1000, 0.75);
        }
        
        if (!base64ToSend) {
            base64ToSend = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = () => resolve('');
                reader.readAsDataURL(file);
            });
        }
        
        if (!base64ToSend) {
            throw new Error("Impossibile leggere il file.");
        }

        if (nameEl) nameEl.innerText = "Caricamento...";
        
        // Caricamento con XHR asincrono e aggiornamento in tempo reale
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        
        xhr.upload.onprogress = function(e) {
            if (e.lengthComputable && nameEl) {
                const percent = Math.round((e.loaded / e.total) * 100);
                nameEl.innerText = `Caricamento... ${percent}%`;
            }
        };
        
        xhr.onload = function() {
            if (xhr.status === 200) {
                try {
                    const uploadData = JSON.parse(xhr.responseText);
                    if (uploadData.success && (uploadData.url || uploadData.filePath)) {
                        const targetUrl = uploadData.url || uploadData.filePath;
                        adminChatAllegatoCorrente = {
                            url: targetUrl,
                            type: isPdf ? 'pdf' : 'image',
                            name: file.name
                        };
                        if (nameEl) nameEl.innerText = file.name;
                        if (thumbEl) {
                            if (isPdf) {
                                thumbEl.innerText = "📄";
                            } else {
                                thumbEl.innerHTML = `<img src="${targetUrl}" class="w-full h-full object-cover">`;
                            }
                        }
                        showToast("File caricato correttamente e pronto all'invio.", "success");
                    } else {
                        throw new Error("Upload fallito");
                    }
                } catch (err) {
                    console.error(err);
                    showToast("Errore caricamento file.", "error");
                    annullaAllegatoAdmin();
                }
            } else {
                showToast("Errore caricamento file.", "error");
                annullaAllegatoAdmin();
            }
        };
        
        xhr.onerror = function() {
            showToast("Errore di rete durante il caricamento.", "error");
            annullaAllegatoAdmin();
        };
        
        xhr.send(JSON.stringify({ filename: file.name, base64: base64ToSend }));

    } catch (err) {
        console.error("Errore gestisciAllegatoAdmin upload:", err);
        showToast("Errore di rete durante il caricamento.", "error");
        annullaAllegatoAdmin();
    }
}

function annullaAllegatoAdmin() {
    adminChatAllegatoCorrente = null;
    document.getElementById('admin-chat-file-input').value = '';
    document.getElementById('admin-chat-attachment-preview-box').classList.add('hidden');
}

// Inizializza il polling globale dei badge in background per l'amministratore (ogni 10 secondi)
function avviaPollingGlobaleBadgeAdmin() {
    if (adminGlobalBadgePollingInterval) clearInterval(adminGlobalBadgePollingInterval);
    
    // Esegui subito al caricamento iniziale
    caricaConversazioniAdmin(true);
    caricaRecensioniAdmin(true);

    adminGlobalBadgePollingInterval = setInterval(() => {
        caricaConversazioniAdmin(true);
        caricaRecensioniAdmin(true);
    }, 10000);
}

// Avvia immediatamente all'avvio
avviaPollingGlobaleBadgeAdmin();

// ==========================================
// FUNZIONALITÀ GESTIONE COUPON SCONTO (ADMIN)
// ==========================================
let couponsList = [];

async function caricaCoupon() {
    const tbody = document.getElementById('coupon-tabella-body');
    if (!tbody) return;
    
    tbody.innerHTML = `
        <tr>
            <td colspan="7" class="px-6 py-8 text-center text-slate-400 font-medium">
                Caricamento in corso...
            </td>
        </tr>
    `;
    
    try {
        const res = await fetch('/api/coupons');
        const data = await res.json();
        
        if (data.success && Array.isArray(data.coupons)) {
            couponsList = data.coupons;
            
            if (couponsList.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" class="px-6 py-8 text-center text-slate-400 font-medium">
                            Nessun coupon trovato nel sistema. Clicca su "+ Nuovo Coupon" per crearne uno.
                        </td>
                    </tr>
                `;
                return;
            }
            
            tbody.innerHTML = couponsList.map(c => {
                let badgeType = "bg-rose-500/10 text-rose-500";
                let labelStato = "Inattivo";
                if (c.is_active) {
                    badgeType = "bg-emerald-500/10 text-emerald-500";
                    labelStato = "Attivo";
                }
                
                let valLabel = "-";
                if (c.type === "percentuale") {
                    valLabel = `${c.value}%`;
                } else if (c.type === "fisso") {
                    valLabel = `${parseFloat(c.value).toFixed(2)}€`;
                } else if (c.type === "fornitore") {
                    valLabel = "Prezzo Fornitore";
                }
                
                const expDate = c.expires_at ? new Date(c.expires_at).toLocaleDateString('it-IT') : "Illimitata";
                const limLabel = c.usage_limit ? c.usage_limit : "∞";
                
                return `
                    <tr class="hover:bg-slate-50 transition-colors">
                        <td class="px-6 py-4 font-bold text-slate-900 tracking-wider font-mono select-all">${c.code}</td>
                        <td class="px-6 py-4 capitalize">${c.type}</td>
                        <td class="px-6 py-4 text-center font-bold text-[#D6A43A]">${valLabel}</td>
                        <td class="px-6 py-4 text-center">
                            <span class="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${badgeType}">
                                ${labelStato}
                            </span>
                        </td>
                        <td class="px-6 py-4 text-center text-slate-500">${c.used_count || 0} / ${limLabel}</td>
                        <td class="px-6 py-4 text-center text-slate-500">${expDate}</td>
                        <td class="px-6 py-4 text-right">
                            <div class="flex items-center justify-end gap-2.5">
                                <button onclick="modificaCoupon(${c.id})" class="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-900 transition-all font-sans" title="Modifica">
                                    ✏️
                                </button>
                                <button onclick="duplicaCoupon(${c.id})" class="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-900 transition-all font-sans" title="Duplica">
                                    👯
                                </button>
                                <button onclick="eliminaCoupon(${c.id})" class="p-1.5 hover:bg-slate-100 rounded-lg text-red-500 hover:text-red-700 transition-all font-sans" title="Elimina">
                                    🗑️
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="px-6 py-8 text-center text-red-500 font-medium">
                        Impossibile caricare i coupon: ${data.error || 'Errore sconosciuto'}
                    </td>
                </tr>
            `;
        }
    } catch (err) {
        console.error("Errore caricaCoupon:", err);
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="px-6 py-8 text-center text-red-500 font-medium">
                    Errore di connessione al server.
                </td>
            </tr>
        `;
    }
}

function apriModalNuovoCoupon() {
    document.getElementById('coupon-modal-title').innerText = "Aggiungi Nuovo Coupon";
    document.getElementById('coupon-form-id').value = "";
    document.getElementById('coupon-form-code').value = "";
    document.getElementById('coupon-form-code').disabled = false;
    document.getElementById('coupon-form-type').value = "percentuale";
    document.getElementById('coupon-form-value').value = "";
    document.getElementById('coupon-form-limit').value = "";
    document.getElementById('coupon-form-expiry').value = "";
    document.getElementById('coupon-form-active').checked = true;
    
    gestisciCambiamentoTipoCoupon();
    
    const modal = document.getElementById('coupon-modal');
    modal.classList.remove('hidden');
    setTimeout(() => {
        const container = document.getElementById('coupon-modal-container');
        container.classList.remove('scale-95', 'opacity-0');
        container.classList.add('scale-100', 'opacity-100');
    }, 10);
}

function chiudiModalCoupon() {
    const container = document.getElementById('coupon-modal-container');
    container.classList.remove('scale-100', 'opacity-100');
    container.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        document.getElementById('coupon-modal').classList.add('hidden');
    }, 300);
}

function gestisciCambiamentoTipoCoupon() {
    const type = document.getElementById('coupon-form-type').value;
    const container = document.getElementById('coupon-valore-container');
    const input = document.getElementById('coupon-form-value');
    
    if (type === 'fornitore') {
        container.classList.add('hidden');
        input.required = false;
        input.value = "0";
    } else {
        container.classList.remove('hidden');
        input.required = true;
        if (input.value === "0") input.value = "";
    }
}

async function salvaCoupon() {
    const id = document.getElementById('coupon-form-id').value;
    const code = document.getElementById('coupon-form-code').value;
    const type = document.getElementById('coupon-form-type').value;
    const value = document.getElementById('coupon-form-value').value;
    const usage_limit = document.getElementById('coupon-form-limit').value;
    const expires_at = document.getElementById('coupon-form-expiry').value;
    const is_active = document.getElementById('coupon-form-active').checked;
    
    const payload = {
        code,
        type,
        value: type === 'fornitore' ? 0 : parseFloat(value),
        is_active,
        usage_limit: usage_limit ? parseInt(usage_limit) : null,
        expires_at: expires_at || null
    };
    
    if (id) {
        payload.id = id;
    }
    
    try {
        const res = await fetch('/api/coupons', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if (data.success) {
            showToast(id ? "Coupon aggiornato con successo!" : "Coupon creato con successo!", "success");
            chiudiModalCoupon();
            caricaCoupon();
        } else {
            showToast(data.error || "Errore nel salvataggio.", "error");
        }
    } catch (err) {
        console.error("Errore salvataggio coupon:", err);
        showToast("Errore di connessione.", "error");
    }
}

function modificaCoupon(id) {
    const c = couponsList.find(item => String(item.id) === String(id));
    if (!c) return;
    
    document.getElementById('coupon-modal-title').innerText = "Modifica Coupon";
    document.getElementById('coupon-form-id').value = c.id;
    document.getElementById('coupon-form-code').value = c.code;
    document.getElementById('coupon-form-code').disabled = true;
    document.getElementById('coupon-form-type').value = c.type;
    document.getElementById('coupon-form-value').value = c.value || "";
    document.getElementById('coupon-form-limit').value = c.usage_limit || "";
    document.getElementById('coupon-form-active').checked = c.is_active;
    
    if (c.expires_at) {
        const dateObj = new Date(c.expires_at);
        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        document.getElementById('coupon-form-expiry').value = `${yyyy}-${mm}-${dd}`;
    } else {
        document.getElementById('coupon-form-expiry').value = "";
    }
    
    gestisciCambiamentoTipoCoupon();
    
    const modal = document.getElementById('coupon-modal');
    modal.classList.remove('hidden');
    setTimeout(() => {
        const container = document.getElementById('coupon-modal-container');
        container.classList.remove('scale-95', 'opacity-0');
        container.classList.add('scale-100', 'opacity-100');
    }, 10);
}

async function duplicaCoupon(id) {
    try {
        const res = await fetch('/api/coupons/duplicate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        const data = await res.json();
        
        if (data.success) {
            showToast("Coupon duplicato con successo!", "success");
            caricaCoupon();
        } else {
            showToast(data.error || "Errore durante la duplicazione.", "error");
        }
    } catch (err) {
        console.error("Errore duplicaCoupon:", err);
        showToast("Errore di connessione.", "error");
    }
}

async function eliminaCoupon(id) {
    if (!confirm("Sei sicuro di voler eliminare definitivamente questo coupon sconto?")) return;
    
    try {
        const res = await fetch(`/api/coupons/${id}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        
        if (data.success) {
            showToast("Coupon eliminato con successo!", "success");
            caricaCoupon();
        } else {
            showToast(data.error || "Impossibile eliminare il coupon.", "error");
        }
    } catch (err) {
        console.error("Errore eliminaCoupon:", err);
        showToast("Errore di connessione.", "error");
    }
}

// Registra i metodi sul window object per renderli utilizzabili inline dall'HTML
window.caricaConversazioniAdmin = caricaConversazioniAdmin;
window.selezionaConversazioneAdmin = selezionaConversazioneAdmin;
window.tornaAListaConversazioniAdmin = tornaAListaConversazioniAdmin;
window.tornaAListaConversazioniMobile = tornaAListaConversazioniMobile;
window.cambiaStatoConversazioneSelezionata = cambiaStatoConversazioneSelezionata;
window.inviaMessaggioAdmin = inviaMessaggioAdmin;
window.gestisciAllegatoAdmin = gestisciAllegatoAdmin;
window.annullaAllegatoAdmin = annullaAllegatoAdmin;

window.caricaCoupon = caricaCoupon;
window.apriModalNuovoCoupon = apriModalNuovoCoupon;
window.chiudiModalCoupon = chiudiModalCoupon;
window.gestisciCambiamentoTipoCoupon = gestisciCambiamentoTipoCoupon;
window.salvaCoupon = salvaCoupon;
window.modificaCoupon = modificaCoupon;
window.duplicaCoupon = duplicaCoupon;
window.eliminaCoupon = eliminaCoupon;

// ==========================================
// GESTIONE FILTRI CATALOGO DINAMICI
// ==========================================

function assicuratiFiltriDinamici() {
    if (!window.appSettings) window.appSettings = {};
    if (!Array.isArray(window.appSettings.filtriCatalogo) || window.appSettings.filtriCatalogo.length === 0) {
        const defaultFiltri = [
            { id: 'fil_tutti', nome: 'Tutti', ordine: 1, stato: 'attivo' },
            { id: 'fil_kit', nome: 'Kit', ordine: 2, stato: 'attivo' },
            { id: 'fil_player', nome: 'Player', ordine: 3, stato: 'attivo' },
            { id: 'fil_fan', nome: 'Fan', ordine: 4, stato: 'attivo' },
            { id: 'fil_retro', nome: 'Retro', ordine: 5, stato: 'attivo' },
            { id: 'fil_allenamento', nome: 'Kit Allenamento', ordine: 6, stato: 'attivo' },
            { id: 'fil_tuta', nome: 'Tuta', ordine: 7, stato: 'attivo' }
        ];

        window.appSettings.filtriCatalogo = defaultFiltri;
    }
}

function renderFiltriCatalogoTabella() {
    assicuratiFiltriDinamici();
    const tbody = document.getElementById('filtri-catalogo-tbody');
    if (!tbody) return;

    window.appSettings.filtriCatalogo.sort((a, b) => (Number(a.ordine) || 0) - (Number(b.ordine) || 0));

    let html = '';
    window.appSettings.filtriCatalogo.forEach((filtro, index) => {
        const isAttivo = filtro.stato === 'attivo' || filtro.attivo !== false;
        html += `
            <tr data-filtro-id="${filtro.id || index}" class="hover:bg-slate-50/80 transition-all border-b border-slate-100 last:border-0">
                <td class="px-4 py-3 text-center">
                    <input type="number" value="${filtro.ordine !== undefined ? filtro.ordine : (index + 1)}" min="1" 
                        onchange="aggiornaCampoFiltroCatalogo('${filtro.id || index}', 'ordine', this.value)"
                        class="w-16 mx-auto block text-center bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-xs font-semibold focus:outline-none focus:border-brand-gold transition-all">
                </td>
                <td class="px-4 py-3">
                    <input type="text" value="${filtro.nome || ''}" 
                        onchange="aggiornaCampoFiltroCatalogo('${filtro.id || index}', 'nome', this.value)"
                        class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-brand-gold transition-all">
                </td>
                <td class="px-4 py-3 text-center">
                    <select onchange="aggiornaCampoFiltroCatalogo('${filtro.id || index}', 'stato', this.value)"
                        class="px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${isAttivo ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}">
                        <option value="attivo" ${isAttivo ? 'selected' : ''}>Attivo</option>
                        <option value="inattivo" ${!isAttivo ? 'selected' : ''}>Inattivo</option>
                    </select>
                </td>
                <td class="px-4 py-3 text-center">
                    <button type="button" onclick="eliminaFiltroCatalogo('${filtro.id || index}')" title="Elimina Filtro"
                        class="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all">
                        🗑️
                    </button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    aggiornaMenuFiltriCatalogoForm();
    
    if (typeof generaOpzioniFiltri === 'function') {
        generaOpzioniFiltri();
    }
}

function aggiornaCampoFiltroCatalogo(idOrIndex, field, value) {
    assicuratiFiltriDinamici();
    const filtro = window.appSettings.filtriCatalogo.find((f, idx) => f.id === idOrIndex || String(idx) === String(idOrIndex));
    if (filtro) {
        if (field === 'ordine') {
            filtro[field] = parseFloat(value) || 0;
        } else {
            filtro[field] = value;
        }
        aggiornaMenuFiltriCatalogoForm();
    }
}

function apriModalNuovoFiltroCatalogo() {
    const modal = document.getElementById('filtro-modal');
    const container = document.getElementById('filtro-modal-container');
    if (!modal || !container) return;

    const maxOrdine = (window.appSettings?.filtriCatalogo || []).reduce((max, f) => Math.max(max, Number(f.ordine) || 0), 0);

    const elNome = document.getElementById('filtro-form-nome');
    const elOrdine = document.getElementById('filtro-form-ordine');
    const elStato = document.getElementById('filtro-form-stato');

    if (elNome) elNome.value = '';
    if (elOrdine) elOrdine.value = maxOrdine + 1;
    if (elStato) elStato.value = 'attivo';

    modal.classList.remove('hidden');
    setTimeout(() => {
        container.classList.remove('scale-95', 'opacity-0');
        container.classList.add('scale-100', 'opacity-100');
    }, 10);
}

function chiudiModalNuovoFiltroCatalogo() {
    const modal = document.getElementById('filtro-modal');
    const container = document.getElementById('filtro-modal-container');
    if (!modal || !container) return;

    container.classList.remove('scale-100', 'opacity-100');
    container.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 200);
}

function salvaNuovoFiltroCatalogo() {
    assicuratiFiltriDinamici();
    const nome = (document.getElementById('filtro-form-nome')?.value || '').trim();
    const ordine = parseInt(document.getElementById('filtro-form-ordine')?.value || 0, 10) || (window.appSettings.filtriCatalogo.length + 1);
    const stato = document.getElementById('filtro-form-stato')?.value || 'attivo';

    if (!nome) {
        showToast("Inserisci un nome per il filtro.", "warning");
        return;
    }

    const giaPresente = window.appSettings.filtriCatalogo.some(f => f.nome.toLowerCase() === nome.toLowerCase());
    if (giaPresente) {
        showToast("Un filtro con questo nome esiste già.", "warning");
        return;
    }

    const nuovoFiltro = {
        id: 'fil_' + Date.now(),
        nome: nome,
        ordine: ordine,
        stato: stato
    };

    window.appSettings.filtriCatalogo.push(nuovoFiltro);
    chiudiModalNuovoFiltroCatalogo();
    renderFiltriCatalogoTabella();
    showToast(`✅ Filtro "${nome}" creato. Clicca "Salva Filtri Catalogo" per salvare le modifiche.`, "success");
}

function eliminaFiltroCatalogo(idOrIndex) {
    assicuratiFiltriDinamici();
    const idx = window.appSettings.filtriCatalogo.findIndex((f, i) => f.id === idOrIndex || String(i) === String(idOrIndex));
    if (idx === -1) return;

    const filtro = window.appSettings.filtriCatalogo[idx];
    if (!confirm(`Sei sicuro di voler eliminare il filtro "${filtro.nome}"?`)) {
        return;
    }

    window.appSettings.filtriCatalogo.splice(idx, 1);
    renderFiltriCatalogoTabella();
    showToast(`Filtro "${filtro.nome}" eliminato. Clicca "Salva Filtri Catalogo" per salvare le modifiche.`, "info");
}

async function salvaFiltriCatalogo() {
    if (!window.appSettings) window.appSettings = {};
    assicuratiFiltriDinamici();

    try {
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                settings: window.appSettings
            })
        });

        const data = await response.json();
        if (data.success) {
            window.appSettings = data.settings;
            popolaSettingsUI();
            showToast("✅ Filtri catalogo salvati correttamente.", "success");
        } else {
            showToast("Errore durante il salvataggio: " + (data.error || "Errore sconosciuto"), "error");
        }
    } catch (err) {
        console.error("Errore salvataggio filtri catalogo:", err);
        showToast("Errore di connessione al server.", "error");
    }
}

window.renderFiltriCatalogoTabella = renderFiltriCatalogoTabella;
window.aggiornaCampoFiltroCatalogo = aggiornaCampoFiltroCatalogo;
window.apriModalNuovoFiltroCatalogo = apriModalNuovoFiltroCatalogo;
window.chiudiModalNuovoFiltroCatalogo = chiudiModalNuovoFiltroCatalogo;
window.salvaNuovoFiltroCatalogo = salvaNuovoFiltroCatalogo;
window.eliminaFiltroCatalogo = eliminaFiltroCatalogo;
window.salvaFiltriCatalogo = salvaFiltriCatalogo;
window.setFiltroAnteprima = setFiltroAnteprima;
window.aggiornaStatoFiltroVisivo = aggiornaStatoFiltroVisivo;
window.apriPreviewImmagineOrdine = apriPreviewImmagineOrdine;
window.chiudiPreviewImmagineOrdine = chiudiPreviewImmagineOrdine;

// ============================================================================
// MODULO JAVASCRIPT: SUDDIVISIONE CONTI & MODIFICHE PROFITTO (SERGIO & RICCARDO)
// CONTABILITÀ INTERNA DEL PROFITTO — GESTIONE ECCEZIONI E ACQUISTI PERSONALI
// ============================================================================
let profitSplitData = {
    summary: {
        total_orders: 0,
        total_profit: 0,
        sergio: { total_initial: 0, total_withdrawals: 0, total_net: 0 },
        riccardo: { total_initial: 0, total_withdrawals: 0, total_net: 0 },
        total_movements_count: 0
    },
    modifications: [],
    lot_orders: []
};
let selectedModificaOrder = null;
let profitSplitMode = 'manual'; // 'manual' | 'by_expenses'
let lotProfitPercentageSergio = 50;
let lotProfitPercentageRiccardo = 50;
let manualSavedSergioPct = 50;
let manualSavedRiccardoPct = 50;
let autoCalculatedSergioPct = 50;
let autoCalculatedRiccardoPct = 50;
let currentProfitSplitLottoId = 1;
let saveProfitSplitDebounceTimer = null;

function formatValutaEuro(num) {
    const val = Number(num) || 0;
    return val.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Cambia la modalità di suddivisione del profitto tra 'manual' e 'by_expenses'
 */
function cambiaModalitaSuddivisione(newMode) {
    if (newMode !== 'manual' && newMode !== 'by_expenses') return;
    profitSplitMode = newMode;

    if (profitSplitMode === 'by_expenses') {
        lotProfitPercentageSergio = autoCalculatedSergioPct;
        lotProfitPercentageRiccardo = autoCalculatedRiccardoPct;
    } else {
        lotProfitPercentageSergio = manualSavedSergioPct;
        lotProfitPercentageRiccardo = manualSavedRiccardoPct;
    }

    aggiornaSuddivisioneProfittoLive();
    salvaSuddivisioneProfitto();
}

/**
 * Aggiorna in tempo reale la visualizzazione della suddivisione profitto residuo,
 * del riepilogo finale e delle KPI card superiori senza ricaricare la pagina
 */
function aggiornaSuddivisioneProfittoLive() {
    const summary = (profitSplitData && profitSplitData.summary) ? profitSplitData.summary : {};

    const netTotalProfit = Number(summary.total_profit !== undefined ? summary.total_profit : summary.profitto_lotto) || 0;
    const ordersProfit = Number(summary.orders_profit_total !== undefined ? summary.orders_profit_total : netTotalProfit) || 0;
    const alibabaFeeEur = Number(summary.alibaba_fee_eur) || 0;

    const speseSergio = Number(summary.spese_sergio !== undefined ? summary.spese_sergio : (summary.sergio?.total_withdrawals || 0)) || 0;
    const speseRiccardo = Number(summary.spese_riccardo !== undefined ? summary.spese_riccardo : (summary.riccardo?.total_withdrawals || 0)) || 0;
    const speseTotali = Number((speseSergio + speseRiccardo).toFixed(2));

    // Profitto Residuo = Profitto del lotto - Spese personali
    const profittoResiduo = Number((netTotalProfit - speseSergio - speseRiccardo).toFixed(2));

    // Crediti residui di ciascun socio dopo gli acquisti personali:
    // Credito residuo = Profitto disponibile - Spese personali del socio
    const creditoResiduoSergio = Number((netTotalProfit - speseSergio).toFixed(2));
    const creditoResiduoRiccardo = Number((netTotalProfit - speseRiccardo).toFixed(2));
    const sommaCreditiResidui = Number((creditoResiduoSergio + creditoResiduoRiccardo).toFixed(2));

    // Calcolo automatico percentuali in base ai crediti residui
    if (sommaCreditiResidui > 0) {
        autoCalculatedSergioPct = Number(((creditoResiduoSergio / sommaCreditiResidui) * 100).toFixed(2));
        autoCalculatedRiccardoPct = Number((100 - autoCalculatedSergioPct).toFixed(2));
    } else if (sommaCreditiResidui < 0) {
        if (creditoResiduoSergio === creditoResiduoRiccardo) {
            autoCalculatedSergioPct = 50;
            autoCalculatedRiccardoPct = 50;
        } else if (creditoResiduoSergio > creditoResiduoRiccardo) {
            autoCalculatedSergioPct = 100;
            autoCalculatedRiccardoPct = 0;
        } else {
            autoCalculatedSergioPct = 0;
            autoCalculatedRiccardoPct = 100;
        }
    } else {
        if (creditoResiduoSergio === creditoResiduoRiccardo) {
            autoCalculatedSergioPct = 50;
            autoCalculatedRiccardoPct = 50;
        } else if (creditoResiduoSergio > creditoResiduoRiccardo) {
            autoCalculatedSergioPct = 100;
            autoCalculatedRiccardoPct = 0;
        } else {
            autoCalculatedSergioPct = 0;
            autoCalculatedRiccardoPct = 100;
        }
    }

    // Determina le percentuali effettive da applicare
    let sPct = (profitSplitMode === 'by_expenses') ? autoCalculatedSergioPct : lotProfitPercentageSergio;
    let rPct = (profitSplitMode === 'by_expenses') ? autoCalculatedRiccardoPct : lotProfitPercentageRiccardo;

    if (isNaN(sPct)) sPct = 50;
    if (isNaN(rPct)) rPct = 50;

    // Calcolo quote spettanti sul profitto lordo disponibile del lotto (Gross shares)
    let sergioGrossShare = 0;
    let riccardoGrossShare = 0;

    if (sPct === 100) {
        sergioGrossShare = netTotalProfit;
        riccardoGrossShare = 0;
    } else if (rPct === 100) {
        sergioGrossShare = 0;
        riccardoGrossShare = netTotalProfit;
    } else {
        sergioGrossShare = Number(((netTotalProfit * sPct) / 100).toFixed(2));
        riccardoGrossShare = Number((netTotalProfit - sergioGrossShare).toFixed(2));
    }

    // Saldo/Credito netto residuo spettante a ciascun socio: Quota lorda - Acquisti personali del socio
    const sergioResidualShare = Number((sergioGrossShare - speseSergio).toFixed(2));
    const riccardoResidualShare = Number((riccardoGrossShare - speseRiccardo).toFixed(2));
    const totaleAssegnato = Number((sergioResidualShare + riccardoResidualShare).toFixed(2));

    const sergioNet = sergioResidualShare;
    const riccardoNet = riccardoResidualShare;
    const sergioInitial = sergioGrossShare;
    const riccardoInitial = riccardoGrossShare;
    const totalNet = profittoResiduo;

    // Aggiorna Selettore Modalità UI
    const btnManual = document.getElementById('btn-mode-manual');
    const btnByExpenses = document.getElementById('btn-mode-by-expenses');
    const bannerExpenses = document.getElementById('by-expenses-info-banner');
    const sliderContainer = document.getElementById('profit-split-slider-container');
    const presetsContainer = document.getElementById('profit-split-presets-container');
    const sergioBadgeMode = document.getElementById('sergio-badge-mode');
    const riccardoBadgeMode = document.getElementById('riccardo-badge-mode');
    const riepilogoModeBadge = document.getElementById('riepilogo-mode-badge');

    if (profitSplitMode === 'by_expenses') {
        if (btnManual) {
            btnManual.className = "flex-1 py-2 px-3 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 transition-all flex items-center justify-center gap-2 cursor-pointer";
        }
        if (btnByExpenses) {
            btnByExpenses.className = "flex-1 py-2 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm bg-brand-gold text-white";
        }
        if (bannerExpenses) bannerExpenses.classList.remove('hidden');
        if (sliderContainer) sliderContainer.classList.add('hidden');
        if (presetsContainer) presetsContainer.classList.add('hidden');
        if (sergioBadgeMode) {
            sergioBadgeMode.textContent = "⚡ Auto (Spese)";
            sergioBadgeMode.className = "text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-200 text-amber-900";
        }
        if (riccardoBadgeMode) {
            riccardoBadgeMode.textContent = "⚡ Auto (Spese)";
            riccardoBadgeMode.className = "text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-200 text-blue-900";
        }
        if (riepilogoModeBadge) {
            riepilogoModeBadge.textContent = "🛒 In base alle spese";
            riepilogoModeBadge.className = "text-[10px] font-bold text-amber-400 bg-amber-950/80 border border-amber-800 px-2 py-0.5 rounded-full";
        }
    } else {
        if (btnManual) {
            btnManual.className = "flex-1 py-2 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm bg-white text-slate-900 border border-slate-200/60";
        }
        if (btnByExpenses) {
            btnByExpenses.className = "flex-1 py-2 px-3 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 transition-all flex items-center justify-center gap-2 cursor-pointer";
        }
        if (bannerExpenses) bannerExpenses.classList.add('hidden');
        if (sliderContainer) sliderContainer.classList.remove('hidden');
        if (presetsContainer) presetsContainer.classList.remove('hidden');
        if (sergioBadgeMode) {
            sergioBadgeMode.textContent = "Socio";
            sergioBadgeMode.className = "text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100/80 text-brand-gold";
        }
        if (riccardoBadgeMode) {
            riccardoBadgeMode.textContent = "Socio";
            riccardoBadgeMode.className = "text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100/80 text-blue-700";
        }
        if (riepilogoModeBadge) {
            riepilogoModeBadge.textContent = "✏️ Percentuale manuale";
            riepilogoModeBadge.className = "text-[10px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded-full";
        }
    }

    // 1. Aggiorna Input & Slider
    const sergioInput = document.getElementById('profit-split-sergio-input');
    const riccardoInput = document.getElementById('profit-split-riccardo-input');
    const slider = document.getElementById('profit-split-slider');
    const lottoBadge = document.getElementById('profit-split-lotto-badge');

    if (sergioInput) {
        sergioInput.value = sPct;
        sergioInput.disabled = (profitSplitMode === 'by_expenses');
        if (profitSplitMode === 'by_expenses') {
            sergioInput.classList.add('bg-slate-100', 'cursor-not-allowed', 'text-slate-600');
        } else {
            sergioInput.classList.remove('bg-slate-100', 'cursor-not-allowed', 'text-slate-600');
        }
    }
    if (riccardoInput) {
        riccardoInput.value = rPct;
        riccardoInput.disabled = (profitSplitMode === 'by_expenses');
        if (profitSplitMode === 'by_expenses') {
            riccardoInput.classList.add('bg-slate-100', 'cursor-not-allowed', 'text-slate-600');
        } else {
            riccardoInput.classList.remove('bg-slate-100', 'cursor-not-allowed', 'text-slate-600');
        }
    }
    if (slider && Number(slider.value) !== Math.round(sPct)) slider.value = Math.round(sPct);
    if (lottoBadge) lottoBadge.textContent = `Lotto #${currentProfitSplitLottoId}`;

    // Aggiorna Crediti Residui nelle card socio
    const splitSergioCredito = document.getElementById('split-sergio-credito-residuo');
    const splitRiccardoCredito = document.getElementById('split-riccardo-credito-residuo');
    if (splitSergioCredito) splitSergioCredito.textContent = `€ ${formatValutaEuro(creditoResiduoSergio)}`;
    if (splitRiccardoCredito) splitRiccardoCredito.textContent = `€ ${formatValutaEuro(creditoResiduoRiccardo)}`;

    // 2. Aggiorna Quadro 4 Dati Chiave
    const cardProfitto = document.getElementById('card-profitto-disponibile');
    const cardSpeseSergio = document.getElementById('card-spese-sergio');
    const cardSpeseRiccardo = document.getElementById('card-spese-riccardo');
    const cardCreditoSergio = document.getElementById('card-credito-sergio');
    const cardCreditoRiccardo = document.getElementById('card-credito-riccardo');
    const cardQuotaSergio = document.getElementById('card-quota-sergio-brief');
    const cardQuotaRiccardo = document.getElementById('card-quota-riccardo-brief');

    if (cardProfitto) cardProfitto.textContent = `€ ${formatValutaEuro(netTotalProfit)}`;
    if (cardSpeseSergio) cardSpeseSergio.textContent = `€ ${formatValutaEuro(speseSergio)}`;
    if (cardSpeseRiccardo) cardSpeseRiccardo.textContent = `€ ${formatValutaEuro(speseRiccardo)}`;
    if (cardCreditoSergio) cardCreditoSergio.textContent = `€ ${formatValutaEuro(creditoResiduoSergio)}`;
    if (cardCreditoRiccardo) cardCreditoRiccardo.textContent = `€ ${formatValutaEuro(creditoResiduoRiccardo)}`;
    if (cardQuotaSergio) cardQuotaSergio.textContent = `${sPct}% (€ ${formatValutaEuro(sergioResidualShare)})`;
    if (cardQuotaRiccardo) cardQuotaRiccardo.textContent = `${rPct}% (€ ${formatValutaEuro(riccardoResidualShare)})`;

    // 3. Aggiorna anteprime quote accanto agli input
    const sergioPreview = document.getElementById('split-sergio-share-preview');
    const riccardoPreview = document.getElementById('split-riccardo-share-preview');
    if (sergioPreview) {
        if (sergioResidualShare < 0) {
            sergioPreview.textContent = `-€ ${formatValutaEuro(Math.abs(sergioResidualShare))}`;
            sergioPreview.className = 'text-base font-black text-rose-600 font-mono';
        } else {
            sergioPreview.textContent = `€ ${formatValutaEuro(sergioResidualShare)}`;
            sergioPreview.className = 'text-base font-black text-brand-gold font-mono';
        }
    }
    if (riccardoPreview) {
        if (riccardoResidualShare < 0) {
            riccardoPreview.textContent = `-€ ${formatValutaEuro(Math.abs(riccardoResidualShare))}`;
            riccardoPreview.className = 'text-base font-black text-rose-600 font-mono';
        } else {
            riccardoPreview.textContent = `€ ${formatValutaEuro(riccardoResidualShare)}`;
            riccardoPreview.className = 'text-base font-black text-blue-700 font-mono';
        }
    }

    // 4. Aggiorna Riepilogo Finale Conti Lotto
    const rProfittoLotto = document.getElementById('riepilogo-profitto-lotto');
    const rSpeseSergio = document.getElementById('riepilogo-spese-sergio');
    const rSpeseRiccardo = document.getElementById('riepilogo-spese-riccardo');
    const rCreditoSergio = document.getElementById('riepilogo-credito-sergio');
    const rCreditoRiccardo = document.getElementById('riepilogo-credito-riccardo');
    const rProfittoResiduo = document.getElementById('riepilogo-profitto-residuo');
    const rSergioPct = document.getElementById('riepilogo-sergio-pct');
    const rSergioQuota = document.getElementById('riepilogo-sergio-quota');
    const rRiccardoPct = document.getElementById('riepilogo-riccardo-pct');
    const rRiccardoQuota = document.getElementById('riepilogo-riccardo-quota');
    const rTotaleAssegnato = document.getElementById('riepilogo-totale-assegnato');

    if (rProfittoLotto) rProfittoLotto.textContent = `€ ${formatValutaEuro(netTotalProfit)}`;
    if (rSpeseSergio) rSpeseSergio.textContent = `-€ ${formatValutaEuro(speseSergio)}`;
    if (rSpeseRiccardo) rSpeseRiccardo.textContent = `-€ ${formatValutaEuro(speseRiccardo)}`;
    if (rCreditoSergio) rCreditoSergio.textContent = `€ ${formatValutaEuro(creditoResiduoSergio)}`;
    if (rCreditoRiccardo) rCreditoRiccardo.textContent = `€ ${formatValutaEuro(creditoResiduoRiccardo)}`;

    if (rProfittoResiduo) {
        if (profittoResiduo < 0) {
            rProfittoResiduo.textContent = `-€ ${formatValutaEuro(Math.abs(profittoResiduo))}`;
            rProfittoResiduo.className = 'text-lg font-black text-rose-400 font-mono';
        } else {
            rProfittoResiduo.textContent = `€ ${formatValutaEuro(profittoResiduo)}`;
            rProfittoResiduo.className = 'text-lg font-black text-amber-300 font-mono';
        }
    }

    if (rSergioPct) rSergioPct.textContent = sPct;
    if (rSergioQuota) {
        if (sergioResidualShare < 0) {
            rSergioQuota.textContent = `-€ ${formatValutaEuro(Math.abs(sergioResidualShare))}`;
            rSergioQuota.className = 'font-mono font-bold text-rose-400 text-sm';
        } else {
            rSergioQuota.textContent = `€ ${formatValutaEuro(sergioResidualShare)}`;
            rSergioQuota.className = 'font-mono font-bold text-emerald-400 text-sm';
        }
    }

    if (rRiccardoPct) rRiccardoPct.textContent = rPct;
    if (rRiccardoQuota) {
        if (riccardoResidualShare < 0) {
            rRiccardoQuota.textContent = `-€ ${formatValutaEuro(Math.abs(riccardoResidualShare))}`;
            rRiccardoQuota.className = 'font-mono font-bold text-rose-400 text-sm';
        } else {
            rRiccardoQuota.textContent = `€ ${formatValutaEuro(riccardoResidualShare)}`;
            rRiccardoQuota.className = 'font-mono font-bold text-emerald-400 text-sm';
        }
    }

    if (rTotaleAssegnato) {
        if (totaleAssegnato < 0) {
            rTotaleAssegnato.textContent = `-€ ${formatValutaEuro(Math.abs(totaleAssegnato))}`;
            rTotaleAssegnato.className = 'text-xl font-black text-rose-400 font-mono';
        } else {
            rTotaleAssegnato.textContent = `€ ${formatValutaEuro(totaleAssegnato)}`;
            rTotaleAssegnato.className = 'text-xl font-black text-emerald-400 font-mono';
        }
    }

    // 5. Aggiorna le 4 Card KPI in cima
    const totalProfitEl = document.getElementById('split-total-profit');
    const ordersProfitEl = document.getElementById('split-orders-profit');
    const alibabaFeeEl = document.getElementById('split-alibaba-fee');
    const totalOrdersCountEl = document.getElementById('split-total-orders-count');
    const sergioInitialEl = document.getElementById('split-sergio-initial');
    const sergioWithdEl = document.getElementById('split-sergio-withdrawals');
    const sergioNetEl = document.getElementById('split-sergio-net');
    const sergioStatusEl = document.getElementById('split-sergio-status');
    const riccardoInitialEl = document.getElementById('split-riccardo-initial');
    const riccardoWithdEl = document.getElementById('split-riccardo-withdrawals');
    const riccardoNetEl = document.getElementById('split-riccardo-net');
    const riccardoStatusEl = document.getElementById('split-riccardo-status');
    const totalNetEl = document.getElementById('split-total-net');
    const totalNetStatusEl = document.getElementById('split-total-net-status');

    if (totalProfitEl) totalProfitEl.textContent = `€ ${formatValutaEuro(netTotalProfit)}`;
    if (ordersProfitEl) ordersProfitEl.textContent = `€ ${formatValutaEuro(ordersProfit)}`;
    if (alibabaFeeEl) alibabaFeeEl.textContent = `-€ ${formatValutaEuro(alibabaFeeEur)}`;
    if (totalOrdersCountEl) totalOrdersCountEl.textContent = summary.total_orders || 0;

    if (sergioInitialEl) sergioInitialEl.textContent = `€ ${formatValutaEuro(sergioInitial)}`;
    if (sergioWithdEl) sergioWithdEl.textContent = `-€ ${formatValutaEuro(speseSergio)}`;
    if (sergioNetEl) {
        if (sergioNet < 0) {
            sergioNetEl.textContent = `-€ ${formatValutaEuro(Math.abs(sergioNet))}`;
            sergioNetEl.className = 'text-xl font-black text-rose-600 font-mono';
        } else if (sergioNet > 0) {
            sergioNetEl.textContent = `€ ${formatValutaEuro(sergioNet)}`;
            sergioNetEl.className = 'text-xl font-black text-emerald-600 font-mono';
        } else {
            sergioNetEl.textContent = `€ 0,00`;
            sergioNetEl.className = 'text-xl font-black text-slate-700 font-mono';
        }
    }
    if (sergioStatusEl) {
        if (sergioNet < 0) {
            sergioStatusEl.innerHTML = `<span class="inline-flex items-center gap-1 text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">⚠️ Sergio deve aggiungere € ${formatValutaEuro(Math.abs(sergioNet))}</span>`;
        } else if (sergioNet > 0) {
            sergioStatusEl.innerHTML = `<span class="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">Quota profitto residuo: € ${formatValutaEuro(sergioNet)}</span>`;
        } else {
            sergioStatusEl.innerHTML = `<span class="text-slate-400 font-medium">Pareggio (€ 0,00)</span>`;
        }
    }

    if (riccardoInitialEl) riccardoInitialEl.textContent = `€ ${formatValutaEuro(riccardoInitial)}`;
    if (riccardoWithdEl) riccardoWithdEl.textContent = `-€ ${formatValutaEuro(speseRiccardo)}`;
    if (riccardoNetEl) {
        if (riccardoNet < 0) {
            riccardoNetEl.textContent = `-€ ${formatValutaEuro(Math.abs(riccardoNet))}`;
            riccardoNetEl.className = 'text-xl font-black text-rose-600 font-mono';
        } else if (riccardoNet > 0) {
            riccardoNetEl.textContent = `€ ${formatValutaEuro(riccardoNet)}`;
            riccardoNetEl.className = 'text-xl font-black text-emerald-600 font-mono';
        } else {
            riccardoNetEl.textContent = `€ 0,00`;
            riccardoNetEl.className = 'text-xl font-black text-slate-700 font-mono';
        }
    }
    if (riccardoStatusEl) {
        if (riccardoNet < 0) {
            riccardoStatusEl.innerHTML = `<span class="inline-flex items-center gap-1 text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">⚠️ Riccardo deve aggiungere € ${formatValutaEuro(Math.abs(riccardoNet))}</span>`;
        } else if (riccardoNet > 0) {
            riccardoStatusEl.innerHTML = `<span class="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">Quota profitto residuo: € ${formatValutaEuro(riccardoNet)}</span>`;
        } else {
            riccardoStatusEl.innerHTML = `<span class="text-slate-400 font-medium">Pareggio (€ 0,00)</span>`;
        }
    }

    if (totalNetEl) {
        if (totalNet < 0) {
            totalNetEl.textContent = `-€ ${formatValutaEuro(Math.abs(totalNet))}`;
            totalNetEl.className = 'text-xl font-black text-rose-600 font-mono';
        } else if (totalNet > 0) {
            totalNetEl.textContent = `€ ${formatValutaEuro(totalNet)}`;
            totalNetEl.className = 'text-xl font-black text-emerald-600 font-mono';
        } else {
            totalNetEl.textContent = `€ 0,00`;
            totalNetEl.className = 'text-xl font-black text-slate-900 font-mono';
        }
    }
    if (totalNetStatusEl) {
        if (totalNet < 0) {
            totalNetStatusEl.innerHTML = `<span class="inline-flex items-center gap-1 text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">⚠️ Da aggiungere al lotto: € ${formatValutaEuro(Math.abs(totalNet))}</span>`;
        } else if (totalNet > 0) {
            totalNetStatusEl.innerHTML = `<span class="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">Saldo utile residuo complessivo</span>`;
        } else {
            totalNetStatusEl.innerHTML = `<span class="text-slate-400 font-medium">Pareggio globale</span>`;
        }
    }
}

function onSergioPercentageInput(val) {
    if (profitSplitMode === 'by_expenses') return;
    let sVal = parseFloat(val);
    if (isNaN(sVal)) sVal = 0;
    if (sVal < 0) sVal = 0;
    if (sVal > 100) sVal = 100;

    lotProfitPercentageSergio = Number(sVal.toFixed(2));
    lotProfitPercentageRiccardo = Number((100 - lotProfitPercentageSergio).toFixed(2));
    manualSavedSergioPct = lotProfitPercentageSergio;
    manualSavedRiccardoPct = lotProfitPercentageRiccardo;

    const rInput = document.getElementById('profit-split-riccardo-input');
    const slider = document.getElementById('profit-split-slider');
    if (rInput) rInput.value = lotProfitPercentageRiccardo;
    if (slider) slider.value = Math.round(lotProfitPercentageSergio);

    aggiornaSuddivisioneProfittoLive();
    salvaSuddivisioneProfittoDebounced();
}

function onRiccardoPercentageInput(val) {
    if (profitSplitMode === 'by_expenses') return;
    let rVal = parseFloat(val);
    if (isNaN(rVal)) rVal = 0;
    if (rVal < 0) rVal = 0;
    if (rVal > 100) rVal = 100;

    lotProfitPercentageRiccardo = Number(rVal.toFixed(2));
    lotProfitPercentageSergio = Number((100 - lotProfitPercentageRiccardo).toFixed(2));
    manualSavedSergioPct = lotProfitPercentageSergio;
    manualSavedRiccardoPct = lotProfitPercentageRiccardo;

    const sInput = document.getElementById('profit-split-sergio-input');
    const slider = document.getElementById('profit-split-slider');
    if (sInput) sInput.value = lotProfitPercentageSergio;
    if (slider) slider.value = Math.round(lotProfitPercentageSergio);

    aggiornaSuddivisioneProfittoLive();
    salvaSuddivisioneProfittoDebounced();
}

function onSliderPercentageInput(val) {
    if (profitSplitMode === 'by_expenses') return;
    let sVal = parseFloat(val);
    if (isNaN(sVal)) sVal = 50;
    if (sVal < 0) sVal = 0;
    if (sVal > 100) sVal = 100;

    lotProfitPercentageSergio = Math.round(sVal);
    lotProfitPercentageRiccardo = 100 - lotProfitPercentageSergio;
    manualSavedSergioPct = lotProfitPercentageSergio;
    manualSavedRiccardoPct = lotProfitPercentageRiccardo;

    const sInput = document.getElementById('profit-split-sergio-input');
    const rInput = document.getElementById('profit-split-riccardo-input');
    if (sInput) sInput.value = lotProfitPercentageSergio;
    if (rInput) rInput.value = lotProfitPercentageRiccardo;

    aggiornaSuddivisioneProfittoLive();
    salvaSuddivisioneProfittoDebounced();
}

function impostaSuddivisioneProfittoPreset(sergioPct, riccardoPct) {
    if (profitSplitMode === 'by_expenses') {
        profitSplitMode = 'manual';
    }
    lotProfitPercentageSergio = Math.round(sergioPct);
    lotProfitPercentageRiccardo = Math.round(riccardoPct);
    manualSavedSergioPct = lotProfitPercentageSergio;
    manualSavedRiccardoPct = lotProfitPercentageRiccardo;

    const sInput = document.getElementById('profit-split-sergio-input');
    const rInput = document.getElementById('profit-split-riccardo-input');
    const slider = document.getElementById('profit-split-slider');
    if (sInput) sInput.value = lotProfitPercentageSergio;
    if (rInput) rInput.value = lotProfitPercentageRiccardo;
    if (slider) slider.value = lotProfitPercentageSergio;

    aggiornaSuddivisioneProfittoLive();
    salvaSuddivisioneProfitto();
}

function salvaSuddivisioneProfittoDebounced() {
    const statusEl = document.getElementById('profit-split-save-status');
    if (statusEl) statusEl.innerHTML = `<span class="text-amber-500 font-bold animate-pulse">⏳ Modifica in corso...</span>`;

    if (saveProfitSplitDebounceTimer) clearTimeout(saveProfitSplitDebounceTimer);
    saveProfitSplitDebounceTimer = setTimeout(() => {
        salvaSuddivisioneProfitto();
    }, 600);
}

async function salvaSuddivisioneProfitto() {
    const statusEl = document.getElementById('profit-split-save-status');
    if (statusEl) statusEl.innerHTML = `<span class="text-blue-500 font-bold animate-pulse">💾 Salvataggio...</span>`;

    try {
        const response = await fetch('/api/profit-splits/lot-percentage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                lotto_id: currentProfitSplitLottoId,
                split_mode: profitSplitMode,
                sergio_percentage: manualSavedSergioPct,
                riccardo_percentage: manualSavedRiccardoPct
            })
        });
        const data = await response.json();
        if (data && data.success) {
            if (statusEl) statusEl.innerHTML = `<span class="text-emerald-600 font-bold">✅ Suddivisione salvata</span>`;
            setTimeout(() => {
                if (statusEl) statusEl.innerHTML = `<span class="text-slate-400 font-medium">💾 Salvataggio automatico</span>`;
            }, 2500);
        } else {
            if (statusEl) statusEl.innerHTML = `<span class="text-rose-600 font-bold">⚠️ Errore salvataggio</span>`;
            showToast("Errore nel salvataggio della suddivisione profitto: " + (data.error || "Errore sconosciuto"), "error");
        }
    } catch (err) {
        console.error("Errore salvataggio percentuale profitto:", err);
        if (statusEl) statusEl.innerHTML = `<span class="text-rose-600 font-bold">⚠️ Errore rete</span>`;
    }
}

// Esponi per chiamate onclick e oninput da HTML
window.cambiaModalitaSuddivisione = cambiaModalitaSuddivisione;
window.onSergioPercentageInput = onSergioPercentageInput;
window.onRiccardoPercentageInput = onRiccardoPercentageInput;
window.onSliderPercentageInput = onSliderPercentageInput;
window.impostaSuddivisioneProfittoPreset = impostaSuddivisioneProfittoPreset;
window.salvaSuddivisioneProfitto = salvaSuddivisioneProfitto;

/**
 * Carica dal server il riepilogo della suddivisione profitto e l'elenco delle modifiche registrate
 */
async function caricaSuddivisioneConti() {
    try {
        const response = await fetch('/api/profit-splits');
        const data = await response.json();

        if (data.success) {
            profitSplitData = data;
            const summary = data.summary || {};

            // Recupera lotto_id, modalità e percentuali salvate per il lotto
            currentProfitSplitLottoId = summary.lotto_id || 1;
            profitSplitMode = (summary.split_mode === 'by_expenses') ? 'by_expenses' : 'manual';

            manualSavedSergioPct = (summary.manual_sergio_percentage !== undefined && summary.manual_sergio_percentage !== null)
                ? Number(summary.manual_sergio_percentage)
                : ((summary.sergio_percentage !== undefined && summary.split_mode !== 'by_expenses') ? Number(summary.sergio_percentage) : 50);
            manualSavedRiccardoPct = (summary.manual_riccardo_percentage !== undefined && summary.manual_riccardo_percentage !== null)
                ? Number(summary.manual_riccardo_percentage)
                : (100 - manualSavedSergioPct);

            autoCalculatedSergioPct = (summary.auto_sergio_percentage !== undefined && summary.auto_sergio_percentage !== null)
                ? Number(summary.auto_sergio_percentage)
                : 50;
            autoCalculatedRiccardoPct = (summary.auto_riccardo_percentage !== undefined && summary.auto_riccardo_percentage !== null)
                ? Number(summary.auto_riccardo_percentage)
                : 50;

            if (profitSplitMode === 'by_expenses') {
                lotProfitPercentageSergio = autoCalculatedSergioPct;
                lotProfitPercentageRiccardo = autoCalculatedRiccardoPct;
            } else {
                lotProfitPercentageSergio = manualSavedSergioPct;
                lotProfitPercentageRiccardo = manualSavedRiccardoPct;
            }

            // Aggiorna l'intera interfaccia
            aggiornaSuddivisioneProfittoLive();

            // Renderizza l'elenco delle modifiche registrate
            renderTabellaModifiche(data.modifications || []);

            // Renderizza l'elenco delle spese extra del lotto
            renderTabellaSpeseExtra(data.extra_expenses || [], (data.summary && data.summary.exchange_rate) || 0.92);

            // Allinea le statistiche di incasso nella dashboard e nel riepilogo lotto
            if (typeof aggiornaStatisticheDashboard === 'function') {
                aggiornaStatisticheDashboard();
            }
            if (typeof aggiornaStatisticheLottoCorrente === 'function') {
                aggiornaStatisticheLottoCorrente();
            }
        } else {
            showToast("Errore nel caricamento della suddivisione profitto: " + (data.error || "Errore sconosciuto"), "error");
        }
    } catch (err) {
        console.error("Errore fetch /api/profit-splits:", err);
        showToast("Errore di connessione al server per la suddivisione profitto.", "error");
    }
}

/**
 * Renderizza l'elenco delle modifiche registrate o mostra lo stato iniziale pulito
 */
function renderTabellaModifiche(modificationsList) {
    const emptyState = document.getElementById('split-modifiche-empty-state');
    const tableContainer = document.getElementById('split-modifiche-table-container');
    const tbody = document.getElementById('split-modifiche-tbody');
    const countBadge = document.getElementById('split-modifiche-count-badge');

    const list = Array.isArray(modificationsList) ? modificationsList : [];

    if (countBadge) {
        countBadge.textContent = `${list.length} ${list.length === 1 ? 'modifica attiva' : 'modifiche attive'}`;
    }

    if (list.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        if (tableContainer) tableContainer.classList.add('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (tableContainer) tableContainer.classList.remove('hidden');

    if (!tbody) return;

    tbody.innerHTML = list.map(m => {
        const orderIdStr = escapeHtml(String(m.order_id || ''));
        const orderNumber = escapeHtml(String(m.order_number || m.order_id || 'ORD'));
        const customerName = escapeHtml(String(m.customer_name || 'Cliente'));
        const orderDate = escapeHtml(String(m.order_date || ''));
        const itemsText = escapeHtml(String(m.items_text || 'Completino'));
        const costEur = Number(m.cost_eur) || 0;
        const sDebit = Number(m.sergio_debit) || 0;
        const rDebit = Number(m.riccardo_debit) || 0;

        let divisionBadge = '';
        if (m.division === '100_sergio') {
            divisionBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-brand-gold font-bold text-[11px] border border-amber-200"><span>👤</span> 100% Sergio (Personale)</span>`;
        } else if (m.division === '100_riccardo') {
            divisionBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px] border border-blue-200"><span>👤</span> 100% Riccardo (Personale)</span>`;
        } else {
            divisionBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-bold text-[11px] border border-slate-200"><span>⚖️</span> 50% / 50%</span>`;
        }

        let impactHtml = '';
        if (sDebit > 0 && rDebit > 0) {
            impactHtml = `<div class="font-mono text-xs"><span class="text-brand-gold font-bold">Sergio:</span> <span class="text-rose-600 font-bold">-€ ${formatValutaEuro(sDebit)}</span> | <span class="text-blue-600 font-bold">Riccardo:</span> <span class="text-rose-600 font-bold">-€ ${formatValutaEuro(rDebit)}</span></div>`;
        } else if (sDebit > 0) {
            impactHtml = `<div class="font-mono text-xs"><span class="text-brand-gold font-bold">Sergio:</span> <span class="text-rose-600 font-black">-€ ${formatValutaEuro(sDebit)}</span> <span class="text-[10px] text-slate-400 font-sans">(Riccardo: € 0,00)</span></div>`;
        } else if (rDebit > 0) {
            impactHtml = `<div class="font-mono text-xs"><span class="text-blue-600 font-bold">Riccardo:</span> <span class="text-rose-600 font-black">-€ ${formatValutaEuro(rDebit)}</span> <span class="text-[10px] text-slate-400 font-sans">(Sergio: € 0,00)</span></div>`;
        } else {
            impactHtml = `<span class="text-slate-400 font-mono text-xs">€ 0,00</span>`;
        }

        return `
            <tr class="hover:bg-slate-50/80 transition-colors">
                <td class="px-6 py-4">
                    <div class="space-y-0.5">
                        <div class="font-bold text-slate-900 font-mono text-xs flex items-center gap-1.5">
                            <span>📦</span> ${orderNumber}
                        </div>
                        <div class="text-[11px] text-slate-400 flex items-center gap-2">
                            <span>${customerName}</span>
                            ${orderDate ? `<span>•</span><span>${orderDate}</span>` : ''}
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <div class="text-xs font-semibold text-slate-800 max-w-xs truncate" title="${itemsText}">
                        ${itemsText}
                    </div>
                </td>
                <td class="px-6 py-4 font-mono font-bold text-slate-900 text-xs">
                    € ${formatValutaEuro(costEur)}
                </td>
                <td class="px-6 py-4">
                    ${divisionBadge}
                </td>
                <td class="px-6 py-4">
                    ${impactHtml}
                </td>
                <td class="px-6 py-4 text-right space-x-2">
                    <button onclick="apriModalAggiungiModifica('${orderIdStr}')" title="Modifica impostazioni" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all inline-flex items-center gap-1">
                        <span>✏️</span> Modifica
                    </button>
                    <button onclick="eliminaModificaSuddivisione('${orderIdStr}')" title="Rimuovi modifica (torna a 50/50)" class="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs rounded-xl transition-all inline-flex items-center gap-1">
                        <span>🗑️</span> Elimina
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Avvia la modalità di selezione dell'ordine direttamente nella UI di ORDINI PRODOTTI
 */
async function avviaSelezioneOrdinePerSuddivisione() {
    try {
        if (!profitSplitData || !profitSplitData.lot_orders || profitSplitData.lot_orders.length === 0) {
            await caricaSuddivisioneConti();
        }
    } catch (e) {
        console.error("Errore precaricamento profitSplitData:", e);
    }
    orderSelectionMode = 'profitSplit';
    subTabOrdini = 'attivi';
    switchTab('ordini', true);
    renderOrdini();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast("⚖️ Seleziona l'ordine per configurare la suddivisione profitto.", "info");
}

/**
 * Esce dalla modalità selezione ordine e torna alla schermata Suddivisione Conti
 */
function esciModalitaSelezioneOrdini() {
    orderSelectionMode = null;
    switchTab('suddivisione-conti');
}

/**
 * Filtra gli ordini visualizzati nel tab ordini in base all'input di ricerca
 */
function filtraOrdiniCards() {
    const input = document.getElementById('ordini-search-input');
    ordiniSearchQuery = input ? input.value.trim().toLowerCase() : '';
    renderOrdini();
}

/**
 * Handler quando l'utente clicca su una card per selezionare l'ordine per la suddivisione
 */
function selezionaOrdinePerModificaSuddivisione(orderIdOrKey) {
    apriModalAggiungiModifica(orderIdOrKey);
}

/**
 * Apre il modal per selezionare un ordine del lotto e configurare una modifica/eccezione
 */
function apriModalAggiungiModifica(orderIdToSelect) {
    const modal = document.getElementById('modal-modifica-suddivisione');
    const container = document.getElementById('modal-modifica-suddivisione-container');
    const select = document.getElementById('modal-modifica-order-select');
    const warning = document.getElementById('modal-modifica-order-warning');
    const orderCard = document.getElementById('modal-modifica-order-card');
    const divisionSec = document.getElementById('modal-modifica-division-section');
    const saveBtn = document.getElementById('btn-salva-modifica');
    const modalTitle = document.getElementById('modal-modifica-title');

    if (!select) return;

    // Popola select con gli ordini del lotto
    const lotOrders = (profitSplitData && profitSplitData.lot_orders) ? profitSplitData.lot_orders : [];
    select.innerHTML = '<option value="">-- Seleziona un ordine dal lotto attivo --</option>';

    lotOrders.forEach(o => {
        const hasMod = (profitSplitData && profitSplitData.modifications && Array.isArray(profitSplitData.modifications))
            ? profitSplitData.modifications.some(m => String(m.order_id) === String(o.order_id) || String(m.order_data_key) === String(o.order_data_key))
            : false;
        const opt = document.createElement('option');
        opt.value = String(o.order_id);
        const tag = hasMod ? ' [Modifica attiva]' : '';
        opt.textContent = `${o.order_number || o.order_id} — ${o.customer_name || 'Cliente'} (${o.items_text || 'Completino'})${tag}`;
        select.appendChild(opt);
    });

    if (warning) warning.classList.add('hidden');
    if (orderCard) orderCard.classList.add('hidden');
    if (divisionSec) divisionSec.classList.add('hidden');
    if (saveBtn) saveBtn.disabled = true;
    selectedModificaOrder = null;

    if (orderIdToSelect) {
        select.value = String(orderIdToSelect);
        onSelectOrdineModifica(String(orderIdToSelect));
        if (modalTitle) modalTitle.textContent = "Modifica Suddivisione Ordine";
    } else {
        if (modalTitle) modalTitle.textContent = "Aggiungi Modifica Suddivisione";
    }

    if (modal && container) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            container.classList.remove('opacity-0', 'scale-95');
            container.classList.add('opacity-100', 'scale-100');
        }, 10);
    }
}

/**
 * Chiude il modal di aggiunta / modifica suddivisione
 */
function chiudiModalModificaSuddivisione() {
    const modal = document.getElementById('modal-modifica-suddivisione');
    const container = document.getElementById('modal-modifica-suddivisione-container');
    if (modal && container) {
        container.classList.remove('opacity-100', 'scale-100');
        container.classList.add('opacity-0', 'scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
            selectedModificaOrder = null;
        }, 200);
    }
}

/**
 * Handler quando l'utente seleziona un ordine dal dropdown nel modal
 */
function onSelectOrdineModifica(orderId) {
    const warning = document.getElementById('modal-modifica-order-warning');
    const orderCard = document.getElementById('modal-modifica-order-card');
    const divisionSec = document.getElementById('modal-modifica-division-section');
    const saveBtn = document.getElementById('btn-salva-modifica');

    if (!orderId) {
        selectedModificaOrder = null;
        if (warning) warning.classList.add('hidden');
        if (orderCard) orderCard.classList.add('hidden');
        if (divisionSec) divisionSec.classList.add('hidden');
        if (saveBtn) saveBtn.disabled = true;
        return;
    }

    const orderIdStr = String(orderId);
    let order = (profitSplitData && profitSplitData.lot_orders) 
        ? profitSplitData.lot_orders.find(o => String(o.order_id) === orderIdStr || String(o.order_data_key) === orderIdStr)
        : null;

    if (!order) {
        const rawOrder = ordini.find(o => String(o.id) === orderIdStr || String(o.data) === orderIdStr);
        if (rawOrder) {
            const costEur = parseFloat((rawOrder["Costo totale (EUR)"] || '0').replace(/\./g, '').replace(',', '.')) || 0;
            const profitEur = parseFloat((rawOrder["Profitto (EUR)"] || '0').replace(/\./g, '').replace(',', '.')) || 0;
            order = {
                order_id: String(rawOrder.id || rawOrder.data),
                order_data_key: String(rawOrder.data || ''),
                order_number: rawOrder["Numero Ordine"] || rawOrder.order_number || (rawOrder.id ? `#${rawOrder.id}` : (rawOrder.data || 'ORD')),
                customer_name: rawOrder.nome || 'Cliente',
                order_date: rawOrder.data || '',
                items_text: rawOrder.squadra || 'Completino',
                profit_total: profitEur,
                cost_eur: costEur
            };
        }
    }

    if (!order) {
        showToast("Ordine non trovato.", "error");
        return;
    }

    selectedModificaOrder = order;

    // Popola dati order card
    const numEl = document.getElementById('modal-modifica-order-number');
    const custEl = document.getElementById('modal-modifica-order-customer');
    const dateEl = document.getElementById('modal-modifica-order-date');
    const itemsEl = document.getElementById('modal-modifica-order-items');
    const profitEl = document.getElementById('modal-modifica-order-profit');
    const costEl = document.getElementById('modal-modifica-order-cost');
    const costInput = document.getElementById('modal-modifica-cost-input');

    if (numEl) numEl.textContent = order.order_number || order.order_id;
    if (custEl) custEl.textContent = order.customer_name || 'Cliente';
    if (dateEl) dateEl.textContent = order.order_date || '';
    if (itemsEl) itemsEl.textContent = order.items_text || 'Completino';
    if (profitEl) profitEl.textContent = `€ ${formatValutaEuro(order.profit_total)}`;
    if (costEl) costEl.textContent = `€ ${formatValutaEuro(order.cost_eur)}`;

    // Controlla se ha già una modifica salvata
    const existingMod = getModificaForOrder(order);
    if (existingMod) {
        if (warning) warning.classList.remove('hidden');
        const radios = document.getElementsByName('modal-modifica-division');
        radios.forEach(r => {
            if (r.value === existingMod.division) r.checked = true;
        });
        if (costInput) costInput.value = existingMod.cost_eur !== undefined ? existingMod.cost_eur : order.cost_eur;
    } else {
        if (warning) warning.classList.add('hidden');
        const radios = document.getElementsByName('modal-modifica-division');
        radios.forEach(r => {
            if (r.value === '100_sergio') r.checked = true;
        });
        if (costInput) costInput.value = order.cost_eur || 0;
    }

    if (orderCard) orderCard.classList.remove('hidden');
    if (divisionSec) divisionSec.classList.remove('hidden');
    if (saveBtn) saveBtn.disabled = false;
}

/**
 * Invia la modifica al server
 */
async function salvaModificaSuddivisione() {
    if (!selectedModificaOrder) {
        showToast("Seleziona prima un ordine del lotto.", "error");
        return;
    }

    const radios = document.getElementsByName('modal-modifica-division');
    let chosenDivision = '50_50';
    radios.forEach(r => {
        if (r.checked) chosenDivision = r.value;
    });

    const costInput = document.getElementById('modal-modifica-cost-input');
    const customCost = costInput && costInput.value !== '' ? parseFloat(costInput.value) : selectedModificaOrder.cost_eur;

    const btn = document.getElementById('btn-salva-modifica');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span class="animate-spin">⏳</span> Salvataggio...`;
    }

    try {
        const response = await fetch('/api/profit-splits/modification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                order_id: selectedModificaOrder.order_id,
                order_data_key: selectedModificaOrder.order_data_key,
                division: chosenDivision,
                cost_eur: customCost
            })
        });

        const data = await response.json();
        if (data.success) {
            showToast("✅ Modifica suddivisione salvata con successo.", "success");
            orderSelectionMode = null;
            chiudiModalModificaSuddivisione();
            switchTab('suddivisione-conti');
            await caricaSuddivisioneConti();
        } else {
            showToast("⚠️ " + (data.error || "Impossibile salvare la modifica."), "error");
        }
    } catch (err) {
        console.error("Errore salvataggio modifica suddivisione:", err);
        showToast("Errore di connessione al server.", "error");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<span>💾</span> Salva Modifica`;
        }
    }
}

/**
 * Elimina una modifica/eccezione registrata
 */
async function eliminaModificaSuddivisione(orderId) {
    if (!orderId) return;

    if (!confirm("Sei sicuro di voler eliminare questa modifica? L'ordine tornerà automaticamente alla suddivisione standard 50% / 50%.")) {
        return;
    }

    try {
        const response = await fetch(`/api/profit-splits/modification/${encodeURIComponent(orderId)}`, {
            method: 'DELETE'
        });

        const data = await response.json();
        if (data.success) {
            showToast("✅ Modifica rimossa. Suddivisione ripristinata a 50/50.", "success");
            await caricaSuddivisioneConti();
        } else {
            showToast("Errore durante l'eliminazione: " + (data.error || "Errore sconosciuto"), "error");
        }
    } catch (err) {
        console.error("Errore eliminazione modifica suddivisione:", err);
        showToast("Errore di connessione al server.", "error");
    }
}

/**
 * Renderizza la tabella delle Spese Extra del lotto
 */
function renderTabellaSpeseExtra(extraExpensesList, exchangeRate) {
    const emptyState = document.getElementById('split-extra-empty-state');
    const tableContainer = document.getElementById('split-extra-table-container');
    const tbody = document.getElementById('split-extra-tbody');
    const countBadge = document.getElementById('split-extra-count-badge');

    const list = Array.isArray(extraExpensesList) ? extraExpensesList : [];

    if (countBadge) {
        countBadge.textContent = `${list.length} ${list.length === 1 ? 'spesa' : 'spese'}`;
    }

    if (list.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        if (tableContainer) tableContainer.classList.add('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (tableContainer) tableContainer.classList.remove('hidden');

    if (!tbody) return;

    tbody.innerHTML = list.map(item => {
        const idStr = escapeHtml(String(item.id || ''));
        const desc = escapeHtml(String(item.description || 'Articolo extra'));
        const qty = Number(item.quantity) || 1;
        const unitUsd = Number(item.unit_price_usd) || 0;
        const totUsd = Number(item.total_usd) || (qty * unitUsd);
        const totEur = Number(item.total_eur) || 0;
        const notes = escapeHtml(String(item.notes || '—'));
        
        let assignedBadge = '';
        if (item.assigned_to === 'sergio' || item.assigned_to === '100_sergio') {
            assignedBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-bold text-[11px] border border-amber-300"><span>👤</span> Sergio (100%)</span>`;
        } else if (item.assigned_to === 'riccardo' || item.assigned_to === '100_riccardo') {
            assignedBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-900 font-bold text-[11px] border border-blue-300"><span>👤</span> Riccardo (100%)</span>`;
        } else {
            assignedBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 font-bold text-[11px] border border-slate-300"><span>⚖️</span> Altro (50% / 50%)</span>`;
        }

        return `
            <tr class="hover:bg-slate-50/80 transition-colors">
                <td class="px-6 py-4">
                    <div class="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                        <span>👟</span> ${desc}
                    </div>
                </td>
                <td class="px-6 py-4 text-center font-mono font-bold text-slate-900 text-xs">
                    ${qty}
                </td>
                <td class="px-6 py-4 text-right font-mono text-slate-600 text-xs">
                    $ ${unitUsd.toFixed(2)}
                </td>
                <td class="px-6 py-4 text-right font-mono font-bold text-slate-900 text-xs">
                    $ ${totUsd.toFixed(2)}
                </td>
                <td class="px-6 py-4 text-right font-mono font-bold text-emerald-700 text-xs">
                    € ${formatValutaEuro(totEur)}
                </td>
                <td class="px-6 py-4 text-center">
                    ${assignedBadge}
                </td>
                <td class="px-6 py-4 text-xs text-slate-500 max-w-xs truncate" title="${notes}">
                    ${notes}
                </td>
                <td class="px-6 py-4 text-right space-x-2">
                    <button onclick="apriModalSpesaExtra('${idStr}')" title="Modifica spesa extra" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all inline-flex items-center gap-1 cursor-pointer">
                        <span>✏️</span> Modifica
                    </button>
                    <button onclick="eliminaSpesaExtra('${idStr}')" title="Elimina spesa extra" class="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs rounded-xl transition-all inline-flex items-center gap-1 cursor-pointer">
                        <span>🗑️</span> Elimina
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Seleziona visivamente e programmaticamente l'assegnatario della spesa extra nel modal
 */
function selezionaAssegnatarioSpesaExtra(assigned) {
    const val = (assigned === 'riccardo' || assigned === '100_riccardo') ? 'riccardo' : ((assigned === 'altro' || assigned === '50_50') ? 'altro' : 'sergio');
    
    // Aggiorna i radio button
    const radioSergio = document.getElementById('spesa-extra-radio-sergio');
    const radioRiccardo = document.getElementById('spesa-extra-radio-riccardo');
    const radioAltro = document.getElementById('spesa-extra-radio-altro');

    if (radioSergio) radioSergio.checked = (val === 'sergio');
    if (radioRiccardo) radioRiccardo.checked = (val === 'riccardo');
    if (radioAltro) radioAltro.checked = (val === 'altro');

    // Elementi Card
    const cardSergio = document.getElementById('spesa-extra-card-sergio');
    const cardRiccardo = document.getElementById('spesa-extra-card-riccardo');
    const cardAltro = document.getElementById('spesa-extra-card-altro');

    // Elementi Badge Spunta
    const checkSergio = document.getElementById('spesa-extra-check-sergio');
    const checkRiccardo = document.getElementById('spesa-extra-check-riccardo');
    const checkAltro = document.getElementById('spesa-extra-check-altro');

    // Reset stili
    if (cardSergio) {
        if (val === 'sergio') {
            cardSergio.className = "relative flex flex-col p-3 rounded-xl border-2 cursor-pointer transition-all select-none border-amber-500 bg-amber-50/70 ring-2 ring-amber-300/60 shadow-xs";
            if (checkSergio) checkSergio.className = "inline-flex items-center px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 font-extrabold text-[10px]";
        } else {
            cardSergio.className = "relative flex flex-col p-3 rounded-xl border-2 cursor-pointer transition-all select-none border-slate-200 bg-white hover:border-amber-300";
            if (checkSergio) checkSergio.className = "hidden items-center px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 font-extrabold text-[10px]";
        }
    }

    if (cardRiccardo) {
        if (val === 'riccardo') {
            cardRiccardo.className = "relative flex flex-col p-3 rounded-xl border-2 cursor-pointer transition-all select-none border-blue-600 bg-blue-50/70 ring-2 ring-blue-300/60 shadow-xs";
            if (checkRiccardo) checkRiccardo.className = "inline-flex items-center px-1.5 py-0.5 rounded bg-blue-200 text-blue-900 font-extrabold text-[10px]";
        } else {
            cardRiccardo.className = "relative flex flex-col p-3 rounded-xl border-2 cursor-pointer transition-all select-none border-slate-200 bg-white hover:border-blue-300";
            if (checkRiccardo) checkRiccardo.className = "hidden items-center px-1.5 py-0.5 rounded bg-blue-200 text-blue-900 font-extrabold text-[10px]";
        }
    }

    if (cardAltro) {
        if (val === 'altro') {
            cardAltro.className = "relative flex flex-col p-3 rounded-xl border-2 cursor-pointer transition-all select-none border-slate-800 bg-slate-100 ring-2 ring-slate-300/80 shadow-xs";
            if (checkAltro) checkAltro.className = "inline-flex items-center px-1.5 py-0.5 rounded bg-slate-300 text-slate-900 font-extrabold text-[10px]";
        } else {
            cardAltro.className = "relative flex flex-col p-3 rounded-xl border-2 cursor-pointer transition-all select-none border-slate-200 bg-white hover:border-slate-300";
            if (checkAltro) checkAltro.className = "hidden items-center px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 font-extrabold text-[10px]";
        }
    }
}

/**
 * Calcolo live del totale USD ed EUR nella modale Spesa Extra
 */
function calcolaTotaleSpesaExtraLive() {
    const qtyInput = document.getElementById('modal-spesa-extra-qty');
    const priceUsdInput = document.getElementById('modal-spesa-extra-price-usd');
    const rateBadge = document.getElementById('modal-spesa-extra-rate-badge');
    const totalUsdEl = document.getElementById('modal-spesa-extra-total-usd-preview');
    const totalEurEl = document.getElementById('modal-spesa-extra-total-eur-preview');

    const qty = parseInt(qtyInput ? qtyInput.value : '1', 10) || 1;
    const priceUsd = parseFloat(priceUsdInput ? priceUsdInput.value.replace(',', '.') : '0') || 0;
    
    const rate = (profitSplitData && profitSplitData.summary && profitSplitData.summary.exchange_rate)
        ? Number(profitSplitData.summary.exchange_rate)
        : 0.92;

    if (rateBadge) {
        rateBadge.textContent = `1 USD = ${rate.toFixed(4).replace('.', ',')} EUR`;
    }

    const totalUsd = qty * priceUsd;
    const totalEur = totalUsd * rate;

    if (totalUsdEl) totalUsdEl.textContent = `$ ${totalUsd.toFixed(2)}`;
    if (totalEurEl) totalEurEl.textContent = `€ ${formatValutaEuro(totalEur)}`;
}

/**
 * Apre la modale per aggiungere o modificare una spesa extra
 */
function apriModalSpesaExtra(spesaId) {
    const modal = document.getElementById('modal-spesa-extra');
    const container = document.getElementById('modal-spesa-extra-container');
    const idInput = document.getElementById('modal-spesa-extra-id');
    const titleEl = document.getElementById('modal-spesa-extra-title');
    const descInput = document.getElementById('modal-spesa-extra-desc');
    const qtyInput = document.getElementById('modal-spesa-extra-qty');
    const priceUsdInput = document.getElementById('modal-spesa-extra-price-usd');
    const notesInput = document.getElementById('modal-spesa-extra-notes');

    if (!modal || !container) return;

    if (spesaId) {
        const extraList = (profitSplitData && profitSplitData.extra_expenses) ? profitSplitData.extra_expenses : [];
        const existing = extraList.find(e => String(e.id) === String(spesaId));
        if (existing) {
            if (idInput) idInput.value = existing.id;
            if (titleEl) titleEl.textContent = "Modifica Spesa Extra";
            if (descInput) descInput.value = existing.description || '';
            if (qtyInput) qtyInput.value = existing.quantity || 1;
            if (priceUsdInput) priceUsdInput.value = existing.unit_price_usd !== undefined ? existing.unit_price_usd : '';
            if (notesInput) notesInput.value = existing.notes || '';
            
            const assigned = existing.assigned_to || 'sergio';
            selezionaAssegnatarioSpesaExtra(assigned);
        }
    } else {
        if (idInput) idInput.value = '';
        if (titleEl) titleEl.textContent = "Aggiungi Spesa Extra del Lotto";
        if (descInput) descInput.value = '';
        if (qtyInput) qtyInput.value = 1;
        if (priceUsdInput) priceUsdInput.value = '';
        if (notesInput) notesInput.value = '';
        selezionaAssegnatarioSpesaExtra('sergio');
    }

    calcolaTotaleSpesaExtraLive();

    modal.classList.remove('hidden');
    setTimeout(() => {
        container.classList.remove('opacity-0', 'scale-95');
        container.classList.add('opacity-100', 'scale-100');
    }, 10);
}

/**
 * Chiude la modale spesa extra
 */
function chiudiModalSpesaExtra() {
    const modal = document.getElementById('modal-spesa-extra');
    const container = document.getElementById('modal-spesa-extra-container');
    if (modal && container) {
        container.classList.remove('opacity-100', 'scale-100');
        container.classList.add('opacity-0', 'scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 200);
    }
}

/**
 * Salva la spesa extra sul server (creazione o aggiornamento)
 */
async function salvaSpesaExtra() {
    const idInput = document.getElementById('modal-spesa-extra-id');
    const descInput = document.getElementById('modal-spesa-extra-desc');
    const qtyInput = document.getElementById('modal-spesa-extra-qty');
    const priceUsdInput = document.getElementById('modal-spesa-extra-price-usd');
    const notesInput = document.getElementById('modal-spesa-extra-notes');
    const radios = document.getElementsByName('modal-spesa-extra-assigned');
    const btn = document.getElementById('btn-salva-spesa-extra');

    const desc = descInput ? descInput.value.trim() : '';
    if (!desc) {
        showToast("Inserisci il tipo o la descrizione dell'articolo.", "error");
        if (descInput) descInput.focus();
        return;
    }

    const qty = parseInt(qtyInput ? qtyInput.value : '1', 10);
    if (isNaN(qty) || qty < 1) {
        showToast("La quantità deve essere un numero intero di almeno 1.", "error");
        if (qtyInput) qtyInput.focus();
        return;
    }

    const priceUsd = parseFloat(priceUsdInput ? priceUsdInput.value.replace(',', '.') : '');
    if (isNaN(priceUsd) || priceUsd < 0) {
        showToast("Inserisci un prezzo unitario in USD valido (es. 3.00).", "error");
        if (priceUsdInput) priceUsdInput.focus();
        return;
    }

    let assigned = 'sergio';
    radios.forEach(r => {
        if (r.checked) assigned = r.value;
    });

    const spesaId = idInput ? idInput.value.trim() : '';
    const lotId = (profitSplitData && profitSplitData.summary && profitSplitData.summary.lotto_id) || currentProfitSplitLottoId || 1;

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span class="animate-spin">⏳</span> Salvataggio...`;
    }

    try {
        const response = await fetch('/api/profit-splits/extra-expense', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: spesaId || undefined,
                lotto_id: lotId,
                description: desc,
                quantity: qty,
                unit_price_usd: priceUsd,
                assigned_to: assigned,
                notes: notesInput ? notesInput.value.trim() : ''
            })
        });

        const data = await response.json();
        if (data.success) {
            showToast("✅ Spesa extra registrata con successo.", "success");
            chiudiModalSpesaExtra();
            await caricaSuddivisioneConti();
        } else {
            showToast("⚠️ " + (data.error || "Impossibile salvare la spesa extra."), "error");
        }
    } catch (err) {
        console.error("Errore salvataggio spesa extra:", err);
        showToast("Errore di connessione al server.", "error");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<span>💾</span> Salva Spesa`;
        }
    }
}

/**
 * Elimina una spesa extra registrata
 */
async function eliminaSpesaExtra(spesaId) {
    if (!spesaId) return;

    if (!confirm("Sei sicuro di voler eliminare questa spesa extra? L'importo verrà ricalcolato automaticamente nel profitto del lotto.")) {
        return;
    }

    try {
        const response = await fetch(`/api/profit-splits/extra-expense/${encodeURIComponent(spesaId)}`, {
            method: 'DELETE'
        });

        const data = await response.json();
        if (data.success) {
            showToast("✅ Spesa extra eliminata.", "success");
            await caricaSuddivisioneConti();
        } else {
            showToast("Errore durante l'eliminazione: " + (data.error || "Errore sconosciuto"), "error");
        }
    } catch (err) {
        console.error("Errore eliminazione spesa extra:", err);
        showToast("Errore di connessione al server.", "error");
    }
}

// Esporta su window per binding con HTML onclick/oninput/onchange
window.caricaSuddivisioneConti = caricaSuddivisioneConti;
window.renderTabellaModifiche = renderTabellaModifiche;
window.renderTabellaSpeseExtra = renderTabellaSpeseExtra;
window.calcolaTotaleSpesaExtraLive = calcolaTotaleSpesaExtraLive;
window.apriModalSpesaExtra = apriModalSpesaExtra;
window.chiudiModalSpesaExtra = chiudiModalSpesaExtra;
window.salvaSpesaExtra = salvaSpesaExtra;
window.eliminaSpesaExtra = eliminaSpesaExtra;
window.avviaSelezioneOrdinePerSuddivisione = avviaSelezioneOrdinePerSuddivisione;
window.esciModalitaSelezioneOrdini = esciModalitaSelezioneOrdini;
window.filtraOrdiniCards = filtraOrdiniCards;
window.selezionaOrdinePerModificaSuddivisione = selezionaOrdinePerModificaSuddivisione;
window.apriModalAggiungiModifica = apriModalAggiungiModifica;
window.chiudiModalModificaSuddivisione = chiudiModalModificaSuddivisione;
window.onSelectOrdineModifica = onSelectOrdineModifica;
window.salvaModificaSuddivisione = salvaModificaSuddivisione;
window.eliminaModificaSuddivisione = eliminaModificaSuddivisione;

// =========================================================================
// MODULO REVISIONE E RICLASSIFICAZIONE PRODOTTI (FASE 1)
// =========================================================================

let reclassState = {
    items: [],
    metrics: { total: 0, pending: 0, approved: 0, needs_check: 0 },
    available_teams: [],
    available_sections: [],
    available_categories: []
};
let currentReclassFilter = 'all';
let currentReclassSearch = '';

/**
 * Aggiorna il badge del contatore nella sidebar
 */
async function aggiornaBadgeRevisioneRiclassificazione() {
    try {
        const res = await fetch('/api/reclassification/items');
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.metrics) {
            const badge = document.getElementById('admin-reclass-badge');
            if (badge) {
                const count = data.metrics.pending || 0;
                badge.innerText = count;
                if (count > 0) {
                    badge.classList.remove('hidden');
                } else {
                    badge.classList.add('hidden');
                }
            }
        }
    } catch (e) {
        console.warn("⚠️ Impossibile aggiornare badge revisione:", e.message);
    }
}

/**
 * Carica tutti i prodotti in stato di revisione dal backend
 */
async function caricaRevisioneRiclassificazione() {
    const container = document.getElementById('reclass-items-container');
    if (container) {
        container.innerHTML = `
            <div class="text-center py-12 bg-white rounded-2xl border border-slate-200 text-slate-400">
                <span class="text-3xl block mb-2 animate-spin">🔄</span>
                <p class="text-sm font-semibold">Caricamento prodotti in revisione in corso...</p>
            </div>
        `;
    }

    try {
        const res = await fetch('/api/reclassification/items');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (data.success) {
            reclassState.items = data.items || [];
            reclassState.metrics = data.metrics || { total: 0, pending: 0, approved: 0, needs_check: 0 };
            reclassState.available_teams = data.available_teams || [];
            reclassState.available_sections = data.available_sections || [];
            reclassState.available_categories = data.available_categories || [];

            // Aggiorna metriche numeriche
            const totalEl = document.getElementById('reclass-metric-total');
            const pendingEl = document.getElementById('reclass-metric-pending');
            const approvedEl = document.getElementById('reclass-metric-approved');
            const needsCheckEl = document.getElementById('reclass-metric-needs-check');

            if (totalEl) totalEl.innerText = reclassState.metrics.total;
            if (pendingEl) pendingEl.innerText = reclassState.metrics.pending;
            if (approvedEl) approvedEl.innerText = reclassState.metrics.approved;
            if (needsCheckEl) needsCheckEl.innerText = reclassState.metrics.needs_check;

            // Aggiorna badge sidebar
            const badge = document.getElementById('admin-reclass-badge');
            if (badge) {
                badge.innerText = reclassState.metrics.pending;
                if (reclassState.metrics.pending > 0) {
                    badge.classList.remove('hidden');
                } else {
                    badge.classList.add('hidden');
                }
            }

            // Popola opzioni del select sezione
            popolaSelectSezioniReclass();

            // Renderizza gli elementi
            renderizzaProdottiReclass();
        } else {
            throw new Error(data.error || "Errore sconosciuto nel caricamento");
        }
    } catch (err) {
        console.error("⚠️ Errore caricaRevisioneRiclassificazione:", err);
        if (container) {
            container.innerHTML = `
                <div class="text-center py-12 bg-white rounded-2xl border border-red-200 text-red-500">
                    <span class="text-3xl block mb-2">⚠️</span>
                    <p class="text-sm font-bold">Errore durante il caricamento dei dati di revisione</p>
                    <p class="text-xs text-slate-500 mt-1">${err.message}</p>
                    <button onclick="caricaRevisioneRiclassificazione()" class="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800">
                        Riprova
                    </button>
                </div>
            `;
        }
    }
}

/**
 * Popola il menu a tendina delle sezioni nel modal di modifica
 */
function popolaSelectSezioniReclass() {
    const select = document.getElementById('reclass-edit-sezione');
    if (!select) return;

    const sezioniDefault = [
        "USA MLS", "Serie A", "Premier League", "La Liga", "Bundesliga", "Ligue 1",
        "Saudi Pro League", "Brasileiro Serie A", "Japan Series", "Altri Club Europei",
        "Altri Club Mondo", "Nazionali Europa", "Nazionali Sud America", "Nazionali Mondo"
    ];

    const sezioniMerge = Array.from(new Set([...sezioniDefault, ...(reclassState.available_sections || [])]))
        .filter(s => s && !s.toUpperCase().includes('NBA'));

    select.innerHTML = sezioniMerge.map(s => `<option value="${s}">${s}</option>`).join('');
}

/**
 * Filtra per stato (all, pending_reclassification, approved, needs_manual_check)
 */
function filtraStatoReclass(status) {
    currentReclassFilter = status;

    // Aggiorna stile bottoni filtri
    const buttons = {
        'all': document.getElementById('btn-reclass-filter-all'),
        'pending_reclassification': document.getElementById('btn-reclass-filter-pending'),
        'approved': document.getElementById('btn-reclass-filter-approved'),
        'needs_manual_check': document.getElementById('btn-reclass-filter-needs-check')
    };

    Object.entries(buttons).forEach(([key, btn]) => {
        if (!btn) return;
        if (key === status) {
            btn.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-white text-slate-900 shadow-xs";
        } else {
            btn.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-slate-500 hover:text-slate-900";
        }
    });

    renderizzaProdottiReclass();
}

/**
 * Filtra per testo di ricerca
 */
function filtraTestoReclass(text) {
    currentReclassSearch = (text || '').toLowerCase().trim();
    renderizzaProdottiReclass();
}

/**
 * Renderizza i prodotti in revisione con card comparative avanzate
 */
function renderizzaProdottiReclass() {
    const container = document.getElementById('reclass-items-container');
    if (!container) return;

    let items = reclassState.items || [];

    // Filtro per stato
    if (currentReclassFilter !== 'all') {
        items = items.filter(it => it.status === currentReclassFilter);
    }

    // Filtro per ricerca testuale
    if (currentReclassSearch) {
        items = items.filter(it => {
            const sqOrig = (it.squadra_originale || '').toLowerCase();
            const sqProp = (it.proposta && it.proposta.squadra_proposta ? it.proposta.squadra_proposta : '').toLowerCase();
            const ver = (it.versione || '').toLowerCase();
            const nome = (it.nome_finale || it.nome || '').toLowerCase();
            const legId = String(it.legacy_id || '');
            const pId = String(it.product_id || '').toLowerCase();
            return sqOrig.includes(currentReclassSearch) ||
                   sqProp.includes(currentReclassSearch) ||
                   ver.includes(currentReclassSearch) ||
                   nome.includes(currentReclassSearch) ||
                   legId.includes(currentReclassSearch) ||
                   pId.includes(currentReclassSearch);
        });
    }

    if (items.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12 bg-white rounded-2xl border border-slate-200 text-slate-400">
                <span class="text-4xl block mb-2">✨</span>
                <p class="text-sm font-bold text-slate-700">Nessun prodotto trovato</p>
                <p class="text-xs text-slate-400 mt-1">Nessun elemento corrisponde ai filtri o ai criteri di ricerca selezionati.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = items.map(item => {
        const isApproved = item.status === 'approved';
        const isNeedsCheck = item.status === 'needs_manual_check';
        const isPending = item.status === 'pending_reclassification';

        let statusBadgeHtml = '';
        if (isApproved) {
            statusBadgeHtml = `
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold">
                    <span>✅</span> Approvato & Riclassificato
                </span>
            `;
        } else if (isNeedsCheck) {
            statusBadgeHtml = `
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 border border-rose-300 text-rose-800 text-xs font-bold">
                    <span>⚠️</span> Da Verificare Manualmente
                </span>
            `;
        } else {
            statusBadgeHtml = `
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-xs font-bold">
                    <span>⏳</span> In Attesa di Revisione
                </span>
            `;
        }

        const prop = item.proposta || {};
        const safeImg = item.immagine || 'https://via.placeholder.com/300x300?text=No+Image';

        return `
            <div class="bg-white border ${isApproved ? 'border-emerald-300 ring-1 ring-emerald-300/50' : (isNeedsCheck ? 'border-rose-300' : 'border-slate-200')} rounded-2xl p-5 md:p-6 shadow-sm hover:shadow-md transition-all space-y-5">
                <!-- Header Card: Info Prodotto & Status -->
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div class="flex items-start gap-4">
                        <div class="relative group shrink-0">
                            <img src="${safeImg}" alt="Prodotto" class="w-16 h-16 md:w-20 md:h-20 rounded-xl object-cover bg-slate-50 border border-slate-200">
                        </div>
                        <div class="space-y-1">
                            <div class="flex flex-wrap items-center gap-2">
                                <span class="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-800 text-[11px] font-mono font-bold rounded-md">
                                    ID: #${item.legacy_id || item.product_id}
                                </span>
                                <span class="px-2 py-0.5 bg-brand-gold/15 text-brand-gold text-[11px] font-bold rounded-md">
                                    ${item.target || 'Adulto'}
                                </span>
                                <span class="px-2 py-0.5 bg-slate-100 text-slate-600 text-[11px] font-semibold rounded-md">
                                    ${item.stagione || '2026/2027'}
                                </span>
                                <span class="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded-md font-mono">
                                    € ${(Number(item.prezzo) || 0).toFixed(2)}
                                </span>
                            </div>
                            <h3 class="text-sm md:text-base font-black text-slate-900">
                                ${item.nome_finale || item.nome || (item.squadra_originale + ' - ' + item.versione)}
                            </h3>
                            <p class="text-xs text-slate-500 font-medium truncate max-w-xl">
                                Versione: ${item.versione || 'Standard'}
                            </p>
                        </div>
                    </div>
                    <div class="flex md:flex-col items-end justify-between md:justify-center gap-2 shrink-0">
                        ${statusBadgeHtml}
                        <span class="text-[10px] text-slate-400 font-medium">
                            Aggiornato: ${new Date(item.ultimo_aggiornamento || item.creato_il).toLocaleDateString('it-IT')}
                        </span>
                    </div>
                </div>

                <!-- Confronto Dati: Originale vs Proposto -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <!-- Box 1: Dati Attuali (Originali) -->
                    <div class="bg-slate-50 border border-slate-200/90 rounded-xl p-4 space-y-3">
                        <div class="flex items-center justify-between border-b border-slate-200/80 pb-2">
                            <span class="text-[11px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                                <span>🔒</span> Classificazione Attuale (Dati Originali)
                            </span>
                            <span class="px-2 py-0.5 bg-slate-200 text-slate-700 text-[9px] font-bold rounded-md uppercase">Originale</span>
                        </div>
                        <div class="grid grid-cols-2 gap-2.5 text-xs">
                            <div>
                                <span class="block text-[10px] font-bold text-slate-400 uppercase">Squadra:</span>
                                <span class="font-bold text-slate-900">${item.squadra_originale || 'Nessuna'}</span>
                            </div>
                            <div>
                                <span class="block text-[10px] font-bold text-slate-400 uppercase">Categoria:</span>
                                <span class="font-semibold text-slate-800">${item.categoria_originale || 'Nessuna'}</span>
                            </div>
                            <div>
                                <span class="block text-[10px] font-bold text-slate-400 uppercase">Sezione / Lega:</span>
                                <span class="font-semibold text-slate-800">${item.sezione_originale || item.lega_originale || 'NBA'}</span>
                            </div>
                            <div>
                                <span class="block text-[10px] font-bold text-slate-400 uppercase">Paese:</span>
                                <span class="font-semibold text-slate-800">${item.paese_originale || 'USA'}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Box 2: Dati Proposti (Nuova Riclassificazione) -->
                    <div class="bg-amber-50/40 border border-amber-200/90 rounded-xl p-4 space-y-3">
                        <div class="flex items-center justify-between border-b border-amber-200 pb-2">
                            <span class="text-[11px] font-black text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                                <span>✨</span> Classificazione Proposta (Non Applicata)
                            </span>
                            <span class="px-2 py-0.5 bg-amber-200 text-amber-900 text-[9px] font-bold rounded-md uppercase">Verificata</span>
                        </div>
                        <div class="grid grid-cols-2 gap-2.5 text-xs">
                            <div>
                                <span class="block text-[10px] font-bold text-amber-700 uppercase">Squadra Proposta:</span>
                                <span class="font-black text-amber-950">${prop.squadra_proposta || 'Da Configurare'}</span>
                            </div>
                            <div>
                                <span class="block text-[10px] font-bold text-amber-700 uppercase">Categoria Proposta:</span>
                                <span class="font-bold text-amber-950">${prop.categoria_proposta || 'Club'}</span>
                            </div>
                            <div>
                                <span class="block text-[10px] font-bold text-amber-700 uppercase">Sezione Proposta:</span>
                                <span class="font-bold text-amber-950">${prop.sezione_proposta || 'USA MLS'}</span>
                            </div>
                            <div>
                                <span class="block text-[10px] font-bold text-amber-700 uppercase">Paese / Campionato:</span>
                                <span class="font-bold text-amber-950">${prop.paese_proposto || 'USA'} - ${prop.campionato_proposto || 'MLS'}</span>
                            </div>
                        </div>
                        ${prop.motivo ? `
                            <div class="pt-2 border-t border-amber-200/60 text-[11px] text-amber-800 flex items-start gap-1.5">
                                <span class="shrink-0">💡</span>
                                <span><strong>Motivo:</strong> ${prop.motivo}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>

                ${item.note_verifica ? `
                    <div class="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                        <span class="shrink-0 font-bold">⚠️ Nota Operatore:</span>
                        <span>${item.note_verifica}</span>
                    </div>
                ` : ''}

                <!-- Action Controls Bar -->
                <div class="flex flex-wrap items-center justify-end gap-2.5 pt-2">
                    <button onclick="apriModalVerifyReclass('${item.product_id}', '${item.legacy_id}')" class="px-3.5 py-2 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5">
                        <span>⚠️</span> Da Verificare
                    </button>
                    <button onclick="apriModalEditReclass('${item.product_id}', '${item.legacy_id}')" class="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm">
                        <span>✏️</span> Modifica Manuale
                    </button>
                    <button onclick="approvaPropostaReclass('${item.product_id}', '${item.legacy_id}')" class="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 shadow-md">
                        <span>✅</span> Approva e Riclassifica
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Approva la proposta automatica per un prodotto
 */
async function approvaPropostaReclass(productId, legacyId) {
    const item = reclassState.items.find(x => x.product_id === productId || String(x.legacy_id) === String(legacyId));
    if (!item) return;

    const prop = item.proposta || {};
    const confirmMsg = `Confermi l'approvazione della riclassificazione per il prodotto #${item.legacy_id || item.product_id}?\n\n` +
                       `• Squadra Destinazione: ${prop.squadra_proposta}\n` +
                       `• Categoria: ${prop.categoria_proposta || 'Club'}\n` +
                       `• Sezione: ${prop.sezione_proposta || 'USA MLS'}\n\n` +
                       `Un backup di sicurezza snapshot verrà registrato automaticamente.`;

    if (!confirm(confirmMsg)) return;

    try {
        const res = await fetch('/api/reclassification/approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product_id: productId, legacy_id: legacyId })
        });

        const data = await res.json();
        if (data.success) {
            showToast(`✅ Prodotto #${item.legacy_id || item.product_id} riclassificato con successo! Backup #${data.backup_id} creato.`, "success");
            await caricaRevisioneRiclassificazione();
        } else {
            showToast(`Errore: ${data.error || "Impossibile approvare"}`, "error");
        }
    } catch (err) {
        console.error("⚠️ Errore approvaPropostaReclass:", err);
        showToast("Errore di connessione al server.", "error");
    }
}

/**
 * Apre il modal di modifica manuale con suggerimenti e controllo collisioni
 */
function apriModalEditReclass(productId, legacyId) {
    const item = reclassState.items.find(x => x.product_id === productId || String(x.legacy_id) === String(legacyId));
    if (!item) return;

    const prop = item.proposta || {};

    // Popola preview
    const imgEl = document.getElementById('reclass-edit-img');
    const idBadge = document.getElementById('reclass-edit-id-badge');
    const targetBadge = document.getElementById('reclass-edit-target-badge');
    const titleEl = document.getElementById('reclass-edit-title');
    const versEl = document.getElementById('reclass-edit-versione');

    if (imgEl) imgEl.src = item.immagine || 'https://via.placeholder.com/300x300?text=No+Image';
    if (idBadge) idBadge.innerText = `ID: #${item.legacy_id || item.product_id}`;
    if (targetBadge) targetBadge.innerText = item.target || 'Adulto';
    if (titleEl) titleEl.innerText = item.nome_finale || item.nome || item.squadra_originale;
    if (versEl) versEl.innerText = item.versione || 'Standard';

    // Popola campi form
    document.getElementById('reclass-edit-product-id').value = item.product_id;
    document.getElementById('reclass-edit-legacy-id').value = item.legacy_id || '';
    document.getElementById('reclass-edit-squadra').value = prop.squadra_proposta || item.squadra_originale || '';
    document.getElementById('reclass-edit-categoria').value = prop.categoria_proposta || 'Club';
    
    // Sezione
    const sezSelect = document.getElementById('reclass-edit-sezione');
    if (sezSelect) {
        sezSelect.value = prop.sezione_proposta || 'USA MLS';
    }

    document.getElementById('reclass-edit-paese').value = prop.paese_proposto || item.paese_originale || 'USA';
    document.getElementById('reclass-edit-campionato').value = prop.campionato_proposto || 'MLS';
    document.getElementById('reclass-edit-note').value = item.note_verifica || '';

    // Controlla collisione iniziale
    gestisciAutocompleteSquadraReclass(document.getElementById('reclass-edit-squadra').value);

    // Mostra modal
    const modal = document.getElementById('modal-reclass-edit');
    if (modal) modal.classList.remove('hidden');
}

/**
 * Chiude il modal di modifica manuale
 */
function chiudiModalEditReclass() {
    const modal = document.getElementById('modal-reclass-edit');
    if (modal) modal.classList.add('hidden');
    const dropdown = document.getElementById('reclass-squadra-dropdown');
    if (dropdown) dropdown.classList.add('hidden');
}

/**
 * Gestisce l'autocomplete in tempo reale con controllo collisioni e duplicati
 */
function gestisciAutocompleteSquadraReclass(query) {
    const dropdown = document.getElementById('reclass-squadra-dropdown');
    const warningEl = document.getElementById('reclass-duplicate-warning');
    const warningText = document.getElementById('reclass-duplicate-warning-text');
    if (!dropdown) return;

    const val = (query || '').trim().toLowerCase();

    if (!val) {
        dropdown.classList.add('hidden');
        if (warningEl) warningEl.classList.add('hidden');
        return;
    }

    const matches = (reclassState.available_teams || []).filter(t => {
        return (t.name || '').toLowerCase().includes(val);
    }).slice(0, 8);

    if (matches.length > 0) {
        dropdown.innerHTML = matches.map(t => `
            <div onclick="selezionaSquadraReclassDropdown('${t.name.replace(/'/g, "\\'")}', '${t.categoria || 'Club'}', '${t.sezione || 'USA MLS'}')" class="p-2.5 hover:bg-amber-50 cursor-pointer flex items-center justify-between text-xs transition-colors">
                <span class="font-bold text-slate-800">${t.name}</span>
                <span class="text-[10px] text-slate-400 font-medium">${t.sezione || t.categoria || 'Club'}</span>
            </div>
        `).join('');
        dropdown.classList.remove('hidden');
    } else {
        dropdown.classList.add('hidden');
    }

    // Controllo collisioni (es. se digita 'Inter' mentre esiste 'Inter Miami' o viceversa)
    if (warningEl && warningText) {
        const exactMatch = (reclassState.available_teams || []).find(t => t.name.toLowerCase() === val);
        const collisionMatches = (reclassState.available_teams || []).filter(t => {
            const tLow = t.name.toLowerCase();
            return (tLow !== val && (tLow.includes(val) || val.includes(tLow)));
        });

        if (exactMatch) {
            warningEl.className = "mt-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-800 flex items-center gap-2";
            warningText.innerHTML = `<span>✅ Squadra esistente nel catalogo: <strong>${exactMatch.name}</strong></span>`;
            warningEl.classList.remove('hidden');
        } else if (collisionMatches.length > 0) {
            warningEl.className = "mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 flex items-center gap-2";
            const names = collisionMatches.map(m => m.name).slice(0, 3).join(', ');
            warningText.innerHTML = `<span>⚠️ Attenzione: rilevate squadre simili nel catalogo (<strong>${names}</strong>). Verifica di non creare un duplicato involontario.</span>`;
            warningEl.classList.remove('hidden');
        } else {
            warningEl.className = "mt-2 p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-800 flex items-center gap-2";
            warningText.innerHTML = `<span>ℹ️ Nuova squadra da creare nel catalogo: <strong>${query}</strong></span>`;
            warningEl.classList.remove('hidden');
        }
    }
}

/**
 * Seleziona una squadra dal dropdown di autocomplete
 */
function selezionaSquadraReclassDropdown(name, categoria, sezione) {
    const input = document.getElementById('reclass-edit-squadra');
    if (input) input.value = name;

    const catSelect = document.getElementById('reclass-edit-categoria');
    if (catSelect && categoria) catSelect.value = categoria;

    const sezSelect = document.getElementById('reclass-edit-sezione');
    if (sezSelect && sezione) {
        sezSelect.value = sezione;
        aggiornaCampiPaeseLegaDaSezione(sezione);
    }

    const dropdown = document.getElementById('reclass-squadra-dropdown');
    if (dropdown) dropdown.classList.add('hidden');

    gestisciAutocompleteSquadraReclass(name);
}

/**
 * Aggiorna paese e campionato in base alla sezione selezionata
 */
function aggiornaCampiPaeseLegaDaSezione(sezione) {
    const paeseInput = document.getElementById('reclass-edit-paese');
    const campInput = document.getElementById('reclass-edit-campionato');
    if (!sezione || !paeseInput || !campInput) return;

    if (sezione.includes('MLS')) {
        paeseInput.value = 'USA';
        campInput.value = 'MLS';
    } else if (sezione.includes('Serie A')) {
        paeseInput.value = 'Italia';
        campInput.value = 'Serie A';
    } else if (sezione.includes('Premier League')) {
        paeseInput.value = 'Inghilterra';
        campInput.value = 'Premier League';
    } else if (sezione.includes('La Liga')) {
        paeseInput.value = 'Spagna';
        campInput.value = 'La Liga';
    } else if (sezione.includes('Bundesliga')) {
        paeseInput.value = 'Germania';
        campInput.value = 'Bundesliga';
    } else if (sezione.includes('Ligue 1')) {
        paeseInput.value = 'Francia';
        campInput.value = 'Ligue 1';
    } else if (sezione.includes('Saudi')) {
        paeseInput.value = 'Arabia Saudita';
        campInput.value = 'Saudi Pro League';
    } else if (sezione.includes('Brasile')) {
        paeseInput.value = 'Brasile';
        campInput.value = 'Brasileiro';
    }
}

/**
 * Salva la modifica manuale con snapshot automatico
 */
async function salvaModificaManualeReclass() {
    const productId = document.getElementById('reclass-edit-product-id').value;
    const legacyId = document.getElementById('reclass-edit-legacy-id').value;
    const squadra = (document.getElementById('reclass-edit-squadra').value || '').trim();
    const categoria = document.getElementById('reclass-edit-categoria').value;
    const sezione = document.getElementById('reclass-edit-sezione').value;
    const paese = (document.getElementById('reclass-edit-paese').value || '').trim();
    const campionato = (document.getElementById('reclass-edit-campionato').value || '').trim();
    const note = (document.getElementById('reclass-edit-note').value || '').trim();

    if (!squadra) {
        alert("Inserisci il nome della squadra di destinazione.");
        return;
    }

    const payload = {
        product_id: productId,
        legacy_id: legacyId,
        squadra: squadra,
        categoria: categoria,
        sezione: sezione,
        paese: paese,
        campionato: campionato,
        note: note
    };

    try {
        const res = await fetch('/api/reclassification/manual-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.success) {
            chiudiModalEditReclass();
            showToast(`✅ Riclassificazione manuale applicata con successo! Snapshot backup #${data.backup_id} registrato.`, "success");
            await caricaRevisioneRiclassificazione();
        } else {
            showToast(`Errore: ${data.error || "Impossibile salvare"}`, "error");
        }
    } catch (err) {
        console.error("⚠️ Errore salvaModificaManualeReclass:", err);
        showToast("Errore di connessione al server.", "error");
    }
}

/**
 * Apre il modal per contrassegnare come "Da Verificare"
 */
function apriModalVerifyReclass(productId, legacyId) {
    document.getElementById('reclass-verify-product-id').value = productId;
    document.getElementById('reclass-verify-legacy-id').value = legacyId || '';
    document.getElementById('reclass-verify-motivo').value = '';

    const modal = document.getElementById('modal-reclass-verify');
    if (modal) modal.classList.remove('hidden');
}

/**
 * Chiude il modal "Da Verificare"
 */
function chiudiModalVerifyReclass() {
    const modal = document.getElementById('modal-reclass-verify');
    if (modal) modal.classList.add('hidden');
}

/**
 * Conferma la segnalazione come "Da Verificare"
 */
async function confermaSegnalaDaVerificare() {
    const productId = document.getElementById('reclass-verify-product-id').value;
    const legacyId = document.getElementById('reclass-verify-legacy-id').value;
    const note = (document.getElementById('reclass-verify-motivo').value || '').trim();

    if (!note) {
        alert("Inserisci il motivo della segnalazione o note per la verifica.");
        return;
    }

    try {
        const res = await fetch('/api/reclassification/mark-verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product_id: productId, legacy_id: legacyId, note: note })
        });

        const data = await res.json();
        if (data.success) {
            chiudiModalVerifyReclass();
            showToast(`⚠️ Prodotto #${legacyId || productId} contrassegnato per verifica manuale.`, "success");
            await caricaRevisioneRiclassificazione();
        } else {
            showToast(`Errore: ${data.error || "Impossibile registrare segnalazione"}`, "error");
        }
    } catch (err) {
        console.error("⚠️ Errore confermaSegnalaDaVerificare:", err);
        showToast("Errore di connessione al server.", "error");
    }
}

/**
 * Apre il modal dello storico dei backup & snapshot
 */
async function apriModalBackupsReclass() {
    const modal = document.getElementById('modal-reclass-backups');
    const container = document.getElementById('reclass-backups-container');
    if (modal) modal.classList.remove('hidden');

    if (container) {
        container.innerHTML = `
            <div class="text-center py-8 text-slate-400">
                <span class="animate-spin text-2xl block mb-2">🔄</span>
                <p class="text-xs font-semibold">Caricamento storico snapshot...</p>
            </div>
        `;
    }

    try {
        const res = await fetch('/api/reclassification/backups');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (data.success && Array.isArray(data.backups) && data.backups.length > 0) {
            container.innerHTML = data.backups.map(bk => {
                const orig = bk.original_data || {};
                const applied = bk.applied_data || {};
                return `
                    <div class="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <span class="px-2 py-0.5 bg-slate-200 text-slate-800 text-[10px] font-mono font-bold rounded-md">
                                    Snapshot #${bk.id}
                                </span>
                                <span class="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-md uppercase">
                                    ${bk.action_type || 'Modifica'}
                                </span>
                                <span class="text-xs font-bold text-slate-800">
                                    Prodotto #${bk.legacy_id || bk.product_id}
                                </span>
                            </div>
                            <span class="text-[10px] text-slate-400 font-medium">
                                ${new Date(bk.timestamp).toLocaleString('it-IT')}
                            </span>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white p-3 rounded-lg border border-slate-100">
                            <div>
                                <span class="block text-[10px] font-bold text-slate-400 uppercase">Valori Originali:</span>
                                <p class="font-bold text-slate-700">Squadra: <span class="text-slate-900">${orig.squadra || '-'}</span></p>
                                <p class="text-slate-500">Categoria: ${orig.categoria || '-'}</p>
                            </div>
                            <div>
                                <span class="block text-[10px] font-bold text-emerald-600 uppercase">Valori Applicati:</span>
                                <p class="font-bold text-emerald-700">Squadra: <span class="text-slate-900">${applied.squadra || '-'}</span></p>
                                <p class="text-slate-500">Categoria: ${applied.categoria || '-'}</p>
                            </div>
                        </div>

                        <div class="flex items-center justify-between pt-1">
                            <span class="text-[10px] text-slate-500 italic truncate max-w-md">
                                ${bk.note || 'Nessuna nota aggiuntiva'}
                            </span>
                            <button onclick="ripristinaBackupReclass('${bk.id}')" class="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1">
                                <span>🔄</span> Ripristina Originale
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            container.innerHTML = `
                <div class="text-center py-8 bg-slate-50 rounded-xl border border-slate-200 text-slate-400">
                    <span class="text-2xl block mb-1">📋</span>
                    <p class="text-xs font-bold text-slate-700">Nessuno snapshot registrato</p>
                    <p class="text-[11px] text-slate-400">Gli snapshot verranno creati automaticamente ogni volta che approvi o modifichi un prodotto in revisione.</p>
                </div>
            `;
        }
    } catch (err) {
        console.error("⚠️ Errore apriModalBackupsReclass:", err);
        container.innerHTML = `
            <div class="text-center py-6 text-red-500 text-xs font-bold">
                Errore durante il caricamento dello storico backup: ${err.message}
            </div>
        `;
    }
}

/**
 * Chiude il modal dello storico backup
 */
function chiudiModalBackupsReclass() {
    const modal = document.getElementById('modal-reclass-backups');
    if (modal) modal.classList.add('hidden');
}

/**
 * Ripristina un prodotto ai valori originali registrati in un backup snapshot
 */
async function ripristinaBackupReclass(backupId) {
    if (!confirm(`Sei sicuro di voler ripristinare il prodotto ai valori originali salvati nello snapshot #${backupId}?`)) {
        return;
    }

    try {
        const res = await fetch('/api/reclassification/restore-backup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ backup_id: backupId })
        });

        const data = await res.json();
        if (data.success) {
            showToast(`✅ ${data.message}`, "success");
            await caricaRevisioneRiclassificazione();
            await apriModalBackupsReclass();
        } else {
            showToast(`Errore: ${data.error || "Impossibile ripristinare"}`, "error");
        }
    } catch (err) {
        console.error("⚠️ Errore ripristinaBackupReclass:", err);
        showToast("Errore di connessione al server.", "error");
    }
}

// Esporta tutte le funzioni su window per interazione con HTML
window.aggiornaBadgeRevisioneRiclassificazione = aggiornaBadgeRevisioneRiclassificazione;
window.caricaRevisioneRiclassificazione = caricaRevisioneRiclassificazione;
window.filtraStatoReclass = filtraStatoReclass;
window.filtraTestoReclass = filtraTestoReclass;
window.approvaPropostaReclass = approvaPropostaReclass;
window.apriModalEditReclass = apriModalEditReclass;
window.chiudiModalEditReclass = chiudiModalEditReclass;
window.gestisciAutocompleteSquadraReclass = gestisciAutocompleteSquadraReclass;
window.selezionaSquadraReclassDropdown = selezionaSquadraReclassDropdown;
window.aggiornaCampiPaeseLegaDaSezione = aggiornaCampiPaeseLegaDaSezione;
window.salvaModificaManualeReclass = salvaModificaManualeReclass;
window.apriModalVerifyReclass = apriModalVerifyReclass;
window.chiudiModalVerifyReclass = chiudiModalVerifyReclass;
window.confermaSegnalaDaVerificare = confermaSegnalaDaVerificare;
window.apriModalBackupsReclass = apriModalBackupsReclass;
window.chiudiModalBackupsReclass = chiudiModalBackupsReclass;
window.ripristinaBackupReclass = ripristinaBackupReclass;

// =========================================================================
// STRUMENTO DIAGNOSTICA: ARTICOLI SENZA FILTRO CATALOGO
// =========================================================================

let reportSenzaFiltroDati = null;
let sfCurrentFilteredList = [];
let sfCurrentPage = 1;
let sfPageSize = 50;
let sfSelectedIds = new Set();
let sfActiveTeamFilter = '';
let sfActiveCategoryFilter = '';

/**
 * Avvia la scansione completa di tutti i prodotti del catalogo per individuare quelli senza Filtro Catalogo
 */
async function avviaScansioneSenzaFiltro() {
    const loadingModal = document.getElementById('modal-loading-scansione-senza-filtro');
    const reportModal = document.getElementById('modal-senza-filtro-report');
    
    // Mostra il modal di caricamento
    if (loadingModal) {
        loadingModal.classList.remove('hidden');
    }
    if (reportModal) {
        reportModal.classList.add('hidden');
    }

    const setStep = (stepNum, state) => {
        const stepEl = document.getElementById(`scan-sf-step-${stepNum}`);
        const iconEl = document.getElementById(`scan-sf-step-${stepNum}-icon`);
        if (!stepEl || !iconEl) return;
        if (state === 'active') {
            stepEl.className = 'flex items-center gap-2 text-amber-600 font-bold';
            iconEl.innerText = '⏳';
        } else if (state === 'done') {
            stepEl.className = 'flex items-center gap-2 text-emerald-600 font-bold';
            iconEl.innerText = '✓';
        } else {
            stepEl.className = 'flex items-center gap-2 text-slate-400';
            iconEl.innerText = '⏳';
        }
    };

    const updateProgressBar = (current, total) => {
        const bar = document.getElementById('scan-sf-progress-bar');
        const countText = document.getElementById('scan-sf-progress-count');
        if (bar) {
            const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
            bar.style.width = `${pct}%`;
        }
        if (countText) {
            countText.innerText = `${current} / ${total}`;
        }
    };

    setStep(1, 'active');
    setStep(2, 'idle');
    setStep(3, 'idle');
    setStep(4, 'idle');
    updateProgressBar(0, 0);

    try {
        // Step 1: Chiamata diagnostica API
        const response = await fetch('/api/catalog/no-filter-audit');
        if (!response.ok) {
            throw new Error(`Errore API HTTP ${response.status}`);
        }
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || "Errore sconosciuto durante la scansione");
        }

        setStep(1, 'done');
        setStep(2, 'active');
        updateProgressBar(Math.round(data.total_products * 0.5), data.total_products);
        await new Promise(r => setTimeout(r, 200));

        setStep(2, 'done');
        setStep(3, 'active');
        updateProgressBar(Math.round(data.total_products * 0.85), data.total_products);
        await new Promise(r => setTimeout(r, 200));

        setStep(3, 'done');
        setStep(4, 'active');
        updateProgressBar(data.total_products, data.total_products);

        // Memorizza i dati
        reportSenzaFiltroDati = data;
        sfSelectedIds.clear();
        sfActiveTeamFilter = '';
        sfActiveCategoryFilter = '';
        sfCurrentPage = 1;

        // Popola i componenti del report
        popolaMetriceReportSenzaFiltro(data);
        popolaBreakdownSquadreECategorieSenzaFiltro(data);
        popolaFiltriDropdownSenzaFiltro(data);
        filtraTabellaSenzaFiltro();

        await new Promise(r => setTimeout(r, 250));
        setStep(4, 'done');

        // Nasconde loading e apre il report
        if (loadingModal) loadingModal.classList.add('hidden');
        if (reportModal) reportModal.classList.remove('hidden');

    } catch (err) {
        console.error("🔴 Errore durante la scansione senza filtro:", err);
        if (loadingModal) loadingModal.classList.add('hidden');
        showToast("Errore durante la scansione del catalogo: " + err.message, "error");
    }
}

/**
 * Chiude il modal del report senza filtro
 */
function chiudiModalReportSenzaFiltro() {
    const reportModal = document.getElementById('modal-senza-filtro-report');
    if (reportModal) reportModal.classList.add('hidden');
}

/**
 * Popola le 4 card metriche in cima al report
 */
function popolaMetriceReportSenzaFiltro(data) {
    const elTotali = document.getElementById('stat-sf-totali-analizzati');
    const elSenzaFiltro = document.getElementById('stat-sf-totali-senza-filtro');
    const elSquadre = document.getElementById('stat-sf-squadre-totali');
    const elCategorie = document.getElementById('stat-sf-categorie-totali');

    if (elTotali) elTotali.innerText = (data.total_products || 0).toLocaleString('it-IT');
    if (elSenzaFiltro) elSenzaFiltro.innerText = (data.total_without_filter || 0).toLocaleString('it-IT');
    if (elSquadre) elSquadre.innerText = (data.teams_count || 0).toLocaleString('it-IT');
    if (elCategorie) elCategorie.innerText = (data.categories_count || 0).toLocaleString('it-IT');
}

/**
 * Popola i badge/pulsanti rapidi per Squadra e Categoria
 */
function popolaBreakdownSquadreECategorieSenzaFiltro(data) {
    const squadreContainer = document.getElementById('sf-squadre-breakdown');
    const categorieContainer = document.getElementById('sf-categorie-breakdown');

    // Squadre ordinate per numero decrescente di prodotti
    if (squadreContainer) {
        const teamsSorted = Object.entries(data.by_team || {}).sort((a, b) => b[1] - a[1]);
        if (teamsSorted.length === 0) {
            squadreContainer.innerHTML = '<span class="text-xs text-slate-400 italic">Nessun prodotto senza filtro</span>';
        } else {
            squadreContainer.innerHTML = teamsSorted.map(([team, count]) => {
                const isActive = sfActiveTeamFilter === team;
                const activeClasses = isActive 
                    ? 'bg-amber-600 text-white font-black shadow-sm' 
                    : 'bg-slate-100 hover:bg-amber-100 text-slate-800 hover:text-amber-900 border border-slate-200';
                return `
                    <button type="button" onclick="selezionaFiltroSquadraRapido('${escapeHtml(team)}')" class="px-2.5 py-1 rounded-lg text-xs transition-all flex items-center gap-1.5 ${activeClasses}">
                        <span class="font-bold">${escapeHtml(team)}</span>
                        <span class="px-1.5 py-0.2 bg-black/10 rounded-full text-[10px] font-black">${count}</span>
                    </button>
                `;
            }).join('');
        }
    }

    // Categorie ordinate per numero decrescente
    if (categorieContainer) {
        const catSorted = Object.entries(data.by_category || {}).sort((a, b) => b[1] - a[1]);
        if (catSorted.length === 0) {
            categorieContainer.innerHTML = '<span class="text-xs text-slate-400 italic">Nessuna categoria</span>';
        } else {
            categorieContainer.innerHTML = catSorted.map(([cat, count]) => {
                const isActive = sfActiveCategoryFilter === cat;
                const activeClasses = isActive
                    ? 'bg-blue-600 text-white font-black shadow-sm'
                    : 'bg-slate-100 hover:bg-blue-100 text-slate-800 hover:text-blue-900 border border-slate-200';
                return `
                    <button type="button" onclick="selezionaFiltroCategoriaRapido('${escapeHtml(cat)}')" class="px-2.5 py-1 rounded-lg text-xs transition-all flex items-center gap-1.5 ${activeClasses}">
                        <span class="font-bold">${escapeHtml(cat)}</span>
                        <span class="px-1.5 py-0.2 bg-black/10 rounded-full text-[10px] font-black">${count}</span>
                    </button>
                `;
            }).join('');
        }
    }
}

/**
 * Click rapido su una squadra
 */
function selezionaFiltroSquadraRapido(teamName) {
    if (sfActiveTeamFilter === teamName) {
        sfActiveTeamFilter = '';
    } else {
        sfActiveTeamFilter = teamName;
    }
    const searchInput = document.getElementById('sf-search-input');
    if (searchInput) searchInput.value = sfActiveTeamFilter;
    filtraTabellaSenzaFiltro();
    if (reportSenzaFiltroDati) popolaBreakdownSquadreECategorieSenzaFiltro(reportSenzaFiltroDati);
}

/**
 * Click rapido su una categoria
 */
function selezionaFiltroCategoriaRapido(catName) {
    const selCat = document.getElementById('sf-filter-categoria');
    if (selCat) {
        if (selCat.value === catName) {
            selCat.value = '';
            sfActiveCategoryFilter = '';
        } else {
            selCat.value = catName;
            sfActiveCategoryFilter = catName;
        }
    }
    filtraTabellaSenzaFiltro();
    if (reportSenzaFiltroDati) popolaBreakdownSquadreECategorieSenzaFiltro(reportSenzaFiltroDati);
}

/**
 * Popola i dropdown di filtro (Categoria, Stagione, Target)
 */
function popolaFiltriDropdownSenzaFiltro(data) {
    const selCat = document.getElementById('sf-filter-categoria');
    const selStag = document.getElementById('sf-filter-stagione');
    const selTgt = document.getElementById('sf-filter-target');

    const items = data.items || [];
    
    // Categorie univoche
    if (selCat) {
        const currentVal = selCat.value;
        const cats = [...new Set(items.map(p => p.categoria).filter(Boolean))].sort();
        selCat.innerHTML = '<option value="">Tutte le categorie (' + cats.length + ')</option>' +
            cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
        if (currentVal) selCat.value = currentVal;
    }

    // Stagioni univoche
    if (selStag) {
        const currentVal = selStag.value;
        const stagioni = [...new Set(items.map(p => p.stagione).filter(Boolean))].sort().reverse();
        selStag.innerHTML = '<option value="">Tutte le stagioni (' + stagioni.length + ')</option>' +
            stagioni.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
        if (currentVal) selStag.value = currentVal;
    }

    // Target / Versione univoche
    if (selTgt) {
        const currentVal = selTgt.value;
        const targets = [...new Set(items.map(p => p.target || p.versione).filter(Boolean))].sort();
        selTgt.innerHTML = '<option value="">Tutti i target</option>' +
            targets.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
        if (currentVal) selTgt.value = currentVal;
    }
}

/**
 * Filtra la tabella in base ai filtri impostati
 */
function filtraTabellaSenzaFiltro() {
    if (!reportSenzaFiltroDati || !Array.isArray(reportSenzaFiltroDati.items)) {
        sfCurrentFilteredList = [];
        renderTabellaSenzaFiltro();
        return;
    }

    const searchInput = document.getElementById('sf-search-input');
    const selCat = document.getElementById('sf-filter-categoria');
    const selStag = document.getElementById('sf-filter-stagione');
    const selTgt = document.getElementById('sf-filter-target');

    const query = (searchInput?.value || '').trim().toLowerCase();
    const catFilter = (selCat?.value || '').trim().toLowerCase();
    const stagFilter = (selStag?.value || '').trim().toLowerCase();
    const tgtFilter = (selTgt?.value || '').trim().toLowerCase();

    const hasActiveFilters = Boolean(query || catFilter || stagFilter || tgtFilter);
    const badgeFiltro = document.getElementById('sf-filtro-attivo-badge');
    if (badgeFiltro) {
        if (hasActiveFilters) badgeFiltro.classList.remove('hidden');
        else badgeFiltro.classList.add('hidden');
    }

    sfCurrentFilteredList = reportSenzaFiltroDati.items.filter(item => {
        if (query) {
            const sq = (item.squadra || '').toLowerCase();
            const nm = (item.nome || '').toLowerCase();
            const vr = (item.versione || '').toLowerCase();
            const idStr = String(item.id || '').toLowerCase();
            const legIdStr = String(item.legacy_id || '').toLowerCase();
            const matchQuery = sq.includes(query) || nm.includes(query) || vr.includes(query) || idStr.includes(query) || legIdStr.includes(query);
            if (!matchQuery) return false;
        }

        if (catFilter) {
            const c = (item.categoria || '').toLowerCase();
            if (c !== catFilter) return false;
        }

        if (stagFilter) {
            const s = (item.stagione || '').toLowerCase();
            if (s !== stagFilter) return false;
        }

        if (tgtFilter) {
            const t = (item.target || '').toLowerCase();
            const v = (item.versione || '').toLowerCase();
            if (t !== tgtFilter && v !== tgtFilter) return false;
        }

        return true;
    });

    sfCurrentPage = 1;
    renderTabellaSenzaFiltro();
}

/**
 * Resetta tutti i filtri di ricerca
 */
function resetFiltriSenzaFiltro() {
    const searchInput = document.getElementById('sf-search-input');
    const selCat = document.getElementById('sf-filter-categoria');
    const selStag = document.getElementById('sf-filter-stagione');
    const selTgt = document.getElementById('sf-filter-target');

    if (searchInput) searchInput.value = '';
    if (selCat) selCat.value = '';
    if (selStag) selStag.value = '';
    if (selTgt) selTgt.value = '';

    sfActiveTeamFilter = '';
    sfActiveCategoryFilter = '';
    
    if (reportSenzaFiltroDati) {
        popolaBreakdownSquadreECategorieSenzaFiltro(reportSenzaFiltroDati);
    }
    filtraTabellaSenzaFiltro();
}

/**
 * Cambia pagina nella tabella
 */
function cambiaPaginaSenzaFiltro(newPage) {
    const pageSizeEl = document.getElementById('sf-page-size');
    sfPageSize = pageSizeEl ? parseInt(pageSizeEl.value, 10) || 50 : 50;

    const totalPages = Math.ceil(sfCurrentFilteredList.length / sfPageSize) || 1;
    if (newPage < 1) newPage = 1;
    if (newPage > totalPages) newPage = totalPages;

    sfCurrentPage = newPage;
    renderTabellaSenzaFiltro();
}

/**
 * Renderizza la tabella dei prodotti senza filtro catalogo
 */
function renderTabellaSenzaFiltro() {
    const tbody = document.getElementById('sf-table-body');
    const countVisualizzati = document.getElementById('sf-count-visualizzati');
    const countTotale = document.getElementById('sf-count-totale-tabella');
    const pageInfo = document.getElementById('sf-page-info');
    const pageButtons = document.getElementById('sf-page-buttons');
    const checkAll = document.getElementById('sf-check-all');

    const totalFiltered = sfCurrentFilteredList.length;
    const totalAll = reportSenzaFiltroDati ? reportSenzaFiltroDati.items.length : 0;

    if (countVisualizzati) countVisualizzati.innerText = totalFiltered.toLocaleString('it-IT');
    if (countTotale) countTotale.innerText = totalAll.toLocaleString('it-IT');

    if (!tbody) return;

    if (totalFiltered === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" class="py-12 text-center text-slate-400">
                    <div class="text-3xl mb-2">🎉</div>
                    <div class="font-bold text-sm text-slate-700">Nessun prodotto trovato</div>
                    <div class="text-xs text-slate-500 mt-1">Tutti i prodotti corrispondono ai criteri di filtro impostati o hanno già un Filtro Catalogo valido.</div>
                </td>
            </tr>
        `;
        if (pageInfo) pageInfo.innerText = "Pagina 1 di 1";
        if (pageButtons) pageButtons.innerHTML = "";
        if (checkAll) { checkAll.checked = false; checkAll.indeterminate = false; }
        return;
    }

    const pageSizeEl = document.getElementById('sf-page-size');
    sfPageSize = pageSizeEl ? parseInt(pageSizeEl.value, 10) || 50 : 50;
    const totalPages = Math.ceil(totalFiltered / sfPageSize) || 1;
    if (sfCurrentPage > totalPages) sfCurrentPage = totalPages;

    const startIndex = (sfCurrentPage - 1) * sfPageSize;
    const endIndex = Math.min(startIndex + sfPageSize, totalFiltered);
    const pageItems = sfCurrentFilteredList.slice(startIndex, endIndex);

    // Aggiorna stato checkbox All
    if (checkAll) {
        const allPageSelected = pageItems.length > 0 && pageItems.every(p => sfSelectedIds.has(String(p.id)));
        const somePageSelected = pageItems.some(p => sfSelectedIds.has(String(p.id)));
        checkAll.checked = allPageSelected;
        checkAll.indeterminate = !allPageSelected && somePageSelected;
    }

    // Badge suggerimento colore
    const getSuggestedBadge = (sugg) => {
        if (!sugg || sugg === 'Da verificare') {
            return `<span class="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-bold text-[10px]">Da verificare</span>`;
        }
        if (sugg === 'Player') return `<span class="px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-black text-[10px]">⚡ Player</span>`;
        if (sugg === 'Fan') return `<span class="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-black text-[10px]">👕 Fan</span>`;
        if (sugg === 'Retro') return `<span class="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full font-black text-[10px]">🕰️ Retro</span>`;
        if (sugg === 'Kit' || sugg === 'Kit Allenamento') return `<span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-black text-[10px]">📦 ${escapeHtml(sugg)}</span>`;
        if (sugg === 'Tuta') return `<span class="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full font-black text-[10px]">🧥 Tuta</span>`;
        if (sugg === 'Maniche Lunghe') return `<span class="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full font-black text-[10px]">🧤 Maniche Lunghe</span>`;
        return `<span class="px-2 py-0.5 bg-teal-100 text-teal-800 rounded-full font-bold text-[10px]">${escapeHtml(sugg)}</span>`;
    };

    tbody.innerHTML = pageItems.map(item => {
        const itemId = String(item.id);
        const isSelected = sfSelectedIds.has(itemId);
        const displayId = item.legacy_id !== undefined && item.legacy_id !== null ? item.legacy_id : item.id;
        const imgUrl = (item.immagine || '').trim();
        const placeholderImg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='18' height='18' x='3' y='3' rx='2' ry='2'/%3E%3Ccircle cx='9' cy='9' r='2'/%3E%3Cpath d='m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21'/%3E%3C/svg%3E";

        return `
            <tr class="hover:bg-amber-50/40 transition-colors ${isSelected ? 'bg-amber-50/70' : ''}">
                <!-- Checkbox -->
                <td class="py-2.5 px-3 text-center">
                    <input type="checkbox" onchange="toggleSelectRowSenzaFiltro('${escapeHtml(itemId)}')" ${isSelected ? 'checked' : ''} class="rounded border-slate-300 text-amber-500 focus:ring-amber-500">
                </td>

                <!-- Thumbnail Immagine -->
                <td class="py-2 px-3 text-center">
                    <div class="w-10 h-10 bg-slate-100 border border-slate-200 rounded-lg overflow-hidden flex items-center justify-center mx-auto">
                        <img src="${escapeHtml(imgUrl || placeholderImg)}" alt="${escapeHtml(item.squadra)}" class="w-full h-full object-contain" onerror="this.onerror=null; this.src='${placeholderImg}';">
                    </div>
                </td>

                <!-- ID -->
                <td class="py-2.5 px-3 font-mono font-bold text-slate-700 text-center">
                    #${escapeHtml(String(displayId))}
                </td>

                <!-- Squadra -->
                <td class="py-2.5 px-4 font-bold text-slate-900">
                    <div class="flex items-center gap-1.5">
                        <span>🛡️</span>
                        <span>${escapeHtml(item.squadra || 'Senza Squadra')}</span>
                    </div>
                </td>

                <!-- Nome / Versione -->
                <td class="py-2.5 px-4 font-medium text-slate-800">
                    <div class="truncate max-w-xs" title="${escapeHtml(item.nome || item.versione)}">
                        ${escapeHtml(item.nome || item.versione || '—')}
                    </div>
                </td>

                <!-- Categoria -->
                <td class="py-2.5 px-3 text-center">
                    <span class="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-semibold text-[11px] border border-slate-200">
                        ${escapeHtml(item.categoria || '—')}
                    </span>
                </td>

                <!-- Target / Versione -->
                <td class="py-2.5 px-3 text-center text-slate-600 font-medium">
                    ${escapeHtml(item.target || item.versione || 'Adulto')}
                </td>

                <!-- Stagione -->
                <td class="py-2.5 px-3 text-center font-mono text-slate-600">
                    ${escapeHtml(item.stagione || '—')}
                </td>

                <!-- Filtro Attuale -->
                <td class="py-2.5 px-3 text-center">
                    <span class="px-2 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded-full font-bold text-[10px]">
                        ${escapeHtml(item.filtro_catalogo || 'Nessuno')}
                    </span>
                </td>

                <!-- Filtro Suggerito -->
                <td class="py-2.5 px-3 text-center">
                    ${getSuggestedBadge(item.filtro_suggerito)}
                </td>

                <!-- Azioni -->
                <td class="py-2.5 px-4 text-center">
                    <button type="button" onclick="apriModificaDaSenzaFiltro('${escapeHtml(itemId)}')" class="px-3 py-1.5 bg-slate-900 hover:bg-brand-gold text-white hover:text-slate-900 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1 mx-auto">
                        <span>✏️</span> Modifica
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    // Pagination Info & Buttons
    if (pageInfo) {
        pageInfo.innerText = `Pagina ${sfCurrentPage} di ${totalPages} (${startIndex + 1}-${endIndex} di ${totalFiltered.toLocaleString('it-IT')})`;
    }

    if (pageButtons) {
        let buttonsHtml = '';
        buttonsHtml += `
            <button type="button" onclick="cambiaPaginaSenzaFiltro(1)" ${sfCurrentPage === 1 ? 'disabled class="px-2 py-1 bg-slate-100 text-slate-400 rounded-lg text-xs cursor-not-allowed"' : 'class="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 transition-colors"'}>
                «
            </button>
            <button type="button" onclick="cambiaPaginaSenzaFiltro(${sfCurrentPage - 1})" ${sfCurrentPage === 1 ? 'disabled class="px-2.5 py-1 bg-slate-100 text-slate-400 rounded-lg text-xs cursor-not-allowed"' : 'class="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 transition-colors"'}>
                ‹ Prec
            </button>
        `;

        const maxVisible = 5;
        let startP = Math.max(1, sfCurrentPage - Math.floor(maxVisible / 2));
        let endP = Math.min(totalPages, startP + maxVisible - 1);
        if (endP - startP < maxVisible - 1) {
            startP = Math.max(1, endP - maxVisible + 1);
        }

        for (let p = startP; p <= endP; p++) {
            if (p === sfCurrentPage) {
                buttonsHtml += `<button type="button" class="px-3 py-1 bg-amber-600 text-white rounded-lg text-xs font-black shadow-sm">${p}</button>`;
            } else {
                buttonsHtml += `<button type="button" onclick="cambiaPaginaSenzaFiltro(${p})" class="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 transition-colors">${p}</button>`;
            }
        }

        buttonsHtml += `
            <button type="button" onclick="cambiaPaginaSenzaFiltro(${sfCurrentPage + 1})" ${sfCurrentPage === totalPages ? 'disabled class="px-2.5 py-1 bg-slate-100 text-slate-400 rounded-lg text-xs cursor-not-allowed"' : 'class="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 transition-colors"'}>
                Succ ›
            </button>
            <button type="button" onclick="cambiaPaginaSenzaFiltro(${totalPages})" ${sfCurrentPage === totalPages ? 'disabled class="px-2.5 py-1 bg-slate-100 text-slate-400 rounded-lg text-xs cursor-not-allowed"' : 'class="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 transition-colors"'}>
                »
            </button>
        `;
        pageButtons.innerHTML = buttonsHtml;
    }
}

/**
 * Toggle selezione per riga singola
 */
function toggleSelectRowSenzaFiltro(itemId) {
    if (sfSelectedIds.has(itemId)) {
        sfSelectedIds.delete(itemId);
    } else {
        sfSelectedIds.add(itemId);
    }
    renderTabellaSenzaFiltro();
}

/**
 * Toggle seleziona tutto nella pagina corrente
 */
function toggleSelectAllSenzaFiltro() {
    const checkAll = document.getElementById('sf-check-all');
    const isChecked = checkAll ? checkAll.checked : false;

    const pageSizeEl = document.getElementById('sf-page-size');
    const pSize = pageSizeEl ? parseInt(pageSizeEl.value, 10) || 50 : 50;
    const startIndex = (sfCurrentPage - 1) * pSize;
    const pageItems = sfCurrentFilteredList.slice(startIndex, startIndex + pSize);

    if (isChecked) {
        pageItems.forEach(p => sfSelectedIds.add(String(p.id)));
    } else {
        pageItems.forEach(p => sfSelectedIds.delete(String(p.id)));
    }
    renderTabellaSenzaFiltro();
}

/**
 * Apre il modal standard di modifica prodotto dal report senza filtro
 */
function apriModificaDaSenzaFiltro(productId) {
    if (typeof preparaModificaProdotto === 'function') {
        preparaModificaProdotto(productId);
    } else {
        showToast("Funzione preparaModificaProdotto non trovata.", "error");
    }
}

/**
 * Sincronizza il report quando un prodotto viene salvato
 */
function sincronizzaReportSenzaFiltro() {
    if (!reportSenzaFiltroDati || !Array.isArray(reportSenzaFiltroDati.items)) return;
    
    // Controlla tutti gli item rispetto a `prodotti` in memoria
    const updatedItems = [];
    const teamCount = {};
    const categoryCount = {};

    for (const item of reportSenzaFiltroDati.items) {
        const prod = trovaProdottoPerId(item.id);
        if (prod) {
            const f = (prod.filtro_catalogo || '').trim();
            const isWithout = !f || f.toLowerCase() === 'nessuno' || f.toLowerCase() === 'nessun filtro';
            if (isWithout) {
                updatedItems.push(item);
                const sq = (item.squadra || 'Senza Squadra').trim();
                const cat = (item.categoria || 'Altro').trim();
                teamCount[sq] = (teamCount[sq] || 0) + 1;
                categoryCount[cat] = (categoryCount[cat] || 0) + 1;
            }
        }
    }

    reportSenzaFiltroDati.items = updatedItems;
    reportSenzaFiltroDati.total_without_filter = updatedItems.length;
    reportSenzaFiltroDati.teams_count = Object.keys(teamCount).length;
    reportSenzaFiltroDati.categories_count = Object.keys(categoryCount).length;
    reportSenzaFiltroDati.by_team = teamCount;
    reportSenzaFiltroDati.by_category = categoryCount;

    popolaMetriceReportSenzaFiltro(reportSenzaFiltroDati);
    popolaBreakdownSquadreECategorieSenzaFiltro(reportSenzaFiltroDati);
    filtraTabellaSenzaFiltro();
}

/**
 * Copia i risultati filtrati o selezionati negli appunti
 */
function copiaRisultatiSenzaFiltro() {
    const itemsToExport = sfSelectedIds.size > 0 
        ? sfCurrentFilteredList.filter(p => sfSelectedIds.has(String(p.id)))
        : sfCurrentFilteredList;

    if (itemsToExport.length === 0) {
        showToast("Nessun elemento da copiare.", "warning");
        return;
    }

    let text = `=== ARTICOLI SENZA FILTRO CATALOGO (${itemsToExport.length} elementi) ===\n\n`;
    itemsToExport.forEach((p, idx) => {
        const idDisp = p.legacy_id !== undefined && p.legacy_id !== null ? p.legacy_id : p.id;
        text += `${idx + 1}. [ID: #${idDisp}] ${p.squadra} | ${p.nome || p.versione} | Categoria: ${p.categoria} | Filtro Attuale: ${p.filtro_catalogo} | Suggerito: ${p.filtro_suggerito}\n`;
    });

    navigator.clipboard.writeText(text).then(() => {
        showToast(`Copiati ${itemsToExport.length} articoli negli appunti!`, "success");
    }).catch(err => {
        console.error("Errore copia appunti:", err);
        showToast("Impossibile copiare negli appunti.", "error");
    });
}

/**
 * Esporta i risultati in formato CSV
 */
function esportaReportSenzaFiltroCSV() {
    const itemsToExport = sfSelectedIds.size > 0 
        ? sfCurrentFilteredList.filter(p => sfSelectedIds.has(String(p.id)))
        : sfCurrentFilteredList;

    if (itemsToExport.length === 0) {
        showToast("Nessun dato da esportare.", "warning");
        return;
    }

    const headers = ["ID", "Legacy ID", "Squadra", "Nome Prodotto", "Categoria", "Target", "Stagione", "Filtro Attuale", "Filtro Suggerito", "Prezzo", "URL Immagine"];
    const rows = itemsToExport.map(p => [
        `"${p.id}"`,
        `"${p.legacy_id || ''}"`,
        `"${(p.squadra || '').replace(/"/g, '""')}"`,
        `"${(p.nome || p.versione || '').replace(/"/g, '""')}"`,
        `"${(p.categoria || '').replace(/"/g, '""')}"`,
        `"${(p.target || '').replace(/"/g, '""')}"`,
        `"${(p.stagione || '').replace(/"/g, '""')}"`,
        `"${(p.filtro_catalogo || 'Nessuno').replace(/"/g, '""')}"`,
        `"${(p.filtro_suggerito || '').replace(/"/g, '""')}"`,
        `"${p.prezzo || 23.99}"`,
        `"${(p.immagine || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `articoli_senza_filtro_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`File CSV con ${itemsToExport.length} articoli generato con successo!`, "success");
}

// Esporta funzioni diagnostica senza filtro su window
window.avviaScansioneSenzaFiltro = avviaScansioneSenzaFiltro;
window.chiudiModalReportSenzaFiltro = chiudiModalReportSenzaFiltro;
window.filtraTabellaSenzaFiltro = filtraTabellaSenzaFiltro;
window.resetFiltriSenzaFiltro = resetFiltriSenzaFiltro;
window.cambiaPaginaSenzaFiltro = cambiaPaginaSenzaFiltro;
window.toggleSelectRowSenzaFiltro = toggleSelectRowSenzaFiltro;
window.toggleSelectAllSenzaFiltro = toggleSelectAllSenzaFiltro;
window.apriModificaDaSenzaFiltro = apriModificaDaSenzaFiltro;
window.sincronizzaReportSenzaFiltro = sincronizzaReportSenzaFiltro;
window.copiaRisultatiSenzaFiltro = copiaRisultatiSenzaFiltro;
window.esportaReportSenzaFiltroCSV = esportaReportSenzaFiltroCSV;
window.selezionaFiltroSquadraRapido = selezionaFiltroSquadraRapido;
window.selezionaFiltroCategoriaRapido = selezionaFiltroCategoriaRapido;





