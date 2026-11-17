import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

// A source-identity regression, not a formal CW19 task or screenshot-agent run.
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const app = '[data-app-id="tencent_meeting"]';
const errors = [];
try {
  let scenarios = 0;
  for (const posture of ['unfolded', 'folded', 'half_folded']) {
  for (const identity of ['internal', 'public']) {
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto('http://127.0.0.1:3100/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__FOLDAGENT_BENCH__));
  await page.evaluate(() => window.__OS__.openApp('tencent_meeting', '/'));
  await page.waitForSelector(`${app} [data-trigger="home.meeting.detail"]`, { visible: true });
  const initial = await page.evaluate(() => window.__SIM__.getState().apps.tencent_meeting);
  assert.ok(initial.scheduledMeetings.length >= 2, 'Need two distinct ordinary scheduled meetings');
  const expected = initial.scheduledMeetings[0];
  const task = { id: 'DIAG-MEETING-SOURCE', pair_id: 'DIAG_MEETING_SOURCE',
    apps: ['tencent_meeting', 'calendar', 'clock'], seed_contract: { meeting_id: identity === 'internal' ? expected.id : expected.meetingId },
    initial_window: { posture: 'unfolded', layout: 'inner_wide', focused_app: 'tencent_meeting', mode: 'fullscreen' },
    event_plan: [], recovery: null,
    evaluator: { success_all: [], safety_all: [], must_have_events: [],
      require_post_transition_action: false, max_invalid_actions: 0, max_repeated_actions: 1 } };
  await page.evaluate(task => window.__FOLDAGENT_BENCH__.start(task, { automatic: false }), task);
  await page.evaluate(posture => window.__FOLDAGENT__.setPosture(posture), posture);
  await page.waitForSelector(`${app} [data-trigger="home.meeting.detail"]`, { visible: true });
  const persistent = () => page.evaluate(() => {
    const state = window.__SIM__.getState().apps.tencent_meeting;
    return { scheduledMeetings: state.scheduledMeetings, history: state.history, activeMeeting: state.activeMeeting };
  });
  const before = await persistent();
  const record = id => page.evaluate(id => window.__FOLDAGENT_BENCH__.recordAgentAction({ id, kind: 'transition', params: {} }), id);
  const anchors = () => page.evaluate(() => window.__FOLDAGENT_BENCH__.getReport().final_state.benchmark.anchors.DIAG_MEETING_SOURCE);
  await record('diag.home');
  const home = await anchors();
  assert.equal(home.source_opened, false, 'App home is not the specified meeting');
  assert.equal(home.source_facts_verified, false);
  const open = async id => {
    const title = before.scheduledMeetings.find(meeting => meeting.id === id).title;
    const cards = await page.$$(`${app} [data-trigger="home.meeting.detail"]`);
    let match;
    for (const card of cards) if ((await card.evaluate(el => el.textContent)).includes(title)) match = card;
    assert.ok(match, 'Scheduled meeting must be reachable through the ordinary list');
    await match.click();
    await page.waitForSelector(`${app} [data-trigger="meeting.detail.back"]`, { visible: true });
    await page.waitForFunction(() => window.__OS__.getAppRoute('tencent_meeting')?.path === '/meeting/detail');
  };
  const wrong = before.scheduledMeetings.find(meeting => meeting.id !== expected.id);
  await open(wrong.id);
  await record('diag.wrong-meeting');
  assert.equal((await anchors()).source_opened, false, 'Wrong meeting is not the specified source');
  assert.equal((await anchors()).source_facts_verified, false);
  await page.click(`${app} [data-trigger="meeting.detail.back"]`);
  await page.waitForSelector(`${app} [data-trigger="home.meeting.detail"]`, { visible: true });
  await page.waitForFunction(() => window.__OS__.getAppRoute('tencent_meeting')?.path === '/');
  await record('diag.back-home');
  assert.equal((await anchors()).source_opened, false);
  await open(expected.id);
  await record('diag.correct-meeting');
  const correct = await anchors();
  assert.equal(correct.source_opened, true, 'Correct scheduled detail must be recognized');
  assert.equal(typeof correct.source_facts_verified, 'boolean');
  assert.deepEqual(await persistent(), before, 'Reading details must not join/start/cancel/change a meeting');
  console.log(JSON.stringify({ posture, identity, homeRejected: true, wrongRejected: true,
    correctAccepted: true, factsDeliveredAtOpen: correct.source_facts_verified, meetingsUnchanged: true }));
  scenarios++;
  await page.close();
  }
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, scenarios, pageErrors: errors,
    scope: 'DOM-guided source identity only; fact delivery has a separate diagnostic, no event/recovery or CW19 qualification' }));
} finally { await browser.close(); }
