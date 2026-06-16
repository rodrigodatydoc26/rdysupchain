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

    console.log("Searching for style.css operations covering lines 1800+...");
    let stepNum = 0;
    
    for await (const line of rl) {
        stepNum++;
        try {
            const stepObj = JSON.parse(line);
            
            if (stepObj.tool_calls) {
                stepObj.tool_calls.forEach((tc) => {
                    const args = tc.args || {};
                    if (tc.name === 'view_file' && args.AbsolutePath && args.AbsolutePath.includes('style.css')) {
                        // Check if it views line 1800 or start line is > 1750
                        const start = args.StartLine || 1;
                        const end = args.EndLine || 9999;
                        if (end >= 1800 && start <= 2200) {
                            console.log(`Step ${stepObj.step_index || stepNum} viewed style.css lines ${start} to ${end}`);
                        }
                    }
                    if (tc.name === 'replace_file_content' && args.TargetFile && args.TargetFile.includes('style.css')) {
                        const start = args.StartLine || 1;
                        const end = args.EndLine || 9999;
                        console.log(`Step ${stepObj.step_index || stepNum} replaced style.css lines ${start} to ${end}`);
                    }
                    if (tc.name === 'multi_replace_file_content' && args.TargetFile && args.TargetFile.includes('style.css')) {
                        console.log(`Step ${stepObj.step_index || stepNum} multi-replaced style.css`);
                    }
                });
            }
            
            // If it's a model response showing css/style.css lines
            if (stepObj.content && stepObj.content.includes('style.css') && (stepObj.content.includes('1801:') || stepObj.content.includes('1810:'))) {
                console.log(`Step ${stepObj.step_index || stepNum} response contains 'style.css' and line numbers around 1800`);
                // Let's dump the response
                fs.writeFileSync(path.join(__dirname, `recovered_response_1800_step_${stepObj.step_index || stepNum}.txt`), stepObj.content);
            }
        } catch (e) {}
    }
}

main().catch(console.error);
