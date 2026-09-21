/**
 * Maglia d'Oro - Admin Accessori (Modulo JS Dedicato & Isolato)
 * Gestione esclusiva per il catalogo Accessori:
 * - Visualizzazione tabellare e card
 * - Sistema di selezione identico ad Admin Principale:
 *    * Selezione singola e multipla con persistenza cross-pagina
 *    * Ambito di selezione "Pagina" o "Tutti i risultati"
 *    * Deselezione singola e totale
 *    * Barra azioni massive per elementi selezionati
 * - Paginazione completa: 10, 25, 50, 100, Tutti
 * - Predisposizione ed esecuzione azioni massive:
 *    * Modifica massiva (campi comuni)
 *    * Attiva / Disattiva selezionati
 *    * Eliminazione massiva con modale di conferma
 * - Ricerca istantanea (nome, categoria, codice)
 * - Filtro dinamico per categoria
 * - Creazione e modifica accessorio
 * - Eliminazione singola sicura
 * - Upload / preview immagine
 */

// Stato Master Dati
let allAccessories = [];
let catalogSettings = { categories: [], brands: [] };
let activeCategoryFilter = 'all';
let searchQuery = '';
let currentEditingId = null;

// Stato Paginazione
let currentAccessoriesPage = 1;
let accessoriesPerPage = 10; // 'all' oppure numero (10, 25, 50, 100)

// Stato Selezione Prodotti (identico ad Admin Principale)
let selectedAccessoryIds = new Set();
let currentFilteredAccessoriesList = [];
let currentPaginatedAccessoriesList = [];
let accessorySelectionScopeMode = 'tutti'; // 'pagina' oppure 'tutti'

// Helper: Formattazione prezzi
function formatCurrency(val, currency = '€') {
    if (val === undefined || val === null || isNaN(Number(val))) return `${currency} 0.00`;
    return `${currency} ${Number(val).toFixed(2)}`;
}

