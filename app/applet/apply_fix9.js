const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');

// 1. CSS Removal
const cssRegex = /\/\* =+\s*MAGLIA D'ORO - FLOATING CUSTOMER CHAT WIDGET[\s\S]*?#customer-chat-modal[\s\S]*?}\s*}/;
if (!cssRegex.test(content)) {
  console.error('CSS regex match failed!');
} else {
  content = content.replace(cssRegex, '');
  console.log('1. CSS removed successfully.');
}

// 2. Support page button removal
const supportBtnRegex = /<p style="max-width: 680px; margin: 0 auto 20px auto;">Il nostro team è sempre a disposizione per aiutarti\. Puoi contattarci direttamente tramite la chat presente sul sito oppure consultare le informazioni riportate in questa sezione\.<\/p>\s*<button id="btn-attiva-chat-supporto"[\s\S]*?<\/button>/;
if (!supportBtnRegex.test(content)) {
  console.error('Support button regex match failed!');
} else {
  content = content.replace(supportBtnRegex, '<p style="max-width: 680px; margin: 0 auto 20px auto;">Il nostro team è sempre a disposizione per aiutarti. Puoi consultare le informazioni riportate in questa sezione o contattarci per qualsiasi esigenza.</p>');
  console.log('2. Support button removed successfully.');
}

// 3. Floating Chat Bubble & Modal HTML Removal
const htmlChatRegex = /<!-- =+\s*-->\s*<!-- WIDGET CHAT ASSISTENZA CLIENTI \(PUBBLICA\) -->[\s\S]*?<div id="customer-chat-modal"[\s\S]*?<\/div>\s*<\/div>/;
if (!htmlChatRegex.test(content)) {
  console.error('HTML Chat widget regex match failed!');
} else {
  content = content.replace(htmlChatRegex, '');
  console.log('3. Floating Chat Bubble & Modal HTML removed successfully.');
}

// 4. JS Chat System & Export Stubs
const jsChatRegex = /\/\/\s*=*[\r\n]+\s*\/\/\s*SISTEMA CHAT ASSISTENZA CLIENTI \(PUBBLICA\)[\s\S]*?window\.avviaControlloBadgeCustomer = avviaControlloBadgeCustomer;/;
if (!jsChatRegex.test(content)) {
  console.error('JS Chat System regex match failed!');
} else {
  const replacementJS = `// ==========================================================================
        // SISTEMA CHAT ASSISTENZA CLIENTI (DISATTIVATO - FIX 9)
        // ==========================================================================
        window.apriChatCustomer = function() {};
        window.apriChat = function() {};
        window.chiudiChatCustomer = function() {};
        window.toggleChatCustomer = function() {};
        window.inviaMessaggioCustomer = function() {};
        window.gestisciAllegatoCustomer = function() {};
        window.rimuoviAllegatoCustomer = function() {};
        window.avviaControlloBadgeCustomer = function() {};`;
  content = content.replace(jsChatRegex, replacementJS);
  console.log('4. JS Chat System replaced with stubs successfully.');
}

// 5. Visibility listener clean up
const visRegex = /\/\/\s*2\. Chat attiva o controllo badge[\s\S]*?avviaControlloBadgeCustomer\(\);\s*}/;
if (!visRegex.test(content)) {
  console.error('Visibility listener regex match failed!');
} else {
  content = content.replace(visRegex, '');
  console.log('5. Visibility listener cleaned up successfully.');
}

// 6. Onload badge check removal
const onloadBadgeRegex = /\/\/\s*Inizializza controllo messaggi non letti chat assistenza \(60s\)[\s\S]*?avviaControlloBadgeCustomer\(\);\s*}/;
if (!onloadBadgeRegex.test(content)) {
  console.error('Onload badge regex match failed!');
} else {
  content = content.replace(onloadBadgeRegex, '');
  console.log('6. Onload badge check removed successfully.');
}

fs.writeFileSync('index.html', content, 'utf8');
console.log('Done updating index.html!');
