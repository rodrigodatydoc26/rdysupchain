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
    let captureNext = false;
    for await (const line of rl) {
        count++;
        try {
            const obj = JSON.parse(line);
            
            // Check if this step is step 1630 or 1631 (stdout of 1630)
            if (obj.step_index === 1630 || obj.step_index === 1631) {
                console.log(`Step ${obj.step_index}: type=${obj.type}, status=${obj.status}`);
                if (obj.content) {
                    console.log("Content:", obj.content);
                }
                if (obj.tool_calls) {
                    console.log("Tool calls:", JSON.stringify(obj.tool_calls));
                }
            }
            
            // Also let's search if any step contains the text "diff --git a/css/style.css"
            if (obj.content && obj.content.includes('diff --git a/css/style.css')) {
                console.log(`Found git diff output in Step ${obj.step_index || count}:`);
                console.log(obj.content.substring(0, 1000));
                fs.writeFileSync(`scratch/diff_found_step_${obj.step_index || count}.diff`, obj.content);
            }
        } catch (e) {}
    }
}

main().catch(console.error);
