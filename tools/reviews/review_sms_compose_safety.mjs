// Local simulator-only outgoing events. No carrier/network SMS service is called.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { openPilotApp } from '../browser-automation/pilot_app_navigation.mjs';
import { resolveBrowserExecutable } from '../browser-automation/browser.mjs';
fs.mkdirSync(path.resolve(import.meta.dirname, '../../artifacts'), { recursive: true });

const root = path.resolve(import.meta.dirname, '../..');
const frontend = fs.existsSync(path.join(root, 'foldmobilegym/package.json')) ? 'foldmobilegym' : 'mobilegym';
const require = createRequire(path.join(root, frontend, 'package.json'));
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3319/');
assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname) && !url.username && !url.password);
const output = fs.mkdtempSync(path.join(root, 'artifacts/sms-compose-safety-'));
const browser = await require('puppeteer').launch({ headless: true, executablePath: resolveBrowserExecutable() });
const app = '[data-app-id="sms"]', checks = [], failures = [], errors = [], writes = [];
const body = mode => `${app} [data-benchmark-field="${mode === 'new' ? 'sms-body' : 'sms-conversation-body'}"]`;
const send = (mode, attachments = false) => `${app} [data-action="sms.${mode === 'new' ? 'compose' : 'conversation'}.${attachments ? 'attachments.' : ''}send.submit"]`;
const outgoing = p => p.evaluate(() => window.__smsSafetyOutgoing);
const currentRoute = p => p.evaluate(() => window.__OS__.getAppRoute('sms').path);
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
  throw Error('Missing visible control: ' + selector);
}
async function ready(p, mode, locale, posture) {
  await p.setViewport({ width: 1440, height: 1100 }); await p.goto(url.href, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__OS__ && window.__SIM__ && window.__FOLDAGENT__);
  await p.evaluate(({ locale, posture }) => {
    window.__OS__.locale.setLocale(locale); window.__FOLDAGENT__.setPosture(posture);
    window.__smsSafetyOutgoing = []; window.addEventListener('sms-outgoing', event => window.__smsSafetyOutgoing.push(event.detail));
  }, { locale, posture });
  await openPilotApp(p, 'sms', '/');
  let id = null;
  if (mode === 'new') await openPilotApp(p, 'sms', '/new?address=2025550100');
  else {
    id = await p.evaluate(() => window.__OS__.content.insert('content://sms/conversations', { sender: 'Disposable compose QA', phoneNumber: '2025550100' }).split('/').at(-1));
    await openPilotApp(p, 'sms', `/conversation/${id}`);
  }
  await p.waitForSelector(body(mode), { visible: true });
  return id;
}
async function type(p, mode, text = 'Local first line') { await hit(p, body(mode)); await p.type(body(mode), text); }
async function messages(p, id) { return p.evaluate(id => window.__OS__.content.query(`content://sms/messages?conversationId=${id}`).items, id); }
async function snapshot(p) { return p.evaluate(() => {
  const resolver = window.__OS__.content, conversations = resolver.query('content://sms/conversations').items;
  return { conversations, messages: conversations.map(c => [c.id, resolver.query(`content://sms/messages?conversationId=${c.id}`).items]) };
}); }
async function hideKeyboard(p) {
  if (await p.evaluate(() => window.__OS__.keyboard.isVisible())) {
    await p.evaluate(() => window.__OS__.handleBack()); await p.waitForFunction(() => !window.__OS__.keyboard.isVisible());
    await p.evaluate(() => new Promise(r => requestAnimationFrame(r)));
  }
}
async function run(name, fn) {
  const c = await browser.createBrowserContext(), p = await c.newPage();
  p.on('pageerror', error => errors.push({ name, error: String(error) }));
  p.on('request', request => { if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) writes.push({ name, method: request.method(), url: request.url() }); });
  try { await fn(p); checks.push(name); console.log('PASS ' + name); }
  catch (error) { failures.push({ name, error: String(error.stack) }); console.error('FAIL ' + name + ': ' + error.stack); await p.screenshot({ path: path.join(output, `${name}-failure.png`) }).catch(() => {}); }
  finally { await c.close(); }
}
try {
  for (const locale of ['zh-Hans', 'en']) for (const posture of ['folded', 'unfolded']) for (const mode of ['new', 'conversation']) {
    const tag = `${locale}-${posture}-${mode}`;
    await run(`${tag}-newline-and-posture`, async p => {
      await ready(p, mode, locale, posture); const before = await snapshot(p), original = await currentRoute(p);
      await type(p, mode); await p.keyboard.press('Enter'); await p.keyboard.type('Second line');
      await p.keyboard.down('Shift'); await p.keyboard.press('Enter'); await p.keyboard.up('Shift');
      const expected = 'Local first line\nSecond line\n';
      assert.equal(await p.$eval(body(mode), e => e.value), expected); assert.deepEqual(await outgoing(p), []); assert.deepEqual(await snapshot(p), before);
      const key = '[data-keyboard-key]:has(svg path[d="M9 17l-5-5 5-5M4 12h16v-5"])';
      await hit(p, key); assert.equal(await p.$eval(body(mode), e => e.value), expected + '\n');
      const element = await p.$(body(mode)); await p.evaluate(other => window.__FOLDAGENT__.setPosture(other), posture === 'folded' ? 'unfolded' : 'folded');
      assert.equal(await element.evaluate(e => e.isConnected), true); assert.equal(await p.$eval(body(mode), e => e.value), expected + '\n');
      assert.equal(await currentRoute(p), original); assert.deepEqual(await outgoing(p), []); assert.deepEqual(await snapshot(p), before); await element.dispose();
      await p.screenshot({ path: path.join(output, `${tag}-multiline.png`) });
    });
    await run(`${tag}-ime-confirmation-and-explicit-send`, async p => {
      await ready(p, mode, locale, posture); await type(p, mode, 'Local 中文\nExact body');
      await p.evaluate(({ field, button }) => {
        const e = document.querySelector(field); e.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: 'ni' }));
        e.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true, bubbles: true }));
        document.querySelector(button).click();
      }, { field: body(mode), button: send(mode) });
      assert.deepEqual(await outgoing(p), []);
      await p.$eval(body(mode), e => e.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '中文' })));
      const authored = await p.$eval(body(mode), e => e.value);
      await hit(p, send(mode)); await p.waitForFunction(() => window.__smsSafetyOutgoing.length === 1);
      const events = await outgoing(p); assert.equal(events[0].content, authored.trim());
      await p.waitForFunction(() => window.__OS__.getAppRoute('sms').path.startsWith('/conversation/'));
      const id = (await currentRoute(p)).split('/').at(-1).split('?')[0]; assert.equal((await messages(p, id)).length, 1);
    });
    await run(`${tag}-background-send-is-inert`, async p => {
      await ready(p, mode, locale, posture); await type(p, mode, 'Keep unsent local draft'); await hideKeyboard(p);
      const before = await snapshot(p), original = await currentRoute(p), retained = await p.$(send(mode));
      await openPilotApp(p, 'clock', '/world'); await retained.evaluate(e => e.click());
      assert.deepEqual(await outgoing(p), []); assert.deepEqual(await snapshot(p), before); assert.equal(await currentRoute(p), original); await retained.dispose();
    });
    await run(`${tag}-attachment-explicit-send-once`, async p => {
      await ready(p, mode, locale, posture); await type(p, mode, 'Explicit attachment-view text'); await hideKeyboard(p);
      await hit(p, `${app} [data-trigger="${mode === 'new' ? 'compose' : 'conversation'}.attachments.open"]`);
      await p.waitForSelector(send(mode, true), { visible: true });
      await p.$eval(send(mode, true), e => { e.click(); e.click(); }); await p.waitForFunction(() => window.__smsSafetyOutgoing.length > 0);
      assert.equal((await outgoing(p)).length, 1); assert.equal((await outgoing(p))[0].content, 'Explicit attachment-view text');
    });
  }
  for (const locale of ['zh-Hans', 'en']) for (const posture of ['folded', 'unfolded']) await run(`${locale}-${posture}-real-statuses`, async p => {
    const id = await ready(p, 'conversation', locale, posture);
    const labels = locale === 'en' ? ['Sending…', 'Sent', 'Delivered', 'Read', 'Failed to send', 'Unknown status'] : ['发送中…', '已发送', '已送达', '已读', '发送失败', '状态未知'];
    const statuses = ['sending', 'sent', 'delivered', 'read', 'failed', 'paused'];
    await p.evaluate(({ id, statuses }) => {
      statuses.forEach((status, index) => window.__OS__.content.insert(`content://sms/messages?conversationId=${id}`, { id: `status-${index}`, content: `Local status ${status}`, timestamp: '10:00', isOutgoing: true, status }));
      window.__OS__.content.insert(`content://sms/messages?conversationId=${id}`, { id: 'status-incoming', content: 'Local incoming status', timestamp: '10:00', isOutgoing: false, status: 'sent' });
    }, { id, statuses });
    for (let index = 0; index < statuses.length; index++) {
      const selector = `${app} [data-sms-message-id="status-${index}"] [data-sms-message-status]`;
      await p.waitForFunction(({ selector, label }) => document.querySelector(selector)?.textContent === label, {}, { selector, label: labels[index] });
    }
    assert.equal(await p.$(`${app} [data-sms-message-id="status-incoming"] [data-sms-message-status]`), null);
    for (const [index, status] of statuses.entries()) assert.equal((await messages(p, id)).find(message => message.id === `status-${index}`).status, status);
    await p.evaluate(() => window.__OS__.content.update('content://sms/messages/status-4', { status: 'delivered' }));
    await p.waitForFunction(({ app, label }) => document.querySelector(`${app} [data-sms-message-id="status-4"] [data-sms-message-status]`)?.textContent === label, {}, { app, label: labels[2] });
    assert.deepEqual(await outgoing(p), []);
  });
  await run('recipient-revision-rejects-retained-send', async p => {
    const id = await ready(p, 'conversation', 'en', 'unfolded'); await type(p, 'conversation', 'Do not send to a replaced recipient');
    await p.evaluate(({ id, button }) => { const e = document.querySelector(button); window.__OS__.content.update(`content://sms/conversations/${id}`, { phoneNumber: '2025550101' }); e.click(); }, { id, button: send('conversation') });
    assert.deepEqual(await outgoing(p), []); assert.deepEqual(await messages(p, id), []);
  });
} finally {
  await browser.close();
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ passed: !failures.length && !errors.length && !writes.length, url: url.href, checks, failures, errors, writes,
    scope: 'Local compose newline/IME/explicit-send and provider-status display; no physical SMS, carrier delivery/read certification or private communications' }, null, 2));
}
console.log(JSON.stringify({ output, checks, failures, errors, writes }, null, 2));
assert.deepEqual(failures, []); assert.deepEqual(errors, []); assert.deepEqual(writes, []);
