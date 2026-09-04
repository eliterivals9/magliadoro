import fs from 'fs';

function printUrls() {
  if (fs.existsSync('orders_local.json')) {
    const orders = JSON.parse(fs.readFileSync('orders_local.json', 'utf8'));
    orders.forEach(o => {
      console.log(`Order #${o.id} (Date: ${o.data}):`);
      const cart = o.carrello || [];
      cart.forEach((item, idx) => {
        console.log(`  Item ${idx + 1}: ${item.squadra || item.versione} -> imgUrl: "${item.imgUrl}", immagine: "${item.immagine}"`);
      });
    });
  } else {
    console.log("orders_local.json not found!");
  }
}

printUrls();
