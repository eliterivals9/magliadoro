import exceljs from 'exceljs';
import path from 'path';

const __dirname = path.resolve();
const TEMPLATE_FILE = path.join(__dirname, 'template.xlsx');
const TEST_OUTPUT_FILE = path.join(__dirname, 'template_test.xlsx');

async function test() {
  try {
    console.log("Loading template.xlsx...");
    const workbook = new exceljs.Workbook();
    await workbook.xlsx.readFile(TEMPLATE_FILE);
    console.log("Template loaded successfully.");
    
    console.log("Saving simply to template_test.xlsx without any modification...");
    await workbook.xlsx.writeFile(TEST_OUTPUT_FILE);
    console.log("Saved template_test.xlsx successfully.");
  } catch (err) {
    console.error("Test failed:", err);
  }
}

test();
