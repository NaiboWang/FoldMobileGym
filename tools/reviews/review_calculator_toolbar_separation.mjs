// Disposable simulator profiles only; no private media or default/task changes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const root = path.resolve(import.meta.dirname, '../..');
const frontend = ['foldmobilegym', 'mobilegym'].find(name => fs.existsSync(path.join(root, name, 'package.json')));
const require = createRequire(path.join(root, frontend, 'package.json'));
const releaseHelpers = fs.existsSync(new URL('../browser-automation/pilot_app_navigation.mjs', import.meta.url));
const { openPilotApp } = await import(releaseHelpers ? '../browser-automation/pilot_app_navigation.mjs' : '../../foldmobilegym/tools/pilot_app_navigation.mjs');
const executablePath = process.env.FOLDAGENT_BROWSER_PATH || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium'].find(fs.existsSync);
assert.ok(executablePath);
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3457/');
assert.ok(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname) && !url.username && !url.password);
fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
const output = fs.mkdtempSync(path.join(root, 'artifacts/calculator-toolbar-'));
const browser = await require('puppeteer').launch({ headless: true, executablePath });
const app = '[data-app-id="calculator"]', field = app + ' [data-expression-editor] input';
const checks = [], failures = [];
const wait = page => page.evaluate(() => new Promise(resolve => setTimeout(resolve, 400)));
const state = page => page.evaluate(() => JSON.parse(JSON.stringify(window.__SIM__.getState().apps.calculator)));
async function open(page, id) {
  await openPilotApp(page, id, '/');
  if (id === 'calculator') await page.waitForSelector(app + ' .calculator-reference', { visible: true });
}
const modes = [
  { name: 'folded-full', posture: 'folded' }, { name: 'unfolded-full', posture: 'unfolded' },
  { name: 'folded-primary', posture: 'folded', split: true, ratio: .5 },
  { name: 'folded-secondary', posture: 'folded', split: true, ratio: .5, secondary: true },
  { name: 'folded-short-primary', posture: 'folded', split: true, ratio: .33 },
  { name: 'folded-short-secondary', posture: 'folded', split: true, ratio: .67, secondary: true },
  { name: 'unfolded-split', posture: 'unfolded', split: true, ratio: .5 },
  { name: 'folded-floating', posture: 'folded', floating: true },
  { name: 'unfolded-floating', posture: 'unfolded', floating: true },
];

