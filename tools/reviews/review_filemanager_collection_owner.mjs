import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const root = path.resolve(import.meta.dirname, '../..'), front = fs.existsSync(path.join(root, 'mobilegym/package.json')) ? 'mobilegym' : 'foldmobilegym';
const require = createRequire(path.join(root, front, 'package.json'));
const { openPilotApp: open } = await import(pathToFileURL(path.join(root, front === 'mobilegym' ? 'foldmobilegym/tools/pilot_app_navigation.mjs' : 'tools/browser-automation/pilot_app_navigation.mjs')));
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3286/');
assert.ok(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname) && !url.username && !url.password);
const baseline = process.env.FOLDAGENT_REVIEW_BASELINE === '1';
const executablePath = process.env.FOLDAGENT_BROWSER_PATH || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
assert.ok(executablePath);
const browser = await require('puppeteer').launch({ headless: true, executablePath }), checks = [];
const app = '[data-app-id="file_manager"]', originalPath = '/sdcard/collection-owner/source.txt', movedPath = '/sdcard/collection-owner/moved/source.txt', payload = 'Local collection payload';
const prefs = page => page.evaluate(() => { const s = window.__SIM__.getState().apps.file_manager; return { paths: s.favoritePaths, ids: s.favoriteIds, privateIds: s.privateIds }; });
const tick = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
try {
 for (const section of ['favorites', 'private']) for (const locale of baseline ? ['zh-Hans'] : ['zh-Hans', 'en']) for (const posture of baseline ? ['folded'] : ['folded', 'unfolded']) {
  const context = await browser.createBrowserContext(), page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message)); await page.setRequestInterception(true);
  page.on('request', request => { const u = new URL(request.url()); if (request.method() === 'GET' && (u.origin === url.origin && !/^\/api(?:\/|$)/.test(u.pathname) || ['data:', 'blob:'].includes(u.protocol))) request.continue(); else request.abort(); });
  try {
   await page.setViewport({ width: 1440, height: 1100 }); await page.goto(url.href, { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => window.__OS__ && window.__SIM__ && window.__SIM_FS__ && window.__FOLDAGENT__);
   await page.evaluate(({ locale, posture }) => { window.__OS__.locale.setLocale(locale); window.__FOLDAGENT__.setPosture(posture); }, { locale, posture });
   await open(page, 'file_manager', `/${section}`);
   const id = await page.evaluate(async ({ originalPath, payload }) => {
    await window.__SIM_FS__.write(originalPath, payload, { mimeType: 'text/plain' }); const file = window.__SIM_FS__.stat(originalPath);
    window.__SIM__.setState({ apps: { file_manager: { favoritePaths: [originalPath], favoriteIds: { [originalPath]: file.id }, privateIds: [file.id] } } }, { deep: true, reload: false }); return file.id;
   }, { originalPath, payload });
   const label = section === 'favorites' ? (locale === 'en' ? 'Remove favorite' : '取消收藏') : (locale === 'en' ? 'Remove from private' : '取消私密');
   const remove = `${app} button[aria-label="${label}"]`;
   await page.waitForSelector(remove, { visible: true }); await page.$eval(remove, node => { window.__collectionRemove = node; });
   const before = await prefs(page), task = await page.evaluate(() => window.__OS__.getState().activeTaskId);
   if (!baseline) await page.$eval(`${app} [data-file-collection-open]`, node => { window.__collectionOpen = node; });
   await open(page, 'clock', '/alarm'); await page.evaluate(() => window.__collectionRemove.click()); await tick(page);
   if (baseline) { assert.notDeepEqual(await prefs(page), before); checks.push({ section, backgroundMutation: true }); console.log('BASELINE', section, 'association removed from Clock'); continue; }
   await page.evaluate(() => window.__collectionOpen.click()); await tick(page); assert.deepEqual(await prefs(page), before);
   assert.equal(await page.evaluate(() => window.__OS__.getAppRoute('file_manager').path), `/${section}`);
   await page.evaluate(id => window.__OS__.launchTaskById(id), task); await page.waitForSelector(remove, { visible: true });
   for (const surface of ['home', 'recents']) {
    await page.evaluate(surface => surface === 'home' ? window.__OS__.goHome() : window.__OS__.showRecents(), surface);
    await page.evaluate(() => { window.__collectionRemove.click(); window.__collectionOpen.click(); }); await tick(page); assert.deepEqual(await prefs(page), before);
    await page.evaluate(id => window.__OS__.launchTaskById(id), task); await page.waitForSelector(remove, { visible: true });
   }
   await page.evaluate(async ({ originalPath, movedPath }) => { const moved = await window.__SIM_FS__.move(originalPath, movedPath); if (!moved) throw Error('Virtual move failed'); }, { originalPath, movedPath });
   await page.waitForFunction(({ app, movedPath }) => document.querySelector(app).innerText.includes(movedPath), {}, { app, movedPath });
   assert.equal(await page.evaluate(path => window.__SIM_FS__.stat(path).id, movedPath), id);
   await page.$eval(`${app} [data-file-collection-open]`, node => { window.__collectionOpen = node; });
   await page.$eval(remove, node => { window.__collectionRemove = node; });
   await open(page, 'clock', '/alarm'); const clock = await page.evaluate(() => window.__OS__.getState().activeTaskId);
   await page.evaluate(({ task, clock, posture }) => { window.__FOLDAGENT__.setPosture('unfolded'); window.__FOLDAGENT__.setMultiWindow('split', task, clock, .5); window.__FOLDAGENT__.setPosture(posture); }, { task, clock, posture });
   await page.focus('[data-app-id="clock"] .clock-alarm-add'); await page.waitForFunction(() => window.__OS__.getState().activeAppId === 'clock');
   await page.evaluate(() => { window.__collectionRemove.click(); window.__collectionOpen.click(); }); await tick(page);
   assert.deepEqual(await prefs(page), before); assert.equal(await page.evaluate(() => window.__OS__.getAppRoute('file_manager').path), `/${section}`);
   await page.evaluate(id => window.__OS__.launchTaskById(id), task);
   await page.waitForSelector(`${app} [data-file-collection-open]`, { visible: true });
   await page.click(`${app} [data-file-collection-open]`);
   await page.waitForFunction(({ app, payload }) => [...document.querySelectorAll(`${app} [data-file-preview-state="ready"]`)].some(node => node.textContent.includes(payload)), {}, { app, payload });
   assert.equal(await page.evaluate(() => window.__OS__.getAppRoute('file_manager').path), `/text?path=${encodeURIComponent(movedPath)}`);
   await page.evaluate(() => window.__OS__.handleBack()); await page.waitForFunction(section => window.__OS__.getAppRoute('file_manager').path === `/${section}`, {}, section);
   await page.waitForSelector(remove, { visible: true }); await page.click(remove); await tick(page);
   const after = await prefs(page);
   if (section === 'favorites') { assert.deepEqual(after.paths, []); assert.deepEqual(after.ids, {}); assert.deepEqual(after.privateIds, [id]); }
   else { assert.deepEqual(after.privateIds, []); assert.deepEqual(after.paths, before.paths); assert.deepEqual(after.ids, before.ids); }
   assert.equal(await page.evaluate(async path => (await window.__SIM_FS__.read(path)).text(), movedPath), payload);
   assert.equal(await page.evaluate(path => window.__SIM_FS__.stat(path).id, movedPath), id);
   const compactBack = `${app} .fm-compact-toolbar [data-trigger="rail.browse.open"]`;
   const compactVisible = await page.$eval(compactBack, node => node.checkVisibility());
   if (posture === 'folded') assert.ok(compactVisible, 'Folded collection must expose its return control');
   if (compactVisible) {
    const metrics = await page.$eval(`${app} [data-scroll-container="main"]`, node => ({ height: node.clientHeight, scrollHeight: node.scrollHeight }));
    assert.ok(metrics.scrollHeight <= metrics.height + 2, `Empty collection scrolls unnecessarily: ${JSON.stringify(metrics)}`);
    await page.click(compactBack);
    await page.waitForFunction(() => window.__OS__.getState().activeAppId === 'file_manager' && window.__OS__.getAppRoute('file_manager').path === '/');
   }
   assert.deepEqual(errors, []); checks.push({ section, locale, posture, background: true, home: true, recents: true, splitFocus: true, movedIdentity: true, openedAndBack: true, removedAssociationOnly: true }); console.log('PASS', section, locale, posture);
  } catch (error) {
   console.error(JSON.stringify(await page.evaluate(() => {
    const node = document.querySelector('[data-app-id="file_manager"] [data-file-collection-open]'), r = node?.getBoundingClientRect();
    const target = r && document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { active: window.__OS__?.getState().activeAppId, route: window.__OS__?.getAppRoute('file_manager'), openRect: r?.toJSON(), hit: target?.tagName, hitApp: target?.closest('[data-app-id]')?.getAttribute('data-app-id'), preview: [...document.querySelectorAll('[data-file-preview-state]')].map(e => e.getAttribute('data-file-preview-state')) };
   }).catch(() => null))); throw error;
  } finally { await context.close(); }
 }
} finally { await browser.close(); }
console.log(JSON.stringify({ passed: true, baseline, checks }));
