import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { openPilotApp } from '../browser-automation/pilot_app_navigation.mjs';
import { resolveBrowserExecutable } from '../browser-automation/browser.mjs';
const root = path.resolve(import.meta.dirname, '../..');
const frontend = fs.existsSync(path.join(root, 'foldmobilegym/package.json')) ? 'foldmobilegym' : 'mobilegym';
const require = createRequire(path.join(root, frontend, 'package.json'));
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3373/');
assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname) && !url.username && !url.password);
const browser = await require('puppeteer').launch({ headless: true, executablePath: resolveBrowserExecutable() });
const app = '[data-app-id="contacts"]';
const errors = [];
async function run(name, fn) {
  const context = await browser.createBrowserContext(), p = await context.newPage();
  p.on('pageerror', error => errors.push(`${name}: ${error}`));
  try {
    await p.setViewport({ width: 1440, height: 1100 }); await p.goto(url.href);
    await p.waitForFunction(() => window.__OS__ && window.__FOLDAGENT__);
    await p.evaluate(() => window.__FOLDAGENT__.setPosture('unfolded'));
    await openPilotApp(p, 'contacts', '/contact/c_alice');
    await p.click(`${app} .contacts-directory-search`);
    await p.type(`${app} .contacts-directory-search`, 'Alice');
    await p.waitForFunction(() => new URL(window.__OS__.getAppRoute('contacts').path, 'http://local').searchParams.get('q') === 'Alice');
    await fn(p); console.log('PASS', name);
  } finally { await context.close(); }
}
const back = p => p.evaluate(() => window.__OS__.handleBack());
async function dismissKeyboard(p) {
  await back(p);
  await p.waitForFunction(() => !window.__OS__.keyboard.getState().visible);
  await p.waitForSelector(`${app} .contacts-directory-header[data-search-active="true"]`);
  await p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
try {
  await run('keyboard-then-search-back', async p => {
    await dismissKeyboard(p); await back(p);
    await p.waitForSelector(`${app} .contacts-directory-header[data-search-active="false"]`);
    assert.equal(await p.$eval(`${app} .contacts-directory-search`, e => e.value), '');
    const route = await p.evaluate(() => window.__OS__.getAppRoute('contacts').path);
    assert.equal(route, '/contact/c_alice');
  });
  await run('menu-back-precedes-search-back', async p => {
    await dismissKeyboard(p); await p.click(`${app} [data-trigger="contact.menu.open"]`);
    await p.waitForSelector(`${app} [role="dialog"]`, { visible: true }); await back(p);
    await p.waitForSelector(`${app} [role="dialog"]`, { hidden: true });
    assert.equal(await p.$eval(`${app} .contacts-directory-search`, e => e.value), 'Alice');
    assert.equal(await p.$eval(`${app} .contacts-directory-header`, e => e.dataset.searchActive), 'true');
  });
  await run('folded-hidden-directory-does-not-intercept', async p => {
    await dismissKeyboard(p); await p.evaluate(() => window.__FOLDAGENT__.setPosture('folded'));
    await p.waitForFunction(() => !document.querySelector('[data-app-id="contacts"] .contacts-directory-search').checkVisibility());
    await back(p);
    await p.waitForFunction(() => !window.__OS__.getAppRoute('contacts').path.startsWith('/contact/c_alice'));
  });
  await run('stale-background-button-does-not-clear-query', async p => {
    await dismissKeyboard(p);
    const button = await p.$(`${app} .contacts-directory-header button`);
    await openPilotApp(p, 'clock', '/world');
    await button.evaluate(e => e.click()); await button.dispose();
    await p.evaluate(() => window.__OS__.launchTaskById(window.__OS__.getState().tasks.find(t => t.rootAppId === 'contacts').taskId));
    await p.waitForSelector(`${app} .contacts-directory-search`, { visible: true });
    assert.equal(await p.$eval(`${app} .contacts-directory-search`, e => e.value), 'Alice');
    assert.equal(await p.$eval(`${app} .contacts-directory-header`, e => e.dataset.searchActive), 'true');
  });
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
