const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'recovered_css_chunks_step_888.json');
try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log("JSON loaded successfully");
    console.log("Keys in JSON:", Object.keys(data));
    
    // If it's an array or object, let's pretty-print it
    console.log(JSON.stringify(data, null, 2));
} catch (e) {
    console.error(e);
}
