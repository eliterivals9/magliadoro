import fs from 'fs';

const indexHtml = fs.readFileSync('index.html', 'utf8');
const lines = indexHtml.split('\n');

for (let i = 23730; i < 24020; i++) {
  const line = lines[i];
  if (line.includes('selectStagioneClub') || line.includes('selectStagioneNaz') || line.includes('badgeSidebarTotale') || line.includes('ottieniStagioniDeduplicateEOrdinate')) {
    console.log(`${i + 1}: ${line.trim()}`);
  }
}
