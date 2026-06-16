const fs = require('fs');
const readline = require('readline');

const logPath = 'C:\\Users\\Rodrigo Daty\\.gemini\\antigravity-ide\\brain\\6d6172b2-ba3d-4a51-828b-ffa8b4ab5713\\.system_generated\\logs\\transcript.jsonl';

async function main() {
    const fileStream = fs.createReadStream(logPath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        try {
            const obj = JSON.parse(line);
            if (obj.step_index === 13 || obj.step_index === 27) {
                if (obj.content) {
                    fs.writeFileSync(`scratch/step_${obj.step_index}_content.txt`, obj.content);
                    console.log(`Wrote step_${obj.step_index}_content.txt, length = ${obj.content.length}`);
                }
            }
        } catch (e) {}
    }
}

main().catch(console.error);
