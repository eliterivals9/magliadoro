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

async function checkOrders() {
  let orders = [];
  if (fs.existsSync('orders_local.json')) {
    try {
      orders = JSON.parse(fs.readFileSync('orders_local.json', 'utf8'));
      console.log("Loaded orders from orders_local.json:", orders.length);
    } catch(e) {}
  }

  const { data: dbOrders, error: ordersErr } = await supabase.from('orders').select('id, carrello, data');
  if (dbOrders && dbOrders.length > 0) {
    console.log("Loaded orders from Supabase:", dbOrders.length);
    orders = dbOrders;
  }

  const { data: products } = await supabase.from('products').select('id, versione, immagine, legacy_id');
  console.log("Loaded products from Supabase:", products.length);
  const prodById = new Map();
  const prodByLegacyId = new Map();
  products.forEach(p => {
    prodById.set(String(p.id).trim(), p);
    prodByLegacyId.set(String(p.legacy_id).trim(), p);
  });

  let itemsChecked = 0;
  let itemsMatchedById = 0;
  let itemsMatchedByLegacyId = 0;
  let itemsNotMatched = 0;
  let itemsMissingImageAndFallback = 0;

  orders.forEach(order => {
    const cart = order.carrello || [];
    cart.forEach(item => {
      itemsChecked++;
      let matched = null;
      if (item.id) {
        matched = prodById.get(String(item.id).trim());
        if (matched) itemsMatchedById++;
      }
      if (!matched && item.legacy_id) {
        matched = prodByLegacyId.get(String(item.legacy_id).trim());
        if (matched) itemsMatchedByLegacyId++;
      }
      if (!matched) {
        itemsNotMatched++;
      }

      const rawImg = (matched && matched.immagine) ? matched.immagine : (item.imgUrl || item.immagine || "");
      if (!rawImg || rawImg.trim() === "") {
        itemsMissingImageAndFallback++;
        console.log(`Order #${order.id} item with no image:`, item);
      }
    });
  });

  console.log("Total items checked:", itemsChecked);
  console.log("Items matched by UUID:", itemsMatchedById);
  console.log("Items matched by Legacy ID:", itemsMatchedByLegacyId);
  console.log("Items not matched:", itemsNotMatched);
  console.log("Items missing both matched image and fallback image:", itemsMissingImageAndFallback);
}

checkOrders();
