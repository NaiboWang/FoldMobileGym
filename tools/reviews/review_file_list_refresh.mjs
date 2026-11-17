// Disposable simulator profiles and generated SVGs only; no private media or real sends.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const root = path.resolve(import.meta.dirname, '../..');
const frontend = ['foldmobilegym', 'mobilegym'].find(name => fs.existsSync(path.join(root, name, 'package.json')));
const require = createRequire(path.join(root, frontend, 'package.json'));
const executablePath = process.env.FOLDAGENT_BROWSER_PATH || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium'].find(fs.existsSync);
assert.ok(executablePath);
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3454/');
assert.ok(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname) && !url.username && !url.password);
fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
const output = fs.mkdtempSync(path.join(root, 'artifacts/file-list-refresh-'));
const browser = await require('puppeteer').launch({ headless: true, executablePath });
const checks = [], failures = [];
const app = '[data-app-id="file_manager"]';
const image = id => `${app} [data-file-image-node-id="${id}"]`;
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="red"/></svg>';
const write = (page, file, bytes = svg) => page.evaluate(async ({ file, svg }) => {
  const node = await window.__SIM_FS__.write(file, svg, { mimeType: 'image/svg+xml' });
  await window.__SIM_FS__.setMetadata(file, { modifiedAt: 2000000000000 });
  return { id: node.id, path: node.path };
}, { file, svg: bytes });
const present = (page, id) => page.waitForSelector(image(id), { timeout: 2500 });
const absent = (page, id) => page.waitForFunction(selector => !document.querySelector(selector), { timeout: 2500 }, image(id));
try {
  for (const posture of ['folded', 'unfolded']) for (const locale of ['zh-Hans', 'en']) for (const kind of ['folder', 'browse', 'recent', 'category', 'split']) {
    const name = `${posture}-${locale}-${kind}`, context = await browser.createBrowserContext(), page = await context.newPage(), errors = [], writes = [];
    try {
      page.on('pageerror', error => errors.push(error.message));
      await page.setRequestInterception(true);
      page.on('request', request => { const target = new URL(request.url()); if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.method()); if ((target.origin === url.origin && ['GET', 'HEAD'].includes(request.method())) || ['data:', 'blob:'].includes(target.protocol)) request.continue(); else request.abort(); });
      await page.setViewport({ width: 1440, height: 1100 });
      await page.goto(url.href, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__OS__ && window.__SIM_FS__ && window.__FOLDAGENT__);
      const base = kind === 'browse' ? '/sdcard' : '/sdcard/list-live-synthetic';
      const initial = await write(page, `${base}/live-a.svg`);
      const route = kind === 'folder' || kind === 'split' ? '/folder?path=' + encodeURIComponent(base) : kind === 'recent' ? '/recent' : kind === 'category' ? '/category/images' : '/';
      await page.evaluate(({ route, posture, locale }) => { window.__FOLDAGENT__.setPosture(posture); window.__OS__.locale.setLocale(locale); window.__OS__.openApp('file_manager', route); }, { route, posture, locale });
      await present(page, initial.id);
      let splitTarget;
      if (kind === 'split') {
        const source = await page.evaluate(() => window.__OS__.getState().activeTaskId);
        await page.evaluate(() => window.__OS__.openApp('calculator', '/'));
        await page.waitForFunction(source => window.__OS__.getState().activeTaskId !== source, {}, source);
        splitTarget = await page.evaluate(() => window.__OS__.getState().activeTaskId);
        await page.evaluate(({ source, target }) => window.__FOLDAGENT__.setMultiWindow('split', source, target, .5), { source, target: splitTarget });
        await page.waitForFunction(selector => document.querySelector(selector)?.checkVisibility(), {}, image(initial.id));
      }
      const added = await write(page, `${base}/live-b.svg`);
      await present(page, added.id);
      if (kind !== 'category') {
        const larger = svg.replace('</svg>', ' '.repeat(4096 - svg.length) + '</svg>');
        assert.equal(larger.length, 4096);
        const rewritten = await write(page, added.path, larger); assert.equal(rewritten.id, added.id);
        await page.waitForFunction(selector => document.querySelector(selector)?.closest('[data-file-item-id]')?.textContent.includes('4.0 KB'), { timeout: 2500 }, image(added.id));
      }
      if (kind === 'browse' || kind === 'folder') {
        const directory = await page.evaluate(async base => { const node = await window.__SIM_FS__.mkdir(base + '/live-count'); return { id: node.id, path: node.path }; }, base);
        const row = `${app} [data-file-item-id="${directory.id}"]`;
        await page.waitForSelector(row, { timeout: 2500 });
        const suffix = locale === 'en' ? ' items' : '项';
        await page.waitForFunction(({ row, value }) => [...document.querySelectorAll(row + ' span')].some(element => element.textContent === value), { timeout: 2500 }, { row, value: '0' + suffix });
        await page.evaluate(file => window.__SIM_FS__.mkdir(file + '/child'), directory.path);
        await page.waitForFunction(({ row, value }) => [...document.querySelectorAll(row + ' span')].some(element => element.textContent === value), { timeout: 2500 }, { row, value: '1' + suffix });
      }
      const moved = await page.evaluate(async ({ from, to }) => { const node = await window.__SIM_FS__.move(from, to); return node ? { id: node.id, path: node.path } : null; }, { from: added.path, to: `${base}/live-c.svg` });
      assert.ok(moved); assert.equal(moved.id, added.id);
      await page.waitForFunction(({ selector, name }) => { const element = document.querySelector(selector); if (!element) return false; const row = element.closest('[data-file-item-id]'); return row ? row.textContent.includes(name) : element.querySelector('img')?.alt === name; }, { timeout: 2500 }, { selector: image(added.id), name: 'live-c.svg' });
      await page.evaluate(file => window.__SIM_FS__.delete(file), moved.path);
      await absent(page, added.id);
      const replacement = await write(page, moved.path);
      assert.notEqual(replacement.id, added.id); await present(page, replacement.id); await absent(page, added.id);
      if (kind === 'split') {
        assert.equal(await page.evaluate(() => window.__OS__.getState().activeTaskId), splitTarget, 'Read-only updates must not steal focus');
        await page.screenshot({ path: path.join(output, name + '.png') });
      }
      await page.evaluate(() => window.__OS__.openApp('calculator', '/'));
      await page.evaluate(file => window.__SIM_FS__.delete(file), initial.path);
      await page.evaluate(route => window.__OS__.openApp('file_manager', route), route);
      await absent(page, initial.id); await present(page, replacement.id);
      assert.equal(await page.evaluate(() => window.__OS__.getAppRoute('file_manager').path), route);
      assert.equal(await page.evaluate(() => window.scrollY), 0);
      assert.deepEqual(errors, []); assert.deepEqual(writes, []);
      checks.push(name); console.log('PASS', name);
    } catch (error) { failures.push({ name, error: String(error.stack) }); console.error('FAIL', name, String(error)); }
    finally { await context.close(); }
  }
} finally { await browser.close(); fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ passed: !failures.length, checks, failures }, null, 2)); }
console.log(JSON.stringify({ output, checks, failures }));
if (failures.length) process.exitCode = 1;
