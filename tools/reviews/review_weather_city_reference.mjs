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
const output = fs.mkdtempSync(path.join(root, 'artifacts/weather-city-reference-'));
const browser = await require('puppeteer').launch({ headless: true, executablePath: resolveBrowserExecutable() });
const checks = [], errors = [], writes = [];
const app = '[data-app-id="weather"]';

const weatherState = page => page.evaluate(() => {
  const state = window.__SIM__.getState().apps.weather;
  return {
    settings: state.settings,
    savedCities: state.savedCities,
    selectedCityId: state.selectedCityId,
  };
});

const clickButtonText = (page, text) => page.evaluate(({ app, text }) => {
  const button = [...document.querySelectorAll(`${app} button`)]
    .find(item => item.textContent.trim() === text);
  if (!button) throw new Error(`Missing button: ${text}`);
  button.click();
}, { app, text });

const searchForNanjing = async page => {
  await page.click(`${app} #act_find_city_key`);
  await page.type(`${app} #act_find_city_key`, '南京');
  await page.waitForFunction(() => window.__OS__.keyboard.isVisible());
  await page.waitForFunction(app => [...document.querySelectorAll(`${app} .weather-city-result-row`)]
    .some(row => row.textContent.includes('南京')), {}, app);
};

const openNanjingPreview = async page => {
  await page.evaluate(app => {
    const row = [...document.querySelectorAll(`${app} .weather-city-result-row`)]
      .find(item => item.textContent.includes('南京'));
    if (!row) throw new Error('Missing Nanjing result');
    row.click();
  }, app);
  await page.waitForFunction(() => window.__OS__.getAppRoute('weather').path.startsWith('/cities/preview'));
};

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
    await page.waitForFunction(() => window.__OS__ && window.__FOLDAGENT__);
    await page.evaluate(posture => {
      window.__FOLDAGENT__.setPosture(posture);
      window.__OS__.locale.setLocale('zh-Hans');
    }, posture);
    await openPilotApp(page, 'weather', '/cities');
    await page.waitForSelector(`${app} .weather-city-manager`);

    const manager = await page.$eval(`${app} .weather-city-manager`, root => {
      const cards = [...root.querySelectorAll('.weather-city-card')].map(card => card.getBoundingClientRect().toJSON());
      const pageRect = root.getBoundingClientRect();
      const search = root.querySelector('.weather-city-search-entry').getBoundingClientRect();
      return {
        page: pageRect.toJSON(),
        cards,
        background: getComputedStyle(root).backgroundImage,
        title: root.querySelector('h1').textContent.trim(),
        searchBottom: pageRect.bottom - search.bottom,
      };
    });
    assert.equal(manager.title, '管理城市');
    assert.ok(manager.background.includes('linear-gradient'));
    assert.ok(manager.cards.length >= 7);
    assert.ok(manager.cards.every(card => card.width >= manager.page.width * .88));
    assert.ok(manager.searchBottom >= 8 && manager.searchBottom <= 32);
    await page.screenshot({ path: path.join(output, `${posture}-manager.png`) });

    await page.click(`${app} button[aria-label="添加城市"]`);
    await page.waitForFunction(() => window.__OS__.getAppRoute('weather').path === '/cities/search');
    assert.equal(await page.evaluate(() => window.__OS__.keyboard.isVisible()), false);
    const searchState = await page.$eval(`${app} .weather-city-search`, root => {
      const cells = [...root.querySelectorAll('.weather-city-grid button')];
      const field = root.querySelector('.weather-city-search-field').getBoundingClientRect();
      const pageRect = root.getBoundingClientRect();
      return {
        title: root.querySelector('h1').textContent.trim(),
        count: cells.length,
        first: cells[0]?.textContent.trim(),
        fieldBottom: pageRect.bottom - field.bottom,
      };
    });
    assert.deepEqual(searchState, { title: '添加城市', count: 24, first: '当前定位', fieldBottom: 18 });
    await page.screenshot({ path: path.join(output, `${posture}-search.png`) });

    const stateBeforePreview = await weatherState(page);
    await searchForNanjing(page);
    const query = await page.$eval(`${app} #act_find_city_key`, input => input.value);
    assert.equal(query, '南京');

    const nextPosture = posture === 'folded' ? 'unfolded' : 'folded';
    await page.evaluate(nextPosture => window.__FOLDAGENT__.setPosture(nextPosture), nextPosture);
    await page.waitForFunction(posture => window.__FOLDAGENT__.getState().posture === posture, {}, nextPosture);
    assert.equal(await page.$eval(`${app} #act_find_city_key`, input => input.value), '南京');
    assert.equal(await page.evaluate(() => window.__OS__.keyboard.isVisible()), true);
    await page.evaluate(posture => window.__FOLDAGENT__.setPosture(posture), posture);
    await page.waitForFunction(posture => window.__FOLDAGENT__.getState().posture === posture, {}, posture);
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 650)));
    const restoredWidth = await page.$eval(app, root => root.getBoundingClientRect().width);
    assert.equal(restoredWidth >= 600, posture === 'unfolded');

    await page.evaluate(() => window.__OS__.handleBack());
    await page.waitForFunction(() => !window.__OS__.keyboard.isVisible());
    assert.equal(await page.evaluate(() => window.__OS__.getAppRoute('weather').path), '/cities/search');
    assert.equal(await page.$eval(`${app} #act_find_city_key`, input => input.value), '南京');
    await page.screenshot({ path: path.join(output, `${posture}-query.png`) });

    await openNanjingPreview(page);
    await page.waitForSelector(`${app} button`);
    await page.waitForFunction(({ app, width }) => document.querySelector(`${app} > div`)
      .getBoundingClientRect().width >= width * .98, {}, { app, width: restoredWidth });
    const previewWidth = await page.$eval(`${app} > div`, root => root.getBoundingClientRect().width);
    assert.ok(previewWidth >= restoredWidth * .98);
    await clickButtonText(page, '取消');
    await page.waitForFunction(() => window.__OS__.getAppRoute('weather').path === '/cities/search');
    const stateAfterCancel = await weatherState(page);
    assert.deepEqual(stateAfterCancel.settings, stateBeforePreview.settings);
    assert.deepEqual(stateAfterCancel.savedCities, stateBeforePreview.savedCities);
    assert.equal(stateAfterCancel.selectedCityId, stateBeforePreview.selectedCityId);

    await searchForNanjing(page);
    await page.evaluate(() => window.__OS__.handleBack());
    await page.waitForFunction(() => !window.__OS__.keyboard.isVisible());
    await openNanjingPreview(page);
    await page.waitForFunction(({ app, add }) => [...document.querySelectorAll(`${app} button`)]
      .some(button => button.textContent.trim() === add && !button.disabled), {}, { app, add: '添加' });
    await clickButtonText(page, '添加');
    await page.waitForFunction(() => window.__OS__.getAppRoute('weather').path === '/');
    const stateAfterAdd = await weatherState(page);
    assert.equal(stateAfterAdd.selectedCityId, 'nanjing');
    assert.equal(stateAfterAdd.savedCities.filter(city => city.id === 'nanjing').length, 1);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SIM__ && window.__OS__ && window.__FOLDAGENT__);
    const stateAfterReload = await weatherState(page);
    assert.equal(stateAfterReload.selectedCityId, 'nanjing');
    assert.equal(stateAfterReload.savedCities.filter(city => city.id === 'nanjing').length, 1);
    checks.push(`${posture}: full-width manager, 24-cell grid, fold-safe keyboard search, keyboard-first Back, cancel safety, Add and reload persistence`);
    await context.close();
  }

  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__OS__ && window.__FOLDAGENT__);
  await page.evaluate(() => {
    window.__FOLDAGENT__.setPosture('unfolded');
    window.__OS__.locale.setLocale('en');
  });
  await openPilotApp(page, 'weather', '/cities/search');
  await page.waitForSelector(`${app} .weather-city-search`);
  assert.equal(await page.$eval(`${app} .weather-city-search h1`, el => el.textContent.trim()), 'Add City');
  assert.equal(await page.$eval(`${app} .weather-city-grid button`, el => el.textContent.trim()), 'Current Location');
  checks.push('English resources keep the same recorded hierarchy');
  await context.close();

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
