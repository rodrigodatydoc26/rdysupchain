const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'reconstructed_full.css');
try {
    const stats = fs.statSync(filePath);
    console.log("File size:", stats.size);
    
    // Try reading as utf8
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('\u0000')) {
        console.log("Contains null bytes, likely UTF-16. Reading as utf16le...");
        content = fs.readFileSync(filePath, 'utf16le');
    } else {
        console.log("No null bytes, read as UTF-8.");
    }
    
    console.log("Content length in chars:", content.length);
    console.log("First 200 chars:\n", content.substring(0, 200));
    
    // Let's search for analise- or qty-btn
    const searchTerms = ['analise-card', 'analise-sug-card', 'qty-btn'];
    searchTerms.forEach(term => {
        const index = content.indexOf(term);
        console.log(`Term '${term}' found at index: ${index}`);
        if (index !== -1) {
            console.log(`Context around '${term}':\n`, content.substring(Math.max(0, index - 100), Math.min(content.length, index + 300)));
        }
    });
} catch (e) {
    console.error(e);
}
