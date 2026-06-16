const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../css/style.css');
try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
        if (line.includes('--bg-3') || line.includes('bg-3')) {
            console.log(`Line ${idx + 1}: ${line.trim()}`);
        }
    });
} catch (e) {
    console.error(e);
}