// Helper: Toast Notifications
function showAccessoriToast(message, type = 'success') {
    let container = document.getElementById('accessori-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'accessori-toast-container';
        container.className = 'fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `px-4 py-3 rounded-xl shadow-2xl text-xs font-bold text-white flex items-center gap-2.5 transition-all transform duration-300 translate-y-4 opacity-0 pointer-events-auto border ${
        type === 'success' 
            ? 'bg-zinc-900 border-emerald-500/50 text-emerald-300' 
            : type === 'error' 
            ? 'bg-zinc-900 border-red-500/50 text-red-300' 
            : 'bg-zinc-900 border-brand-gold/50 text-brand-gold'
    }`;
    
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-4', 'opacity-0');
    });

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Caricamento Dati Accessori da API /api/accessories
async function loadAccessories() {
    const tableBody = document.getElementById('accessories-table-body');
    const loadingState = document.getElementById('accessories-loading');
    const emptyState = document.getElementById('accessories-empty');

    if (loadingState) loadingState.classList.remove('hidden');
    if (tableBody) tableBody.innerHTML = '';
    if (emptyState) emptyState.classList.add('hidden');

    try {
        const response = await fetch('/api/accessories');
        const data = await response.json();

        if (data && data.success && Array.isArray(data.accessories)) {
            allAccessories = data.accessories;
        } else {
            allAccessories = [];
        }

        updateCategoriesFilter();
        renderAccessoriesTable();
        updateDashboardMetrics();

    } catch (err) {
        console.error("Errore caricamento accessori:", err);
        showAccessoriToast("Errore di caricamento catalogo accessori", "error");
    } finally {
        if (loadingState) loadingState.classList.add('hidden');
    }
}

// Aggiorna metriche veloci in header
function updateDashboardMetrics() {
    const countBadge = document.getElementById('accessories-total-count');
    const countCard = document.getElementById('accessories-total-count-card');
    const countActive = document.getElementById('metric-active-count');
    const countCategories = document.getElementById('metric-categories-count');
    
    if (countBadge) countBadge.innerText = allAccessories.length;
    if (countCard) countCard.innerText = allAccessories.length;
    
    const activeItems = allAccessories.filter(a => a.stato !== 'disattivato');
    if (countActive) countActive.innerText = activeItems.length;

    const uniqueCats = new Set(allAccessories.map(a => a.categoria).filter(Boolean));
    if (countCategories) countCategories.innerText = uniqueCats.size;
}

// Popolamento dinamico delle opzioni filtro categoria
function updateCategoriesFilter() {
    const filterSelect = document.getElementById('filter-category-select');
    const modalCategorySelect = document.getElementById('modal-acc-categoria');
    const batchCategorySelect = document.getElementById('batch-acc-categoria');

    // Recupera categorie dalle impostazioni dinamiche se presenti, altrimenti fallback
    let categoriesList = [];
    if (catalogSettings && Array.isArray(catalogSettings.categories) && catalogSettings.categories.length > 0) {
        categoriesList = [...catalogSettings.categories].sort((a, b) => (Number(a.ordine) || 99) - (Number(b.ordine) || 99));
    } else {
        const standardCategories = ['Calze', 'Calzettoni', 'Guanti', 'Palloni', 'Cappellini', 'Sciarpe', 'Borse', 'Fasce Capitano', 'Altri Accessori'];
        const dynamicCategories = new Set(standardCategories);
        allAccessories.forEach(a => {
            if (a && a.categoria) dynamicCategories.add(String(a.categoria).trim());
        });
        categoriesList = Array.from(dynamicCategories).map((c, idx) => ({ id: `cat-${idx}`, nome: c, attiva: true, ordine: idx + 1 }));
    }

    // Assicura che anche categorie presenti in allAccessories non configurate siano comunque selezionabili
    allAccessories.forEach(a => {
        if (a && a.categoria) {
            const exists = categoriesList.some(c => c.nome.toLowerCase() === String(a.categoria).trim().toLowerCase());
            if (!exists) {
                categoriesList.push({ id: `cat-extra-${Date.now()}`, nome: String(a.categoria).trim(), attiva: true, ordine: 999 });
            }
        }
    });

    if (filterSelect) {
        const currentVal = filterSelect.value;
        filterSelect.innerHTML = '<option value="all">Tutte le Categorie</option>';
        categoriesList.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.nome;
            opt.innerText = (cat.icona ? `${cat.icona} ` : '') + cat.nome;
            filterSelect.appendChild(opt);
        });
        filterSelect.value = currentVal || 'all';
    }

    if (modalCategorySelect) {
        const currentVal = modalCategorySelect.value;
        modalCategorySelect.innerHTML = '';
        categoriesList.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.nome;
            opt.innerText = (cat.icona ? `${cat.icona} ` : '') + cat.nome;
            modalCategorySelect.appendChild(opt);
        });
        if (currentVal) modalCategorySelect.value = currentVal;
    }

    if (batchCategorySelect) {
        batchCategorySelect.innerHTML = '<option value="">-- Nessuna modifica --</option>';
        categoriesList.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.nome;
            opt.innerText = (cat.icona ? `${cat.icona} ` : '') + cat.nome;
            batchCategorySelect.appendChild(opt);
        });
    }

    updateBrandsOptions();
}

// Popolamento dinamico delle marche nel modal admin
function updateBrandsOptions() {
    const marcaSelect = document.getElementById('modal-acc-marca-select');
    if (!marcaSelect) return;

    let brandsList = [];
    if (catalogSettings && Array.isArray(catalogSettings.brands) && catalogSettings.brands.length > 0) {
        // Mostra le marche configurate ordinate per ordine
        brandsList = [...catalogSettings.brands]
            .filter(b => b.stato !== 'disattivato')
            .sort((a, b) => (Number(a.ordine) || 99) - (Number(b.ordine) || 99))
            .map(b => b.nome);
    } else {
        const standardBrands = ['Nike', 'Adidas', 'Puma', 'Kappa', 'Macron', 'Joma', 'New Balance', 'Mizuno', 'Under Armour', 'Umbro', 'Hummel', 'Erreà', 'Givova', 'Legea'];
        const dynamicBrands = new Set(standardBrands);
        allAccessories.forEach(a => {
            if (a && a.marca && a.marca.trim() !== '') dynamicBrands.add(a.marca.trim());
        });
        brandsList = Array.from(dynamicBrands).sort((a, b) => a.localeCompare(b));
    }

    // Assicura che le marche presenti nei prodotti siano presenti
    allAccessories.forEach(a => {
        if (a && a.marca && a.marca.trim() !== '') {
            const clean = a.marca.trim();
            if (!brandsList.some(b => b.toLowerCase() === clean.toLowerCase())) {
                brandsList.push(clean);
            }
        }
    });

    const currentVal = marcaSelect.value;
    let html = '<option value="">Nessuna marca</option>';
    brandsList.forEach(b => {
        html += `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`;
    });
    html += '<option value="__custom__">+ Altra marca (inserisci nome)...</option>';
    marcaSelect.innerHTML = html;
    if (currentVal) marcaSelect.value = currentVal;
}

window.gestisciCambioMarcaAdmin = function(val) {
    const customInput = document.getElementById('modal-acc-marca-custom');
    if (!customInput) return;
    if (val === '__custom__') {
        customInput.classList.remove('hidden');
        customInput.focus();
    } else {
        customInput.classList.add('hidden');
        customInput.value = '';
    }
};

/* =========================================================
   GESTIONE SELEZIONE IDENTICA AD ADMIN PRINCIPALE
   ========================================================= */

window.cambiaModalitaSelezioneAccessori = function(mode) {
    accessorySelectionScopeMode = mode;
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
    aggiornaStatoSelezioneMassivaAccessori();
};

window.toggleSelectAccessory = function(id, isChecked) {
    const strId = String(id);
    if (isChecked) {
        selectedAccessoryIds.add(strId);
    } else {
        selectedAccessoryIds.delete(strId);
    }
    const row = document.getElementById(`row-accessory-${id}`);
    if (row) {
        if (isChecked) {
            row.classList.add('bg-amber-500/10');
        } else {
            row.classList.remove('bg-amber-500/10');
        }
    }
    aggiornaStatoSelezioneMassivaAccessori();
};

window.toggleSelectAllAccessories = function(isChecked) {
    const targetList = (accessorySelectionScopeMode === 'pagina') ? currentPaginatedAccessoriesList : currentFilteredAccessoriesList;
    if (!targetList || targetList.length === 0) return;

    if (isChecked) {
        targetList.forEach(a => {
            const aId = String(a.id);
            selectedAccessoryIds.add(aId);
        });
    } else {
        targetList.forEach(a => {
            const aId = String(a.id);
            selectedAccessoryIds.delete(aId);
        });
    }
    renderAccessoriesTable();
    aggiornaStatoSelezioneMassivaAccessori();
};

window.deselezionaTuttiAccessori = function() {
    selectedAccessoryIds.clear();
    const selectAllCb = document.getElementById('select-all-accessories-checkbox');
    if (selectAllCb) selectAllCb.checked = false;
    renderAccessoriesTable();
    aggiornaStatoSelezioneMassivaAccessori();
};

function aggiornaStatoSelezioneMassivaAccessori() {
    const count = selectedAccessoryIds.size;
    const actionBar = document.getElementById('batch-edit-action-bar');
    const countSpan = document.getElementById('batch-selected-count');
    const selectAllCb = document.getElementById('select-all-accessories-checkbox');

    if (actionBar) {
        if (count >= 1) {
            actionBar.classList.remove('hidden');
            if (countSpan) {
                countSpan.textContent = count === 1 ? `1 accessorio selezionato` : `${count} accessori selezionati`;
            }
        } else {
            actionBar.classList.add('hidden');
        }
    }

    if (selectAllCb) {
        const targetList = (accessorySelectionScopeMode === 'pagina') ? currentPaginatedAccessoriesList : currentFilteredAccessoriesList;
        if (targetList && targetList.length > 0) {
            const allChecked = targetList.every(a => selectedAccessoryIds.has(String(a.id)));
            selectAllCb.checked = allChecked;
        } else {
            selectAllCb.checked = false;
        }
    }
}

/* =========================================================
   GESTIONE PAGINAZIONE
   ========================================================= */

window.cambiaElementiPerPagina = function(val) {
    if (val === 'all') {
        accessoriesPerPage = 'all';
    } else {
        accessoriesPerPage = parseInt(val, 10) || 10;
    }
    currentAccessoriesPage = 1;
    renderAccessoriesTable();
};

window.cambiaPaginaAccessori = function(page) {
    currentAccessoriesPage = page;
    renderAccessoriesTable();
    // Scroll leggero alla tabella
    const tableEl = document.getElementById('accessories-table');
    if (tableEl) {
        tableEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
};

/* =========================================================
   RENDERING TABELLA ACCESSORI (FILTRI + PAGINAZIONE + SELEZIONE)
   ========================================================= */

function renderAccessoriesTable() {
    const tableBody = document.getElementById('accessories-table-body');
    const emptyState = document.getElementById('accessories-empty');
    const filteredCountBadge = document.getElementById('accessories-filtered-count');
    const paginationContainer = document.getElementById('accessories-pagination');

    if (!tableBody) return;
    tableBody.innerHTML = '';

    const query = searchQuery.trim().toLowerCase();

    // 1. FILTRI
    const filtered = allAccessories.filter(item => {
        if (!item) return false;
        
        // Filtro Categoria
        if (activeCategoryFilter !== 'all' && item.categoria !== activeCategoryFilter) {
            return false;
        }

        // Ricerca per Nome, Categoria, Marca o Codice
        if (query) {
            const matchNome = item.nome && item.nome.toLowerCase().includes(query);
            const matchCat = item.categoria && item.categoria.toLowerCase().includes(query);
            const matchMarca = item.marca && item.marca.toLowerCase().includes(query);
            const matchCod = (item.codice || item.id) && String(item.codice || item.id).toLowerCase().includes(query);
            if (!matchNome && !matchCat && !matchMarca && !matchCod) return false;
        }

        return true;
    });

    currentFilteredAccessoriesList = filtered;

    if (filteredCountBadge) {
        filteredCountBadge.innerText = `${filtered.length} di ${allAccessories.length} accessori visualizzati`;
    }

    if (filtered.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        if (paginationContainer) {
            paginationContainer.innerHTML = '';
            paginationContainer.classList.add('hidden');
        }
        currentPaginatedAccessoriesList = [];
        aggiornaStatoSelezioneMassivaAccessori();
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    // 2. PAGINAZIONE
    const totalCount = filtered.length;
    let paginatedAccessories = [];
    let totalPages = 1;
    let startIndex = 0;
    let endIndex = totalCount;

    if (accessoriesPerPage === 'all') {
        paginatedAccessories = filtered;
        totalPages = 1;
        currentAccessoriesPage = 1;
        startIndex = 0;
        endIndex = totalCount;
    } else {
        const perPage = typeof accessoriesPerPage === 'number' ? accessoriesPerPage : 10;
        totalPages = Math.ceil(totalCount / perPage) || 1;

        if (currentAccessoriesPage > totalPages) currentAccessoriesPage = totalPages;
        if (currentAccessoriesPage < 1) currentAccessoriesPage = 1;

        startIndex = (currentAccessoriesPage - 1) * perPage;
        endIndex = startIndex + perPage;
        paginatedAccessories = filtered.slice(startIndex, endIndex);
    }

    currentPaginatedAccessoriesList = paginatedAccessories;

    // 3. RENDERING RIGHE TABELLA
    paginatedAccessories.forEach(acc => {
        const tr = document.createElement('tr');
        const idStr = String(acc.id);
        const isSelected = selectedAccessoryIds.has(idStr);
        
        tr.id = `row-accessory-${acc.id}`;
        tr.className = `border-b border-slate-100 hover:bg-slate-50/80 transition-colors text-xs ${isSelected ? 'bg-amber-500/10' : ''}`;
        
        const isDisattivato = acc.stato === 'disattivato';
        const isDisponibile = acc.disponibile !== false;

        const imgUrl = acc.immagine || 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=200&auto=format&fit=crop&q=80';
        const displayCode = acc.codice || acc.id || '-';

        tr.innerHTML = `
            <!-- Checkbox Seleziona -->
            <td class="py-3.5 px-4 text-center w-12">
                <input type="checkbox" value="${escapeHtml(idStr)}" 
                    data-accessory-id="${escapeHtml(idStr)}"
                    onchange="toggleSelectAccessory('${escapeHtml(idStr)}', this.checked)" 
                    class="accessory-select-checkbox rounded border-slate-300 text-amber-600 focus:ring-amber-500 h-4 w-4 cursor-pointer" 
                    ${isSelected ? 'checked' : ''}
                >
            </td>
            <!-- Codice -->
            <td class="py-3.5 px-4 font-mono text-[11px] text-slate-400 font-bold w-28">
                ${escapeHtml(displayCode)}
            </td>
            <!-- Prodotto (Immagine + Nome + Taglia) -->
            <td class="py-3.5 px-4">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200/80 overflow-hidden shrink-0 flex items-center justify-center p-0.5 relative group cursor-pointer shadow-sm" onclick="previewImageLarge('${escapeHtml(imgUrl)}', '${escapeHtml(acc.nome)}')">
                        <img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(acc.nome)}" class="w-full h-full object-cover rounded-lg group-hover:scale-110 transition-transform duration-200" onerror="this.src='https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=200&auto=format&fit=crop&q=80'">
                    </div>
                    <div>
                        <p class="font-extrabold text-slate-900 text-xs md:text-sm line-clamp-1">${escapeHtml(acc.nome)}</p>
                        <div class="flex items-center gap-1.5 flex-wrap mt-0.5">
                            ${acc.marca ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/60">${escapeHtml(acc.marca)}</span>` : ''}
                            ${(acc.gestione_taglia === 'manuale' || acc.richiede_taglia === true || acc.taglia === 'manuale' || ((acc.categoria && String(acc.categoria).toLowerCase().includes('calz')) && acc.gestione_taglia !== 'nessuna'))
                                ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">Taglia cliente</span>`
                                : `<span class="text-[10px] text-slate-400 font-medium">Nessuna taglia</span>`
                            }
                            ${(acc.supplier_shipping_enabled !== false && acc.spedizione_fornitore !== false)
                                ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200" title="Incluso nella spedizione fornitore">🚚 Sped: ON</span>`
                                : `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/60" title="Esente da spedizione fornitore">🚚 Sped: OFF</span>`
                            }
                        </div>
                    </div>
                </div>
            </td>
            <!-- Categoria -->
            <td class="py-3.5 px-4 w-36">
                <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                    ${escapeHtml(acc.categoria || 'Accessori')}
                </span>
            </td>
            <!-- Prezzo Vendita -->
            <td class="py-3.5 px-4 w-32">
                <div class="inline-flex items-center bg-slate-50 hover:bg-white focus-within:bg-white border border-slate-200 focus-within:border-brand-gold focus-within:ring-1 focus-within:ring-brand-gold rounded-xl px-2 py-1 transition-all shadow-2xs">
                    <span class="text-[11px] font-bold text-slate-400 mr-1 select-none">€</span>
                    <input type="number" step="0.01" min="0" 
                        value="${acc.prezzo !== undefined ? Number(acc.prezzo) : 0}" 
                        onchange="salvaPrezzoRapidoAccessorio('${escapeHtml(acc.id)}', this.value, 'prezzo')" 
                        class="w-16 bg-transparent text-xs font-mono font-black text-slate-900 focus:outline-none text-right cursor-pointer focus:cursor-text" 
                        title="Modifica rapida Prezzo Vendita (€) - Salva alla modifica">
                </div>
            </td>
            <!-- Costo Fornitore -->
            <td class="py-3.5 px-4 w-32">
                <div class="inline-flex items-center bg-slate-50 hover:bg-white focus-within:bg-white border border-slate-200 focus-within:border-brand-gold focus-within:ring-1 focus-within:ring-brand-gold rounded-xl px-2 py-1 transition-all shadow-2xs">
                    <span class="text-[11px] font-bold text-slate-400 mr-1 select-none">$</span>
                    <input type="number" step="0.01" min="0" 
                        value="${acc.prezzo_fornitore !== undefined ? Number(acc.prezzo_fornitore) : 0}" 
                        onchange="salvaPrezzoRapidoAccessorio('${escapeHtml(acc.id)}', this.value, 'prezzo_fornitore')" 
                        class="w-16 bg-transparent text-xs font-mono font-bold text-slate-600 focus:outline-none text-right cursor-pointer focus:cursor-text" 
                        title="Modifica rapida Costo Fornitore ($) - Salva alla modifica">
                </div>
            </td>
            <!-- Disponibilità -->
            <td class="py-3.5 px-4 w-32">
                ${isDisponibile 
                    ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Disponibile</span>` 
                    : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200"><span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Esaurito</span>`
                }
            </td>
            <!-- Stato -->
            <td class="py-3.5 px-4 w-28">
                ${!isDisattivato 
                    ? `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Attivo</span>` 
                    : `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-zinc-100 text-zinc-500 border border-zinc-300">Disattivato</span>`
                }
            </td>
            <!-- Azioni Singole -->
            <td class="py-3.5 px-4 text-right w-28">
                <div class="flex items-center justify-end gap-1.5">
                    <button onclick="openEditAccessoryModal('${escapeHtml(acc.id)}')" title="Modifica accessorio" class="p-1.5 text-slate-600 hover:text-brand-gold hover:bg-brand-gold/10 rounded-lg transition-colors cursor-pointer">
                        <span class="text-sm">✏️</span>
                    </button>
                    <button onclick="toggleAccessoryStatus('${escapeHtml(acc.id)}')" title="${isDisattivato ? 'Attiva' : 'Disattiva'}" class="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer">
                        <span class="text-sm">${isDisattivato ? '👁️' : '🚫'}</span>
                    </button>
                    <button onclick="confirmDeleteAccessory('${escapeHtml(acc.id)}', '${escapeHtml(acc.nome)}')" title="Elimina accessorio" class="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer">
                        <span class="text-sm">🗑️</span>
                    </button>
                </div>
            </td>
        `;
        tableBody.appendChild(tr);
    });

    // 4. RENDERING CONTROLLI PAGINAZIONE (se applicabile)
    if (paginationContainer) {
        if (accessoriesPerPage === 'all' || totalPages <= 1) {
            paginationContainer.classList.remove('hidden');
            paginationContainer.innerHTML = `
                <span class="text-xs text-slate-500 font-medium">
                    Mostrati <strong class="text-slate-700">${totalCount}</strong> di <strong class="text-slate-700">${totalCount}</strong> accessori
                </span>
                <span class="text-xs text-slate-400 font-medium">Visualizzazione completa</span>
            `;
        } else {
            paginationContainer.classList.remove('hidden');

            let pagesHtml = '';

            // Tasto Precedente
            const prevDisabled = currentAccessoriesPage === 1;
            pagesHtml += `
                <button onclick="${prevDisabled ? '' : 'cambiaPaginaAccessori(' + (currentAccessoriesPage - 1) + ')'}" 
                    class="px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1 ${
                        prevDisabled 
                        ? 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed' 
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer'
                    }">
                    &larr; Prec.
                </button>
            `;

            pagesHtml += `<div class="flex items-center gap-1">`;

            let startPage = Math.max(1, currentAccessoriesPage - 2);
            let endPage = Math.min(totalPages, startPage + 4);
            if (endPage - startPage < 4) {
                startPage = Math.max(1, endPage - 4);
            }

            if (startPage > 1) {
                pagesHtml += `
                    <button onclick="cambiaPaginaAccessori(1)" class="w-8 h-8 rounded-lg text-xs font-semibold hover:bg-slate-100 text-slate-600 cursor-pointer">1</button>
                    ${startPage > 2 ? '<span class="text-slate-400 text-xs px-1">...</span>' : ''}
                `;
            }

            for (let i = startPage; i <= endPage; i++) {
                if (i >= 1 && i <= totalPages) {
                    const isCurrent = i === currentAccessoriesPage;
                    pagesHtml += `
                        <button onclick="cambiaPaginaAccessori(${i})" 
                            class="w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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
                    <button onclick="cambiaPaginaAccessori(${totalPages})" class="w-8 h-8 rounded-lg text-xs font-semibold hover:bg-slate-100 text-slate-600 cursor-pointer">${totalPages}</button>
                `;
            }

            pagesHtml += `</div>`;

            // Tasto Successivo
            const nextDisabled = currentAccessoriesPage === totalPages;
            pagesHtml += `
                <button onclick="${nextDisabled ? '' : 'cambiaPaginaAccessori(' + (currentAccessoriesPage + 1) + ')'}" 
                    class="px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1 ${
                        nextDisabled 
                        ? 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed' 
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer'
                    }">
                    Succ. &rarr;
                </button>
            `;

            paginationContainer.innerHTML = `
                <span class="text-xs text-slate-500 font-medium">
                    Mostrati <strong class="text-slate-700">${startIndex + 1}-${Math.min(endIndex, totalCount)}</strong> di <strong class="text-slate-700">${totalCount}</strong> accessori
                </span>
                <div class="flex items-center gap-2">
                    ${pagesHtml}
                </div>
            `;
        }
    }

    // 5. Aggiorna lo stato visivo della selezione massiva
    aggiornaStatoSelezioneMassivaAccessori();
}

/* =========================================================
   AZIONI MASSIVE SU ACCESSORI SELEZIONATI
   ========================================================= */

// Apertura pannello modifica massiva
window.apriPannelloModificaMassivaAccessori = function() {
    if (selectedAccessoryIds.size < 1) {
        showAccessoriToast("Seleziona almeno 1 accessorio.", "warning");
        return;
    }

    const modal = document.getElementById('batch-edit-accessories-modal');
    const subtitle = document.getElementById('batch-edit-subtitle');
    if (subtitle) {
        subtitle.textContent = `Modifica per ${selectedAccessoryIds.size} accessori selezionati`;
    }

    const form = document.getElementById('batch-edit-accessories-form');
    if (form) form.reset();

    if (modal) modal.classList.remove('hidden');
};

window.chiudiPannelloModificaMassivaAccessori = function() {
    const modal = document.getElementById('batch-edit-accessories-modal');
    if (modal) modal.classList.add('hidden');
};

// Esecuzione Modifica Massiva
window.eseguiModificaMassivaAccessori = async function(e) {
    if (e) e.preventDefault();
    if (selectedAccessoryIds.size < 1) {
        showAccessoriToast("Nessun accessorio selezionato.", "warning");
        return;
    }

    const categoria = document.getElementById('batch-acc-categoria')?.value;
    const marca = document.getElementById('batch-acc-marca')?.value?.trim();
    const prezzo = document.getElementById('batch-acc-prezzo')?.value;
    const costo = document.getElementById('batch-acc-costo')?.value;
    const disponibile = document.getElementById('batch-acc-disponibile')?.value;
    const stato = document.getElementById('batch-acc-stato')?.value;
    const spedizioneFornitore = document.getElementById('batch-acc-spedizione-fornitore')?.value;

    const updates = {};
    if (categoria) updates.categoria = categoria;
    if (marca) updates.marca = marca;
    if (prezzo !== '') updates.prezzo = parseFloat(prezzo);
    if (costo !== '') updates.prezzo_fornitore = parseFloat(costo);
    if (disponibile !== '') updates.disponibile = disponibile === 'true';
    if (stato !== '') updates.stato = stato;
    if (spedizioneFornitore !== '') {
        const val = spedizioneFornitore === 'true';
        updates.supplier_shipping_enabled = val;
        updates.spedizione_fornitore = val;
    }

    if (Object.keys(updates).length === 0) {
        showAccessoriToast("Nessun campo modificato.", "warning");
        return;
    }

    const btn = document.getElementById('btn-submit-batch-edit');
    const originalText = btn?.innerHTML || 'Applica';
    if (btn) {
        btn.innerHTML = '<span>⏳</span> Salvataggio...';
        btn.disabled = true;
    }

    try {
        const ids = Array.from(selectedAccessoryIds);
        const res = await fetch('/api/accessories/batch-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids, updates })
        });
        const data = await res.json();

        if (data && data.success) {
            showAccessoriToast(`Modificati con successo ${data.updatedCount || ids.length} accessori`, "success");
            chiudiPannelloModificaMassivaAccessori();
            await loadAccessories();
        } else {
            showAccessoriToast(data.error || "Errore durante la modifica massiva", "error");
        }
    } catch (err) {
        console.error("Errore modifica massiva accessori:", err);
        showAccessoriToast("Errore di rete durante la modifica massiva", "error");
    } finally {
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
};

// Attiva / Disattiva Massivo
window.batchToggleStatoAccessori = async function(nuovoStato) {
    if (selectedAccessoryIds.size < 1) {
        showAccessoriToast("Seleziona almeno 1 accessorio.", "warning");
        return;
    }

    const ids = Array.from(selectedAccessoryIds);
    try {
        const res = await fetch('/api/accessories/batch-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids, stato: nuovoStato })
        });
        const data = await res.json();

        if (data && data.success) {
            showAccessoriToast(`Impostati su '${nuovoStato}' ${data.updatedCount || ids.length} accessori`, "success");
            await loadAccessories();
        } else {
            showAccessoriToast(data.error || "Errore durante l'aggiornamento di stato", "error");
        }
    } catch (err) {
        console.error("Errore aggiornamento massivo stato:", err);
        showAccessoriToast("Errore di rete durante l'aggiornamento", "error");
    }
};

// Eliminazione Massiva con Conferma
window.apriConfermaEliminazioneMassivaAccessori = function() {
    if (selectedAccessoryIds.size < 1) {
        showAccessoriToast("Seleziona almeno 1 accessorio da eliminare.", "warning");
        return;
    }

    const modal = document.getElementById('batch-delete-confirm-modal');
    const msg = document.getElementById('batch-delete-modal-msg');
    if (msg) {
        msg.textContent = `Sei sicuro di voler eliminare definitivamente ${selectedAccessoryIds.size} accessori selezionati? L'operazione non può essere annullata.`;
    }
    if (modal) modal.classList.remove('hidden');
};

