import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
import sharp from "sharp";
import crypto from "crypto";

dotenv.config();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
if (!url || !key) {
  console.error("ERRORE: Credenziali Supabase mancanti in .env");
  process.exit(1);
}
const supabase = createClient(url, key);

function norm(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}

function matchCategory(c1, c2) {
  const n1 = norm(c1);
  const n2 = norm(c2);
  if (n1 === n2) return true;
  if ((n1 === "kit" || n1 === "tuta") && (n2 === "kit" || n2 === "tuta")) return true;
  return false;
}

function hasValidImageMagicBytes(buf) {
  if (!buf || buf.length < 12) return false;
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return true;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return true;
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return true;
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return true;
  if (buf.subarray(4, 8).toString("ascii") === "ftyp") return true;
  if (buf[0] === 0x42 && buf[1] === 0x4D) return true;
  return false;
}

async function validaBufferImmagine(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) throw new Error("Dati immagine non validi o buffer mancante.");
  if (buffer.length < 100) throw new Error(`Contenuto troppo piccolo (${buffer.length} byte).`);
  const headerSample = buffer.subarray(0, Math.min(buffer.length, 1024)).toString("utf8").toLowerCase();
  const htmlSignatures = [
    "<!doctype", "<html", "<head", "<body", "<script",
    "challenges.cloudflare.com", "cf-browser-verification",
    "turnstile", "captcha", "attention required!", "access denied",
    "just a moment...", "enable javascript", "checking your browser",
    "security service to protect itself"
  ];
  for (const sig of htmlSignatures) {
    if (headerSample.includes(sig)) {
      throw new Error(`Rilevata risposta HTML/challenge ('${sig}').`);
    }
  }
  const firstChar = buffer[0];
  if (firstChar === 0x7B || firstChar === 0x5B) {
    try {
      JSON.parse(buffer.toString("utf8"));
      throw new Error("Il server fornitore ha restituito dati JSON anziché un'immagine.");
    } catch (jsonErr) {
      if (jsonErr.message.includes("JSON anziché")) throw jsonErr;
    }
  }
  if (!hasValidImageMagicBytes(buffer)) throw new Error("Magic bytes non validi.");
  const meta = await sharp(buffer).metadata();
  if (!meta || !meta.width || !meta.height) throw new Error("Metadati immagine non validi.");
  return meta;
}

