import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filename = '1791763016828-champions_league_patch.webp';
const filePath = path.join(__dirname, 'uploads', filename);

console.log("File path:", filePath);
console.log("Exists:", fs.existsSync(filePath));
if (fs.existsSync(filePath)) {
  const stats = fs.statSync(filePath);
  console.log("Size (bytes):", stats.size);
  const buf = fs.readFileSync(filePath);
  console.log("First 4 bytes:", buf.subarray(0, 4));
}