window.chiudiConfermaEliminazioneMassivaAccessori = function() {
    const modal = document.getElementById('batch-delete-confirm-modal');
    if (modal) modal.classList.add('hidden');
};

window.eseguiEliminazioneMassivaAccessori = async function() {
    if (selectedAccessoryIds.size < 1) return;

    const ids = Array.from(selectedAccessoryIds);
    const btn = document.getElementById('btn-execute-batch-delete');
    const originalText = btn?.innerHTML || 'Elimina';
    if (btn) {
        btn.innerHTML = '<span>⏳</span> Eliminazione...';
        btn.disabled = true;
    }

    try {
        const res = await fetch('/api/accessories/batch-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids })
        });
        const data = await res.json();

        if (data && data.success) {
            showAccessoriToast(`Eliminati con successo ${data.deletedCount || ids.length} accessori`, "success");
            selectedAccessoryIds.clear();
            chiudiConfermaEliminazioneMassivaAccessori();
            await loadAccessories();
        } else {
            showAccessoriToast(data.error || "Errore durante l'eliminazione massiva", "error");
        }
    } catch (err) {
        console.error("Errore eliminazione massiva:", err);
        showAccessoriToast("Errore di rete durante l'eliminazione", "error");
    } finally {
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
};

/* =========================================================
   UTILITY & MODALI SINGOLI (AGGIUNTA, MODIFICA, ANTEPRIMA)
   ========================================================= */

// Utility: Escape HTML contro XSS
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Anteprima immagine grande al click
function previewImageLarge(url, title) {
    const modal = document.getElementById('modal-image-preview');
    const imgEl = document.getElementById('modal-image-preview-img');
    const titleEl = document.getElementById('modal-image-preview-title');
    if (modal && imgEl) {
        imgEl.src = url;
        if (titleEl) titleEl.innerText = title;
        modal.classList.remove('hidden');
    }
}
function closeImagePreview() {
    const modal = document.getElementById('modal-image-preview');
    if (modal) modal.classList.add('hidden');
}

// Funzione per il salvataggio rapido in linea di Prezzo (€) o Costo ($) dalla tabella
async function salvaPrezzoRapidoAccessorio(accId, rawVal, field) {
    const num = parseFloat(rawVal);
    if (isNaN(num) || num < 0) {
        showAccessoriToast("Inserisci un valore numerico valido (es. 8 o 4.50)", "error");
        return;
    }

    const payload = {};
    payload[field] = num;

    try {
        const res = await fetch(`/api/accessories/${encodeURIComponent(accId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data && data.success) {
            const acc = allAccessories.find(a => a && (a.id === accId || String(a.id) === String(accId)));
            if (acc) {
                acc[field] = num;
            }
            const label = field === 'prezzo' ? `Prezzo vendita: € ${num.toFixed(2)}` : `Costo fornitore: $ ${num.toFixed(2)}`;
            showAccessoriToast(`${label} salvato con successo!`, "success");
        } else {
            showAccessoriToast(data.error || "Errore salvataggio rapido", "error");
        }
    } catch (err) {
        console.error("Errore salvataggio rapido:", err);
        showAccessoriToast("Errore di rete durante il salvataggio", "error");
    }
}
window.salvaPrezzoRapidoAccessorio = salvaPrezzoRapidoAccessorio;

// Gestione Upload ed Elaborazione Immagine Accessorio
function comprimiImmagineAccessorioAsync(file, maxDim = 1200, quality = 0.8) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;
                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    } else {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = () => resolve(e.target.result);
            img.src = e.target.result;
        };
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
    });
}

function isSupabaseStorageUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return url.includes('.supabase.co/storage/') || url.includes('/storage/v1/object/public/prodotti/');
}

async function handleAccessoryImageUpload(inputEl) {
    const file = inputEl.files && inputEl.files[0];
    if (!file) return;

    if (!file.type || !file.type.startsWith('image/')) {
        showAccessoriToast("Seleziona un file immagine valido (PNG, JPG, WEBP, GIF, SVG).", "error");
        inputEl.value = '';
        return;
    }

    if (file.size > 15 * 1024 * 1024) {
        showAccessoriToast("Dimensione del file troppo elevata (Max 15MB).", "error");
        inputEl.value = '';
        return;
    }

    const statusEl = document.getElementById('modal-acc-img-status');
    const subtextEl = document.getElementById('modal-acc-img-subtext');
    const progressEl = document.getElementById('modal-acc-upload-progress');
    const percentEl = document.getElementById('modal-acc-upload-percent');
    const btnAllegaImg = document.getElementById('btn-acc-allega-img');

    if (progressEl) progressEl.classList.remove('hidden');
    if (statusEl) statusEl.innerText = "Ottimizzazione e salvataggio su Supabase Storage...";
    if (percentEl) percentEl.innerText = "Caricamento 0%";
    if (btnAllegaImg) btnAllegaImg.disabled = true;

    try {
        const base64ToSend = await comprimiImmagineAccessorioAsync(file, 1200, 0.85);
        if (!base64ToSend) {
            throw new Error("Impossibile leggere il file immagine.");
        }

        const uploadResult = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/admin/store-image', true);
            xhr.setRequestHeader('Content-Type', 'application/json');

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable && percentEl) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    percentEl.innerText = `Caricamento ${percent}%`;
                }
            };

            xhr.onload = () => {
                if (xhr.status === 200) {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        if (data.success && (data.internalUrl || data.url)) {
                            resolve(data.internalUrl || data.url);
                        } else {
                            reject(new Error(data.error || "Risposta non valida da Supabase Storage"));
                        }
                    } catch (e) {
                        reject(new Error("Errore durante l'analisi della risposta di Supabase Storage"));
                    }
                } else {
                    let errMsg = `Errore HTTP ${xhr.status} durante il salvataggio su Supabase Storage`;
                    try {
                        const errData = JSON.parse(xhr.responseText);
                        if (errData && errData.error) errMsg = errData.error;
                    } catch (e) {}
                    reject(new Error(errMsg));
                }
            };

            xhr.onerror = () => reject(new Error("Errore di connessione di rete verso Supabase Storage"));
            xhr.send(JSON.stringify({
                productId: null,
                originalUrl: null,
                imageBase64: base64ToSend
            }));
        });

        const hiddenInput = document.getElementById('modal-acc-immagine');
        if (hiddenInput) hiddenInput.value = uploadResult;

        showAccessoriToast("Immagine caricata e resa permanente su Supabase Storage!", "success");
        updateModalImagePreview();
    } catch (err) {
        console.error("⚠️ Errore caricamento immagine accessorio:", err);
        showAccessoriToast("Errore durante il caricamento: " + err.message, "error");
        inputEl.value = '';
        if (statusEl) statusEl.innerText = "Errore durante il caricamento";
    } finally {
        if (progressEl) progressEl.classList.add('hidden');
        if (btnAllegaImg) btnAllegaImg.disabled = false;
        inputEl.value = '';
    }
}

function removeAccessoryImage() {
    const hiddenInput = document.getElementById('modal-acc-immagine');
    if (hiddenInput) hiddenInput.value = '';
    const fileInput = document.getElementById('modal-acc-file-input');
    if (fileInput) fileInput.value = '';
    updateModalImagePreview();
    showAccessoriToast("Immagine rimossa dall'accessorio.", "info");
}

// Gestione Modale Aggiunta/Modifica Singola
function openAddAccessoryModal() {
    currentEditingId = null;
    document.getElementById('modal-accessory-title').innerText = "Nuovo Accessorio";
    document.getElementById('modal-accessory-submit-btn').innerText = "Crea Accessorio";

    document.getElementById('form-accessory').reset();
    document.getElementById('modal-acc-id').value = "";
    document.getElementById('modal-acc-immagine').value = "";
    document.getElementById('modal-acc-stato').value = "attivo";
    document.getElementById('modal-acc-disponibile').value = "true";
    document.getElementById('modal-acc-prezzo').value = "";
    document.getElementById('modal-acc-costo').value = "";
    const inputTagliaHidden = document.getElementById('modal-acc-taglia');
    if (inputTagliaHidden) inputTagliaHidden.value = "";

    const radioNessuna = document.getElementById('modal-acc-taglia-nessuna');
    const radioManuale = document.getElementById('modal-acc-taglia-manuale');
    const catSelect = document.getElementById('modal-acc-categoria');
    const isCalze = catSelect && (catSelect.value || '').toLowerCase().includes('calz');
    if (isCalze && radioManuale) {
        radioManuale.checked = true;
    } else if (radioNessuna) {
        radioNessuna.checked = true;
    }

    const marcaSelect = document.getElementById('modal-acc-marca-select');
    const marcaCustom = document.getElementById('modal-acc-marca-custom');
    if (marcaSelect) marcaSelect.value = "";
    if (marcaCustom) {
        marcaCustom.value = "";
        marcaCustom.classList.add('hidden');
    }

    const switchSped = document.getElementById('modal-acc-spedizione-fornitore');
    if (switchSped) switchSped.checked = true;

    updateModalImagePreview();
    document.getElementById('modal-accessory-container').classList.remove('hidden');
}

function openEditAccessoryModal(accId) {
    const acc = allAccessories.find(a => a && (a.id === accId || String(a.id) === String(accId)));
    if (!acc) {
        showAccessoriToast("Accessorio non trovato", "error");
        return;
    }

    currentEditingId = acc.id;
    document.getElementById('modal-accessory-title').innerText = `Modifica: ${acc.nome}`;
    document.getElementById('modal-accessory-submit-btn').innerText = "Salva Modifiche";

    document.getElementById('modal-acc-id').value = acc.id;
    document.getElementById('modal-acc-nome').value = acc.nome || "";
    document.getElementById('modal-acc-categoria').value = acc.categoria || "Calze";
    document.getElementById('modal-acc-codice').value = acc.codice || acc.id || "";
    document.getElementById('modal-acc-prezzo').value = (acc.prezzo !== undefined && acc.prezzo !== null) ? acc.prezzo : "";
    document.getElementById('modal-acc-costo').value = (acc.prezzo_fornitore !== undefined && acc.prezzo_fornitore !== null) ? acc.prezzo_fornitore : "";
    
    const isManuale = acc.gestione_taglia === 'manuale' || 
                      acc.richiede_taglia === true || 
                      acc.taglia === 'manuale' || 
                      ((acc.categoria && String(acc.categoria).toLowerCase().includes('calz')) && acc.gestione_taglia !== 'nessuna');

    const radioNessuna = document.getElementById('modal-acc-taglia-nessuna');
    const radioManuale = document.getElementById('modal-acc-taglia-manuale');
    if (isManuale) {
        if (radioManuale) radioManuale.checked = true;
        if (radioNessuna) radioNessuna.checked = false;
    } else {
        if (radioNessuna) radioNessuna.checked = true;
        if (radioManuale) radioManuale.checked = false;
    }

    const inputTagliaHidden = document.getElementById('modal-acc-taglia');
    if (inputTagliaHidden) inputTagliaHidden.value = isManuale ? 'manuale' : '';
    document.getElementById('modal-acc-immagine').value = acc.immagine || "";
    document.getElementById('modal-acc-descrizione').value = acc.descrizione || "";
    document.getElementById('modal-acc-disponibile').value = acc.disponibile !== false ? "true" : "false";
    document.getElementById('modal-acc-stato').value = acc.stato === 'disattivato' ? "disattivato" : "attivo";

    const switchSpedEdit = document.getElementById('modal-acc-spedizione-fornitore');
    if (switchSpedEdit) {
        switchSpedEdit.checked = (acc.supplier_shipping_enabled !== false && acc.spedizione_fornitore !== false);
    }

    const marcaSelect = document.getElementById('modal-acc-marca-select');
    const marcaCustom = document.getElementById('modal-acc-marca-custom');
    if (marcaSelect && marcaCustom) {
        const val = acc.marca ? String(acc.marca).trim() : '';
        if (!val) {
            marcaSelect.value = '';
            marcaCustom.value = '';
            marcaCustom.classList.add('hidden');
        } else {
            let optionExists = false;
            for (let i = 0; i < marcaSelect.options.length; i++) {
                if (marcaSelect.options[i].value.toLowerCase() === val.toLowerCase()) {
                    marcaSelect.selectedIndex = i;
                    optionExists = true;
                    break;
                }
            }
            if (optionExists) {
                marcaCustom.value = '';
                marcaCustom.classList.add('hidden');
            } else {
                marcaSelect.value = '__custom__';
                marcaCustom.value = val;
                marcaCustom.classList.remove('hidden');
            }
        }
    }

    updateModalImagePreview();
    document.getElementById('modal-accessory-container').classList.remove('hidden');
}

function closeAccessoryModal() {
    const modal = document.getElementById('modal-accessory-container');
    if (modal) modal.classList.add('hidden');
    currentEditingId = null;
}

// Live preview e stato dell'immagine allegata nel form
function updateModalImagePreview() {
    const hiddenInput = document.getElementById('modal-acc-immagine');
    const imgUrl = hiddenInput ? hiddenInput.value.trim() : '';

    const previewImg = document.getElementById('modal-acc-preview-img');
    const placeholder = document.getElementById('modal-acc-preview-placeholder');
    const statusEl = document.getElementById('modal-acc-img-status');
    const subtextEl = document.getElementById('modal-acc-img-subtext');
    const btnAllegaLabel = document.getElementById('btn-acc-allega-label');
    const btnRimuovi = document.getElementById('btn-acc-rimuovi-img');

    if (imgUrl) {
        if (previewImg) {
            previewImg.src = imgUrl;
            previewImg.classList.remove('hidden');
        }
        if (placeholder) placeholder.classList.add('hidden');
        if (statusEl) statusEl.innerText = "Immagine allegata";
        if (subtextEl) {
            if (isSupabaseStorageUrl(imgUrl)) {
                subtextEl.innerText = "Permanente su Supabase Storage";
            } else if (imgUrl.startsWith('/uploads/') || imgUrl.startsWith('uploads/')) {
                subtextEl.innerText = "⚠️ Percorso locale effimero (da sostituire)";
            } else {
                subtextEl.innerText = "Immagine configurata per l'articolo";
            }
        }
        if (btnAllegaLabel) btnAllegaLabel.innerText = "SOSTITUISCI IMMAGINE";
        if (btnRimuovi) btnRimuovi.classList.remove('hidden');
    } else {
        if (previewImg) {
            previewImg.src = '';
            previewImg.classList.add('hidden');
        }
        if (placeholder) placeholder.classList.remove('hidden');
        if (statusEl) statusEl.innerText = "Nessuna immagine allegata";
        if (subtextEl) subtextEl.innerText = "Formati supportati: PNG, JPG, WEBP, GIF";
        if (btnAllegaLabel) btnAllegaLabel.innerText = "ALLEGA IMMAGINE";
        if (btnRimuovi) btnRimuovi.classList.add('hidden');
    }
}

// Salvataggio form (Create / Update)
async function handleAccessoryFormSubmit(e) {
    e.preventDefault();

    const submitBtn = document.getElementById('modal-accessory-submit-btn');
    const originalText = submitBtn.innerText;
    submitBtn.innerText = "Salvataggio...";
    submitBtn.disabled = true;

    try {
        const idVal = document.getElementById('modal-acc-id').value;
        const nome = document.getElementById('modal-acc-nome').value.trim();
        const categoria = document.getElementById('modal-acc-categoria').value.trim();
        const codice = document.getElementById('modal-acc-codice').value.trim();
        const rawPrezzo = document.getElementById('modal-acc-prezzo').value.trim();
        const rawCosto = document.getElementById('modal-acc-costo').value.trim();

        if (!nome || !categoria) {
            showAccessoriToast("Nome e categoria sono obbligatori", "error");
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
            return;
        }

        const marcaSelect = document.getElementById('modal-acc-marca-select');
        const marcaCustom = document.getElementById('modal-acc-marca-custom');
        let marca = '';
        if (marcaSelect) {
            if (marcaSelect.value === '__custom__') {
                marca = marcaCustom ? marcaCustom.value.trim() : '';
            } else {
                marca = marcaSelect.value.trim();
            }
        }

        const prezzo = (rawPrezzo !== '' && !isNaN(Number(rawPrezzo)) && Number(rawPrezzo) >= 0) ? parseFloat(rawPrezzo) : 0;
        const prezzo_fornitore = (rawCosto !== '' && !isNaN(Number(rawCosto)) && Number(rawCosto) >= 0) ? parseFloat(rawCosto) : 0;

        const radioManualeChecked = document.getElementById('modal-acc-taglia-manuale')?.checked === true;
        const gestione_taglia = radioManualeChecked ? 'manuale' : 'nessuna';
        const richiede_taglia = radioManualeChecked;
        const taglia = radioManualeChecked ? 'manuale' : '';

        let immagine = document.getElementById('modal-acc-immagine').value.trim();
        const descrizione = document.getElementById('modal-acc-descrizione').value.trim();
        const disponibile = document.getElementById('modal-acc-disponibile').value === 'true';
        const stato = document.getElementById('modal-acc-stato').value;

        if (!immagine) {
            showAccessoriToast("Allega un'immagine per l'accessorio prima di salvare.", "error");
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
            return;
        }

        // Protezione anti-regressione percorsi effimeri e temporanei
        if (immagine.startsWith('/uploads/') || immagine.startsWith('uploads/')) {
            showAccessoriToast("I percorsi locali effimeri (/uploads/) non sono consentiti. Clicca su 'SOSTITUISCI IMMAGINE' per caricarla su Supabase Storage.", "error");
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
            return;
        }

        if (immagine.startsWith('blob:') || immagine.startsWith('file:')) {
            showAccessoriToast("I riferimenti temporanei (blob/file) non sono ammessi. Attendi il caricamento su Supabase Storage.", "error");
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
            return;
        }

        if (immagine.startsWith('data:')) {
            showAccessoriToast("Persistenza immagine su Supabase Storage in corso...", "info");
            try {
                const storeRes = await fetch('/api/admin/store-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        productId: null,
                        originalUrl: null,
                        imageBase64: immagine
                    })
                });
                const storeData = await storeRes.json();
                if (!storeRes.ok || !storeData.success || !storeData.internalUrl) {
                    throw new Error(storeData.error || "Impossibile persistere l'immagine su Supabase Storage.");
                }
                immagine = storeData.internalUrl;
                document.getElementById('modal-acc-immagine').value = immagine;
            } catch (sErr) {
                showAccessoriToast("Errore persistenza immagine: " + sErr.message, "error");
                submitBtn.innerText = originalText;
                submitBtn.disabled = false;
                return;
            }
        }

        const payload = {
            id: idVal || undefined,
            nome,
            marca,
            categoria,
            codice,
            prezzo,
            prezzo_fornitore,
            gestione_taglia,
            richiede_taglia,
            taglia,
            immagine,
            descrizione,
            disponibile,
            stato,
            supplier_shipping_enabled: document.getElementById('modal-acc-spedizione-fornitore')?.checked !== false,
            spedizione_fornitore: document.getElementById('modal-acc-spedizione-fornitore')?.checked !== false,
            tipo_catalogo: "accessori"
        };

        const isEditing = Boolean(idVal && currentEditingId);
        const endpoint = isEditing ? `/api/accessories/${encodeURIComponent(idVal)}` : '/api/accessories';
        const method = isEditing ? 'PUT' : 'POST';

        const res = await fetch(endpoint, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (data && data.success) {
            showAccessoriToast(isEditing ? "Accessorio aggiornato con successo" : "Nuovo accessorio creato con successo", "success");
            closeAccessoryModal();
            await loadAccessories();
        } else {
            showAccessoriToast(data.error || "Errore durante il salvataggio", "error");
        }
    } catch (err) {
        console.error("Errore salvataggio accessorio:", err);
        showAccessoriToast("Errore di connessione al server", "error");
    } finally {
        submitBtn.innerText = originalText;
        submitBtn.disabled = false;
    }
}

// Toggle rapido stato attivo/disattivato
async function toggleAccessoryStatus(accId) {
    const acc = allAccessories.find(a => a && (a.id === accId || String(a.id) === String(accId)));
    if (!acc) return;

    const newStatus = acc.stato === 'disattivato' ? 'attivo' : 'disattivato';

    try {
        const res = await fetch(`/api/accessories/${encodeURIComponent(accId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stato: newStatus })
        });
        const data = await res.json();
        if (data && data.success) {
            acc.stato = newStatus;
            showAccessoriToast(`Stato impostato su: ${newStatus}`, "info");
            renderAccessoriesTable();
            updateDashboardMetrics();
        } else {
            showAccessoriToast("Impossibile aggiornare lo stato", "error");
        }
    } catch (err) {
        console.error("Errore cambio stato:", err);
        showAccessoriToast("Errore durante il cambio di stato", "error");
    }
}

