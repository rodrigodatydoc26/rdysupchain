const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'step_1631.css');
try {
    const content = fs.readFileSync(filePath, 'utf8');
    console.log("File loaded. Char length:", content.length);
    console.log("File Content:\n", content);
} catch (e) {
    console.error(e);
}
