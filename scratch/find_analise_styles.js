const fs = require('fs');
const readline = require('readline');

const logPath = 'C:\\Users\\Rodrigo Daty\\.gemini\\antigravity-ide\\brain\\6d6172b2-ba3d-4a51-828b-ffa8b4ab5713\\.system_generated\\logs\\transcript.jsonl';

async function main() {
    const fileStream = fs.createReadStream(logPath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const searchTerms = ['analise-card', 'analise-body', 'analise-header', 'analise-info-row', 'qty-btn'];
    let count = 0;
    for await (const line of rl) {
        count++;
        const hasTerm = searchTerms.some(term => line.includes(term));
        if (!hasTerm) continue;

        try {
            const obj = JSON.parse(line);
            const step = obj.step_index || count;
            
            // Check content
            if (obj.content && obj.content.includes('{')) {
                console.log(`Step ${step} contains curly brace and terms in content!`);
                fs.writeFileSync(`scratch/styles_found_step_${step}_content.css`, obj.content);
            }
            
            // Check tool calls
            if (obj.tool_calls) {
                for (let i = 0; i < obj.tool_calls.length; i++) {
                    const tc = obj.tool_calls[i];
                    const argsStr = JSON.stringify(tc.args || {});
                    if (argsStr.includes('{') || argsStr.includes('ReplacementContent') || argsStr.includes('ReplacementChunks')) {
                        console.log(`Step ${step} Tool ${tc.name} has CSS terms!`);
                        fs.writeFileSync(`scratch/styles_found_step_${step}_args_${i}.json`, JSON.stringify(tc.args, null, 2));
                    }
                }
            }
        } catch (e) {}
    }
}

main().catch(console.error);
