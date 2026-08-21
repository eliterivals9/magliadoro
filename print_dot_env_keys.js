import fs from 'fs';
if (fs.existsSync('.env')) {
  const content = fs.readFileSync('.env', 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const key = trimmed.split('=')[0].trim();
      console.log(`- ${key}`);
    }
  });
} else {
  console.log(".env not found");
}
