const fs = require('fs');
const readline = require('readline');
const path = require('path');

const logPath = 'C:\\Users\\Rodrigo Daty\\.gemini\\antigravity-ide\\brain\\6d6172b2-ba3d-4a51-828b-ffa8b4ab5713\\.system_generated\\logs\\transcript.jsonl';

async function main() {
    const fileStream = fs.createReadStream(logPath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let count = 0;
    for await (const line of rl) {
        if (line.includes('style.css') || line.includes('style.css')) {
            console.log(`Match on line ${count}:`);
            // Parse JSON to see details
            try {
                const obj = JSON.parse(line);
                console.log(`Type: ${obj.type}, Status: ${obj.status}, Source: ${obj.source}`);
                if (obj.tool_calls) {
                    console.log("Tool Calls:", JSON.stringify(obj.tool_calls, null, 2));
                }
                if (obj.content && obj.content.length < 500) {
                    console.log("Content:", obj.content);
                } else if (obj.content) {
                    console.log("Content (truncated):", obj.content.substring(0, 500));
                }
            } catch (e) {
                console.log(line.substring(0, 300));
            }
            console.log('-'.repeat(80));
        }
        count++;
    }
}

main().catch(console.error);
