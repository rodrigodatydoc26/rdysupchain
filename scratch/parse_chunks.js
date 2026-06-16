const fs = require('fs');
const content = require('./recovered_css_chunks_step_888.json');

let parsed = content;
if (typeof content === 'string') {
    parsed = JSON.parse(content);
}

console.log('Parsed type:', typeof parsed);
console.log('Is array:', Array.isArray(parsed));
if (Array.isArray(parsed)) {
    console.log('Length:', parsed.length);
    for (let i = 0; i < parsed.length; i++) {
        console.log(`Chunk ${i}:`);
        console.log(`  Lines: ${parsed[i].StartLine} to ${parsed[i].EndLine}`);
        console.log(`  Target (first 60 chars):`, parsed[i].TargetContent.substring(0, 60).replace(/\n/g, '\\n'));
        console.log(`  Replacement (first 60 chars):`, parsed[i].ReplacementContent.substring(0, 60).replace(/\n/g, '\\n'));
        fs.writeFileSync(`scratch/chunk_888_${i}.css`, parsed[i].ReplacementContent);
    }
}
