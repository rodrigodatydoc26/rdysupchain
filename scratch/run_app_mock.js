const fs = require('fs');
const path = require('path');

// Read and parse IDs from index.html
const htmlContent = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const idRegex = /id="([^"]+)"/g;
const existingIds = new Set();
let match;
while ((match = idRegex.exec(htmlContent)) !== null) {
    existingIds.add(match[1]);
}
console.log("Parsed IDs from index.html:", existingIds.size);

// 1. Mock the browser environment
global.window = global;
global.navigator = { onLine: true };
global.alert = (msg) => console.log("[MOCK ALERT] " + msg);
global.sessionStorage = {
    store: {},
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
        if (sel === 'i') {
            return new MockElement('', 'i');
        }
        return null;
    }

    getAttribute(name) {
        return this.attributes[name] || null;
    }

    setAttribute(name, val) {
        this.attributes[name] = val;
    }

    focus() {}
}

const elements = {};
function getEl(id) {
    if (!existingIds.has(id)) {
        console.log(`[DOM WARNING] getElementById('${id}') called but element does not exist in index.html!`);
        return null;
    }
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
        if (sel === 'meta[name="theme-color"]') {
            return new MockElement('', 'meta', { name: 'theme-color' });
        }
        return null;
    },
    querySelectorAll(sel) {
        if (sel === '.color-dot') {
            return [
                new MockElement('', 'button', { title: 'Ouro' }),
                new MockElement('', 'button', { title: 'Ciano' }),
                new MockElement('', 'button', { title: 'Magenta' }),
                new MockElement('', 'button', { title: 'Amarelo' })
            ];
        }
        if (sel === '[data-admtab]') {
            return [
                new MockElement('', 'button', { dataset: { admtab: 'dashboard' } }),
                new MockElement('', 'button', { dataset: { admtab: 'entregas' } }),
                new MockElement('', 'button', { dataset: { admtab: 'analises' } })
            ];
        }
        if (sel === '#adminApp .tab-content') {
            return [
                new MockElement('adm-tab-dashboard'),
                new MockElement('adm-tab-entregas'),
                new MockElement('adm-tab-analises')
            ];
        }
        return [];
    },
    addEventListener() {}
};

global.lucide = {
    createIcons() {
        console.log("[LUCIDE] Icons created");
    }
};

global.indexedDB = {
    open() {
        return {
            onupgradeneeded: null,
            onsuccess: null,
            onerror: null
        };
    }
};

// Mock fetch to prevent network errors in the test
global.fetch = () => {
    return Promise.resolve({
        ok: true,
        json() { return Promise.resolve([]); },
        text() { return Promise.resolve('[]'); }
    });
};

const vm = require('vm');
// 2. Load the app.js code
const code = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
// Evaluate the code in the global scope
vm.runInThisContext(code);

// 3. Set sessionStorage to simulate saved session
sessionStorage.store['rdyUser'] = JSON.stringify({
    username: 'cto',
    password: '123456',
    role: 'cto',
    label: 'CTO',
    cidade: null
});

console.log("Running initLogin()...");
try {
    global.initLogin();
    console.log("SUCCESS: session restore finished without crashing!");
} catch (err) {
    console.error("CRASH IN session restore:", err);
}
