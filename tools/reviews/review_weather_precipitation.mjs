import assert from 'node:assert/strict';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { openPilotApp } from '../browser-automation/pilot_app_navigation.mjs';
import { resolveBrowserExecutable } from '../browser-automation/browser.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const front = existsSync(path.join(root, 'foldmobilegym/package.json')) ? 'foldmobilegym' : 'mobilegym';
const require = createRequire(path.join(root, front, 'package.json'));
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3412/');
assert.ok(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname));
const browser = await require('puppeteer').launch({ headless: true, executablePath: resolveBrowserExecutable() });
const checks = [], failures = [];
try {
  for (const posture of ['folded', 'unfolded']) for (const locale of ['zh-Hans', 'en']) for (const summary of ['', 'Heavy rain expected soon', 'No rain expected soon']) {
    const context = await browser.createBrowserContext(), page = await context.newPage();
    try {
      await page.setRequestInterception(true);
      page.on('request', req => { const u = new URL(req.url()); if ((['localhost', '127.0.0.1'].includes(u.hostname) && ['GET', 'HEAD'].includes(req.method())) || ['data:', 'blob:'].includes(u.protocol)) req.continue(); else req.abort(); });
      await page.setViewport({ width: 1440, height: 1100 });
      await page.goto(url.href, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__OS__ && window.__SIM__ && window.__FOLDAGENT__);
      await page.evaluate(async ({posture, locale, summary}) => {
        window.__FOLDAGENT__.setPosture(posture); window.__OS__.locale.setLocale(locale);
        await window.__SIM__.preloadAppStores(['weather']);
        const state = window.__SIM__.getState().apps.weather;
        const weatherLibrary = Object.fromEntries(Object.entries(state.weatherLibrary).map(([key, entry]) => [key, {...entry, bundle: entry.bundle ? {...entry.bundle, minutely: summary ? {summary, minutely: []} : null} : entry.bundle}]));
        window.__SIM__.setState({apps:{weather:{...state, selectedCityId: 'beijing', bundlesByCityId:{}, weatherLibrary}}}, {deep:false,reload:false});
      }, {posture, locale, summary});
      await openPilotApp(page, 'weather', '/');
      await page.waitForSelector('[data-app-id="weather"] .weather-hourly-summary');
      const texts = await page.$$eval('[data-app-id="weather"] .weather-hourly-summary', els => els.map(el => el.textContent));
      const expected = summary || (locale === 'en' ? '24-hour forecast' : '未来24小时预报');
      const text = texts.find(value => value.includes(expected));
      assert.ok(text, `Missing hourly summary: ${JSON.stringify(texts)}`);
      assert.equal(await page.$('[data-app-id="weather"] [data-weather-precipitation]'), null, 'Duplicate precipitation card should not be rendered');
      assert.ok(!text.includes(locale === 'en' ? 'Safe to go out' : '放心出行吧'), text);
      checks.push({posture, locale, scenario: summary || 'missing'}); console.log('PASS', posture, locale, summary || 'missing');
    } catch (error) { failures.push({posture,locale,summary,error:String(error)}); console.error('FAIL', posture,locale,summary,String(error)); }
    finally { await context.close(); }
  }
} finally { await browser.close(); }
console.log(JSON.stringify({passed: !failures.length, checks, failures, scope:'Synthetic forecasts and missing data; does not certify live weather or native device parity.'}));
if (failures.length) process.exitCode = 1;
