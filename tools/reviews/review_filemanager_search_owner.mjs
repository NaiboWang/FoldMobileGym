import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '../..');
const front = fs.existsSync(path.join(root, 'mobilegym/package.json')) ? 'mobilegym' : 'foldmobilegym';
const require = createRequire(path.join(root, front, 'package.json'));
const helper = front === 'mobilegym' ? 'foldmobilegym/tools/pilot_app_navigation.mjs' : 'tools/browser-automation/pilot_app_navigation.mjs';
const { openPilotApp } = await import(pathToFileURL(path.join(root, helper)));
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3286/');
assert.ok(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname) && !url.username && !url.password);
const executablePath = process.env.FOLDAGENT_BROWSER_PATH || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
assert.ok(executablePath);
const browser = await require('puppeteer').launch({ headless: true, executablePath });
const source = '/sdcard/QA-search-owner/probe.txt', route = '/search?q=probe.txt';
try {
  for (const posture of ['folded', 'unfolded']) for (const locale of ['zh-Hans', 'en']) {
    const context = await browser.createBrowserContext(), page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request', request => {
      const u = new URL(request.url());
      if (request.method() === 'GET' && (u.origin === url.origin && !/^\/api(?:\/|$)/.test(u.pathname) || ['data:', 'blob:'].includes(u.protocol))) request.continue();
      else request.abort();
    });
    try {
      await page.setViewport({ width: 1440, height: 1100 });
      await page.goto(url.href, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__OS__ && window.__SIM_FS__ && window.__FOLDAGENT__);
      const originalId = await page.evaluate(async ({ posture, locale, source }) => {
        window.__FOLDAGENT__.setPosture(posture); window.__OS__.locale.setLocale(locale);
        await window.__SIM_FS__.write(source, 'original payload', { mimeType: 'text/plain' });
        return window.__SIM_FS__.stat(source).id;
      }, { posture, locale, source });
      await openPilotApp(page, 'file_manager', route);
      const row = `[data-app-id="file_manager"] .fm-search-result[title="${source}"]`;
      await page.waitForSelector(row, { visible: true });
      const task = await page.evaluate(() => window.__OS__.getState().activeTaskId);
      await page.$eval(row, node => { window.__qaSearchRow = node; });
      await openPilotApp(page, 'clock', '/alarm');
      await page.evaluate(() => window.__qaSearchRow.click());
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await page.evaluate(() => window.__OS__.getAppRoute('file_manager').path), route, 'Background click changed search route');
      assert.equal(await page.evaluate(() => window.__OS__.getState().activeAppId), 'clock');
      const clock = await page.evaluate(() => window.__OS__.getState().activeTaskId);
      await page.evaluate(({ task, clock, posture }) => {
        window.__FOLDAGENT__.setPosture('unfolded');
        window.__FOLDAGENT__.setMultiWindow('split', task, clock, .5);
        window.__FOLDAGENT__.setPosture(posture);
      }, { task, clock, posture });
      await page.focus('[data-app-id="clock"] .clock-alarm-add');
      await page.waitForFunction(() => window.__OS__.getState().activeAppId === 'clock');
      await page.evaluate(() => window.__qaSearchRow.click());
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await page.evaluate(() => window.__OS__.getAppRoute('file_manager').path), route, 'Unfocused split click changed search route');
      await page.evaluate(id => window.__OS__.launchTaskById(id), task);
      await page.waitForSelector(row, { visible: true });
      await page.$eval(row, node => { window.__qaSearchRow = node; });
      const replacementId = await page.evaluate(async source => {
        await window.__SIM_FS__.delete(source);
        await window.__SIM_FS__.write(source, 'replacement payload', { mimeType: 'text/plain' });
        const id = window.__SIM_FS__.stat(source).id;
        window.__qaSearchRow.click();
        return id;
      }, source);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.notEqual(replacementId, originalId);
      assert.equal(await page.evaluate(() => window.__OS__.getAppRoute('file_manager').path), route, 'Old row opened a replacement file');
      await page.waitForFunction(selector => {
        const node = document.querySelector(selector);
        return node && node !== window.__qaSearchRow && node.checkVisibility();
      }, { timeout: 10000 }, row);
      await page.click(row);
      await page.waitForFunction(source => window.__OS__.getAppRoute('file_manager').path === `/text?path=${encodeURIComponent(source)}`, {}, source);
      await page.waitForFunction(() => [...document.querySelectorAll('[data-app-id="file_manager"] [data-file-preview-state="ready"]')].some(node => node.textContent.includes('replacement payload')));
      assert.deepEqual(errors, []);
      console.log('PASS', posture, locale);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
