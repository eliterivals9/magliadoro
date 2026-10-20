
import exceljs from 'exceljs';
import fs from 'fs';

const workbook = new exceljs.Workbook();
const worksheet = workbook.addWorksheet('Test');

// Dummy image (just a tiny transparent png)
const dummyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
  'base64'
);

const imageId = workbook.addImage({
  buffer: dummyPng,
  extension: 'png',
});

worksheet.addImage(imageId, {
  tl: { col: 0, row: 0 },
  br: { col: 1, row: 1 },
});

await workbook.xlsx.writeFile('test.xlsx');
console.log('Test file generated');
