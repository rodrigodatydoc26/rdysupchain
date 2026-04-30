const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'banco de dados', 'CONSOLIDADO_MEDIA_PAPEL (1).xlsx');
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

for (let i = 1; i < data.length; i++) {
    if (data[i].length > 8) {
        console.log(`Linha ${i}:`, data[i]);
        if (i > 100) break;
    }
}
