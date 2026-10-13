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

  const patch = settingsData.settings.patches.find(p => p.nome === "Serie A");
  const databaseProdotti = productsData.products || [];

  function normalizzaChiaveCategoria(catStr) {
    if (!catStr) return "";
    let str = String(catStr).toLowerCase().trim();
    str = str.replace(/^(cat_|fil_|rule_)/i, "").replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
    if (str === "tute" || str === "tuta" || str === "tracksuit") return "tuta";
    if (str === "antivento" || str === "windbreaker" || str === "giaccavento") return "antivento";
    if (str === "portiere" || str === "kit portiere" || str === "goalkeeper" || str === "gk" || str === "keeper") return "portiere";
    if (str === "kit allenamento" || str === "training kit" || str === "vest") return "kit allenamento";
    if (str === "kit bambino" || str === "bambino" || str === "kids" || str === "kid") return "kit bambino";
    if (str === "smanicato" || str === "smanicati" || str === "sleeveless") return "smanicato";
    if (str === "maniche lunghe" || str === "long sleeve") return "maniche lunghe";
    if (str === "fan" || str === "fan version" || str === "versione fan") return "fan";
    if (str === "player" || str === "player version" || str === "versione player") return "player";
    if (str === "retro" || str === "vintage") return "retro";
    if (str === "kit" || str === "full kit") return "kit";
    return str;
  }

  function isCategoriaConsentitaPerPatch(patch, prod) {
    if (!patch) return false;
    const catCfg = patch.categorie_per || patch.disponibile_per?.categorie;
    if (!catCfg) return true;
    if (catCfg.tutte_categorie !== false) return true;
    const allowedArr = Array.isArray(catCfg.categorie) ? catCfg.categorie : [];
    if (allowedArr.length === 0) return false;

    const rawProdCat = (prod?.categoria || prod?.category || prod?.tipo || "").trim();
    const prodTitle = (prod?.versione || prod?.nome || prod?.title || "").trim();
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

  console.log("Allowed Categories in Patch Serie A:", patch.categorie_per?.categorie);

  const antiventoProds = databaseProdotti.filter(p => p.categoria === "Antivento");
  antiventoProds.forEach(p => {
    const rawProdCat = (p.categoria || "").trim();
    const prodTitle = (p.versione || p.nome || "").trim();
    const prodNormKey = normalizzaChiaveCategoria(rawProdCat);
    const prodTitleNorm = normalizzaChiaveCategoria(prodTitle);
    const isCatOk = isCategoriaConsentitaPerPatch(patch, p);
    console.log(`ID: ${p.id} | Squadra: ${p.squadra} | Versione: "${prodTitle}" | prodNormKey: "${prodNormKey}" | prodTitleNorm: "${prodTitleNorm}" | isCatOk: ${isCatOk}`);
  });
}

run();
