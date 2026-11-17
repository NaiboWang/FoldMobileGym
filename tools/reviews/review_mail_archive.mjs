// Local mailbox only. Never calls Gmail, SMTP, Send or Delete.
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
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3322/');
assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname) && !url.username && !url.password);
const output = fs.mkdtempSync(path.join(root, 'artifacts/mail-archive-'));
const browser = await require('puppeteer').launch({ headless: true, executablePath: resolveBrowserExecutable() });
const app = '[data-app-id="mail"]', checks = [], failures = [], errors = [], writes = [];
const state = p => p.evaluate(() => window.__SIM__.getState().apps.mail);
const route = p => p.evaluate(() => window.__OS__.getAppRoute('mail').path);
async function hit(p, selector) {
  await p.waitForFunction(async selector => {
    const e = [...document.querySelectorAll(selector)].find(e => e.checkVisibility() && !e.disabled);
    if (!e) return false;
    const a = e.getBoundingClientRect(); await new Promise(r => requestAnimationFrame(r));
    const b = e.getBoundingClientRect(), target = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    return Math.abs(a.x - b.x) < .5 && Math.abs(a.y - b.y) < .5 && (target === e || e.contains(target));
  }, {}, selector);
  const handles = await p.$$(selector);
  try { for (const h of handles) if (await h.evaluate(e => e.checkVisibility() && !e.disabled)) { await h.click(); return; } }
  finally { for (const h of handles) await h.dispose(); }
  throw Error('No visible control: ' + selector);
}
async function ready(p, locale, posture) {
  await p.setViewport({ width: 1440, height: 1100 }); await p.goto(url.href, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__OS__ && window.__SIM__ && window.__FOLDAGENT__);
  await p.evaluate(({ locale, posture }) => { window.__OS__.locale.setLocale(locale); window.__FOLDAGENT__.setPosture(posture); }, { locale, posture });
  await openPilotApp(p, 'mail', '/'); await p.waitForSelector(`${app} [data-action="mail.message.open"]`, { visible: true });
  return state(p);
}
const archive = `${app} .mail-reader-archive`;
function originalFacts(snapshot) { return Object.fromEntries(['messages', 'drafts', 'draft_input', 'editor_buffers', 'reply_inputs', 'verified_message_ids', 'starred_message_ids', 'send_count', 'deleted_count'].map(key => [key, snapshot[key]])); }
async function openMessage(p, id, folder = false) {
  const action = folder ? 'mail.folder.message.item.open' : 'mail.message.open';
  const selector = `${app} [data-action="${action}"][data-action-params='${JSON.stringify({ id })}']`;
  await hit(p, selector);
  await p.waitForFunction(({ app, id }) => [...document.querySelectorAll(`${app} [data-benchmark-message-id]`)].some(e => e.checkVisibility() && e.dataset.benchmarkMessageId === id), {}, { app, id });
}
async function chooseFolder(p, folder) {
  await hit(p, `${app} .mail-folder-launch`); await p.waitForSelector(`${app} .mail-folder-drawer`, { visible: true });
  const inboxCount = await p.$eval(`${app} .mail-folder-drawer [data-trigger="mail.folders.inbox"] small`, e => Number(e.textContent));
  const selector = folder === 'inbox' ? `${app} .mail-folder-drawer [data-trigger="mail.folders.inbox"]`
    : `${app} .mail-folder-drawer [data-trigger="mail.folders.select"][data-trigger-params='${JSON.stringify({ folder })}']`;
  await hit(p, selector); await p.waitForFunction(expected => window.__OS__.getAppRoute('mail').path === expected, {}, folder === 'inbox' ? '/' : '/folder/' + folder);
  await p.waitForSelector(`${app} .mail-folder-drawer`, { hidden: true }); return inboxCount;
}
async function archived(p, id, value, readerOpen = false) { await p.waitForFunction(({ id, value, readerOpen }) => window.__SIM__.getState().apps.mail.archived_message_ids.includes(id) === value
  && window.__SIM__.getState().apps.mail.selected_message_id === (readerOpen ? id : null), {}, { id, value, readerOpen }); }
