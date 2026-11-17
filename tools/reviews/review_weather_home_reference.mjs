import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { openPilotApp } from '../browser-automation/pilot_app_navigation.mjs';
import { resolveBrowserExecutable } from '../browser-automation/browser.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const require = createRequire(path.join(root, 'foldmobilegym/package.json'));
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3245/');
assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname));
fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
const output = fs.mkdtempSync(path.join(root, 'artifacts/weather-home-reference-'));
const browser = await require('puppeteer').launch({ headless: true, executablePath: resolveBrowserExecutable() });
const checks = [], errors = [], writes = [];
const app = '[data-app-id="weather"]';

try {
  for (const posture of ['folded', 'unfolded']) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    page.on('pageerror', error => errors.push({ posture, message: error.message }));
    await page.setRequestInterception(true);
    page.on('request', request => {
      const target = new URL(request.url());
      if (!['GET', 'HEAD'].includes(request.method())) {
        writes.push({ posture, method: request.method(), url: request.url() });
        return request.abort();
      }
      if (target.protocol.startsWith('http') && target.host !== url.host) return request.abort();
      return request.continue();
    });
    await page.setViewport({ width: 1440, height: 1100 });
    await page.goto(url.href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__OS__ && window.__FOLDAGENT__ && window.__SIM__);
    await page.evaluate(posture => {
      window.__FOLDAGENT__.setPosture(posture);
      window.__OS__.locale.setLocale('zh-Hans');
    }, posture);
    await openPilotApp(page, 'weather', '/');
    await page.waitForSelector(`${app} .weather-home-daily-card`);
    await page.waitForFunction(app => document.querySelector(`${app} #hourly_forecast_stub_inflated_id`)
      ?.getBoundingClientRect().height > 100, {}, app);

    const geometry = await page.$eval(app, (root, posture) => {
      const pageRect = root.getBoundingClientRect();
      const title = root.querySelector('.weather-home-title').getBoundingClientRect();
      const temperature = root.querySelector('.weather-home-temperature').getBoundingClientRect();
      const hourly = root.querySelector('#hourly_forecast_stub_inflated_id').getBoundingClientRect();
      const daily = root.querySelector('.weather-home-daily').getBoundingClientRect();
      const chart = root.querySelector('.weather-home-daily-chart');
      const list = root.querySelector('.weather-home-daily-list');
      return {
        titleCenterDelta: Math.abs((title.left + title.width / 2) - (pageRect.left + pageRect.width / 2)),
        temperatureCenterDelta: Math.abs((temperature.left + temperature.width / 2) - (pageRect.left + pageRect.width / 2)),
        hourlyTop: hourly.top,
        dailyTop: daily.top,
        addControl: Boolean(root.querySelector('#activity_main_add_city')),
        chartVisible: getComputedStyle(chart).display !== 'none',
        listVisible: getComputedStyle(list).display !== 'none',
        columns: chart.querySelectorAll('.weather-home-daily-column').length,
        rows: list.querySelectorAll('.weather-home-daily-row').length,
        posture,
      };
    }, posture);
    assert.ok(geometry.titleCenterDelta <= 18);
    assert.ok(geometry.temperatureCenterDelta <= 4);
    assert.ok(geometry.hourlyTop < geometry.dailyTop);
    assert.equal(geometry.addControl, false);
    assert.equal(geometry.columns, 5);
    assert.equal(geometry.rows, 5);
    assert.equal(geometry.chartVisible, true, 'The recorded default is chart mode in both postures');
    assert.equal(geometry.listVisible, false, 'List mode is a user choice, not an unfolded-only layout');
    await page.screenshot({ path: path.join(output, `${posture}-home.png`) });

    await page.click(`${app} .weather-home-title`);
    await page.waitForFunction(() => window.__OS__.getAppRoute('weather').path === '/cities');
    await page.evaluate(() => window.__OS__.handleBack());
    await page.waitForFunction(() => window.__OS__.getAppRoute('weather').path === '/');

    await page.$eval(`${app} [data-scroll-container="main"]`, element => { element.scrollTop = 540; });
    await page.waitForFunction(app => Number.parseFloat(getComputedStyle(
      document.querySelector(`${app} .weather-home-title-summary`),
    ).opacity) > .5, {}, app);
    const scrollBefore = await page.$eval(`${app} [data-scroll-container="main"]`, element => element.scrollTop);
    const nextPosture = posture === 'folded' ? 'unfolded' : 'folded';
    await page.evaluate(nextPosture => window.__FOLDAGENT__.setPosture(nextPosture), nextPosture);
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 650)));
    assert.equal(await page.evaluate(() => window.__OS__.getAppRoute('weather').path), '/');
    assert.ok(await page.$eval(`${app} [data-scroll-container="main"]`, element => element.scrollTop) >= Math.min(100, scrollBefore));
    await page.evaluate(posture => window.__FOLDAGENT__.setPosture(posture), posture);
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 650)));

    await page.$eval(`${app} .weather-home-daily-more`, button => button.click());
    await page.waitForFunction(() => window.__OS__.getAppRoute('weather').path.startsWith('/forecast/daily'));
    const forecastWidth = await page.$eval(`${app} > div`, element => element.getBoundingClientRect().width);
    const appWidth = await page.$eval(app, element => element.getBoundingClientRect().width);
    assert.ok(forecastWidth >= appWidth * .98);
    checks.push(`${posture}: centered recorded hero, hourly-before-daily hierarchy, five-day responsive forecast, city-title entry, collapse and posture continuity`);
    await context.close();
  }

  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ passed: true, checks, errors, writes }, null, 2));
  console.log(JSON.stringify({ passed: true, output, checks }));
} catch (error) {
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ passed: false, checks, errors, writes, failure: String(error) }, null, 2));
  console.error(output);
  throw error;
} finally {
  await browser.close();
}