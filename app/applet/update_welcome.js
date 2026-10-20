import fs from 'fs';

let html = fs.readFileSync('index.html', 'utf8');

const targetSnippet = `        /* MAGLIA D'ORO - POPUP INFORMATIVO DI BENVENUTO (STEP 1) */
        function apriWelcomePopup() {`;

if (!html.includes(targetSnippet)) {
    console.error('Target snippet not found in index.html!');
    process.exit(1);
}

const replacementScript = `        /* MAGLIA D'ORO - POPUP INFORMATIVO DI BENVENUTO (STEP 1) */
        function ottieniTipoNavigazione() {
            try {
                const navEntries = performance.getEntriesByType && performance.getEntriesByType('navigation');
                if (navEntries && navEntries.length > 0) {
                    return navEntries[0].type; // 'navigate', 'reload', 'back_forward', 'prerender'
                }
                if (window.performance && window.performance.navigation) {
                    const type = window.performance.navigation.type;
                    if (type === 1) return 'reload';
                    if (type === 2) return 'back_forward';
                    return 'navigate';
                }
            } catch (e) {
                console.warn("Errore lettura Performance Navigation API:", e);
            }
            return 'navigate';
        }

        // Se l'ingresso al sito è una NUOVA VISITA ('navigate'), e non un semplice refresh ('reload') o 'back_forward',
        // ripristiniamo lo stato per mostrare il popup informativo di benvenuto.
        const tipoNavigazioneIniziale = ottieniTipoNavigazione();
        if (tipoNavigazioneIniziale === 'navigate') {
            try {
                sessionStorage.removeItem('maglia_welcome_popup_shown');
            } catch (e) {}
        }

        function apriWelcomePopup() {
            try {
                if (sessionStorage.getItem('maglia_welcome_popup_shown')) return;

                if (window.location.pathname.includes('/admin') || 
                    window.location.href.includes('/admin') || 
                    document.querySelector('#admin-root') || 
                    document.body.classList.contains('is-admin') ||
                    window._isAdminPickerMode) {
                    return;
                }

                if (window.location.hash.includes('checkout') || 
                    document.querySelector('#modal-checkout[style*="display: flex"], #checkout-view[style*="display: block"], .checkout-step:not([style*="display: none"])')) {
                    return;
                }

                const modalOverlays = document.querySelectorAll('.modal-personalizza, #modal-checkout, #modal-accessorio-dettaglio, #order-confirm-overlay, #modal-zoom-img, .custom-lightbox');
                for (let i = 0; i < modalOverlays.length; i++) {
                    const m = modalOverlays[i];
                    if (m.id !== 'welcome-popup-overlay' && 
                        (m.classList.contains('active') || (getComputedStyle(m).display !== 'none' && getComputedStyle(m).visibility !== 'hidden' && m.offsetWidth > 0))) {
                        return;
                    }
                }

                const overlay = document.getElementById('welcome-popup-overlay');
                if (!overlay) return;

                overlay.style.display = 'flex';
                void overlay.offsetWidth;
                overlay.classList.add('active');

                window.addEventListener('keydown', handleWelcomePopupKeydown);
                overlay.addEventListener('click', handleWelcomePopupBackdropClick);

                const btn = document.getElementById('welcome-popup-btn');
                if (btn) btn.focus();
            } catch (e) {
                console.error("Errore apertura welcome popup:", e);
            }
        }

        function chiudiWelcomePopup() {
            try {
                sessionStorage.setItem('maglia_welcome_popup_shown', 'true');
                const overlay = document.getElementById('welcome-popup-overlay');
                if (overlay) {
                    overlay.classList.remove('active');
                    setTimeout(() => {
                        overlay.style.display = 'none';
                    }, 250);
                }
                window.removeEventListener('keydown', handleWelcomePopupKeydown);
            } catch (e) {
                console.error("Errore chiusura welcome popup:", e);
            }
        }

        function handleWelcomePopupKeydown(e) {
            if (e.key === 'Escape') {
                chiudiWelcomePopup();
            }
        }

        function handleWelcomePopupBackdropClick(e) {
            if (e.target.id === 'welcome-popup-overlay') {
                chiudiWelcomePopup();
            }
        }

        window.apriWelcomePopup = apriWelcomePopup;
        window.chiudiWelcomePopup = chiudiWelcomePopup;`;

const oldBlockStart = html.indexOf(targetSnippet);
const endMarker = 'window.chiudiWelcomePopup = chiudiWelcomePopup;';
const oldBlockEnd = html.indexOf(endMarker, oldBlockStart) + endMarker.length;

html = html.substring(0, oldBlockStart) + replacementScript + html.substring(oldBlockEnd);
fs.writeFileSync('index.html', html, 'utf8');
console.log('Successfully updated index.html!');
