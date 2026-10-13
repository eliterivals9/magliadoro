import http from "http";

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = "";
      res.on("data", c => body += c);
      res.on("end", () => resolve(JSON.parse(body)));
    }).on("error", reject);
  });
}

async function run() {
  const settingsData = await fetchUrl("http://localhost:3000/api/settings");
  const productsData = await fetchUrl("http://localhost:3000/api/products");
  const teamsData = await fetchUrl("http://localhost:3000/api/teams");

  const patch = settingsData.settings.patches.find(p => p.nome === "Serie A");
  const publicTeams = teamsData.teams || [];
  const databaseProdotti = productsData.products || [];

  function normalizzaStringaLega(str) {
    if (!str) return '';
    return String(str)
        .toLowerCase()
        .replace(/^(lega_|sezione_|continent_|confederazione_)/i, '')
        .replace(/[-_]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
  }

  function normalizzaChiaveCategoria(catStr) {
    if (!catStr) return '';
    let str = String(catStr).toLowerCase().trim();
    str = str.replace(/^(cat_|fil_|rule_)/i, '').replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
    if (str === 'tute' || str === 'tuta' || str === 'tracksuit') return 'tuta';
    if (str === 'antivento' || str === 'windbreaker' || str === 'giaccavento') return 'antivento';
    if (str === 'portiere' || str === 'kit portiere' || str === 'goalkeeper' || str === 'gk' || str === 'keeper') return 'portiere';
    if (str === 'kit allenamento' || str === 'training kit' || str === 'vest') return 'kit allenamento';
    if (str === 'kit bambino' || str === 'bambino' || str === 'kids' || str === 'kid') return 'kit bambino';
    if (str === 'smanicato' || str === 'smanicati' || str === 'sleeveless') return 'smanicato';
    if (str === 'maniche lunghe' || str === 'long sleeve') return 'maniche lunghe';
    if (str === 'fan' || str === 'fan version' || str === 'versione fan') return 'fan';
    if (str === 'player' || str === 'player version' || str === 'versione player') return 'player';
    if (str === 'retro' || str === 'vintage') return 'retro';
    if (str === 'kit' || str === 'full kit') return 'kit';
    return str;
  }

  function isCategoriaConsentitaPerPatch(patch, prod) {
    if (!patch) return false;
    const catCfg = patch.categorie_per || patch.disponibile_per?.categorie;
    if (!catCfg) return true;
    if (catCfg.tutte_categorie !== false) return true;
    const allowedArr = Array.isArray(catCfg.categorie) ? catCfg.categorie : [];
    if (allowedArr.length === 0) return false;

    const rawProdCat = (prod?.categoria || prod?.category || prod?.tipo || '').trim();
    const prodTitle = (prod?.versione || prod?.nome || prod?.title || '').trim();
    if (!rawProdCat && !prodTitle) return true;

    const prodNormKey = normalizzaChiaveCategoria(rawProdCat);
    const prodTitleNorm = normalizzaChiaveCategoria(prodTitle);

    const isMatch = allowedArr.some(allowedCat => {
        const allowedNormKey = normalizzaChiaveCategoria(allowedCat);
        if (!allowedNormKey) return false;
        if (prodNormKey && (allowedNormKey === prodNormKey || allowedNormKey.includes(prodNormKey) || prodNormKey.includes(allowedNormKey))) return true;
        if (prodTitleNorm && (allowedNormKey === prodTitleNorm || prodTitleNorm.includes(allowedNormKey))) return true;
        return false;
    });
    return isMatch;
  }

  function isPatchCompatibileConProdotto(patch, prod) {
    if (!patch || patch.stato === 'disattivo' || patch.stato === false) return false;
    if (!isCategoriaConsentitaPerPatch(patch, prod)) return false;
    if (!patch.disponibile_per) return true;
    const disp = patch.disponibile_per;
    if (!prod) return true;

    const squadName = (prod.squadra || prod.versione || prod.nome || '').trim();
    const normSquadName = normalizzaStringaLega(squadName);

    let teamMatch = publicTeams.find(t => {
        const tName = (t.name || '').trim().toLowerCase();
        const sName = squadName.toLowerCase();
        return tName === sName || normalizzaStringaLega(tName) === normSquadName || (sName && sName.includes(tName)) || (tName && tName.includes(sName));
    });

    let prodLegaOrSezione = (prod.campionato || prod.sezione || prod.lega || (teamMatch ? (teamMatch.sezione || teamMatch.lega) : '') || '').trim();
    const normProdLega = normalizzaStringaLega(prodLegaOrSezione);

    if (!disp.club || disp.club.abilitato === false) return false;
    if (disp.club.tutte_leghe !== false || !Array.isArray(disp.club.leghe) || disp.club.leghe.length === 0) return true;
    if (!normProdLega) return true;

    return disp.club.leghe.some(leg => {
        const normLeg = normalizzaStringaLega(leg);
        if (!normLeg) return false;
        return normLeg === normProdLega || normProdLega.includes(normLeg) || normLeg.includes(normProdLega);
    });
  }

  // Find all products whose team is a Serie A team or belongs to Serie A
  const serieATeamNames = publicTeams.filter(t => t.sezione === 'Serie A').map(t => t.name);
  console.log("Serie A Teams in publicTeams:", serieATeamNames);

  const results = {
    authorizedAndIncluded: [],
    authorizedButExcluded: [],
    nonAuthorizedAndExcluded: [],
    nonAuthorizedButIncluded: []
  };

  databaseProdotti.forEach(p => {
    const isSerieA = serieATeamNames.some(tName => tName.toLowerCase() === (p.squadra || '').toLowerCase());
    if (isSerieA) {
      const isCatOk = isCategoriaConsentitaPerPatch(patch, p);
      const isComp = isPatchCompatibileConProdotto(patch, p);

      if (isCatOk && isComp) {
        results.authorizedAndIncluded.push(p);
      } else if (isCatOk && !isComp) {
        results.authorizedButExcluded.push(p);
      } else if (!isCatOk && !isComp) {
        results.nonAuthorizedAndExcluded.push(p);
      } else if (!isCatOk && isComp) {
        results.nonAuthorizedButIncluded.push(p);
      }
    }
  });

  console.log(`Summary for Serie A Products (${results.authorizedAndIncluded.length + results.authorizedButExcluded.length + results.nonAuthorizedAndExcluded.length + results.nonAuthorizedButIncluded.length} total):`);
  console.log(`- Authorized & Included: ${results.authorizedAndIncluded.length}`);
  console.log(`- Authorized BUT Excluded: ${results.authorizedButExcluded.length}`);
  console.log(`- Non-Authorized & Excluded: ${results.nonAuthorizedAndExcluded.length}`);
  console.log(`- Non-Authorized BUT Included: ${results.nonAuthorizedButIncluded.length}`);

  if (results.authorizedButExcluded.length > 0) {
    console.log("\n=== DETAILS OF AUTHORIZED BUT EXCLUDED PRODUCTS ===");
    results.authorizedButExcluded.forEach(p => {
      console.log(`ID: ${p.id} | Squadra: ${p.squadra} | Categoria: ${p.categoria} | Versione: ${p.versione}`);
    });
  }
}

run();
