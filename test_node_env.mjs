import fs from 'fs';
import { JSDOM } from 'jsdom';

const indexHtml = fs.readFileSync('index.html', 'utf8');
const products = JSON.parse(fs.readFileSync('products_local.json', 'utf8'));

console.log("Creating JSDOM environment...");
const dom = new JSDOM(indexHtml, {
  url: 'http://localhost/',
  runScripts: 'dangerously',
  resources: 'usable'
});

const { window } = dom;
const { document } = window;

console.log("JSDOM loaded successfully!");
console.log("Window initialized, databaseProdotti length:", window.databaseProdotti ? window.databaseProdotti.length : 'undefined');
