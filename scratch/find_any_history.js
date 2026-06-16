const fs = require('fs');
const path = require('path');

const paths = [
    path.join(process.env.APPDATA || '', '../Local'),
    process.env.APPDATA
].filter(Boolean);

function searchHistory(dir, depth = 0) {
    if (depth > 4) return;
    try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            let stat;
            try {
                stat = fs.statSync(fullPath);
            } catch (e) { continue; }
            
            if (stat.isDirectory()) {
                if (file.toLowerCase() === 'history') {
                    console.log("Found History directory:", fullPath);
                    // Check if it has entries or folders
                    try {
                        const sub = fs.readdirSync(fullPath);
                        console.log(`  Contains ${sub.length} items.`);
                    } catch (e) {}
                }
                searchHistory(fullPath, depth + 1);
            }
        }
    } catch (e) {}
}

for (const p of paths) {
    console.log("Searching in:", p);
    searchHistory(p);
}
