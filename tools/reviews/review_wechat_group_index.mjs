// Isolated simulator data only. No account, messages, API or external requests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const root = path.resolve(import.meta.dirname, '../..');
const frontend = ['mobilegym', 'foldmobilegym'].find(name => fs.existsSync(path.join(root, name, 'package.json')));
const require = createRequire(path.join(root, frontend, 'package.json'));
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3286/');
assert.ok(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname) && !url.username && !url.password);
const executablePath = process.env.FOLDAGENT_BROWSER_PATH || [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find(fs.existsSync);
assert.ok(executablePath);
const baseline = process.env.FOLDAGENT_REVIEW_BASELINE === '1';
const browser = await require('puppeteer').launch({ headless: true, executablePath });
const app = '[data-app-id="wechat"]';
const index = `${app} [data-start-group-index]`;
const list = `${app} .wechat-start-group [data-scroll-container="main"]`;
const checks = [];
const tick = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const selectApp = async (page, id, route) => {
  await page.evaluate(({ id, route }) => window.__OS__.openApp(id, route), { id, route });
  await tick(page);
  await page.waitForFunction(({ id, route }) => window.__OS__.getState().activeAppId === id && window.__OS__.getAppRoute(id)?.path === route, {}, { id, route });
  await page.waitForSelector(`[data-app-id="${id}"]`, { visible: true });
};
try {
  for (const viewport of baseline ? [{ width: 1440, height: 1100 }] : [{ width: 1440, height: 1100 }, { width: 1000, height: 700 }]) {
    for (const locale of baseline ? ['en'] : ['zh-Hans', 'en']) for (const posture of baseline ? ['unfolded'] : ['folded', 'unfolded']) {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.setRequestInterception(true);
      page.on('request', request => {
        const target = new URL(request.url());
        if (request.method() === 'GET' && ((target.origin === url.origin && !/^\/api(?:\/|$)/.test(target.pathname)) || ['data:', 'blob:'].includes(target.protocol))) request.continue();
        else request.abort();
      });
      try {
        await page.setViewport(viewport);
        await page.goto(url.href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__OS__ && window.__SIM__ && window.__FOLDAGENT__);
        await page.evaluate(({ locale, posture }) => {
          window.__OS__.locale.setLocale(locale);
          window.__FOLDAGENT__.setPosture(posture);
        }, { locale, posture });
        await selectApp(page, 'wechat', '/start-group');
        await page.waitForSelector(`${app} [data-action="startGroup.create.submit"]`, { visible: true });
        if (baseline) {
          assert.equal(await page.$$(index).then(nodes => nodes.length), 0, 'Baseline must reproduce the decorative-only rail');
          console.log('BASELINE: picker has no operable index controls');
          continue;
        }
        await page.evaluate(() => {
          const state = window.__SIM__.getState().apps.wechat;
          const contacts = [];
          for (const category of ['A', 'B', 'M', 'Z', '#']) for (let i = 0; i < 18; i++) contacts.push({
            ...state.contacts[0], wxid: `synthetic-index-${category}-${i}`, name: `Synthetic ${category} ${i}`,
            category, avatar: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40"%3E%3Crect width="40" height="40" fill="%23bfd7f5"/%3E%3C/svg%3E', isBlacklisted: false,
          });
          contacts.push({ ...contacts[0], wxid: 'synthetic-blocked', name: 'Hidden C', category: 'C', isBlacklisted: true });
          window.__SIM__.setState({ apps: { wechat: { contacts } } }, { deep: true, reload: false });
        });
        await page.waitForSelector(`${app} [data-start-group-index="Z"]:not(:disabled)`, { visible: true });
        assert.equal(await page.$eval(`${app} [data-start-group-index="C"]`, node => node.disabled), true);
        assert.equal(await page.$eval(`${app} [data-start-group-index="D"]`, node => node.disabled), true);
        const before = await page.evaluate(() => JSON.stringify(window.__SIM__.getState().apps.wechat));
        // Keep an unrelated master scroller at a nonzero offset and make sure it is not targeted.
        const masterBefore = await page.$$eval(`${app} [data-scroll-container="main"]`, nodes => nodes.map(node => node.scrollTop));
        await page.click(`${app} [data-start-group-index="M"]`);
        await tick(page);
        const geometry = await page.$eval(list, node => {
          const section = node.querySelector('[data-start-group-section="M"]');
          const bounds = node.getBoundingClientRect();
          const scale = bounds.height / parseFloat(getComputedStyle(node).height);
          return { scroll: node.scrollTop, difference: Math.abs(section.getBoundingClientRect().top - bounds.top) / scale };
        });
        assert.ok(geometry.scroll > 300, `index must scroll its actual list: ${JSON.stringify(geometry)}`);
        assert.ok(geometry.difference < 2, `scaled category alignment: ${JSON.stringify(geometry)}`);
        const masterAfter = await page.$$eval(`${app} [data-scroll-container="main"]`, nodes => nodes.map(node => node.scrollTop));
        assert.deepEqual(masterAfter.slice(0, -1), masterBefore.slice(0, -1));
        await page.$eval(`${app} [data-start-group-index="top"]`, node => { window.__retainedGroupIndex = node; });
        await selectApp(page, 'clock', '/alarm');
        const hiddenOffset = await page.$eval(list, node => node.scrollTop);
        await page.evaluate(() => window.__retainedGroupIndex.click());
        await tick(page);
        const backgroundOffset = await page.$eval(list, node => node.scrollTop);
        assert.equal(backgroundOffset, hiddenOffset, 'background retained callback must not scroll');
        await page.evaluate(() => window.__OS__.openApp('wechat'));
        await tick(page);
        await page.waitForSelector(`${app} [data-start-group-index="top"]`, { visible: true });
        assert.ok(Math.abs((await page.$eval(list, node => node.scrollTop)) - geometry.scroll) < 2, 'background callback must not change the retained scroll offset');
        await page.click(`${app} [data-start-group-index="top"]`);
        await tick(page);
        assert.equal(await page.$eval(list, node => node.scrollTop), 0);
        const search = `${app} [data-action="startGroup.search.input"]`;
        await page.click(search);
        await page.keyboard.type('Synthetic Z');
        await page.waitForFunction(app => document.querySelector(`${app} [data-start-group-index="A"]`)?.disabled, {}, app);
        assert.equal(await page.$eval(`${app} [data-start-group-index="Z"]`, node => node.disabled), false);
        await page.evaluate(() => window.__OS__.handleBack());
        await tick(page);
        await page.click(`${app} [data-start-group-index="Z"]`);
        await tick(page);
        assert.equal(await page.$eval(`${app} [data-action="startGroup.create.submit"]`, node => node.disabled), true);
        assert.equal(await page.evaluate(() => JSON.stringify(window.__SIM__.getState().apps.wechat)), before, 'navigation must not select contacts, create groups or modify source data');
        assert.deepEqual(errors, []);
        checks.push({ viewport, locale, posture, aligned: true, backgroundGuard: true, search: true, unchangedData: true });
        console.log('PASS', viewport.width, viewport.height, locale, posture);
      } finally { await context.close(); }
    }
  }
} finally { await browser.close(); }
if (!baseline) console.log(JSON.stringify({ passed: true, checks }));
