const { execSync } = require('child_process');

try {
    const log = execSync('git log --format="%h %s" -n 25').toString().trim().split('\n');
    for (const line of log) {
        const [hash, ...rest] = line.split(' ');
        const subject = rest.join(' ');
        try {
            const css = execSync(`git show ${hash}:css/style.css`, { stdio: ['pipe', 'pipe', 'ignore'] }).toString();
            const lines = css.split('\n').length;
            console.log(`${hash} : ${lines} lines - ${subject}`);
        } catch (e) {
            console.log(`${hash} : (no style.css) - ${subject}`);
        }
    }
} catch (e) {
    console.error(e);
}