async function main() {
  console.log("==================================================");
  console.log("INIZIO ESECUZIONE RECUPERO AUTOMATICO 50 PRODOTTI");
  console.log("==================================================");

  // 1. Caricamento catalogo completo
  let allProducts = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("products")
      .select("id, legacy_id, squadra, versione, categoria, stagione, target, prezzo, immagine, created_at")
      .range(offset, offset + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allProducts.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }

  const workingBefore = allProducts.filter(p => (p.immagine || "").includes(".supabase.co/storage/v1/object/public/prodotti/"));
  const problematicBefore = allProducts.filter(p => !(p.immagine || "").includes(".supabase.co/storage/v1/object/public/prodotti/"));

  console.log(`Totale catalogo DB: ${allProducts.length}`);
  console.log(`Funzionanti prima: ${workingBefore.length}`);
  console.log(`Problematici prima: ${problematicBefore.length}`);

  // 2. Classificazione Gruppo 1 (34 prodotti da Storage gemello)
  const gruppo1 = [];
  for (const p of problematicBefore) {
    const twin = workingBefore.find(w => 
      norm(w.squadra) === norm(p.squadra) && 
      norm(w.versione) === norm(p.versione) && 
      norm(w.stagione) === norm(p.stagione) &&
      matchCategory(w.categoria, p.categoria)
    );
    if (twin) {
      gruppo1.push({ p, twin });
    }
  }

  // 3. Classificazione Gruppo 2 (16 prodotti scaricabili direttamente)
  const liveIds = [1, 28, 30, 31, 33, 38, 77, 79, 98, 100, 124, 128, 143, 147, 151, 158];
  const gruppo1Ids = new Set(gruppo1.map(g => g.p.id));
  const gruppo2 = problematicBefore.filter(p => liveIds.includes(p.legacy_id) && !gruppo1Ids.has(p.id));

  console.log(`Gruppo 1 identificati (Storage gemello): ${gruppo1.length}/34`);
  console.log(`Gruppo 2 identificati (Download diretto): ${gruppo2.length}/16`);

  if (gruppo1.length !== 34 || gruppo2.length !== 16) {
    throw new Error(`Conteggio errato: attesi 34 e 16, trovati ${gruppo1.length} e ${gruppo2.length}`);
  }

  // 4. Backup dei vecchi valori prima di qualsiasi operazione
  const backupData = [];
  for (const { p, twin } of gruppo1) {
    backupData.push({
      id: p.id,
      legacy_id: p.legacy_id,
      squadra: p.squadra,
      versione: p.versione,
      categoria: p.categoria,
      stagione: p.stagione,
      old_immagine: p.immagine,
      target_immagine: twin.immagine,
      twin_id: twin.id,
      twin_legacy_id: twin.legacy_id,
      gruppo: "GRUPPO_1_STORAGE_GEMELLO",
      timestamp: new Date().toISOString()
    });
  }
  for (const p of gruppo2) {
    backupData.push({
      id: p.id,
      legacy_id: p.legacy_id,
      squadra: p.squadra,
      versione: p.versione,
      categoria: p.categoria,
      stagione: p.stagione,
      old_immagine: p.immagine,
      target_immagine: null, // Sarà popolato dopo upload
      gruppo: "GRUPPO_2_DOWNLOAD_DIRETTO",
      timestamp: new Date().toISOString()
    });
  }
  fs.writeFileSync("recovery_50_backup.json", JSON.stringify(backupData, null, 2));
  console.log(`Backup di sicurezza salvato in recovery_50_backup.json (${backupData.length} record).`);

  // 5. ESECUZIONE GRUPPO 1 (34 prodotti da Storage)
  console.log("\n==================================================");
  console.log("ESECUZIONE GRUPPO 1 — 34 PRODOTTI DA STORAGE");
  console.log("==================================================");
  let g1Recovered = 0;
  const g1Failures = [];

  for (let i = 0; i < gruppo1.length; i++) {
    const { p, twin } = gruppo1[i];
    const targetUrl = twin.immagine;
    try {
      // Verifica 4, 5, 6: file Supabase esiste, HTTP 200, Content-Type image/webp
      const res = await fetch(targetUrl);
      if (!res.ok) {
        throw new Error(`HTTP status ${res.status} per file storage gemello ${targetUrl}`);
      }
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      if (!ct.includes("image/webp")) {
        throw new Error(`Content-Type non valido per file storage: ${ct}`);
      }
      const ab = await res.arrayBuffer();
      const meta = await sharp(Buffer.from(ab)).metadata();
      if (meta.format !== "webp" || meta.width !== 300 || meta.height !== 300) {
        throw new Error(`Immagine storage non conforme WebP 300x300 (trovato ${meta.format} ${meta.width}x${meta.height})`);
      }

      // SOLO DOPO sostituisci l'URL del prodotto problematico con l'URL Supabase
      const { error: updateError } = await supabase
        .from("products")
        .update({ immagine: targetUrl })
        .eq("id", p.id);

      if (updateError) {
        throw new Error(`Aggiornamento database fallito: ${updateError.message}`);
      }

      g1Recovered++;
      console.log(`[G1 ${g1Recovered}/34] OK Legacy ${p.legacy_id} (${p.squadra} - ${p.versione}) -> ${targetUrl.split("/").pop()}`);
    } catch (err) {
      console.error(`[G1 FALLITO] Legacy ${p.legacy_id}: ${err.message}`);
      g1Failures.push({ legacy_id: p.legacy_id, error: err.message });
    }
  }

  // 6. ESECUZIONE GRUPPO 2 (16 prodotti scaricabili automaticamente)
  console.log("\n==================================================");
  console.log("ESECUZIONE GRUPPO 2 — 16 PRODOTTI SCARICABILI");
  console.log("==================================================");
  let g2Recovered = 0;
  const g2Failures = [];

  for (let i = 0; i < gruppo2.length; i++) {
    const p = gruppo2[i];
    const origUrl = p.immagine;
    try {
      // 1. Scarica l'immagine
      const res = await fetch(origUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
          "Referer": "https://jerseys-catalog.com/"
        },
        signal: AbortSignal.timeout(12000)
      });
      if (!res.ok) throw new Error(`Download HTTP fallito con status ${res.status}`);
      const ab = await res.arrayBuffer();
      const rawBuf = Buffer.from(ab);

      // 2, 3, 4. Verifica magic bytes, sharp decode, no html/challenge
      await validaBufferImmagine(rawBuf);

      // 5, 6. Converti nel formato catalogo: WebP 300x300 qualità 80
      const webpBuf = await sharp(rawBuf)
        .resize(300, 300, { fit: "cover" })
        .webp({ quality: 80 })
        .toBuffer();

      const hash = crypto.createHash("sha256").update(webpBuf).digest("hex").substring(0, 16);
      const filename = `img_${hash}.webp`;

      // 7. Carica su Supabase Storage bucket: prodotti
      const { error: uploadError } = await supabase.storage
        .from("prodotti")
        .upload(filename, webpBuf, {
          contentType: "image/webp",
          upsert: true
        });
      if (uploadError) throw new Error(`Upload su bucket prodotti fallito: ${uploadError.message}`);

      // 8, 9, 10. Ottieni URL pubblico e verifica esistenza effettiva, HTTP 200, Content-Type image/webp
      const { data: pubData } = supabase.storage.from("prodotti").getPublicUrl(filename);
      const publicUrl = pubData.publicUrl;

      const checkRes = await fetch(publicUrl);
      if (!checkRes.ok) throw new Error(`Verifica storage fallita per ${filename}: HTTP ${checkRes.status}`);
      const checkCt = (checkRes.headers.get("content-type") || "").toLowerCase();
      if (!checkCt.includes("image/webp")) throw new Error(`Content-Type errato su storage per ${filename}: ${checkCt}`);

      const checkAb = await checkRes.arrayBuffer();
      const checkMeta = await sharp(Buffer.from(checkAb)).metadata();
      if (checkMeta.format !== "webp" || checkMeta.width !== 300 || checkMeta.height !== 300) {
        throw new Error(`Verifica Sharp fallita su file storage ${filename}`);
      }

      // 11. SOLO DOPO aggiorna il prodotto con l'URL Supabase
      const { error: updateError } = await supabase
        .from("products")
        .update({ immagine: publicUrl })
        .eq("id", p.id);

      if (updateError) throw new Error(`Aggiornamento database fallito: ${updateError.message}`);

      // Aggiorna anche il log di backup con il target_immagine assegnato
      const bEntry = backupData.find(b => b.id === p.id);
      if (bEntry) bEntry.target_immagine = publicUrl;

      g2Recovered++;
      console.log(`[G2 ${g2Recovered}/16] OK Legacy ${p.legacy_id} (${p.squadra} - ${p.versione}) -> ${filename}`);
    } catch (err) {
      console.error(`[G2 FALLITO] Legacy ${p.legacy_id}: ${err.message}`);
      g2Failures.push({ legacy_id: p.legacy_id, error: err.message });
    }
  }

  // Riscrivi backup finale con tutti gli URL target
  fs.writeFileSync("recovery_50_backup.json", JSON.stringify(backupData, null, 2));

  console.log("\n==================================================");
  console.log("RIEPILOGO RECUPERO");
  console.log("==================================================");
  console.log(`Gruppo 1 recuperati da Storage: ${g1Recovered}/34 (Falliti: ${g1Failures.length})`);
  console.log(`Gruppo 2 recuperati automaticamente: ${g2Recovered}/16 (Falliti: ${g2Failures.length})`);
  console.log(`TOTALE RECUPERATI: ${g1Recovered + g2Recovered}/50`);

  // 7. VERIFICA POST-RECUPERO DI TUTTI I 50 PRODOTTI
  console.log("\n==================================================");
  console.log("VERIFICA DI VALIDAZIONE POST-RECUPERO");
  console.log("==================================================");

  let verifiedInDb = 0;
  let verifiedHttp = 0;
  const allRecoveredIds = [...gruppo1.map(g => g.p.id), ...gruppo2.map(p => p.id)];

  const { data: refreshedProds, error: refErr } = await supabase
    .from("products")
    .select("id, legacy_id, squadra, versione, categoria, stagione, immagine")
    .in("id", allRecoveredIds);

  if (refErr) throw refErr;

  for (const prod of refreshedProds) {
    if ((prod.immagine || "").includes(".supabase.co/storage/v1/object/public/prodotti/")) {
      verifiedInDb++;
      const testRes = await fetch(prod.immagine);
      const testCt = (testRes.headers.get("content-type") || "").toLowerCase();
      if (testRes.ok && testCt.includes("image/webp")) {
        verifiedHttp++;
      }
    }
  }

  console.log(`Verificati nel database con URL Supabase Storage: ${verifiedInDb}/50`);
  console.log(`Verificati con HTTP 200 e Content-Type image/webp: ${verifiedHttp}/50`);

  // 8. VERIFICA INTEGRITÀ TOTALE DEL CATALOGO
  let allProdsAfter = [];
  offset = 0;
  while (true) {
    const { data } = await supabase
      .from("products")
      .select("id, legacy_id, squadra, versione, categoria, stagione, immagine")
      .range(offset, offset + 999);
    if (!data || data.length === 0) break;
    allProdsAfter.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }

  const workingAfter = allProdsAfter.filter(p => (p.immagine || "").includes(".supabase.co/storage/v1/object/public/prodotti/"));
  const problematicAfter = allProdsAfter.filter(p => !(p.immagine || "").includes(".supabase.co/storage/v1/object/public/prodotti/"));
  const uploadsAfter = allProdsAfter.filter(p => (p.immagine || "").startsWith("/uploads/"));
  const jerseysCatalogAfter = allProdsAfter.filter(p => (p.immagine || "").includes("jerseys-catalog.com"));

  console.log("\n==================================================");
  console.log("CONFRONTO STATO CATALOGO PRIMA VS DOPO");
  console.log("==================================================");
  console.log(`Totale prodotti: ${allProdsAfter.length}`);
  console.log(`Prodotti con Storage funzionante: ${workingBefore.length} -> ${workingAfter.length} (+${workingAfter.length - workingBefore.length})`);
  console.log(`Prodotti problematici (placeholder): ${problematicBefore.length} -> ${problematicAfter.length} (-${problematicBefore.length - problematicAfter.length})`);
  console.log(`Prodotti con /uploads/prodotti/: ${problematicBefore.filter(p => (p.immagine || "").startsWith("/uploads/")).length} -> ${uploadsAfter.length}`);
  console.log(`Prodotti con jerseys-catalog.com: ${problematicBefore.filter(p => (p.immagine || "").includes("jerseys-catalog.com")).length} -> ${jerseysCatalogAfter.length}`);

  // Verifica che i 4.415 prodotti originari siano intatti
  const beforeMap = new Map(workingBefore.map(p => [p.id, p.immagine]));
  let untouchedWorkingCount = 0;
  for (const p of workingBefore) {
    const afterProd = allProdsAfter.find(a => a.id === p.id);
    if (afterProd && afterProd.immagine === p.immagine) {
      untouchedWorkingCount++;
    }
  }
  console.log(`Prodotti funzionanti originari intatti al 100%: ${untouchedWorkingCount}/${workingBefore.length}`);
}

main().catch(err => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
