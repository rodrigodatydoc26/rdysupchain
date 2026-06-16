const { chromium } = require('playwright');

(async () => {
  console.log("Launching browser...");
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    console.error("Failed to launch Playwright Chromium directly, trying puppeteer or other ways:", err.message);
    process.exit(1);
  }
  
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(`[CONSOLE] ${msg.type()}: ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.log('[PAGE ERROR]', err.message, err.stack);
  });

  console.log("Navigating to page...");
  await page.goto('http://localhost:8080');

  console.log("Logging in...");
  await page.fill('#loginUser', 'cto');
  await page.fill('#loginPass', '123456');
  await page.click('button[type="submit"]');

  console.log("Waiting...");
  await page.waitForTimeout(3000);
  
  console.log("Checking page content...");
  const html = await page.content();
  console.log("HTML length:", html.length);
  
  await browser.close();
  console.log("Done.");
})();
