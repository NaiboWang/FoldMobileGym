import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

// Isolated DOM fault controls; not agent actions, private fixtures or formal CW19.
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const app = '[data-app-id="tencent_meeting"]';
const errors = [];
try {
  let scenarios = 0;
  for (const posture of ['unfolded', 'folded', 'half_folded']) {
    for (const mode of ['normal', 'hidden', 'wrong-text', 'covered', 'clipped', 'split-visibility']) {
      const page = await browser.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.setViewport({ width: 1440, height: 1100 });
      await page.goto('http://127.0.0.1:3100/', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(window.__FOLDAGENT_BENCH__));
      await page.evaluate(() => window.__OS__.openApp('tencent_meeting', '/'));
      await page.waitForSelector(`${app} [data-trigger="home.meeting.detail"]`, { visible: true });
      const expected = await page.evaluate(() => window.__SIM__.getState().apps.tencent_meeting.scheduledMeetings[0]);
      const task = { id: 'DIAG-MEETING-FACTS', pair_id: 'DIAG_MEETING_FACTS',
        apps: ['tencent_meeting', 'calendar', 'clock'], seed_contract: { meeting_id: expected.id },
        initial_window: { posture: 'unfolded', layout: 'inner_wide', focused_app: 'tencent_meeting', mode: 'fullscreen' },
        event_plan: [], recovery: null,
        evaluator: { success_all: [], safety_all: [], must_have_events: [],
          require_post_transition_action: false, max_invalid_actions: 0, max_repeated_actions: 1 } };
      await page.evaluate(task => window.__FOLDAGENT_BENCH__.start(task, { automatic: false }), task);
      await page.evaluate(posture => window.__FOLDAGENT__.setPosture(posture), posture);
      const before = await page.evaluate(() => {
        const s = window.__SIM__.getState().apps.tencent_meeting;
        return { meetings: s.scheduledMeetings, history: s.history, active: s.activeMeeting };
      });
      const cards = await page.$$(`${app} [data-trigger="home.meeting.detail"]`);
      for (const card of cards) {
        if ((await card.evaluate(node => node.textContent)).includes(expected.title)) { await card.click(); break; }
      }
      await page.waitForSelector(`${app} [data-benchmark-meeting-fact="number"]`);
      await page.waitForFunction(() => window.__OS__.getAppRoute('tencent_meeting')?.path === '/meeting/detail');
      await page.evaluate(({ app, mode }) => {
        const field = document.querySelector(`${app} [data-benchmark-meeting-fact="number"]`);
        if (mode === 'hidden' || mode === 'split-visibility') field.style.visibility = 'hidden';
        if (mode === 'wrong-text') field.textContent = '000 000 000';
        if (mode === 'clipped') Object.assign(field.style, { display: 'inline-block', width: '4px', overflow: 'hidden', whiteSpace: 'nowrap' });
        if (mode === 'covered') {
          const cover = document.createElement('div');
          cover.id = 'diagnostic-fact-cover';
          Object.assign(cover.style, { position: 'fixed', background: 'white', zIndex: '999999' });
          document.body.append(cover);
        }
      }, { app, mode });
      const samples = [];
      for (const field of ['subject', 'start_time', 'start_date', 'end_time', 'end_date', 'number']) {
        const position = await page.evaluate(({ app, field }) => {
          const node = document.querySelector(`${app} [data-benchmark-meeting-fact="${field}"]`);
          const scroll = node.closest('[data-scroll-container="main"]');
          const r = node.getBoundingClientRect(), s = scroll.getBoundingClientRect();
          return { x: s.x + s.width / 2, y: s.y + s.height / 2,
            delta: r.top < s.top || r.bottom > s.bottom ? r.y + r.height / 2 - (s.y + s.height / 2) : 0 };
        }, { app, field });
        await page.mouse.move(position.x, position.y);
        if (position.delta) await page.mouse.wheel({ deltaY: position.delta });
        await page.evaluate(() => new Promise(resolve => {
          let frames = 0; const tick = () => ++frames >= 20 ? resolve() : requestAnimationFrame(tick);
          requestAnimationFrame(tick);
        }));
        await page.evaluate(app => {
          const cover = document.getElementById('diagnostic-fact-cover');
          if (!cover) return;
          const r = document.querySelector(`${app} [data-benchmark-meeting-fact="number"]`).getBoundingClientRect();
          Object.assign(cover.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.width}px`, height: `${r.height}px` });
        }, app);
        await page.evaluate(field => window.__FOLDAGENT_BENCH__.recordAgentAction({ id: `diag.query.${field}`, kind: 'transition', params: {} }), field);
        samples.push(await page.evaluate(() => window.__FOLDAGENT_BENCH__.getReport().final_state.benchmark.anchors.DIAG_MEETING_FACTS));
      }
      if (mode === 'split-visibility') {
        assert.equal(samples.at(-1).source_facts_verified, false, 'Five delivered facts are not complete');
        await page.evaluate(app => {
          for (const node of document.querySelectorAll(`${app} [data-benchmark-meeting-fact]`)) {
            node.style.visibility = node.dataset.benchmarkMeetingFact === 'number' ? 'visible' : 'hidden';
          }
        }, app);
        await page.evaluate(() => window.__FOLDAGENT_BENCH__.recordAgentAction({ id: 'diag.query.last-number', kind: 'transition', params: {} }));
        samples.push(await page.evaluate(() => window.__FOLDAGENT_BENCH__.getReport().final_state.benchmark.anchors.DIAG_MEETING_FACTS));
      }
      const final = samples.at(-1);
      assert.equal(final.source_opened, true);
      assert.equal(final.source_facts_verified, mode === 'normal' || mode === 'split-visibility', `${posture}/${mode}: only actual complete fact delivery may pass`);
      assert.deepEqual(await page.evaluate(() => {
        const s = window.__SIM__.getState().apps.tencent_meeting;
        return { meetings: s.scheduledMeetings, history: s.history, active: s.activeMeeting };
      }), before);
      console.log(JSON.stringify({ posture, mode, delivered: final.source_facts_verified, passed: true,
        deliveryAtFirstQuery: samples[0].source_facts_verified }));
      scenarios++;
      await page.close();
    }
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, scenarios, pageErrors: errors,
    scope: 'Default scheduled meeting, DOM-guided scroll + diagnostic faults; not natural pre-event, private fixtures, CW19 outcome/recovery or agent comprehension' }));
} finally { await browser.close(); }
