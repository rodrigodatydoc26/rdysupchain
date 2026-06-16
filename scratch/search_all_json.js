const fs = require('fs');
const path = require('path');

const scratchDir = path.join(__dirname);
const files = fs.readdirSync(scratchDir);

let jsonFiles = files.filter(f => f.endsWith('.json'));

console.log("Searching in", jsonFiles.length, "JSON files...");

jsonFiles.forEach(fileName => {
    const filePath = path.join(scratchDir, fileName);
    const content = fs.readFileSync(filePath, 'utf8');
    
    if (content.includes('analise-sug-') || content.includes('btn-aplicar-sug')) {
        console.log(`\nFile: ${fileName}`);
        
        // Let's print occurrences
        let pos = 0;
        while (true) {
            pos = content.indexOf('analise-sug-', pos);
            if (pos === -1) break;
            const segment = content.substring(Math.max(0, pos - 100), Math.min(content.length, pos + 400));
            console.log(`--- Occurrence at position ${pos} ---`);
            console.log(segment);
            pos += 12;
        }
    }
});
