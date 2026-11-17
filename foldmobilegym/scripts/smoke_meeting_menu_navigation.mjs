import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

// Isolated ordinary navigation/cancel controls; no edit save/join/cancel-meeting.
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const app = '[data-app-id="tencent_meeting"]';
const errors = [];
try {
  let scenarios = 0;
  for (const posture of ['unfolded', 'folded', 'half_folded']) {
    const page = await browser.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewport({ width: 1440, height: 1100 });
    await page.goto('http://127.0.0.1:3100/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__OS__ && window.__SIM__));
    await page.evaluate(posture => window.__FOLDAGENT__.setPosture(posture), posture);
    await page.evaluate(() => window.__OS__.openApp('tencent_meeting', '/'));
    const waitRoute = path => page.waitForFunction(path => window.__OS__.getAppRoute('tencent_meeting')?.path === path, {}, path);
    await page.waitForSelector(`${app} [data-trigger="home.meeting.detail"]`, { visible: true });
    const records = () => page.evaluate(() => {
      const state = window.__SIM__.getState().apps.tencent_meeting;
      return { scheduled: state.scheduledMeetings, history: state.history, active: state.activeMeeting };
    });
    const before = await records();
    const cards = await page.$$(`${app} [data-trigger="home.meeting.detail"]`);
    await cards[0].click();
    await waitRoute('/meeting/detail');
    const selected = await page.evaluate(() => window.__SIM__.getState().apps.tencent_meeting.currentScheduledMeeting);
    await page.click(`${app} [data-trigger="meeting.detail.actions.open"]`);
    await waitRoute('/meeting/detail?dialog=actions');
    await page.waitForSelector(`${app} [data-trigger="meeting.detail.edit.open"]`, { visible: true });
    await page.evaluate(() => window.__OS__.handleBack());
    await waitRoute('/meeting/detail');
    await page.waitForSelector(`${app} [data-trigger="meeting.detail.edit.open"]`, { hidden: true });
    await page.click(`${app} [data-trigger="meeting.detail.actions.open"]`);
    await waitRoute('/meeting/detail?dialog=actions');
    const buttons = await page.$$(`${app} .fixed.inset-0 button`);
    assert.equal(buttons.length, 3);
    await buttons.at(-1).click(); // Pure menu cancel, never the middle cancel-meeting control.
    await waitRoute('/meeting/detail');
    await page.click(`${app} [data-trigger="meeting.detail.actions.open"]`);
    await waitRoute('/meeting/detail?dialog=actions');
    await page.click(`${app} [data-trigger="meeting.detail.edit.open"]`);
    await waitRoute('/meeting/edit');
    await page.waitForSelector(`${app} input`, { visible: true });
    assert.equal(await page.$eval(`${app} input`, input => input.value), selected.title);
    assert.deepEqual(await records(), before, 'Opening edit must not save/change/join a meeting');
    await page.click(`${app} [data-trigger="system.back"]`);
    await waitRoute('/meeting/detail');
    await page.waitForSelector(`${app} [data-trigger="meeting.detail.edit.open"]`, { hidden: true });
    assert.equal(await page.$eval(`${app} [data-benchmark-meeting-fact="subject"]`, node => node.textContent), selected.title);
    assert.deepEqual(await records(), before);
    await page.evaluate(() => window.__OS__.handleBack());
    await waitRoute('/');
    await page.waitForSelector(`${app} [data-trigger="home.meeting.detail"]`, { visible: true });
    assert.deepEqual(await records(), before);
    console.log(JSON.stringify({ posture, menuBack: true, menuCancel: true, declaredEditEntry: true,
      editBackToDetailWithoutMenu: true, detailBackHome: true, recordsUnchanged: true }));
    scenarios++;
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, scenarios, pageErrors: errors,
    scope: 'DOM-guided scheduled-detail/menu/edit-back controls; not edit saves, picker dialogs, history navigation, task recovery or CW19 qualification' }));
} finally { await browser.close(); }
