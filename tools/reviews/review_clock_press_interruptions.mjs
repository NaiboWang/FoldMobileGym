// Real browser pointer/wheel/touch sequences in disposable profiles. No default/task edits.
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
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3459/');
assert.ok(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname) && !url.username && !url.password);
fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
const output = fs.mkdtempSync(path.join(root, 'artifacts/clock-press-interrupt-'));
const browser = await require('puppeteer').launch({ headless: true, executablePath });
const checks = [], failures = [], app = '[data-app-id="clock"]';
const wait = (page, ms = 550) => page.evaluate(ms => new Promise(resolve => setTimeout(resolve, ms)), ms);
const route = page => page.evaluate(() => window.__OS__.getAppRoute('clock').path);
const data = page => page.evaluate(() => { const s = window.__SIM__.getState().apps.clock; return { alarms: s.alarms, selectedCityIds: s.selectedCityIds }; });
async function point(page, selector) {
  await page.waitForSelector(selector, { visible: true });
  await page.$eval(selector, element => element.scrollIntoView({ block: 'center' }));
  const box = await (await page.$(selector)).boundingBox();
  const location = { x: box.x + box.width * .28, y: box.y + box.height * .5 };
  await page.mouse.move(location.x, location.y); return location;
}
try {
  for (const posture of ['folded', 'unfolded']) for (const locale of ['zh-Hans', 'en']) for (const surface of ['alarm', 'world']) {
    const context = await browser.createBrowserContext(), page = await context.newPage(), errors = [], writes = [];
    try {
      page.on('pageerror', error => errors.push(error.message));
      await page.setRequestInterception(true);
      page.on('request', request => { const target = new URL(request.url()); if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.method()); if ((target.origin === url.origin && ['GET', 'HEAD'].includes(request.method())) || ['blob:', 'data:'].includes(target.protocol)) request.continue(); else request.abort(); });
      await page.setViewport({ width: 1440, height: 1100, hasTouch: true }); await page.goto(url.href, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__OS__ && window.__SIM__ && window.__FOLDAGENT__);
      await page.evaluate(({ posture, locale }) => { window.__FOLDAGENT__.setPosture(posture); window.__OS__.locale.setLocale(locale); }, { posture, locale });
      const baseline = await data(page), base = '/' + surface;
      const selector = app + ' [data-trigger="' + (surface === 'alarm' ? 'alarm.item' : 'world.city') + '.selection.enter"]';
      const client = await page.createCDPSession();
      for (const scenario of ['move', 'wheel', 'touch-cancel', 'hold', 'touch-hold']) {
        const name = `${posture}-${locale}-${surface}-${scenario}`;
        try {
          await openPilotApp(page, 'clock', base); const p = await point(page, selector);
          if (scenario.startsWith('touch-')) {
            await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] });
            if (scenario === 'touch-cancel') await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
          } else {
            await page.mouse.down();
            if (scenario === 'move') await page.mouse.move(p.x + 20, p.y, { steps: 4 });
            if (scenario === 'wheel') await page.mouse.wheel({ deltaY: 8 });
          }
          await wait(page);
          const held = scenario === 'hold' || scenario === 'touch-hold';
          const expected = held ? base + '?selection=' + (surface === 'alarm' ? 'alarms' : 'cities') : base;
          assert.equal(await route(page), expected, 'Only a stationary uninterrupted hold may enter selection');
          if (scenario === 'touch-hold') await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          else if (scenario !== 'touch-cancel') await page.mouse.up();
          assert.equal(await route(page), expected, 'A canceled hold must not leak a release click');
          if (held) { await page.evaluate(() => window.__OS__.handleBack()); await page.waitForFunction(base => window.__OS__.getAppRoute('clock').path === base, {}, base); }
          if (surface === 'alarm') {
            await point(page, selector); await page.mouse.down(); await page.mouse.up();
            await page.waitForFunction(() => new URLSearchParams(window.__OS__.getAppRoute('clock').path.split('?')[1]).get('panel') === 'quick');
            await page.evaluate(() => window.__OS__.handleBack()); await page.waitForFunction(base => window.__OS__.getAppRoute('clock').path === base, {}, base);
          }
          assert.deepEqual(await data(page), baseline); assert.deepEqual(errors, []); assert.deepEqual(writes, []);
          checks.push(name); console.log('PASS', name);
        } catch (error) { failures.push({ name, error: String(error.stack) }); console.error('FAIL', name, String(error)); }
        finally { await page.mouse.up().catch(() => {}); }
      }
    } catch (error) { failures.push({ name: `${posture}-${locale}-${surface}-setup`, error: String(error.stack), errors }); }
    finally { await context.close(); }
  }
} finally { await browser.close(); fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ passed: !failures.length, checks, failures }, null, 2)); }
console.log(JSON.stringify({ output, checks: checks.length, failures }));
if (failures.length) process.exitCode = 1;
