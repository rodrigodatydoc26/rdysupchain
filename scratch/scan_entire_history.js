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

    console.log("Scanning log files...");
    let matchesCount = 0;
    
    for await (const line of rl) {
        if (!line.includes('analise-sug-card') && !line.includes('analise-fechar-card')) {
            continue;
        }
        
        try {
            const stepObj = JSON.parse(line);
            const stepIndex = stepObj.step_index;
            console.log(`\nFound potential match at step ${stepIndex}`);
            
            // Check tool calls
            if (stepObj.tool_calls) {
                stepObj.tool_calls.forEach((tc, idx) => {
                    const args = tc.args || {};
                    const argsStr = JSON.stringify(args);
                    if (argsStr.includes('analise-sug-card') || argsStr.includes('analise-fechar-card')) {
                        console.log(`  Tool call: ${tc.name}`);
                        
                        // If it's a replacement content or write, let's save the code content!
                        if (args.CodeContent) {
                            const outPath = path.join(__dirname, `recovered_step_${stepIndex}_write.css`);
                            fs.writeFileSync(outPath, args.CodeContent, 'utf8');
                            console.log(`  -> Saved write content to ${outPath}`);
                            matchesCount++;
                        }
                        if (args.ReplacementContent) {
                            const outPath = path.join(__dirname, `recovered_step_${stepIndex}_repl.css`);
                            fs.writeFileSync(outPath, args.ReplacementContent, 'utf8');
                            console.log(`  -> Saved replacement content to ${outPath}`);
                            matchesCount++;
                        }
                        if (args.ReplacementChunks) {
                            args.ReplacementChunks.forEach((chunk, cIdx) => {
                                if (chunk.ReplacementContent && (chunk.ReplacementContent.includes('analise-sug-card') || chunk.ReplacementContent.includes('analise-fechar-card'))) {
                                    const outPath = path.join(__dirname, `recovered_step_${stepIndex}_chunk_${cIdx}.css`);
                                    fs.writeFileSync(outPath, chunk.ReplacementContent, 'utf8');
                                    console.log(`  -> Saved ReplacementChunk ${cIdx} to ${outPath}`);
                                    matchesCount++;
                                }
                            });
                        }
                    }
                });
            }
            
            // Check response/content
            if (stepObj.content && (stepObj.content.includes('analise-sug-card') || stepObj.content.includes('analise-fechar-card'))) {
                // Save content block
                const outPath = path.join(__dirname, `recovered_step_${stepIndex}_response.txt`);
                fs.writeFileSync(outPath, stepObj.content, 'utf8');
                console.log(`  -> Saved response content to ${outPath}`);
                matchesCount++;
            }
        } catch (e) {
            // Ignore parse errors
        }
    }
    
    console.log(`\nScan finished. Total items saved: ${matchesCount}`);
}

main().catch(console.error);
