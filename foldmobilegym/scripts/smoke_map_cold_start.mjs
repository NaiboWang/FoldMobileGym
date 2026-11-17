/** Measure a fresh browser profile's first Map launch through its rendered SDK map. */
import puppeteer from 'puppeteer';

const siteUrl = process.argv[2] || 'http://127.0.0.1:3100/';
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
const logs = [];
page.on('console', (message) => {
  if (message.text().startsWith('[Map]')) logs.push(message.text());
});
try {
  await page.goto(siteUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__OS__), { timeout: 30000 });
  const started = Date.now();
  await page.evaluate(() => window.__OS__.openApp('map'));
  await page.waitForSelector('[data-app-id="map"]', { timeout: 20000 });
  try {
    await page.waitForFunction(() => Boolean(window.__mapInstance), { timeout: 45000 });
  } catch (error) {
    const snapshot = await page.evaluate(() => ({
      text: document.querySelector('[data-app-id="map"]')?.innerText.slice(0, 300),
      serviceWorker: Boolean(navigator.serviceWorker?.controller),
    }));
    throw new Error(`${String(error?.message ?? error)} ${JSON.stringify({ snapshot, logs })}`);
  }
  const mapReadyMs = Date.now() - started;
  console.log(JSON.stringify({ mapReadyMs, serviceWorker: await page.evaluate(() => Boolean(navigator.serviceWorker?.controller)), logs }, null, 2));
  if (mapReadyMs > 20000) process.exitCode = 1;
} finally {
  await browser.close();
}
