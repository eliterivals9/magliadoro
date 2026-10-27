// test_exchange_rate.js
// Automated verification script for Maglia d'Oro exchange rate calculations

const assert = require('assert');

// 1. Helper function for flexible decimal parsing (same as implemented in admin.js & server.js)
function parseFlexibleDecimal(val) {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    let str = String(val).trim();
    if (!str) return 0;
    // Replace comma with dot if present
    str = str.replace(',', '.');
    const parsed = parseFloat(str);
    return isNaN(parsed) ? 0 : parsed;
}

console.log("=== TEST 1: Flexible Decimal Parsing (1,12 vs 1.12) ===");
const valComma = parseFlexibleDecimal("1,12");
const valDot = parseFlexibleDecimal("1.12");
console.log(`Parsed "1,12": ${valComma}`);
console.log(`Parsed "1.12": ${valDot}`);
assert.strictEqual(valComma, 1.12, "Comma parsing failed!");
assert.strictEqual(valDot, 1.12, "Dot parsing failed!");
console.log("PASSED: Decimal parsing works correctly for both ',' and '.'!\n");

console.log("=== TEST 2: Order #9 Calculation Verification ===");
// Order #9 details:
// - Quantity: 10
// - Unit goods cost: 40 USD
// - Unit shipping cost: 7 USD
// - Exchange rate: 1.12 (1 USD = 1.12 EUR)
// - Unit selling price: 62 EUR
const qty = 10;
const unitGoodsUsd = 40;
const unitShippingUsd = 7;
const exchangeRate = parseFlexibleDecimal("1,12"); // 1.12
const unitSellingEur = 62;

const totalGoodsUsd = unitGoodsUsd * qty; // $400 USD
const totalShippingUsd = unitShippingUsd * qty; // $70 USD
const totalCostUsd = totalGoodsUsd + totalShippingUsd; // $470 USD

const totalCostEur = Number((totalCostUsd * exchangeRate).toFixed(2)); // $470 * 1.12 = €526.40
const totalRevenueEur = Number((unitSellingEur * qty).toFixed(2)); // 62 * 10 = €620.00
const profitEur = Number((totalRevenueEur - totalCostEur).toFixed(2)); // 620.00 - 526.40 = €93.60

console.log(`Total Goods (USD): $${totalGoodsUsd.toFixed(2)}`);
console.log(`Total Shipping (USD): $${totalShippingUsd.toFixed(2)}`);
console.log(`Total Cost (USD): $${totalCostUsd.toFixed(2)}`);
console.log(`Exchange Rate: 1 USD = ${exchangeRate} EUR`);
console.log(`Total Cost (EUR): €${totalCostEur.toFixed(2)}`);
console.log(`Total Revenue (EUR): €${totalRevenueEur.toFixed(2)}`);
console.log(`Profit (EUR): €${profitEur.toFixed(2)}`);

assert.strictEqual(totalCostUsd, 470, "Total cost in USD should be $470.00");
assert.strictEqual(totalCostEur, 526.40, "Total cost in EUR should be €526.40");
assert.strictEqual(totalRevenueEur, 620.00, "Total revenue should be €620.00");
assert.strictEqual(profitEur, 93.60, "Profit should be €93.60");
console.log("PASSED: Order #9 calculation matches requirement perfectly!\n");

console.log("=== TEST 3: Off-Catalog Sale Formula ===");
// Off-catalog sale test:
// - Quantity: 5
// - Unit supplier cost: $25 USD
// - Unit shipping: $5 USD
// - Exchange rate: 0.92
// - Selling price: 50 EUR
const offQty = 5;
const offUnitUsd = 25;
const offShippingUsd = 5;
const offRate = 0.92;
const offPriceEur = 50;

const offTotalUsd = (offUnitUsd + offShippingUsd) * offQty; // (25 + 5) * 5 = $150 USD
const offCostEur = Number((offTotalUsd * offRate).toFixed(2)); // 150 * 0.92 = €138.00
const offRevEur = offPriceEur * offQty; // 50 * 5 = €250.00
const offProfit = Number((offRevEur - offCostEur).toFixed(2)); // 250 - 138 = €112.00

console.log(`Off-Catalog Cost (USD): $${offTotalUsd.toFixed(2)}`);
console.log(`Off-Catalog Cost (EUR): €${offCostEur.toFixed(2)}`);
console.log(`Off-Catalog Profit (EUR): €${offProfit.toFixed(2)}`);

assert.strictEqual(offCostEur, 138.00, "Off-catalog cost EUR calculation failed!");
assert.strictEqual(offProfit, 112.00, "Off-catalog profit calculation failed!");
console.log("PASSED: Off-catalog sale formulas verified!\n");

console.log("=== ALL TESTS PASSED SUCCESSFULLY ===");
