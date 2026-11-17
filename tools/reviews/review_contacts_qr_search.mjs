// QR must not discard the currently filtered contact directory; synthetic data only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { openPilotApp } from '../browser-automation/pilot_app_navigation.mjs';
import { resolveBrowserExecutable } from '../browser-automation/browser.mjs';
const root = path.resolve(import.meta.dirname, '../..');
const frontend = fs.existsSync(path.join(root, 'foldmobilegym/package.json')) ? 'foldmobilegym' : 'mobilegym';
const require = createRequire(path.join(root, frontend, 'package.json'));
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3365/');
assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname) && !url.username && !url.password);
const browser = await require('puppeteer').launch({ headless: true, executablePath: resolveBrowserExecutable() });
const app = '[data-app-id="contacts"]', dialog = `${app} [role="dialog"]`, errors = [];
async function run(name, fn) {
  const context = await browser.createBrowserContext(), p = await context.newPage();
  p.on('pageerror', error => errors.push(`${name}: ${error}`));
  try { await p.setViewport({ width: 1440, height: 1100 }); await p.goto(url.href);
    await p.waitForFunction(() => window.__OS__ && window.__FOLDAGENT__); await fn(p); console.log('PASS', name);
  } finally { await context.close(); }
}
async function state(p) { return p.evaluate(() => { const route = window.__OS__.getAppRoute('contacts').path; const u = new URL(route, 'http://local'); return { path: u.pathname, q: u.searchParams.get('q'), modal: u.searchParams.get('modal'), fav: u.searchParams.get('fav') }; }); }
async function openQr(p) { await p.click(`${app} [data-trigger="contact.qr.open"]`); await p.waitForSelector(`${dialog} img`, { visible: true }); }
try {
  await run('unfolded-typed-directory-query-and-qr-close', async p => {
    await p.evaluate(() => window.__FOLDAGENT__.setPosture('unfolded'));
    await openPilotApp(p, 'contacts', '/contact/c_alice'); await p.click(`${app} .contacts-directory-search`);
    await p.type(`${app} .contacts-directory-search`, 'Alice');
    await p.waitForFunction(() => new URL(window.__OS__.getAppRoute('contacts').path, 'http://local').searchParams.get('q') === 'Alice');
    await p.evaluate(() => window.__OS__.handleBack()); await p.waitForFunction(() => !window.__OS__.keyboard.getState().visible);
    await openQr(p); assert.deepEqual(await state(p), { path: '/contact/c_alice', q: 'Alice', modal: 'qr', fav: null });
    await p.click(`${dialog} button`); await p.waitForSelector(dialog, { hidden: true });
    assert.deepEqual(await state(p), { path: '/contact/c_alice', q: 'Alice', modal: null, fav: null });
    assert.equal(await p.$eval(`${app} .contacts-directory-search`, e => e.value), 'Alice');
  });
  await run('rapid-type-immediately-open-qr', async p => {
    await p.evaluate(() => window.__FOLDAGENT__.setPosture('unfolded'));
    await openPilotApp(p, 'contacts', '/contact/c_alice');
    await p.click(`${app} .contacts-directory-search`);
    await p.type(`${app} .contacts-directory-search`, 'Alice');
    await openQr(p);
    assert.deepEqual(await state(p), { path: '/contact/c_alice', q: 'Alice', modal: 'qr', fav: null });
    await p.click(`${dialog} button`); await p.waitForSelector(dialog, { hidden: true });
    assert.deepEqual(await state(p), { path: '/contact/c_alice', q: 'Alice', modal: null, fav: null });
  });
  await run('rapid-type-clear-and-external-source-switch', async p => {
    await p.evaluate(() => window.__FOLDAGENT__.setPosture('unfolded'));
    await openPilotApp(p, 'contacts', '/contact/c_alice');
    await p.click(`${app} .contacts-directory-search`);
    await p.type(`${app} .contacts-directory-search`, 'Alice');
    await p.waitForFunction(() => new URL(window.__OS__.getAppRoute('contacts').path, 'http://local').searchParams.get('q') === 'Alice');
    assert.equal(await p.$eval(`${app} .contacts-directory-search`, e => e.value), 'Alice');
    await p.keyboard.down('Control'); await p.keyboard.press('KeyA'); await p.keyboard.up('Control'); await p.keyboard.press('Backspace');
    await p.waitForFunction(() => !new URL(window.__OS__.getAppRoute('contacts').path, 'http://local').searchParams.has('q'));
    assert.equal(await p.$eval(`${app} .contacts-directory-search`, e => e.value), '');
    await p.type(`${app} .contacts-directory-search`, 'Bob');
    await p.waitForFunction(() => new URL(window.__OS__.getAppRoute('contacts').path, 'http://local').searchParams.get('q') === 'Bob');
    await p.evaluate(() => window.__OS__.keyboard.hide());
    await openPilotApp(p, 'contacts', '/contact/c_bob?q=Alice');
    await p.waitForFunction(app => document.querySelector(`${app} .contacts-directory-search`)?.value === 'Alice', {}, app);
  });
  await run('folded-favorite-query-and-system-back', async p => {
    await p.evaluate(() => window.__FOLDAGENT__.setPosture('folded'));
    await openPilotApp(p, 'contacts', '/contact/c_alice?fav=true&q=Alice'); await openQr(p);
    assert.deepEqual(await state(p), { path: '/contact/c_alice', q: 'Alice', modal: 'qr', fav: 'true' });
    await p.evaluate(() => window.__OS__.handleBack()); await p.waitForSelector(dialog, { hidden: true });
    assert.deepEqual(await state(p), { path: '/contact/c_alice', q: 'Alice', modal: null, fav: 'true' });
  });
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