async function geometry(page, name, phase) {
  const before = await state(page);
  const metrics = await page.$eval(app + ' .calculator-reference', element => {
    const rect = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
    const result = element.querySelector('[data-calculator-display]'), range = document.createRange();
    range.selectNodeContents(result);
    const tools = [...element.querySelectorAll('.calculator-history-open, [data-calculator-layout-toggle]')].map(button => {
      const r = button.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { ...rect(button), hit: hit === button || button.contains(hit) };
    });
    return { pane: rect(element.closest('[data-app-id]')), tools, result: rect(range), input: element.querySelector('input') ? rect(element.querySelector('input')) : null };
  });
  fs.writeFileSync(path.join(output, name + '.json'), JSON.stringify(metrics, null, 2));
  await page.screenshot({ path: path.join(output, name + '.png') });
  const toolbarBottom = Math.max(...metrics.tools.map(tool => tool.bottom));
  assert.equal(metrics.tools.length, 2);
  assert.ok(metrics.tools.every(tool => tool.hit && tool.y >= metrics.pane.y && tool.bottom <= metrics.pane.bottom), 'Both toolbar buttons must be visible and hit-testable');
  assert.ok(metrics.result.y >= toolbarBottom + 4, 'Result glyphs must start below the toolbar');
  assert.ok(metrics.result.height > 10 && metrics.result.bottom <= metrics.pane.bottom, 'Result glyphs must remain readable inside their Activity');
  if (metrics.input) assert.ok(metrics.input.y >= toolbarBottom + 4, 'Expression input must have its own row below the toolbar');
  const selector = phase === 'legacy' ? '.calculator-reference-keypad button[data-action]' : '[data-expression-key]';
  const buttons = await page.$$(app + ' ' + selector);
  assert.equal(buttons.length, phase === 'legacy' ? 19 : phase === 'scientific' ? 44 : 20);
  for (const button of buttons) {
    await button.evaluate(element => element.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
    const key = await button.evaluate(element => {
      const r = element.getBoundingClientRect(), pane = element.closest('[data-app-id]').getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { label: element.textContent, height: r.height, inside: r.x >= pane.x - 1 && r.y >= pane.y - 1 && r.right <= pane.right + 1 && r.bottom <= pane.bottom + 1, hit: element === hit || element.contains(hit) };
    });
    assert.ok(key.height >= 24 && key.inside && key.hit, 'Retained key must be readable/reachable inside its pane: ' + key.label);
    await button.dispose();
  }
  assert.equal(await page.evaluate(() => window.scrollY), 0);
  await page.$$eval(app + ' [data-scroll-container]', elements => elements.forEach(element => { element.scrollTop = 0; }));
  await page.click(app + ' [data-trigger="calculator.home.history.open"]');
  await page.waitForSelector(app + ' [data-calculator-history]', { visible: true });
  await page.evaluate(() => window.__OS__.handleBack());
  await page.waitForSelector(app + ' [data-calculator-history]', { hidden: true });
  assert.deepEqual(await state(page), before, 'Layout/scroll/history navigation must not change calculation data');
}

try {
  for (const locale of ['zh-Hans', 'en']) for (const mode of modes) {
    const context = await browser.createBrowserContext(), page = await context.newPage(), errors = [], writes = [];
    try {
      page.on('pageerror', error => errors.push(error.message));
      await page.setRequestInterception(true);
      page.on('request', request => {
        const target = new URL(request.url());
        if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.method());
        if ((target.origin === url.origin && ['GET', 'HEAD'].includes(request.method())) || ['blob:', 'data:'].includes(target.protocol)) request.continue(); else request.abort();
      });
      await page.setViewport({ width: 1440, height: 1100 }); await page.goto(url.href, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__OS__ && window.__SIM__ && window.__FOLDAGENT__);
      await page.evaluate(locale => { window.__OS__.locale.setLocale(locale); window.__FOLDAGENT__.setPosture('unfolded'); }, locale);
      await open(page, 'calculator');
      const task = await page.evaluate(() => window.__OS__.getState().activeTaskId);
      if (mode.split) {
        await open(page, 'clock'); const clock = await page.evaluate(() => window.__OS__.getState().activeTaskId);
        await page.evaluate(({ task, clock, mode }) => window.__FOLDAGENT__.setMultiWindow('split', mode.secondary ? clock : task, mode.secondary ? task : clock, mode.ratio), { task, clock, mode });
      }
      await page.evaluate(posture => window.__FOLDAGENT__.setPosture(posture), mode.posture);
      if (mode.floating) await page.evaluate(task => window.__FOLDAGENT__.setFloatingWindow(task, { x: .2, y: .12, width: .6, height: .35 }), task);
      await wait(page);
      for (const phase of ['legacy', 'scientific', 'basic']) {
        const name = `${locale}-${mode.name}-${phase}`;
        try {
          if (phase !== 'legacy') {
            await page.click(app + ' [data-calculator-layout-toggle]');
            await page.waitForSelector(field, { visible: true });
            if (phase === 'scientific') {
              await page.click(field); await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control'); await page.keyboard.type('80*2/3*.79');
              await page.waitForFunction(() => window.__SIM__.getState().apps.calculator.expressionEditor?.expression === '80*2/3*.79');
              await page.waitForFunction(selector => document.querySelector(selector)?.textContent === '42.13333333333333', {}, app + ' [data-calculator-display]');
            }
          }
          await wait(page); await geometry(page, name, phase);
          assert.deepEqual(errors, []); assert.deepEqual(writes, []);
          checks.push(name); console.log('PASS', name);
        } catch (error) { failures.push({ name, error: String(error.stack) }); console.error('FAIL', name, String(error)); }
      }
    } catch (error) { failures.push({ name: locale + '-' + mode.name + '-setup', error: String(error.stack), errors }); }
    finally { await context.close(); }
  }
} finally { await browser.close(); fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ passed: !failures.length, checks, failures }, null, 2)); }
console.log(JSON.stringify({ output, checks: checks.length, failures }));
if (failures.length) process.exitCode = 1;
