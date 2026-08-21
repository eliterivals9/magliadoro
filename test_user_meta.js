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

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log("Testing querying users from Supabase...");
  const { data, error } = await supabase.from('users').select('*').limit(5);
  console.log("from('users') result:", { data, error });

  const { data: dataAuthUsers, error: errorAuthUsers } = await supabase.from('auth_users').select('*').limit(5);
  console.log("from('auth_users') result:", { data: dataAuthUsers, error: errorAuthUsers });
}

test();
