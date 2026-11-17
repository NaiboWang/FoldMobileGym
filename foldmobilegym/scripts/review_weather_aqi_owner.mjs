import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { openPilotApp } from '../../tools/browser-automation/pilot_app_navigation.mjs';
import { resolveBrowserExecutable } from '../../tools/browser-automation/browser.mjs';

// Dev-only: fixture injection imports the local Vite source module, not a production API.
const root = path.resolve(import.meta.dirname, '../..');
const require = createRequire(path.join(root, 'foldmobilegym/package.json'));
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3100/');
assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname) && !url.username && !url.password);
const browser = await require('puppeteer').launch({ headless: true, executablePath: resolveBrowserExecutable() });
const results = [];
try {
  for (const locale of ['zh-Hans', 'en']) for (const posture of ['folded', 'unfolded']) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request', request => {
      const target = new URL(request.url());
      if (request.method() !== 'GET' || (target.origin !== url.origin && !['data:', 'blob:'].includes(target.protocol))) return request.abort();
      return request.continue();
    });
    await page.goto(url.href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__OS__ && window.__FOLDAGENT__);
    await openPilotApp(page, 'weather', '/');
    await page.evaluate(async ({locale, posture}) => {
      window.__OS__.locale.setLocale(locale);
      window.__FOLDAGENT__.setPosture(posture);
      const resource = suffix => {
        const entry = performance.getEntriesByType('resource').find(item => new URL(item.name).pathname.endsWith(suffix));
        if (!entry) throw new Error(`Weather module was not loaded: ${suffix}`);
        return entry.name;
      };
      const { useWeatherStore } = await import(resource('/apps/Weather/state.ts'));
      const source = useWeatherStore.getState().weatherLibrary.beijing?.bundle;
      if (!source) throw new Error('Beijing test fixture unavailable');
      const bundle = { ...source, airQuality: null };
      useWeatherStore.setState(previous => ({ ...previous, bundlesByCityId: {
        ...previous.bundlesByCityId,
        beijing: { lonLat: '116.4074,39.9042', bundle, updatedAt: 0, historicalYesterday: null },
        tianjin: { lonLat: '', bundle, updatedAt: 0, historicalYesterday: null },
      }}), true);
    }, {locale, posture});
    await openPilotApp(page, 'weather', '/forecast/daily?cityId=beijing');
    await page.waitForFunction(() => [...document.querySelectorAll('[data-app-id="weather"] [data-weather-forecast-aqi]')].some(e => e.textContent !== '--'));
    const setBeijingCoordinates = async lonLat => page.evaluate(async value => {
      const entry = performance.getEntriesByType('resource').find(item => new URL(item.name).pathname.endsWith('/apps/Weather/state.ts'));
      const { useWeatherStore } = await import(entry.name);
      useWeatherStore.setState(previous => ({ ...previous, bundlesByCityId: {
        ...previous.bundlesByCityId,
        beijing: { ...previous.bundlesByCityId.beijing, lonLat: value },
      }}), true);
    }, lonLat);
    await setBeijingCoordinates('');
    await page.waitForFunction(() => {
      const values = [...document.querySelectorAll('[data-app-id="weather"] [data-weather-forecast-aqi]')];
      return values.length > 0 && values.every(e => e.textContent === '--');
    }, { timeout: 5000 });
    await setBeijingCoordinates('116.4074,39.9042');
    await page.waitForFunction(() => [...document.querySelectorAll('[data-app-id="weather"] [data-weather-forecast-aqi]')].some(e => e.textContent !== '--'));
    await openPilotApp(page, 'weather', '/forecast/daily?cityId=tianjin');
    await page.waitForFunction(label => document.querySelector('[data-app-id="weather"]')?.innerText.includes(label), {}, locale === 'en' ? 'Tianjin' : '天津市');
    await page.waitForSelector('[data-app-id="weather"] [data-weather-forecast-aqi]');
    // Wait through React effects; no coordinates and no current observation means no AQI exists.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const values = await page.$$eval('[data-app-id="weather"] [data-weather-forecast-aqi]', els => els.map(e => e.textContent));
    assert.ok(values.length > 0);
    assert.ok(values.every(value => value === '--'), `Foreign-city AQI displayed: ${values.join(',')}`);
    assert.deepEqual(errors, []);
    results.push({locale, posture, days: values.length, foreignForecastAbsent: true});
    await context.close();
  }
  console.log(JSON.stringify({passed: true, results, scope: 'dev-only isolated synthetic state; no real weather service'}));
} finally { await browser.close(); }
