const fs = require('fs');
const path = require('path');

const scratchDir = path.join(__dirname);
const files = fs.readdirSync(scratchDir);

let matchedFiles = files.filter(f => f.startsWith('recovered_step_'));

console.log("Searching in", matchedFiles.length, "recovered files...");

matchedFiles.forEach(fileName => {
    const filePath = path.join(scratchDir, fileName);
    const content = fs.readFileSync(filePath, 'utf8');
    
    if (content.includes('analise-sug-card') && (content.includes('{') || content.includes('\\u007b'))) {
        console.log(`\n=========================================`);
        console.log(`File: ${fileName}`);
        console.log(`=========================================`);
        
        // Let's print out lines around analise-sug-card
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
            if (line.includes('analise-sug-card') || line.includes('analise-fechar') || line.includes('analise-card')) {
                // print line and 5 lines before/after
                const start = Math.max(0, idx - 10);
                const end = Math.min(lines.length - 1, idx + 20);
                console.log(`--- Line ${idx + 1} ---`);
                for (let i = start; i <= end; i++) {
                    console.log(`${i+1}: ${lines[i]}`);
                }
                console.log(`----------------------`);
            }
        });
    }
});
