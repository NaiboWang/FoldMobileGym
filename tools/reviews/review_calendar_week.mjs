import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { openPilotApp } from '../browser-automation/pilot_app_navigation.mjs';
import { resolveBrowserExecutable } from '../browser-automation/browser.mjs';
fs.mkdirSync(path.resolve(import.meta.dirname, '../../artifacts'), {recursive:true});
const root = path.resolve(import.meta.dirname, '../..'), require = createRequire(path.join(root, 'foldmobilegym/package.json'));
const output = fs.mkdtempSync(path.join(root, 'artifacts/calendar-week-'));
const browser = await require('puppeteer').launch({ headless: true, executablePath: resolveBrowserExecutable() });
const page = await browser.newPage(), errors = [], app = '[data-app-id="calendar"]';
page.on('pageerror', error => errors.push(error.message));
const pause = () => new Promise(resolve => setTimeout(resolve, 450));
const state = () => page.evaluate(() => window.__SIM__.getState().apps.calendar);
async function jump(value) {
  await page.click(`${app} button[aria-label="更多"]`); await pause();
  await page.click(`${app} [data-trigger="date-jump.open"]`);
  await page.waitForSelector(`${app} input[type="date"]`);
  await page.$eval(`${app} input[type="date"]`, (el, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
  await page.click(`${app} [data-action="calendar.dateJump.submit"]`); await pause();
}
try {
  await page.setViewport({ width: 1600, height: 1200 });
  await page.goto(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3188/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__OS__ && window.__SIM__ && window.__FOLDAGENT__);
  await openPilotApp(page, 'calendar'); const original = await state(), fixture = original.events[0];
  const initialKey = await page.$eval(`${app} [data-calendar-selected="true"]`, el => el.dataset.benchmarkDate);
  await jump(fixture.start.slice(0, 10));
  await page.$eval(`${app} .calendar-reference-nav button[data-trigger-params*="week"]`, el => el.click()); await pause();
  assert.ok(await page.$(`${app} [data-calendar-week-event="${fixture.id}"]`), 'Week view must render the existing event, not only an empty time grid');
  const dayKeys = await page.$$eval(`${app} [data-calendar-week-date]`, els => els.map(el => el.dataset.calendarWeekDate));
  assert.equal(await page.$$eval(`${app} .calendar-week-now`, els => els.length), dayKeys.includes(initialKey) ? 1 : 0, 'Historical weeks must not show a current-time line');
  const selectedKey = dayKeys[3], anchor = Date.parse(`${selectedKey}T00:00:00+08:00`);
  const at = (day, hour = 0, minute = 0) => anchor + day * 86400000 + hour * 3600000 + minute * 60000;
  const record = (id, startTs, endTs, allDay = false) => ({ id, title: id, type: 'event', startTs, endTs, allDay });
  const reviewEvents = [record('review-overlap-a', at(0, 14), at(0, 15)), record('review-overlap-b', at(0, 14, 15), at(0, 14, 45)),
    record('review-overlap-c', at(0, 14, 30), at(0, 15, 30)), record('review-all', at(0), at(2), true),
    record('review-midnight', at(-1, 23, 30), at(0, 1)), record('review-invalid', at(0), at(0)),
    ...Array.from({ length: 8 }, (_, index) => record(`review-all-${index}`, at(0), at(1), true))];
  await page.$eval(`${app} [data-calendar-week-date="${selectedKey}"]`, el => el.scrollIntoView({ block: 'nearest', inline: 'center' }));
  await page.click(`${app} [data-calendar-week-date="${selectedKey}"]`); await pause();
  const selectedTs = (await state()).selectedDateTs;
  await page.evaluate(events => window.__SIM__.setState({ apps: { calendar: { events } } }, { deep: true }), [...original.events, ...reviewEvents]); await pause();
  assert.equal(await page.$$eval(`${app} [data-calendar-week-event="review-all"]`, els => els.length), 2);
  assert.equal(await page.$$eval(`${app} [data-calendar-week-event="review-midnight"]`, els => els.length), 2);
  assert.equal(await page.$$eval(`${app} [data-calendar-week-event="review-invalid"]`, els => els.length), 0);
  assert.equal(await page.$eval(`${app} [data-scroll-container="weekAllDay"]`, el => el.scrollHeight > el.clientHeight), true);
  for (const posture of ['folded', 'unfolded']) {
    await page.evaluate(value => window.__FOLDAGENT__.setPosture(value), posture); await pause();
    await page.$eval(`${app} [data-calendar-week-date="${selectedKey}"]`, el => el.scrollIntoView({ block: 'nearest', inline: 'center' }));
    await page.$eval(`${app} [data-scroll-container="main"]`, el => { el.scrollTop = 720; }); await pause();
    const rectangles = await page.$$eval(`${app} [data-calendar-week-event^="review-overlap"]`, els => els.map(el => {
      const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width, height: r.height };
    }).sort((a, b) => a.left - b.left));
    assert.equal(rectangles.length, 3); assert.ok(rectangles.every(rect => rect.width > 0 && rect.height > 0));
    assert.ok(rectangles[0].right <= rectangles[1].left && rectangles[1].right <= rectangles[2].left, 'Overlapping events must have separate hit areas');
    assert.equal(await page.$eval(app, el => el.scrollWidth <= el.clientWidth + 2), true, 'Week scroll must not overflow the activity');
    const beforeScroll = await page.$eval(`${app} [data-scroll-container="main"]`, el => el.scrollTop);
    const beforeLeft = await page.$eval(`${app} [data-scroll-container="weekColumns"]`, el => el.scrollLeft);
    assert.equal(await page.$$eval(`${app} .calendar-week-hour > span`, els => els.every(el => Math.abs(el.getBoundingClientRect().left - el.closest('.calendar-week-view').getBoundingClientRect().left) <= 1)), true, 'Hour labels must stay visible when day columns scroll horizontally');
    await page.click(`${app} [data-calendar-week-event="review-overlap-b"]`); await pause();
    assert.equal(await page.$eval(`${app} .calendar-event-detail[data-benchmark-source-id]`, el => el.dataset.benchmarkSourceId), 'review-overlap-b');
    await page.evaluate(() => window.__OS__.handleBack()); await page.waitForSelector(`${app} .calendar-week-view`, { visible: true }); await pause();
    assert.equal(await page.$eval(`${app} [data-scroll-container="main"]`, el => el.scrollTop), beforeScroll);
    assert.equal(await page.$eval(`${app} [data-scroll-container="weekColumns"]`, el => el.scrollLeft), beforeLeft);
    assert.equal((await state()).selectedDateTs, selectedTs);
    await page.screenshot({ path: path.join(output, `${posture}-overlap.png`) });
    await page.evaluate(value => window.__FOLDAGENT__.setPosture(value), posture === 'folded' ? 'unfolded' : 'folded'); await pause();
    assert.equal(await page.$eval(`${app} [data-scroll-container="main"]`, el => el.scrollTop), beforeScroll);
    await page.evaluate(value => window.__FOLDAGENT__.setPosture(value), posture); await pause();
    assert.equal(await page.$eval(`${app} [data-scroll-container="weekColumns"]`, el => el.scrollLeft), beforeLeft);
    const allSelector = `${app} [data-calendar-week-event="review-all-7"][data-calendar-week-day="${selectedKey}"]`;
    await page.$eval(allSelector, el => el.scrollIntoView({ block: 'nearest', inline: 'nearest' })); await pause();
    const allDayTop = await page.$eval(`${app} [data-scroll-container="weekAllDay"]`, el => el.scrollTop);
    assert.ok(allDayTop > 0, 'Review must exercise a genuinely scrolled all-day list');
    await page.click(allSelector); await pause();
    assert.equal(await page.$eval(`${app} .calendar-event-detail[data-benchmark-source-id]`, el => el.dataset.benchmarkSourceId), 'review-all-7');
    await page.evaluate(() => window.__OS__.handleBack()); await pause();
    assert.equal(await page.$eval(`${app} [data-scroll-container="weekAllDay"]`, el => el.scrollTop), allDayTop);
  }
  await page.evaluate(events => window.__SIM__.setState({ apps: { calendar: { events } } }, { deep: true }), original.events);
  await jump(initialKey); await page.waitForSelector(`${app} .calendar-week-empty`, { visible: true });
  assert.equal(await page.$$eval(`${app} [data-calendar-week-event]`, els => els.length), 0);
  assert.equal(await page.$$eval(`${app} .calendar-week-now`, els => els.length), 1, 'The current-time line belongs only to the current day');
  assert.equal(await page.$eval(`${app} [data-calendar-week-today="true"]`, el => el.dataset.calendarWeekDate), initialKey);
  await page.screenshot({ path: path.join(output, 'empty-current-week.png') });
  const locale = await page.evaluate(() => window.__OS__.locale.getLocale());
  await page.evaluate(() => window.__OS__.locale.setLocale('en'));
  await page.waitForFunction(selector => document.querySelector(selector)?.textContent === 'No events this week', {}, `${app} .calendar-week-empty`);
  assert.equal(await page.$eval(`${app} [data-calendar-week-date]`, el => /Sun|Mon|Tue|Wed|Thu|Fri|Sat/.test(el.textContent)), true);
  await page.screenshot({ path: path.join(output, 'english-empty-week.png') });
  await page.evaluate(value => window.__OS__.locale.setLocale(value), locale); await pause();
  const toggleStart = async () => {
    await page.click(`${app} button[aria-label="更多"]`); await pause();
    await page.click(`${app} [data-trigger="settings.open"]`); await pause();
    let found = false;
    for (const button of await page.$$(`${app} button`)) if (await button.evaluate(el => el.textContent.includes('一周开始日'))) { await button.click(); found = true; break; }
    assert.equal(found, true);
    await page.evaluate(() => window.__OS__.handleBack()); await pause();
  };
  await toggleStart();
  const firstKey = await page.$eval(`${app} [data-calendar-week-date]`, el => el.dataset.calendarWeekDate);
  assert.equal(new Date(`${firstKey}T00:00:00Z`).getUTCDay(), (await state()).settings.weekStartDay === 'sunday' ? 0 : 1);
  await toggleStart();
  assert.deepEqual(await state(), original); assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ passed: true, errors, checks: ['existing event rendered', 'overlap lanes and all-day/midnight clipping', 'all-day overflow', 'timed/all-day detail identity', 'week scroll and selection retained through Back and fold/unfold', 'empty/current-week rendering', 'English resources and actual week-start setting', 'original Calendar state restored'] }, null, 2));
  console.log(JSON.stringify({ passed: true, output }));
} catch (error) { await page.screenshot({ path: path.join(output, 'failure.png') }); console.error(output); throw error; }
finally { await browser.close(); }
