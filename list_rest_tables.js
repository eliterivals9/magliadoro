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

async function test() {
  console.log("Supabase URL:", supabaseUrl);
  // Fetch swagger/openapi doc from postgrest to see table schemas
  const res = await fetch(`${supabaseUrl}/rest/v1/`, {
    headers: {
      'apikey': supabaseAnonKey
    }
  });
  if (res.ok) {
    const doc = await res.json();
    console.log("Tables / Paths in PostgREST:");
    if (doc.paths) {
      console.log(Object.keys(doc.paths));
    } else {
      console.log("No paths found. Full body:", doc);
    }
  } else {
    console.log("Failed to fetch Swagger spec:", res.status, await res.text());
  }
}

test();
