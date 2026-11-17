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
const browser = await require('puppeteer').launch({ headless: true, executablePath }), checks = [];
const app = '[data-app-id="bilibili"]';
const user = page => page.evaluate(() => window.__SIM__.getState().apps.bilibili.user);
const tick = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function open(page, id, route) {
  await page.evaluate(({ id, route }) => window.__OS__.openApp(id, route), { id, route }); await tick(page);
  await page.waitForFunction(({ id, route }) => window.__OS__.getState().activeAppId === id && window.__OS__.getAppRoute(id)?.path === route, {}, { id, route });
}
async function saveButton(page, kind) {
  const handle = await page.waitForFunction(({ app, kind }) => [...document.querySelectorAll(`${app} button`)].find(node => node.checkVisibility() && node.textContent.trim() === (kind === 'folder' ? '完成' : '保存')), {}, { app, kind });
  return handle.asElement();
}
async function type(page, selector, value) {
  await page.click(selector); await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control'); await page.keyboard.type(value);
}
try {
  for (const kind of ['name', 'sign', 'folder']) for (const locale of baseline ? ['en'] : ['zh-Hans', 'en']) for (const posture of baseline ? ['folded'] : ['folded', 'unfolded']) {
    const context = await browser.createBrowserContext(), page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request', request => { const target = new URL(request.url()); if (request.method() === 'GET' && (target.origin === url.origin && !/^\/api(?:\/|$)/.test(target.pathname) || ['data:', 'blob:'].includes(target.protocol))) request.continue(); else request.abort(); });
    try {
      await page.setViewport({ width: 1440, height: 1100 }); await page.goto(url.href, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__OS__ && window.__SIM__ && window.__SIM_TIME__ && window.__FOLDAGENT__);
      await page.evaluate(({ locale, posture }) => { window.__OS__.locale.setLocale(locale); window.__FOLDAGENT__.setPosture(posture); window.__SIM_TIME__.setSimulatedTime(1700000000000, false); }, { locale, posture });
      await setBilibiliReviewLocale(page, locale, open);
      const parent = kind === 'folder' ? '/favorites' : '/profile/edit', route = kind === 'folder' ? '/fav/create' : `/profile/edit/${kind}`;
      const input = `${app} ${kind === 'sign' ? 'textarea' : kind === 'folder' ? 'input[placeholder="名称"]' : 'input[placeholder="请输入新昵称"]'}`;
      const value = kind === 'folder' ? 'Local folder one' : `Local ${kind} edit`;
      await open(page, 'bilibili', parent); await open(page, 'bilibili', route); await type(page, input, value);
      const before = await user(page), task = await page.evaluate(() => window.__OS__.getState().activeTaskId);
      const button = await saveButton(page, kind); await button.evaluate(node => { window.__retainedEditorSave = node; }); await button.dispose();
      await open(page, 'clock', '/alarm'); await page.evaluate(() => window.__retainedEditorSave.click()); await tick(page);
      if (baseline) {
        assert.notDeepEqual(await user(page), before); checks.push({ kind, backgroundMutation: true }); console.log('BASELINE', kind, 'mutates from Clock'); continue;
      }
      assert.deepEqual(await user(page), before);
      await page.evaluate(id => window.__OS__.launchTaskById(id), task); await page.waitForSelector(input, { visible: true });
      assert.equal(await page.$eval(input, node => node.value), value);
      await page.evaluate(posture => window.__FOLDAGENT__.setPosture(posture === 'folded' ? 'unfolded' : 'folded'), posture); await tick(page);
      assert.equal(await page.$eval(input, node => node.value), value);
      await page.evaluate(kind => {
        const state = window.__SIM__.getState().apps.bilibili;
        const patch = kind === 'folder' ? { uid: 'local-other-user' } : { [kind]: 'External source update' };
        window.__SIM__.setState({ apps: { bilibili: { user: { ...state.user, ...patch } } } }, { deep: true, reload: false });
      }, kind);
      await page.waitForSelector(`${app} [data-bilibili-editor-conflict]`, { visible: true });
      const changed = await user(page), disabled = await saveButton(page, kind);
      assert.equal(await disabled.evaluate(node => node.disabled), true); await disabled.dispose();
      await page.evaluate(() => window.__retainedEditorSave.click()); await tick(page); assert.deepEqual(await user(page), changed);
      assert.equal(await page.$eval(input, node => node.value), value);
      await open(page, 'bilibili', parent); await open(page, 'bilibili', route); await type(page, input, value);
      const ready = await user(page), live = await saveButton(page, kind);
      await live.evaluate(node => { node.click(); node.click(); }); await live.dispose();
      await page.waitForFunction(parent => window.__OS__.getAppRoute('bilibili')?.path === parent, {}, parent);
      const saved = await user(page);
      if (kind !== 'folder') assert.deepEqual(saved, { ...ready, [kind]: value });
      else {
        assert.equal(saved.favoritesFolders.length, ready.favoritesFolders.length + 1);
        const first = saved.favoritesFolders[0]; assert.equal(first.title, value);
        assert.deepEqual(saved.favoritesFolders.slice(1), ready.favoritesFolders);
        await open(page, 'bilibili', route); await type(page, input, 'Local folder two');
        const secondSave = await saveButton(page, kind); await secondSave.evaluate(node => node.click()); await secondSave.dispose();
        await page.waitForFunction(() => window.__OS__.getAppRoute('bilibili')?.path === '/favorites');
        const final = await user(page); assert.equal(final.favoritesFolders.length, saved.favoritesFolders.length + 1);
        assert.notEqual(final.favoritesFolders[0].id, first.id); assert.equal(final.favoritesFolders[1].id, first.id);
      }
      assert.deepEqual(errors, []); checks.push({ kind, locale, posture, background: true, conflict: true, draftRetained: true, foregroundSave: true, duplicateGuard: true });
      console.log('PASS', kind, locale, posture);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
console.log(JSON.stringify({ passed: true, baseline, checks }));
