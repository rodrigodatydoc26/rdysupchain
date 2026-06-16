const fs = require('fs');
const path = require('path');

const scratchDir = path.join(__dirname);
const files = fs.readdirSync(scratchDir);

let cssFiles = files.filter(f => f.startsWith('step_') && f.endsWith('.css'));

console.log("Searching in", cssFiles.length, "step files...");

cssFiles.forEach(fileName => {
    const filePath = path.join(scratchDir, fileName);
    const content = fs.readFileSync(filePath, 'utf8');
    
    console.log(`\nFile: ${fileName}`);
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
        if (line.includes('analise-') || line.includes('qty-')) {
            console.log(`  Line ${idx + 1}: ${line.trim()}`);
        }
    });
});
