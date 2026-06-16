const fs = require('fs');

function checkBraces(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    let braceCount = 0;
    let inComment = false;
    let lineNum = 1;
    let colNum = 1;
    
    let commentStartLine = 0;
    let commentStartCol = 0;
    let braceStack = [];

    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        const nextChar = content[i + 1];

        if (char === '\n') {
            lineNum++;
            colNum = 1;
        } else {
            colNum++;
        }

        if (inComment) {
            if (char === '*' && nextChar === '/') {
                inComment = false;
                i++; // skip /
                colNum++;
            }
            continue;
        }

        if (char === '/' && nextChar === '*') {
            inComment = true;
            commentStartLine = lineNum;
            commentStartCol = colNum;
            i++; // skip *
            colNum++;
            continue;
        }

        if (char === '{') {
            braceCount++;
            braceStack.push({ line: lineNum, col: colNum });
        } else if (char === '}') {
            braceCount--;
            if (braceCount < 0) {
                console.log(`ERROR: Extra closing brace '}' at line ${lineNum}, col ${colNum}`);
                return false;
            }
            braceStack.pop();
        }
    }

    if (inComment) {
        console.log(`ERROR: Unclosed comment starting at line ${commentStartLine}, col ${commentStartCol}`);
        return false;
    }

    if (braceCount > 0) {
        console.log(`ERROR: Unclosed opening brace '{'. Total unclosed: ${braceCount}`);
        console.log("Unclosed braces locations:");
        for (const b of braceStack) {
            console.log(`  Line ${b.line}, col ${b.col}`);
        }
        return false;
    }

    console.log("CSS brace syntax check passed successfully!");
    return true;
}

checkBraces('css/style.css');
