const fs = require('fs');
const path = require('path');

// 1. Mock the browser environment
global.window = global;
global.addEventListener = () => {};
global.navigator = { onLine: true };
global.alert = (msg) => console.log("[MOCK ALERT] " + msg);
global.sessionStorage = {
    store: {
        'adm_user': 'CTO'
    },
    getItem(key) { return this.store[key] || null; },
    setItem(key, val) { this.store[key] = String(val); },
    removeItem(key) { delete this.store[key]; }
};
global.localStorage = {
    store: {},
    getItem(key) { return this.store[key] || null; },
    setItem(key, val) { this.store[key] = String(val); },
    removeItem(key) { delete this.store[key]; }
};

class MockElement {
    constructor(id = '', tag = 'div', attrs = {}) {
        this.id = id;
        this.tagName = tag.toUpperCase();
        this.attributes = attrs;
        this.style = {
            setProperty(prop, val) { this[prop] = val; }
        };
        this.classList = {
            classes: new Set(),
            add(c) { this.classes.add(c); },
            remove(c) { this.classes.delete(c); },
            contains(c) { return this.classes.has(c); },
            toggle(c, force) {
                if (force !== undefined) {
                    if (force) this.classes.add(c);
                    else this.classes.delete(c);
                } else {
                    if (this.classes.has(c)) this.classes.delete(c);
                    else this.classes.add(c);
                }
            }
        };
        this.innerText = '';
        this.textContent = '';
        this.value = '';
        this.listeners = {};
        this.dataset = attrs.dataset || {};
    }

    addEventListener(event, cb) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(cb);
    }

    querySelector(sel) {
        return new MockElement('', 'i');
    }

    getAttribute(name) {
        return this.attributes[name] || null;
    }

    setAttribute(name, val) {
        this.attributes[name] = val;
    }
}

const elements = {};
function getEl(id) {
    if (!elements[id]) {
        elements[id] = new MockElement(id);
    }
    return elements[id];
}

global.document = {
    documentElement: new MockElement('html'),
    getElementById(id) {
        return getEl(id);
    },
    querySelector(sel) {
        return new MockElement('', 'meta');
    },
    querySelectorAll(sel) {
        return [];
    },
    addEventListener(event, cb) {
        if (event === 'DOMContentLoaded') {
            this.domContentLoadedHandler = cb;
        }
    }
};

global.lucide = {
    createIcons() {
        console.log("[LUCIDE] Icons created");
    }
};

global.API = {
    fetch(endpoint) {
        return Promise.resolve([]);
    }
};

// 2. Read and extract the script block from admin.html
const html = fs.readFileSync(path.join(__dirname, '../admin.html'), 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>[\s\S]*?<script>([\s\S]*?)<\/script>/);
// Wait, the first script tag is the redirect script, the second is the main script.
// Let's extract all scripts
const scripts = [];
const scriptRegex = /<script>([\s\S]*?)<\/script>/g;
let m;
while ((m = scriptRegex.exec(html)) !== null) {
    scripts.push(m[1]);
}

console.log(`Extracted ${scripts.length} script blocks from admin.html`);

const vm = require('vm');
// Run the scripts in order
try {
    for (let i = 0; i < scripts.length; i++) {
        console.log(`Running script block ${i}...`);
        vm.runInThisContext(scripts[i]);
    }
    console.log("Scripts executed in global context without compile errors.");
    
    // Trigger DOMContentLoaded
    if (document.domContentLoadedHandler) {
        console.log("Triggering DOMContentLoaded...");
        document.domContentLoadedHandler();
        console.log("SUCCESS: DOMContentLoaded finished without crashing!");
    } else {
        console.log("No DOMContentLoaded handler found!");
    }
} catch (err) {
    console.error("CRASH during execution:", err);
}
