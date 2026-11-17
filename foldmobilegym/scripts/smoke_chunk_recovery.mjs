/** Simulate one stale app chunk and verify that a page refresh restores loading. */
import puppeteer from 'puppeteer';

const siteUrl = process.argv[2] || 'http://127.0.0.1:3101/';
const english = process.argv.includes('--en');
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
let blockedChunk = false;

try {
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (!blockedChunk && /\/assets\/TaobaoApp-[^/]+\.js(?:\?|$)/.test(request.url())) {
      blockedChunk = true;
      void request.abort('failed');
      return;
    }
    void request.continue();
  });

  await page.goto(siteUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__OS__), { timeout: 30000 });
  if (english) await page.evaluate(() => window.__OS__.locale.setLocale('en'));
  await page.evaluate(() => window.__OS__.openApp('taobao'));
  await page.waitForFunction((label) => {
    const app = document.querySelector('[data-app-id="taobao"]');
    return app?.textContent?.includes(label);
  }, { timeout: 20000 }, english ? 'App encountered a problem' : '应用出现问题');

  const retryText = await page.$eval('[data-app-id="taobao"] button', (button) => button.textContent?.trim());
  const expectedRetryText = english ? 'Refresh page' : '刷新整个页面';
  if (retryText !== expectedRetryText) throw new Error(`Unexpected retry action: ${retryText}`);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    page.$eval('[data-app-id="taobao"] button', (button) => button.click()),
  ]);
  await page.waitForFunction(() => Boolean(window.__OS__), { timeout: 30000 });
  if (!new URL(page.url()).searchParams.has('appReload')) throw new Error('Reload marker is missing');

  await page.evaluate(() => window.__OS__.openApp('taobao'));
  await page.waitForFunction(() => {
    const app = document.querySelector('[data-app-id="taobao"]');
    return app && app.innerText.trim().length > 0 && !app.querySelector('[data-app-launch-splash]');
  }, { timeout: 20000 });
  const errorLabel = english ? 'App encountered a problem' : '应用出现问题';
  const recovered = await page.$eval('[data-app-id="taobao"]', (app, label) => !app.textContent?.includes(label), errorLabel);
  if (!recovered) throw new Error('Taobao still shows an app error after refresh');

  console.log(JSON.stringify({ blockedChunk, retryText, recovered, url: page.url() }, null, 2));
} finally {
  await browser.close();
}
