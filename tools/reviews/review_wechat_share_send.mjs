// Synthetic, disposable local WeChat shares; all non-local requests are blocked.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const candidates = [process.env.FOLDAGENT_BROWSER_PATH, 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
const executablePath = candidates.find(path => existsSync(path));
assert.ok(executablePath, 'Set FOLDAGENT_BROWSER_PATH to an installed Chromium browser');
async function openPilotApp(page, appId, route) {
  await page.evaluate(async ({ appId, route }) => {
    window.__OS__.openApp(appId, route);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, { appId, route });
  await page.waitForFunction(appId => window.__OS__.getState().activeAppId === appId, {}, appId);
  await page.waitForSelector(`[data-app-id="${appId}"]`, { visible: true });
}
const standalonePackage = new URL('../../foldmobilegym/package.json', import.meta.url);
const require = createRequire(existsSync(standalonePackage) ? standalonePackage : new URL('../../mobilegym/package.json', import.meta.url));
const browser = await require('puppeteer').launch({ headless: true, executablePath });
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3395/');
assert.ok(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const app = '[data-app-id="wechat"]';
const text = 'SYNTHETIC_SHARE_481\nSECOND_LINE';
const image = '/sdcard/Pictures/SYNTHETIC_SHARE_481.png';
async function prepare(page, kind, posture) {
  await page.setRequestInterception(true);
  page.on('request', request => {
    const parsed = new URL(request.url());
    if ((['localhost', '127.0.0.1'].includes(parsed.hostname) && ['GET', 'HEAD'].includes(request.method())) || ['data:', 'blob:'].includes(parsed.protocol)) request.continue();
    else request.abort();
  });
  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__OS__ && window.__SIM__ && window.__FOLDAGENT__);
  await page.evaluate(posture => window.__FOLDAGENT__.setPosture(posture), posture);
  await openPilotApp(page, 'calendar', '/');
  const intent = kind === 'text' ? { action: 'ACTION_SEND', type: 'text/plain', data: { text } } : { action: 'ACTION_SEND', type: 'image/png', data: { stream: image, mimeType: 'image/png' } };
  assert.equal(await page.evaluate(intent => window.__OS__.startActivity(intent), intent), true);
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(e => e.textContent.trim() === '微信' && e.checkVisibility()));
  await page.evaluate(() => [...document.querySelectorAll('button')].find(e => e.textContent.trim() === '微信' && e.checkVisibility()).click());
  await page.waitForFunction(() => window.__OS__.getState().activeAppId === 'wechat' && window.__OS__.getAppRoute('wechat')?.path === '/share/forward');
  await page.waitForFunction(sel => [...document.querySelectorAll(sel + ' button')].some(e => e.textContent.trim() === 'Boss'), {}, app);
  await page.evaluate(sel => [...document.querySelectorAll(sel + ' button')].find(e => e.textContent.trim() === 'Boss').click(), app);
  await page.waitForFunction(sel => [...document.querySelectorAll(sel + ' button')].some(e => e.textContent.trim() === '发送'), {}, app);
}
async function count(page, kind) {
  return page.evaluate(({ kind, text, image }) => {
    const chats = window.__SIM__.getState().apps.wechat.chats;
    return chats.flatMap(chat => chat.messages || []).filter(message => message.type === (kind === 'text' ? 'text' : 'image') && message.content === (kind === 'text' ? text : image)).length;
  }, { kind, text, image });
}
const checks = [];
try {
  for (const posture of ['folded', 'unfolded']) for (const kind of ['text', 'image']) {
    const context = await browser.createBrowserContext();
    try {
      const page = await context.newPage(); await prepare(page, kind, posture);
      assert.equal(await count(page, kind), 0);
      // Cancel and reselect must not consume the one-send gate.
      await page.evaluate(sel => [...document.querySelectorAll(sel + ' button')].find(e => e.textContent.trim() === '取消').click(), app);
      await page.waitForFunction(sel => ![...document.querySelectorAll(sel + ' button')].some(e => e.textContent.trim() === '发送'), {}, app);
      await page.evaluate(sel => [...document.querySelectorAll(sel + ' button')].find(e => e.textContent.trim() === 'Boss').click(), app);
      await page.waitForFunction(sel => [...document.querySelectorAll(sel + ' button')].some(e => e.textContent.trim() === '发送'), {}, app);
      await page.evaluate(sel => { const button = [...document.querySelectorAll(sel + ' button')].find(e => e.textContent.trim() === '发送'); button.click(); button.click(); }, app);
      await page.waitForFunction(() => window.__OS__.getAppRoute('wechat')?.path.startsWith('/chat/'));
      assert.equal(await count(page, kind), 1, `${posture} ${kind} double click`);
      checks.push(`${posture} ${kind}: cancel/reselect and same-turn double click`);
    } finally { await context.close(); }
  }
  for (const mode of ['app', 'home', 'recents']) {
    const context = await browser.createBrowserContext();
    try {
      const page = await context.newPage(); await prepare(page, 'text', 'folded');
      const button = await page.evaluateHandle(sel => [...document.querySelectorAll(sel + ' button')].find(e => e.textContent.trim() === '发送'), app);
      if (mode === 'app') await openPilotApp(page, 'clock', '/');
      else await page.evaluate(mode => mode === 'home' ? window.__OS__.goHome() : window.__OS__.showRecents(), mode);
      await pause(150); await button.evaluate(e => e.click()); await pause(150);
      assert.equal(await count(page, 'text'), 0, `${mode} background send`);
      assert.equal(await page.evaluate(() => window.__OS__.getAppRoute('wechat')?.path), '/share/forward');
      checks.push(`${mode}: stale confirmation cannot send or navigate`);
    } finally { await context.close(); }
  }
  for (const [posture, orientation] of [['unfolded', 'side_by_side'], ['folded', 'stacked']]) for (const kind of ['text', 'image']) {
    const context = await browser.createBrowserContext();
    try {
      const page = await context.newPage(); await prepare(page, kind, posture);
      await openPilotApp(page, 'clock', '/');
      await page.evaluate(orientation => {
        const state = window.__OS__.getState();
        const wechat = state.tasks.find(task => task.rootAppId === 'wechat');
        const clock = state.tasks.find(task => task.rootAppId === 'clock');
        window.__FOLDAGENT__.setMultiWindow('split', wechat.taskId, clock.taskId, .5, null, .5, orientation);
        window.__OS__.launchTaskById(clock.taskId);
      }, orientation);
      await page.waitForFunction(() => window.__OS__.getState().activeAppId === 'clock');
      await pause(400);
      const send = await page.evaluateHandle(sel => [...document.querySelectorAll(sel + ' button')].find(e => e.textContent.trim() === '发送'), app);
      const geometry = await page.evaluate(({ app, orientation }) => {
        const owner = document.querySelector(app).getBoundingClientRect();
        const peer = document.querySelector('[data-app-id="clock"]').getBoundingClientRect();
        const button = [...document.querySelectorAll(app + ' button')].find(e => e.textContent.trim() === '发送').getBoundingClientRect();
        return {
          separated: orientation === 'side_by_side' ? owner.right <= peer.left + 2 : owner.bottom <= peer.top + 2,
          inside: button.left >= owner.left - 1 && button.right <= owner.right + 1 && button.top >= owner.top - 1 && button.bottom <= owner.bottom + 1,
        };
      }, { app, orientation });
      assert.deepEqual(geometry, { separated: true, inside: true });
      // A stale synthetic event must not send while the other pane owns focus.
      await send.evaluate(button => button.click());
      assert.equal(await count(page, kind), 0);
      // A real pointer click must activate the visible pane before invoking Send.
      await send.asElement().click();
      await page.waitForFunction(() => window.__OS__.getAppRoute('wechat')?.path.startsWith('/chat/'));
      assert.equal(await count(page, kind), 1, `${posture} ${kind} split send`);
      checks.push(`${posture} ${kind}: pointer send from inactive split pane`);
    } finally { await context.close(); }
  }
  {
    const context = await browser.createBrowserContext();
    try {
      const page = await context.newPage(); await prepare(page, 'text', 'folded');
      await page.evaluate(sel => {
        [...document.querySelectorAll(sel + ' button')].find(e => e.textContent.trim() === '发送').click();
        window.__OS__.openApp('clock', '/');
      }, app);
      await page.waitForFunction(() => window.__OS__.getState().activeAppId === 'clock');
      await pause(200);
      assert.equal(await count(page, 'text'), 1);
      assert.equal(await page.evaluate(() => window.__OS__.getState().activeAppId), 'clock');
      checks.push('send then immediate app switch keeps Clock in foreground');
    } finally { await context.close(); }
  }
  for (const [firstKind, nextKind] of [['text', 'text'], ['text', 'image'], ['image', 'text'], ['image', 'image']]) {
    const context = await browser.createBrowserContext();
    try {
      const page = await context.newPage(); await prepare(page, firstKind, 'unfolded');
      await page.evaluate(sel => { window.__oldShareSend = [...document.querySelectorAll(sel + ' button')].find(e => e.textContent.trim() === '发送'); }, app);
      await openPilotApp(page, 'calendar', '/');
      const replacementText = 'SYNTHETIC_REPLACEMENT_592';
      const replacementImage = '/sdcard/Pictures/SYNTHETIC_REPLACEMENT_592.png';
      const nextIntent = nextKind === 'text'
        ? { action: 'ACTION_SEND', type: 'text/plain', data: { text: replacementText } }
        : { action: 'ACTION_SEND', type: 'image/png', data: { stream: replacementImage, mimeType: 'image/png' } };
      assert.equal(await page.evaluate(intent => window.__OS__.startActivity(intent), nextIntent), true);
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(e => e.textContent.trim() === '微信' && e.checkVisibility()));
      // Invoke the retained old button in the same turn as intent delivery, before React commits.
      await page.evaluate(() => {
        [...document.querySelectorAll('button')].find(e => e.textContent.trim() === '微信' && e.checkVisibility()).click();
        window.__oldShareSend.click();
      });
      await page.waitForFunction(() => window.__OS__.getState().activeAppId === 'wechat' && window.__OS__.getAppRoute('wechat')?.path === '/share/forward');
      await page.waitForFunction(sel => ![...document.querySelectorAll(sel + ' button')].some(e => e.textContent.trim() === '发送'), {}, app);
      assert.equal(await count(page, firstKind), 0, 'old share was not sent');
      await page.evaluate(sel => [...document.querySelectorAll(sel + ' button')].find(e => e.textContent.trim() === 'Boss').click(), app);
      await page.waitForFunction(sel => [...document.querySelectorAll(sel + ' button')].some(e => e.textContent.trim() === '发送'), {}, app);
      if (nextKind === 'text') assert.ok((await page.$eval(app, e => e.innerText)).includes(replacementText));
      else assert.ok(await page.$eval(app, (e, image) => [...e.querySelectorAll('img')].some(img => img.getAttribute('src')?.includes(image)), replacementImage));
      await page.evaluate(sel => [...document.querySelectorAll(sel + ' button')].find(e => e.textContent.trim() === '发送').click(), app);
      await page.waitForFunction(() => window.__OS__.getAppRoute('wechat')?.path.startsWith('/chat/'));
      const messages = await page.evaluate(() => window.__SIM__.getState().apps.wechat.chats.flatMap(chat => chat.messages || []));
      assert.equal(messages.filter(message => message.content === (nextKind === 'text' ? replacementText : replacementImage)).length, 1);
      assert.equal(messages.filter(message => message.content === (firstKind === 'text' ? text : image)).length, 0);
      checks.push(`${firstKind} to ${nextKind}: replacement requires fresh recipient and sends only new payload`);
    } finally { await context.close(); }
  }
  for (const previous of ['abandoned', 'sent']) {
    const context = await browser.createBrowserContext();
    try {
      const page = await context.newPage(); await prepare(page, 'text', 'folded');
      if (previous === 'sent') {
        await page.evaluate(sel => [...document.querySelectorAll(sel + ' button')].find(e => e.textContent.trim() === '发送').click(), app);
        await page.waitForFunction(() => window.__OS__.getAppRoute('wechat')?.path.startsWith('/chat/'));
      }
      await openPilotApp(page, 'calendar', '/');
      assert.equal(await page.evaluate(text => window.__OS__.startActivity({ action: 'ACTION_SEND', type: 'text/plain', data: { text } }), text), true);
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(e => e.textContent.trim() === '微信' && e.checkVisibility()));
      await page.evaluate(() => [...document.querySelectorAll('button')].find(e => e.textContent.trim() === '微信' && e.checkVisibility()).click());
      await page.waitForFunction(() => window.__OS__.getState().activeAppId === 'wechat' && window.__OS__.getAppRoute('wechat')?.path === '/share/forward');
      await page.waitForFunction(sel => ![...document.querySelectorAll(sel + ' button')].some(e => e.textContent.trim() === '发送'), {}, app);
      await page.evaluate(sel => [...document.querySelectorAll(sel + ' button')].find(e => e.textContent.trim() === 'Boss').click(), app);
      await page.waitForFunction(sel => [...document.querySelectorAll(sel + ' button')].some(e => e.textContent.trim() === '发送'), {}, app);
      await page.evaluate(sel => [...document.querySelectorAll(sel + ' button')].find(e => e.textContent.trim() === '发送').click(), app);
      await page.waitForFunction(() => window.__OS__.getAppRoute('wechat')?.path.startsWith('/chat/'));
      assert.equal(await count(page, 'text'), previous === 'sent' ? 2 : 1);
      checks.push(`identical repeated share after ${previous}: fresh confirmation and one new send`);
    } finally { await context.close(); }
  }
  console.log(JSON.stringify({ passed: true, checks, scope: 'Disposable synthetic local shares; no real network delivery or native visual equivalence asserted.' }, null, 2));
} finally { await browser.close(); }
