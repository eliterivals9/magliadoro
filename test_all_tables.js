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
  const urls = [
    `${supabaseUrl}/rest/v1/`,
    `${supabaseUrl}/rest/v1`,
    `${supabaseUrl}/rest/v1/?apikey=${supabaseAnonKey}`
  ];

  for (const url of urls) {
    try {
      console.log(`Fetching: ${url}`);
      const res = await fetch(url, {
        headers: {
          'apikey': supabaseAnonKey
        }
      });
      console.log(`Status: ${res.status}`);
      const text = await res.text();
      console.log(`Body (first 200 chars): ${text.slice(0, 200)}`);
    } catch (e) {
      console.error(e);
    }
  }
}

test();
