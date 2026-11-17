import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { openPilotApp } from '../browser-automation/pilot_app_navigation.mjs';
import { resolveBrowserExecutable } from '../browser-automation/browser.mjs';
fs.mkdirSync(path.resolve(import.meta.dirname, '../../artifacts'), {recursive:true});
const root = path.resolve(import.meta.dirname, '../..');
const require = createRequire(path.join(root, 'foldmobilegym/package.json'));
const output = fs.mkdtempSync(path.join(root, 'artifacts/calendar-home-navigation-'));
const browser = await require('puppeteer').launch({ headless: true, executablePath: resolveBrowserExecutable() });
const page = await browser.newPage(), errors = [];
page.on('pageerror', error => errors.push(error.message));
const app = '[data-app-id="calendar"]';
const state = () => page.evaluate(() => window.__SIM__.getState().apps.calendar);
const pause = () => new Promise(resolve => setTimeout(resolve, 400));
const views = ['year', 'month', 'week', 'day'], labels = ['年', '月', '周', '日'];
async function choose(view) { const buttons = await page.$$(`${app} .calendar-reference-nav button`); await buttons[views.indexOf(view)].click(); await pause(); }
async function assertView(view) {
  assert.equal(await page.$eval(`${app} .calendar-reference-nav [aria-current="page"]`, el => el.textContent.trim()), labels[views.indexOf(view)], `Return must retain ${view} view`);
}
async function jumpDate(value) {
  await page.click(`${app} button[aria-label="更多"]`); await pause();
  await page.click(`${app} [data-trigger="date-jump.open"]`);
  await page.waitForSelector(`${app} input[type="date"]`, { visible: true });
  await page.$eval(`${app} input[type="date"]`, (el, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
  await page.click(`${app} [data-action="calendar.dateJump.submit"]`); await pause();
}
async function synthetic(events) {
  await page.$eval(`${app} .calendar-month-grid-pane`, (el, events) => {
    const r = el.getBoundingClientRect();
    for (const [type, id, x, y, button = 0] of events) el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: id, isPrimary: id === 11, pointerType: 'touch', button, clientX: r.left + x, clientY: r.top + y }));
  }, events);
}
try {
  await page.setViewport({ width: 1600, height: 1200 });
  await page.goto(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3188/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__OS__ && window.__SIM__ && window.__FOLDAGENT__);
  await openPilotApp(page, 'calendar');
  if (process.env.FOLDAGENT_REVIEW_PHASE !== 'gesture') {
    await page.click(`${app} button[aria-label="新建"]`);
    await page.waitForSelector(`${app} [data-benchmark-field="calendar-title"]`, { visible: true });
    await page.type(`${app} [data-benchmark-field="calendar-title"]`, 'Unsaved view return review');
    await page.evaluate(() => { document.activeElement?.blur(); window.__OS__.keyboard.hide(); });
    await page.evaluate(() => window.__OS__.handleBack()); await pause();
    await page.waitForSelector(`${app} .calendar-discard-prompt`, { visible: true });
    await page.click(`${app} [data-action="calendar.new.discard.submit"]`);
    await page.waitForSelector(`${app} [data-benchmark-field="calendar-title"]`, { hidden: true });
  }
  const original = await state();
  await page.evaluate(() => {
    window.__CALENDAR_GESTURE_TRACE__ = [];
    window.__CALENDAR_MONTH_ACTIONS__ = [];
    window.addEventListener('mobilegym:agent-action', event => { if (event.detail.id === 'calendar.home.month.shift') window.__CALENDAR_MONTH_ACTIONS__.push(event.detail.params); });
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'pointerout', 'gotpointercapture', 'lostpointercapture']) {
      document.addEventListener(type, event => { if (event.target.closest?.('[data-app-id="calendar"]')) window.__CALENDAR_GESTURE_TRACE__.push({ type, pointerType: event.pointerType, id: event.pointerId, primary: event.isPrimary, button: event.button, x: event.clientX, y: event.clientY, target: event.target.className }); }, true);
    }
  });
  if (process.env.FOLDAGENT_REVIEW_PHASE !== 'gesture') {
    await choose('month');
    const initialKey = await page.$eval(`${app} .calendar-month-grid-pane [data-calendar-selected="true"]`, el => el.dataset.benchmarkDate);
    await choose('day');
    await page.click(`${app} button[aria-label="新建"]`); await pause();
    await page.evaluate(() => window.__OS__.handleBack()); await pause(); await assertView('day');
    await jumpDate(original.events[0].start.slice(0, 10));
    await page.click(`${app} [data-scroll-container="main"] [data-trigger="event.open"]`); await pause();
    assert.equal(await page.$eval(`${app} [data-benchmark-source-id]`, el => el.dataset.benchmarkSourceId), original.events[0].id);
    await page.evaluate(() => window.__OS__.handleBack()); await pause(); await assertView('day');
    await jumpDate(initialKey);
    await choose('week'); await page.click(`${app} button[aria-label="搜索日程"]`);
    await page.waitForSelector(`${app} input`, { visible: true });
    await page.evaluate(() => window.__OS__.handleBack()); await pause(); await assertView('week');
    for (const posture of ['folded', 'unfolded']) {
      await page.evaluate(value => window.__FOLDAGENT__.setPosture(value), posture); await pause();
      for (const view of views) {
        await choose(view);
        for (const label of ['搜索日程', '新建']) {
          await page.click(`${app} button[aria-label="${label}"]`); await pause();
          await page.evaluate(() => window.__OS__.handleBack()); await pause(); await assertView(view);
        }
        await page.click(`${app} button[aria-label="更多"]`); await pause();
        await page.click(`${app} [data-trigger="settings.open"]`); await pause();
        await page.evaluate(() => window.__OS__.handleBack()); await pause(); await assertView(view);
        await page.click(`${app} button[aria-label="更多"]`); await pause();
        await page.click(`${app} [data-trigger="date-jump.open"]`); await pause();
        await page.click(`${app} [data-action="calendar.dateJump.submit"]`); await pause(); await assertView(view);
        await page.evaluate(value => window.__FOLDAGENT__.setPosture(value), posture === 'folded' ? 'unfolded' : 'folded'); await pause();
        await assertView(view);
        await page.screenshot({ path: path.join(output, `${posture}-${view}.png`) });
        await page.evaluate(value => window.__FOLDAGENT__.setPosture(value), posture); await pause();
      }
    }
  }
  await choose('month');
  const originalKey = await page.$eval(`${app} .calendar-month-grid-pane [data-calendar-selected="true"]`, el => el.dataset.benchmarkDate);
  await choose('year');
  const monthParams = await page.$eval(`${app} button[aria-current="date"]`, el => JSON.parse(el.dataset.triggerParams));
  assert.equal(monthParams.view, 'month'); assert.equal(typeof monthParams.month, 'number');
  await page.click(`${app} button[aria-current="date"]`); await pause(); await assertView('month');
  assert.equal(await page.$eval(`${app} .calendar-month-grid-pane [data-calendar-selected="true"]`, el => el.dataset.benchmarkDate), `${originalKey.slice(0, 7)}-01`);
  await page.click(`${app} [data-benchmark-date="${originalKey}"]`); await pause();
  await page.click(`${app} .calendar-reference-title`); await pause(); await assertView('year');
  await page.click(`${app} .calendar-reference-title`); await pause(); await assertView('month');
  const before = await state();
  await synthetic([['pointerdown', 11, 240, 80], ['pointerup', 22, 80, 80]]);
  assert.equal((await state()).selectedDateTs, before.selectedDateTs, 'A foreign pointer must not shift the month');
  await synthetic([['pointercancel', 11, 240, 80]]);
  for (const events of [
    [['pointerdown', 11, 240, 80], ['pointercancel', 11, 80, 80], ['pointerup', 11, 80, 80]],
    [['pointerdown', 11, 240, 80], ['pointerout', 11, 80, 80], ['pointerup', 11, 80, 80]],
    [['pointerdown', 11, 240, 80, 2], ['pointerup', 11, 80, 80, 2]],
    [['pointerdown', 11, 240, 80], ['pointerup', 11, 220, 180]],
  ]) { await synthetic(events); assert.equal((await state()).selectedDateTs, before.selectedDateTs, JSON.stringify(events)); }
  assert.deepEqual(await page.evaluate(() => window.__CALENDAR_MONTH_ACTIONS__), []);
  for (const posture of ['folded', 'unfolded']) {
    await page.evaluate(value => window.__FOLDAGENT__.setPosture(value), posture); await pause();
    const date = (await state()).selectedDateTs;
    await synthetic([['pointerdown', 11, 240, 80]]);
    await page.evaluate(value => window.__FOLDAGENT__.setPosture(value), posture === 'folded' ? 'unfolded' : 'folded'); await pause();
    await synthetic([['pointerup', 11, 80, 80]]);
    assert.equal((await state()).selectedDateTs, date, 'A changed activity footprint invalidates the in-flight gesture');
    await page.evaluate(value => window.__FOLDAGENT__.setPosture(value), posture); await pause();
    const selectedKey = await page.$eval(`${app} .calendar-month-grid-pane [data-calendar-selected="true"]`, el => el.dataset.benchmarkDate);
    const cell = await page.$(`${app} .calendar-month-grid-pane [data-calendar-selected="true"]`);
    const r = await cell.boundingBox();
    const x = r.x + r.width / 2, y = r.y + r.height / 2;
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x - 110, y, { steps: 10 }); await page.mouse.up(); await pause();
    const shifted = await state();
    assert.notEqual(shifted.selectedDateTs, date, 'Real mouse swipe must move to the next month');
    await page.mouse.move(x - 110, y); await page.mouse.down(); await page.mouse.move(x, y, { steps: 10 }); await page.mouse.up(); await pause();
    assert.equal((await state()).selectedDateTs, date, 'Reverse swipe must return without selecting an incidental day');
    const touch = await page.createCDPSession();
    await touch.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
    for (const [from, to] of [[x, x - 110], [x - 110, x]]) {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from, y }] });
      for (let step = 1; step <= 10; step++) {
        await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from + (to - from) * step / 10, y }] });
      }
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await pause();
      if (to < from) {
        assert.equal((await state()).selectedDateTs, shifted.selectedDateTs, 'Native touch must actually advance one month');
        await page.screenshot({ path: path.join(output, `${posture}-touch-forward.png`) });
      }
    }
    assert.equal((await state()).selectedDateTs, date, 'Native touch swipes return without an incidental date selection');
    await touch.detach();
    const alternative = (await page.$$eval(`${app} .calendar-month-grid-pane [data-benchmark-date]`, els => els.map(el => el.dataset.benchmarkDate))).find(key => key !== selectedKey && key.startsWith(selectedKey.slice(0, 7)));
    await page.click(`${app} [data-benchmark-date="${alternative}"]`); await pause();
    assert.equal(await page.$eval(`${app} .calendar-month-grid-pane [data-calendar-selected="true"]`, el => el.dataset.benchmarkDate), alternative, 'Ordinary date taps remain usable');
    await page.click(`${app} [data-benchmark-date="${selectedKey}"]`); await pause();
    assert.equal((await state()).selectedDateTs, date);
  }
  assert.deepEqual((await state()).events, original.events); assert.deepEqual((await state()).draft, original.draft);
  for (const key of ['selectedDateTs', 'created_count', 'deleted_count', 'mutation_count']) assert.equal((await state())[key], original[key]);
  assert.deepEqual(await page.evaluate(() => window.__CALENDAR_MONTH_ACTIONS__.map(action => action.delta)), [1, -1, 1, -1, 1, -1, 1, -1]);
  await page.evaluate(() => window.__OS__.handleBack()); await pause();
  assert.equal(await page.evaluate(() => window.__OS__.getState().activeAppId), null, 'View switches must not add root back entries');
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, 'pointer-trace.json'), JSON.stringify(await page.evaluate(() => window.__CALENDAR_GESTURE_TRACE__), null, 2));
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ passed: true, errors, checks: ['four view returns after search/editor/settings/date-jump and posture retention', 'foreign/cancel/leave/right-button and mid-fold gesture isolation', 'real mouse/native touch month movement without accidental day click', 'ordinary date taps still work', 'one benchmark action per completed swipe', 'event records and unsaved draft unchanged'] }, null, 2));
  console.log(JSON.stringify({ passed: true, output }));
} catch (error) {
  await page.screenshot({ path: path.join(output, 'failure.png') });
  fs.writeFileSync(path.join(output, 'pointer-trace.json'), JSON.stringify(await page.evaluate(() => window.__CALENDAR_GESTURE_TRACE__), null, 2));
  console.error(output); throw error;
}
finally { await browser.close(); }
