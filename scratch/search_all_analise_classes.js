const fs = require('fs');
const readline = require('readline');
const path = require('path');

const logPath = 'C:\\Users\\Rodrigo Daty\\.gemini\\antigravity-ide\\brain\\6d6172b2-ba3d-4a51-828b-ffa8b4ab5713\\.system_generated\\logs\\transcript.jsonl';

const targetClasses = [
    'btn-iniciar-analise',
    'btn-confirmar-analise',
    'saldo-box',
    'saldo-label',
    'saldo-valores',
    'saldo-value',
    'saldo-desc',
    'saldo-resmas'
];

async function main() {
    const fileStream = fs.createReadStream(logPath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let output = "Searching for targeted analise classes in log...\n";
    let stepNum = 0;
    
    for await (const line of rl) {
        stepNum++;
        const matches = targetClasses.some(c => line.includes('.' + c));
        if (!matches) continue;
        
        try {
            const stepObj = JSON.parse(line);
            const stepIndex = stepObj.step_index || stepNum;
            
            // Check content
            if (stepObj.content && stepObj.content.includes('{') && targetClasses.some(c => stepObj.content.includes('.' + c))) {
                output += `\nStep ${stepIndex} has response matching TARGETS\n`;
                const lines = stepObj.content.split('\n');
                lines.forEach((l, idx) => {
                    if (targetClasses.some(c => l.includes('.' + c))) {
                        output += `--- Line ${idx+1} ---\n`;
                        for (let i = Math.max(0, idx - 4); i < Math.min(lines.length, idx + 15); i++) {
                            output += `  ${i+1}: ${lines[i]}\n`;
                        }
                    }
                });
            }
            
            // Check tool calls
            if (stepObj.tool_calls) {
                stepObj.tool_calls.forEach((tc) => {
                    const args = tc.args || {};
                    const argsStr = JSON.stringify(args);
                    if (targetClasses.some(c => argsStr.includes('.' + c))) {
                        output += `\nStep ${stepIndex} tool call ${tc.name} matches TARGETS\n`;
                        if (args.ReplacementContent) {
                            output += "ReplacementContent matches. Extracting lines...\n";
                            const lines = args.ReplacementContent.split('\n');
                            lines.forEach((l, idx) => {
                                if (targetClasses.some(c => l.includes('.' + c))) {
                                    output += `--- Line ${idx+1} ---\n`;
                                    for (let i = Math.max(0, idx - 4); i < Math.min(lines.length, idx + 15); i++) {
                                        output += `  ${i+1}: ${lines[i]}\n`;
                                    }
                                }
                            });
                        }
                    }
                });
            }
        } catch (e) {}
    }
    
    fs.writeFileSync(path.join(__dirname, 'analise_classes_search_results.txt'), output, 'utf8');
    console.log("Wrote search results to scratch/analise_classes_search_results.txt");
}

main().catch(console.error);
