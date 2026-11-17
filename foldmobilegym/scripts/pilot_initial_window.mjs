import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import puppeteer from 'puppeteer';

// Startup-only synthetic descriptors: no business task or model qualification.
// Run in the existing dependency-equipped runtime. Never emit raw app state.
const args = process.argv.slice(2);
assert.ok(args.length === 0 || (args.length === 2 && args[0] === '--all-apps' && args[1]),
  'Use no arguments, or --all-apps <workspace>');
let apps = ['calculator', 'notes', 'meituan_waimai'];
let designHash = null;
if (args.length) {
  const bytes = fs.readFileSync(path.resolve(args[1], 'foldmobilegym/design/current_apps_20261010/task_designs.json'));
  const design = JSON.parse(bytes);
  assert.ok(Array.isArray(design.workflows) && design.workflows.length > 0);
  assert.ok(Array.isArray(design.auxiliary_app_ids));
  assert.ok(design.excluded_from_business_tasks?.workspace_docs && design.excluded_from_business_tasks?.answer_sheet);
  apps = [...new Set([...design.workflows.flatMap(workflow => {
    assert.ok(Array.isArray(workflow.apps) && workflow.apps.length > 0);
    return workflow.apps;
  }), ...design.auxiliary_app_ids])].sort();
  assert.equal(apps.length, 29, 'Current all-app startup scope must not silently shrink');
  assert.ok(apps.every(app => typeof app === 'string' && /^[a-z][a-z0-9_]*$/.test(app)
    && !(app in design.excluded_from_business_tasks)), 'Invalid or excluded startup App');
  designHash = createHash('sha256').update(bytes).digest('hex');
}
const runnerHash = createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex');
const windows = [
  { posture: 'unfolded', layout: 'inner_wide' },
  { posture: 'folded', layout: 'cover_single' },
  { posture: 'tabletop', layout: 'inner_book' },
];
const results = [];
const errors = [];
for (const app of apps) {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  let page;
  try {
    page = await browser.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewport({ width: 1440, height: 1100 });
    await page.goto('http://127.0.0.1:3100/?foldagent_benchmark=1', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__SIM__ && window.__OS__ && window.__FOLDAGENT_BENCH__));
    assert.ok(await page.evaluate(app => window.__SIM__.getState().os.installedApps.some(item => item.id === app), app),
      `Design App is not installed: ${app}`);
    for (const [index, initial] of windows.entries()) {
      const task = { id: `startup-${app}-${index}`, pair_id: 'startup', apps: [app], seed_contract: {},
        initial_window: { ...initial, focused_app: app, mode: 'fullscreen' }, event_plan: [],
        evaluator: { success_all: [], safety_all: [], must_have_events: [], require_post_transition_action: false,
          max_invalid_actions: 0, max_repeated_actions: 0 } };
      const row = await page.evaluate(async task => {
        const report = await window.__FOLDAGENT_BENCH__.start(task, { automatic: true });
        const app = task.initial_window.focused_app;
        const visibleApp = [...document.querySelectorAll('[data-app-id]')].find(node => {
          const rect = node.getBoundingClientRect();
          return node.dataset.appId === app && rect.width > 0 && rect.height > 0 && getComputedStyle(node).visibility !== 'hidden';
        });
        const visible = Boolean(visibleApp);
        return { app, requested: report.requested_window, effective: report.effective_window,
          visible, pane: visibleApp?.dataset.foldagentPane, launcher: window.__OS__.getState().isLauncherVisible, step: report.step,
          routeReady: Boolean(window.__OS__.getAppRoute(app)?.path),
          readyAtReturn: report.effective_window.focused_app === app && visible
            && Boolean(window.__OS__.getAppRoute(app)?.path) && !window.__OS__.getState().isLauncherVisible
            && !window.__OS__.getState().isRecentsVisible
            && report.effective_window.posture === (task.initial_window.posture === 'tabletop' ? 'half_folded' : task.initial_window.posture)
            && report.effective_window.layout === task.initial_window.layout
            && report.effective_window.mode === task.initial_window.mode
            && visibleApp?.dataset.foldagentPane === 'fullscreen' };
      }, task);
      await page.waitForFunction(app => [...document.querySelectorAll('[data-app-id]')].some(node => {
        const rect = node.getBoundingClientRect();
        return node.dataset.appId === app && rect.width > 0 && rect.height > 0 && getComputedStyle(node).visibility !== 'hidden';
      }), { timeout: 10000 }, app);
      results.push({ ...row, cold: index === 0, eventuallyVisible: true, runnerHash, designHash });
      console.log(JSON.stringify(results.at(-1)));
    }
  } catch (error) {
    const setup = page ? await page.evaluate(() => ({ document: document.readyState,
      sim: Boolean(window.__SIM__), os: Boolean(window.__OS__), controller: Boolean(window.__FOLDAGENT_BENCH__) })).catch(() => null) : null;
    console.error(JSON.stringify({ failedApp: app, completed: results.length, error: String(error), setup, pageErrors: errors }));
    throw error;
  } finally { await browser.close(); }
}
console.log(JSON.stringify({ scope: 'Synthetic startup readiness only, NOT task or model qualification',
  appCount: apps.length, scenarios: results.length, ready: results.filter(row => row.readyAtReturn).length,
  pageErrors: errors, runnerHash, designHash }));
assert.equal(results.length, apps.length * windows.length);
assert.deepEqual(errors, []);
assert.ok(results.every(row => row.step === 0), 'Startup readiness must not consume agent actions');
assert.ok(results.every(row => row.readyAtReturn), 'start() returned before requested foreground was visible');
