// admin/auth.js

let supabaseInstance = null;
let supabasePromise = null;

const ADMIN_EMAILS = [
    "sergiottocatania@gmail.com"
];

// Helper per eseguire una Promise con timeout di sicurezza e pulizia immediata del timer
function withTimeout(promise, ms, timeoutMessage = "Timeout operazione") {
    let timerId = null;
    const timeoutPromise = new Promise((_, reject) => {
        timerId = setTimeout(() => {
            reject(new Error(timeoutMessage));
        }, ms);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
        if (timerId) {
            clearTimeout(timerId);
            timerId = null;
        }
    });
}

// Ritorna l'istanza del client di Supabase prelevando la config in modo asincrono con timeout
async function getSupabase() {
    if (supabaseInstance) return supabaseInstance;
    if (supabasePromise) return supabasePromise;
    
    supabasePromise = (async () => {
        try {
            const fetchConfigPromise = (async () => {
                if (typeof window.fetchAppConfig === 'function') {
                    return await window.fetchAppConfig();
                }
                const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
                const fetchTimer = controller ? setTimeout(() => controller.abort(), 7000) : null;
                try {
                    const res = await fetch('/api/config', controller ? { signal: controller.signal } : {});
                    if (!res.ok) throw new Error("Impossibile recuperare i dati dal server (/api/config).");
                    return await res.json();
                } finally {
                    if (fetchTimer) clearTimeout(fetchTimer);
                }
            })();

            const config = await withTimeout(fetchConfigPromise, 7000, "Timeout recupero configurazione (/api/config)");
            
            if (!config || !config.supabaseUrl || !config.supabaseAnonKey) {
                const errorMsg = "Configurazione di Supabase mancante! Assicurati di impostare SUPABASE_URL e SUPABASE_ANON_KEY nel file .env.";
                console.error("❌ " + errorMsg);
                throw new Error(errorMsg);
            }
            
            supabaseInstance = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
                auth: {
                    storageKey: 'sb-admin-auth-token',
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: false
                }
            });
            return supabaseInstance;
        } catch (err) {
            console.error("Errore di inizializzazione Supabase:", err);
            supabasePromise = null; // reset to allow retry if requested
            throw err;
        }
    })();
    
    return supabasePromise;
}

// Funzione di login dedicata per l'amministratore
async function adminLogin(email, password) {
    if (!email || !password) {
        throw new Error("Inserisci sia l'indirizzo email che la password.");
    }

    const client = await withTimeout(getSupabase(), 7000, "Timeout connessione Supabase");
    if (!client) {
        throw new Error("Servizio di autenticazione non disponibile.");
    }
    
    // 1. Esegui il login con timeout di salvaguardia
    const { data, error } = await withTimeout(
        client.auth.signInWithPassword({ 
            email: email.trim(), 
            password 
        }),
        7000,
        "Timeout autenticazione Supabase"
    );
    
    if (error) {
        const msg = error.message ? error.message.toLowerCase() : '';
        if (error.code === 'invalid_credentials' || msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
            throw new Error("Credenziali non valide. Verifica email e password.");
        }
        if (msg.includes('email not confirmed')) {
            throw new Error("Indirizzo email non confermato.");
        }
        throw new Error(error.message || "Si è verificato un errore durante l'autenticazione.");
    }
    
    // 2. Recupera l'utente e la sessione dal risultato
    const user = data?.user || (data?.session && data.session.user);
    if (!user || !user.email) {
        throw new Error("Impossibile recuperare i dati dell'utente autenticato.");
    }
    
    // 3. Verifica whitelist
    const userEmail = user.email.trim().toLowerCase();
    const isAuthorized = ADMIN_EMAILS.some(adminEmail => adminEmail.trim().toLowerCase() === userEmail);
    
    if (isAuthorized) {
        window.location.replace("/admin");
        return data;
    } else {
        await client.auth.signOut({ scope: 'local' });
        throw new Error("Accesso negato: account non autorizzato all'area amministrativa.");
    }
}

