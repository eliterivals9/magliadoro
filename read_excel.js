
import ExcelJS from 'exceljs';

async function readExcel() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('lotti/LOTTO_0006.xlsx');

  workbook.eachSheet((worksheet, sheetId) => {
    console.log(`\n=== Foglio: ${worksheet.name} ===`);
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      console.log(`Riga ${rowNumber}: ${JSON.stringify(row.values)}`);
    });
  });
}

readExcel().catch(err => console.error(err));
