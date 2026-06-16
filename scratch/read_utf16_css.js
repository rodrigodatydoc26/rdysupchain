const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'dangling_style.css');
try {
    const content = fs.readFileSync(filePath, 'utf16le');
    console.log("File loaded successfully (length:", content.length, ")");
    
    // Let's search for .analise- or .qty-btn
    const lines = content.split('\n');
    console.log("Total lines:", lines.length);
    
    // Find lines containing .analise- or .qty-btn
    let matchedLines = [];
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('analise-') || lines[i].includes('qty-btn') || lines[i].includes('analise-card')) {
            matchedLines.push({ lineNum: i + 1, content: lines[i].trim() });
        }
    }
    
    console.log("Matches found:", matchedLines.length);
    matchedLines.slice(0, 50).forEach(m => {
        console.log(`${m.lineNum}: ${m.content}`);
    });
    
    // Let's print lines 900 to 1100 to see what's there
    console.log("\n--- Lines 950 to 1100 ---");
    const start = Math.max(0, 950);
    const end = Math.min(lines.length, 1100);
    for (let i = start; i < end; i++) {
        console.log(`${i + 1}: ${lines[i]}`);
    }
} catch (e) {
    console.error(e);
}
