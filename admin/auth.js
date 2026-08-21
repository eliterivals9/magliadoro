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
            const res = await fetch('/api/config');
            if (!res.ok) throw new Error("Impossibile recuperare i dati dal server (/api/config).");
            const config = await res.json();
            
            if (!config.supabaseUrl || !config.supabaseAnonKey) {
                const errorMsg = "Configurazione di Supabase mancante! Assicurati di impostare SUPABASE_URL e SUPABASE_ANON_KEY nel file .env.";
                console.error("❌ " + errorMsg);
                alert(errorMsg);
                throw new Error(errorMsg);
            }
            
            console.log("SUPABASE_URL =", config.supabaseUrl);
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
            if (typeof showToast === 'function') {
                showToast("Errore critico Supabase: " + err.message, "error");
            } else {
                alert("Errore critico Supabase: " + err.message);
            }
            supabasePromise = null; // reset to allow retry if requested
            throw err;
        }
    })();
    
    return supabasePromise;
}

// Funzione di login dedicata per l'amministratore
async function adminLogin(email, password) {
    const client = await getSupabase();
    
    // 1. Esegui il login
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
        throw error;
    }
    
    // 2. Recupera l'utente
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) {
        throw new Error("Impossibile recuperare i dati dell'utente.");
    }
    
    // 3. Verifica whitelist
    if (user.email && ADMIN_EMAILS.includes(user.email.toLowerCase())) {
        window.location.href = "/admin";
        return data;
    } else {
        await client.auth.signOut({ scope: 'local' });
        throw new Error("Accesso negato.");
    }
}

// Controlla se l'utente è loggato ed è autorizzato
async function checkAuth() {
    const isLoginPage = window.location.pathname.includes('admin-login');
    
    try {
        const client = await getSupabase();
        const { data: { session }, error } = await client.auth.getSession();
        
        if (error || !session) {
            if (!isLoginPage) {
                window.location.href = '/admin-login';
            }
            return null;
        }
        
        if (!session.user || !session.user.email || !ADMIN_EMAILS.includes(session.user.email.toLowerCase())) {
            await client.auth.signOut({ scope: 'local' });
            if (!isLoginPage) {
                window.location.href = '/admin-login';
            }
            return null;
        }
        
        // Se è autorizzato ed è nella pagina di login, lo mandiamo alla dashboard
        if (isLoginPage) {
            window.location.href = '/admin';
        }
        
        return session.user;
    } catch (err) {
        console.error("Errore di verifica autenticazione:", err);
        if (!isLoginPage) {
            window.location.href = '/admin-login';
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
        await client.auth.signOut({ scope: 'local' });
    } catch (err) {
        console.error("Errore durante il logout:", err);
    }
    window.location.href = '/admin-login';
}

// Espone le funzioni a livello globale
window.getSupabaseClient = getSupabase;
window.checkAuth = checkAuth;
window.signIn = signIn;
window.signUp = signUp;
window.logout = logout;
window.adminLogin = adminLogin;
