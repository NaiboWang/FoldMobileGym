// Compare source admission with the real Clock utility, without changing app state.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import puppeteer from 'puppeteer';

if (!process.argv[2]) throw Error('Pass the research workspace containing the foldagentgym Python package');
const workspace = path.resolve(process.argv[2]);
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:3100/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__SIM__));
  const before = await page.evaluate(() => window.__SIM__.getState().apps);
  const cases = await page.evaluate(async () => {
    const time = await import('/os/TimeService.ts');
    const { getNextTrigger } = await import('/system/Clock/utils.ts');
    const definitions = [
      { name: 'ordinary', now: [9, 30], start: [10, 0], lead: 15, valid: true },
      { name: 'future-by-one-millisecond', now: [9, 44], nowMs: 59999, start: [10, 0], lead: 15, valid: true },
      { name: 'midnight-one-minute', now: [0, 0], start: [0, 16], lead: 15, valid: true },
      { name: 'near-day-end', now: [23, 0], start: [23, 58], duration: 1, lead: 15, valid: true },
      { name: 'expired-reminder', now: [9, 30], start: [9, 40], lead: 15, valid: false, wrongTrigger: true },
      { name: 'reminder-equals-now', now: [9, 30], start: [9, 45], lead: 15, valid: false, wrongTrigger: true },
      { name: 'tomorrow-meeting', now: [9, 30], start: [10, 0], startDay: 13, lead: 15, valid: false, wrongTrigger: true },
      { name: 'reminder-crosses-midnight', now: [0, 0], start: [0, 10], lead: 15, valid: false, wrongTrigger: true },
      { name: 'meeting-end-crosses-midnight', now: [23, 0], start: [23, 50], duration: 30, lead: 15, valid: false },
    ];
    return definitions.map(definition => {
      const simulated_now_ms = time.fromLocalParts(2026, 9, 12, ...definition.now).getTime() + (definition.nowMs || 0);
      const startTime = time.fromLocalParts(2026, 9, definition.startDay || 12, ...definition.start).getTime();
      const reminder = startTime - definition.lead * 60000;
      const reminderDate = time.fromTimestamp(reminder);
      const local = time.fromTimestamp(simulated_now_ms);
      const utc_offset_minutes = -local.getTimezoneOffset();
      return { name: definition.name, valid: definition.valid, wrongTrigger: Boolean(definition.wrongTrigger),
        meeting: { startTime, duration: definition.duration || 30 }, lead: definition.lead,
        simulated_now_ms, utc_offset_minutes, reminder,
        trigger: getNextTrigger({ hour: reminderDate.getHours(), minute: reminderDate.getMinutes(), repeat: 'once' }, local) };
    });
  });
  const python = 'import json,sys\nfrom foldagentgym.pilots.meeting_time_contract import meeting_alarm_time_facts\n'
    + 'results=[]\nfor case in json.load(sys.stdin):\n'
    + ' try:\n  facts=meeting_alarm_time_facts(case["meeting"],case["lead"],simulated_now_ms=case["simulated_now_ms"],utc_offset_minutes=case["utc_offset_minutes"])\n'
    + '  results.append({"accepted":True,"facts":facts})\n'
    + ' except ValueError as error:\n  results.append({"accepted":False,"error":str(error)})\n'
    + 'print(json.dumps(results))';
  const results = JSON.parse(execFileSync(process.env.PYTHON_EXECUTABLE || 'python', ['-c', python],
    { cwd: workspace, input: JSON.stringify(cases), encoding: 'utf8', timeout: 20000 }));
  assert.equal(results.length, cases.length);
  for (let index = 0; index < cases.length; index++) {
    const item = cases[index], result = results[index];
    assert.equal(result.accepted, item.valid, item.name);
    if (item.valid) assert.equal(result.facts.reminder_ms, item.trigger, item.name);
    if (item.wrongTrigger) assert.notEqual(item.reminder, item.trigger, item.name);
  }
  assert.deepEqual(await page.evaluate(() => window.__SIM__.getState().apps), before);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, cases: cases.length, accepted: results.filter(result => result.accepted).length,
    rejected: results.filter(result => !result.accepted).length,
    localUtcOffsets: [...new Set(cases.map(item => item.utc_offset_minutes))], appStateUnchanged: true, pageErrors: errors,
    scope: 'Public time boundaries versus real Clock getNextTrigger; not formal task, UI chain or timezone calibration' }));
} finally { await browser.close(); }
