import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { openPilotApp } from '../../tools/browser-automation/pilot_app_navigation.mjs';
import { resolveBrowserExecutable } from '../../tools/browser-automation/browser.mjs';

const require = createRequire(new URL('../package.json', import.meta.url));
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3213/');
assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname) && !url.username && !url.password);
const browser = await require('puppeteer').launch({ headless: true, executablePath: resolveBrowserExecutable() });
const app = '[data-app-id="weather"]';
try {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', request => {
    const target = new URL(request.url());
    if (request.method() !== 'GET' || (target.origin !== url.origin && !['data:', 'blob:'].includes(target.protocol)) || target.pathname.startsWith('/api/')) return request.abort();
    return request.continue();
  });
  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__OS__ && window.__SIM__ && window.__FOLDAGENT__);
  await openPilotApp(page, 'weather', '/');
  for (const posture of ['folded', 'unfolded']) {
    await page.evaluate(value => window.__FOLDAGENT__.setPosture(value), posture);
    await page.waitForFunction(value => window.__FOLDAGENT__.getState().posture === value, {}, posture);
    await page.waitForSelector(`${app} .weather-home-daily-chart:not([hidden])`);
    await new Promise(resolve => setTimeout(resolve, 700));
    const geometry = await page.$eval(`${app} .weather-home-daily-chart`, root => {
      const columns = [...root.querySelectorAll('.weather-home-daily-column')];
      const bounds = root.getBoundingClientRect();
      const chart = root.querySelector('svg');
      const before = root.scrollLeft;
      root.scrollLeft = root.scrollWidth;
      const after = root.scrollLeft;
      root.scrollLeft = before;
      return { count: columns.length, width: root.clientWidth, scrollWidth: root.scrollWidth, visible: columns.filter(item => { const r = item.getBoundingClientRect(); return r.left >= bounds.left - 1 && r.right <= bounds.right + 1; }).length, scrolled: after > before, viewBox: chart.getAttribute('viewBox') };
    });
    console.log(JSON.stringify({ posture, ...geometry }));
    assert.ok(geometry.count >= 3 && geometry.count <= 8);
    assert.equal(geometry.viewBox, `0 0 ${geometry.count * 100} 250`);
    if (geometry.count > 5 && posture === 'folded') {
      assert.ok(geometry.scrolled && geometry.visible <= 5);
      await page.$eval(`${app} .weather-home-daily-chart`, element => { element.scrollIntoView({block: 'center'}); element.scrollLeft = 0; });
      const box = await page.$eval(`${app} .weather-home-daily-chart`, element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
      const cdp = await page.createCDPSession();
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
      const y = box.y + box.height / 2, start = box.x + box.width * .8, end = box.x + box.width * .3;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start, y }] });
      for (let i = 1; i <= 8; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start + (end - start) * i / 8, y }] });
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await new Promise(resolve => setTimeout(resolve, 300));
      const touchScroll = await page.$eval(`${app} .weather-home-daily-chart`, element => element.scrollLeft);
      assert.ok(touchScroll > 0, `Touch swipe did not scroll forecast: ${touchScroll}`);
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
      await cdp.detach();
    }
    if (posture === 'unfolded') assert.ok(geometry.scrollWidth <= geometry.width + 1);
    await page.$eval(`${app} .weather-home-daily-modes button:first-child`, element => element.click());
    await page.waitForSelector(`${app} .weather-home-daily-list:not([hidden])`);
    assert.equal(await page.$$eval(`${app} .weather-home-daily-list .weather-home-daily-row`, rows => rows.length), geometry.count);
    await page.$eval(`${app} .weather-home-daily-modes button:last-child`, element => element.click());
    await page.waitForSelector(`${app} .weather-home-daily-chart:not([hidden])`);
  }
  assert.deepEqual(errors, []);
  await context.close();
} finally { await browser.close(); }
