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
  console.error("Missing Supabase credentials in .env!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log("Querying 'price_rules'...");
  const { data: dataRules, error: errorRules } = await supabase.from('price_rules').select('*');
  console.log("price_rules response:");
  console.log("Error:", errorRules);
  console.log("Data count:", dataRules ? dataRules.length : null);
  console.log("Data:", dataRules);

  console.log("\nQuerying 'products'...");
  const { data: dataProds, error: errorProds } = await supabase.from('products').select('*').limit(5);
  console.log("products response:");
  console.log("Error:", errorProds);
  console.log("Data count:", dataProds ? dataProds.length : null);
  if (dataProds && dataProds.length > 0) {
    console.log("First product sample:", dataProds[0]);
  }
}

test();
