import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf8');
const lines = envContent.split('\n');
let supabaseUrl = '';
let supabaseAnonKey = '';

for (const line of lines) {
  if (line.startsWith('SUPABASE_URL=')) {
    supabaseUrl = line.split('=')[1].trim();
  } else if (line.startsWith('SUPABASE_ANON_KEY=')) {
    supabaseAnonKey = line.split('=')[1].trim();
  }
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Credenziali Supabase mancanti nel file .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("=== VERIFICA E MIGRAZIONE PROFILI UTENTI SUPABASE ===");
  console.log(`URL Supabase: ${supabaseUrl}\n`);

  console.log("1. Tentativo di esecuzione dell'RPC 'migrate_users_to_profiles'...");
  const { data: rpcData, error: rpcError } = await supabase.rpc('migrate_users_to_profiles');

  if (rpcError) {
    console.log("ℹ️ Nota RPC:", rpcError.message);
    console.log("   -> Esegui lo script SQL 'supabase_profiles_migration.sql' nell'SQL Editor di Supabase per applicare la migrazione ed attivare la procedura rpc e il trigger automatico.");
  } else {
    console.log("✅ RPC eseguito con successo:", rpcData);
  }

  console.log("\n2. Controllo della tabella public.profiles...");
  const { data: profiles, error: profError } = await supabase.from('profiles').select('id, nome, cognome, email, telefono');

  if (profError) {
    console.error("❌ Errore durante la lettura di public.profiles:", profError.message);
  } else {
    console.log(`✅ Trovati ${profiles.length} record nella tabella public.profiles:`);
    if (profiles.length > 0) {
      console.table(profiles.slice(0, 10));
    } else {
      console.log("   (La tabella è attualmente vuota oppure le policy RLS richiedono l'esecuzione dello script SQL 'supabase_profiles_migration.sql').");
    }
  }
}

run();
