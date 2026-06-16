const fs = require('fs');
const path = require('path');

const historyDir = 'C:\\Users\\Rodrigo Daty\\AppData\\Roaming\\Antigravity\\User\\History';

function search() {
    if (!fs.existsSync(historyDir)) {
        console.log("History directory does not exist at:", historyDir);
        return;
    }

    const folders = fs.readdirSync(historyDir);
    console.log(`Found ${folders.length} folders in History.`);

    for (const folder of folders) {
        const folderPath = path.join(historyDir, folder);
        if (!fs.statSync(folderPath).isDirectory()) continue;

        const entriesJsonPath = path.join(folderPath, 'entries.json');
        if (fs.existsSync(entriesJsonPath)) {
            try {
                const entries = JSON.parse(fs.readFileSync(entriesJsonPath, 'utf8'));
                console.log(`Folder ${folder}: resource = ${entries.resource}`);
            } catch (e) {
                console.log(`Folder ${folder}: error parsing entries.json`, e.message);
            }
        } else {
            console.log(`Folder ${folder}: no entries.json`);
        }
    }
}

search();
