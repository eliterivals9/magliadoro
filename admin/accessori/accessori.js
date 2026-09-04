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

// Gestione Modale Aggiunta/Modifica Singola
function openAddAccessoryModal() {
    currentEditingId = null;
    document.getElementById('modal-accessory-title').innerText = "Nuovo Accessorio";
    document.getElementById('modal-accessory-submit-btn').innerText = "Crea Accessorio";

    document.getElementById('form-accessory').reset();
    document.getElementById('modal-acc-id').value = "";
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

// Live preview immagine nel form
function updateModalImagePreview() {
    const inputEl = document.getElementById('modal-acc-immagine');
    const inputUrl = inputEl ? inputEl.value : '';
    const previewImg = document.getElementById('modal-acc-preview-img');
    const placeholder = document.getElementById('modal-acc-preview-placeholder');

    if (inputUrl && inputUrl.trim()) {
        if (previewImg) {
            previewImg.src = inputUrl.trim();
            previewImg.classList.remove('hidden');
        }
        if (placeholder) placeholder.classList.add('hidden');
    } else {
        if (previewImg) previewImg.classList.add('hidden');
        if (placeholder) placeholder.classList.remove('hidden');
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

        if (!nome || !categoria) {
            showAccessoriToast("Nome e categoria sono obbligatori", "error");
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
// FASE 3: IMPORTAZIONE ED ESPORTAZIONE JSON ACCESSORI
// =========================================================================

let anteprimaAccessoriData = [];
let currentAnteprimaFilter = 'tutti';

/**
 * Funzione di utilità per pulire e convertire qualsiasi rappresentazione di prezzo/costo in numero valido
 */
function parseNumericPrice(val) {
    if (val === undefined || val === null || val === '') return null;
    if (typeof val === 'number') return isNaN(val) ? null : val;
    
    let str = String(val).trim();
    if (!str) return null;

    // Se è un array (es. ["4.50"] o [4, 5])
    if (Array.isArray(val)) {
        str = val.join(' - ');
    } else if (typeof val === 'object') {
        str = Object.values(val).join(' - ');
    }

    // Se c'è un range es. "12 - 15" o "12-15", prendi il massimo
    if (str.includes('-')) {
        const parts = str.split('-');
        const v1 = parseNumericPrice(parts[0]);
        const v2 = parseNumericPrice(parts[1]);
        if (v1 !== null && v2 !== null) return Math.max(v1, v2);
        if (v1 !== null) return v1;
        if (v2 !== null) return v2;
    }

    // Sostituisci virgola con punto se virgola usata come decimale
    if (str.includes(',') && !str.includes('.')) {
        str = str.replace(/,/g, '.');
    } else if (str.includes(',') && str.includes('.')) {
        // es. 1.200,50 -> 1200.50
        str = str.replace(/\./g, '').replace(/,/g, '.');
    }

    // Rimuovi simboli di valuta e caratteri non numerici (lasciando cifre e punto)
    str = str.replace(/[^0-9.]/g, '');
    const parts = str.split('.');
    if (parts.length > 2) {
        str = parts[0] + '.' + parts.slice(1).join('');
    }

    const num = parseFloat(str);
    return (isNaN(num) || num < 0) ? null : num;
}

/**
 * Estrae l'array di prodotti da qualsiasi formato o contenitore JSON
 */
function parseRawAccessoryItems(parsed) {
    if (!parsed) return [];
    if (Array.isArray(parsed)) return parsed;

    if (typeof parsed === 'object') {
        // Controllo chiavi note di contenimento
        const candidates = [
            'accessories', 'accessori', 'prodotti', 'products', 
            'data', 'items', 'results', 'catalog', 'catalogo', 
            'elements', 'rows', 'list'
        ];
        for (const key of candidates) {
            if (Array.isArray(parsed[key])) {
                return parsed[key];
            }
        }

        // Se è un dizionario con ID/chiavi numeriche (es. {"0": {...}, "1": {...}} o {"acc_1": {...}})
        const values = Object.values(parsed);
        if (values.length > 0 && typeof values[0] === 'object' && values[0] !== null) {
            return values;
        }

        return [parsed];
    }
    return [];
}

/**
 * Estrae il nome dell'accessorio controllando tutti i campi standard ed esportati
 */
function extractAccessoryName(raw) {
    if (!raw) return '';
    const candidates = [
        raw.nome, raw.name, raw.versione, raw.nome_finale,
        raw.product_title, raw.product_name, raw.title, raw.titolo,
        raw.nome_prodotto, raw.item_name, raw.label, raw.alt_text, raw.image_alt
    ];

    for (const val of candidates) {
        if (val !== undefined && val !== null && String(val).trim() !== '') {
            return String(val).trim();
        }
    }

    // Se c'è una descrizione breve utilizzabile
    if (raw.descrizione && typeof raw.descrizione === 'string' && raw.descrizione.length < 80 && !raw.descrizione.includes('\n')) {
        return raw.descrizione.trim();
    }
    if (raw.description && typeof raw.description === 'string' && raw.description.length < 80 && !raw.description.includes('\n')) {
        return raw.description.trim();
    }

    return '';
}

/**
 * Deduce o normalizza la categoria dell'accessorio in base al campo o al nome
 */
function extractAccessoryCategory(raw, productName = '') {
    const rawCat = (raw.categoria || raw.category || raw.category_name || raw.cat || raw.type || raw.sezione || raw.tipo || '').toString().trim();
    
    // Mappatura categorie note
    const lowerRaw = rawCat.toLowerCase();
    if (lowerRaw.includes('calzetton') || lowerRaw.includes('socks knee') || lowerRaw.includes('calzettoni')) return 'Calzettoni';
    if (lowerRaw.includes('calz') || lowerRaw.includes('grip') || lowerRaw.includes('sock')) return 'Calze';
    if (lowerRaw.includes('guant') || lowerRaw.includes('glove')) return 'Guanti';
    if (lowerRaw.includes('pallon') || lowerRaw.includes('ball')) return 'Palloni';
    if (lowerRaw.includes('cappellin') || lowerRaw.includes('cap') || lowerRaw.includes('hat') || lowerRaw.includes('beanie')) return 'Cappellini';
    if (lowerRaw.includes('sciarpa') || lowerRaw.includes('scarf')) return 'Sciarpe';
    if (lowerRaw.includes('borsa') || lowerRaw.includes('bag') || lowerRaw.includes('zaino') || lowerRaw.includes('backpack') || lowerRaw.includes('gymsack')) return 'Borse';
    if (lowerRaw.includes('fascia') || lowerRaw.includes('capitano') || lowerRaw.includes('armband') || lowerRaw.includes('captain')) return 'Fasce Capitano';

    if (rawCat && rawCat.toLowerCase() !== 'accessori' && rawCat.toLowerCase() !== 'accessories' && rawCat.toLowerCase() !== 'other' && rawCat.toLowerCase() !== 'altro') {
        return rawCat;
    }

    // Deduce dal nome del prodotto se la categoria è generica o mancante
    const lowerName = (productName || '').toLowerCase();
    if (lowerName.includes('calzetton') || lowerName.includes('knee sock') || lowerName.includes('calzetta')) return 'Calzettoni';
    if (lowerName.includes('calz') || lowerName.includes('grip') || lowerName.includes('sock') || lowerName.includes('anti-slip')) return 'Calze';
    if (lowerName.includes('guant') || lowerName.includes('glove')) return 'Guanti';
    if (lowerName.includes('pallon') || lowerName.includes('ball') || lowerName.includes('fifa')) return 'Palloni';
    if (lowerName.includes('cappellin') || lowerName.includes('cap') || lowerName.includes('hat') || lowerName.includes('beanie')) return 'Cappellini';
    if (lowerName.includes('sciarpa') || lowerName.includes('scarf')) return 'Sciarpe';
    if (lowerName.includes('borsa') || lowerName.includes('bag') || lowerName.includes('zaino') || lowerName.includes('backpack') || lowerName.includes('gymsack')) return 'Borse';
    if (lowerName.includes('fascia') || lowerName.includes('capitano') || lowerName.includes('armband') || lowerName.includes('captain')) return 'Fasce Capitano';

    return 'Altri Accessori';
}

/**
 * Estrae il prezzo di vendita dal JSON senza forzare valori arbitrari
 */
function extractAccessoryPrice(raw) {
    const candidates = [
        raw.prezzo, raw.price, raw.prezzo_vendita, raw.prezzoVendita, 
        raw.sale_price, raw.retail_price, raw.prezzo_consigliato, 
        raw.vendita, raw.amount, raw.prezzo_eur, raw.price_eur
    ];

    for (const val of candidates) {
        const parsed = parseNumericPrice(val);
        if (parsed !== null && parsed >= 0) {
            return parsed;
        }
    }

    return 0;
}

/**
 * Estrae il costo fornitore controllando tutti i campi possibili
 */
function extractAccessorySupplierCost(raw) {
    const candidates = [
        raw.prezzo_fornitore, raw.costo_fornitore, raw.costo, raw.cost,
        raw.supplier_price, raw.wholesale_price, raw.prezzo_costo,
        raw.costo_usd, raw.price_usd, raw.importo_fornitore
    ];

    for (const val of candidates) {
        const parsed = parseNumericPrice(val);
        if (parsed !== null && parsed >= 0) {
            return parsed;
        }
    }
    return 0;
}

/**
 * Estrae e normalizza l'immagine dell'accessorio
 */
function extractAccessoryImage(raw) {
    let rawImg = raw.immagine || raw.image || raw.product_image || raw.foto || raw.imgUrl || raw.img || raw.photo || raw.picture || raw.thumbnail || raw.images || '';
    
    let imgUrl = '';
    if (Array.isArray(rawImg)) {
        imgUrl = rawImg.length > 0 ? String(rawImg[0]) : '';
    } else if (rawImg && typeof rawImg === 'object') {
        imgUrl = String(rawImg.url || rawImg.src || rawImg.href || rawImg.link || '');
    } else {
        imgUrl = String(rawImg || '');
    }
    imgUrl = imgUrl.trim();

    if (imgUrl.startsWith('//')) {
        imgUrl = 'https:' + imgUrl;
    } else if (imgUrl.startsWith('/') && !imgUrl.startsWith('//')) {
        imgUrl = 'https://jerseys-catalog.com' + imgUrl;
    }

    if (!imgUrl) {
        return 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=400&auto=format&fit=crop&q=80';
    }
    return imgUrl;
}

/**
 * Estrae la taglia dell'accessorio
 */
function extractAccessoryTaglia(raw) {
    const tagliaVal = raw.taglia || raw.size || raw.taglie || raw.sizes || raw.misure || (raw.opzioni && raw.opzioni.taglie) || (raw.options && raw.options.sizes);
    if (Array.isArray(tagliaVal)) {
        return tagliaVal.join(', ');
    }
    if (tagliaVal && typeof tagliaVal === 'string' && tagliaVal.trim() !== '') {
        return tagliaVal.trim();
    }
    return 'Unica';
}

/**
 * Estrae la disponibilità e lo stato dell'accessorio
 */
function extractAccessoryDisponibilita(raw) {
    const dispVal = raw.disponibile !== undefined ? raw.disponibile : (
        raw.disponibilita !== undefined ? raw.disponibilita : (
            raw.available !== undefined ? raw.available : (
                raw.in_stock !== undefined ? raw.in_stock : (
                    raw.inStock !== undefined ? raw.inStock : (
                        raw.active !== undefined ? raw.active : (
                            raw.attivo !== undefined ? raw.attivo : true
                        )
                    )
                )
            )
        )
    );

    if (typeof dispVal === 'boolean') return dispVal;
    if (typeof dispVal === 'number') return dispVal === 1;
    if (typeof dispVal === 'string') {
        const s = dispVal.toLowerCase().trim();
        return s === 'true' || s === '1' || s === 'si' || s === 'sì' || s === 'yes' || s === 'disponibile' || s === 'attivo';
    }
    return true;
}

/**
 * Carica un JSON di esempio nella textarea di importazione
 */
function caricaEsempioJsonAccessori() {
    const textarea = document.getElementById('import-accessories-textarea');
    if (!textarea) return;
    
    const sampleData = [
        {
            "nome": "Calzettoni Gara Milan Home",
            "categoria": "Calzettoni",
            "codice": "ACC-MIL-SOCK",
            "prezzo": 12.00,
            "prezzo_fornitore": 4.50,
            "taglia": "L (41-45)",
            "immagine": "https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?w=400&auto=format&fit=crop&q=80",
            "descrizione": "Calzettoni ufficiali traspiranti con supporto arco plantare",
            "disponibile": true,
            "stato": "attivo"
        },
        {
            "nome": "Guanti Termici Inter Training",
            "categoria": "Guanti",
            "codice": "ACC-INT-GLOV",
            "prezzo": 18.50,
            "prezzo_fornitore": 7.00,
            "taglia": "M",
            "immagine": "https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=400&auto=format&fit=crop&q=80",
            "descrizione": "Guanti in pile tecnico con grip in silicone sui palmi",
            "disponibile": true,
            "stato": "attivo"
        },
        {
            "nome": "Fascia Capitano Juventus Custom",
            "categoria": "Fasce Capitano",
            "codice": "ACC-JUV-CPT",
            "prezzo": 9.90,
            "prezzo_fornitore": 2.80,
            "taglia": "Unica",
            "immagine": "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=400&auto=format&fit=crop&q=80",
            "descrizione": "Fascia capitano elastica regolabile con chiusura in velcro",
            "disponibile": true,
            "stato": "attivo"
        },
        {
            "nome": "Pallone Replica Serie A 2024/25",
            "categoria": "Palloni",
            "codice": "ACC-BALL-SA",
            "prezzo": 29.00,
            "prezzo_fornitore": 11.50,
            "taglia": "Taglia 5",
            "immagine": "https://images.unsplash.com/photo-1614632537197-3ce01e2303c7?w=400&auto=format&fit=crop&q=80",
            "descrizione": "Pallone da gara cucito a macchina con camera d'aria rinforzata",
            "disponibile": true,
            "stato": "attivo"
        }
    ];

    textarea.value = JSON.stringify(sampleData, null, 2);
    showAccessoriToast("JSON di esempio caricato nella textarea!", "info");
}

/**
 * Gestisce la selezione di un file .json (da header o da sezione importazione)
 */
function handleAccessoryImportFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json')) {
        showAccessoriToast("Seleziona un file in formato .json valido.", "error");
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const content = e.target.result;
            processaContenutoJSONAccessori(content, file.name);
        } catch (err) {
            console.error("Errore lettura file JSON accessori:", err);
            showAccessoriToast("Errore durante la lettura del file: " + err.message, "error");
        }
    };
    reader.onerror = function() {
        showAccessoriToast("Impossibile leggere il file selezionato.", "error");
    };
    reader.readAsText(file);

    // Reset input per permettere di ricaricare lo stesso file
    event.target.value = '';
}

/**
 * Elabora il contenuto JSON incollato nella textarea
 */
function processaImportazioneJSONAccessoriDaTextarea() {
    const textarea = document.getElementById('import-accessories-textarea');
    if (!textarea || !textarea.value.trim()) {
        showAccessoriToast("Incolla del testo JSON o seleziona un file .json prima di procedere.", "error");
        return;
    }
    processaContenutoJSONAccessori(textarea.value, 'input-manuale.json');
}

/**
 * Parsing, Normalizzazione Universale, Anti-duplicazione e Creazione dell'Anteprima Pre-Database
 */
function processaContenutoJSONAccessori(rawJson, filename = 'accessori.json') {
    let parsed;
    try {
        parsed = JSON.parse(rawJson);
    } catch (e) {
        showAccessoriToast("Formato JSON non valido: " + e.message, "error");
        return;
    }

    const items = parseRawAccessoryItems(parsed);

    if (!items || items.length === 0) {
        showAccessoriToast("Il file JSON non contiene nessun elemento accessorio valido.", "error");
        return;
    }

    // Helper per trovare se l'accessorio esiste già nel catalogo locale
    const trovaAccessorioEsistente = (rawItem, nome, categoria, taglia, codice) => {
        const tId = (rawItem.id !== undefined && rawItem.id !== null) ? String(rawItem.id).trim() : '';
        const tCodice = (codice || rawItem.codice || rawItem.code || rawItem.sku || '').toString().trim().toLowerCase();
        const tNome = (nome || '').trim().toLowerCase();
        const tCat = (categoria || '').trim().toLowerCase();
        const tTaglia = (taglia || '').trim().toLowerCase();

        return allAccessories.find(acc => {
            if (!acc) return false;
            const accId = String(acc.id || '').trim();
            const accCodice = String(acc.codice || '').trim().toLowerCase();
            const accNome = String(acc.nome || '').trim().toLowerCase();
            const accCat = String(acc.categoria || '').trim().toLowerCase();
            const accTaglia = String(acc.taglia || '').trim().toLowerCase();

            // 1. Corrispondenza per ID esplicito
            if (tId && accId && tId === accId) return true;
            // 2. Corrispondenza per Codice articolo esplicito
            if (tCodice && accCodice && tCodice === accCodice) return true;
            // 3. Corrispondenza per Nome + Categoria
            if (tNome && accNome && tNome === accNome && tCat === accCat) {
                if (tTaglia && accTaglia) return tTaglia === accTaglia;
                return true;
            }
            return false;
        });
    };

    anteprimaAccessoriData = [];
    const categoriesSet = new Set();

    items.forEach((raw, idx) => {
        const riga = idx + 1;
        
        // 1. Estrazione del nome con fallback multipli
        const nome = extractAccessoryName(raw);

        // 2. Estrazione e deduzione categoria reale
        const categoria = extractAccessoryCategory(raw, nome);

        // 3. Estrazione costo fornitore
        const numCosto = extractAccessorySupplierCost(raw);

        // 4. Estrazione prezzo di vendita reale dal JSON
        const numPrezzo = extractAccessoryPrice(raw);

        // 5. Estrazione taglia, immagine, descrizione, codice
        const taglia = extractAccessoryTaglia(raw);
        const immagine = extractAccessoryImage(raw);
        const codice = (raw.codice || raw.code || raw.sku || raw.item_id || '').toString().trim();
        const descrizione = (raw.descrizione || raw.description || '').toString().trim();
        const disponibile = extractAccessoryDisponibilita(raw);
        const stato = (raw.stato && String(raw.stato).toLowerCase() === 'disattivato') ? 'disattivato' : 'attivo';

        // Validazione dei dati
        const errori = [];
        if (!nome) {
            errori.push("Nome mancante");
        }
        if (numPrezzo === undefined || numPrezzo === null || isNaN(numPrezzo) || numPrezzo < 0) {
            errori.push("Prezzo non valido");
        }

        if (categoria) categoriesSet.add(categoria);

        const existing = trovaAccessorioEsistente(raw, nome, categoria, taglia, codice);
        let importStatus = 'new';
        let importError = null;

        if (errori.length > 0) {
            importStatus = 'error';
            importError = errori.join(', ');
        } else if (existing) {
            importStatus = 'update';
        } else {
            importStatus = 'new';
        }

        anteprimaAccessoriData.push({
            riga,
            id: raw.id || (existing ? existing.id : null),
            nome,
            categoria,
            codice: codice || (existing ? existing.codice : null),
            prezzo: isNaN(numPrezzo) ? 0 : numPrezzo,
            prezzo_fornitore: isNaN(numCosto) ? 0 : numCosto,
            taglia,
            immagine,
            descrizione,
            disponibile,
            stato,
            _import_status: importStatus,
            _import_error: importError,
            _existing_item: existing || null
        });
    });

    // Aggiornamento statistiche Header Anteprima
    const filenameEl = document.getElementById('prev-acc-filename');
    const totEl = document.getElementById('prev-acc-totale');
    const nuoviEl = document.getElementById('prev-acc-nuovi');
    const aggEl = document.getElementById('prev-acc-aggiornati');
    const errEl = document.getElementById('prev-acc-errori');
    const countAllEl = document.getElementById('prev-count-all');
    const countNewEl = document.getElementById('prev-count-new');
    const countUpEl = document.getElementById('prev-count-update');
    const countErrEl = document.getElementById('prev-count-error');
    const btnConfirmLabel = document.getElementById('btn-confirm-import-label');
    const btnConfirm = document.getElementById('btn-confirm-import-accessories');

    const countTotale = anteprimaAccessoriData.length;
    const countNuovi = anteprimaAccessoriData.filter(i => i._import_status === 'new').length;
    const countAgg = anteprimaAccessoriData.filter(i => i._import_status === 'update').length;
    const countErr = anteprimaAccessoriData.filter(i => i._import_status === 'error').length;
    const countValidi = countNuovi + countAgg;

    if (filenameEl) filenameEl.innerText = filename;
    if (totEl) totEl.innerText = countTotale;
    if (nuoviEl) nuoviEl.innerText = countNuovi;
    if (aggEl) aggEl.innerText = countAgg;
    if (errEl) errEl.innerText = countErr;

    if (countAllEl) countAllEl.innerText = countTotale;
    if (countNewEl) countNewEl.innerText = countNuovi;
    if (countUpEl) countUpEl.innerText = countAgg;
    if (countErrEl) countErrEl.innerText = countErr;

    if (btnConfirmLabel) btnConfirmLabel.innerText = `Conferma Importazione (${countValidi})`;
    if (btnConfirm) {
        btnConfirm.disabled = countValidi === 0;
        if (countValidi === 0) {
            btnConfirm.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            btnConfirm.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }

    // Render Tag Categorie Rilevate
    const catTagsContainer = document.getElementById('prev-acc-categories-tags');
    if (catTagsContainer) {
        catTagsContainer.innerHTML = Array.from(categoriesSet).slice(0, 4).map(c => 
            `<span class="px-2 py-0.5 bg-slate-200/80 rounded-md font-semibold text-[10px] text-slate-700">${c}</span>`
        ).join('') + (categoriesSet.size > 4 ? `<span class="text-[10px] text-slate-400 font-bold">+${categoriesSet.size - 4} altre</span>` : '');
    }

    // Imposta filtro su 'tutti' e renderizza la tabella
    currentAnteprimaFilter = 'tutti';
    impostaFiltroAnteprima('tutti');

    // Mostra Modal Anteprima
    const modal = document.getElementById('accessory-import-preview-modal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

/**
 * Imposta il filtro visuale della tabella di anteprima (Tutti / Nuovi / Da aggiornare / Errori)
 */
function impostaFiltroAnteprima(filtro) {
    currentAnteprimaFilter = filtro;

    const tabs = ['tutti', 'new', 'update', 'error'];
    tabs.forEach(t => {
        const btn = document.getElementById('prev-tab-' + t);
        if (btn) {
            if (t === filtro) {
                btn.className = 'px-3 py-1.5 bg-slate-900 text-white font-bold rounded-lg cursor-pointer transition-all shadow-xs';
            } else {
                btn.className = 'px-3 py-1.5 bg-slate-200/70 hover:bg-slate-200 text-slate-700 font-bold rounded-lg cursor-pointer transition-all';
            }
        }
    });

    renderTabellaAnteprimaAccessori();
}

/**
 * Renderizza le righe della tabella di anteprima
 */
function renderTabellaAnteprimaAccessori() {
    const tbody = document.getElementById('accessory-import-preview-tbody');
    if (!tbody) return;

    let filtered = anteprimaAccessoriData;
    if (currentAnteprimaFilter !== 'tutti') {
        filtered = anteprimaAccessoriData.filter(i => i._import_status === currentAnteprimaFilter);
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="py-8 text-center text-slate-400 font-medium italic">
                    Nessun elemento presente con questo filtro.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(item => {
        let badgeHtml = '';
        let rowBg = 'hover:bg-slate-50/80';

        if (item._import_status === 'new') {
            badgeHtml = `<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold rounded-md"><span>➕</span> Nuovo</span>`;
        } else if (item._import_status === 'update') {
            badgeHtml = `<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-extrabold rounded-md"><span>🔄</span> Aggiornamento</span>`;
        } else {
            badgeHtml = `<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-800 text-[10px] font-extrabold rounded-md"><span>⚠️</span> Errore</span>`;
            rowBg = 'bg-red-50/40 hover:bg-red-50/70';
        }

        const noteText = item._import_status === 'error' 
            ? `<span class="text-red-600 font-bold">${item._import_error}</span>`
            : (item._import_status === 'update' 
                ? `<span class="text-slate-400">Aggiornerà ID: <code class="font-mono text-[10px]">${item._existing_item ? item._existing_item.id : item.id}</code></span>`
                : `<span class="text-emerald-600">Nuovo inserimento</span>`);

        return `
            <tr class="transition-colors ${rowBg}">
                <td class="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">${item.riga}</td>
                <td class="py-2.5 px-3">${badgeHtml}</td>
                <td class="py-2.5 px-3 text-center">
                    <img src="${item.immagine}" alt="${item.nome}" class="w-8 h-8 object-cover rounded-lg border border-slate-200 mx-auto" onerror="this.src='https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=100&auto=format&fit=crop&q=80'">
                </td>
                <td class="py-2.5 px-3 font-bold text-slate-900 truncate max-w-[200px]" title="${item.nome}">
                    ${item.nome || '<em class="text-red-500 font-normal">Senza nome</em>'}
                </td>
                <td class="py-2.5 px-3">
                    <span class="px-2 py-0.5 bg-slate-100 border border-slate-200/80 rounded-md font-semibold text-[10px] text-slate-700">
                        ${item.categoria}
                    </span>
                </td>
                <td class="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                    ${formatCurrency(item.prezzo, '€')}
                </td>
                <td class="py-2.5 px-3 text-right font-mono text-slate-500">
                    ${formatCurrency(item.prezzo_fornitore, '$')}
                </td>
                <td class="py-2.5 px-3 text-center">
                    <span class="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-mono text-[10px]">${item.taglia}</span>
                </td>
                <td class="py-2.5 px-3 text-center">
                    ${item.disponibile 
                        ? '<span class="text-emerald-600" title="Disponibile">✅</span>' 
                        : '<span class="text-red-500" title="Non disponibile">❌</span>'}
                </td>
                <td class="py-2.5 px-3 text-[11px]">
                    ${noteText}
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Chiude la modale di anteprima senza effettuare alcuna modifica
 */
function chiudiAnteprimaImportazioneAccessori() {
    const modal = document.getElementById('accessory-import-preview-modal');
    if (modal) modal.classList.add('hidden');
    anteprimaAccessoriData = [];
}

/**
 * Invia i dati validati al backend atomico /api/accessories/import_batch
 */
async function confermaEdEseguiImportazioneAccessori() {
    const validItems = anteprimaAccessoriData.filter(i => i._import_status !== 'error');
    if (validItems.length === 0) {
        showAccessoriToast("Nessun accessorio valido da importare.", "error");
        return;
    }

    const btn = document.getElementById('btn-confirm-import-accessories');
    const label = document.getElementById('btn-confirm-import-label');
    const originalLabel = label ? label.innerText : '';

    if (btn) btn.disabled = true;
    if (label) label.innerText = "Salvataggio in corso...";

    try {
        const payload = validItems.map(item => ({
            id: item.id || undefined,
            codice: item.codice || undefined,
            nome: item.nome,
            categoria: item.categoria,
            prezzo: item.prezzo,
            prezzo_fornitore: item.prezzo_fornitore,
            taglia: item.taglia,
            immagine: item.immagine,
            descrizione: item.descrizione,
            disponibile: item.disponibile,
            stato: item.stato
        }));

        const res = await fetch('/api/accessories/import_batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessories: payload })
        });

        const data = await res.json();

        if (data && data.success) {
            // Chiude anteprima
            chiudiAnteprimaImportazioneAccessori();

            // Mostra Modale Report Risultati
            const resAnalizzati = document.getElementById('res-acc-analizzati');
            const resImportati = document.getElementById('res-acc-importati');
            const resAggiornati = document.getElementById('res-acc-aggiornati');
            const resDuplicati = document.getElementById('res-acc-duplicati');
            const resErrori = document.getElementById('res-acc-errori');
            const errorBox = document.getElementById('res-acc-errori-box');
            const errorList = document.getElementById('res-acc-errori-list');

            if (resAnalizzati) resAnalizzati.innerText = data.analizzati || validItems.length;
            if (resImportati) resImportati.innerText = data.importati || 0;
            if (resAggiornati) resAggiornati.innerText = data.aggiornati || 0;
            if (resDuplicati) resDuplicati.innerText = data.duplicati || 0;
            if (resErrori) resErrori.innerText = data.errori || 0;

            if (data.errori_dettagli && data.errori_dettagli.length > 0 && errorBox && errorList) {
                errorBox.classList.remove('hidden');
                errorList.innerHTML = data.errori_dettagli.map(e => 
                    `<li>Riga ${e.riga}: ${e.nome ? `<strong>${e.nome}</strong> - ` : ''}${e.errore}</li>`
                ).join('');
            } else if (errorBox) {
                errorBox.classList.add('hidden');
            }

            const resultsModal = document.getElementById('accessory-import-results-modal');
            if (resultsModal) resultsModal.classList.remove('hidden');

            // Ricarica la tabella in background
            await loadAccessories();
        } else {
            showAccessoriToast("Errore durante l'importazione: " + (data.error || 'Risposta non valida'), "error");
        }
    } catch (err) {
        console.error("⚠️ Errore salvataggio batch accessori:", err);
        showAccessoriToast("Errore di connessione durante l'importazione: " + err.message, "error");
    } finally {
        if (btn) btn.disabled = false;
        if (label) label.innerText = originalLabel;
    }
}

/**
 * Chiude la modale di riepilogo e torna alla visualizzazione dell'elenco
 */
function chiudiReportImportazioneAccessori() {
    const resultsModal = document.getElementById('accessory-import-results-modal');
    if (resultsModal) resultsModal.classList.remove('hidden');
    
    // Switch to elenco tab se siamo in un'altra sezione
    if (typeof window.switchAccessoriTab === 'function') {
        window.switchAccessoriTab('elenco');
    }
}

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
window.toggleAccessoryStatus = toggleAccessoryStatus;
window.confirmDeleteAccessory = confirmDeleteAccessory;
window.closeDeleteConfirmModal = closeDeleteConfirmModal;
window.executeDeleteAccessory = executeDeleteAccessory;
window.previewImageLarge = previewImageLarge;
window.closeImagePreview = closeImagePreview;

// Export Funzioni Importazione JSON Accessori
window.caricaEsempioJsonAccessori = caricaEsempioJsonAccessori;
window.handleAccessoryImportFile = handleAccessoryImportFile;
window.processaImportazioneJSONAccessoriDaTextarea = processaImportazioneJSONAccessoriDaTextarea;
window.processaContenutoJSONAccessori = processaContenutoJSONAccessori;
window.impostaFiltroAnteprima = impostaFiltroAnteprima;
window.chiudiAnteprimaImportazioneAccessori = chiudiAnteprimaImportazioneAccessori;
window.confermaEdEseguiImportazioneAccessori = confermaEdEseguiImportazioneAccessori;
window.chiudiReportImportazioneAccessori = chiudiReportImportazioneAccessori;
