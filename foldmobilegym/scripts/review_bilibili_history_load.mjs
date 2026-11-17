import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolveBrowserExecutable } from '../../tools/browser-automation/browser.mjs';

const require = createRequire(new URL('../package.json', import.meta.url));
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3213/');
assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname) && !url.username && !url.password);
const browser = await require('puppeteer').launch({ headless: true, executablePath: resolveBrowserExecutable() });
try {
  for (const scenario of ['slow', 'retry', 'supersede', 'closed']) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    const pageErrors = [];
    let fail = true, requests = 0;
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request', request => {
      const target = new URL(request.url());
      if (request.method() !== 'GET' || (target.origin !== url.origin && !['data:', 'blob:'].includes(target.protocol)) || target.pathname.startsWith('/api/')) return request.abort();
      if (target.pathname.endsWith('/videos.json') || /\/videos-[^/]+\.json$/.test(target.pathname)) {
        requests++;
        if (scenario === 'slow' && requests === 1) { setTimeout(() => { void request.continue(); }, 6500); return; }
        if (fail) return request.respond({ status: 503, contentType: 'text/plain', body: 'synthetic test outage' });
      }
      return request.continue();
    });
    await page.setViewport({ width: 1440, height: 1100 });
    await page.goto(url.href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__OS__ && window.__SIM__ && window.__FOLDAGENT__);
    await page.evaluate(() => window.__OS__.openApp('bilibili', '/history'));
    if (scenario === 'slow') {
      await page.waitForFunction(() => window.__OS__.getAppRoute('bilibili')?.path === '/history', { timeout: 30000 });
      assert.ok(requests >= 1);
      assert.deepEqual(pageErrors, []);
      console.log(JSON.stringify({ scenario, expected: '/history', requests, pageErrors: pageErrors.length }));
      await context.close();
      continue;
    }
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent?.trim() === '重新加载'));
    // Exceed the old 5-second navigator deadline before recovering the data.
    await new Promise(resolve => setTimeout(resolve, 6200));
    if (scenario === 'supersede') await page.evaluate(() => window.__OS__.openApp('bilibili', '/favorites'));
    if (scenario === 'closed') {
      await page.evaluate(() => window.__OS__.closeApp('bilibili'));
      await page.waitForFunction(() => !window.__OS__.getState().tasks.some(task => task.rootAppId === 'bilibili'));
      await page.evaluate(() => window.__OS__.openApp('bilibili', '/me'));
    }
    fail = false;
    const retry = await page.waitForFunction(() => [...document.querySelectorAll('button')].find(button => button.textContent?.trim() === '重新加载'));
    await retry.click();
    const expected = scenario === 'retry' ? '/history' : scenario === 'supersede' ? '/favorites' : '/me';
    await page.waitForFunction(expected => window.__OS__.getAppRoute('bilibili')?.path === expected, { timeout: 30000 }, expected);
    // Ensure a late first request does not override the newer route.
    await new Promise(resolve => setTimeout(resolve, 7000));
    assert.equal(await page.evaluate(() => window.__OS__.getAppRoute('bilibili')?.path), expected);
    assert.ok(requests >= 2);
    assert.deepEqual(pageErrors, []);
    if (scenario === 'retry') {
      await page.evaluate(() => window.__OS__.handleBack());
      await page.waitForFunction(() => window.__OS__.getAppRoute('bilibili')?.path.startsWith('/?tab='));
    }
    console.log(JSON.stringify({ scenario, expected, requests, pageErrors: pageErrors.length }));
    await context.close();
  }
} finally { await browser.close(); }