// Modale di Conferma Eliminazione Singola
let accessoryToDeleteId = null;
function confirmDeleteAccessory(accId, accNome) {
    accessoryToDeleteId = accId;
    const modal = document.getElementById('modal-delete-confirm');
    const nameEl = document.getElementById('delete-accessory-name');
    if (nameEl) nameEl.innerText = accNome;
    if (modal) modal.classList.remove('hidden');
}

function closeDeleteConfirmModal() {
    accessoryToDeleteId = null;
    const modal = document.getElementById('modal-delete-confirm');
    if (modal) modal.classList.add('hidden');
}

async function executeDeleteAccessory() {
    if (!accessoryToDeleteId) return;

    const btn = document.getElementById('btn-execute-delete');
    const originalText = btn.innerText;
    btn.innerText = "Eliminazione...";
    btn.disabled = true;

    try {
        const res = await fetch(`/api/accessories/${encodeURIComponent(accessoryToDeleteId)}`, {
            method: 'DELETE'
        });
        const data = await res.json();

        if (data && data.success) {
            showAccessoriToast("Accessorio eliminato con successo", "success");
            selectedAccessoryIds.delete(String(accessoryToDeleteId));
            closeDeleteConfirmModal();
            await loadAccessories();
        } else {
            showAccessoriToast(data.error || "Errore durante l'eliminazione", "error");
        }
    } catch (err) {
        console.error("Errore eliminazione:", err);
        showAccessoriToast("Errore di rete durante l'eliminazione", "error");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// =========================================================================
// ESPORTAZIONE JSON / CSV ACCESSORI
// =========================================================================

/**
 * Esporta l'intero catalogo Accessori in formato JSON o CSV perfettamente compatibile e simmetrico
 */
function esportaAccessori(format = 'json') {
    if (!allAccessories || allAccessories.length === 0) {
        showAccessoriToast("Nessun accessorio presente da esportare.", "error");
        return;
    }

    if (format === 'json') {
        const cleanExport = allAccessories.map(acc => ({
            id: acc.id,
            codice: acc.codice || `ACC-${String(acc.id).replace(/\D/g, '').padStart(4, '0')}`,
            nome: acc.nome,
            categoria: acc.categoria,
            prezzo: Number(acc.prezzo || 0),
            prezzo_fornitore: Number(acc.prezzo_fornitore || 0),
            taglia: acc.taglia || 'Unica',
            immagine: acc.immagine,
            descrizione: acc.descrizione || '',
            disponibile: acc.disponibile !== undefined ? acc.disponibile : true,
            stato: acc.stato || 'attivo',
            tipo_catalogo: 'accessori'
        }));

        const jsonStr = JSON.stringify(cleanExport, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `accessori_catalogo_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showAccessoriToast("Catalogo Accessori JSON esportato con successo!", "success");
    } else if (format === 'csv') {
        const headers = ["ID", "Codice", "Nome", "Categoria", "Prezzo EUR", "Prezzo Fornitore USD", "Taglia", "Disponibile", "Stato", "Immagine"];
        const rows = allAccessories.map(acc => [
            acc.id,
            acc.codice || '',
            `"${(acc.nome || '').replace(/"/g, '""')}"`,
            `"${(acc.categoria || '').replace(/"/g, '""')}"`,
            acc.prezzo,
            acc.prezzo_fornitore || 0,
            `"${(acc.taglia || 'Unica').replace(/"/g, '""')}"`,
            acc.disponibile ? "SI" : "NO",
            acc.stato || "attivo",
            `"${(acc.immagine || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `accessori_catalogo_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showAccessoriToast("Catalogo Accessori CSV esportato con successo!", "success");
    }
}

// Inizializzazione Event Listener
document.addEventListener('DOMContentLoaded', () => {
    // Caricamento Iniziale
    loadAccessories();

    // Ricerca in tempo reale (resets page to 1)
    const searchInput = document.getElementById('search-accessory-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            currentAccessoriesPage = 1;
            renderAccessoriesTable();
        });
    }

    // Filtro per Categoria (resets page to 1)
    const categorySelect = document.getElementById('filter-category-select');
    if (categorySelect) {
        categorySelect.addEventListener('change', (e) => {
            activeCategoryFilter = e.target.value;
            currentAccessoriesPage = 1;
            renderAccessoriesTable();
        });
    }

    // Form Submit
    const form = document.getElementById('form-accessory');
    if (form) {
        form.addEventListener('submit', handleAccessoryFormSubmit);
    }

    // Live URL Preview
    const imgInput = document.getElementById('modal-acc-immagine');
    if (imgInput) {
        imgInput.addEventListener('input', updateModalImagePreview);
    }

    // Carica impostazioni catalogo all'avvio
    caricaImpostazioniCatalogo();
});

/* =========================================================
   GESTIONE IMPOSTAZIONI CATALOGO ACCESSORI (CATEGORIE & MARCHE)
   ========================================================= */

// Carica configurazione Categorie e Marche da /api/accessories/settings
async function caricaImpostazioniCatalogo(showFeedback = false) {
    const loadingCat = document.getElementById('loading-categories-settings');
    const loadingBrands = document.getElementById('loading-brands-settings');
    if (loadingCat) loadingCat.classList.remove('hidden');
    if (loadingBrands) loadingBrands.classList.remove('hidden');

    try {
        const res = await fetch('/api/accessories/settings');
        const data = await res.json();
        if (data && data.success && data.settings) {
            catalogSettings = data.settings;
            renderCategoriesSettings();
            renderBrandsSettings();
            updateCategoriesFilter();
            updateBrandsOptions();

            // Aggiorna badge statistiche
            const badgeCount = document.getElementById('badge-settings-count');
            if (badgeCount) {
                const totalItems = (catalogSettings.categories?.length || 0) + (catalogSettings.brands?.length || 0);
                badgeCount.innerText = `${totalItems} elem`;
            }

            if (showFeedback) {
                showAccessoriToast("Impostazioni catalogo ricaricate con successo!", "success");
            }
        } else {
            console.warn("Dati impostazioni non validi:", data);
        }
    } catch (err) {
        console.error("Errore caricamento impostazioni catalogo:", err);
        if (showFeedback) {
            showAccessoriToast("Errore di caricamento impostazioni", "error");
        }
    } finally {
        if (loadingCat) loadingCat.classList.add('hidden');
        if (loadingBrands) loadingBrands.classList.add('hidden');
    }
}

