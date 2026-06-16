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
            if (obj.step_index >= 1620 && obj.step_index <= 1635) {
                console.log(`Step ${obj.step_index}: source=${obj.source}, type=${obj.type}, status=${obj.status}`);
                if (obj.tool_calls) {
                    console.log("  Tool Calls:", JSON.stringify(obj.tool_calls, null, 2));
                }
                if (obj.content) {
                    console.log("  Content (truncated 200):", obj.content.substring(0, 200));
                    // If it's a VIEW_FILE or something with CSS, dump it
                    if (obj.content.includes('/*') || obj.content.includes('{') || obj.content.includes('diff')) {
                        fs.writeFileSync(`scratch/step_${obj.step_index}.css`, obj.content);
                        console.log(`  Wrote step_${obj.step_index}.css (length ${obj.content.length})`);
                    }
                }
            }
        } catch (e) {}
    }
}

main().catch(console.error);
