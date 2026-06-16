const fs = require('fs');
const path = require('path');

const classes = [
    'analise-card',
    'analise-fechar-card',
    'analise-header',
    'analise-fechar-header',
    'btn-close-analise',
    'analise-body',
    'analise-info-row',
    'analise-label',
    'analise-counter-input',
    'analise-sug-card',
    'analise-sug-valor',
    'analise-sug-unit',
    'analise-sug-info',
    'btn-aplicar-sug',
    'analise-divider',
    'analise-input-row',
    'analise-qty-control',
    'qty-btn',
    'qty-input',
    'analise-resultado',
    'analise-unit',
    'analise-os-input',
    'btn-iniciar-analise',
    'saldo-box',
    'saldo-label',
    'saldo-valores',
    'saldo-value',
    'saldo-desc',
    'saldo-resmas',
    'btn-confirmar-analise'
];

const scratchDir = path.join(__dirname);
const files = fs.readdirSync(scratchDir);

let cssFiles = files.filter(f => f.endsWith('.css') || f.endsWith('.txt') || f.endsWith('.diff'));

console.log("Searching in", cssFiles.length, "files...");

// Let's search for blocks containing these class names
cssFiles.forEach(fileName => {
    const filePath = path.join(scratchDir, fileName);
    let content = '';
    try {
        // Handle utf16le for dangling_style.css
        if (fileName === 'dangling_style.css') {
            content = fs.readFileSync(filePath, 'utf16le');
        } else {
            content = fs.readFileSync(filePath, 'utf8');
        }
    } catch (e) {
        return;
    }
    
    // We want to see if this file has many occurrences of classes.
    let count = 0;
    classes.forEach(c => {
        if (content.includes('.' + c)) {
            count++;
        }
    });
    
    if (count > 5) {
        console.log(`\n=========================================`);
        console.log(`File: ${fileName} has ${count} matching classes`);
        console.log(`=========================================`);
        
        // Print sections of the file that contain CSS selectors
        // Since it's a CSS file, we can look for .analise- or the classes
        // Let's write a simple selector-block parser or just search and extract blocks
        const lines = content.split('\n');
        let inBlock = false;
        let braceCount = 0;
        let blockLines = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            
            // Check if line starts a class we care about
            const matchesClass = classes.some(c => trimmed.startsWith('.' + c) || trimmed.includes('.' + c + ' ') || trimmed.includes('.' + c + ':'));
            
            if (matchesClass && !inBlock) {
                inBlock = true;
                braceCount = 0;
                blockLines = [];
            }
            
            if (inBlock) {
                blockLines.push(line);
                const opens = (line.match(/{/g) || []).length;
                const closes = (line.match(/}/g) || []).length;
                braceCount += opens - closes;
                
                if (braceCount <= 0 && line.includes('}')) {
                    inBlock = false;
                    console.log(blockLines.join('\n'));
                    console.log();
                }
            }
        }
    }
});
