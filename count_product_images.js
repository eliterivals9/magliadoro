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

async function checkImages() {
  const { data, error } = await supabase.from('products').select('id, versione, immagine, legacy_id');
  if (error) {
    console.error("Error fetching products:", error);
    return;
  }
  console.log("Total products in DB:", data.length);
  const withImage = data.filter(p => p.immagine && p.immagine.trim() !== "");
  const withoutImage = data.filter(p => !p.immagine || p.immagine.trim() === "");
  console.log("Products with image:", withImage.length);
  console.log("Products without image:", withoutImage.length);
  if (withoutImage.length > 0) {
    console.log("Sample products without image:");
    console.log(withoutImage.slice(0, 5));
  }
  if (withImage.length > 0) {
    console.log("Sample products with image:");
    console.log(withImage.slice(0, 5));
  }
}

checkImages();