// Renderizza lista Categorie
function renderCategoriesSettings() {
    const container = document.getElementById('container-categories-settings');
    if (!container) return;

    const categories = Array.isArray(catalogSettings.categories) ? [...catalogSettings.categories] : [];
    categories.sort((a, b) => (Number(a.ordine) || 99) - (Number(b.ordine) || 99));

    if (categories.length === 0) {
        container.innerHTML = `
            <div class="p-8 text-center text-slate-400 text-xs">
                Nessuna categoria presente. Clicca su "+ Aggiungi Categoria".
            </div>
        `;
        return;
    }

    let html = '';
    categories.forEach(cat => {
        const count = typeof cat.products_count === 'number' ? cat.products_count : 0;
        const isAttiva = cat.attiva !== false;
        const countBadgeColor = count > 0 
            ? 'bg-amber-50 text-amber-700 border-amber-200' 
            : 'bg-slate-100 text-slate-500 border-slate-200';

        html += `
            <div class="flex items-center justify-between p-3 rounded-2xl border ${isAttiva ? 'border-slate-200 bg-white hover:border-slate-300' : 'border-slate-200/60 bg-slate-50/60 opacity-75'} transition-all gap-3">
                <div class="flex items-center gap-3 min-w-0">
                    <span class="w-6 h-6 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                        ${cat.ordine || 1}
                    </span>
                    <span class="text-xl w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                        ${escapeHtml(cat.icona || '🎒')}
                    </span>
                    <div class="min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <h5 class="text-xs font-extrabold text-slate-900 truncate">${escapeHtml(cat.nome)}</h5>
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold border ${countBadgeColor} shrink-0">
                                ${count} ${count === 1 ? 'prodotto' : 'prodotti'}
                            </span>
                        </div>
                        <p class="text-[10px] ${isAttiva ? 'text-emerald-600 font-semibold' : 'text-slate-400 font-medium'}">
                            ${isAttiva ? '● Visibile nel catalogo e sidebar' : '○ Nascosta dal pubblico'}
                        </p>
                    </div>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                    <!-- Toggle Switch Rapido Attiva/Disattiva -->
                    <label class="relative inline-flex items-center cursor-pointer" title="${isAttiva ? 'Disattiva categoria' : 'Attiva categoria'}">
                        <input type="checkbox" ${isAttiva ? 'checked' : ''} onchange="toggleStatoCategoria('${cat.id}', this.checked)" class="sr-only peer">
                        <div class="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>

                    <!-- Modifica -->
                    <button onclick="apriModalCategoria('${cat.id}')" title="Modifica Categoria" class="p-1.5 text-slate-500 hover:text-brand-gold hover:bg-amber-50 rounded-xl transition-colors cursor-pointer">
                        <span class="text-xs">✏️</span>
                    </button>

                    <!-- Elimina -->
                    <button onclick="confermaEliminaCategoria('${cat.id}')" title="Elimina Categoria" class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer">
                        <span class="text-xs">🗑️</span>
                    </button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Renderizza lista Marche
function renderBrandsSettings() {
    const container = document.getElementById('container-brands-settings');
    if (!container) return;

    const brands = Array.isArray(catalogSettings.brands) ? [...catalogSettings.brands] : [];
    brands.sort((a, b) => (Number(a.ordine) || 99) - (Number(b.ordine) || 99));

    if (brands.length === 0) {
        container.innerHTML = `
            <div class="p-8 text-center text-slate-400 text-xs">
                Nessuna marca presente. Clicca su "+ Aggiungi Marca".
            </div>
        `;
        return;
    }

    let html = '';
    brands.forEach(b => {
        const count = typeof b.products_count === 'number' ? b.products_count : 0;
        const isAttivo = b.stato !== 'disattivato';
        const countBadgeColor = count > 0 
            ? 'bg-slate-100 text-slate-800 border-slate-300 font-bold' 
            : 'bg-slate-50 text-slate-400 border-slate-200';

        html += `
            <div class="flex items-center justify-between p-3 rounded-2xl border ${isAttivo ? 'border-slate-200 bg-white hover:border-slate-300' : 'border-slate-200/60 bg-slate-50/60 opacity-75'} transition-all gap-3">
                <div class="flex items-center gap-3 min-w-0">
                    <span class="w-6 h-6 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                        ${b.ordine || 1}
                    </span>
                    <div class="min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <h5 class="text-xs font-extrabold text-slate-900 truncate">${escapeHtml(b.nome)}</h5>
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold border ${countBadgeColor} shrink-0">
                                ${count} ${count === 1 ? 'prodotto' : 'prodotti'}
                            </span>
                        </div>
                        <p class="text-[10px] ${isAttivo ? 'text-emerald-600 font-semibold' : 'text-slate-400 font-medium'}">
                            ${isAttivo ? '● Disponibile per la selezione' : '○ Disattivata'}
                        </p>
                    </div>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                    <!-- Toggle Switch Rapido Attiva/Disattiva -->
                    <label class="relative inline-flex items-center cursor-pointer" title="${isAttivo ? 'Disattiva marca' : 'Attiva marca'}">
                        <input type="checkbox" ${isAttivo ? 'checked' : ''} onchange="toggleStatoMarca('${b.id}', this.checked)" class="sr-only peer">
                        <div class="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>

                    <!-- Modifica -->
                    <button onclick="apriModalMarca('${b.id}')" title="Modifica Marca" class="p-1.5 text-slate-500 hover:text-brand-gold hover:bg-amber-50 rounded-xl transition-colors cursor-pointer">
                        <span class="text-xs">✏️</span>
                    </button>

                    <!-- Elimina -->
                    <button onclick="confermaEliminaMarca('${b.id}')" title="Elimina Marca" class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer">
                        <span class="text-xs">🗑️</span>
                    </button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Modal Categoria: Apri (Aggiungi o Modifica)
function apriModalCategoria(id = null) {
    const modal = document.getElementById('modal-category-container');
    const title = document.getElementById('modal-category-title');
    const idInput = document.getElementById('setting-category-id');
    const nomeInput = document.getElementById('setting-category-nome');
    const iconaInput = document.getElementById('setting-category-icona');
    const ordineInput = document.getElementById('setting-category-ordine');
    const attivaInput = document.getElementById('setting-category-attiva');

    if (!modal) return;

    if (id) {
        const cat = catalogSettings.categories?.find(c => c.id === id);
        if (cat) {
            title.innerText = 'Modifica Categoria';
            idInput.value = cat.id;
            nomeInput.value = cat.nome || '';
            iconaInput.value = cat.icona || '🎒';
            ordineInput.value = cat.ordine || 1;
            attivaInput.checked = cat.attiva !== false;
        }
    } else {
        title.innerText = 'Nuova Categoria';
        idInput.value = '';
        nomeInput.value = '';
        iconaInput.value = '🎒';
        const nextOrder = (catalogSettings.categories?.length || 0) + 1;
        ordineInput.value = nextOrder;
        attivaInput.checked = true;
    }

    modal.classList.remove('hidden');
    nomeInput.focus();
}

function chiudiModalCategoria() {
    const modal = document.getElementById('modal-category-container');
    if (modal) modal.classList.add('hidden');
}

// Salva Categoria Setting (Submit Form)
async function salvaCategoriaSetting(e) {
    e.preventDefault();
    const id = document.getElementById('setting-category-id').value;
    const nome = document.getElementById('setting-category-nome').value.trim();
    const icona = document.getElementById('setting-category-icona').value.trim() || '🎒';
    const ordine = parseInt(document.getElementById('setting-category-ordine').value, 10) || 1;
    const attiva = document.getElementById('setting-category-attiva').checked;

    if (!nome) {
        showAccessoriToast("Il nome della categoria è obbligatorio.", "error");
        return;
    }

    const btn = document.getElementById('btn-save-category-setting');
    const origHtml = btn?.innerHTML || 'Salva';
    if (btn) {
        btn.innerHTML = '<span>⏳</span> Salvataggio...';
        btn.disabled = true;
    }

    try {
        const res = await fetch('/api/accessories/settings/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id || undefined, nome, icona, ordine, attiva })
        });
        const data = await res.json();
        if (data && data.success) {
            showAccessoriToast(`Categoria '${nome}' salvata con successo!`, "success");
            chiudiModalCategoria();
            await caricaImpostazioniCatalogo();
        } else {
            showAccessoriToast(data.error || "Errore durante il salvataggio della categoria", "error");
        }
    } catch (err) {
        console.error("Errore salvataggio categoria:", err);
        showAccessoriToast("Errore di connessione al server", "error");
    } finally {
        if (btn) {
            btn.innerHTML = origHtml;
            btn.disabled = false;
        }
    }
}

// Toggle Stato Categoria inline
async function toggleStatoCategoria(id, checked) {
    const cat = catalogSettings.categories?.find(c => c.id === id);
    if (!cat) return;

    try {
        const res = await fetch('/api/accessories/settings/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: cat.id,
                nome: cat.nome,
                icona: cat.icona || '🎒',
                ordine: cat.ordine || 1,
                attiva: checked
            })
        });
        const data = await res.json();
        if (data && data.success) {
            cat.attiva = checked;
            renderCategoriesSettings();
            updateCategoriesFilter();
            showAccessoriToast(`Categoria '${cat.nome}' ${checked ? 'attivata' : 'disattivata'}`, "info");
        } else {
            showAccessoriToast(data.error || "Errore aggiornamento stato", "error");
            renderCategoriesSettings();
        }
    } catch (err) {
        console.error("Errore toggle categoria:", err);
        renderCategoriesSettings();
    }
}

// Elimina Categoria (Sicuro)
function confermaEliminaCategoria(id) {
    const cat = catalogSettings.categories?.find(c => c.id === id);
    if (!cat) return;

    const modal = document.getElementById('modal-delete-setting-container');
    const title = document.getElementById('delete-setting-title');
    const msg = document.getElementById('delete-setting-msg');
    const btnConfirm = document.getElementById('btn-confirm-delete-setting');

    if (!modal) return;

    const count = typeof cat.products_count === 'number' ? cat.products_count : 0;
    title.innerText = `Elimina Categoria "${cat.nome}"`;

    if (count > 0) {
        msg.innerHTML = `
            <span class="text-amber-700 font-bold block mb-1">⚠️ Categoria in uso!</span>
            Questa categoria è attualmente associata a <strong>${count}</strong> ${count === 1 ? 'prodotto' : 'prodotti'} nel catalogo.<br>
            Per preservare l'integrità dei dati, ti consigliamo di <strong>disattivare</strong> la categoria oppure di riassegnare prima i prodotti a un'altra categoria.<br><br>
            Se prosegui con l'eliminazione forzata, i prodotti rimarranno nel catalogo ma perderanno il riferimento di categoria configurata.
        `;
        btnConfirm.onclick = () => eseguiEliminaCategoria(id, true);
    } else {
        msg.innerHTML = `
            Sei sicuro di voler eliminare la categoria <strong>"${escapeHtml(cat.nome)}"</strong>?<br>
            Nessun prodotto è attualmente associato. L'operazione è sicura e non influenzerà i prodotti esistenti.
        `;
        btnConfirm.onclick = () => eseguiEliminaCategoria(id, false);
    }

    modal.classList.remove('hidden');
}

async function eseguiEliminaCategoria(id, force = false) {
    const btn = document.getElementById('btn-confirm-delete-setting');
    if (btn) {
        btn.innerHTML = '<span>⏳</span> Eliminazione...';
        btn.disabled = true;
    }

    try {
        const url = `/api/accessories/settings/categories/${encodeURIComponent(id)}${force ? '?force=true' : ''}`;
        const res = await fetch(url, { method: 'DELETE' });
        const data = await res.json();
        if (data && data.success) {
            showAccessoriToast("Categoria eliminata con successo!", "success");
            chiudiModalDeleteSetting();
            await caricaImpostazioniCatalogo();
        } else {
            showAccessoriToast(data.error || "Errore durante l'eliminazione della categoria", "error");
        }
    } catch (err) {
        console.error("Errore delete categoria:", err);
        showAccessoriToast("Errore di comunicazione col server", "error");
    } finally {
        if (btn) {
            btn.innerHTML = '<span>🗑️</span> <span>Conferma Eliminazione</span>';
            btn.disabled = false;
        }
    }
}

// Modal Marca: Apri
function apriModalMarca(id = null) {
    const modal = document.getElementById('modal-brand-container');
    const title = document.getElementById('modal-brand-title');
    const idInput = document.getElementById('setting-brand-id');
    const nomeInput = document.getElementById('setting-brand-nome');
    const ordineInput = document.getElementById('setting-brand-ordine');
    const statoInput = document.getElementById('setting-brand-stato');

    if (!modal) return;

    if (id) {
        const b = catalogSettings.brands?.find(item => item.id === id);
        if (b) {
            title.innerText = 'Modifica Marca';
            idInput.value = b.id;
            nomeInput.value = b.nome || '';
            ordineInput.value = b.ordine || 1;
            statoInput.checked = b.stato !== 'disattivato';
        }
    } else {
        title.innerText = 'Nuova Marca';
        idInput.value = '';
        nomeInput.value = '';
        const nextOrder = (catalogSettings.brands?.length || 0) + 1;
        ordineInput.value = nextOrder;
        statoInput.checked = true;
    }

    modal.classList.remove('hidden');
    nomeInput.focus();
}

function chiudiModalMarca() {
    const modal = document.getElementById('modal-brand-container');
    if (modal) modal.classList.add('hidden');
}

