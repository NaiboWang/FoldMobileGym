import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const root = path.resolve(import.meta.dirname, '../..'), front = fs.existsSync(path.join(root, 'mobilegym/package.json')) ? 'mobilegym' : 'foldmobilegym';
const require = createRequire(path.join(root, front, 'package.json'));
const { setBilibiliReviewLocale } = await import(pathToFileURL(path.join(root, front, 'scripts/bilibili_review_locale.mjs')));
const helper = front === 'mobilegym' ? 'foldmobilegym/tools/pilot_app_navigation.mjs' : 'tools/browser-automation/pilot_app_navigation.mjs';
const { openPilotApp: open } = await import(pathToFileURL(path.join(root, helper)));
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3286/');
assert.ok(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname) && !url.username && !url.password);
const baseline = process.env.FOLDAGENT_REVIEW_BASELINE === '1';
const videoId = JSON.parse(fs.readFileSync(path.join(root, front, 'apps/Bilibili/data/videos.json'), 'utf8')).find(video => video.id && video.title).id;
const executablePath = process.env.FOLDAGENT_BROWSER_PATH || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
assert.ok(executablePath);
const browser = await require('puppeteer').launch({ headless: true, executablePath }), checks = [];
const app = '[data-app-id="bilibili"]', sheet = `${app} [data-bili-fav-sheet]`, done = `${app} [data-bili-fav-done]`;
const folders = page => page.evaluate(() => window.__SIM__.getState().apps.bilibili.user.favoritesFolders);
const row = id => `${sheet} [data-bili-fav-folder="${id}"]`;
async function show(page) {
  const handle = await page.waitForSelector(`${app} [data-action="video.intro.fav.toggle"]`, { visible: true });
  await handle.evaluate(node => node.scrollIntoView({ block: 'center' })); await handle.hover(); await page.mouse.down();
  await new Promise(resolve => setTimeout(resolve, 900)); await page.mouse.up();
}
async function complete(page) { await page.click(done); await page.waitForSelector(sheet, { hidden: true }); }
try {
 for (const locale of baseline ? ['en'] : ['zh-Hans', 'en']) for (const posture of baseline ? ['folded'] : ['folded', 'unfolded']) {
  const context = await browser.createBrowserContext(), page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', request => { const u = new URL(request.url()); if (request.method() === 'GET' && (u.origin === url.origin && !/^\/api(?:\/|$)/.test(u.pathname) || ['data:', 'blob:'].includes(u.protocol))) request.continue(); else request.abort(); });
  try {
   await page.setViewport({ width: 1440, height: 1100 }); await page.goto(url.href, { waitUntil: 'domcontentloaded' });
   await page.waitForFunction(() => window.__OS__ && window.__SIM__ && window.__FOLDAGENT__);
   await page.evaluate(({ locale, posture }) => { window.__OS__.locale.setLocale(locale); window.__FOLDAGENT__.setPosture(posture); }, { locale, posture });
   await setBilibiliReviewLocale(page, locale, open);
   await page.evaluate(id => {
    const s = window.__SIM__.getState().apps.bilibili;
    const original = s.user.favoritesFolders.map(folder => ({ ...folder, videoIds: (folder.videoIds || []).filter(video => video !== id) }));
    window.__SIM__.setState({ apps: { bilibili: { user: { ...s.user, favoritesFolders: [...original, { id: 'qa-kept', title: 'Local kept', videoIds: [id, 'qa-unrelated'] }, { id: 'qa-other', title: 'Local other', videoIds: ['qa-unrelated'] }] } } } }, { deep: true, reload: false });
   }, videoId);
   await open(page, 'bilibili', `/video/${encodeURIComponent(videoId)}?tab=intro`);
   const original = await folders(page); await show(page);
   if (baseline) {
    await page.waitForFunction(app => [...document.querySelectorAll(`${app} button`)].some(node => node.checkVisibility() && node.textContent.trim() === '完成'), {}, app);
    await page.evaluate(app => [...document.querySelectorAll(`${app} button`)].find(node => node.checkVisibility() && node.textContent.trim() === '完成').click(), app);
    assert.notDeepEqual(await folders(page), original); checks.push({ baseline: true, unchangedDoneRemovedFavorite: true }); console.log('BASELINE: unchanged Done removed existing favorite'); continue;
   }
   await page.waitForSelector(`${row('qa-kept')}[aria-checked="true"]`, { visible: true }); await complete(page);
   assert.deepEqual(await folders(page), original);
   await show(page); await page.click(row('qa-other'));
   await page.$eval(done, node => { window.__favoriteDone = node; });
   await page.$eval(row('qa-other'), node => { window.__favoriteRow = node; });
   const task = await page.evaluate(() => window.__OS__.getState().activeTaskId);
   await open(page, 'clock', '/alarm'); await page.evaluate(() => { window.__favoriteDone.click(); window.__favoriteRow.click(); }); assert.deepEqual(await folders(page), original);
   await page.evaluate(id => window.__OS__.launchTaskById(id), task); await page.waitForSelector(done, { visible: true });
   assert.equal(await page.$eval(row('qa-other'), node => node.getAttribute('aria-checked')), 'true');
   await complete(page);
   const added = await folders(page); assert.ok(added.find(folder => folder.id === 'qa-other').videoIds.includes(videoId));
   assert.ok(added.find(folder => folder.id === 'qa-kept').videoIds.includes(videoId));
   await show(page); await page.click(row('qa-kept'));
   await page.evaluate(() => { const s = window.__SIM__.getState().apps.bilibili; window.__SIM__.setState({ apps: { bilibili: { user: { ...s.user, favoritesFolders: s.user.favoritesFolders.map(folder => folder.id === 'qa-other' ? { ...folder, title: 'Externally updated' } : folder) } } } }, { deep: true, reload: false }); });
   await page.waitForSelector(`${sheet} [data-bili-fav-conflict]`, { visible: true }); const changed = await folders(page);
   assert.equal(await page.$eval(done, node => node.disabled), true); await page.$eval(done, node => node.click()); assert.deepEqual(await folders(page), changed);
   const box = await (await page.$(sheet)).boundingBox(); await page.mouse.click(box.x + 20, box.y + 100); await page.waitForSelector(sheet, { hidden: true });
   await show(page); await page.waitForSelector(done, { visible: true });
   for (const handle of await page.$$(`${sheet} [role="checkbox"][aria-checked="true"]`)) await handle.click();
   await complete(page); assert.equal((await folders(page)).some(folder => folder.videoIds?.includes(videoId)), false);
   await page.evaluate(() => { const s = window.__SIM__.getState().apps.bilibili; window.__SIM__.setState({ apps: { bilibili: { user: { ...s.user, favoritesFolders: s.user.favoritesFolders.filter(folder => folder.id !== 'fav_default') } } } }, { deep: true, reload: false }); });
   await page.click(`${app} [data-action="video.intro.fav.toggle"]`); await page.waitForSelector(done, { visible: true });
   await page.click(row('qa-kept')); await complete(page); assert.ok((await folders(page)).find(folder => folder.id === 'qa-kept').videoIds.includes(videoId));
   await show(page); await page.click(`${sheet} [data-bili-fav-create]`);
   await page.waitForFunction(() => window.__OS__.getAppRoute('bilibili')?.path === '/fav/create');
   await page.type(`${app} input[placeholder="名称"]`, 'New local folder');
   await page.evaluate(app => { const button = [...document.querySelectorAll(`${app} button`)].find(node => node.checkVisibility() && node.textContent.trim() === '完成'); if (!button || button.disabled) throw Error('Missing create-folder submit'); button.click(); }, app);
   await page.waitForSelector(done, { visible: true });
   const created = await folders(page), newId = created[0].id;
   assert.equal(created[0].title, 'New local folder'); assert.deepEqual(created[0].videoIds, []);
   assert.equal(await page.$eval(row(newId), node => node.getAttribute('aria-checked')), 'true');
   assert.equal(await page.$eval(row('qa-kept'), node => node.getAttribute('aria-checked')), 'true');
   await complete(page); assert.ok((await folders(page)).find(folder => folder.id === newId).videoIds.includes(videoId));
   const savedFolders = await folders(page);
   await open(page, 'bilibili', '/following');
   await page.evaluate(() => { const s = window.__SIM__.getState().apps.bilibili; window.__SIM__.setState({ apps: { bilibili: { user: { ...s.user, followingList: [], following: 0 } } } }, { deep: true, reload: false }); });
   const follow = `${app} [data-action="following.recommendUp.follow.toggle"]`;
   await page.waitForSelector(follow, { visible: true }); await page.$eval(follow, node => { window.__follow = node; });
   await open(page, 'clock', '/alarm'); await page.evaluate(() => window.__follow.click());
   assert.deepEqual(await page.evaluate(() => window.__SIM__.getState().apps.bilibili.user.followingList), []);
   await page.evaluate(id => window.__OS__.launchTaskById(id), task); await open(page, 'bilibili', '/me');
   await page.evaluate(() => window.__follow.click());
   assert.deepEqual(await page.evaluate(() => window.__SIM__.getState().apps.bilibili.user.followingList), []);
   await open(page, 'bilibili', '/following'); await page.waitForSelector(follow, { visible: true });
   const mid = await page.$eval(follow, node => JSON.parse(node.dataset.actionParams).mid);
   await page.$eval(follow, node => { node.click(); node.click(); });
   const followed = await page.evaluate(() => window.__SIM__.getState().apps.bilibili.user.followingList);
   assert.equal(followed.length, 1); assert.equal(String(followed[0].mid), mid); assert.deepEqual(await folders(page), savedFolders);
   assert.deepEqual(errors, []); checks.push({ locale, posture, unchangedMembership: true, background: true, conflict: true, reopen: true, explicitRemoval: true, noDefaultFolder: true, createReturn: true, followOwner: true }); console.log('PASS', locale, posture);
  } finally { await context.close(); }
 }
} finally { await browser.close(); }
console.log(JSON.stringify({ passed: true, baseline, checks }));
