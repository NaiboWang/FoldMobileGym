import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

// Controller regression only: no claim of a complete benchmark task episode.
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto('http://127.0.0.1:3100/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__FOLDAGENT_BENCH__));
  const task = {
    id: 'DIAG-ENTRY', pair_id: 'DIAG_ENTRY', apps: ['mail', 'calendar'], seed_contract: {},
    initial_window: { posture: 'unfolded', layout: 'inner_wide', focused_app: 'mail', mode: 'fullscreen' },
    event_plan: [{ event_id: 'entry.fold', controller: 'benchmark',
      trigger: { all: [{ path: 'benchmark.anchors.DIAG_ENTRY.target_entry_started', equals: true }], max_wait_steps: 10 },
      transition: { from_posture: 'unfolded', to_posture: 'folded', duration_steps: 1 } }],
    evaluator: { success_all: [], safety_all: [], must_have_events: ['entry.fold'],
      require_post_transition_action: true, max_invalid_actions: 0, max_repeated_actions: 1 },
    recovery: null,
  };
  await page.evaluate(t => window.__FOLDAGENT_BENCH__.start(t, { automatic: false }), task);
  await page.evaluate(() => window.__OS__.openApp('calendar', '/new-event'));
  const input = '[data-app-id="calendar"] [data-benchmark-field="calendar-title"]';
  await page.waitForSelector(input);
  await page.evaluate(() => window.__FOLDAGENT_BENCH__.recordAgentAction({ id: 'diag.open-editor', kind: 'transition', params: {} }));
  const opened = await page.evaluate(() => window.__FOLDAGENT_BENCH__.getReport());
  assert.equal(opened.final_state.benchmark.anchors.DIAG_ENTRY.target_entry_started, false,
    'Opening editor with default time fields must not count as target entry');
  assert.equal(opened.fired_events.length, 0);
  await page.click(input);
  await page.evaluate(() => window.__FOLDAGENT_BENCH__.recordAgentAction({ id: 'diag.focus-title', kind: 'interaction', params: { benchmark_field: 'calendar-title' } }));
  const focused = await page.evaluate(() => window.__FOLDAGENT_BENCH__.getReport());
  assert.deepEqual(focused.fired_events, ['entry.fold']);
  assert.equal(focused.evidence[0].trigger_step, 2);
  assert.equal(focused.evidence[0].posture_before, 'unfolded');
  assert.equal(focused.evidence[0].posture_after, 'folded');
  await page.type(input, 'Continue after transition');
  await page.evaluate(() => window.__FOLDAGENT_BENCH__.recordAgentAction({ id: 'diag.type-title', kind: 'action', params: { benchmark_field: 'calendar-title' } }));
  const final = await page.evaluate(() => window.__FOLDAGENT_BENCH__.getReport());
  assert.equal(final.post_transition_by_event['entry.fold'], true);
  assert.equal(final.action_trace.length, 3);
  assert.equal(final.final_state.apps.calendar.draft.title, 'Continue after transition');
  console.log(JSON.stringify({ passed: true, defaultFieldsDoNotTrigger: true,
    intentionalFocusTriggers: true, postEventEffectfulAction: true,
    scope: 'Controller anchor regression; not a formal task acceptance' }));
} finally { await browser.close(); }