// Salva Marca Setting (Submit Form)
async function salvaMarcaSetting(e) {
    e.preventDefault();
    const id = document.getElementById('setting-brand-id').value;
    const nome = document.getElementById('setting-brand-nome').value.trim();
    const ordine = parseInt(document.getElementById('setting-brand-ordine').value, 10) || 1;
    const stato = document.getElementById('setting-brand-stato').checked ? 'attivo' : 'disattivato';

    if (!nome) {
        showAccessoriToast("Il nome della marca è obbligatorio.", "error");
        return;
    }

    const btn = document.getElementById('btn-save-brand-setting');
    const origHtml = btn?.innerHTML || 'Salva';
    if (btn) {
        btn.innerHTML = '<span>⏳</span> Salvataggio...';
        btn.disabled = true;
    }

    try {
        const res = await fetch('/api/accessories/settings/brands', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id || undefined, nome, ordine, stato })
        });
        const data = await res.json();
        if (data && data.success) {
            showAccessoriToast(`Marca '${nome}' salvata con successo!`, "success");
            chiudiModalMarca();
            await caricaImpostazioniCatalogo();
        } else {
            showAccessoriToast(data.error || "Errore durante il salvataggio della marca", "error");
        }
    } catch (err) {
        console.error("Errore salvataggio marca:", err);
        showAccessoriToast("Errore di connessione al server", "error");
    } finally {
        if (btn) {
            btn.innerHTML = origHtml;
            btn.disabled = false;
        }
    }
}

// Toggle Stato Marca inline
async function toggleStatoMarca(id, checked) {
    const brand = catalogSettings.brands?.find(b => b.id === id);
    if (!brand) return;

    const nuovoStato = checked ? 'attivo' : 'disattivato';
    try {
        const res = await fetch('/api/accessories/settings/brands', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: brand.id,
                nome: brand.nome,
                ordine: brand.ordine || 1,
                stato: nuovoStato
            })
        });
        const data = await res.json();
        if (data && data.success) {
            brand.stato = nuovoStato;
            renderBrandsSettings();
            updateBrandsOptions();
            showAccessoriToast(`Marca '${brand.nome}' ${checked ? 'attivata' : 'disattivata'}`, "info");
        } else {
            showAccessoriToast(data.error || "Errore aggiornamento stato", "error");
            renderBrandsSettings();
        }
    } catch (err) {
        console.error("Errore toggle marca:", err);
        renderBrandsSettings();
    }
}

// Elimina Marca (Sicuro)
function confermaEliminaMarca(id) {
    const brand = catalogSettings.brands?.find(b => b.id === id);
    if (!brand) return;

    const modal = document.getElementById('modal-delete-setting-container');
    const title = document.getElementById('delete-setting-title');
    const msg = document.getElementById('delete-setting-msg');
    const btnConfirm = document.getElementById('btn-confirm-delete-setting');

    if (!modal) return;

    const count = typeof brand.products_count === 'number' ? brand.products_count : 0;
    title.innerText = `Elimina Marca "${brand.nome}"`;

    if (count > 0) {
        msg.innerHTML = `
            <span class="text-amber-700 font-bold block mb-1">⚠️ Marca in uso!</span>
            Questa marca è associata a <strong>${count}</strong> ${count === 1 ? 'prodotto' : 'prodotti'}.<br>
            Ti consigliamo di <strong>disattivarla</strong> per non mostrarla nei menu a tendina futuri, mantenendola sui prodotti già creati.
        `;
        btnConfirm.onclick = () => eseguiEliminaMarca(id, true);
    } else {
        msg.innerHTML = `
            Sei sicuro di voler eliminare la marca <strong>"${escapeHtml(brand.nome)}"</strong>?<br>
            Nessun prodotto la utilizza.
        `;
        btnConfirm.onclick = () => eseguiEliminaMarca(id, false);
    }

    modal.classList.remove('hidden');
}

async function eseguiEliminaMarca(id, force = false) {
    const btn = document.getElementById('btn-confirm-delete-setting');
    if (btn) {
        btn.innerHTML = '<span>⏳</span> Eliminazione...';
        btn.disabled = true;
    }

    try {
        const url = `/api/accessories/settings/brands/${encodeURIComponent(id)}${force ? '?force=true' : ''}`;
        const res = await fetch(url, { method: 'DELETE' });
        const data = await res.json();
        if (data && data.success) {
            showAccessoriToast("Marca eliminata con successo!", "success");
            chiudiModalDeleteSetting();
            await caricaImpostazioniCatalogo();
        } else {
            showAccessoriToast(data.error || "Errore durante l'eliminazione della marca", "error");
        }
    } catch (err) {
        console.error("Errore delete marca:", err);
        showAccessoriToast("Errore di comunicazione col server", "error");
    } finally {
        if (btn) {
            btn.innerHTML = '<span>🗑️</span> <span>Conferma Eliminazione</span>';
            btn.disabled = false;
        }
    }
}

function chiudiModalDeleteSetting() {
    const modal = document.getElementById('modal-delete-setting-container');
    if (modal) modal.classList.add('hidden');
}

// Esponi le funzioni a livello globale per trigger inline
window.loadAccessories = loadAccessories;
window.openAddAccessoryModal = openAddAccessoryModal;
window.openEditAccessoryModal = openEditAccessoryModal;
window.closeAccessoryModal = closeAccessoryModal;
window.handleAccessoryImageUpload = handleAccessoryImageUpload;
window.removeAccessoryImage = removeAccessoryImage;
window.updateModalImagePreview = updateModalImagePreview;
window.toggleAccessoryStatus = toggleAccessoryStatus;
window.confirmDeleteAccessory = confirmDeleteAccessory;
window.closeDeleteConfirmModal = closeDeleteConfirmModal;
window.executeDeleteAccessory = executeDeleteAccessory;
window.previewImageLarge = previewImageLarge;
window.closeImagePreview = closeImagePreview;
window.esportaAccessori = esportaAccessori;

// Esportazioni Gestione Impostazioni Catalogo
window.caricaImpostazioniCatalogo = caricaImpostazioniCatalogo;
window.renderCategoriesSettings = renderCategoriesSettings;
window.renderBrandsSettings = renderBrandsSettings;
window.apriModalCategoria = apriModalCategoria;
window.chiudiModalCategoria = chiudiModalCategoria;
window.salvaCategoriaSetting = salvaCategoriaSetting;
window.toggleStatoCategoria = toggleStatoCategoria;
window.confermaEliminaCategoria = confermaEliminaCategoria;
window.apriModalMarca = apriModalMarca;
window.chiudiModalMarca = chiudiModalMarca;
window.salvaMarcaSetting = salvaMarcaSetting;
window.toggleStatoMarca = toggleStatoMarca;
window.confermaEliminaMarca = confermaEliminaMarca;
window.chiudiModalDeleteSetting = chiudiModalDeleteSetting;

/* ==========================================================================
   MODULO: IMPORTAZIONE MULTIPLA ACCESSORI (BULK IMPORT DEDICATO)
   Caricamento massivo immagini, estrazione automatica nome, applicazione
   valori globali, persistenza Supabase Storage e creazione robusta
   ========================================================================== */

let bulkImportRows = [];
let isBulkImporting = false;

// Helper: Estrae categorie attive dinamiche da catalogSettings
function ottieniListaCategorieDinamiche() {
    let list = [];
    if (catalogSettings && Array.isArray(catalogSettings.categories) && catalogSettings.categories.length > 0) {
        list = [...catalogSettings.categories]
            .filter(c => c && c.attiva !== false)
            .sort((a, b) => (Number(a.ordine) || 99) - (Number(b.ordine) || 99))
            .map(c => c.nome);
    } else {
        list = ['Calze', 'Calzettoni', 'Guanti', 'Palloni', 'Cappellini', 'Sciarpe', 'Borse', 'Fasce Capitano', 'Altri Accessori'];
    }

    // Assicura fallback da accessori esistenti
    allAccessories.forEach(a => {
        if (a && a.categoria && typeof a.categoria === 'string') {
            const clean = a.categoria.trim();
            if (clean && !list.some(c => c.toLowerCase() === clean.toLowerCase())) {
                list.push(clean);
            }
        }
    });

    return list;
}

// Helper: Estrae marche attive dinamiche da catalogSettings
function ottieniListaMarcheDinamiche() {
    let list = [];
    if (catalogSettings && Array.isArray(catalogSettings.brands) && catalogSettings.brands.length > 0) {
        list = [...catalogSettings.brands]
            .filter(b => b && b.stato !== 'disattivato')
            .sort((a, b) => (Number(a.ordine) || 99) - (Number(b.ordine) || 99))
            .map(b => b.nome);
    } else {
        list = ['Nike', 'Adidas', 'Puma', 'Kappa', 'Macron', 'Joma', 'New Balance', 'Mizuno', 'Under Armour', 'Umbro', 'Hummel', 'Erreà'];
    }

    allAccessories.forEach(a => {
        if (a && a.marca && typeof a.marca === 'string') {
            const clean = a.marca.trim();
            if (clean && !list.some(b => b.toLowerCase() === clean.toLowerCase())) {
                list.push(clean);
            }
        }
    });

    return list.sort((a, b) => a.localeCompare(b));
}

// Generazione nome leggibile e pulito dal filename
function generaNomeDaFilename(filename) {
    if (!filename || typeof filename !== 'string') return 'Nuovo Accessorio';
    // Rimuove estensione file
    const base = filename.replace(/\.[a-zA-Z0-9]+$/, '');
    // Sostituisce trattini, underscore e punti con spazi
    const clean = base.replace(/[-_.]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!clean) return 'Nuovo Accessorio';
    // Capitalizza ogni parola
    return clean.split(' ').map(parola => {
        if (!parola) return '';
        return parola.charAt(0).toUpperCase() + parola.slice(1).toLowerCase();
    }).join(' ');
}

// Helper per normalizzare input di prezzo (6, 6.00, 6,00)
function normalizzaPrezzoBulk(val) {
    if (val === undefined || val === null || val === '') return 0;
    const clean = String(val).replace(',', '.').replace(/[^\d.]/g, '').trim();
    const num = parseFloat(clean);
    return isNaN(num) || num < 0 ? 0 : num;
}

// Apertura del modale Bulk Import
async function openBulkImportAccessoriModal() {
    const modal = document.getElementById('modal-bulk-import-container');
    if (!modal) return;

    // Se non sono ancora state caricate le impostazioni catalogo, prova a caricarle
    if (!catalogSettings || !catalogSettings.categories || catalogSettings.categories.length === 0) {
        if (typeof caricaImpostazioniCatalogo === 'function') {
            try {
                await caricaImpostazioniCatalogo(false);
            } catch (e) {
                console.warn("Impossibile pre-caricare impostazioni catalogo:", e);
            }
        }
    }

    // Popola i menu categoria e marca del pannello bulk
    popolaOpzioniPannelloBulk();

    // Reset progress bar e riepiloghi
    const progressContainer = document.getElementById('bulk-progress-container');
    if (progressContainer) progressContainer.classList.add('hidden');
    const resultSummary = document.getElementById('bulk-result-summary');
    if (resultSummary) {
        resultSummary.classList.add('hidden');
        resultSummary.innerHTML = '';
    }

    renderizzaRigheBulk();
    aggiornaContatoriBulk();

    modal.classList.remove('hidden');
}

// Chiusura del modale Bulk Import
function chiudiBulkImportAccessoriModal() {
    if (isBulkImporting) {
        showAccessoriToast("Attendere il completamento dell'importazione in corso prima di chiudere la schermata.", "warning");
        return;
    }

    const modal = document.getElementById('modal-bulk-import-container');
    if (modal) modal.classList.add('hidden');
    chiudiConfermaBulkImport();
}

// Popolamento select globali del pannello bulk
function popolaOpzioniPannelloBulk() {
    const catSelect = document.getElementById('bulk-apply-categoria');
    const marcaSelect = document.getElementById('bulk-apply-marca');

    if (catSelect) {
        const categories = ottieniListaCategorieDinamiche();
        catSelect.innerHTML = '<option value="">-- Non modificare --</option>';
        categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.innerText = cat;
            catSelect.appendChild(opt);
        });
    }

    if (marcaSelect) {
        const brands = ottieniListaMarcheDinamiche();
        marcaSelect.innerHTML = '<option value="">-- Non modificare --</option>';
        brands.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b;
            opt.innerText = b;
            marcaSelect.appendChild(opt);
        });
    }
}

// Gestione selezione file multipli da input o drag & drop
function handleBulkImportFilesSelected(fileList) {
    if (!fileList || fileList.length === 0) return;

    const validExtensions = ['jpg', 'jpeg', 'png', 'webp'];
    const validMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    const categories = ottieniListaCategorieDinamiche();
    const defaultCategoria = categories.find(c => c.toLowerCase().includes('calz')) || categories[0] || 'Calzettoni';

    let addedCount = 0;
    const fileArray = Array.from(fileList);

    fileArray.forEach(file => {
        if (!file) return;

        // Verifica tipo di file
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        const isValid = validExtensions.includes(ext) || validMimes.includes(file.type);
        if (!isValid) return;

        // Crea oggetto riga isolato
        const rowId = 'bulk-row-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
        const previewUrl = URL.createObjectURL(file);
        const nomeAuto = generaNomeDaFilename(file.name);

        bulkImportRows.push({
            id: rowId,
            file: file,
            previewUrl: previewUrl,
            nome: nomeAuto,
            categoria: defaultCategoria,
            marca: '',
            prezzoFornitore: '',
            prezzoVendita: '',
            stato: 'attivo',
            selected: true,
            imported: false,
            importResultId: null,
            importStatus: 'idle', // 'idle' | 'uploading' | 'saving' | 'imported' | 'error_image' | 'error_product'
            errorMessage: null
        });

        addedCount++;
    });

    if (addedCount > 0) {
        showAccessoriToast(`${addedCount} ${addedCount === 1 ? 'immagine aggiunta' : 'immagini aggiunte'} alla coda`, 'success');
        renderizzaRigheBulk();
        aggiornaContatoriBulk();
    } else {
        showAccessoriToast("Nessuna immagine valida trovata. Formati supportati: JPG, PNG, WEBP.", "error");
    }

    // Reset input file per permettere nuove selezioni identiche
    const inputEl = document.getElementById('bulk-import-file-input');
    if (inputEl) inputEl.value = '';
}

