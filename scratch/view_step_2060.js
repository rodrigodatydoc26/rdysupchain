const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'recovered_response_1800_step_2060.txt');
try {
    const content = fs.readFileSync(filePath, 'utf8');
    console.log("File loaded successfully (length:", content.length, ")");
    
    const lines = content.split('\n');
    console.log("Total lines:", lines.length);
    
    // Find where line 1800 or 1799 is mentioned
    let foundIdx = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('1799:') || lines[i].includes('1800:') || lines[i].includes('1798:')) {
            foundIdx = i;
            break;
        }
    }
    
    if (foundIdx !== -1) {
        console.log("Found line 1800 at index:", foundIdx);
        // Print 100 lines from foundIdx
        for (let i = Math.max(0, foundIdx - 10); i < Math.min(lines.length, foundIdx + 120); i++) {
            console.log(`${i + 1}: ${lines[i]}`);
        }
    } else {
        console.log("Line 1800 not found. Printing first 100 lines containing ':'");
        lines.slice(0, 100).forEach((l, idx) => {
            if (l.includes(':')) {
                console.log(`${idx + 1}: ${l}`);
            }
        });
    }
} catch (e) {
    console.error(e);
}
