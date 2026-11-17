import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const root = path.resolve(import.meta.dirname, '../..');
const front = fs.existsSync(path.join(root, 'mobilegym/package.json')) ? 'mobilegym' : 'foldmobilegym';
const require = createRequire(path.join(root, front, 'package.json'));
const { setBilibiliReviewLocale } = await import(pathToFileURL(path.join(root, front, 'scripts/bilibili_review_locale.mjs')));
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3286/');
assert.ok(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname) && !url.username && !url.password);
const baseline = process.env.FOLDAGENT_REVIEW_BASELINE === '1';
const executablePath = process.env.FOLDAGENT_BROWSER_PATH || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
assert.ok(executablePath);
const browser = await require('puppeteer').launch({ headless: true, executablePath });
const button = id => `[data-app-id="bilibili"] [data-action="history.item.remove"][data-action-params='${JSON.stringify({ videoId: id })}']`;
const facts = page => page.evaluate(() => {
  const user = window.__SIM__.getState().apps.bilibili.user;
  return { ids: user.videoHistory, times: user.videoHistorySeenAt, folders: user.favoritesFolders };
});
const tick = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function open(page, id, route) {
  await page.evaluate(({ id, route }) => window.__OS__.openApp(id, route), { id, route });
  await tick(page);
  await page.waitForFunction(({ id, route }) => window.__OS__.getState().activeAppId === id && window.__OS__.getAppRoute(id)?.path === route, {}, { id, route });
}
const checks = [];
try {
  for (const locale of baseline ? ['en'] : ['zh-Hans', 'en']) for (const posture of baseline ? ['folded'] : ['folded', 'unfolded']) {
    const context = await browser.createBrowserContext(), page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request', request => {
      const u = new URL(request.url());
      if (request.method() === 'GET' && (u.origin === url.origin && !/^\/api(?:\/|$)/.test(u.pathname) || ['data:', 'blob:'].includes(u.protocol))) request.continue(); else request.abort();
    });
    try {
      await page.setViewport({ width: 1440, height: 1100 });
      await page.goto(url.href, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__OS__ && window.__SIM__ && window.__FOLDAGENT__);
      await page.evaluate(({ locale, posture }) => { window.__OS__.locale.setLocale(locale); window.__FOLDAGENT__.setPosture(posture); }, { locale, posture });
      await setBilibiliReviewLocale(page, locale, open);
      await open(page, 'bilibili', '/history');
      await page.evaluate(() => {
        const user = window.__SIM__.getState().apps.bilibili.user;
        window.__SIM__.setState({ apps: { bilibili: { user: { ...user, videoHistory: ['local-owner-a', 'local-owner-b'], videoHistorySeenAt: { 'local-owner-a': 1000, 'local-owner-b': 2000 } } } } }, { deep: true, reload: false });
      });
      await page.waitForSelector(button('local-owner-a'), { visible: true });
      const task = await page.evaluate(() => window.__OS__.getState().activeTaskId), before = await facts(page);
      await page.$eval(button('local-owner-a'), node => { window.__historyRemove = node; });
      await open(page, 'clock', '/alarm');
      await page.evaluate(() => window.__historyRemove.click()); await tick(page);
      if (baseline) {
        assert.deepEqual((await facts(page)).ids, ['local-owner-b']);
        console.log('BASELINE: Clock foreground, retained History Remove deleted local-owner-a');
        checks.push({ baseline: true, backgroundMutation: true }); continue;
      }
      assert.deepEqual(await facts(page), before);
      await page.evaluate(id => window.__OS__.launchTaskById(id), task);
      await page.waitForSelector(button('local-owner-a'), { visible: true });
      await page.click(button('local-owner-a'));
      const after = await facts(page);
      assert.deepEqual(after.ids, ['local-owner-b']); assert.deepEqual(after.times, { 'local-owner-b': 2000 }); assert.deepEqual(after.folders, before.folders);
      await page.$eval(button('local-owner-b'), node => { window.__historyRemove = node; });
      for (const state of ['home', 'recents']) {
        await page.evaluate(state => state === 'home' ? window.__OS__.goHome() : window.__OS__.showRecents(), state);
        await page.evaluate(() => window.__historyRemove.click()); await tick(page);
        assert.deepEqual(await facts(page), after);
        await page.evaluate(id => window.__OS__.launchTaskById(id), task);
        await page.waitForSelector(button('local-owner-b'), { visible: true });
      }
      await open(page, 'clock', '/alarm');
      const clockTask = await page.evaluate(() => window.__OS__.getState().activeTaskId);
      await page.evaluate(({ task, clockTask, posture }) => {
        window.__FOLDAGENT__.setPosture('unfolded');
        window.__FOLDAGENT__.setMultiWindow('split', task, clockTask, 0.5);
        if (posture === 'folded') window.__FOLDAGENT__.setPosture('folded');
      }, { task, clockTask, posture });
      await page.focus('[data-app-id="clock"] .clock-alarm-add');
      await page.waitForFunction(() => window.__OS__.getState().activeAppId === 'clock');
      await page.evaluate(() => window.__historyRemove.click()); await tick(page);
      assert.deepEqual(await facts(page), after, 'A visible but unfocused split pane is not the owner');
      await page.click(button('local-owner-b'));
      assert.deepEqual((await facts(page)).ids, []); assert.deepEqual((await facts(page)).times, {});
      assert.deepEqual(errors, []);
      checks.push({ locale, posture, background: true, home: true, recents: true, splitFocus: true, foregroundRemoval: true, timestamps: true });
      console.log('PASS', locale, posture);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
console.log(JSON.stringify({ passed: true, baseline, checks }));
