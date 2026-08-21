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
  const email = `test_order_user_${Date.now()}@example.com`;
  const password = "Password123!";

  console.log("Signing up temporary user:", email);
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password
  });

  if (signUpError) {
    console.error("Sign up failed:", signUpError.message);
    return;
  }

  const user = signUpData.user;
  const session = signUpData.session;
  console.log("Sign up success! User ID:", user?.id);

  if (!session) {
    console.log("No session returned. Attempting sign in...");
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (signInError) {
      console.error("Sign in failed:", signInError.message);
      return;
    }
    testWithToken(signInData.session.access_token, signInData.user.id);
  } else {
    testWithToken(session.access_token, user.id);
  }
}

async function testWithToken(accessToken, userId) {
  console.log("Initializing user Supabase client with access token...");
  const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });

  const testOrder = {
    user_id: userId,
    order_number: "ORD-TEST-" + Math.floor(Math.random() * 10000),
    admin_order_id: 9999,
    subtotal: 100.00,
    shipping: 4.00,
    total: 104.00,
    payment_status: "paid",
    status: "In Preparazione"
  };

  console.log("Inserting test order into customer_orders...");
  const { data: ordData, error: ordErr } = await userSupabase.from('customer_orders').insert(testOrder).select();
  console.log("Insert result:", { ordErr, ordData });

  if (ordData && ordData.length > 0) {
    console.log("Successfully inserted order under authenticated user!");
    const orderId = ordData[0].id;
    
    // Let's test customer_order_items
    const testItem = {
      order_id: orderId,
      product_id: "0d3b218c-c49d-4fd5-91a1-ccfa0935cff4", // lens kit
      nome: "Lens Kit",
      categoria: "Kit",
      stagione: "2026/2027",
      taglia: "M",
      personalizzazione: "None",
      prezzo: 19.99,
      quantita: 1
    };
    
    console.log("Inserting test item...");
    const { data: itemData, error: itemErr } = await userSupabase.from('customer_order_items').insert(testItem).select();
    console.log("Item insert result:", { itemErr, itemData });
    
    // Clean up
    console.log("Cleaning up...");
    await userSupabase.from('customer_order_items').delete().eq('order_id', orderId);
    await userSupabase.from('customer_orders').delete().eq('id', orderId);
    console.log("Cleanup completed.");
  }

  // Delete temp user if possible
  console.log("Done!");
}

test();
