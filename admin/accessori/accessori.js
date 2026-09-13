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

    const standardCategories = ['Calze', 'Calzettoni', 'Guanti', 'Palloni', 'Cappellini', 'Sciarpe', 'Borse', 'Fasce Capitano', 'Altri Accessori'];
    
    // Raccoglie tutte le categorie esistenti
    const dynamicCategories = new Set(standardCategories);
    allAccessories.forEach(a => {
        if (a && a.categoria) dynamicCategories.add(String(a.categoria).trim());
    });

    const sortedCats = Array.from(dynamicCategories);

    if (filterSelect) {
        const currentVal = filterSelect.value;
        filterSelect.innerHTML = '<option value="all">Tutte le Categorie</option>';
        sortedCats.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.innerText = cat;
            filterSelect.appendChild(opt);
        });
        filterSelect.value = currentVal || 'all';
    }

    if (modalCategorySelect) {
        modalCategorySelect.innerHTML = '';
        sortedCats.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.innerText = cat;
            modalCategorySelect.appendChild(opt);
        });
    }

    if (batchCategorySelect) {
        batchCategorySelect.innerHTML = '<option value="">-- Nessuna modifica --</option>';
        sortedCats.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.innerText = cat;
            batchCategorySelect.appendChild(opt);
        });
    }
}

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

        // Ricerca per Nome, Categoria o Codice
        if (query) {
            const matchNome = item.nome && item.nome.toLowerCase().includes(query);
            const matchCat = item.categoria && item.categoria.toLowerCase().includes(query);
            const matchCod = (item.codice || item.id) && String(item.codice || item.id).toLowerCase().includes(query);
            if (!matchNome && !matchCat && !matchCod) return false;
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
                        ${acc.taglia ? `<span class="text-[10px] text-slate-500 font-medium">${escapeHtml(acc.taglia)}</span>` : ''}
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
    const prezzo = document.getElementById('batch-acc-prezzo')?.value;
    const costo = document.getElementById('batch-acc-costo')?.value;
    const disponibile = document.getElementById('batch-acc-disponibile')?.value;
    const stato = document.getElementById('batch-acc-stato')?.value;

    const updates = {};
    if (categoria) updates.categoria = categoria;
    if (prezzo !== '') updates.prezzo = parseFloat(prezzo);
    if (costo !== '') updates.prezzo_fornitore = parseFloat(costo);
    if (disponibile !== '') updates.disponibile = disponibile === 'true';
    if (stato !== '') updates.stato = stato;

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
    if (statusEl) statusEl.innerText = "Elaborazione e caricamento...";
    if (percentEl) percentEl.innerText = "Caricamento 0%";
    if (btnAllegaImg) btnAllegaImg.disabled = true;

    try {
        const base64ToSend = await comprimiImmagineAccessorioAsync(file, 1200, 0.85);
        if (!base64ToSend) {
            throw new Error("Impossibile leggere il file immagine.");
        }

        const uploadResult = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/upload', true);
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
                        if (data.success && (data.filePath || data.url)) {
                            resolve(data.filePath || data.url);
                        } else {
                            reject(new Error(data.error || "Risposta upload non valida dal server"));
                        }
                    } catch (e) {
                        reject(new Error("Errore durante l'analisi della risposta del server"));
                    }
                } else {
                    reject(new Error(`Errore HTTP ${xhr.status} durante il caricamento`));
                }
            };

            xhr.onerror = () => reject(new Error("Errore di connessione di rete durante l'upload"));
            xhr.send(JSON.stringify({ filename: file.name, base64: base64ToSend }));
        });

        const hiddenInput = document.getElementById('modal-acc-immagine');
        if (hiddenInput) hiddenInput.value = uploadResult;

        showAccessoriToast("Immagine caricata con successo!", "success");
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
    document.getElementById('modal-acc-taglia').value = "Unica";

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
    document.getElementById('modal-acc-taglia').value = acc.taglia || "Unica";
    document.getElementById('modal-acc-immagine').value = acc.immagine || "";
    document.getElementById('modal-acc-descrizione').value = acc.descrizione || "";
    document.getElementById('modal-acc-disponibile').value = acc.disponibile !== false ? "true" : "false";
    document.getElementById('modal-acc-stato').value = acc.stato === 'disattivato' ? "disattivato" : "attivo";

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
        if (subtextEl) subtextEl.innerText = imgUrl.startsWith('/uploads/') ? "File locale pronto sul server" : "Immagine configurata per l'articolo";
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

        const prezzo = (rawPrezzo !== '' && !isNaN(Number(rawPrezzo)) && Number(rawPrezzo) >= 0) ? parseFloat(rawPrezzo) : 0;
        const prezzo_fornitore = (rawCosto !== '' && !isNaN(Number(rawCosto)) && Number(rawCosto) >= 0) ? parseFloat(rawCosto) : 0;

        const taglia = document.getElementById('modal-acc-taglia').value.trim();
        const immagine = document.getElementById('modal-acc-immagine').value.trim();
        const descrizione = document.getElementById('modal-acc-descrizione').value.trim();
        const disponibile = document.getElementById('modal-acc-disponibile').value === 'true';
        const stato = document.getElementById('modal-acc-stato').value;

        if (!immagine) {
            showAccessoriToast("Allega un'immagine per l'accessorio prima di salvare.", "error");
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
            return;
        }

        const payload = {
            id: idVal || undefined,
            nome,
            categoria,
            codice,
            prezzo,
            prezzo_fornitore,
            taglia,
            immagine,
            descrizione,
            disponibile,
            stato,
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
});

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
