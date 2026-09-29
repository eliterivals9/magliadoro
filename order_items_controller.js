import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function setupItemEndpoints(app, helpers) {
  const {
    getDbOrders,
    getDbOrdersMerged,
    getDbLotti,
    getSettings,
    getLocalAccessories,
    getLocalProducts,
    getAllProductsFromSupabase,
    getSupabaseClient,
    getShippingRateByQuantity,
    calcolaCostoFornitoreProdotto,
    parseCustomizationDetails,
    isTechnicalShippingOrServiceLine,
    isSupplierShippingEnabledForItem,
    convertUsdToEur,
    getLiveOrSettingsExchangeRate,
    getLocalOrders,
    LOCAL_ORDERS_FILE,
    recalculateCurrentLotto,
    ricostruisciCarrelloDaStringhe
  } = helpers;

  async function ricalcolaTotaliEDatiDerivatiOrdine(order, updatedCarrello) {
    const settings = getSettings();
    let localAccessories = [];
    try {
      localAccessories = getLocalAccessories();
    } catch (e) {}

    let localProducts = getLocalProducts();
    let supabaseProducts = [];
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        supabaseProducts = await getAllProductsFromSupabase(supabase);
      } catch (e) {
        console.warn("⚠️ Utilizzo fallback prodotti locali:", e.message);
      }
    }
    const allDbProducts = supabaseProducts.length > 0 ? supabaseProducts : localProducts;

    let subtotal = 0;
    let shipping = 0;
    let costo_prodotti_usd = 0;
    let quantita_totale_articoli = 0;
    let quantita_articoli_spedizione = 0;

    const stringaSquadre = [];
    const stringaPersonalizzazioni = [];
    const stringaTaglie = [];
    const formuleImmagini = [];
    const itemSupplierPrices = [];

    let lottoTotalArticles = 0;
    try {
      const lottoFile = path.join(__dirname, 'lotto.json');
      if (fs.existsSync(lottoFile)) {
        const l = JSON.parse(fs.readFileSync(lottoFile, 'utf8'));
        lottoTotalArticles = l.numero_totale_articoli || 0;
      }
    } catch (e) {}

    const spedizione_unitaria = getShippingRateByQuantity(Math.max(1, lottoTotalArticles), settings);

    updatedCarrello.forEach(item => {
      const isSpedizione = item.squadra && isTechnicalShippingOrServiceLine(item.squadra);
      const itemPrezzo = (Number(item.prezzo) || 0) * (Number(item.quantita) || 1);
      const q = isSpedizione ? 0 : (parseInt(item.quantita, 10) || 1);

      if (isSpedizione) {
        shipping += itemPrezzo;
      } else {
        subtotal += itemPrezzo;
        quantita_totale_articoli += q;
        if (isSupplierShippingEnabledForItem(item, localAccessories)) {
          quantita_articoli_spedizione += q;
        }

        let matchedProd = allDbProducts.find(p => String(p.id) === String(item.id));
        if (!matchedProd && item.legacy_id) {
          matchedProd = allDbProducts.find(p => p.legacy_id !== undefined && p.legacy_id !== null && String(p.legacy_id) === String(item.legacy_id));
        }
        if (!matchedProd) {
          matchedProd = allDbProducts.find(p => p.versione === item.squadra || p.squadra === item.squadra);
        }

        let prezzoFornUnitarioUSD = (item.prezzo_fornitore !== undefined && item.prezzo_fornitore !== null) 
          ? Number(item.prezzo_fornitore) 
          : (matchedProd && matchedProd.prezzo_fornitore ? Number(matchedProd.prezzo_fornitore) : 14.50);
        
        prezzoFornUnitarioUSD = calcolaCostoFornitoreProdotto(prezzoFornUnitarioUSD, item.infoPerso || item.personalizzazione, item);
        costo_prodotti_usd += (prezzoFornUnitarioUSD * q);

        const labelFornitore = prezzoFornUnitarioUSD > 0 ? `$${prezzoFornUnitarioUSD.toFixed(2)}` : "-";
        itemSupplierPrices.push(`${q}x ${labelFornitore}`);

        stringaSquadre.push(`${q}x ${item.squadra || 'Prodotto'}`);
        const persLabel = item.infoPerso && item.infoPerso.trim() !== "" ? item.infoPerso : (item.personalizzazione || "Nessuna");
        stringaPersonalizzazioni.push(`${q}x [${persLabel}]`);
        stringaTaglie.push(`${q}x [${item.taglia || 'M'}]`);

        if (item.imgUrl) {
          formuleImmagini.push(`=IMAGE("${item.imgUrl}")`);
        }
      }
    });

    let discount = 0;
    if (order.coupon_discount !== undefined && order.coupon_discount !== null && Number(order.coupon_discount) > 0) {
      discount = Number(order.coupon_discount);
    }

    const rawTotal = Math.max(0, subtotal + shipping - discount);
    const total = rawTotal;

    const exchangeRate = await getLiveOrSettingsExchangeRate(settings);
    const order_shipping_usd = Number((quantita_articoli_spedizione * spedizione_unitaria).toFixed(2));
    const costo_totale_usd = Number((costo_prodotti_usd + order_shipping_usd).toFixed(2));
    const costo_totale_eur = convertUsdToEur(costo_totale_usd, exchangeRate, 'ricalcolaTotaliEDatiDerivatiOrdine');
    const profitto_eur = Number((total - costo_totale_eur).toFixed(2));

    return {
      updateFields: {
        totale: total.toFixed(2).replace('.', ',') + "€",
        squadra: stringaSquadre.join(' / '),
        personalizzazione: stringaPersonalizzazioni.join(' | '),
        taglia: stringaTaglie.join(' / '),
        prezzo_fornitore: itemSupplierPrices.join(' / '),
        foto: formuleImmagini.length > 0 ? formuleImmagini[0] : (order.foto || ""),
        costo_prodotti_usd: String(costo_prodotti_usd.toFixed(2)),
        costo_spedizione_usd: String(order_shipping_usd.toFixed(2)),
        costo_totale_usd: String(costo_totale_usd.toFixed(2)),
        cambio_usd_eur: exchangeRate,
        costo_totale_eur: String(costo_totale_eur.toFixed(2)),
        profitto_eur: String(profitto_eur.toFixed(2)),
        carrello: updatedCarrello
      },
      subtotal: subtotal,
      shipping: shipping,
      totalNum: total
    };
  }

  async function salvaModificheOrdineAutoritativo(orderId, updateFields, totalNum = null, subtotal = null, shipping = null) {
    const supabase = getSupabaseClient();
    let supabaseSuccess = false;

    // 1. Supabase orders
    if (supabase) {
      try {
        const { error: ordErr } = await supabase
          .from('orders')
          .update(updateFields)
          .eq('id', orderId);

        if (ordErr) {
          console.error(`❌ Errore aggiornamento Supabase orders per #${orderId}:`, ordErr.message);
        } else {
          supabaseSuccess = true;
          console.log(`✅ Supabase orders aggiornato per ordine #${orderId}`);
        }
      } catch (e) {
        console.error(`⚠️ Eccezione aggiornamento Supabase orders #${orderId}:`, e.message);
      }

      // 2. Sincronizzazione customer_orders se presente
      try {
        const updateCust = { updated_at: new Date().toISOString() };
        if (totalNum !== null && totalNum !== undefined) updateCust.total = totalNum;
        if (subtotal !== null && subtotal !== undefined) updateCust.subtotal = subtotal;
        if (shipping !== null && shipping !== undefined) updateCust.shipping = shipping;

        await supabase
          .from('customer_orders')
          .update(updateCust)
          .eq('admin_order_id', orderId);
      } catch (eCust) {
        console.warn(`⚠️ Sincronizzazione customer_orders non riuscita per #${orderId}:`, eCust.message);
      }
    }

    // 3. Cache locale orders_local.json sincronizzata DOPO Supabase
    try {
      const localOrders = getLocalOrders();
      const localIdx = localOrders.findIndex(o => Number(o.id) === Number(orderId));
      if (localIdx !== -1) {
        localOrders[localIdx] = {
          ...localOrders[localIdx],
          ...updateFields
        };
        fs.writeFileSync(LOCAL_ORDERS_FILE, JSON.stringify(localOrders, null, 2), 'utf8');
        console.log(`✅ Cache locale orders_local.json sincronizzata per ordine #${orderId}`);
      }
    } catch (eLocal) {
      console.warn(`⚠️ Impossibile sincronizzare cache locale orders_local.json per #${orderId}:`, eLocal.message);
    }

    // 4. Ricalcolo Lotto Corrente
    try {
      await recalculateCurrentLotto(true);
    } catch (eLotto) {
      console.warn(`⚠️ Ricalcolo lotto dopo modifica articolo #${orderId} fallito:`, eLotto.message);
    }

    return supabaseSuccess;
  }

  // POST /api/admin/orders/:id/items/update - Modifica un singolo articolo dell'ordine
  app.post('/api/admin/orders/:id/items/update', async (req, res) => {
    try {
      const orderId = Number(req.params.id);
      const { item_index, item_id, taglia, nome, numero, patch, patches } = req.body;

      if (!orderId) {
        return res.status(400).json({ success: false, error: "Identificatore ordine non valido." });
      }

      const allOrders = await getDbOrders();
      const targetOrder = allOrders.find(o => Number(o.id) === orderId);
      if (!targetOrder) {
        return res.status(404).json({ success: false, error: `Ordine #${orderId} non trovato.` });
      }

      if (targetOrder.is_archived) {
        return res.status(400).json({ success: false, error: "Impossibile modificare un ordine archiviato in un lotto chiuso." });
      }
      if (targetOrder.lotto_id) {
        const lotti = await getDbLotti();
        const currentLottoRecord = lotti.find(l => Number(l.id) === Number(targetOrder.lotto_id));
        if (currentLottoRecord && (currentLottoRecord.status === 'archived' || (currentLottoRecord.archived_at && currentLottoRecord.archived_at !== 'In corso' && currentLottoRecord.archived_at !== 'Attivo'))) {
          return res.status(400).json({ success: false, error: "Impossibile modificare un ordine appartenente a un lotto già archiviato." });
        }
      }

      let carrello = [];
      if (Array.isArray(targetOrder.carrello)) {
        carrello = JSON.parse(JSON.stringify(targetOrder.carrello));
      } else if (typeof targetOrder.carrello === 'string' && targetOrder.carrello.trim()) {
        try { carrello = JSON.parse(targetOrder.carrello); } catch (e) {}
      }
      if (carrello.length === 0 && typeof ricostruisciCarrelloDaStringhe === 'function') {
        carrello = ricostruisciCarrelloDaStringhe(targetOrder);
      }

      let targetIdx = -1;
      if (item_index !== undefined && item_index !== null && item_index >= 0 && item_index < carrello.length) {
        targetIdx = Number(item_index);
      } else if (item_id) {
        targetIdx = carrello.findIndex(it => String(it.id) === String(item_id) || String(it._stable_id) === String(item_id));
      }

      if (targetIdx === -1 || !carrello[targetIdx]) {
        return res.status(404).json({ success: false, error: "Articolo specificato non trovato nell'ordine." });
      }

      const item = carrello[targetIdx];

      // Applica TAGLIA
      if (taglia !== undefined && taglia !== null) {
        const cleanTaglia = String(taglia).trim().toUpperCase();
        if (cleanTaglia) {
          item.taglia = cleanTaglia;
        }
      }

      // Applica personalizzazione
      const cleanNome = nome !== undefined ? String(nome).trim() : null;
      const cleanNumero = numero !== undefined ? String(numero).trim() : null;
      let patchArr = [];
      if (Array.isArray(patches)) {
        patchArr = patches.map(p => String(p).trim()).filter(Boolean);
      } else if (patch !== undefined && patch !== null && String(patch).trim()) {
        patchArr = [String(patch).trim()];
      }

      if (cleanNome !== null || cleanNumero !== null || patch !== undefined || patches !== undefined) {
        const curDetails = parseCustomizationDetails(item.infoPerso || item.personalizzazione, item);
        const finalNome = cleanNome !== null ? cleanNome : curDetails.nome;
        const finalNumero = cleanNumero !== null ? cleanNumero : curDetails.numero;
        const finalPatches = (patch !== undefined || patches !== undefined) ? patchArr : curDetails.patches;

        const parts = [];
        if (finalNome) parts.push(`Nome: ${finalNome.toUpperCase()}`);
        if (finalNumero) parts.push(`Num: ${finalNumero}`);
        if (finalPatches.length > 0) parts.push(`Patch: ${finalPatches.join(', ')}`);

        const newInfoPerso = parts.length > 0 ? parts.join(' - ') : 'Nessuna';
        item.infoPerso = newInfoPerso;
        item.personalizzazione = newInfoPerso;

        if (cleanNome !== null) item.customName = finalNome ? finalNome.toUpperCase() : '';
        if (cleanNumero !== null) item.customNumber = finalNumero || '';
        if (patch !== undefined || patches !== undefined) {
          item.patches = finalPatches;
          item.patch = finalPatches.join(', ');
        }
      }

      const calcResult = await ricalcolaTotaliEDatiDerivatiOrdine(targetOrder, carrello);
      await salvaModificheOrdineAutoritativo(orderId, calcResult.updateFields, calcResult.totalNum, calcResult.subtotal, calcResult.shipping);

      const mergedOrders = await getDbOrdersMerged();
      const updatedOrder = mergedOrders.find(o => Number(o.id) === orderId) || { ...targetOrder, ...calcResult.updateFields };

      return res.json({
        success: true,
        message: "Articolo aggiornato con successo.",
        order: updatedOrder
      });
    } catch (err) {
      console.error("⚠️ Errore aggiornamento articolo ordine:", err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/admin/orders/:id/items/delete - Elimina un singolo articolo dall'ordine
  app.post('/api/admin/orders/:id/items/delete', async (req, res) => {
    try {
      const orderId = Number(req.params.id);
      const { item_index, item_id } = req.body;

      if (!orderId) {
        return res.status(400).json({ success: false, error: "Identificatore ordine non valido." });
      }

      const allOrders = await getDbOrders();
      const targetOrder = allOrders.find(o => Number(o.id) === orderId);
      if (!targetOrder) {
        return res.status(404).json({ success: false, error: `Ordine #${orderId} non trovato.` });
      }

      if (targetOrder.is_archived) {
        return res.status(400).json({ success: false, error: "Impossibile modificare un ordine archiviato in un lotto chiuso." });
      }
      if (targetOrder.lotto_id) {
        const lotti = await getDbLotti();
        const currentLottoRecord = lotti.find(l => Number(l.id) === Number(targetOrder.lotto_id));
        if (currentLottoRecord && (currentLottoRecord.status === 'archived' || (currentLottoRecord.archived_at && currentLottoRecord.archived_at !== 'In corso' && currentLottoRecord.archived_at !== 'Attivo'))) {
          return res.status(400).json({ success: false, error: "Impossibile modificare un ordine appartenente a un lotto già archiviato." });
        }
      }

      let carrello = [];
      if (Array.isArray(targetOrder.carrello)) {
        carrello = JSON.parse(JSON.stringify(targetOrder.carrello));
      } else if (typeof targetOrder.carrello === 'string' && targetOrder.carrello.trim()) {
        try { carrello = JSON.parse(targetOrder.carrello); } catch (e) {}
      }
      if (carrello.length === 0 && typeof ricostruisciCarrelloDaStringhe === 'function') {
        carrello = ricostruisciCarrelloDaStringhe(targetOrder);
      }

      const realItemsCount = carrello.filter(it => !(it.squadra && isTechnicalShippingOrServiceLine(it.squadra))).length;

      // Regola 7: BLOCCA eliminazione se è l'ULTIMO articolo reale dell'ordine
      if (realItemsCount <= 1) {
        return res.status(400).json({
          success: false,
          error: "Non puoi eliminare l'ultimo articolo da qui. Se vuoi rimuovere completamente l'ordine utilizza Elimina Ordine."
        });
      }

      let targetIdx = -1;
      if (item_index !== undefined && item_index !== null && item_index >= 0 && item_index < carrello.length) {
        targetIdx = Number(item_index);
      } else if (item_id) {
        targetIdx = carrello.findIndex(it => String(it.id) === String(item_id) || String(it._stable_id) === String(item_id));
      }

      if (targetIdx === -1 || !carrello[targetIdx]) {
        return res.status(404).json({ success: false, error: "Articolo da eliminare non trovato nell'ordine." });
      }

      const removedItem = carrello.splice(targetIdx, 1)[0];
      console.log(`🗑️ Rimosso articolo dall'ordine #${orderId}: ${removedItem.squadra || 'Articolo'} (${removedItem.taglia || '-'})`);

      const calcResult = await ricalcolaTotaliEDatiDerivatiOrdine(targetOrder, carrello);
      await salvaModificheOrdineAutoritativo(orderId, calcResult.updateFields, calcResult.totalNum, calcResult.subtotal, calcResult.shipping);

      const mergedOrders = await getDbOrdersMerged();
      const updatedOrder = mergedOrders.find(o => Number(o.id) === orderId) || { ...targetOrder, ...calcResult.updateFields };

      return res.json({
        success: true,
        message: "Articolo eliminato con successo dall'ordine.",
        order: updatedOrder
      });
    } catch (err) {
      console.error("⚠️ Errore eliminazione articolo ordine:", err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/admin/orders/:id/items/add - Aggiunge un nuovo articolo all'ordine
  app.post('/api/admin/orders/:id/items/add', async (req, res) => {
    try {
      const orderId = Number(req.params.id);
      const { 
        id: productId, 
        legacy_id, 
        squadra, 
        categoria, 
        stagione, 
        versione, 
        target, 
        taglia, 
        quantita, 
        personalizzazione, 
        infoPerso, 
        customName, 
        customNumber, 
        patch, 
        patches, 
        prezzo, 
        prezzo_fornitore, 
        imgUrl 
      } = req.body;

      if (!orderId) {
        return res.status(400).json({ success: false, error: "Identificatore ordine non valido." });
      }

      const allOrders = await getDbOrders();
      const targetOrder = allOrders.find(o => Number(o.id) === orderId);
      if (!targetOrder) {
        return res.status(404).json({ success: false, error: `Ordine #${orderId} non trovato.` });
      }

      if (targetOrder.is_archived) {
        return res.status(400).json({ success: false, error: "Impossibile modificare un ordine archiviato in un lotto chiuso." });
      }
      if (targetOrder.lotto_id) {
        const lotti = await getDbLotti();
        const currentLottoRecord = lotti.find(l => Number(l.id) === Number(targetOrder.lotto_id));
        if (currentLottoRecord && (currentLottoRecord.status === 'archived' || (currentLottoRecord.archived_at && currentLottoRecord.archived_at !== 'In corso' && currentLottoRecord.archived_at !== 'Attivo'))) {
          return res.status(400).json({ success: false, error: "Impossibile modificare un ordine appartenente a un lotto già archiviato." });
        }
      }

      let carrello = [];
      if (Array.isArray(targetOrder.carrello)) {
        carrello = JSON.parse(JSON.stringify(targetOrder.carrello));
      } else if (typeof targetOrder.carrello === 'string' && targetOrder.carrello.trim()) {
        try { carrello = JSON.parse(targetOrder.carrello); } catch (e) {}
      }
      if (carrello.length === 0 && typeof ricostruisciCarrelloDaStringhe === 'function') {
        carrello = ricostruisciCarrelloDaStringhe(targetOrder);
      }

      // Risolvi il prodotto o l'accessorio dal catalogo per verificare dati reali
      let allDbProducts = [];
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          allDbProducts = await getAllProductsFromSupabase(supabase);
        } catch (e) {
          allDbProducts = getLocalProducts();
        }
      } else {
        allDbProducts = getLocalProducts();
      }

      let localAccessories = [];
      try {
        if (typeof getLocalAccessories === 'function') {
          localAccessories = getLocalAccessories();
        }
      } catch (accErr) {}

      const isAccessoryReq = req.body.tipo_catalogo === 'accessori' || Boolean(req.body.accessory_id);
      let matchedAcc = null;
      let matchedProd = null;

      const requestedAccId = req.body.accessory_id || productId;
      if (requestedAccId) {
        matchedAcc = localAccessories.find(a => String(a.id) === String(requestedAccId));
      }

      if (!matchedAcc && productId) {
        matchedProd = allDbProducts.find(p => String(p.id) === String(productId));
      }
      if (!matchedProd && !matchedAcc && legacy_id) {
        matchedProd = allDbProducts.find(p => p.legacy_id !== undefined && p.legacy_id !== null && String(p.legacy_id) === String(legacy_id));
      }
      if (!matchedProd && !matchedAcc && squadra) {
        matchedProd = allDbProducts.find(p => p.versione === squadra || p.squadra === squadra);
      }

      const isAccessoryItem = isAccessoryReq || Boolean(matchedAcc);

      const nomeSquadra = squadra || (matchedAcc ? matchedAcc.nome : (matchedProd ? (matchedProd.versione || matchedProd.squadra) : 'Nuovo Articolo'));
      const cat = categoria || (matchedAcc ? matchedAcc.categoria : (matchedProd ? matchedProd.categoria : 'Kit'));
      const stag = stagione || (matchedAcc ? '' : (matchedProd ? matchedProd.stagione : '2026/2027'));
      const vers = versione || (matchedAcc ? matchedAcc.nome : (matchedProd ? matchedProd.versione : ''));
      const tgt = target || (matchedAcc ? 'Unica' : (matchedProd ? matchedProd.target : 'Adulto'));
      const cleanTaglia = (taglia || (isAccessoryItem ? 'UNICA' : 'M')).trim().toUpperCase();
      const q = Math.max(1, parseInt(quantita, 10) || 1);

      // Prezzo di vendita
      let priceVal = parseFloat(prezzo);
      if (isNaN(priceVal) || priceVal <= 0) {
        priceVal = matchedAcc ? parseFloat(matchedAcc.prezzo) : (matchedProd && matchedProd.prezzo ? parseFloat(matchedProd.prezzo) : (isAccessoryItem ? 6.00 : 23.99));
      }

      // Prezzo fornitore
      let supplierVal = parseFloat(prezzo_fornitore);
      if (isNaN(supplierVal) || supplierVal <= 0) {
        if (matchedAcc && matchedAcc.prezzo_fornitore !== undefined && matchedAcc.prezzo_fornitore !== null) {
          supplierVal = parseFloat(matchedAcc.prezzo_fornitore);
        } else if (matchedProd && matchedProd.prezzo_fornitore !== undefined && matchedProd.prezzo_fornitore !== null) {
          supplierVal = parseFloat(matchedProd.prezzo_fornitore);
        } else {
          supplierVal = isAccessoryItem ? 3.00 : 14.50;
        }
      }

      // Immagine reale
      let resolvedImgUrl = imgUrl || '';
      if (!resolvedImgUrl) {
        if (matchedAcc && matchedAcc.immagine) resolvedImgUrl = matchedAcc.immagine;
        else if (matchedProd && matchedProd.immagine) resolvedImgUrl = matchedProd.immagine;
      }

      const persStr = isAccessoryItem ? 'Nessuna' : (infoPerso || personalizzazione || 'Nessuna');

      let patchArr = [];
      if (!isAccessoryItem) {
        if (Array.isArray(patches)) {
          patchArr = patches.map(p => String(p).trim()).filter(Boolean);
        } else if (patch && String(patch).trim()) {
          patchArr = [String(patch).trim()];
        }
      }

      const newItem = {
        id: matchedAcc ? matchedAcc.id : ((matchedProd && matchedProd.id) ? matchedProd.id : (productId || `item_${Date.now()}`)),
        accessory_id: isAccessoryItem ? (matchedAcc ? matchedAcc.id : (req.body.accessory_id || productId)) : undefined,
        tipo_catalogo: isAccessoryItem ? 'accessori' : 'prodotti',
        legacy_id: (matchedProd && matchedProd.legacy_id) ? matchedProd.legacy_id : (legacy_id || null),
        squadra: nomeSquadra,
        categoria: cat,
        stagione: stag,
        versione: vers,
        target: tgt,
        taglia: cleanTaglia,
        quantita: q,
        prezzo: priceVal,
        prezzo_fornitore: supplierVal,
        imgUrl: resolvedImgUrl,
        immagine: resolvedImgUrl,
        personalizzazione: persStr,
        infoPerso: persStr,
        customName: isAccessoryItem ? '' : (customName || ''),
        customNumber: isAccessoryItem ? '' : (customNumber || ''),
        patch: isAccessoryItem ? '' : patchArr.join(', '),
        patches: patchArr
      };

      carrello.push(newItem);
      console.log(`➕ Aggiunto articolo all'ordine #${orderId}:`, newItem.squadra, `(${newItem.taglia})`);

      const calcResult = await ricalcolaTotaliEDatiDerivatiOrdine(targetOrder, carrello);
      await salvaModificheOrdineAutoritativo(orderId, calcResult.updateFields, calcResult.totalNum, calcResult.subtotal, calcResult.shipping);

      const mergedOrders = await getDbOrdersMerged();
      const updatedOrder = mergedOrders.find(o => Number(o.id) === orderId) || { ...targetOrder, ...calcResult.updateFields };

      return res.json({
        success: true,
        message: "Articolo aggiunto con successo all'ordine.",
        order: updatedOrder
      });
    } catch (err) {
      console.error("⚠️ Errore aggiunta articolo ordine:", err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });
}
