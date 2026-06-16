const fs = require('fs');
const path = require('path');

const scratchDir = path.join(__dirname);
const files = fs.readdirSync(scratchDir);

const terms = ['RESPONSIVO', 'historicoTable', 'max-width: 1024px', 'max-width: 480px'];

console.log("Searching in scratch folder...");
files.forEach(fileName => {
    const filePath = path.join(scratchDir, fileName);
    let content = '';
    try {
        if (fileName === 'dangling_style.css') {
            content = fs.readFileSync(filePath, 'utf16le');
        } else {
            content = fs.readFileSync(filePath, 'utf8');
        }
    } catch (e) {
        return;
    }
    
    terms.forEach(term => {
        if (content.includes(term)) {
            console.log(`\nFound '${term}' in file: ${fileName}`);
            let idx = content.indexOf(term);
            // Print context
            console.log("------------------------");
            console.log(content.substring(Math.max(0, idx - 100), Math.min(content.length, idx + 1000)));
            console.log("------------------------");
        }
    });
});