async function restore(p, id) {
  await hit(p, `${app} .mail-reader-more`); await p.waitForSelector(`${app} .mail-reader-menu`, { visible: true });
  assert.equal(await p.$eval(`${app} .mlayout`, e => e.inert), true);
  await hit(p, `${app} .mail-reader-menu [data-mail-restore]`); await archived(p, id, false, true);
  await p.waitForSelector(`${app} .mail-reader-menu`, { hidden: true });
}
async function leaveReader(p) {
  await p.evaluate(() => window.__OS__.handleBack());
  await p.waitForFunction(() => window.__SIM__.getState().apps.mail.selected_message_id === null);
  await p.evaluate(() => new Promise(r => requestAnimationFrame(r)));
}
async function query(p, value, count) {
  const selector = `${app} [data-benchmark-field="mail-search"]`; await hit(p, selector);
  await p.keyboard.down('Control'); await p.keyboard.press('KeyA'); await p.keyboard.up('Control'); await p.keyboard.type(value);
  await p.keyboard.press('Enter');
  await p.waitForFunction(({ app, count }) => document.querySelector(`${app} [data-mail-search-count]`)?.dataset.mailSearchCount === String(count), {}, { app, count });
}
async function run(name, fn) {
  const context = await browser.createBrowserContext(), p = await context.newPage();
  p.on('pageerror', error => errors.push({ name, error: String(error) }));
  p.on('request', request => { if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) writes.push({ name, method: request.method(), url: request.url() }); });
  try { await fn(p); checks.push(name); console.log('PASS ' + name); }
  catch (error) { failures.push({ name, error: String(error.stack) }); console.error('FAIL ' + name + ': ' + error.stack); await p.screenshot({ path: path.join(output, `${name}-failure.png`) }).catch(() => {}); }
  finally { await context.close(); }
}
try {
  for (const locale of ['zh-Hans', 'en']) for (const posture of ['folded', 'unfolded']) {
    const tag = `${locale}-${posture}`;
    await run(`${tag}-inbox-all-reload-restore`, async p => {
      const baseline = await ready(p, locale, posture), id = baseline.messages[0].id;
      await openMessage(p, id); const before = await state(p);
      await hit(p, archive); await archived(p, id, true);
      assert.deepEqual(originalFacts(await state(p)), originalFacts(before));
      assert.equal(await p.$(`${app} [data-action="mail.message.open"][data-action-params='${JSON.stringify({ id })}']`), null);
      await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForFunction(() => window.__OS__ && window.__SIM__);
      await openPilotApp(p, 'mail', '/'); await p.waitForFunction(id => window.__SIM__.getState().apps.mail.archived_message_ids.includes(id), {}, id);
      assert.equal(await chooseFolder(p, 'all'), baseline.messages.length - 1); await openMessage(p, id, true);
      assert.equal(await p.$eval(archive, e => e.disabled), true);
      await p.screenshot({ path: path.join(output, `${tag}-archived-reader.png`) });
      await restore(p, id); await leaveReader(p);
      assert.equal(await chooseFolder(p, 'inbox'), baseline.messages.length);
      assert.deepEqual((await state(p)).messages, baseline.messages); assert.deepEqual((await state(p)).archived_message_ids, []);
    });
    await run(`${tag}-search-membership`, async p => {
      const baseline = await ready(p, locale, posture); await hit(p, `${app} .mail-search-launch`);
      await query(p, 'in:inbox', baseline.messages.length); await hit(p, `${app} .mail-search-results button`);
      await p.waitForSelector(archive, { visible: true }); const id = (await state(p)).selected_message_id;
      await hit(p, archive); await archived(p, id, true);
      await p.waitForFunction(({ app, count }) => document.querySelector(`${app} [data-mail-search-count]`)?.dataset.mailSearchCount === String(count), {}, { app, count: baseline.messages.length - 1 });
      assert.equal(new URLSearchParams((await route(p)).split('?')[1]).get('q'), 'in:inbox');
      await query(p, 'in:archive', 1); await hit(p, `${app} .mail-search-results button`); await p.waitForSelector(archive, { visible: true });
      assert.equal((await state(p)).selected_message_id, id); await restore(p, id); await leaveReader(p);
      await p.waitForFunction(app => document.querySelector(`${app} [data-mail-search-count]`)?.dataset.mailSearchCount === '0', {}, app);
      assert.equal(new URLSearchParams((await route(p)).split('?')[1]).get('q'), 'in:archive');
      assert.deepEqual((await state(p)).messages, baseline.messages);
    });
    await run(`${tag}-starred-source-retained`, async p => {
      const baseline = await ready(p, locale, posture), id = baseline.messages[0].id;
      await openMessage(p, id); await hit(p, `${app} .mail-reader-star`);
      await p.evaluate(() => window.__OS__.handleBack()); await p.waitForFunction(() => window.__SIM__.getState().apps.mail.selected_message_id === null);
      await chooseFolder(p, 'starred'); await openMessage(p, id, true);
      const before = await state(p); await hit(p, archive); await archived(p, id, true);
      assert.deepEqual(originalFacts(await state(p)), originalFacts(before));
      await openMessage(p, id, true); await restore(p, id); await leaveReader(p);
      assert.deepEqual((await state(p)).starred_message_ids, [id]); assert.deepEqual((await state(p)).messages, baseline.messages);
    });
    await run(`${tag}-background-and-modal-rejection`, async p => {
      const baseline = await ready(p, locale, posture), id = baseline.messages[0].id;
      await openMessage(p, id); const before = await state(p), retained = await p.$(archive), mailRoute = await route(p);
      await openPilotApp(p, 'clock', '/world'); await retained.evaluate(e => e.click());
      assert.deepEqual(await state(p), before); assert.equal(await route(p), mailRoute); await retained.dispose();
      await openPilotApp(p, 'mail', '/'); await p.waitForSelector(archive, { visible: true });
      await p.evaluate(app => { const root = document.querySelector(app), button = root.querySelector('.mail-reader-archive'); root.querySelector('.mail-folder-launch').click(); button.click(); }, app);
      await p.waitForFunction(() => window.__OS__.getAppRoute('mail').path.includes('drawer=open'));
      assert.deepEqual((await state(p)).archived_message_ids, []); assert.deepEqual((await state(p)).messages, baseline.messages);
    });
    await run(`${tag}-more-focus-escape-and-geometry`, async p => {
      const baseline = await ready(p, locale, posture); await openMessage(p, baseline.messages[0].id);
      const before = await state(p); await hit(p, `${app} .mail-reader-more`);
      await p.waitForSelector(`${app} .mail-reader-menu`, { visible: true });
      const geometry = await p.$eval(`${app} .mail-reader-menu`, panel => {
        const p = panel.getBoundingClientRect(), a = panel.closest('[data-app-id="mail"]').getBoundingClientRect();
        return { inside: p.left >= a.left && p.right <= a.right && p.top >= a.top && p.bottom <= a.bottom,
          restoreDisabled: panel.querySelector('[data-mail-restore]').disabled };
      });
      assert.equal(geometry.inside, true); assert.equal(geometry.restoreDisabled, true);
      for (let index = 0; index < 3; index++) { await p.keyboard.press('Tab'); assert.equal(await p.evaluate(() => !!document.activeElement?.closest('.mail-reader-menu')), true); }
      await p.keyboard.press('Escape'); await p.waitForSelector(`${app} .mail-reader-menu`, { hidden: true });
      await p.waitForFunction(() => document.activeElement?.classList.contains('mail-reader-more'));
      assert.deepEqual(await state(p), before);
    });
  }
  for (const source of ['/?menu=message', '/search/message/annotation_review_batch3?menu=message&q=in%3Aarchive&originFolder=all']) await run(`cold-menu-${source.startsWith('/?') ? 'empty' : 'search'}`, async p => {
    await ready(p, 'en', 'unfolded'); await p.evaluate(() => window.__OS__.closeApp('mail'));
    await openPilotApp(p, 'mail', source); await p.waitForSelector(`${app} .mail-reader-menu`, { visible: true });
    const expected = source.startsWith('/?') ? '/' : '/search/message/annotation_review_batch3?q=in%3Aarchive&originFolder=all';
    await p.keyboard.press('Escape'); await p.waitForSelector(`${app} .mail-reader-menu`, { hidden: true });
    await p.waitForFunction(expected => window.__OS__.getAppRoute('mail').path === expected, {}, expected);
    assert.equal(await route(p), expected);
  });
  for (const orientation of ['side_by_side', 'stacked']) await run(`${orientation}-more-confined-to-mail`, async p => {
    const baseline = await ready(p, 'en', 'unfolded'), id = baseline.messages[0].id;
    await openMessage(p, id); await hit(p, archive); await archived(p, id, true);
    await chooseFolder(p, 'all'); await openMessage(p, id, true); await openPilotApp(p, 'clock', '/world');
    await p.evaluate(orientation => {
      const tasks = window.__OS__.getState().tasks, mail = tasks.find(task => task.rootAppId === 'mail'), clock = tasks.find(task => task.rootAppId === 'clock');
      window.__FOLDAGENT__.setMultiWindow('split', mail.taskId, clock.taskId, .5, null, .5, orientation);
      window.__OS__.launchTaskById(mail.taskId);
    }, orientation);
    await p.waitForFunction(() => !document.getElementById('root').getAnimations({ subtree: true }).some(a => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity));
    await hit(p, `${app} .mail-reader-more`); await p.waitForSelector(`${app} .mail-reader-menu`, { visible: true });
    const confined = await p.evaluate(() => {
      const panel = document.querySelector('[data-app-id="mail"] .mail-reader-menu').getBoundingClientRect();
      const owner = document.querySelector('[data-app-id="mail"] .mroot').getBoundingClientRect(), peer = document.querySelector('[data-app-id="clock"]').getBoundingClientRect();
      const target = document.elementFromPoint(peer.x + peer.width / 2, peer.y + peer.height / 2);
      return { inside: panel.left >= owner.left && panel.right <= owner.right && panel.top >= owner.top && panel.bottom <= owner.bottom,
        peer: target?.closest('[data-app-id]')?.getAttribute('data-app-id') };
    });
    assert.deepEqual(confined, { inside: true, peer: 'clock' });
    const retained = await p.$(`${app} [data-mail-restore]`), before = await state(p), priorRoute = await route(p);
    await p.evaluate(() => window.__OS__.launchTaskById(window.__OS__.getState().tasks.find(task => task.rootAppId === 'clock').taskId));
    await retained.evaluate(e => e.click()); assert.deepEqual(await state(p), before); assert.equal(await route(p), priorRoute); await retained.dispose();
  });
} finally {
  await browser.close();
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ passed: !failures.length && !errors.length && !writes.length, url: url.href, checks, failures, errors, writes,
    scope: 'Local Mail archival membership, restore, folders/search/reload/source guards; no Gmail/SMTP, deletion, real mailbox synchronization or native-pixel certification' }, null, 2));
}
console.log(JSON.stringify({ output, checks, failures, errors, writes }, null, 2));
assert.deepEqual(failures, []); assert.deepEqual(errors, []); assert.deepEqual(writes, []);
