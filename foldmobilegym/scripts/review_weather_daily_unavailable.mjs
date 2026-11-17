import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { openPilotApp } from '../../tools/browser-automation/pilot_app_navigation.mjs';
import { resolveBrowserExecutable } from '../../tools/browser-automation/browser.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const require = createRequire(path.join(root, 'foldmobilegym/package.json'));
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3100/');
assert.ok(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname) && !url.username && !url.password);
const browser = await require('puppeteer').launch({ headless: true, executablePath: resolveBrowserExecutable() });
const results = [];
try {
  for (const locale of ['zh-Hans', 'en']) for (const posture of ['folded', 'unfolded']) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    const errors = [], requestFailures = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error' && message.text().includes('Failed to fetch daily forecast page bundle')) requestFailures.push(message.text());
    });
    await page.setRequestInterception(true);
    page.on('request', request => {
      const target = new URL(request.url());
      if (request.method() !== 'GET' || (target.origin !== url.origin && !['data:', 'blob:'].includes(target.protocol))) return request.abort();
      return request.continue();
    });
    await page.goto(url.href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__OS__ && window.__FOLDAGENT__);
    await page.evaluate(({ locale, posture }) => { window.__OS__.locale.setLocale(locale); window.__FOLDAGENT__.setPosture(posture); }, { locale, posture });
    await openPilotApp(page, 'weather', '/forecast/daily?cityId=tianjin');
    const status = '[data-app-id="weather"] [role="status"]';
    await page.waitForSelector(`${status} button`, { visible: true });
    const text = await page.$eval(status, element => element.innerText);
    assert.ok(text.includes(locale === 'en' ? 'Weather data is unavailable' : '天气数据暂不可用'));
    assert.ok(text.includes(locale === 'en' ? 'Retry' : '重试'));
    await page.click(`${status} button`);
    await page.waitForFunction(() => document.querySelector('[data-app-id="weather"] [role="status"] button'));
    assert.ok(requestFailures.length >= 2, 'Retry must perform another real fetch, not just repaint the error');
    await openPilotApp(page, 'weather', '/forecast/daily?cityId=beijing');
    await page.waitForSelector('[data-app-id="weather"] [data-weather-forecast-aqi]', { visible: true });
    assert.equal(await page.$(status), null, 'Error for one city must not leak into another');
    assert.deepEqual(errors, []);
    results.push({ locale, posture, unavailable: true, retryRequests: requestFailures.length, cachedCityVisible: true });
    await context.close();
  }
  console.log(JSON.stringify({ passed: true, results, scope: 'local isolated browser, failed data request and cached-city recovery; no native parity claim' }));
} finally { await browser.close(); }
