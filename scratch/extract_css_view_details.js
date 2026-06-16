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
            if (obj.type === 'VIEW_FILE' && obj.content && line.includes('style.css')) {
                // Find total lines from the text content of VIEW_FILE
                const match = obj.content.match(/Total Lines:\s*(\d+)/i);
                const linesCount = match ? match[1] : 'unknown';
                console.log(`Step ${obj.step_index}: VIEW_FILE total lines = ${linesCount}, content length = ${obj.content.length}`);
                
                // Print the first 2 lines of the content
                const lines = obj.content.split('\n');
                console.log(`  First lines: ${lines.slice(0, 3).join(' | ')}`);
                console.log(`  Last lines: ${lines.slice(-3).join(' | ')}`);
            }
        } catch (e) {}
    }
}

main().catch(console.error);
