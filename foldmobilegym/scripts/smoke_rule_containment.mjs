import assert from 'node:assert/strict';
import fs from 'node:fs';
import puppeteer from 'puppeteer';

// Synthetic matcher cases only. Not task fixtures or an agent success trajectory.
const cases = JSON.parse(fs.readFileSync(new URL('../tests/fixtures/objectContainsCases.json', import.meta.url), 'utf8'));
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:3100/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__SIM__ && window.__FOLDAGENT_BENCH__));
  for (const sample of cases) {
    const task = { id: 'DIAG-CONTAINMENT', pair_id: 'DIAG_CONTAINMENT', apps: ['calculator'],
      seed_contract: {}, initial_window: { posture: 'unfolded', layout: 'inner_wide', focused_app: 'calculator', mode: 'fullscreen' },
      event_plan: [], recovery: null, evaluator: {
        success_all: [{ path: 'apps.calculator.calculations', op: 'contains_object', value: sample.expected }],
        safety_all: [], must_have_events: [], require_post_transition_action: false,
        max_invalid_actions: 0, max_repeated_actions: 0,
      } };
    const result = await page.evaluate(async ({ sample, task }) => {
      window.__SIM__.setState({ apps: { calculator: { calculations: [], calculationCount: 0 } } }, { deep: true });
      await window.__FOLDAGENT_BENCH__.start(task, { automatic: false });
      window.__SIM__.setState({ apps: { calculator: { calculations: [sample.actual] } } }, { deep: true });
      const report = window.__FOLDAGENT_BENCH__.getReport();
      return { passed: report.target_checks[0].passed, wrong: report.violation_counts.wrong_target_commits };
    }, { sample, task });
    assert.equal(result.passed, sample.passed, sample.name);
    assert.equal(result.wrong, sample.passed ? 0 : 1, `Commit inference: ${sample.name}`);
  }
  await page.evaluate(() => window.__SIM__.resetState());
  console.log(JSON.stringify({ passed: true, checked: cases.length, controllerRules: true,
    commitInference: true, syntheticInjection: true, scope: 'Matcher compatibility, not CW06/CW21 or model evaluation' }));
} finally { await browser.close(); }
