const fs = require('fs');
const path = require('path');

const scratchDir = path.join(__dirname);
const files = fs.readdirSync(scratchDir);

let cssData = {};

function addRule(selector, rule) {
    selector = selector.trim();
    rule = rule.trim();
    if (!cssData[selector]) {
        cssData[selector] = new Set();
    }
    cssData[selector].add(rule);
}

files.forEach(fileName => {
    if (!fileName.startsWith('styles_found_step_') && !fileName.startsWith('step_') && fileName !== 'dangling_style.css') {
        return;
    }
    const filePath = path.join(scratchDir, fileName);
    let content = '';
    try {
        if (fileName === 'dangling_style.css') {
            content = fs.readFileSync(filePath, 'utf16le');
        } else {
            content = fs.readFileSync(filePath, 'utf8');
        }
    } catch (e) {
        return;
    }

    let pos = 0;
    while (true) {
        const braceOpen = content.indexOf('{', pos);
        if (braceOpen === -1) break;
        
        let selectorStart = braceOpen - 1;
        while (selectorStart >= 0 && content[selectorStart] !== '}' && content[selectorStart] !== ';' && content[selectorStart] !== '{') {
            selectorStart--;
        }
        let selector = content.substring(selectorStart + 1, braceOpen).trim();
        
        let braceCount = 1;
        let braceClose = braceOpen + 1;
        while (braceClose < content.length && braceCount > 0) {
            if (content[braceClose] === '{') braceCount++;
            else if (content[braceClose] === '}') braceCount--;
            braceClose++;
        }
        
        if (braceCount === 0) {
            const body = content.substring(braceOpen, braceClose).trim();
            let cleanSelector = selector.replace(/^\d+:\s*/, '').trim();
            
            // Normalize selector to ignore line numbers and spaces
            cleanSelector = cleanSelector.replace(/\s+/g, ' ');
            
            if (
                cleanSelector.includes('analise-') || 
                cleanSelector.includes('qty-') || 
                cleanSelector.includes('saldo-') || 
                cleanSelector.includes('btn-confirmar-analise') || 
                cleanSelector.includes('btn-close-analise') || 
                cleanSelector.includes('btn-iniciar-analise') ||
                cleanSelector.includes('btn-analise-imediata')
            ) {
                // Remove prefix lines/junk from selectors
                const lines = cleanSelector.split('\n');
                let lastLine = lines[lines.length - 1].trim();
                // Remove line numbers like "1704:"
                lastLine = lastLine.replace(/^\d+:\s*/, '').trim();
                if (lastLine) {
                    addRule(lastLine, body);
                }
            }
            pos = braceClose;
        } else {
            pos = braceOpen + 1;
        }
    }
});

let outputContent = '';
for (const [selector, rules] of Object.entries(cssData)) {
    outputContent += `/* SELECTOR: ${selector} */\n`;
    Array.from(rules).forEach(rule => {
        // Remove line numbers inside rules if any
        let cleanRule = rule.replace(/\n\s*\d+:\s*/g, '\n  ');
        cleanRule = cleanRule.replace(/^\{\s*\d+:\s*/, '{\n  ');
        outputContent += `${selector} ${cleanRule}\n\n`;
    });
}

fs.writeFileSync(path.join(scratchDir, 'extracted_analise_rules.css'), outputContent, 'utf8');
console.log("Wrote extracted rules to scratch/extracted_analise_rules.css");
