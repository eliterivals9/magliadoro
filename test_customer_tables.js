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
  console.log("Checking customer_orders...");
  const { data: dataO, error: errorO } = await supabase.from('customer_orders').select('*').limit(1);
  console.log("customer_orders:", { errorO, dataO });

  console.log("Checking customer_order_items...");
  const { data: dataI, error: errorI } = await supabase.from('customer_order_items').select('*').limit(1);
  console.log("customer_order_items:", { errorI, dataI });
}

test();