let currentAuthPromise = null;

// Controlla se l'utente è loggato ed è autorizzato (riutilizza l'unica Promise di verifica condivisa con timeout)
async function checkAuth(force = false) {
    if (!force && currentAuthPromise) return currentAuthPromise;

    currentAuthPromise = (async () => {
        const pathname = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname.toLowerCase() : '';
        const isLoginPage = pathname.includes('admin-login');
        
        try {
            const client = await withTimeout(getSupabase(), 7000, "Timeout inizializzazione client Supabase");
            if (!client) {
                if (!isLoginPage) {
                    window.location.replace('/admin-login');
                }
                return null;
            }

            const { data: { session } = {}, error } = await withTimeout(
                client.auth.getSession(),
                7000,
                "Timeout recupero sessione Supabase"
            );
            
            if (error || !session || !session.user || !session.user.email) {
                if (!isLoginPage) {
                    window.location.replace('/admin-login');
                }
                return null;
            }
            
            const userEmail = session.user.email.trim().toLowerCase();
            const isAuthorized = ADMIN_EMAILS.some(adminEmail => adminEmail.trim().toLowerCase() === userEmail);
            
            if (!isAuthorized) {
                try {
                    await client.auth.signOut({ scope: 'local' });
                } catch (e) {}
                if (!isLoginPage) {
                    window.location.replace('/admin-login');
                }
                return null;
            }
            
            // Se è autorizzato ed è nella pagina di login, lo mandiamo alla dashboard
            if (isLoginPage) {
                window.location.replace('/admin');
                return session.user;
            }
            
            const authLoader = document.getElementById('admin-auth-loader');
            if (authLoader) {
                authLoader.style.display = 'none';
            }
            const adminRoot = document.getElementById('admin-root');
            if (adminRoot) {
                adminRoot.style.display = 'flex';
            }
            return session.user;
        } catch (err) {
            console.warn("Autenticazione Admin non completata o scaduta:", err?.message || err);
            if (!isLoginPage) {
                window.location.replace('/admin-login');
            }
            return null;
        }
    })();

    window.adminAuthPromise = currentAuthPromise;
    return currentAuthPromise;
}

// Effettua il login generico
async function signIn(email, password) {
    const client = await withTimeout(getSupabase(), 7000, "Timeout connessione Supabase");
    const { data, error } = await withTimeout(
        client.auth.signInWithPassword({ email, password }),
        7000,
        "Timeout autenticazione Supabase"
    );
    if (error) throw error;
    return data;
}

// Registra un nuovo utente
async function signUp(email, password) {
    const client = await withTimeout(getSupabase(), 7000, "Timeout connessione Supabase");
    const { data, error } = await withTimeout(
        client.auth.signUp({ email, password }),
        7000,
        "Timeout registrazione Supabase"
    );
    if (error) throw error;
    return data;
}

// Effettua il logout dell'utente
async function logout() {
    try {
        const client = await withTimeout(getSupabase(), 3000, "Timeout client logout");
        if (client) {
            await client.auth.signOut({ scope: 'local' });
        }
    } catch (err) {
        console.error("Errore durante il logout:", err);
    } finally {
        try {
            localStorage.removeItem('sb-admin-auth-token');
            sessionStorage.removeItem('sb-admin-auth-token');
        } catch (e) {}
        window.location.replace('/admin-login');
    }
}

// Espone le funzioni e la promessa a livello globale
window.getSupabaseClient = getSupabase;
window.checkAuth = checkAuth;
window.signIn = signIn;
window.signUp = signUp;
window.logout = logout;
window.adminLogin = adminLogin;

// Avvia immediatamente l'unica verifica auth non appena auth.js viene eseguito
if (typeof window !== 'undefined' && !window.adminAuthPromise) {
    window.adminAuthPromise = checkAuth();
}


