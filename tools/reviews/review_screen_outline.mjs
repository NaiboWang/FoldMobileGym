// Verify a host-side screen outline without changing the simulated screen geometry.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { resolveBrowserExecutable } from '../browser-automation/browser.mjs';
import { openPilotApp } from '../browser-automation/pilot_app_navigation.mjs';
const root = path.resolve(import.meta.dirname, '../..');
const frontend = fs.existsSync(path.join(root, 'foldmobilegym/package.json')) ? 'foldmobilegym' : 'mobilegym';
const require = createRequire(path.join(root, frontend, 'package.json'));
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3363/');
assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname) && !url.username && !url.password);
const browser = await require('puppeteer').launch({ headless: true, executablePath: resolveBrowserExecutable() });
const context = await browser.createBrowserContext(), page = await context.newPage(), errors = [];
page.on('pageerror', error => errors.push(String(error)));
async function check(label) {
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));
  const result = await page.$eval('#root', e => {
    const bounds = () => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; };
    const cs = getComputedStyle(e), before = bounds(), outline = [cs.outlineStyle, cs.outlineWidth, cs.outlineColor], border = cs.borderWidth;
    e.style.outline = 'none'; const without = bounds(); e.style.removeProperty('outline');
    return { before, without, outline, border };
  });
  assert.deepEqual(result.outline, ['solid', '2px', 'rgb(8, 8, 8)']);
  assert.equal(result.border, '0px'); assert.deepEqual(result.before, result.without);
  console.log('PASS', label, result.before.join(','));
}
try {
  await page.setViewport({ width: 1280, height: 960 }); await page.goto(url.href);
  await page.waitForFunction(() => window.__FOLDAGENT__ && window.__OS__);
  for (const posture of ['folded', 'unfolded']) { await page.evaluate(p => window.__FOLDAGENT__.setPosture(p), posture); await check(posture); }
  await openPilotApp(page, 'contacts', '/contact/c_alice'); await openPilotApp(page, 'clock', '/world');
  for (const orientation of ['side_by_side', 'stacked']) {
    await page.evaluate(orientation => {
      const tasks = window.__OS__.getState().tasks, contacts = tasks.find(t => t.rootAppId === 'contacts'), clock = tasks.find(t => t.rootAppId === 'clock');
      window.__FOLDAGENT__.setMultiWindow('split', contacts.taskId, clock.taskId, .5, null, .5, orientation);
    }, orientation);
    await check(orientation);
    assert.equal(await page.evaluate(() => document.documentElement.dataset.foldagentWindowMode), 'split');
  }
  assert.deepEqual(errors, []);
} finally { await context.close(); await browser.close(); }
