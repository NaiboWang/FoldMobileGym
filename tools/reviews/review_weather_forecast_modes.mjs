// Production QA for the recorded chart/list choice, independent of physical posture.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { resolveBrowserExecutable } from '../browser-automation/browser.mjs';
import { openPilotApp } from '../browser-automation/pilot_app_navigation.mjs';
const root = path.resolve(import.meta.dirname, '../..');
const require = createRequire(path.join(root, 'foldmobilegym/package.json'));
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3100/');
assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname) && !url.username && !url.password);
fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
const output = fs.mkdtempSync(path.join(root, 'artifacts/weather-forecast-modes-'));
const browser = await require('puppeteer').launch({ headless: true, executablePath: resolveBrowserExecutable() });
const errors = [], writes = [], checks = [], backTrace = [];
const app = '[data-app-id="weather"]';
const daily = `${app} .weather-home-daily`;
const scroll = `${app} [data-scroll-container="main"]`;
const readUrl = page => page.evaluate(() => window.__OS__.getAppRoute('weather').path);
// Distinct user Back events must be in distinct frames; the OS intentionally deduplicates one-frame events.
const systemBack = page => page.evaluate(async () => {
  await new Promise(resolve => requestAnimationFrame(resolve));
  window.__OS__.handleBack();
  await new Promise(resolve => requestAnimationFrame(resolve));
});
const business = page => page.evaluate(() => {
  const s = window.__SIM__.getState().apps.weather;
  return { settings: s.settings, cities: s.savedCities, selected: s.selectedCityId };
});
async function ready(page, locale, posture, route = '/') {
  page.on('pageerror', e => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (!['GET', 'HEAD'].includes(request.method())) {
      writes.push({ method: request.method(), url: request.url() }); return request.abort();
    }
    const target = new URL(request.url());
    if (target.protocol.startsWith('http') && target.host !== url.host) return request.abort();
    return request.continue();
  });
  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__OS__ && window.__SIM__ && window.__FOLDAGENT__);
  await page.evaluate(({locale, posture}) => {
    window.__OS__.locale.setLocale(locale); window.__FOLDAGENT__.setPosture(posture);
  }, {locale, posture});
  await openPilotApp(page, 'weather', route);
  await page.waitForSelector(daily);
  await page.waitForFunction(({app, posture}) => {
    const el = document.querySelector(app); return el && (el.getBoundingClientRect().width >= 600) === (posture === 'unfolded');
  }, {}, {app, posture});
}
async function view(page, layout, locale) {
  await page.waitForFunction(({daily, layout}) => document.querySelector(daily)?.dataset.weatherForecastLayout === layout, {}, {daily, layout});
  const state = await page.$eval(daily, el => ({
    mode: el.dataset.weatherForecastLayout,
    chartVisible: el.querySelector('.weather-home-daily-chart').getClientRects().length > 0,
    listVisible: el.querySelector('.weather-home-daily-list').getClientRects().length > 0,
    columns: el.querySelectorAll('.weather-home-daily-column').length,
    rows: el.querySelectorAll('.weather-home-daily-row').length,
    controls: [...el.querySelectorAll('.weather-home-daily-modes button')].map(b => ({label:b.getAttribute('aria-label'), pressed:b.getAttribute('aria-pressed'), disabled:b.disabled})),
    overflow: el.scrollWidth > el.clientWidth + 2,
  }));
  assert.equal(state.chartVisible, layout === 'chart'); assert.equal(state.listVisible, layout === 'list');
  assert.equal(state.columns, 5); assert.equal(state.rows, 5); assert.equal(state.overflow, false);
  assert.deepEqual(state.controls.map(b => b.label), locale === 'en' ? ['List view', 'Chart view'] : ['列表', '折线图']);
  assert.equal(state.controls.filter(b => b.pressed === 'true' && b.disabled).length, 1);
  assert.equal(new URL(await readUrl(page), url).searchParams.get('forecastLayout'), layout === 'list' ? 'list' : null);
}
async function switchPosture(page, posture) {
  await page.evaluate(p => window.__FOLDAGENT__.setPosture(p), posture);
  await page.waitForFunction(({app, posture}) => (document.querySelector(app).getBoundingClientRect().width >= 600) === (posture === 'unfolded'), {}, {app, posture});
  // Wait for the existing 300 ms display animation before checking final geometry.
  await new Promise(r => setTimeout(r, 400));
}
try {
  for (const locale of ['zh-Hans', 'en']) for (const posture of ['folded', 'unfolded']) {
    const context = await browser.createBrowserContext(), page = await context.newPage();
    try {
      await ready(page, locale, posture); await view(page, 'chart', locale);
      const before = await business(page);
      await page.$eval(daily, el => el.scrollIntoView({block:'center'}));
      await page.evaluate(scroll => { window.__forecastMain = document.querySelector(scroll); }, scroll);
      const beforeScroll = await page.$eval(scroll, el => el.scrollTop);
      await page.click(`${daily} [data-trigger="forecast.layout.list"]`); await view(page, 'list', locale);
      assert.equal(await page.evaluate(scroll => window.__forecastMain === document.querySelector(scroll), scroll), true);
      assert.ok(Math.abs(await page.$eval(scroll, el => el.scrollTop) - beforeScroll) <= 2, 'View change must not reset home scroll');
      const other = posture === 'folded' ? 'unfolded' : 'folded';
      await switchPosture(page, other); await view(page, 'list', locale);
      await page.screenshot({path:path.join(output, `${locale}-${other}-retained-list.png`)});
      await page.focus(`${daily} [data-trigger="forecast.layout.chart"]`); await page.keyboard.press('Enter');
      await view(page, 'chart', locale); await switchPosture(page, posture); await view(page, 'chart', locale);
      await page.screenshot({path:path.join(output, `${locale}-${posture}-retained-chart.png`)});
      await page.click(`${daily} [data-trigger="forecast.layout.list"]`); await view(page, 'list', locale);
      await page.click(`${app} [data-trigger="menu.open"]`);
      await page.waitForFunction(() => window.__OS__.getAppRoute('weather').path.includes('menu=more'));
      assert.equal(new URL(await readUrl(page), url).searchParams.get('forecastLayout'), 'list');
      assert.equal(await page.$eval(scroll, el => el.inert), true, 'Menu background must not receive keyboard focus');
      await systemBack(page); await view(page, 'list', locale);
      assert.equal(new URL(await readUrl(page), url).searchParams.get('menu'), null);
      await page.$eval(`${daily} .weather-home-daily-more`, b => b.click());
      await page.waitForFunction(() => window.__OS__.getAppRoute('weather').path.startsWith('/forecast/daily'));
      await systemBack(page); await page.waitForSelector(daily); await view(page, 'list', locale);
      assert.deepEqual(await business(page), before);
      const stateSummary = () => page.evaluate(() => {
        const s = window.__OS__.getState();
        return { launcher: s.isLauncherVisible, recents: s.isRecentsVisible, app: s.activeAppId, route: window.__OS__.getAppRoute('weather').path, keyboard: window.__OS__.keyboard.isVisible() };
      });
      backTrace.push({ stage: 'before-home-back', locale, posture, ...await stateSummary() });
      await systemBack(page);
      backTrace.push({ stage: 'after-home-back', locale, posture, ...await stateSummary() });
      await page.waitForFunction(() => window.__OS__.getState().isLauncherVisible === true);
      checks.push(`${locale}/${posture}: real pointer and keyboard switches, scroll/DOM ownership, both posture continuities, menu/detail Back, unchanged city/settings data, no layout-only Back history`);
    } finally { await context.close(); }
    const cold = await browser.createBrowserContext(), coldPage = await cold.newPage();
    try {
      await ready(coldPage, locale, posture, '/?forecastLayout=list'); await view(coldPage, 'list', locale);
      await coldPage.$eval(daily, el => el.scrollIntoView({block:'center'}));
      const geometry = await coldPage.$eval(daily, el => {
        const pane = el.getBoundingClientRect();
        return [...el.querySelectorAll('.weather-home-daily-row')].every(row => {
          const r = row.getBoundingClientRect(); return r.left >= pane.left && r.right <= pane.right;
        });
      });
      assert.equal(geometry, true);
      checks.push(`${locale}/${posture}: cold list URL and app-contained list rows`);
    } finally { await cold.close(); }
    const menuContext = await browser.createBrowserContext(), menuPage = await menuContext.newPage();
    try {
      await ready(menuPage, locale, posture, '/?menu=more&forecastLayout=list');
      await systemBack(menuPage); await view(menuPage, 'list', locale);
      assert.equal(new URL(await readUrl(menuPage), url).searchParams.get('menu'), null);
      checks.push(`${locale}/${posture}: cold menu closes to its owning list view`);
    } finally { await menuContext.close(); }
  }
  assert.deepEqual(errors, []); assert.deepEqual(writes, []);
  const result = { passed: true, url: url.href, checks, errors, writes, scope: 'Focused local simulator QA; not complete Weather, native-pixel or all-app certification' };
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({passed:true,output,checks}));
} catch(error) {
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({passed:false,checks,errors,writes,backTrace,error:String(error.stack)},null,2));
  console.error(output); throw error;
} finally { await browser.close(); }
