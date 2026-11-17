import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { openPilotApp } from '../../tools/browser-automation/pilot_app_navigation.mjs';
import { resolveBrowserExecutable } from '../../tools/browser-automation/browser.mjs';
import { setBilibiliReviewLocale } from './bilibili_review_locale.mjs';
const require = createRequire(new URL('../package.json', import.meta.url));
const catalog = JSON.parse(await readFile(new URL('../apps/Bilibili/data/videos.json', import.meta.url), 'utf8'));
const [first, second] = catalog.filter(video => video.id && video.title).slice(0, 2);
assert.ok(first && second && first.id !== second.id);
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3216/');
assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname) && !url.username && !url.password);
const browser = await require('puppeteer').launch({ headless: true, executablePath: resolveBrowserExecutable() });
try {
 for (const locale of ['zh-Hans', 'en']) for (const posture of ['folded', 'unfolded']) {
  const context = await browser.createBrowserContext(), page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', request => { const target = new URL(request.url()); if (request.method() !== 'GET' || (target.origin !== url.origin && !['data:', 'blob:'].includes(target.protocol)) || target.pathname.startsWith('/api/')) return request.abort(); return request.continue(); });
  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__OS__ && window.__SIM__ && window.__FOLDAGENT__);
  await page.evaluate(value => window.__FOLDAGENT__.setPosture(value), posture);
  await setBilibiliReviewLocale(page, locale, openPilotApp);
  await openPilotApp(page, 'bilibili', '/me');
  const folder = { id: 'fold-review-synthetic', title: 'Synthetic review folder', isPublic: false, videoIds: [second.id, 'fold-missing-video', first.id] };
  await page.evaluate(folder => window.__SIM__.setState({ apps: { bilibili: { user: { favoritesFolders: [folder] } } } }, { deep: true }), folder);
  for (const prefix of ['/favorites/folder/', '/profile/fav/']) {
   await openPilotApp(page, 'bilibili', prefix + folder.id);
   await page.waitForFunction(title => [...document.querySelectorAll('[data-app-id="bilibili"] h1')].some(node => node.checkVisibility() && node.textContent === title), {}, folder.title);
   const rows = await page.$$eval('[data-app-id="bilibili"] [data-favorite-entry-id]', nodes => nodes.filter(node => node.checkVisibility()).map(node => ({ id: node.getAttribute('data-favorite-entry-id'), text: node.textContent })));
   assert.deepEqual(rows.map(row => row.id), folder.videoIds);
   assert.match(rows[1].text, locale === 'en' ? /unavailable/i : /不可用/);
   assert.ok(rows[0].text.includes(second.title)); assert.ok(rows[2].text.includes(first.title));
   const content = await page.$eval('[data-app-id="bilibili"]', node => node.innerText);
   assert.match(content, locale === 'en' ? /3 items/ : /3个内容/);
   await page.$eval('[data-favorite-entry-id="fold-missing-video"]', node => node.click());
   assert.equal(await page.evaluate(() => window.__OS__.getAppRoute('bilibili').path), prefix + folder.id);
   await page.$eval(`[data-favorite-entry-id="${second.id}"]`, node => node.click());
   await page.waitForFunction(id => window.__OS__.getAppRoute('bilibili').path.startsWith('/video/' + id), {}, second.id);
   await page.evaluate(() => window.__OS__.handleBack());
   await page.waitForFunction(route => window.__OS__.getAppRoute('bilibili').path === route, {}, prefix + folder.id);
  }
  assert.deepEqual((await page.evaluate(() => window.__SIM__.getState().apps.bilibili.user.favoritesFolders))[0].videoIds, folder.videoIds);
  const onlyMissing = { ...folder, videoIds: ['fold-missing-video'] };
  await page.evaluate(folder => window.__SIM__.setState({ apps: { bilibili: { user: { favoritesFolders: [folder] } } } }, { deep: true }), onlyMissing);
  for (const prefix of ['/favorites/folder/', '/profile/fav/']) {
   await openPilotApp(page, 'bilibili', prefix + folder.id);
   await page.waitForFunction(() => [...document.querySelectorAll('[data-favorite-entry-id]')].filter(node => node.checkVisibility()).length === 1);
   const content = await page.$eval('[data-app-id="bilibili"]', node => node.innerText);
   assert.match(content, locale === 'en' ? /1 item/ : /1个内容/);
   assert.doesNotMatch(content, locale === 'en' ? /folder is empty/i : /收藏夹为空/);
   if (prefix === '/profile/fav/') assert.equal(await page.$eval('[data-app-id="bilibili"] button:disabled', node => node.disabled), true);
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ locale, posture, orderedEntries: 3, missingPlaceholder: true }));
  await context.close();
 }
} finally { await browser.close(); }
