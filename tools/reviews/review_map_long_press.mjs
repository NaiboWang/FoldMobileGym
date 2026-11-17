// Actual mouse/touch input against the delivered offline SDK. No live geocoding/navigation.
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
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3325/');
assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname) && !url.username && !url.password);
const output = fs.mkdtempSync(path.join(root, 'artifacts/map-long-press-'));
const browser = await require('puppeteer').launch({ headless: true, executablePath: resolveBrowserExecutable() });
const app = '[data-app-id="map"]', checks = [], failures = [], errors = [], writes = [], sdkReads = [];
const selectedCase = process.env.FOLDAGENT_REVIEW_CASE || null, offlineModes = new WeakMap();
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const pin = p => p.evaluate(app => document.querySelector(`${app} .map-selected-place-chrome`)?.innerText.match(/图钉|Dropped pin/) != null, app);
const chromeCount = p => p.$$eval(`${app} .map-selected-place-chrome`, elements => elements.filter(e => e.checkVisibility()).length);
async function ready(p, locale = 'zh-Hans', posture = 'unfolded', touch = true) {
  p.on('console', message => {
    if (message.text().includes('[Map] 未配置 key')) offlineModes.set(p, true);
    if (message.text().includes('[Map] 检测到 Google Maps key')) offlineModes.set(p, false);
  });
  await p.setViewport({ width: 1440, height: 1100, hasTouch: touch }); await p.goto(url.href, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__OS__ && window.__SIM__ && window.__FOLDAGENT__);
  await p.evaluate(({ locale, posture }) => { window.__OS__.locale.setLocale(locale); window.__FOLDAGENT__.setPosture(posture); }, { locale, posture });
  await openPilotApp(p, 'map', '/'); await p.waitForFunction(() => window.__mapInstance?.getProjection());
  assert.equal(offlineModes.get(p), true, 'Gesture review requires the delivered no-key/offline mode, not a live Google account');
  await p.evaluate(() => {
    window.__mapPressGeocoders = 0; window.__mapPressClicks = 0;
    const Original = google.maps.Geocoder;
    google.maps.Geocoder = new Proxy(Original, { construct(target, args, newTarget) { window.__mapPressGeocoders++; return Reflect.construct(target, args, newTarget); } });
    window.__mapInstance.addListener('click', () => window.__mapPressClicks++);
    window.addEventListener('pointerdown', event => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-app-id="map"] .gm-style')) return;
      const map = window.__mapInstance, div = map.getDiv(), rect = div.getBoundingClientRect(), projection = map.getProjection(), center = projection.fromLatLngToPoint(map.getCenter());
      const x = (event.clientX - rect.x) * div.clientWidth / rect.width - div.clientWidth / 2;
      const y = (event.clientY - rect.y) * div.clientHeight / rect.height - div.clientHeight / 2;
      const coordinate = projection.fromPointToLatLng(new google.maps.Point(center.x + x / (2 ** map.getZoom()), center.y + y / (2 ** map.getZoom())));
      window.__mapPressLastDown = { clientX: event.clientX, clientY: event.clientY, coordinate: `${coordinate.lat().toFixed(5)}, ${coordinate.lng().toFixed(5)}` };
    }, { capture: true, passive: true });
  });
}
async function point(p, ordinal = 0) {
  await p.waitForFunction(app => document.querySelector(`${app} .gm-style`)?.getBoundingClientRect().width > 0, {}, app);
  return p.evaluate(({ app, ordinal }) => {
    const rect = document.querySelector(`${app} .gm-style`).getBoundingClientRect(), candidates = [];
    for (const y of [.3, .4, .25, .45]) for (const x of [.25, .7, .5, .12, .88]) {
      const p = { x: rect.x + rect.width * x, y: rect.y + rect.height * y }, target = document.elementFromPoint(p.x, p.y);
      if (target?.closest('.gm-style') && !target.closest('button,a,input,[role="button"],gmp-advanced-marker')) candidates.push(p);
    }
    if (!candidates.length) throw Error('No hit-testable real map surface'); return candidates[ordinal % candidates.length];
  }, { app, ordinal });
}
async function down(p, input, where) {
  if (input === 'touch') await p.touchscreen.touchStart(where.x, where.y);
  else { await p.mouse.move(where.x, where.y); await p.mouse.down(); }
}
async function up(p, input) { if (input === 'touch') await p.touchscreen.touchEnd(); else await p.mouse.up(); }
async function hold(p, input = 'touch', where) { const target = where ?? await point(p); await down(p, input, target); await pause(1000); await up(p, input); return target; }
async function click(p, input, where) {
  if (input === 'touch') await p.touchscreen.tap(where.x, where.y);
  else {
    // A real path exercises the SDK's hover hit-testing; teleport clicks are a separate retained SDK edge probe.
    await p.mouse.move(where.x, where.y, { steps: 10 }); await pause(80); await p.mouse.down(); await pause(80); await p.mouse.up();
  }
}
async function expectPin(p) { await p.waitForFunction(app => document.querySelector(`${app} .map-selected-place-chrome`)?.innerText.match(/图钉|Dropped pin/), {}, app); }
async function expectNoSelection(p) {
  await pause(1000); assert.equal(await pin(p), false); assert.equal(await chromeCount(p), 0);
}
async function invariants(p) {
  const state = await p.evaluate(() => window.__SIM__.getState().apps.map);
  return Object.fromEntries(['savedPlaces', 'searchHistory', 'currentLocation'].map(key => [key, state[key]]));
}
async function run(name, fn) {
  if (selectedCase && selectedCase !== name) return;
  const context = await browser.createBrowserContext(), p = await context.newPage();
  p.on('pageerror', error => errors.push({ name, error: String(error) }));
  const replayRequests = new Map();
  p.on('request', request => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) return;
    const uri = new URL(request.url());
    if (request.method() === 'POST' && uri.origin === 'https://maps.googleapis.com'
      && uri.pathname === '/$rpc/google.internal.maps.mapsjs.v1.MapsJsInternalService/GetViewportInfo') {
      const receipt = { name, method: 'POST', path: uri.pathname, status: null, fromServiceWorker: false };
      replayRequests.set(request, receipt); sdkReads.push(receipt);
    } else writes.push({ name, method: request.method(), origin: uri.origin, path: uri.pathname });
  });
  p.on('response', response => {
    const receipt = replayRequests.get(response.request());
    if (receipt) { receipt.status = response.status(); receipt.fromServiceWorker = response.fromServiceWorker(); }
  });
  try { await fn(p, context); checks.push(name); console.log('PASS ' + name); }
  catch (error) { failures.push({ name, error: String(error.stack) }); console.error('FAIL ' + name + ': ' + error.stack); await p.screenshot({ path: path.join(output, `${name}-failure.png`) }).catch(() => {}); }
  finally { await context.close(); }
}
try {
  for (const locale of ['zh-Hans', 'en']) for (const posture of ['folded', 'unfolded']) for (const input of ['mouse', 'touch']) {
    const name = `${locale}-${posture}-${input}-pin-release-coordinate-and-next-tap`;
    await run(name, async p => {
      await ready(p, locale, posture, input === 'touch'); const before = await invariants(p), target = await point(p);
      await hold(p, input, target); await expectPin(p); await pause(150); assert.equal(await pin(p), true);
      assert.equal(await p.$$eval(`${app} .animate-pulse`, elements => elements.filter(e => e.checkVisibility()).length), 0, 'No-key point must not remain a reverse-geocoding skeleton');
      assert.equal(await p.evaluate(() => window.__mapPressGeocoders), 0, 'No unsupported live geocoder may be constructed');
      const actual = await p.evaluate(() => window.__mapPressLastDown);
      assert.ok(actual, 'A real pointerdown must have been observed');
      assert.ok(await p.$eval(app, (e, coordinate) => e.textContent.includes(coordinate), actual.coordinate), 'Pin address must show the actual native down-point coordinate');
      assert.deepEqual(await invariants(p), before); await p.screenshot({ path: path.join(output, `${name}-pin.png`) });
      const clicks = await p.evaluate(() => window.__mapPressClicks); await click(p, input, await point(p, 1));
      await p.waitForFunction(clicks => window.__mapPressClicks > clicks, {}, clicks);
      await p.waitForFunction(app => !document.querySelector(`${app} .map-selected-place-chrome`)?.innerText.match(/图钉|Dropped pin/), {}, app);
      assert.deepEqual(await invariants(p), before);
    });
  }
  for (const posture of ['folded', 'unfolded']) await run(`${posture}-published-sim-input-long-press-and-next-tap`, async p => {
    await ready(p, 'zh-Hans', posture); const target = await point(p);
    await p.evaluate(({ x, y }) => window.__SIM_INPUT__.longPress(x, y, 1000, { coords: 'css' }), target); await expectPin(p);
    assert.equal(await p.evaluate(() => window.__mapPressGeocoders), 0);
    await p.evaluate(({ x, y }) => window.__SIM_INPUT__.tap(x, y, { coords: 'css' }), await point(p, 1));
    await p.waitForFunction(app => !document.querySelector(`${app} .map-selected-place-chrome`)?.innerText.match(/图钉|Dropped pin/), {}, app);
  });
  for (const input of ['mouse', 'touch']) await run(`${input}-short-tap-does-not-create-a-late-pin`, async p => {
    await ready(p, 'zh-Hans', 'unfolded', input === 'touch'); const target = await point(p); await down(p, input, target); await pause(150); await up(p, input); await pause(1000);
    assert.equal(await pin(p), false); assert.equal(await p.evaluate(() => window.__mapPressGeocoders), 0);
  });
  for (const posture of ['folded', 'unfolded']) await run(`${posture}-real-drag-pans-without-a-pin`, async p => {
    await ready(p, 'zh-Hans', posture, false); const target = await point(p), before = await p.evaluate(() => window.__mapInstance.getCenter().toJSON());
    await down(p, 'mouse', target); await pause(150); await p.mouse.move(target.x + 70, target.y + 10, { steps: 12 }); await pause(900); await p.mouse.up(); await expectNoSelection(p);
    const after = await p.evaluate(() => window.__mapInstance.getCenter().toJSON()); assert.ok(Math.hypot(after.lat - before.lat, after.lng - before.lng) > .000001);
  });
  await run('native-touch-cancel-cleans-pending-press-and-allows-the-next-hold', async p => {
    await ready(p); const target = await point(p), client = await p.createCDPSession();
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: target.x, y: target.y, id: 11 }] }); await pause(250);
    await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await expectNoSelection(p); await client.detach();
    await hold(p); await expectPin(p);
  });
  await run('two-finger-pinch-keeps-sdk-zoom-and-does-not-create-a-pin', async p => {
    await ready(p); const target = await point(p), client = await p.createCDPSession(), before = await p.evaluate(() => window.__mapInstance.getZoom());
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: target.x, y: target.y, id: 21 }, { x: target.x + 80, y: target.y, id: 22 }] });
    for (let step = 1; step <= 8; step++) { await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: target.x - step * 5, y: target.y, id: 21 }, { x: target.x + 80 + step * 5, y: target.y, id: 22 }] }); await pause(30); }
    await pause(850); await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await expectNoSelection(p);
    const after = await p.evaluate(() => window.__mapInstance.getZoom()); assert.ok(Math.abs(after - before) > .1); await client.detach();
  });
  await run('browser-focus-loss-does-not-drop-a-background-pin', async (p, context) => {
    await ready(p); await down(p, 'mouse', await point(p)); await pause(250); const other = await context.newPage(); await other.goto('about:blank'); await other.bringToFront();
    await pause(1000); assert.equal(await pin(p), false); await other.close(); await p.bringToFront(); await p.mouse.up();
    await hold(p, 'mouse'); await expectPin(p);
  });
  for (const posture of ['folded', 'unfolded']) await run(`${posture}-posture-change-cancels-old-geometry-hold`, async p => {
    await ready(p, 'zh-Hans', posture); await down(p, 'touch', await point(p)); await pause(250);
    await p.evaluate(posture => window.__FOLDAGENT__.setPosture(posture === 'folded' ? 'unfolded' : 'folded'), posture); await pause(900); await up(p, 'touch'); await expectNoSelection(p);
    await hold(p); await expectPin(p);
  });
  await run('source-route-change-cancels-the-pending-hold', async p => {
    await ready(p); await down(p, 'touch', await point(p)); await pause(250); await p.evaluate(() => window.__OS__.openApp('map', '/me')); await pause(900); await up(p, 'touch');
    assert.equal(await pin(p), false); assert.equal(await p.evaluate(() => window.__OS__.getAppRoute('map').path), '/me');
  });
  await run('launcher-or-another-foreground-task-rejects-a-pending-pin', async p => {
    await ready(p); await down(p, 'touch', await point(p)); await pause(250); await openPilotApp(p, 'clock', '/world'); await pause(900); await up(p, 'touch');
    assert.equal(await pin(p), false); assert.equal(await p.evaluate(() => window.__OS__.getState().tasks.find(t => t.taskId === window.__OS__.getState().activeTaskId)?.rootAppId), 'clock');
  });
  for (const orientation of ['side_by_side', 'stacked']) await run(`${orientation}-touch-pin-retains-pane-ownership`, async p => {
    await ready(p); await openPilotApp(p, 'clock', '/world'); await p.evaluate(orientation => {
      const tasks = window.__OS__.getState().tasks, map = tasks.find(t => t.rootAppId === 'map'), clock = tasks.find(t => t.rootAppId === 'clock');
      window.__FOLDAGENT__.setMultiWindow('split', map.taskId, clock.taskId, .5, null, .5, orientation); window.__OS__.launchTaskById(map.taskId);
    }, orientation);
    await hold(p); await expectPin(p); assert.equal(await p.evaluate(() => { const peer = document.querySelector('[data-app-id="clock"]').getBoundingClientRect();
      return document.elementFromPoint(peer.x + peer.width / 2, peer.y + peer.height / 2)?.closest('[data-app-id]')?.getAttribute('data-app-id'); }), 'clock');
    assert.equal(await p.evaluate(() => window.__mapPressGeocoders), 0);
  });
} finally {
  for (const receipt of sdkReads) if (!receipt.fromServiceWorker || receipt.status !== 200) failures.push({ name: receipt.name, error: 'SDK read RPC was not replayed successfully by the offline worker', receipt });
  if (selectedCase && !checks.length && !failures.length) failures.push({ name: selectedCase, error: 'No matching case executed' });
  await browser.close(); fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ passed: !failures.length && !errors.length && !writes.length,
    url: url.href, selectedCase, checks, failures, errors, writes, sdkReads, scope: 'Native PointerEvent long press, release/tap, pan/pinch/cancel, no-key point readiness and source-window ownership; SDK read POSTs require offline replay; not original image-race causality or complete native parity' }, null, 2));
  console.log(JSON.stringify({ passed: !failures.length && !errors.length && !writes.length, output, checks: checks.length, failures: failures.length, errors, writes }));
  if (failures.length || errors.length || writes.length) process.exitCode = 1;
}
