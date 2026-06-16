const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../css/style.css');
try {
    const content = fs.readFileSync(filePath, 'utf8');
    const index = content.indexOf('--bg-3');
    console.log("Found --bg-3 in style.css:", index !== -1);
    
    // Also look for other occurrences of --bg-
    let pos = 0;
    while (true) {
        pos = content.indexOf('--bg-', pos);
        if (pos === -1) break;
        console.log(content.substring(pos, pos + 20));
        pos += 5;
    }
} catch (e) {
    console.error(e);
}
