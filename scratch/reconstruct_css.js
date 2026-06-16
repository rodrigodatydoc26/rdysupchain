const fs = require('fs');
const readline = require('readline');

const logPath = 'C:\\Users\\Rodrigo Daty\\.gemini\\antigravity-ide\\brain\\6d6172b2-ba3d-4a51-828b-ffa8b4ab5713\\.system_generated\\logs\\transcript.jsonl';

async function main() {
    const fileStream = fs.createReadStream(logPath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const lineMap = new Map();
    let totalLinesReported = 0;

    for await (const line of rl) {
        if (!line.includes('style.css')) continue;
        try {
            const obj = JSON.parse(line);
            
            // Check if it's a VIEW_FILE or an edit result showing file content
            if (obj.content && (obj.type === 'VIEW_FILE' || obj.type === 'CODE_ACTION' || obj.content.includes('Showing lines'))) {
                const text = obj.content;
                
                // Track max total lines reported
                const linesMatch = text.match(/Total Lines:\s*(\d+)/i);
                if (linesMatch) {
                    const count = parseInt(linesMatch[1]);
                    if (count > totalLinesReported) {
                        totalLinesReported = count;
                    }
                }
                
                // Parse line by line
                const regex = /^\s*(\d+):\s(.*)$/;
                const lines = text.split('\n');
                for (const l of lines) {
                    const m = l.match(regex);
                    if (m) {
                        const lineNum = parseInt(m[1]);
                        const content = m[2];
                        // If it's not already in map or if it was modified later, update it
                        // Since transcript is chronological, later steps will have updated content
                        lineMap.set(lineNum, content);
                    }
                }
            }
        } catch (e) {}
    }

    console.log(`Max lines reported in history: ${totalLinesReported}`);
    console.log(`Total unique lines recovered: ${lineMap.size}`);

    // Reconstruct the file content
    let reconstructed = [];
    let missing = [];
    for (let i = 1; i <= totalLinesReported; i++) {
        if (lineMap.has(i)) {
            reconstructed.push(lineMap.get(i));
        } else {
            reconstructed.push(`/* MISSING LINE ${i} */`);
            missing.push(i);
        }
    }

    fs.writeFileSync('scratch/reconstructed_full.css', reconstructed.join('\n'));
    console.log(`Wrote reconstructed CSS to scratch/reconstructed_full.css. Missing ${missing.length} lines.`);
    if (missing.length > 0) {
        console.log(`Missing line ranges: ${getRanges(missing)}`);
    }
}

function getRanges(arr) {
    if (arr.length === 0) return '';
    let ranges = [];
    let start = arr[0];
    let prev = arr[0];
    for (let i = 1; i < arr.length; i++) {
        if (arr[i] === prev + 1) {
            prev = arr[i];
        } else {
            ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
            start = arr[i];
            prev = arr[i];
        }
    }
    ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
    return ranges.join(', ');
}

main().catch(console.error);
