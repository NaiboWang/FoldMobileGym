// Local isolated browser contexts; the simulator's predefined weather data only.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { existsSync } from 'node:fs';
const root = path.resolve(import.meta.dirname, '../..');
const front = existsSync(path.join(root, 'foldmobilegym/package.json')) ? 'foldmobilegym' : 'mobilegym';
const require = createRequire(path.join(root, front, 'package.json'));
const executablePath = process.env.FOLDAGENT_BROWSER_PATH || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium'].find(existsSync);
assert.ok(executablePath && process.env.FOLDAGENT_REVIEW_URL);
const url = new URL(process.env.FOLDAGENT_REVIEW_URL);
assert.ok(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname) && !url.username && !url.password);
const browser = await require('puppeteer').launch({ headless: true, executablePath });
const results = [], failures = [];
try {
  for (const posture of ['folded', 'unfolded']) for (const locale of ['zh-Hans', 'en']) for (const sample of [
    { time: '2026-11-01T00:30:00-04:00', today: '2026-11-01', tomorrow: '2026-11-02', yesterday: '2026-10-31' },
    { time: '2026-03-09T00:30:00-04:00', today: '2026-03-09', tomorrow: '2026-03-10', yesterday: '2026-03-08' },
  ]) {
    const label = `${posture}-${locale}-${sample.today}`, context = await browser.createBrowserContext(), page = await context.newPage(), errors = [];
    try {
      page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(error.message));
      await page.emulateTimezone('America/New_York'); await page.setRequestInterception(true);
      page.on('request', request => { const target = new URL(request.url()); if (request.method() === 'GET' && target.origin === url.origin && target.pathname !== '/api' && !target.pathname.startsWith('/api/')) request.continue(); else request.abort(); });
      await page.setViewport({ width: 1440, height: 1100 }); await page.goto(url.href, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__OS__ && window.__SIM_TIME__ && window.__SIM__ && window.__FOLDAGENT__);
      await page.evaluate(async ({ posture, locale, time }) => {
        window.__FOLDAGENT__.setPosture(posture); window.__OS__.locale.setLocale(locale); window.__SIM_TIME__.setSimulatedTime(time, false);
        await window.__SIM__.preloadAppStores(['weather']); const state = window.__SIM__.getState().apps.weather;
        window.__SIM__.setState({ apps: { weather: { ...state, selectedCityId: 'beijing', bundlesByCityId: {} } } }, { deep: false, reload: false });
        window.__OS__.openApp('weather', '/');
      }, { posture, locale, time: sample.time });
      const selector = '[data-app-id="weather"] .weather-home-daily-column[data-weather-day-date]';
      await page.waitForFunction(({ selector, today, tomorrow }) => { const dates = [...document.querySelectorAll(selector)].map(el => el.getAttribute('data-weather-day-date')); return dates.includes(today) && dates.includes(tomorrow); }, {}, { selector, today: sample.today, tomorrow: sample.tomorrow });
      const dates = await page.$$eval(selector, elements => elements.map(el => el.getAttribute('data-weather-day-date')));
      assert.equal(new Set(dates).size, dates.length, 'forecast dates should be unique');
      const index = dates.indexOf(sample.today); assert.equal(dates[index + 1], sample.tomorrow);
      if (index > 0) assert.equal(dates[index - 1], sample.yesterday);
      await page.evaluate(() => window.__OS__.openApp('weather', '/forecast/daily?cityId=beijing'));
      await page.waitForSelector(`[data-app-id="weather"] [data-weather-forecast-date="${sample.tomorrow}"]`);
      assert.deepEqual(errors, []); results.push(label); console.log('PASS', label);
    } catch (error) { failures.push(`${label}: ${String(error)}`); console.error('FAIL', failures.at(-1)); }
    finally { await context.close(); }
  }
} finally { await browser.close(); }
console.log(JSON.stringify({ results, failures })); if (failures.length) process.exitCode = 1;
