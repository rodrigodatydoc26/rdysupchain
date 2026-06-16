const fs = require('fs');
const path = require('path');

const dirs = [
    path.join(process.env.APPDATA || '', '../Local'),
    process.env.APPDATA
].filter(Boolean);

const patterns = ['code', 'cursor', 'sublime', 'atom', 'visual', 'antigravity'];

for (const dir of dirs) {
    try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            if (patterns.some(pat => file.toLowerCase().includes(pat))) {
                const fullPath = path.join(dir, file);
                console.log("Matching folder:", fullPath);
                // Check if it has a User/History folder inside
                const userHistory = path.join(fullPath, 'User/History');
                if (fs.existsSync(userHistory)) {
                    console.log("  FOUND History at:", userHistory);
                    // Search for style.css in this history folder!
                    searchStyleInHistory(userHistory);
                }
                const historyDirect = path.join(fullPath, 'History');
                if (fs.existsSync(historyDirect)) {
                    console.log("  FOUND History direct at:", historyDirect);
                    searchStyleInHistory(historyDirect);
                }
            }
        }
    } catch (e) {}
}

function searchStyleInHistory(historyDir) {
    try {
        const folders = fs.readdirSync(historyDir);
        for (const folder of folders) {
            const folderPath = path.join(historyDir, folder);
            if (!fs.statSync(folderPath).isDirectory()) continue;
            const entriesJsonPath = path.join(folderPath, 'entries.json');
            if (fs.existsSync(entriesJsonPath)) {
                try {
                    const entries = JSON.parse(fs.readFileSync(entriesJsonPath, 'utf8'));
                    if (entries.resource && entries.resource.includes('style.css')) {
                        console.log(`    MATCH: ${entries.resource} in ${folderPath}`);
                        for (const entry of entries.entries) {
                            const fpath = path.join(folderPath, entry.id);
                            if (fs.existsSync(fpath)) {
                                const size = fs.statSync(fpath).size;
                                console.log(`      Entry ${entry.id} (${entry.updated}): size = ${size} bytes`);
                                fs.writeFileSync(`scratch/recovered_history_${entry.id}.css`, fs.readFileSync(fpath));
                            }
                        }
                    }
                } catch (e) {}
            }
        }
    } catch (e) {}
}
