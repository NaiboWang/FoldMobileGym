/** Real browser regression; no paid API. DOM reads only calibrate test actions.
 * Uses the same start/capture/swipe transport as foldagent/run.mjs.
 * Usage: node foldagent/tests/split_windows.mjs [http://127.0.0.1:3100/] [--initial-only]
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { materializeInput, parseArgs } from '../run.mjs';
import { resolveBrowserExecutable, startEpisode, captureAgentScreen, executeAction } from '../../foldagent_runtime/browser_executor.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const require = createRequire(path.join(root, 'foldmobilegym/package.json'));
const output = path.join(root, 'foldagent/runs', `split_windows_${Date.now()}`);
fs.mkdirSync(output, { recursive: true });
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'foldagent/examples', name), 'utf8'));
const base = read('calculator.task.json');
base.apps = ['calculator', 'notes'];
base.initial_window = { ...base.initial_window, mode: 'split', split_apps: ['calculator', 'notes'], split_orientation: 'side_by_side', divider_ratio: 0.6 };
const seed = read('calculator.seed.json');
seed.apps.notes = {}; // Restore registered defaults, no answer injected.
const seedFile = path.join(output, 'seed.json');
fs.writeFileSync(seedFile, JSON.stringify(seed));
const browser = await require('puppeteer').launch({ headless: true, executablePath: resolveBrowserExecutable(),
  args: ['--disable-gpu', '--no-first-run', '--no-default-browser-check', '--mute-audio', '--no-sandbox'],
  defaultViewport: { width: 1440, height: 1100, deviceScaleFactor: 1 } });
const results = [];
const pageErrors = [];
let page, cdp;
const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function screenshot(name) {
  await page.waitForFunction(() => !document.getElementById('root').getAnimations().length);
  const shot = await captureAgentScreen(cdp);
  fs.writeFileSync(path.join(output, `${name}.jpg`), Buffer.from(shot.data, 'base64'));
  return shot;
}
async function setup(orientation, focused = 'calculator', runSeed = 0) {
  const task = structuredClone(base);
  task.initial_window.split_orientation = orientation;
  task.initial_window.focused_app = focused;
  const taskFile = path.join(output, 'task.json');
  fs.writeFileSync(taskFile, JSON.stringify(task));
  const episode = materializeInput(parseArgs(['--task-file', taskFile, '--seed-file', seedFile, '--run-seed', String(runSeed), '--check']));
  const report = await startEpisode(cdp, episode);
  assert.equal(report.step, 0);
  assert.equal(report.passed, false, 'Fixture must not already satisfy the calculator goal');
  assert.deepEqual(report.effective_window, { ...task.initial_window,
    posture: runSeed === 0 ? 'unfolded' : 'folded', layout: runSeed === 0 ? 'inner_wide' : 'cover_single',
    split_orientation: runSeed === 0 ? orientation : 'stacked' });
  return report;
}
async function panes() {
  return page.evaluate(() => {
    const root = document.getElementById('root').getBoundingClientRect();
    const visible = [...document.querySelectorAll('[data-app-id]')].filter(node => {
      const r = node.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(node).visibility !== 'hidden';
    }).map(node => { const r = node.getBoundingClientRect(); return {
      app: node.dataset.appId, pane: node.dataset.foldagentPane, id: node.id,
      x: (r.x - root.x) / root.width, y: (r.y - root.y) / root.height,
      width: r.width / root.width, height: r.height / root.height,
    }; });
    return { visible, os: window.__OS__.getState(), foldable: window.__FOLDAGENT__.getState() };
  });
}
async function action(args) {
  await page.waitForFunction(() => !document.getElementById('root').getAnimations().length);
  const shot = await captureAgentScreen(cdp);
  const record = await executeAction(cdp, args, { screenBounds: shot.bounds });
  assert.equal(record.valid, true);
  await page.evaluate(async record => {
    await window.__FOLDAGENT_BENCH__.recordAgentAction(record);
    await window.__FOLDAGENT_BENCH__.flush();
  }, record);
  await frames();
}
async function calculatorKey(label) {
  const coordinate = await page.evaluate(label => {
    const button = [...document.querySelectorAll('.calculator-reference button')].find(node => node.textContent.trim() === label);
    if (!button) throw Error(`Missing calculator key ${label}`);
    const root = document.getElementById('root').getBoundingClientRect(), r = button.getBoundingClientRect();
    return [(r.x + r.width / 2 - root.x) / root.width * 1000, (r.y + r.height / 2 - root.y) / root.height * 1000];
  }, label);
  await action({ action: 'click', coordinate });
}
async function assertSurvivor(before, survivorApp) {
  const after = await panes();
  const original = before.visible.find(pane => pane.app === survivorApp);
  assert.equal(after.visible.length, 1);
  assert.equal(after.visible[0].app, survivorApp);
  assert.equal(after.visible[0].id, original.id, 'Surviving Activity must remain mounted');
  assert.equal(after.visible[0].pane, 'fullscreen');
  assert.ok(Math.abs(after.visible[0].width - 1) < 0.01 && Math.abs(after.visible[0].height - 1) < 0.01);
  assert.equal(after.os.isLauncherVisible, false);
  assert.equal(after.os.activeAppId, survivorApp);
  assert.equal(after.foldable.multi_window.mode, 'fullscreen');
  assert.equal(after.os.tasks.length, before.os.tasks.length - 1);
  return after;
}
try {
  page = await browser.newPage();
  page.on('pageerror', error => pageErrors.push(error.message));
  const url = new URL(process.argv.find(arg => arg.startsWith('http')) || 'http://127.0.0.1:3100/');
  url.searchParams.set('foldagent_benchmark', '1');
  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.__SIM__ && window.__FOLDAGENT_BENCH__, { timeout: 60000 });
  const session = await page.createCDPSession();
  cdp = { send: (...args) => session.send(...args), eval: expression => page.evaluate(expression) };
  for (const orientation of ['side_by_side', 'stacked']) {
    for (const focused of ['calculator', 'notes']) {
      for (const runSeed of [0, 1]) {
        await setup(orientation, focused, runSeed);
        const state = await panes();
        assert.equal(state.visible.length, 2);
        const primary = state.visible.find(pane => pane.pane === 'primary');
        const secondary = state.visible.find(pane => pane.pane === 'secondary');
        assert.equal(primary.app, 'calculator');
        assert.equal(secondary.app, 'notes');
        const effectiveOrientation = runSeed === 0 ? orientation : 'stacked';
        assert.equal(state.foldable.multi_window.split_orientation, effectiveOrientation);
        assert.equal(state.foldable.multi_window.unfolded_split_orientation, orientation);
        assert.ok(Math.abs(primary[effectiveOrientation === 'stacked' ? 'height' : 'width'] - 0.6) < 0.01);
        assert.ok(Math.abs(secondary[effectiveOrientation === 'stacked' ? 'y' : 'x'] - 0.6) < 0.01);
        assert.equal(state.os.activeAppId, focused);
        const name = `initial_${orientation}_${focused}_${runSeed}`;
        await screenshot(name);
        results.push({ case: name, passed: true });
      }
    }
  }
  // Invalid requests must fail before reset and preserve the previous session.
  for (const change of [{ split_apps: ['calculator', 'calculator'] }, { split_orientation: 'diagonal' },
    { focused_app: 'missing' }, { split_apps: ['calculator', 'missing'] }, { divider_ratio: 1 }]) {
    const result = await page.evaluate(async ({ task, change }) => {
      const before = window.__OS__.getState().tasks.map(t => t.taskId);
      try {
        await window.__FOLDAGENT_BENCH__.start({ ...task, initial_window: { ...task.initial_window, ...change } });
        return { error: null };
      } catch (error) { return { error: String(error), before, after: window.__OS__.getState().tasks.map(t => t.taskId) }; }
    }, { task: base, change });
    assert.ok(result.error);
    assert.deepEqual(result.before, result.after);
  }
  results.push({ case: 'invalid_initial_config_does_not_reset', passed: true });
  const fullscreen = structuredClone(base);
  fullscreen.initial_window = { posture: 'unfolded', layout: 'inner_wide', focused_app: 'calculator', mode: 'fullscreen' };
  await page.evaluate(task => window.__FOLDAGENT_BENCH__.start(task, { automatic: false }), fullscreen);
  const state = await panes();
  assert.equal(state.visible.length, 1);
  assert.equal(state.visible[0].pane, 'fullscreen');
  assert.equal(state.foldable.multi_window.mode, 'fullscreen');
  results.push({ case: 'fullscreen_clears_previous_split', passed: true });
  if (!process.argv.includes('--initial-only')) {
    const cases = [
      ['side_by_side', 'left', 300, 'calculator'], ['side_by_side', 'right', 300, 'notes'],
      ['stacked', 'left', 300, 'calculator'], ['stacked', 'right', 300, 'calculator'],
      ['stacked', 'left', 800, 'notes'], ['stacked', 'right', 800, 'notes'],
    ];
    for (const [orientation, side, y, closed] of cases) {
      for (const focused of ['calculator', 'notes']) {
        await setup(orientation, focused);
        const before = await panes();
        const x = side === 'left' ? 4 : 996, end = side === 'left' ? 180 : 820;
        await action({ action: 'swipe', coordinate: [x, y], coordinate2: [end, y] });
        const after = await panes();
        assert.equal(after.os.tasks.some(task => task.rootAppId === closed), false, `${orientation} ${side} y=${y} closes ${closed}`);
        const survivor = closed === 'calculator' ? 'notes' : 'calculator';
        await assertSurvivor(before, survivor);
        const name = `close_${orientation}_${side}_${closed}_focus_${focused}`;
        await screenshot(name);
        results.push({ case: name, passed: true });
      }
    }
    // A meaningful partial calculation must survive losing its neighbor; finish
    // using the actual agent click transport and let the business judge verify it.
    for (const orientation of ['side_by_side', 'stacked']) {
      await setup(orientation);
      for (const key of ['1', '2', '+']) await calculatorKey(key);
      const before = await panes();
      const calcBefore = await page.evaluate(() => window.__SIM__.getState().apps.calculator);
      await action({ action: 'swipe', coordinate: [996, 800], coordinate2: [820, 800] });
      await assertSurvivor(before, 'calculator');
      assert.deepEqual(await page.evaluate(() => window.__SIM__.getState().apps.calculator), calcBefore);
      for (const key of ['7', '=']) await calculatorKey(key);
      const report = await page.evaluate(() => window.__FOLDAGENT_BENCH__.getReport());
      assert.equal(report.passed, true);
      await screenshot(`retained_calculation_${orientation}`);
      results.push({ case: `retained_calculation_${orientation}`, passed: true, judge: report.passed });
    }
    // Short/vertical/interior/outward swipes must not dismiss either app.
    for (const [name, start, end] of [
      ['short', [4, 300], [24, 300]], ['vertical', [4, 300], [15, 500]],
      ['interior', [260, 300], [420, 300]], ['outward', [15, 300], [0, 300]],
      ['divider_edge', [4, 600], [180, 600]],
    ]) {
      await setup('stacked');
      const before = await panes();
      await action({ action: 'swipe', coordinate: start, coordinate2: end });
      const after = await panes();
      assert.equal(after.visible.length, 2, name);
      assert.deepEqual(after.os.tasks.map(task => task.taskId), before.os.tasks.map(task => task.taskId));
      assert.equal(after.os.isLauncherVisible, false);
      results.push({ case: `ignore_${name}_swipe`, passed: true });
    }
    // Native touch events (not compatibility mouse events), both stacked panes.
    for (const [side, y, survivor, cancelTouch] of [['left', 300, 'notes', false], ['right', 800, 'calculator', false], ['left', 300, null, true]]) {
      await setup('stacked');
      const before = await panes();
      const { bounds } = await screenshot(`touch_before_${side}_${y}_${cancelTouch}`);
      const startX = bounds.x + bounds.width * (side === 'left' ? 0.004 : 0.996);
      const endX = bounds.x + bounds.width * (side === 'left' ? 0.18 : 0.82);
      const touchY = bounds.y + bounds.height * y / 1000;
      const send = (type, x) => cdp.send('Input.dispatchTouchEvent', { type,
        touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x, y: touchY, id: 1 }] });
      await send('touchStart', startX);
      for (let i = 1; i <= 8; i++) { await send('touchMove', startX + (endX - startX) * i / 8); await frames(); }
      await send(cancelTouch ? 'touchCancel' : 'touchEnd');
      await frames();
      if (cancelTouch) assert.equal((await panes()).visible.length, 2);
      else await assertSurvivor(before, survivor);
      results.push({ case: `touch_${side}_${y}_${cancelTouch ? 'cancel' : 'close'}`, passed: true });
    }
    // Closing through the OS API follows the same survivor policy, even when
    // the task being removed is not the active task.
    for (const closed of ['notes', 'calculator']) {
      await setup('side_by_side', 'calculator');
      const before = await panes();
      await page.evaluate(closed => window.__OS__.closeApp(closed), closed);
      await frames();
      await assertSurvivor(before, closed === 'notes' ? 'calculator' : 'notes');
      results.push({ case: `direct_close_${closed}`, passed: true });
    }
    // Preserve an editor route and text entered through the same input action
    // used by the model, not merely a persisted app-state snapshot.
    await setup('side_by_side');
    await page.evaluate(() => window.__OS__.openApp('notes', '/note/new'));
    await page.waitForSelector('[data-benchmark-field="notes-title"]', { visible: true });
    const titlePoint = await page.evaluate(() => {
      const r = document.querySelector('[data-benchmark-field="notes-title"]').getBoundingClientRect();
      const root = document.getElementById('root').getBoundingClientRect();
      return [(r.x + r.width / 2 - root.x) / root.width * 1000, (r.y + r.height / 2 - root.y) / root.height * 1000];
    });
    await action({ action: 'type', coordinate: titlePoint, text: 'Keep split editor draft' });
    const editorBefore = await panes();
    const routeBefore = await page.evaluate(() => window.__OS__.getAppRoute('notes').path);
    await action({ action: 'swipe', coordinate: [4, 300], coordinate2: [180, 300] });
    await assertSurvivor(editorBefore, 'notes');
    assert.equal(await page.evaluate(() => window.__OS__.getAppRoute('notes').path), routeBefore);
    assert.equal(await page.$eval('[data-benchmark-field="notes-title"]', node => node.value), 'Keep split editor draft');
    await screenshot('retained_notes_editor');
    results.push({ case: 'retained_notes_route_and_text', passed: true });
    // Once fullscreen, the same edge gesture is ordinary Back again.
    await action({ action: 'swipe', coordinate: [4, 300], coordinate2: [180, 300] });
    assert.equal((await panes()).os.tasks.some(task => task.rootAppId === 'notes'), true);
    assert.notEqual(await page.evaluate(() => window.__OS__.getAppRoute('notes').path), routeBefore);
    results.push({ case: 'fullscreen_keeps_system_back', passed: true });
    // Unrelated background apps survive targeted closure.
    await setup('stacked');
    await page.evaluate(() => window.__OS__.openApp('calendar'));
    await page.waitForFunction(() => window.__OS__.getAppRoute('calendar')?.path);
    await page.evaluate(() => {
      const tasks = window.__OS__.getState().tasks;
      const calc = tasks.find(t => t.rootAppId === 'calculator').taskId;
      const notes = tasks.find(t => t.rootAppId === 'notes').taskId;
      window.__OS__.launchTaskById(calc);
      window.__FOLDAGENT__.setMultiWindow('split', calc, notes, 0.6, null, 0.5, 'stacked');
    });
    await frames();
    const withBackground = await panes();
    await action({ action: 'swipe', coordinate: [996, 800], coordinate2: [820, 800] });
    const afterBackground = await assertSurvivor(withBackground, 'calculator');
    assert.equal(afterBackground.os.tasks.some(task => task.rootAppId === 'calendar'), true);
    results.push({ case: 'unrelated_background_app_retained', passed: true });
    // Small host window and cover display use displayed CSS scale for thresholds.
    await page.setViewport({ width: 650, height: 700, deviceScaleFactor: 1 });
    await setup('stacked', 'calculator', 1);
    const small = await panes();
    await screenshot('small_cover_split');
    await action({ action: 'swipe', coordinate: [996, 800], coordinate2: [750, 800] });
    await assertSurvivor(small, 'calculator');
    results.push({ case: 'scaled_cover_edge_swipe', passed: true });
    await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
    // Changing the divider must keep the selected orientation.
    await setup('stacked');
    await action({ action: 'swipe', coordinate: [500, 600], coordinate2: [500, 450] });
    const resized = await panes();
    assert.equal(resized.foldable.multi_window.split_orientation, 'stacked');
    assert.ok(Math.abs(resized.foldable.multi_window.divider_ratio - 0.45) < 0.01);
    results.push({ case: 'resize_keeps_stacked_orientation', passed: true });
  }
  assert.deepEqual(pageErrors, []);
  console.log(JSON.stringify({ passed: true, output, results }, null, 2));
} catch (error) {
  if (cdp) await screenshot('failure').catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ results, pageErrors }, null, 2));
  await browser.close();
}
