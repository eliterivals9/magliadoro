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

async function testDelete() {
  console.log("Checking products where prezzo_fornitore is null or 0...");
  const { data, error } = await supabase
    .from('products')
    .select('id, prezzo_fornitore')
    .or('prezzo_fornitore.is.null,prezzo_fornitore.eq.0');
  
  if (error) {
    console.error("Select error:", error);
    return;
  }
  console.log(`Found ${data.length} products with prezzo_fornitore null or 0.`);
  if (data.length > 0) {
    console.log("Example:", data.slice(0, 3));
    console.log("Attempting to delete one test product (id:", data[0].id, ")...");
    const { data: delData, error: delError } = await supabase
      .from('products')
      .delete()
      .eq('id', data[0].id)
      .select();
    
    console.log("Delete response:");
    console.log("Error:", delError);
    console.log("Deleted data:", delData);
  }
}

testDelete();
