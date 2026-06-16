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
    let found = [];
    for await (const line of rl) {
        count++;
        if (!line.includes('style.css')) continue;
        try {
            const obj = JSON.parse(line);
            if (!obj.tool_calls) continue;
            for (const tool of obj.tool_calls) {
                const args = tool.args || tool.Arguments;
                if (!args) continue;
                const file = args.TargetFile || args.AbsolutePath;
                if (file && file.includes('style.css')) {
                    found.push({
                        step: obj.step_index || count,
                        name: tool.name || tool.ToolName,
                        args: args
                    });
                }
            }
        } catch (e) {
            // ignore JSON parse error
        }
    }

    console.log(`Found ${found.length} style.css references in tool calls.`);
    for (const item of found) {
        console.log(`Step ${item.step}: Tool ${item.name}`);
        if (item.args.CodeContent) {
            console.log(`  CodeContent length: ${item.args.CodeContent.length}`);
            fs.writeFileSync(`scratch/recovered_css_step_${item.step}.css`, item.args.CodeContent);
        }
        if (item.args.ReplacementContent) {
            console.log(`  ReplacementContent length: ${item.args.ReplacementContent.length}`);
            fs.writeFileSync(`scratch/recovered_css_repl_step_${item.step}.css`, item.args.ReplacementContent);
        }
        if (item.args.ReplacementChunks) {
            console.log(`  ReplacementChunks count: ${item.args.ReplacementChunks.length}`);
            fs.writeFileSync(`scratch/recovered_css_chunks_step_${item.step}.json`, JSON.stringify(item.args.ReplacementChunks, null, 2));
        }
    }
}

main().catch(console.error);
