// Disposable simulator filesystem only. No contact selection or real send occurs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const releaseHelpers = fs.existsSync(new URL('../browser-automation/pilot_app_navigation.mjs', import.meta.url));
const { openPilotApp } = await import(releaseHelpers ? '../browser-automation/pilot_app_navigation.mjs' : '../../foldmobilegym/tools/pilot_app_navigation.mjs');
const { resolveBrowserExecutable } = await import(releaseHelpers ? '../browser-automation/browser.mjs' : '../../foldmobilegym/tools/run_web_agent_episode.mjs');
fs.mkdirSync(path.resolve(import.meta.dirname, '../../artifacts'), { recursive: true });

const root = path.resolve(import.meta.dirname, '../..');
const frontend = fs.existsSync(path.join(root, 'foldmobilegym/package.json')) ? 'foldmobilegym' : 'mobilegym';
const require = createRequire(path.join(root, frontend, 'package.json'));
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3318/');
assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname) && !url.username && !url.password);
const output = fs.mkdtempSync(path.join(root, 'artifacts/filemanager-share-'));
const browser = await require('puppeteer').launch({ headless: true, executablePath: resolveBrowserExecutable() });
const app = '[data-app-id="file_manager"]', chooser = '[style*="z-index: 5200"]';
const checks = [], failures = [], errors = [], writes = [];
const route = p => p.evaluate(() => window.__OS__.getAppRoute('file_manager').path);
async function hit(p, selector) {
  await p.waitForFunction(async selector => {
    const e = [...document.querySelectorAll(selector)].find(e => e.checkVisibility() && !e.disabled);
    if (!e) return false;
    const a = e.getBoundingClientRect(); await new Promise(r => requestAnimationFrame(r));
    const b = e.getBoundingClientRect(), t = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    return Math.abs(a.x - b.x) < .5 && Math.abs(a.y - b.y) < .5 && (e === t || e.contains(t));
  }, {}, selector);
  const handles = await p.$$(selector);
  try { for (const h of handles) if (await h.evaluate(e => e.checkVisibility() && !e.disabled)) { await h.click(); return; } }
  finally { for (const h of handles) await h.dispose(); }
  throw Error(`No visible control: ${selector}`);
}
async function ready(p, kind, locale, posture) {
  await p.setViewport({ width: 1440, height: 1100 }); await p.goto(url.href, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__OS__ && window.__SIM_FS__ && window.__FOLDAGENT__);
  await p.evaluate(({ locale, posture }) => { window.__OS__.locale.setLocale(locale); window.__FOLDAGENT__.setPosture(posture); }, { locale, posture });
  const sample = await p.evaluate(async () => {
    const api = window.__SIM_FS__, dir = '/sdcard/Download/ImageShareQA'; await api.mkdir(dir);
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 48;
    const context = canvas.getContext('2d'); context.fillStyle = '#1a88c7'; context.fillRect(0, 0, 64, 48);
    const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const jpg = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg'));
    if (!png || !jpg) throw Error('Cannot prepare controlled image bytes');
    const a = await api.write(dir + '/source.png', png, { mimeType: 'image/png' });
    const b = await api.write(dir + '/other.jpg', jpg, { mimeType: 'image/jpeg' });
    const text = await api.write(dir + '/notes.txt', 'Controlled local file, not private content', { mimeType: 'text/plain' });
    return { dir, png: { id: a.id, path: a.path }, jpg: { id: b.id, path: b.path }, text: { id: text.id, path: text.path } };
  });
  await openPilotApp(p, 'file_manager', kind === 'folder' ? `/folder?path=${encodeURIComponent(sample.dir)}&mode=select` : '/recent?mode=select');
  await p.waitForSelector(`${app} [data-file-item-id="${sample.png.id}"]`, { visible: true });
  await p.evaluate(() => {
    window.__fmShareIntents = []; const api = window.__OS__, start = api.startActivity;
    api.startActivity = (...args) => { window.__fmShareIntents.push(args); return start.apply(api, args); };
  });
  return sample;
}
async function select(p, item) {
  const selector = `${app} [data-file-item-id="${item.id}"]`;
  await p.$eval(selector, element => element.scrollIntoView({ block: 'center' })); await hit(p, selector);
  await p.waitForFunction(selector => document.querySelector(selector)?.dataset.selected === 'true', {}, selector);
}
const send = kind => `${app} [data-action="${kind}.select.send"]`;
const intents = p => p.evaluate(() => window.__fmShareIntents);
async function cancel(p) {
  await p.waitForSelector(chooser, { visible: true });
  const buttons = await p.$$(`${chooser} button`);
  try { await buttons.at(-1).click(); } finally { for (const button of buttons) await button.dispose(); }
  await p.waitForSelector(chooser, { hidden: true });
}
async function run(name, fn) {
  const c = await browser.createBrowserContext(), p = await c.newPage();
  await p.evaluateOnNewDocument(() => {
    window.__fmReviewTrace = [];
    for (const type of ['pointerdown', 'pointerup', 'click']) window.addEventListener(type, event => {
      const element = event.target instanceof Element ? event.target : null;
      window.__fmReviewTrace.push({ type, action: element?.closest('[data-action]')?.getAttribute('data-action'), tag: element?.tagName,
        x: event.clientX, y: event.clientY, posture: document.documentElement.dataset.foldagentPosture });
    }, true);
    window.addEventListener('mobilegym:agent-action', event => window.__fmReviewTrace.push({ type: 'action', id: event.detail?.id }));
  });
  p.on('pageerror', error => errors.push({ name, error: String(error) }));
  p.on('request', request => { if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) writes.push({ name, method: request.method(), url: request.url() }); });
  try { await fn(p); checks.push(name); console.log(`PASS ${name}`); }
  catch (error) {
    const diagnostic = await p.evaluate(() => {
      const state = window.__OS__?.getState();
      return { trace: window.__fmReviewTrace, route: window.__OS__?.getAppRoute('file_manager').path,
        activeTaskId: state?.activeTaskId, activeAppId: state?.activeAppId, launcher: state?.isLauncherVisible, recents: state?.isRecentsVisible,
        selected: [...document.querySelectorAll('[data-app-id="file_manager"] [data-selected="true"]')].map(element => element.getAttribute('data-file-item-id')) };
    }).catch(() => null);
    failures.push({ name, error: String(error.stack), diagnostic }); console.error(`FAIL ${name}: ${error.stack}`);
    await p.screenshot({ path: path.join(output, `${name}-failure.png`) }).catch(() => {});
  }
  finally { await c.close(); }
}
try {
  for (const kind of ['folder', 'recent']) for (const locale of ['zh-Hans', 'en']) for (const posture of ['folded', 'unfolded']) {
    const tag = `${kind}-${locale}-${posture}`;
    await run(`${tag}-png-and-posture`, async p => {
      const sample = await ready(p, kind, locale, posture); await select(p, sample.png);
      await p.evaluate(other => window.__FOLDAGENT__.setPosture(other), posture === 'folded' ? 'unfolded' : 'folded');
      await hit(p, send(kind)); const log = await intents(p);
      assert.equal(log.length, 1); assert.deepEqual(log[0], [{ action: 'ACTION_SEND', type: 'image/png', data: { stream: sample.png.path, mimeType: 'image/png' } }, { newTask: true }]);
      await cancel(p); await p.screenshot({ path: path.join(output, `${tag}-selection.png`) });
    });
    await run(`${tag}-background`, async p => {
      const sample = await ready(p, kind, locale, posture); await select(p, sample.png);
      const retained = await p.$(send(kind)), before = await route(p);
      await openPilotApp(p, 'clock', '/world'); await retained.evaluate(element => element.click());
      assert.equal((await intents(p)).length, 0); assert.equal(await route(p), before);
      assert.equal(await p.evaluate(() => window.__OS__.getState().activeAppId), 'clock'); await retained.dispose();
    });
    await run(`${tag}-rewritten-batch`, async p => {
      const sample = await ready(p, kind, locale, posture); await select(p, sample.png); await select(p, sample.jpg);
      await p.evaluate(async pathname => { const api = window.__SIM_FS__, node = api.stat(pathname), bytes = await api.read(pathname); await api.write(pathname, bytes, { mimeType: node.mimeType }); }, sample.png.path);
      await hit(p, send(kind)); assert.equal((await intents(p)).length, 0);
      await p.waitForFunction(locale => document.querySelector('[data-app-id="file_manager"]').innerText.includes(locale === 'en' ? 'Selected files changed' : '所选文件已改变'), {}, locale);
    });
  }
  for (const kind of ['folder', 'recent']) {
    await run(`${kind}-mixed-image-mime`, async p => {
      const sample = await ready(p, kind, 'en', 'unfolded'); await select(p, sample.png); await select(p, sample.jpg);
      await hit(p, send(kind)); const log = await intents(p);
      assert.equal(log[0][0].type, 'image/*'); assert.equal(log[0][0].data.mimeType, 'image/*');
      assert.deepEqual(new Set(log[0][0].data.stream), new Set([sample.png.path, sample.jpg.path])); await cancel(p);
    });
    await run(`${kind}-same-frame-deselection`, async p => {
      const sample = await ready(p, kind, 'en', 'unfolded'); await select(p, sample.png);
      await p.evaluate(({ id, sendSelector }) => { const button = document.querySelector(sendSelector); document.querySelector(`[data-app-id="file_manager"] [data-file-item-id="${id}"]`).click(); button.click(); }, { id: sample.png.id, sendSelector: send(kind) });
      assert.equal((await intents(p)).length, 0);
    });
  }
  await run('folder-image-and-text-is-not-partially-shared', async p => {
    const sample = await ready(p, 'folder', 'en', 'unfolded'); await select(p, sample.png); await select(p, sample.text);
    await hit(p, send('folder')); assert.equal((await intents(p)).length, 0);
    await p.waitForFunction(() => document.querySelector('[data-app-id="file_manager"]').innerText.includes('Only image files'));
  });
  await run('png-wechat-receiver-preview-no-send', async p => {
    const sample = await ready(p, 'folder', 'zh-Hans', 'unfolded'); await select(p, sample.png); await hit(p, send('folder'));
    await p.waitForSelector(chooser, { visible: true });
    const buttons = await p.$$(`${chooser} button`);
    try { for (const button of buttons) if (await button.evaluate(element => ['微信', 'WeChat'].includes(element.textContent.trim()))) { await button.click(); break; } }
    finally { for (const button of buttons) await button.dispose(); }
    await p.waitForFunction(() => window.__OS__.getState().activeAppId === 'wechat' && window.__OS__.getAppRoute('wechat')?.path === '/share/forward');
    const payload = await p.evaluate(() => window.__OS__.getIntentPayload());
    assert.equal(payload.type, 'image/png'); assert.equal(payload.data.stream, sample.png.path); assert.equal(payload.data.mimeType, 'image/png');
    await p.screenshot({ path: path.join(output, 'png-wechat-preview.png') });
  });
} finally {
  await browser.close();
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ passed: !failures.length && !errors.length && !writes.length, url: url.href, checks, failures, errors, writes,
    scope: 'Local image-share handoff, actual MIME, source/Activity ownership and receiver preview; no recipient/send, WPS restoration or whole-FileManager native certification' }, null, 2));
}
console.log(JSON.stringify({ output, checks, failures, errors, writes }, null, 2));
assert.deepEqual(failures, []); assert.deepEqual(errors, []); assert.deepEqual(writes, []);
