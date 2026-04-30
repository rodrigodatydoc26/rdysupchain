const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'banco de dados', 'CONSOLIDADO_MEDIA_PAPEL (1).xlsx');
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

const clients = new Set();
for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row && row[0] && row[2]) {
        clients.add(`${row[0]} - ${row[2]}`);
    }
}

const sql = `INSERT INTO clientes (nome, cidade) VALUES \n` + 
    Array.from(clients).map(name => {
        const cidade = name.split(' - ')[0];
        return `('${name.replace(/'/g, "''")}', '${cidade.replace(/'/g, "''")}')`;
    }).join(',\n') + ';';

console.log(sql);
