// Disposable synthetic-contact review; no private reference media or real communications.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { openPilotApp } from '../browser-automation/pilot_app_navigation.mjs';
import { resolveBrowserExecutable } from '../browser-automation/browser.mjs';
const root = path.resolve(import.meta.dirname, '../..');
const frontend = fs.existsSync(path.join(root, 'foldmobilegym/package.json')) ? 'foldmobilegym' : 'mobilegym';
const require = createRequire(path.join(root, frontend, 'package.json'));
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3360/');
assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname) && !url.username && !url.password);
const browser = await require('puppeteer').launch({ headless: true, executablePath: resolveBrowserExecutable() });
const app = '[data-app-id="contacts"]', dialog = `${app} [role="dialog"]`, opener = `${app} [data-trigger="contact.qr.open"]`;
const errors = [];
async function run(name, fn) {
  const context = await browser.createBrowserContext(), page = await context.newPage();
  page.on('pageerror', error => errors.push(`${name}: ${error}`));
  try {
    await page.setViewport({ width: 1440, height: 1100 }); await page.goto(url.href);
    await page.waitForFunction(() => window.__OS__ && window.__FOLDAGENT__);
    await fn(page); console.log('PASS', name);
  } finally { await context.close(); }
}
async function openQr(page) {
  await page.click(opener); await page.waitForSelector(`${dialog} img`, { visible: true });
}
async function geometry(page) {
  return page.evaluate(({ dialog, opener }) => {
    const d = document.querySelector(dialog), a = d.getBoundingClientRect(), b = d.closest('[data-app-id]').getBoundingClientRect();
    return { focus: d.contains(document.activeElement), inert: !!document.querySelector(opener)?.closest('[inert]'),
      inside: a.left >= b.left && a.right <= b.right && a.top >= b.top && a.bottom <= b.bottom };
  }, { dialog, opener });
}
try {
  for (const posture of ['folded', 'unfolded']) for (const locale of ['zh-Hans', 'en']) for (const favorite of [false, true]) {
    await run(`${posture}-${locale}-${favorite ? 'favorite' : 'directory'}`, async p => {
      await p.evaluate(({ posture, locale }) => { window.__OS__.locale.setLocale(locale); window.__FOLDAGENT__.setPosture(posture); }, { posture, locale });
      const detail = `/contact/c_alice${favorite ? '?fav=true' : ''}`;
      await openPilotApp(p, 'contacts', detail); await openQr(p);
      assert.deepEqual(await geometry(p), { focus: true, inert: true, inside: true });
      await p.keyboard.press('Tab'); assert.equal((await geometry(p)).focus, true);
      await p.keyboard.down('Shift'); await p.keyboard.press('Tab'); await p.keyboard.up('Shift'); assert.equal((await geometry(p)).focus, true);
      await p.$eval(opener, e => e.focus()); assert.equal((await geometry(p)).focus, true);
      await p.keyboard.press('Escape'); await p.waitForSelector(dialog, { hidden: true });
      await p.waitForFunction(detail => window.__OS__.getAppRoute('contacts').path === detail && document.activeElement?.getAttribute('data-trigger') === 'contact.qr.open', {}, detail);
    });
  }
  for (const orientation of ['side_by_side', 'stacked']) await run(`split-${orientation}`, async p => {
    await p.evaluate(() => window.__FOLDAGENT__.setPosture('unfolded'));
    await openPilotApp(p, 'contacts', '/contact/c_alice'); await openPilotApp(p, 'clock', '/world');
    await p.evaluate(orientation => {
      const tasks = window.__OS__.getState().tasks, contacts = tasks.find(t => t.rootAppId === 'contacts'), clock = tasks.find(t => t.rootAppId === 'clock');
      window.__FOLDAGENT__.setMultiWindow('split', contacts.taskId, clock.taskId, .5, null, .5, orientation); window.__OS__.launchTaskById(contacts.taskId);
    }, orientation);
    await openQr(p); assert.deepEqual(await geometry(p), { focus: true, inert: true, inside: true });
    assert.equal(await p.evaluate(() => { const peer = document.querySelector('[data-app-id="clock"]').getBoundingClientRect();
      return document.elementFromPoint(peer.x + peer.width / 2, peer.y + peer.height / 2)?.closest('[data-app-id]')?.getAttribute('data-app-id'); }), 'clock');
    const retained = await p.$(`${dialog} button`);
    await p.evaluate(() => window.__OS__.launchTaskById(window.__OS__.getState().tasks.find(t => t.rootAppId === 'clock').taskId));
    await retained.evaluate(e => e.click()); await retained.dispose();
    assert.equal(await p.evaluate(() => window.__OS__.getAppRoute('contacts').path), '/contact/c_alice?modal=qr');
  });
  await run('changed-and-deleted-contact', async p => {
    await openPilotApp(p, 'contacts', '/contact/c_alice?modal=qr'); await p.waitForSelector(`${dialog} img`, { visible: true });
    const old = await p.$eval(`${dialog} img`, e => e.src);
    await p.evaluate(() => window.__OS__.content.update('content://contacts/contacts/c_alice', { displayName: 'Temporary synthetic name' }));
    await p.waitForFunction(({ dialog, old }) => { const image = document.querySelector(`${dialog} img`); return image && image.src !== old; }, {}, { dialog, old });
    await p.evaluate(() => window.__OS__.content.delete('content://contacts/contacts/c_alice'));
    await p.waitForSelector(dialog, { hidden: true }); await p.waitForFunction(app => document.querySelector(app)?.innerText.includes('联系人不存在'), {}, app);
  });
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
