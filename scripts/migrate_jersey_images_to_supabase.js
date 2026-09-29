import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';

// Carica variabili d'ambiente
const envContent = fs.readFileSync('.env', 'utf8');
let supabaseUrl = '';
let supabaseKey = '';

envContent.split('\n').forEach(line => {
  if (line.startsWith('SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) supabaseKey = line.split('=')[1].trim();
  else if (!supabaseKey && line.startsWith('SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
});

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Credenziali Supabase mancanti in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Funzione di validazione buffer
async function validaBufferImmagine(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Buffer immagine vuoto o non valido.');
  }

  // Verifica magic bytes minimi
  if (buffer.length < 8) {
    throw new Error(`File troppo piccolo (${buffer.length} byte), non è un'immagine valida.`);
  }

  // Verifica che non sia HTML / testo
  const startStr = buffer.slice(0, 100).toString('utf8').toLowerCase();
  if (
    startStr.includes('<!doctype html') ||
    startStr.includes('<html') ||
    startStr.includes('error code:') ||
    startStr.includes('cloudflare') ||
    startStr.includes('access denied') ||
    startStr.includes('just a moment...') ||
    startStr.includes('<html>')
  ) {
    throw new Error('Il buffer scaricato contiene contenuto HTML o pagina errore, non un file immagine binario.');
  }

  // Decodifica tramite Sharp per accertare integrità grafica
  try {
    const metadata = await sharp(buffer).metadata();
    if (!metadata || !metadata.width || !metadata.height) {
      throw new Error('Metadati grafici illeggibili o dimensioni corrotte.');
    }
    return metadata;
  } catch (err) {
    throw new Error(`Impossibile decodificare l'immagine con Sharp: ${err.message}`);
  }
}

// Funzione download con retry e timeout
async function scaricaImmagineJersey(url, maxRetries = 2) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const resp = await fetch(url, {
        method: 'GET',
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'referer': 'https://jerseys-catalog.com/'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
      }

      const contentType = (resp.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('text/html') || contentType.includes('application/json') || contentType.includes('text/plain')) {
        throw new Error(`Content-Type non valido: ${contentType}`);
      }

      const arrayBuf = await resp.arrayBuffer();
      const rawBuffer = Buffer.from(arrayBuf);
      await validaBufferImmagine(rawBuffer);
      return rawBuffer;
    } catch (err) {
      clearTimeout(timeoutId);
      if (attempt === maxRetries) {
        throw err;
      }
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

async function eseguiMigrazione() {
  console.log('🚀 AVVIO MIGRAZIONE DEFINITIVA IMMAGINI JERSEY → SUPABASE STORAGE');
  console.log('================================================================');

  // 1. Recupera tutti i prodotti dal database Supabase
  let allProducts = [];
  let page = 0;
  while (true) {
    const { data, error } = await supabase
      .from('products')
      .select('id, legacy_id, squadra, versione, categoria, stagione, target, prezzo, prezzo_fornitore, immagine')
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (error) {
      console.error('❌ Errore recupero prodotti:', error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    allProducts = allProducts.concat(data);
    page++;
  }

  // 2. Filtra esclusivamente i prodotti con URL jerseys-catalog.com
  const jerseyProducts = allProducts.filter(p => (p.immagine || '').includes('jerseys-catalog.com'));
  console.log(`📊 Totale prodotti catalogo: ${allProducts.length}`);
  console.log(`🎯 Prodotti identificati con URL Jersey: ${jerseyProducts.length}`);

  if (jerseyProducts.length === 0) {
    console.log('✅ Nessun prodotto da migrare. Tutte le immagini sono già su Supabase Storage.');
    return;
  }

  // Carica i mapping storici
  let mappingList = [];
  if (fs.existsSync('products_storage_mapping.json')) {
    try {
      mappingList = JSON.parse(fs.readFileSync('products_storage_mapping.json', 'utf8'));
      if (!Array.isArray(mappingList)) mappingList = [];
    } catch (e) {
      mappingList = [];
    }
  }

  let localProductsList = [];
  if (fs.existsSync('products_local.json')) {
    try {
      localProductsList = JSON.parse(fs.readFileSync('products_local.json', 'utf8'));
      if (!Array.isArray(localProductsList)) localProductsList = [];
    } catch (e) {
      localProductsList = [];
    }
  }

  const report = {
    trovati: jerseyProducts.length,
    migrati: 0,
    falliti: 0,
    dettagliMigrati: [],
    dettagliFalliti: []
  };

  // 3. Elaborazione sequenziale e protetta prodotto per prodotto
  for (let idx = 0; idx < jerseyProducts.length; idx++) {
    const prod = jerseyProducts[idx];
    const currentUrl = prod.immagine.trim();
    const progress = `[${idx + 1}/${jerseyProducts.length}]`;
    console.log(`\n${progress} Elaborazione Prodotto ID: ${prod.id} (#${prod.legacy_id || 'N/A'}) - ${prod.squadra} (${prod.versione})`);
    console.log(`   🔗 URL Sorgente: ${currentUrl}`);

    try {
      // Step A: Download e validazione immagine
      const rawBuffer = await scaricaImmagineJersey(currentUrl);
      console.log(`   📥 Download completato (${rawBuffer.length} byte)`);

      // Step B: Conversione WebP 300x300 qualità 80
      const webpBuffer = await sharp(rawBuffer)
        .resize(300, 300, { fit: 'cover' })
        .webp({ quality: 80 })
        .toBuffer();

      // Step C: Generazione hash e filename
      const hash = crypto.createHash('sha256').update(webpBuffer).digest('hex').substring(0, 16);
      const filename = `img_${hash}.webp`;

      // Step D: Upload su Supabase Storage (bucket 'prodotti')
      const { error: uploadError } = await supabase.storage
        .from('prodotti')
        .upload(filename, webpBuffer, {
          contentType: 'image/webp',
          upsert: true
        });

      if (uploadError) {
        throw new Error(`Upload Storage fallito: ${uploadError.message}`);
      }

      // Step E: Ottenimento URL pubblico
      const { data: pubData } = supabase.storage.from('prodotti').getPublicUrl(filename);
      if (!pubData || !pubData.publicUrl) {
        throw new Error('Impossibile ottenere URL pubblico da Supabase Storage');
      }
      const storageUrl = pubData.publicUrl;
      console.log(`   ☁️ Upload Storage completato: ${filename}`);

      // Step F: Verifica HTTP 200 del nuovo URL prima di qualsiasi modifica al DB
      let verifyOk = false;
      for (let vAttempt = 1; vAttempt <= 3; vAttempt++) {
        try {
          const verifyResp = await fetch(storageUrl, { method: 'GET' });
          if (verifyResp.ok) {
            const vCt = (verifyResp.headers.get('content-type') || '').toLowerCase();
            const vLen = Number(verifyResp.headers.get('content-length') || 0);
            if (vCt.includes('image/') || vLen > 0) {
              verifyOk = true;
              console.log(`   ✅ Verifica HTTP 200 confermata (${vCt}, ${vLen} byte)`);
              break;
            }
          }
        } catch (vErr) {
          // Retry
        }
        await new Promise(r => setTimeout(r, 300));
      }

      if (!verifyOk) {
        throw new Error(`Verifica HTTP del nuovo URL Storage '${storageUrl}' non riuscita.`);
      }

      // Step G: Aggiorna ESCLUSIVAMENTE il campo immagine nel database Supabase
      const { error: dbUpdateError } = await supabase
        .from('products')
        .update({ immagine: storageUrl })
        .eq('id', prod.id);

      if (dbUpdateError) {
        throw new Error(`Aggiornamento database fallito: ${dbUpdateError.message}`);
      }
      console.log(`   💾 Database aggiornato con successo per ID ${prod.id}`);

      // Step H: Aggiorna mapping storico
      const existingMapIdx = mappingList.findIndex(m => m.id === prod.id || (m.filename && m.filename === filename));
      const mapItem = {
        id: prod.id,
        legacy_id: prod.legacy_id,
        squadra: prod.squadra,
        versione: prod.versione,
        originalUrl: currentUrl,
        storageUrl: storageUrl,
        filename: filename,
        migratedAt: new Date().toISOString()
      };

      if (existingMapIdx >= 0) {
        mappingList[existingMapIdx] = { ...mappingList[existingMapIdx], ...mapItem };
      } else {
        mappingList.push(mapItem);
      }

      // Aggiorna anche products_local.json se presente
      const localProd = localProductsList.find(p => p.id === prod.id || p.legacy_id === prod.legacy_id);
      if (localProd) {
        localProd.immagine = storageUrl;
        if (!localProd.immagine_originale) {
          localProd.immagine_originale = currentUrl;
        }
      }

      report.migrati++;
      report.dettagliMigrati.push({
        id: prod.id,
        legacy_id: prod.legacy_id,
        squadra: prod.squadra,
        versione: prod.versione,
        vecchioUrl: currentUrl,
        nuovoUrl: storageUrl,
        filename: filename
      });

      // Breve pausa per evitare sovraccarico
      await new Promise(r => setTimeout(r, 150));
    } catch (itemErr) {
      console.error(`   ❌ ERRORE migrazione per ID ${prod.id}: ${itemErr.message}`);
      console.log(`   🛡️ Prodotto ID ${prod.id} MANTENUTO con vecchio URL (nessuna modifica al DB)`);
      report.falliti++;
      report.dettagliFalliti.push({
        id: prod.id,
        legacy_id: prod.legacy_id,
        squadra: prod.squadra,
        versione: prod.versione,
        url: currentUrl,
        motivo: itemErr.message
      });
    }
  }

  // 4. Salva mapping storici su disco
  try {
    fs.writeFileSync('products_storage_mapping.json', JSON.stringify(mappingList, null, 2), 'utf8');
    console.log(`\n📁 Mapping storico aggiornato in products_storage_mapping.json (${mappingList.length} record)`);
  } catch (err) {
    console.error('⚠️ Errore salvataggio products_storage_mapping.json:', err.message);
  }

  if (localProductsList.length > 0) {
    try {
      fs.writeFileSync('products_local.json', JSON.stringify(localProductsList, null, 2), 'utf8');
      console.log(`📁 Archivio locale aggiornato in products_local.json`);
    } catch (err) {}
  }

  // 5. Invalida cache interna del catalogo
  try {
    await fetch('http://localhost:3000/api/admin/catalog/invalidate-cache', { method: 'POST' }).catch(() => {});
  } catch (e) {}

  // 6. Report di riepilogo
  console.log('\n================================================================');
  console.log('🏁 RISULTATI FINALI DELLA MIGRAZIONE');
  console.log('================================================================');
  console.log(`Totale prodotti identificati: ${report.trovati}`);
  console.log(`✅ Migrati con successo su Supabase Storage: ${report.migrati}`);
  console.log(`❌ Falliti (mantenuti invariati): ${report.falliti}`);

  // 7. Salva report JSON completo
  fs.writeFileSync('migration_report_61.json', JSON.stringify(report, null, 2), 'utf8');
}

eseguiMigrazione().catch(err => {
  console.error('FATAL ERROR migrazione:', err);
  process.exit(1);
});
