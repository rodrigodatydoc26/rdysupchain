const fs = require('fs');
const readline = require('readline');

const logPath = 'C:\\Users\\Rodrigo Daty\\.gemini\\antigravity-ide\\brain\\6d6172b2-ba3d-4a51-828b-ffa8b4ab5713\\.system_generated\\logs\\transcript.jsonl';

async function main() {
    const fileStream = fs.createReadStream(logPath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let count = 0;
    for await (const line of rl) {
        count++;
        if (!line.includes('style.css')) continue;
        try {
            const obj = JSON.parse(line);
            if (obj.type === 'VIEW_FILE' && obj.content) {
                console.log(`Step ${obj.step_index || count}: VIEW_FILE content length: ${obj.content.length}`);
                if (obj.content.length > 5000) {
                    fs.writeFileSync(`scratch/viewed_css_step_${obj.step_index || count}.css`, obj.content);
                }
            }
        } catch (e) {
            // ignore
        }
    }
}

main().catch(console.error);
