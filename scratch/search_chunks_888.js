const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'recovered_css_chunks_step_888.json');
try {
    const rawData = fs.readFileSync(filePath, 'utf8');
    console.log("File loaded. String length:", rawData.length);
    
    // Search for keywords in the raw string
    const terms = ['analise-sug-card', 'btn-aplicar-sug', 'qty-btn', 'analise-sug-neutral'];
    terms.forEach(term => {
        let pos = 0;
        let count = 0;
        while (true) {
            pos = rawData.indexOf(term, pos);
            if (pos === -1) break;
            count++;
            console.log(`\nMatch ${count} for '${term}' at position ${pos}:`);
            const context = rawData.substring(Math.max(0, pos - 200), Math.min(rawData.length, pos + 800));
            console.log("------------------------");
            console.log(context);
            console.log("------------------------");
            pos += term.length;
            if (count >= 3) {
                console.log(`[Truncated further matches for '${term}']`);
                break;
            }
        }
    });
} catch (e) {
    console.error(e);
}
