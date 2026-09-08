import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf8');
const lines = envContent.split('\n');
let supabaseUrl = '';
let supabaseAnonKey = '';
let serviceRoleKey = '';

for (const line of lines) {
  if (line.startsWith('SUPABASE_URL=')) {
    supabaseUrl = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
  } else if (line.startsWith('SUPABASE_ANON_KEY=')) {
    supabaseAnonKey = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
  } else if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
    serviceRoleKey = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
  }
}

const key = serviceRoleKey || supabaseAnonKey;
const supabase = createClient(supabaseUrl, key);

async function count() {
  let allProducts = [];
  let from = 0;
  const limit = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase.from('products').select('categoria').range(from, from + limit - 1);
    if (error) {
        console.error(error);
        return;
    }
    if (data && data.length > 0) {
        allProducts = allProducts.concat(data);
        from += limit;
        if (data.length < limit) hasMore = false;
    } else {
        hasMore = false;
    }
  }
  
  const categoriesToCount = [
    'Fan', 'Versione Fan',
    'Kit',
    'Kit Allenamento', 'Kit allenamento',
    'Smanicato', 'Smanicati',
    'Retro', 'Retrò',
    'Player', 'Versione Player'
  ];
  
  const counts = {};
  categoriesToCount.forEach(c => counts[c] = 0);
  
  allProducts.forEach(p => {
    const c = p.categoria;
    if (counts.hasOwnProperty(c)) {
        counts[c]++;
    }
  });
  console.log(JSON.stringify(counts, null, 2));
}

count();
