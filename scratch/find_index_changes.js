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
        if (!line.includes('index.html')) continue;
        try {
            const obj = JSON.parse(line);
            if (obj.tool_calls) {
                for (const tc of obj.tool_calls) {
                    if (tc.name === 'replace_file_content' || tc.name === 'multi_replace_file_content') {
                        console.log(`Step ${obj.step_index}: Tool ${tc.name}`);
                        console.log("Args:", JSON.stringify(tc.args, null, 2));
                    }
                }
            }
        } catch (e) {}
    }
}

main().catch(console.error);