// Drag and drop handlers
function handleBulkDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropzone = document.getElementById('bulk-import-dropzone');
    if (dropzone) {
        dropzone.classList.add('border-brand-gold', 'bg-amber-50/40');
    }
}

function handleBulkDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropzone = document.getElementById('bulk-import-dropzone');
    if (dropzone) {
        dropzone.classList.remove('border-brand-gold', 'bg-amber-50/40');
    }
}

function handleBulkDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropzone = document.getElementById('bulk-import-dropzone');
    if (dropzone) {
        dropzone.classList.remove('border-brand-gold', 'bg-amber-50/40');
    }
    if (e.dataTransfer && e.dataTransfer.files) {
        handleBulkImportFilesSelected(e.dataTransfer.files);
    }
}

// Rendering della tabella righe Bulk
function renderizzaRigheBulk() {
    const tbody = document.getElementById('bulk-import-tbody');
    const tableContainer = document.getElementById('bulk-table-container');
    const tableControls = document.getElementById('bulk-table-controls');
    const applyPanel = document.getElementById('bulk-apply-panel');

    if (!tbody) return;

    if (bulkImportRows.length === 0) {
        tbody.innerHTML = '';
        if (tableContainer) tableContainer.classList.add('hidden');
        if (tableControls) tableControls.classList.add('hidden');
        if (applyPanel) applyPanel.classList.add('hidden');
        aggiornaContatoriBulk();
        return;
    }

    if (tableContainer) tableContainer.classList.remove('hidden');
    if (tableControls) tableControls.classList.remove('hidden');
    if (applyPanel) applyPanel.classList.remove('hidden');

    const categories = ottieniListaCategorieDinamiche();
    const brands = ottieniListaMarcheDinamiche();

    let html = '';
    bulkImportRows.forEach((row, index) => {
        const isImported = row.imported === true;
        const isFirstRow = index === 0;

        // Categorie Options
        let catOptions = '';
        categories.forEach(cat => {
            const isSel = cat.toLowerCase() === (row.categoria || '').toLowerCase();
            catOptions += `<option value="${escapeHtml(cat)}" ${isSel ? 'selected' : ''}>${escapeHtml(cat)}</option>`;
        });

        // Brands Options
        let brandOptions = '<option value="">Nessuna</option>';
        brands.forEach(b => {
            const isSel = b.toLowerCase() === (row.marca || '').toLowerCase();
            brandOptions += `<option value="${escapeHtml(b)}" ${isSel ? 'selected' : ''}>${escapeHtml(b)}</option>`;
        });

        // Badge Stato riga
        let statusBadge = '';
        if (isImported) {
            statusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">✓ IMPORTATO</span>`;
        } else if (row.importStatus === 'uploading') {
            statusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 animate-pulse">⏳ Carico foto...</span>`;
        } else if (row.importStatus === 'saving') {
            statusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 animate-pulse">⏳ Creo articolo...</span>`;
        } else if (row.importStatus === 'error_image') {
            statusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200" title="${escapeHtml(row.errorMessage || 'Errore upload immagine')}">❌ Errore Foto</span>`;
        } else if (row.importStatus === 'error_product') {
            statusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200" title="${escapeHtml(row.errorMessage || 'Errore creazione')}">❌ Errore Prodotto</span>`;
        } else {
            const isMissingNome = !row.nome || !row.nome.trim();
            const isMissingCat = !row.categoria || !row.categoria.trim();
            if (isMissingNome) {
                statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">⚠️ Nome vuoto</span>`;
            } else if (isMissingCat) {
                statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">⚠️ Cat. vuota</span>`;
            } else {
                statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">In attesa</span>`;
            }
        }

        const disabledAttr = isImported ? 'disabled' : '';
        const rowBg = isImported 
            ? 'bg-emerald-50/40' 
            : (row.importStatus?.startsWith('error') ? 'bg-red-50/30' : (row.selected ? 'bg-amber-50/20' : 'bg-white hover:bg-slate-50'));

        html += `
            <tr id="tr-${row.id}" class="${rowBg} transition-colors border-b border-slate-100">
                <!-- Checkbox -->
                <td class="py-2 px-3 text-center align-middle">
                    <input type="checkbox" onchange="toggleSelectBulkRow(${index}, this.checked)" ${row.selected ? 'checked' : ''} ${disabledAttr} class="rounded border-slate-300 text-brand-gold focus:ring-brand-gold cursor-pointer">
                </td>

                <!-- Miniatura Foto -->
                <td class="py-2 px-2 text-center align-middle">
                    <div class="w-11 h-11 mx-auto rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center relative group shrink-0">
                        <img src="${row.previewUrl}" alt="Preview" class="w-full h-full object-contain p-0.5" onerror="this.src='https://placehold.co/44x44/eaeef3/1e293b?text=Img'">
                    </div>
                </td>

                <!-- Nome Prodotto -->
                <td class="py-2 px-3 align-middle">
                    <input type="text" value="${escapeHtml(row.nome || '')}" oninput="aggiornaCampoBulkRow(${index}, 'nome', this.value)" placeholder="Nome accessorio..." ${disabledAttr} class="w-full px-2.5 py-1.5 bg-slate-50 border ${!row.nome?.trim() ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200'} rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-brand-gold/30 focus:border-brand-gold outline-none">
                </td>

                <!-- Categoria -->
                <td class="py-2 px-2 align-middle">
                    <select onchange="aggiornaCampoBulkRow(${index}, 'categoria', this.value)" ${disabledAttr} class="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-brand-gold/30 focus:border-brand-gold outline-none cursor-pointer">
                        ${catOptions}
                    </select>
                </td>

                <!-- Marca -->
                <td class="py-2 px-2 align-middle">
                    <select onchange="aggiornaCampoBulkRow(${index}, 'marca', this.value)" ${disabledAttr} class="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-brand-gold/30 focus:border-brand-gold outline-none cursor-pointer">
                        ${brandOptions}
                    </select>
                </td>

                <!-- Prezzo Fornitore (€) -->
                <td class="py-2 px-2 align-middle">
                    <input type="text" value="${escapeHtml(row.prezzoFornitore || '')}" oninput="aggiornaCampoBulkRow(${index}, 'prezzoFornitore', this.value)" placeholder="0.00" ${disabledAttr} class="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 text-right focus:bg-white focus:ring-2 focus:ring-brand-gold/30 focus:border-brand-gold outline-none">
                </td>

                <!-- Prezzo Vendita (€) -->
                <td class="py-2 px-2 align-middle">
                    <input type="text" value="${escapeHtml(row.prezzoVendita || '')}" oninput="aggiornaCampoBulkRow(${index}, 'prezzoVendita', this.value)" placeholder="0.00" ${disabledAttr} class="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 text-right focus:bg-white focus:ring-2 focus:ring-brand-gold/30 focus:border-brand-gold outline-none">
                </td>

                <!-- Stato -->
                <td class="py-2 px-2 align-middle">
                    <select onchange="aggiornaCampoBulkRow(${index}, 'stato', this.value)" ${disabledAttr} class="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-brand-gold/30 focus:border-brand-gold outline-none cursor-pointer">
                        <option value="attivo" ${row.stato === 'attivo' ? 'selected' : ''}>Attivo</option>
                        <option value="disattivato" ${row.stato === 'disattivato' ? 'selected' : ''}>Disattivato</option>
                    </select>
                </td>

                <!-- Stato Importazione -->
                <td class="py-2 px-3 text-center align-middle whitespace-nowrap">
                    ${statusBadge}
                </td>

                <!-- Azioni -->
                <td class="py-2 px-2 text-center align-middle whitespace-nowrap">
                    <div class="flex items-center justify-center gap-1">
                        <button type="button" onclick="duplicaValoriRigaPrecedente(${index})" ${isFirstRow || isImported ? 'disabled' : ''} class="p-1 text-slate-400 hover:text-brand-gold hover:bg-amber-50 rounded-md transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer" title="${isFirstRow ? 'Nessuna riga precedente da cui duplicare' : 'Duplica valori (categoria, marca, prezzi, stato) dalla riga precedente'}">
                            📋
                        </button>
                        <button type="button" onclick="rimuoviRigaBulk(${index})" ${isImported ? 'disabled' : ''} class="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer" title="Rimuovi riga dalla lista">
                            🗑️
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// Aggiorna singolo campo di una riga senza ri-render totale
function aggiornaCampoBulkRow(index, field, value) {
    if (!bulkImportRows[index]) return;
    bulkImportRows[index][field] = value;
    aggiornaContatoriBulk();
}

// Toggle selezione checkbox singola riga
function toggleSelectBulkRow(index, isChecked) {
    if (!bulkImportRows[index]) return;
    bulkImportRows[index].selected = isChecked;
    
    const tr = document.getElementById(`tr-${bulkImportRows[index].id}`);
    if (tr && !bulkImportRows[index].imported) {
        if (isChecked) {
            tr.classList.add('bg-amber-50/20');
        } else {
            tr.classList.remove('bg-amber-50/20');
        }
    }
    aggiornaContatoriBulk();
}

// Seleziona / deseleziona tutte le righe
function selezionaTutteRigheBulk(isChecked) {
    bulkImportRows.forEach(row => {
        if (!row.imported) {
            row.selected = isChecked;
        }
    });

    const thCb = document.getElementById('bulk-th-select-all');
    if (thCb) thCb.checked = isChecked;

    renderizzaRigheBulk();
    aggiornaContatoriBulk();
}

// Duplica valori dalla riga precedente
function duplicaValoriRigaPrecedente(index) {
    if (index <= 0 || !bulkImportRows[index] || !bulkImportRows[index - 1]) return;
    const prev = bulkImportRows[index - 1];
    const curr = bulkImportRows[index];

    if (curr.imported) return;

    // Copia categoria, marca, prezzi e stato (NON foto e nome)
    curr.categoria = prev.categoria;
    curr.marca = prev.marca;
    curr.prezzoFornitore = prev.prezzoFornitore;
    curr.prezzoVendita = prev.prezzoVendita;
    curr.stato = prev.stato;

    showAccessoriToast(`Valori duplicati dalla riga ${index} su riga ${index + 1}`, "info");
    renderizzaRigheBulk();
    aggiornaContatoriBulk();
}

// Rimuovi singola riga dalla coda
function rimuoviRigaBulk(index) {
    if (!bulkImportRows[index]) return;
    const row = bulkImportRows[index];
    if (row.imported) {
        showAccessoriToast("Questo prodotto è già stato importato e non può essere rimosso dalla coda.", "info");
        return;
    }

    if (row.previewUrl && row.previewUrl.startsWith('blob:')) {
        try {
            URL.revokeObjectURL(row.previewUrl);
        } catch (e) {}
    }

    bulkImportRows.splice(index, 1);
    renderizzaRigheBulk();
    aggiornaContatoriBulk();
}

// Svuota intera coda non importata
function svuotaCodaBulkImport() {
    if (bulkImportRows.length === 0) {
        showAccessoriToast("Nessun articolo presente nella coda di importazione.", "info");
        return;
    }
    if (isBulkImporting) {
        showAccessoriToast("Impossibile svuotare la coda durante un'importazione in corso.", "warning");
        return;
    }

    let clearedCount = 0;
    bulkImportRows.forEach(r => {
        if (!r.imported) {
            clearedCount++;
            if (r.previewUrl && r.previewUrl.startsWith('blob:')) {
                try {
                    URL.revokeObjectURL(r.previewUrl);
                } catch (e) {}
            }
        }
    });

    bulkImportRows = bulkImportRows.filter(r => r.imported === true);
    renderizzaRigheBulk();
    aggiornaContatoriBulk();
    showAccessoriToast(`Coda svuotata (${clearedCount} ${clearedCount === 1 ? 'articolo rimosso' : 'articoli rimossi'}).`, "info");
}

// Applicazione Valori Globali ai Selezionati
function applicaValoriBulkAiSelezionati() {
    const catVal = document.getElementById('bulk-apply-categoria')?.value || '';
    const marcaVal = document.getElementById('bulk-apply-marca')?.value || '';
    const costoVal = document.getElementById('bulk-apply-costo')?.value.trim() || '';
    const prezzoVal = document.getElementById('bulk-apply-prezzo')?.value.trim() || '';
    const statoVal = document.getElementById('bulk-apply-stato')?.value || '';

    // Verifica se almeno un campo è stato impostato
    if (!catVal && !marcaVal && !costoVal && !prezzoVal && !statoVal) {
        showAccessoriToast("Imposta almeno un valore globale da applicare (i campi vuoti non modificano nulla).", "info");
        return;
    }

    const targetRows = bulkImportRows.filter(r => r.selected && !r.imported);
    if (targetRows.length === 0) {
        showAccessoriToast("Nessuna riga selezionata su cui applicare i valori globali.", "error");
        return;
    }

    let modifiedCount = 0;
    targetRows.forEach(row => {
        // NON sovrascrivere se il campo globale è vuoto
        if (catVal !== '') row.categoria = catVal;
        if (marcaVal !== '') row.marca = marcaVal;
        if (costoVal !== '') row.prezzoFornitore = costoVal;
        if (prezzoVal !== '') row.prezzoVendita = prezzoVal;
        if (statoVal !== '') row.stato = statoVal;
        modifiedCount++;
    });

    // Feedback visivo immediato
    const feedback = document.getElementById('bulk-apply-feedback');
    if (feedback) {
        feedback.innerText = `✓ Valori applicati a ${modifiedCount} ${modifiedCount === 1 ? 'articolo' : 'articoli'}!`;
        feedback.classList.remove('hidden');
        setTimeout(() => feedback.classList.add('hidden'), 3500);
    }

    showAccessoriToast(`Valori applicati con successo a ${modifiedCount} ${modifiedCount === 1 ? 'articolo selezionato' : 'articoli selezionati'}.`, 'success');
    renderizzaRigheBulk();
    aggiornaContatoriBulk();
}

// Reset campi del pannello valori globali
function resetValoriBulkForm() {
    const c = document.getElementById('bulk-apply-categoria');
    const m = document.getElementById('bulk-apply-marca');
    const co = document.getElementById('bulk-apply-costo');
    const p = document.getElementById('bulk-apply-prezzo');
    const s = document.getElementById('bulk-apply-stato');
    if (c) c.value = '';
    if (m) m.value = '';
    if (co) co.value = '';
    if (p) p.value = '';
    if (s) s.value = '';
    showAccessoriToast("Campi globali svuotati.", "info");
}

// Aggiorna contatori e stato pulsante di importazione
function aggiornaContatoriBulk() {
    const totalCount = bulkImportRows.length;
    const selectedRows = bulkImportRows.filter(r => r.selected && !r.imported);
    const selectedCount = selectedRows.length;

    // Pronti: selezionati, non importati, con nome e categoria
    const readyRows = selectedRows.filter(r => r.nome && r.nome.trim() !== '' && r.categoria && r.categoria.trim() !== '');
    const readyCount = readyRows.length;

    const summaryEl = document.getElementById('bulk-count-summary');
    if (summaryEl) {
        summaryEl.innerText = `${totalCount} ${totalCount === 1 ? 'articolo' : 'articoli'} • ${selectedCount} selezionati`;
    }

    const readyBadge = document.getElementById('bulk-ready-badge');
    if (readyBadge) {
        readyBadge.innerText = `${readyCount} pronti per l'import`;
        if (readyCount === selectedCount && selectedCount > 0) {
            readyBadge.className = 'px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200';
        } else if (readyCount < selectedCount) {
            readyBadge.className = 'px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200';
        }
    }

    const footerInfo = document.getElementById('bulk-footer-info');
    if (footerInfo) {
        const notReady = selectedCount - readyCount;
        if (notReady > 0) {
            footerInfo.innerText = `⚠️ ${notReady} articoli selezionati richiedono Nome e Categoria`;
            footerInfo.className = 'text-xs text-amber-600 font-bold';
        } else {
            footerInfo.innerText = `${readyCount} articoli validi pronti per l'importazione`;
            footerInfo.className = 'text-xs text-slate-500 font-medium';
        }
    }

    const btn = document.getElementById('btn-esegui-bulk-import');
    const label = document.getElementById('btn-bulk-import-label');
    if (label) {
        label.innerText = `IMPORTA ${readyCount} ${readyCount === 1 ? 'ACCESSORIO' : 'ACCESSORI'}`;
    }
    if (btn) {
        btn.disabled = readyCount === 0 || isBulkImporting;
    }
}

// Helper: Upload immagine persistente su Supabase Storage riutilizzando /api/admin/store-image
async function caricaImmagineAccessorioStorageAsync(file) {
    const base64ToSend = await comprimiImmagineAccessorioAsync(file, 1200, 0.85);
    if (!base64ToSend) {
        throw new Error("Impossibile leggere il file immagine");
    }

    const res = await fetch('/api/admin/store-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            productId: null,
            originalUrl: null,
            imageBase64: base64ToSend
        })
    });

    const data = await res.json();
    if (!res.ok || !data || !data.success || (!data.internalUrl && !data.url)) {
        throw new Error((data && data.error) || `Errore HTTP ${res.status} salvataggio su Supabase Storage`);
    }

    return data.internalUrl || data.url;
}

