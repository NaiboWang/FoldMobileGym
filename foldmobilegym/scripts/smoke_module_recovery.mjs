/** Simulate a lost lazy app chunk and verify the global recovery action. */
import puppeteer from 'puppeteer';

const siteUrl = process.argv[2] || 'http://127.0.0.1:3100/';
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
let failedChunkUrl = '';
let failNextVideoChunk = true;

try {
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (failNextVideoChunk && /\/VideoApp(?:\.tsx|-[^/]+\.js)(?:\?|$)/.test(request.url())) {
      failNextVideoChunk = false;
      failedChunkUrl = request.url();
      void request.abort('failed');
    } else {
      void request.continue();
    }
  });

  await page.goto(siteUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__OS__), { timeout: 30000 });
  await page.evaluate(() => window.__OS__.openApp('video'));
  await page.waitForFunction(() => document.querySelector('[data-app-id="video"]')?.innerText.includes('应用出现问题'),
    { timeout: 20000 });
  if (!failedChunkUrl) throw new Error('The video app chunk was not intercepted');
  const retryLabel = await page.$eval('[data-app-id="video"] button', (button) => button.textContent?.trim());
  if (retryLabel !== '刷新整个页面') throw new Error(`Expected a full-page reload action, got ${retryLabel}`);

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
    page.click('[data-app-id="video"] button'),
  ]);
  await page.waitForFunction(() => Boolean(window.__OS__), { timeout: 30000 });
  await page.evaluate(() => window.__OS__.openApp('video'));
  await page.waitForFunction(() => [...document.querySelectorAll('[data-app-id="video"] [data-trigger]')]
    .some((element) => element.getAttribute('data-trigger') === 'video.asset.open'),
  { timeout: 20000 });
  if (await page.evaluate(() => document.querySelector('[data-app-id="video"]')?.innerText.includes('应用出现问题'))) {
    throw new Error('The app error boundary remained visible after retry');
  }
  console.log(JSON.stringify({ recovered: true, failedChunkUrl, urlAfterRetry: page.url() }, null, 2));
} finally {
  await browser.close();
}
