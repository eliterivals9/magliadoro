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
  console.log("Testing insert into customer_orders...");
  // Let's query any existing rows first to see if we can get columns
  const { data: cols, error: colsErr } = await supabase.from('customer_orders').select('*').limit(1);
  console.log("Query response:", { colsErr, cols });

  // Get a test user from Supabase auth if possible or just use a dummy UUID
  const dummyUserId = "00000000-0000-0000-0000-000000000000"; // replace with a valid UUID if there's foreign key check on auth.users

  const testOrder = {
    user_id: dummyUserId,
    order_number: "ORD-TEST-9999",
    admin_order_id: 1,
    subtotal: 100.00,
    shipping: 4.00,
    total: 104.00,
    payment_status: "paid",
    status: "In Preparazione"
  };

  const { data, error } = await supabase.from('customer_orders').insert(testOrder).select();
  console.log("Insert response:", { error, data });
  
  if (data && data.length > 0) {
    // Clean up
    await supabase.from('customer_orders').delete().eq('order_number', "ORD-TEST-9999");
    console.log("Test row deleted successfully");
  }
}

test();
