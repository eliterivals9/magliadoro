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

async function viewLotti() {
  const { data: lotti, error } = await supabase.from('lotti').select('id, numero_lotto, orders');
  if (error) {
    console.error("Error fetching lotti:", error);
    return;
  }
  console.log("Total archived lotti:", lotti.length);
  lotti.forEach(l => {
    console.log(`Lotto #${l.id} (Numero: ${l.numero_lotto}):`);
    const orders = l.orders || [];
    console.log(`  Number of snapshotted orders: ${orders.length}`);
    orders.forEach((o, oIdx) => {
      const cart = o.carrello || [];
      cart.forEach((item, iIdx) => {
        console.log(`    Order index ${oIdx}, Item ${iIdx + 1}: ${item.squadra || item.versione} -> imgUrl: "${item.imgUrl}", immagine: "${item.immagine}"`);
      });
    });
  });
}

viewLotti();
