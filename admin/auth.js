// admin/auth.js

let supabaseInstance = null;
let supabasePromise = null;

const ADMIN_EMAILS = [
    "sergiottocatania@gmail.com"
];

// Ritorna l'istanza del client di Supabase prelevando la config in modo asincrono
async function getSupabase() {
    if (supabaseInstance) return supabaseInstance;
    if (supabasePromise) return supabasePromise;
    
    supabasePromise = (async () => {
        try {
            const config = (typeof window.fetchAppConfig === 'function')
                ? await window.fetchAppConfig()
                : await (async () => {
                    const res = await fetch('/api/config');
                    if (!res.ok) throw new Error("Impossibile recuperare i dati dal server (/api/config).");
                    return await res.json();
                  })();
            
            if (!config.supabaseUrl || !config.supabaseAnonKey) {
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

    const client = await getSupabase();
    if (!client) {
        throw new Error("Servizio di autenticazione non disponibile.");
    }
    
    // 1. Esegui il login
    const { data, error } = await client.auth.signInWithPassword({ 
        email: email.trim(), 
        password 
    });
    
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

// Controlla se l'utente è loggato ed è autorizzato
async function checkAuth() {
    const pathname = window.location.pathname.toLowerCase();
    const isLoginPage = pathname.includes('admin-login');
    
    try {
        const client = await getSupabase();
        if (!client) {
            if (!isLoginPage) {
                window.location.replace('/admin-login');
            }
            return null;
        }

        const { data: { session }, error } = await client.auth.getSession();
        
        if (error || !session || !session.user || !session.user.email) {
            if (!isLoginPage) {
                window.location.replace('/admin-login');
            }
            return null;
        }
        
        const userEmail = session.user.email.trim().toLowerCase();
        const isAuthorized = ADMIN_EMAILS.some(adminEmail => adminEmail.trim().toLowerCase() === userEmail);
        
        if (!isAuthorized) {
            await client.auth.signOut({ scope: 'local' });
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
        
        return session.user;
    } catch (err) {
        console.error("Errore di verifica autenticazione:", err);
        if (!isLoginPage) {
            window.location.replace('/admin-login');
        }
        return null;
    }
}

// Effettua il login generico
async function signIn(email, password) {
    const client = await getSupabase();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
}

// Registra un nuovo utente
async function signUp(email, password) {
    const client = await getSupabase();
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) throw error;
    return data;
}

// Effettua il logout dell'utente
async function logout() {
    try {
        const client = await getSupabase();
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

// Espone le funzioni a livello globale
window.getSupabaseClient = getSupabase;
window.checkAuth = checkAuth;
window.signIn = signIn;
window.signUp = signUp;
window.logout = logout;
window.adminLogin = adminLogin;