// Controllo e apertura della conferma prima dell'importazione massiva (zero silent return)
function avviaImportazioneMassivaAccessori() {
    if (isBulkImporting) {
        showAccessoriToast("Un'importazione è già in corso. Attendi il completamento.", "warning");
        return;
    }

    if (!bulkImportRows || bulkImportRows.length === 0) {
        showAccessoriToast("Nessun accessorio presente nella coda. Trascina o seleziona prima le immagini.", "warning");
        return;
    }

    // Filtra le righe selezionate e non ancora importate
    const selectedRows = bulkImportRows.filter(r => r.selected && !r.imported);
    if (selectedRows.length === 0) {
        showAccessoriToast("Seleziona almeno un accessorio tramite la casella di spunta per avviare l'importazione.", "warning");
        return;
    }

    // Filtra le righe con campi obbligatori compilati (nome e categoria)
    const toImport = selectedRows.filter(r => r.nome && r.nome.trim() && r.categoria && r.categoria.trim());
    if (toImport.length === 0) {
        showAccessoriToast("Tutti gli accessori selezionati richiedono Nome e Categoria obbligatori per poter essere importati.", "error");
        return;
    }

    // Verifica disponibilità file
    const missingFiles = toImport.filter(r => !r.file && !r.persistentUrl);
    if (missingFiles.length > 0) {
        showAccessoriToast(`Impossibile avviare l'importazione: file immagine non disponibile per ${missingFiles.length} articoli.`, "error");
        return;
    }

    // Mostra modale di conferma nativo HTML (compatibile al 100% con iframe e ambienti isolati)
    const confirmModal = document.getElementById('modal-bulk-import-confirm');
    const confirmMsg = document.getElementById('bulk-import-confirm-msg');
    const skippedCount = selectedRows.length - toImport.length;

    let msgText = `Stai per importare ${toImport.length} ${toImport.length === 1 ? 'accessorio' : 'accessori'} nel catalogo. Continuare?`;
    if (skippedCount > 0) {
        msgText += ` (${skippedCount} articoli selezionati con campi obbligatori mancanti verranno ignorati).`;
    }

    if (confirmMsg) {
        confirmMsg.innerText = msgText;
    }

    if (confirmModal) {
        confirmModal.classList.remove('hidden');
    } else {
        // Fallback di sicurezza
        confermaEdEseguiImportazioneMassivaAccessori();
    }
}

// Chiusura del modale di conferma importazione
function chiudiConfermaBulkImport() {
    const confirmModal = document.getElementById('modal-bulk-import-confirm');
    if (confirmModal) confirmModal.classList.add('hidden');
}

// Esecuzione effettiva dell'importazione massiva dopo conferma
async function confermaEdEseguiImportazioneMassivaAccessori() {
    chiudiConfermaBulkImport();

    if (isBulkImporting) return;

    // Filtra le righe selezionate e non ancora importate con campi obbligatori validi
    const toImport = bulkImportRows.filter(r => r.selected && !r.imported && r.nome && r.nome.trim() && r.categoria && r.categoria.trim());
    if (toImport.length === 0) {
        showAccessoriToast("Nessun articolo valido selezionato da importare.", "error");
        return;
    }

    isBulkImporting = true;

    // Disabilita pulsante per bloccare doppio click e aggiorna label
    const btn = document.getElementById('btn-esegui-bulk-import');
    const label = document.getElementById('btn-bulk-import-label');
    if (btn) btn.disabled = true;
    if (label) label.innerText = 'IMPORTAZIONE IN CORSO...';

    // Feedback immediato all'amministratore
    const progressContainer = document.getElementById('bulk-progress-container');
    const progressBar = document.getElementById('bulk-progress-bar');
    const progressText = document.getElementById('bulk-progress-text');
    const progressPercent = document.getElementById('bulk-progress-percent');
    const progressSubtext = document.getElementById('bulk-progress-subtext');
    const resultSummary = document.getElementById('bulk-result-summary');

    if (progressContainer) progressContainer.classList.remove('hidden');
    if (resultSummary) resultSummary.classList.add('hidden');

    if (progressBar) progressBar.style.width = '0%';
    if (progressPercent) progressPercent.innerText = '0%';
    if (progressText) {
        progressText.innerHTML = '<span class="w-4 h-4 border-2 border-brand-gold border-t-transparent rounded-full animate-spin"></span> <span>Preparazione importazione...</span>';
    }
    if (progressSubtext) {
        progressSubtext.innerText = `Inizializzazione di ${toImport.length} articoli...`;
    }

    showAccessoriToast(`Avvio importazione di ${toImport.length} ${toImport.length === 1 ? 'accessorio' : 'accessori'}...`, "info");

    let successCount = 0;
    let failCount = 0;
    const total = toImport.length;

    for (let i = 0; i < total; i++) {
        const row = toImport[i];
        const percent = Math.round(((i + 1) / total) * 100);

        if (progressBar) progressBar.style.width = `${percent}%`;
        if (progressPercent) progressPercent.innerText = `${percent}%`;
        if (progressText) {
            progressText.innerHTML = `<span class="w-4 h-4 border-2 border-brand-gold border-t-transparent rounded-full animate-spin"></span> <span>Importazione ${i + 1} di ${total}...</span>`;
        }
        if (progressSubtext) {
            progressSubtext.innerText = `Processo: "${row.nome}"`;
        }

        try {
            // 1. Upload immagine su Supabase Storage se non ancora ottenuto URL HTTPS persistente
            row.importStatus = 'uploading';
            renderizzaRigheBulk();

            let persistentImageUrl = row.persistentUrl || '';
            if (!persistentImageUrl) {
                persistentImageUrl = await caricaImmagineAccessorioStorageAsync(row.file);
                row.persistentUrl = persistentImageUrl;
            }

            // 2. Creazione accessorio nel DB tramite API standard /api/accessories
            row.importStatus = 'saving';
            renderizzaRigheBulk();

            const isCalze = (row.categoria || '').toLowerCase().includes('calz');
            const prezzoVenditaNum = normalizzaPrezzoBulk(row.prezzoVendita);
            const prezzoFornitoreNum = normalizzaPrezzoBulk(row.prezzoFornitore);

            const payload = {
                nome: row.nome.trim(),
                categoria: row.categoria.trim(),
                marca: row.marca ? row.marca.trim() : '',
                prezzo: prezzoVenditaNum,
                prezzo_fornitore: prezzoFornitoreNum,
                gestione_taglia: isCalze ? 'manuale' : 'nessuna',
                richiede_taglia: isCalze,
                taglia: isCalze ? 'manuale' : '',
                immagine: persistentImageUrl,
                descrizione: '',
                disponibile: row.stato !== 'disattivato',
                stato: row.stato || 'attivo',
                tipo_catalogo: 'accessori'
            };

            const createRes = await fetch('/api/accessories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const createData = await createRes.json();
            if (!createRes.ok || !createData || !createData.success) {
                throw new Error((createData && createData.error) || `Errore HTTP ${createRes.status} durante creazione`);
            }

            // Successo per questa riga
            row.imported = true;
            row.selected = false;
            row.importStatus = 'imported';
            row.importResultId = createData.accessory?.id || null;
            row.errorMessage = null;
            successCount++;

        } catch (err) {
            console.error(`❌ Errore importazione "${row.nome}":`, err);
            row.imported = false;
            row.importStatus = err.message.includes('Supabase Storage') || err.message.includes('immagine') 
                ? 'error_image' 
                : 'error_product';
            row.errorMessage = err.message;
            failCount++;
        }

        renderizzaRigheBulk();
    }

    isBulkImporting = false;
    aggiornaContatoriBulk();

    // Ricarica tabella principale dell'admin accessori in background
    try {
        await loadAccessories();
    } catch (e) {
        console.warn("Ricarica accessori completata con avviso:", e);
    }

    // Mostra riepilogo
    if (progressContainer) progressContainer.classList.add('hidden');
    if (resultSummary) {
        resultSummary.classList.remove('hidden');
        if (failCount === 0) {
            resultSummary.className = 'p-4 rounded-2xl border bg-emerald-50 border-emerald-300 text-emerald-900 text-xs font-semibold flex items-center justify-between gap-3';
            resultSummary.innerHTML = `
                <div class="flex items-center gap-2.5">
                    <span class="text-xl">🎉</span>
                    <div>
                        <h5 class="font-extrabold text-emerald-800 text-sm">Importazione completata con successo!</h5>
                        <p class="text-[11px] text-emerald-700">Tutti i ${successCount} accessori sono stati caricati su Supabase Storage e creati nel catalogo.</p>
                    </div>
                </div>
                <button type="button" onclick="chiudiBulkImportAccessoriModal()" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs cursor-pointer">
                    Chiudi e visualizza catalogo
                </button>
            `;
            showAccessoriToast(`Importazione completata: creati ${successCount} accessori!`, "success");
        } else {
            resultSummary.className = 'p-4 rounded-2xl border bg-amber-50 border-amber-300 text-amber-900 text-xs font-semibold space-y-2';
            resultSummary.innerHTML = `
                <div class="flex items-center gap-2.5">
                    <span class="text-xl">⚠️</span>
                    <div>
                        <h5 class="font-extrabold text-amber-900 text-sm">Importazione parzialmente completata</h5>
                        <p class="text-[11px] text-amber-800">Creati: <strong>${successCount}</strong> • Falliti: <strong>${failCount}</strong>. Puoi correggere le righe evidenziate e cliccare nuovamente su Importa per riprovare solo quelle.</p>
                    </div>
                </div>
            `;
            showAccessoriToast(`Completato con errori: creati ${successCount}, falliti ${failCount}.`, "error");
        }
    }
}

// Esponi globalmente le funzioni del modulo Bulk Import
window.openBulkImportAccessoriModal = openBulkImportAccessoriModal;
window.chiudiBulkImportAccessoriModal = chiudiBulkImportAccessoriModal;
window.chiudiConfermaBulkImport = chiudiConfermaBulkImport;
window.handleBulkImportFilesSelected = handleBulkImportFilesSelected;
window.handleBulkDragOver = handleBulkDragOver;
window.handleBulkDragLeave = handleBulkDragLeave;
window.handleBulkDrop = handleBulkDrop;
window.aggiornaCampoBulkRow = aggiornaCampoBulkRow;
window.toggleSelectBulkRow = toggleSelectBulkRow;
window.selezionaTutteRigheBulk = selezionaTutteRigheBulk;
window.duplicaValoriRigaPrecedente = duplicaValoriRigaPrecedente;
window.rimuoviRigaBulk = rimuoviRigaBulk;
window.svuotaCodaBulkImport = svuotaCodaBulkImport;
window.applicaValoriBulkAiSelezionati = applicaValoriBulkAiSelezionati;
window.resetValoriBulkForm = resetValoriBulkForm;
window.avviaImportazioneMassivaAccessori = avviaImportazioneMassivaAccessori;
window.confermaEdEseguiImportazioneMassivaAccessori = confermaEdEseguiImportazioneMassivaAccessori;


